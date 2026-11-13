#!/usr/bin/env python3
"""Build Tony's Tech Support shop from distributor price/stock feeds.

Reads the Leader Computers and Dicker Data reseller feeds, keeps the product
categories that suit Tony's clients, picks the better supplier for each item,
applies Tony's pricing rules and writes a static website to ./site.

Feed links are private (they contain account tokens). They are read from the
environment variables LEADER_FEED_URL and DICKER_FEED_URL (GitHub secrets),
or from local files with --leader-file / --dicker-file for testing.

Only selling prices are written to the site. Buy prices never leave this script.
"""
import argparse, csv, io, json, math, os, re, shutil, sys, time, urllib.request, urllib.parse, urllib.error, datetime, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = json.load(open(os.path.join(ROOT, "config.json")))

# ---------------------------------------------------------------- categories
# Each shop category lists patterns that match "Category > Subcategory" text
# from either distributor. Patterns are case-insensitive regular expressions.
CATEGORIES = [
    ("laptops", "Laptops", [
        r"^notebooks > (\d+(\.\d)? inch|notebooks|)$", r"^notebooks/2-in-1", r"^notebooks$",
        r"^notebooks - resistance"]),
    ("desktops", "Desktops & All-in-Ones", [
        r"^desktops > (desktops|all.?in.?one|small form fac.*|micro.*|tiny|24 inch|mini tower|ultra.*form.*)$",
        r"^systems - "]),
    ("tablets", "Tablets", [r"^tablets > \d+ inch$", r"^tablets$", r"^tablets > tablets"]),
    ("monitors", "Monitors", [r"^displays > (19|21|22|23|24|25|27|28|31|32|34|38) inch$", r"^monitors"]),
    ("backup", "Backup Drives & Storage", [
        r"^storage > portable hdd$", r"^storage media > (portable hdd|usb drives)$", r"^storage > nas$",
        r"^hard drives - external", r"^backup, nas & storage", r"^flash memory"]),
    ("printers", "Printers & Scanners", [
        r"^printers > (laser mono|laser colour|inkjet|ink|ecotanks|printers)$", r"^printer hardware", r"^scanner"]),
    ("networking", "Wi-Fi & Networking", [
        r"^networking > (router|routers|unmanaged switch)$", r"^network - consumer", r"^network - modem/router"]),
    ("accessories", "Accessories", [
        r"^peripherals > (docking solutions|docking|usb-c docks|usb-c hubs|hubs|usb-a hubs|keyboard|ergonomics|speakers|audio video|laptop stand|usb-c multiport adap.*)$",
        r"^bags and cases > \d+ inch$",
        r"^(keyboards|mouse|notebook accessories|web cams|speakers, headsets & mic|dvd & bluray drives|macbook accessories)"]),
]
EXCLUDE_NAME = re.compile(
    r"warranty|care ?pack|\bservice|licen[cs]e|subscription|training|\bedu\b|education only|"
    r"soh only|refurb|demo unit|ex-?demo|\bspare\b|replacement part|cleaning|rack ?mount|"
    r"\bpoe\b|enterprise|server|buy [2-9]\b|buy two|\b[2-9] ?x ?bonus|\b\d+ ?x ?bundle|\bpack of \d+|smartnet|software upgrade|pc kit|barebone|\(0/\d\)", re.I)
# Accessories this broad need a sanity filter so the shop stays home/small-business friendly.
MAX_PRICE_BY_CAT = {"networking": 800, "backup": 2500, "accessories": 1200, "monitors": 2500, "printers": 2000}


def cat_for(path):
    p = path.strip().lower()
    for cid, _name, pats in CATEGORIES:
        for pat in pats:
            if re.search(pat, p):
                return cid
    return None


# ---------------------------------------------------------------- helpers
ACRONYMS = {"HP", "AMD", "USB", "SSD", "HDD", "FHD", "UHD", "QHD", "WUXGA", "WQXGA", "OLED", "IPS", "LED", "LCD",
            "RAM", "DDR4", "DDR5", "NVME", "PCIE", "HDMI", "VGA", "DP", "AI", "PC", "WIFI", "WI-FI", "BT", "LTE",
            "5G", "4G", "NAS", "TB", "GB", "MB", "OS", "PRO", "II", "III", "IV", "W11", "W11P", "W11H", "WIN11",
            "UK", "AU", "US", "MFC", "ADF", "A4", "A3", "LAN", "WAN", "AX", "AC", "RGB", "KVM", "QWERTY", "ASUS",
            "MSI", "LG", "NUC", "AIO", "SFF", "USB-C", "USB-A", "2-IN-1", "TKL", "ANC", "IR", "ARM", "PD", "HD", "KB",
            "GBE", "RJ45", "SD", "TV", "BT", "WL", "STM", "HP", "MFF", "QLED", "VA", "TN", "SATA", "M.2", "ESD", "XL"}
SMALL_WORDS = {"TO", "UP", "OF", "FOR", "AND", "WITH", "OR", "IN", "ON", "THE", "A", "AN", "AT", "BY", "VIA", "PLUS"}


def nice_case(s):
    """Turn SHOUTY DISTRIBUTOR TEXT into readable text, keeping model codes intact."""
    s = re.sub(r"\s+", " ", (s or "").replace("*", "")).strip(" ,-")
    letters = [c for c in s if c.isalpha()]
    if not letters or sum(c.isupper() for c in letters) / len(letters) < 0.7:
        return s
    out = []
    for w in s.split(" "):
        core = re.sub(r"[^\w\-+/.]", "", w).upper()
        if core in SMALL_WORDS and out:
            out.append(w.lower())
        elif core in ACRONYMS or any(ch.isdigit() for ch in w):
            out.append(w)
        elif "/" in w or "-" in w:
            parts = re.split(r"([/-])", w)
            out.append("".join(x if (x.upper() in ACRONYMS or any(c.isdigit() for c in x) or x in "/-")
                               else x[:1].upper() + x[1:].lower() for x in parts))
        else:
            out.append(w[:1].upper() + w[1:].lower())
    return " ".join(out)


def num(v):
    try:
        return float(re.sub(r"[^\d.\-]", "", str(v)) or "nan")
    except ValueError:
        return float("nan")


def qty(v):
    v = str(v or "").strip()
    if not v:
        return 0
    m = re.search(r"\d+", v)
    n = int(m.group()) if m else 0
    if v.startswith(">"):
        n += 1
    return n


def norm_mpn(s):
    return re.sub(r"[^A-Z0-9]", "", (s or "").upper())


def specs_for(name, cat):
    """Pull a few easy-to-read key specs out of the product name."""
    t = name.upper()
    out = []
    m = re.search(r"(\d{2}(?:\.\d)?)\s*(?:\"|''|INCH|IN\b|”)", t)
    if m and cat in ("laptops", "tablets", "monitors", "desktops"):
        out.append(f"{m.group(1)}\" screen")
    cpu = re.search(r"(\b[UC][3579]-\d{3}\w*|CORE\s?(?:ULTRA\s?)?[3579](?:[- ]\d{3,5}\w*)?|ULTRA\s?[579](?:[- ]\d{3}\w*)?|I[3579][- ]\d{4,5}\w*|RYZEN\s?(?:AI\s?)?[3579](?:\s?PRO)?(?:[- ]\d{3,4}\w*)?|R[3579][- ]\d{3,4}\w*|SNAPDRAGON\s?X\w*(?:\s?(?:PLUS|ELITE))?|CELERON\s?\w*|N[0-9]{3}\b|M[1-5](?:\s?(?:PRO|MAX))?\b)", t)
    if cpu and cat in ("laptops", "desktops", "tablets"):
        out.append(nice_case(cpu.group(1)).replace("Core", "Core").strip())
    gbs = re.findall(r"(\d{1,4})\s?(GB|TB)\b", t)
    if gbs and cat in ("laptops", "desktops", "tablets"):
        ram = [int(a) for a, u in gbs if u == "GB" and int(a) in (4, 8, 12, 16, 18, 24, 32, 36, 48, 64, 96, 128)]
        sto = [f"{a}{u}" for a, u in gbs if (u == "TB") or (u == "GB" and int(a) >= 128)]
        if ram:
            out.append(f"{ram[0]}GB memory")
        if sto:
            out.append(f"{sto[-1]} storage")
    if cat == "backup":
        m = re.search(r"(\d{1,3}(?:\.\d)?)\s?(TB|GB)\b", t)
        if m:
            out.append(f"{m.group(1)}{m.group(2)} capacity")
    if re.search(r"TOUCH", t) and not re.search(r"NON[- ]?TOUCH", t):
        out.append("Touchscreen")
    if re.search(r"W11P|WIN(?:DOWS)?\s?11\s?PRO|W11 PRO", t):
        out.append("Windows 11 Pro")
    elif re.search(r"W11H|WIN(?:DOWS)?\s?11|W11\b", t):
        out.append("Windows 11")
    return out[:6]


def derive(name, cat):
    """Numbers used by the use-case filter and the device picker."""
    t = name.upper()
    d = {}
    gbs = [(int(a), u) for a, u in re.findall(r"(\d{1,4})\s?(GB|TB)\b", t)]
    ram = [a for a, u in gbs if u == "GB" and a in (4, 8, 12, 16, 18, 24, 32, 36, 48, 64, 96, 128)]
    sto = [a * (1000 if u == "TB" else 1) for a, u in gbs if u == "TB" or a >= 128]
    if ram: d["ram"] = ram[0]
    if sto: d["sto"] = max(sto)
    m = re.search(r"(\d{2}(?:\.\d)?)\s*(?:\"|''|INCH|IN\b|”|-INCH)", t)
    if not m and cat == "laptops":
        m = re.search(r"\b(1[1-8](?:\.\d)?)\b(?= ?(?:\"|WUXGA|WQXGA|FHD|QHD|UHD|OLED|2\.[58]K|3K|TOUCH|AI\b))", t)
    if m and cat in ("laptops", "tablets", "monitors", "desktops"):
        try:
            v = float(m.group(1))
            if 10 <= v <= 34: d["scr"] = v
        except ValueError:
            pass
    tier = 0
    if re.search(r"I9|ULTRA ?9|\bU9|RYZEN ?(AI ?)?9|\bR9\b|HX\b|M[1-5] ?MAX", t): tier = 4
    elif re.search(r"I7|CORE ?7|ULTRA ?7|\bU7|\bC7|RYZEN ?(AI ?)?7|\bR7\b|SNAPDRAGON X ?ELITE|M[1-5] ?PRO", t): tier = 3
    elif re.search(r"I5|CORE ?5|ULTRA ?5|\bU5|\bC5|RYZEN ?(AI ?)?5|\bR5\b|SNAPDRAGON|\bM[1-5]\b", t): tier = 2
    elif re.search(r"I3|CORE ?3|\bC3|RYZEN ?3|\bR3\b|CELERON|PENTIUM|ATHLON|\bN\d{3}\b|\bN\d{4}\b", t): tier = 1
    if tier: d["cpu"] = tier
    if re.search(r"RTX|GTX|RADEON RX|\bRX ?\d{4}|ARC A\d|QUADRO", t): d["gpu"] = 1
    if (re.search(r"TOUCH", t) and not re.search(r"NON[- ]?TOUCH", t)) or (cat == "laptops" and re.search(r"\bTS\b", t)): d["tch"] = 1
    if re.search(r"FLIP|X360|2-IN-1|2 IN 1|YOGA|DETACHABLE", t): d["flip"] = 1
    return d


def use_cases(cat, d):
    """Which everyday uses a device suits, based on its specs."""
    if cat not in ("laptops", "desktops"):
        return []
    ram, cpu, sto = d.get("ram", 0), d.get("cpu", 0), d.get("sto", 0)
    u = []
    if ram >= 8 and cpu >= 1: u.append("everyday")
    if ram >= 8 and cpu >= 2: u.append("study")
    if ram >= 16 and cpu >= 2: u.append("business")
    if ram >= 16 and cpu >= 3 and sto >= 512: u.append("creative")
    if d.get("gpu") and ram >= 16: u.append("gaming")
    if cat == "laptops" and 0 < d.get("scr", 0) <= 14.5: u.append("portable")
    if (cat == "laptops" and d.get("scr", 0) >= 15.5) or cat == "desktops": u.append("bigscreen")
    return u


def os_for(brand, name, cat):
    t = (brand + " " + name).upper()
    if re.search(r"\bAPPLE\b|MACBOOK|IMAC|MAC MINI|MAC STUDIO|IPAD", t):
        return "mac"
    if re.search(r"CHROMEBOOK|CHROME OS", t):
        return "chrome"
    if cat in ("laptops", "desktops") or re.search(r"WINDOWS|W11", t):
        return "windows"
    return ""


# ---------------------------------------------------------------- feed readers
def fetch(url, label):
    req = urllib.request.Request(url, headers={"User-Agent": "TTS-shop-builder/1.0"})
    with urllib.request.urlopen(req, timeout=300) as r:
        data = r.read()
    text = data.decode("utf-8-sig", errors="replace")
    if text.lstrip().startswith("{") and "Cannot generate" in text[:200]:
        raise RuntimeError(f"{label} feed is not active yet ({text[:80]})")
    return text


def read_dicker(text):
    items = []
    for r in csv.DictReader(io.StringIO(text)):
        if r.get("Status", "A") not in ("A", "T"):
            continue
        path = f"{r.get('PrimaryCategory','')} > {r.get('SecondaryCategory','')}"
        items.append({
            "mpn": r.get("VendorStockCode") or r.get("StockCode"),
            "code": r.get("StockCode"),
            "name": r.get("StockDescription", ""),
            "brand": r.get("Vendor", ""),
            "path": path,
            "costEx": num(r.get("DealerEx")),
            "rrpInc": num(r.get("RRPEx")) * (1 + CFG["pricing"]["gst"]),
            "stock": qty(r.get("StockAvailable")),
            "perth": 0,
            "image": "",
            "desc": "",
            "warranty": "",
            "src": 2,
        })
    return items


LEADER_FIELDS = {
    # our key: list of normalised header fragments, first match wins
    "catcode": ["categorycode"], "cat": ["categoryname", "category"], "sub": ["subcategory"],
    "image": ["image"], "code": ["stockcode"], "barcode": ["barcode"], "mpn": ["manufacturersku", "mfgsku", "mpn", "manufacturerpart"],
    "name": ["productname", "shortdescription", "productdescription", "description"],
    "long": ["longdescription", "secondaryproductname", "secondarydescription"],
    "warranty": ["warranty"], "brand": ["manufacturer", "brand", "vendor"],
    "dbp": ["dealerbuyprice", "dbp"], "rrp": ["standardrrp", "rrp"],
    "total": ["availabilitytotal", "totalavailability", "availtotal", "total"], "perth": ["perth", "availabilitywa"],
}
# Column order from Leader's data feed page, used if the file has no header row.
LEADER_POSITIONAL = ["catcode", "cat", "sub", "image", "code", "barcode", "weight", "mpn", "name", "long", "warranty",
                     "brand", "dbp", "dbp20", "yourrrp", "rrp", "total", "adl", "bne", "syd", "mel", "perth", "updated"]


def read_leader(text):
    rows = list(csv.reader(io.StringIO(text)))
    if not rows:
        return []
    header = [re.sub(r"[^a-z0-9]", "", h.lower()) for h in rows[0]]
    looks_like_header = any("stock" in h for h in header) and not any(re.fullmatch(r"\d+(\.\d+)?", h) for h in header[:3])
    idx = {}
    if looks_like_header:
        for key, frags in LEADER_FIELDS.items():
            for frag in frags:
                hit = [i for i, h in enumerate(header) if frag in h and not (key == "brand" and "sku" in h)
                       and not (key == "dbp" and "20" in h) and not (key == "rrp" and "your" in h)
                       and not (key == "name" and "long" in h) and not (key == "name" and "secondary" in h)
                       and not (key == "cat" and ("code" in h or "sub" in h))]
                if hit:
                    idx[key] = hit[0]
                    break
        body = rows[1:]
    else:
        idx = {k: i for i, k in enumerate(LEADER_POSITIONAL)}
        body = rows
    print("Leader columns matched:", {k: (rows[0][v] if looks_like_header else v) for k, v in idx.items()}, file=sys.stderr)

    def g(r, k):
        i = idx.get(k)
        return r[i] if i is not None and i < len(r) else ""

    items = []
    for r in body:
        if len(r) < 5:
            continue
        items.append({
            "mpn": g(r, "mpn") or g(r, "code"),
            "code": g(r, "code"),
            "name": g(r, "name"),
            "brand": g(r, "brand"),
            "path": f"{g(r,'cat')} > {g(r,'sub')}".strip(" >") if g(r, "sub") else g(r, "cat"),
            "costEx": num(g(r, "dbp")),
            "rrpInc": num(g(r, "rrp")),
            "stock": qty(g(r, "total")),
            "perth": qty(g(r, "perth")),
            "image": g(r, "image").strip(),
            "desc": g(r, "long"),
            "warranty": g(r, "warranty"),
            "src": 1,
        })
    return items


# ---------------------------------------------------------------- pricing
def sell_price(item, cat):
    p = CFG["pricing"]
    freight = p["freightExGst"].get(cat, 10)
    step = p.get("roundTo", 1) or 1
    price = math.ceil((item["costEx"] + freight) * p["markup"] * (1 + p["gst"]) / step - 1e-9) * step
    if p.get("capAtRRP") and item["rrpInc"] == item["rrpInc"] and item["rrpInc"] > 0:
        floor_price = math.ceil((item["costEx"] + freight) * (1 + p["gst"]) * 1.05)  # never below cost + 5%
        if price > item["rrpInc"] >= floor_price:
            price = max(floor_price, math.floor(item["rrpInc"] / step) * step)
    return price


def lead_time(item):
    lt = CFG["leadTimes"]
    base = lt["perth"] if item["perth"] > 0 else lt["interstate"]
    return [base[0] + lt["extraDays"], base[1] + lt["extraDays"]]



# ---------------------------------------------------------------- product photos and names (Open Icecat)
ICECAT_USER = os.environ.get("ICECAT_USER", "openIcecat-live")  # public Open Icecat login, no account needed
ICECAT_CACHE = os.environ.get("ICECAT_CACHE", os.path.join(ROOT, ".cache", "icecat.json"))
ICECAT_MAX = int(os.environ.get("ICECAT_MAX", "5000"))  # new lookups per nightly run
BRAND_ALIASES = {"DLINK": "D-Link", "WD": "Western Digital", "STARTECH": "StarTech.com", "TPLINK": "TP-Link"}


def short_title(t):
    t = re.sub(r"\s+", " ", t or "").strip()
    if len(t) > 110 and " - " in t:
        t = t.split(" - ")[0]
    return t[:140]


def icecat_lookup(brand, mpn):
    mpn = re.sub(r"^\d*(PROMO|BONUS)-", "", mpn or "", flags=re.I)
    q = urllib.parse.urlencode({"UserName": ICECAT_USER, "Language": "en", "Brand": brand, "ProductCode": mpn})
    req = urllib.request.Request("https://live.icecat.biz/api?" + q, headers={"User-Agent": "TTS-shop-builder/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            j = json.loads(r.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as e:
        return {"ok": 0, "why": e.code}
    data = j.get("data") or {}
    gi, img = data.get("GeneralInfo") or {}, data.get("Image") or {}
    summ = (gi.get("SummaryDescription") or {})
    pic = img.get("Pic500x500") or img.get("HighPic") or img.get("LowPic") or ""
    return {"ok": 1, "t": short_title(gi.get("Title") or ""), "img": pic,
            "sum": summ.get("LongSummaryDescription") or summ.get("ShortSummaryDescription") or ""}


def icecat_variants(brand, mpn):
    """Other part-number spellings worth trying when the exact code isn't in Icecat."""
    m = re.sub(r"^\d*(PROMO|BONUS)-", "", mpn or "", flags=re.I)
    out = []  # (code, name_is_reliable)
    base = m.split("-")[0]
    if "-" in m and len(base) >= 6:
        out.append((base, False))             # bundle codes like ABC123-HEADSET
    b = norm_mpn(brand)
    if b == "HP" and "#" not in m:
        out.append((base + "#ABG", True))     # HP's Australian locale suffix
    if b == "LENOVO" and re.fullmatch(r"[0-9A-Z]{8}AU", base):
        out += [(base[:-2] + "US", False), (base[:-2] + "UK", False)]  # same model, other region (photo only)
    return out


def lookup_with_variants(brand, mpn):
    c = icecat_lookup(brand, mpn)
    if c.get("ok"):
        return c
    for code, reliable in icecat_variants(brand, mpn):
        v = icecat_lookup(brand, code)
        if v.get("ok"):
            if not reliable:
                v["base"] = 1  # photo is right, but keep the distributor's own name
            return v
    return c


def enrich_from_icecat(products):
    """Add photos, clearer names and descriptions from Open Icecat. Results are cached between runs."""
    if os.environ.get("ICECAT_OFF"):
        return
    from concurrent.futures import ThreadPoolExecutor
    try:
        cache = json.load(open(ICECAT_CACHE))
    except Exception:
        cache = {}
    today = datetime.date.today().toordinal()
    todo = []
    for pr in products:
        c = cache.get(pr["id"])
        fresh = c and (c.get("ok") or c.get("v") == 2) and today - c.get("d", 0) < (60 if c.get("ok") else 21)
        if not fresh and not pr["img"]:
            todo.append(pr)
    todo = todo[:ICECAT_MAX]

    def work(pr):
        brand = BRAND_ALIASES.get(norm_mpn(pr["_brand"]), pr["_brand"] or pr["b"])
        try:
            return pr["id"], lookup_with_variants(brand, pr["_mpn"])
        except Exception as e:
            return pr["id"], {"ok": 0, "err": str(e)[:80]}

    errors = 0
    with ThreadPoolExecutor(max_workers=6) as ex:
        for key, c in ex.map(work, todo):
            if c.get("err"):
                errors += 1
                continue  # network trouble: try again next run
            c["d"] = today
            c["v"] = 2
            cache[key] = c
    hits = 0
    for pr in products:
        c = cache.get(pr["id"])
        if c and c.get("ok"):
            pr["_ice"] = c
            hits += 1
    os.makedirs(os.path.dirname(ICECAT_CACHE), exist_ok=True)
    with open(ICECAT_CACHE, "w") as f:
        json.dump(cache, f, separators=(",", ":"))
    print(f"Icecat: {len(todo)} new lookups ({errors} failed), {hits}/{len(products)} products matched", file=sys.stderr)


# ---------------------------------------------------------------- pages for Google
def slug(pid):
    return re.sub(r"[^a-z0-9]+", "-", pid.lower()).strip("-")


def write_seo_pages(products, out_dir, now):
    base = CFG["site"]["url"].rstrip("/")
    tpl = open(os.path.join(out_dir, "index.html"), encoding="utf-8").read()
    cats = {c[0]: c[1] for c in CATEGORIES}
    os.makedirs(os.path.join(out_dir, "p"), exist_ok=True)
    e = html.escape
    urls = [(base + "/", "daily"), (base + "/picker.html", "weekly")]
    for pr in products:
        url = f"{base}/p/{pr['s']}.html"
        urls.append((url, "daily"))
        title = f"{pr['n']} | {money(pr['p'])} | Tony's Tech Support Perth"
        desc = (f"{pr['n']} for {money(pr['p'])}, checked, set up and delivered in Perth by Tony's Tech Support. "
                + ", ".join(pr["sp"]))[:300]
        ld = {
            "@context": "https://schema.org", "@type": "Product", "name": pr["n"], "sku": pr["id"], "mpn": pr["id"],
            "category": cats.get(pr["c"], ""), "description": (pr["d"] or desc)[:500],
            "offers": {"@type": "Offer", "url": url, "priceCurrency": "AUD", "price": f"{pr['p']:.2f}",
                       "availability": "https://schema.org/InStock", "itemCondition": "https://schema.org/NewCondition",
                       "seller": {"@type": "LocalBusiness", "name": "Tony's Tech Support", "telephone": CFG["site"]["phone"],
                                  "address": {"@type": "PostalAddress", "streetAddress": "10 McMullan View", "addressLocality": "Hazelmere",
                                              "addressRegion": "WA", "postalCode": "6055", "addressCountry": "AU"}}},
        }
        if pr["b"]:
            ld["brand"] = {"@type": "Brand", "name": pr["b"]}
        if pr["img"]:
            ld["image"] = pr["img"]
        head = (f"<title>{e(title)}</title>\n<meta name=\"description\" content=\"{e(desc)}\">\n"
                f"<link rel=\"canonical\" href=\"{e(url)}\">\n<meta property=\"og:title\" content=\"{e(pr['n'])}\">\n"
                f"<meta property=\"og:url\" content=\"{e(url)}\">\n<meta property=\"og:type\" content=\"product\">\n"
                + (f"<meta property=\"og:image\" content=\"{e(pr['img'])}\">\n" if pr["img"] else "")
                + "<script type=\"application/ld+json\">" + json.dumps(ld).replace("</", "<\\/") + "</script>\n"
                + f"<script>window.TTS_PRODUCT={json.dumps(pr['id'])};</script>")
        body = (f"<div class=\"crumbs\"><a href=\"/\">Shop</a> › <a href=\"/#/c/{pr['c']}\">{e(cats.get(pr['c'], ''))}</a></div>"
                f"<h1>{e(pr['n'])}</h1><p class=\"price\">{money(pr['p'])}</p>"
                + ("<ul>" + "".join(f"<li>{e(x)}</li>" for x in pr["sp"]) + "</ul>" if pr["sp"] else "")
                + (f"<p>{e(pr['d'])}</p>" if pr["d"] else "")
                + "<p>Checked, set up and delivered in Perth by Tony's Tech Support. Call or text Tony on "
                + e(CFG["site"]["phone"]) + ".</p>")
        page = re.sub(r"<title>.*?</title>\s*<meta name=\"description\"[^>]*>", lambda m: head, tpl, count=1, flags=re.S)
        page = page.replace("<p style=\"padding:40px 0\">Loading the shop…</p>", body)
        with open(os.path.join(out_dir, "p", pr["s"] + ".html"), "w", encoding="utf-8") as f:
            f.write(page)
    picker = tpl.replace("<title>Tony's Tech Support Shop | Laptops, Computers & Tech, Set Up for You</title>",
                         "<title>Help me choose a computer | Tony's Tech Support Perth</title>\n<link rel=\"canonical\" href=\"" + base + "/picker.html\">\n<script>window.TTS_VIEW=\"picker\";</script>")
    with open(os.path.join(out_dir, "picker.html"), "w", encoding="utf-8") as f:
        f.write(picker)
    day = now.strftime("%Y-%m-%d")
    with open(os.path.join(out_dir, "sitemap.xml"), "w") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for u, freq in urls:
            f.write(f"<url><loc>{html.escape(u)}</loc><lastmod>{day}</lastmod><changefreq>{freq}</changefreq></url>\n")
        f.write("</urlset>\n")
    with open(os.path.join(out_dir, "robots.txt"), "w") as f:
        f.write(f"User-agent: *\nAllow: /\nSitemap: {base}/sitemap.xml\n")
    with open(os.path.join(out_dir, "404.html"), "w", encoding="utf-8") as f:
        f.write(tpl.replace("<script src=\"/app.js\">", "<script>window.TTS_VIEW=\"gone\";</script><script src=\"/app.js\">").replace("<p style=\"padding:40px 0\">Loading the shop…</p>",
                            "<div class=\"empty\" style=\"margin-top:30px\"><h2>That product has sold out</h2><p>Stock changes every day. <a href=\"/\">See what's available</a>.</p></div>"))


def money(n):
    return "$" + (f"{n:,.0f}" if n == int(n) else f"{n:,.2f}")


# ---------------------------------------------------------------- main build
def build(leader_text, dicker_text, out_dir):
    raw = []
    if leader_text:
        raw += read_leader(leader_text)
    if dicker_text:
        raw += read_dicker(dicker_text)
    print(f"Read {len(raw)} feed rows", file=sys.stderr)

    best = {}
    stats = {"kept": 0, "aboveRRP": 0, "both": 0}
    for it in raw:
        cat = cat_for(it["path"])
        if not cat or it["stock"] <= 0 or not (it["costEx"] > 0):
            continue
        if EXCLUDE_NAME.search(it["name"]):
            continue
        key = norm_mpn(it["mpn"])
        if not key:
            continue
        it["cat"] = cat
        it["price"] = sell_price(it, cat)
        if it["price"] > MAX_PRICE_BY_CAT.get(cat, CFG["pricing"]["maxPriceIncGst"]) or it["price"] > CFG["pricing"]["maxPriceIncGst"]:
            continue
        cur = best.get(key)
        if cur is None:
            best[key] = it
            continue
        stats["both"] += 1
        # Prefer Perth stock unless the other supplier is clearly cheaper.
        pref = 1 + CFG["pricing"]["perthPreferencePct"] / 100
        a, b = cur, it
        if (a["perth"] > 0) != (b["perth"] > 0):
            perth, other = (a, b) if a["perth"] > 0 else (b, a)
            winner = perth if perth["costEx"] <= other["costEx"] * pref else other
        else:
            winner = a if a["costEx"] <= b["costEx"] else b
        loser = b if winner is a else a
        # Keep the best content (image/description) from either supplier.
        for f in ("image", "desc", "warranty"):
            if not winner[f] and loser[f]:
                winner[f] = loser[f]
        best[key] = winner

    products = []
    for key, it in best.items():
        if it["rrpInc"] == it["rrpInc"] and it["rrpInc"] > 0 and it["price"] > it["rrpInc"]:
            stats["aboveRRP"] += 1
        desc = re.sub(r"<[^>]+>", " ", html.unescape(it["desc"] or ""))
        desc = re.sub(r"\s+", " ", desc).strip()[:1500]
        products.append({
            "id": key,
            "_raw": it["name"], "_brand": it["brand"], "_mpn": it["mpn"], "_path": it["path"],
            "b": nice_case(it["brand"]) if it["brand"] else "",
            "c": it["cat"],
            "p": it["price"],
            "img": it["image"] if it["image"].startswith("http") else "",
            "d": desc,
            "w": nice_case(it["warranty"]) if it["warranty"] else "",
            "lt": lead_time(it),
            "low": 1 if it["stock"] <= 3 else 0,
            "pe": 1 if it["perth"] > 0 else 0,
            "os": os_for(it["brand"], it["name"], it["cat"]),
            "k": it["src"],
        })

    enrich_from_icecat(products)
    overrides = {}
    pdir = os.path.join(ROOT, "photos")
    if os.path.isdir(pdir):
        for fn in os.listdir(pdir):
            stem, ext = os.path.splitext(fn)
            if ext.lower() in (".jpg", ".jpeg", ".png", ".webp"):
                overrides[norm_mpn(stem)] = fn

    for pr in products:
        raw, ice = pr.pop("_raw"), pr.pop("_ice", None)
        brand_raw = pr.pop("_brand"); pr.pop("_mpn"); path = pr.pop("_path")
        if ice and ice.get("t") and not ice.get("base"):
            name = ice["t"]
        else:
            name = nice_case(raw)
            brand = pr["b"]
            if brand and norm_mpn(brand) not in norm_mpn(" ".join(name.split()[:3])):
                name = f"{brand} {name}"
        pr["n"] = name
        text = name + " " + raw
        pr["sp"] = specs_for(text, pr["c"])
        size = re.search(r"(\d{2}(?:\.\d)?) INCH", path.upper())
        d = derive(text + (f' {size.group(1)}"' if size else ""), pr["c"])
        pr.update(d)
        pr["u"] = use_cases(pr["c"], d)
        if ice:
            if not pr["img"] and ice.get("img"):
                pr["img"] = ice["img"]
            if not pr["d"] and ice.get("sum"):
                pr["d"] = ice["sum"][:1500]
        if pr["id"] in overrides:
            pr["img"] = "/photos/" + overrides[pr["id"]]
        pr["os"] = pr["os"] or os_for(brand_raw, name, pr["c"])
        pr["s"] = slug(pr["id"])
    if CFG["pricing"].get("hideWithoutPhoto"):
        before = len(products)
        products = [p for p in products if p["img"]]
        print(f"Hid {before - len(products)} products without a photo", file=sys.stderr)
    products.sort(key=lambda x: (x["c"], x["p"]))
    stats["kept"] = len(products)

    # ---- write the site
    if os.path.exists(out_dir):
        shutil.rmtree(out_dir)
    shutil.copytree(os.path.join(ROOT, "site_src"), out_dir)
    if os.path.isdir(os.path.join(ROOT, "photos")):
        shutil.copytree(os.path.join(ROOT, "photos"), os.path.join(out_dir, "photos"))
    os.makedirs(os.path.join(out_dir, "data"), exist_ok=True)
    now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8)))
    public_cfg = {
        "site": CFG["site"], "services": CFG["services"], "payments": CFG["payments"],
        "orders": CFG["orders"], "callout": CFG["callout"], "roundTo": CFG["pricing"].get("roundTo", 1),
        "categories": [{"id": c[0], "name": c[1]} for c in CATEGORIES],
        "updated": now.strftime("%A %-d %B %Y, %-I:%M %p").replace("AM", "am").replace("PM", "pm"),
    }
    with open(os.path.join(out_dir, "data", "products.json"), "w") as f:
        json.dump(products, f, separators=(",", ":"))
    with open(os.path.join(out_dir, "data", "config.json"), "w") as f:
        json.dump(public_cfg, f, separators=(",", ":"))
    with open(os.path.join(out_dir, "CNAME"), "w") as f:
        f.write(CFG["site"]["url"].split("//", 1)[1] + "\n")
    write_seo_pages(products, out_dir, now)
    counts = {}
    for p in products:
        counts[p["c"]] = counts.get(p["c"], 0) + 1
    print(f"Built {len(products)} products: {counts}", file=sys.stderr)
    print(f"Items in both feeds: {stats['both']}; priced above RRP: {stats['aboveRRP']}", file=sys.stderr)
    return products


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--leader-file")
    ap.add_argument("--dicker-file")
    ap.add_argument("--out", default=os.path.join(ROOT, "site"))
    a = ap.parse_args()

    def get(file_arg, env, label):
        if file_arg:
            return open(file_arg, encoding="utf-8-sig", errors="replace").read()
        url = os.environ.get(env, "").strip()
        if not url:
            print(f"{label}: no feed link set ({env}); skipping", file=sys.stderr)
            return ""
        try:
            return fetch(url, label)
        except Exception as e:  # keep building with the other supplier
            print(f"{label}: could not download feed: {e}", file=sys.stderr)
            return ""

    leader = get(a.leader_file, "LEADER_FEED_URL", "Leader")
    dicker = get(a.dicker_file, "DICKER_FEED_URL", "Dicker Data")
    if not leader and not dicker:
        sys.exit("No feed data available; leaving the live site unchanged.")
    products = build(leader, dicker, a.out)
    if len(products) < 20:
        sys.exit(f"Only {len(products)} products built; something is wrong, not publishing.")


if __name__ == "__main__":
    main()
