#!/usr/bin/env python3
# Version v7.0 · 2026-11-14
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
    # Handheld gaming PCs are found by name (see HANDHELD_NAME), whatever category the supplier files them under.
    ("handhelds", "Handheld Gaming PCs", []),
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
        r"^peripherals > (adapters|dp and mdp display a.*|hdmi and dvi display.*|usb-c display adapte.*|display and video ad.*|usb and thunderbolt.*|thunderbolt 3 displa.*)$",
        r"^networking > (adapters|laptop network adapt.*)$",
        r"^bags and cases > (\d+ inch|accessories|apple devices|surface devices|samsung devices|tablets|fitted cases)$",
        r"^(keyboards|mouse|notebook accessories|web cams|speakers, headsets & mic|dvd & bluray drives|macbook accessories)"]),
]
EXCLUDE_NAME = re.compile(
    r"warranty|care ?pack|next business day|\bnbd\b|hardware support|support plan|travel coverage|accidental damage|\bservice|licen[cs]e|subscription|training|\bedu\b|education only|"
    r"soh only|\bspare\b|replacement part|cleaning|rack ?mount|"
    r"\bpoe\b|enterprise|server|buy [2-9]\b|buy two|\b[2-9] ?x ?bonus|\b\d+ ?x ?bundle|\bpack of \d+|smartnet|software upgrade|pc kit|barebone|\(0/\d\)", re.I)
# Handheld gaming PCs (most can plug into a dock to become a desktop).
HANDHELD_NAME = re.compile(r"legion go|rog ally|xbox ally|\bmsi claw|steam deck|zotac zone|ayaneo|onexplayer|gpd win|handheld (gaming )?pc|game console", re.I)
# Refurbished / ex-demo stock is kept for computers, tablets and handhelds only, and labelled clearly.
REFURB_NAME = re.compile(r"refurb|renewed|pre-?owned|demo unit|ex-?demo|\bdemo\b|\bgrade [abc]\b", re.I)
REFURB_CATS = {"laptops", "desktops", "tablets", "handhelds"}
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
    if cat == "monitors":
        res = 0
        if re.search(r"\b5K\b|5120 ?X ?2880", t): res = 2880
        elif re.search(r"\b4K\b|UHD|3840 ?X ?2160|2160P", t): res = 2160
        elif re.search(r"WQHD|QHD|2560 ?X ?1440|3440 ?X ?1440|1440P|2K\b", t): res = 1440
        elif re.search(r"WUXGA|1920 ?X ?1200", t): res = 1200
        elif re.search(r"FHD|FULL ?HD|1920 ?X ?1080|1080P", t): res = 1080
        elif re.search(r"1366 ?X ?768|\bHD\b", t): res = 768
        if res: d["res"] = res
        hz = re.search(r"(\d{2,3}) ?HZ", t)
        if hz and 50 <= int(hz.group(1)) <= 540: d["hz"] = int(hz.group(1))
    if cat == "backup" and gbs:
        caps = [a * (1000 if u == "TB" else 1) for a, u in gbs]
        d["sto"] = max(caps)
    return d


# ---------------------------------------------------------------- shop sections inside Accessories, and connectors
SECTIONS = [  # (id, name) — products stay in Accessories as well
    ("hubs", "USB Hubs & Docks"), ("adapters", "Adapters"), ("bags", "Bags & Cases"), ("kbm", "Keyboards & Mice"),
]
CONNECTORS = [  # (label, pattern) in the order shown to clients
    ("USB-C", r"USB[- ]?C\b|TYPE[- ]?C|USB4"), ("Thunderbolt", r"THUNDERBOLT|\bTB ?[345]\b"), ("USB-A", r"USB[- ]?A\b|USB ?[23]\.\d(?![- ]?(C|TYPE))(?! TO)|\d ?X ?USB\b(?![- ]?C)|USB ?\(\d\)|USB PORTS?\b|USB HUB"),
    ("HDMI", r"HDMI"), ("DisplayPort", r"DISPLAYPORT|\bDP\b(?!S)|\bDP ?1\.\d"), ("Mini DisplayPort", r"MINI ?DISPLAYPORT|\bMDP\b|MINI ?DP"),
    ("VGA", r"\bVGA\b"), ("DVI", r"\bDVI\b"), ("Ethernet", r"ETHERNET|\bRJ-?45\b|GBE\b|\bLAN\b|GIGABIT|NIC\b"),
    ("SD card", r"\bSD\b|MICRO ?SD|CARD READER"), ("Audio (3.5mm)", r"3\.5 ?MM|AUDIO"), ("Lightning", r"LIGHTNING"), ("Micro-USB", r"MICRO[- ]?USB|MICRO[- ]?B\b"),
]


def sections_for(cat, name, path):
    """Which extra shop sections an accessory also appears in."""
    if cat != "accessories":
        return []
    n, pth = name.upper(), path.upper()
    out = []
    kbm = re.search(r"KEYBOARD|\bMOUSE\b|\bMICE\b|KEYPAD|TRACKBALL|TRACKPAD", n) and not re.search(r"\bBAG\b|CASE\b|SLEEVE|MOUSE ?PAD|MOUSEPAD|WRIST ?REST|TRAY\b|DOCK", n)
    if kbm:
        out.append("kbm")
    if re.search(r"\bHUB\b|DOCK|MULTIPORT|MULTI-PORT|PORT REPLICATOR|\d ?-?IN-?1\b", n) and not re.search(r"DRIVE DOCK|DUPLICATOR|ENCLOSURE|HARD DRIVE|SSD DOCK|\bBAG\b|CASE\b", n) and not kbm:
        out.append("hubs")
    named = re.search(r"ADAPT|CONVERTER|DONGLE", n)
    internal = re.search(r"PCIE|PCI EXPRESS|PCI-E|SLOT PLATE|BRACKET|HEADER|INTERNAL", n)
    if not internal and (named or ("hubs" not in out and re.search(r"\bTO\b.*(HDMI|DISPLAYPORT|VGA|DVI|ETHERNET|USB)", n))) and not ("hubs" in out and re.search(r"\bHUB\b", n)) \
            and not kbm and not re.search(r"POWER ADAPT|\bAC ADAPT|CHARGER|\bW\b ADAPT|\d+W\b", n):
        out.append("adapters")
    if re.search(r"\bBAG\b|BACKPACK|SLEEVE|BRIEFCASE|MESSENGER|TOPLOAD|TOP LOAD|TOTE\b|CARRY ?CASE|LAPTOP CASE|NOTEBOOK CASE|\bCASE\b|FOLIO|POUCH", n) or pth.startswith("BAGS AND CASES"):
        if not re.search(r"CASE FAN|PHONE CASE", n):
            out.append("bags")
    return out


def connectors_for(name):
    """For hubs, docks and adapters: what it plugs into (ci) and what you can connect to it (co)."""
    n = name.upper().replace("TYPE-C", "USB-C")
    def found(text):
        f = [lab for lab, pat in CONNECTORS if re.search(pat, text)]
        if "Mini DisplayPort" in f and not re.search(r"(?<!MINI )(?<!MINI)DISPLAYPORT|(?<!M)\bDP\b", text.replace("MINI DISPLAYPORT", "").replace("MINI DP", "")):
            f.remove("DisplayPort") if "DisplayPort" in f else None
        return f
    m = re.search(r"\bTO\b", n)
    if m:
        ci, co = found(n[:m.start()]), found(n[m.end():])
        ci = [c for c in ci if c not in ("SD card", "Audio (3.5mm)", "Ethernet")][:2]
        if re.search(r"WITH USB-?A (ADAPT|CONVERT)", n):
            ci.append("USB-A"); co = [c for c in co if c != "USB-A"]
    else:
        allc = found(n)
        if "Thunderbolt" in allc: ci = ["Thunderbolt", "USB-C"] if "USB-C" in allc else ["Thunderbolt"]
        elif "USB-C" in allc: ci = ["USB-C"]
        else: ci = ["USB-A"]
        co = [c for c in allc if c not in ci]
        if re.search(r"\bHUB\b", n) and not co:
            co = ["USB-A"]
    if "Thunderbolt" in ci and "USB-C" not in ci:
        ci.append("USB-C")  # Thunderbolt 3/4 devices plug into USB-C shaped ports
    if not ci and co:
        ci = ["USB-A"] if "USB" in n else []
    ports = [int(x) for x in re.findall(r"(\d{1,2}) ?-?(?:PORTS?\b|IN-?1\b)", n) if 1 < int(x) <= 20]
    return {"ci": ci, "co": [c for c in co if c not in ci or len(set(co)) == 1], "pt": max(ports) if ports else 0}


def use_cases(cat, d):
    """Which everyday uses a device suits, based on its specs."""
    if cat == "handhelds":
        return ["everyday", "gaming", "portable"]
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
            "gtin": re.sub(r"\D", "", g(r, "barcode")),
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


def icecat_lookup(brand, mpn, gtin=""):
    mpn = re.sub(r"^\d*(PROMO|BONUS)-", "", mpn or "", flags=re.I)
    if gtin:  # barcode lookups (from Leader's feed) find many products the part number doesn't
        q = urllib.parse.urlencode({"UserName": ICECAT_USER, "Language": "en", "GTIN": gtin})
    else:
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
    gal = []
    for g in data.get("Gallery") or []:
        u = g.get("Pic500x500") or g.get("Pic") or g.get("LowPic") or ""
        if u and u != pic and u not in gal:
            gal.append(u)
    return {"ok": 1, "t": short_title(gi.get("Title") or ""), "img": pic, "gal": gal[:7],
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


def lookup_with_variants(brand, mpn, gtin=""):
    c = icecat_lookup(brand, mpn)
    if c.get("ok"):
        return c
    if gtin and len(gtin) in (8, 12, 13, 14):
        g = icecat_lookup(brand, mpn, gtin)
        if g.get("ok"):
            return g
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
        if fresh and c.get("ok") and "gal" not in c:
            fresh = False  # found before extra photos were collected: fetch again for the gallery
        if fresh and not c.get("ok") and pr.get("_gtin") and not c.get("g"):
            fresh = False  # we now have a barcode for it: try again
        if not fresh and pr.get("_gtin"):
            pr["_tried_gtin"] = 1
        if not fresh:
            todo.append(pr)
    todo = todo[:ICECAT_MAX]

    def work(pr):
        brand = BRAND_ALIASES.get(norm_mpn(pr["_brand"]), pr["_brand"] or pr["b"])
        try:
            return pr["id"], lookup_with_variants(brand, pr["_mpn"], pr.get("_gtin", ""))
        except Exception as e:
            return pr["id"], {"ok": 0, "err": str(e)[:80]}

    by_id = {pr["id"]: pr for pr in todo}
    errors = 0
    with ThreadPoolExecutor(max_workers=6) as ex:
        for key, c in ex.map(work, todo):
            if c.get("err"):
                errors += 1
                continue  # network trouble: try again next run
            c["d"] = today
            c["v"] = 2
            if by_id.get(key, {}).get("_gtin"):
                c["g"] = 1
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
        desc = (("Refurbished " if pr.get("rf") else "") + f"{pr['n']} for {money(pr['p'])}, checked, set up and delivered in Perth by Tony's Tech Support. "
                + ", ".join(pr["sp"]))[:300]
        ld = {
            "@context": "https://schema.org", "@type": "Product", "name": pr["n"], "sku": pr["id"], "mpn": pr["id"],
            "category": cats.get(pr["c"], ""), "description": (pr["d"] or desc)[:500],
            "offers": {"@type": "Offer", "url": url, "priceCurrency": "AUD", "price": f"{pr['p']:.2f}",
                       "availability": "https://schema.org/InStock", "itemCondition": "https://schema.org/" + ("RefurbishedCondition" if pr.get("rf") else "NewCondition"),
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
        f.write(f"User-agent: *\nAllow: /\nDisallow: /missing-photos.csv\nSitemap: {base}/sitemap.xml\n")
    with open(os.path.join(out_dir, "404.html"), "w", encoding="utf-8") as f:
        f.write(tpl.replace("<script src=\"/app.js\">", "<script>window.TTS_VIEW=\"gone\";</script><script src=\"/app.js\">").replace("<p style=\"padding:40px 0\">Loading the shop…</p>",
                            "<div class=\"empty\" style=\"margin-top:30px\"><h2>That product has sold out</h2><p>Stock changes every day. <a href=\"/\">See what's available</a>.</p></div>"))


def money(n):
    return "$" + (f"{n:,.0f}" if n == int(n) else f"{n:,.2f}")


# ---------------------------------------------------------------- refurbished machines Tony sources himself
def refurb_grade(name):
    m = re.search(r"\bgrade ([abc])\b", name, re.I)
    if m:
        return m.group(1).upper()
    return "Ex-demo" if re.search(r"demo", name, re.I) else ""


def curated_refurbs():
    """Machines listed by hand in refurbished.json (e.g. quality refurbs Tony buys in)."""
    path = os.path.join(ROOT, "refurbished.json")
    if not os.path.exists(path):
        return []
    try:
        items = json.load(open(path, encoding="utf-8")).get("items", [])
    except Exception as e:
        print(f"refurbished.json could not be read: {e}", file=sys.stderr)
        return []
    p = CFG["pricing"]
    step = p.get("roundTo", 1) or 1
    out = []
    for r in items:
        if not r.get("name") or not r.get("price") or r.get("sold"):
            continue
        part = norm_mpn(r.get("part") or r["name"])[:24]
        cat = r.get("category", "laptops")
        price = math.ceil(float(r["price"]) / step - 1e-9) * step
        buy = price / p["markup"]  # assumed: priced at the normal markup (the repo is public, so no buy prices here)
        lt = r.get("leadDays") or [2, 5]  # Tony already has it, or it's a short trip away
        out.append({
            "id": "R" + part, "_raw": r["name"], "_brand": r.get("brand", ""), "_mpn": "", "_path": "",
            "_noicecat": True,
            "b": r.get("brand", ""), "c": cat, "p": price, "img": r.get("image", ""),
            "d": r.get("description", ""), "w": (str(r["warrantyMonths"]) + " months") if r.get("warrantyMonths") else "",
            "lt": lt, "low": 1, "pe": 1 if r.get("inPerth", True) else 0,
            "os": "", "k": "T", "rf": 1, "gr": r.get("grade", ""), "_floor": buy,
        })
    print(f"Added {len(out)} refurbished machines from refurbished.json", file=sys.stderr)
    return out


def model_family(pr):
    """Brand + model name without the processor/memory/storage/OS details, e.g. 'HP ELITEBOOK 8 G1I 14'.
    Different configurations of the same model look the same, so they can share a photo."""
    n = (pr["b"] + " " + pr["n"]).upper()
    n = re.sub(r"SAVE \$\d+EX WHEN YOU PURCHASE", "", n)
    n = re.split(r",|\(|\bI[3579]-|\bU[579]-|\bR[3579]-|\bULTRA\b|\bCORE\b|\bRYZEN\b|\b\d+ ?GB\b|\b\d+ ?TB\b|\bW1[01]|\bWIN|"
                 r"\b\d{3,4}[A-Z]?\d*[HUPV]\b|\bN\d{3}\b|\bC[57]-\d", n)[0]
    words = re.sub(r"[^A-Z0-9 ]", " ", n).split()
    return pr["c"] + "|" + " ".join(words[:7]) if len(words) >= 3 else ""


def borrow_sibling_photos(products):
    """A product with no photo borrows one from another configuration of the same model."""
    donors = {}
    for pr in products:
        k = model_family(pr) if pr["img"] and not pr.get("ims") else ""
        if k and k not in donors:
            donors[k] = pr["img"]
    n = 0
    for pr in products:
        if pr["img"] or pr.get("rf"):
            continue
        k = model_family(pr)
        if k in donors:
            pr["img"], pr["ims"] = donors[k], 1
            n += 1
    print(f"Photos borrowed from the same model in another configuration: {n}", file=sys.stderr)


def write_missing_photos(products, out_dir):
    """A list of products still without a photo, most important first, for Tony to fill in (photos/ folder)."""
    order = {"laptops": 0, "desktops": 1, "handhelds": 2, "tablets": 3, "monitors": 4, "printers": 5, "backup": 6, "networking": 7, "accessories": 8}
    miss = sorted((p for p in products if not p["img"]), key=lambda p: (order.get(p["c"], 9), -p["p"]))
    with open(os.path.join(out_dir, "missing-photos.csv"), "w", encoding="utf-8") as f:
        f.write("part_number,photo_file_name,brand,category,price,name\n")
        for p in miss:
            f.write(",".join([p["id"], "photos/" + p["id"] + ".jpg", p["b"], p["c"], str(p["p"]), '"' + p["n"].replace('"', "'") + '"']) + "\n")
    print(f"Products without a photo: {len(miss)} (list: /missing-photos.csv)", file=sys.stderr)


def apply_discount_limits(products):
    """Multi-buy discount: work out the most each product may be discounted while keeping
    the minimum markup (pricing.multiBuy.floorMarkup) on that product. Only a coarse step
    is published (never the buy price)."""
    mb = CFG["pricing"].get("multiBuy") or {}
    tiers = sorted(t["pct"] for t in mb.get("tiers", []))
    if not tiers:
        for pr in products:
            pr.pop("_floor", None)
        return
    floor_markup = mb.get("floorMarkup", 1.15)
    top = tiers[-1]
    for pr in products:
        floor = pr.pop("_floor", 0) * floor_markup
        allowed = 1 - floor / pr["p"] if pr["p"] else 0
        if allowed * 100 + 1e-6 >= top:
            continue  # full discount fine
        ok = [t for t in tiers if t <= allowed * 100 + 1e-9]
        pr["md"] = ok[-1] if ok else 0


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
        if HANDHELD_NAME.search(it["name"]) and (cat or re.search(r"notebook|gaming|console|tablet", it["path"], re.I)):
            cat = "handhelds"
        if not cat or it["stock"] <= 0 or not (it["costEx"] > 0):
            continue
        if EXCLUDE_NAME.search(it["name"]):
            continue
        it["rf"] = bool(REFURB_NAME.search(it["name"]))
        if it["rf"] and cat not in REFURB_CATS:
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
        for f in ("image", "desc", "warranty", "gtin"):
            if not winner.get(f) and loser.get(f):
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
            "_raw": it["name"], "_brand": it["brand"], "_mpn": it["mpn"], "_path": it["path"], "_gtin": it.get("gtin", ""),
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
            "_floor": (it["costEx"] + CFG["pricing"]["freightExGst"].get(it["cat"], 10)) * (1 + CFG["pricing"]["gst"]),
            **({"rf": 1, "gr": refurb_grade(it["name"])} if it.get("rf") else {}),
        })

    products += curated_refurbs()

    enrich_from_icecat([p for p in products if not p.get("_noicecat")])
    for p in products:
        p.pop("_noicecat", None)
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
        if pr.get("rf"):  # the "Refurbished" badge and grade are shown separately
            name = re.sub(r"\s*\b(refurbished|refurb|renewed|pre-?owned|ex-?demo|demo unit|demo|grade [abc])\b\s*", " ", name, flags=re.I)
            name = re.sub(r"^(\w+) \1\b", r"\1", re.sub(r"\s+", " ", name).strip(), flags=re.I)
        pr["n"] = name
        text = name + " " + raw
        pr["sp"] = specs_for(text, pr["c"])
        size = re.search(r"(\d{2}(?:\.\d)?) INCH", path.upper())
        d = derive(text + (f' {size.group(1)}"' if size else ""), pr["c"])
        pr.update(d)
        pr["u"] = use_cases(pr["c"], d)
        secs = sections_for(pr["c"], name + " " + raw, path)
        if secs:
            pr["t"] = secs
            if "hubs" in secs or "adapters" in secs:
                cn = connectors_for(raw + " " + name)
                if cn["ci"]: pr["ci"] = cn["ci"]
                if cn["co"]: pr["co"] = cn["co"]
                if cn["pt"]: pr["pt"] = cn["pt"]
        if ice:
            if not pr["img"] and ice.get("img"):
                pr["img"] = ice["img"]
            gal = [u for u in (ice.get("gal") or []) if u != pr["img"]]
            if pr["img"] and ice.get("img") and ice["img"] != pr["img"]:
                gal = [ice["img"]] + gal
            if gal and pr["img"]:
                pr["gal"] = gal[:7]
            if not pr["d"] and ice.get("sum"):
                pr["d"] = ice["sum"][:1500]
        if pr["id"] in overrides:
            pr["img"] = "/photos/" + overrides[pr["id"]]
        pr["os"] = pr["os"] or os_for(brand_raw, name, pr["c"])
        pr["s"] = slug(pr["id"])
    borrow_sibling_photos(products)
    for pr in products:
        pr.pop("_gtin", None); pr.pop("_tried_gtin", None)
    apply_discount_limits(products)
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
        "multiBuy": {k: v for k, v in (CFG["pricing"].get("multiBuy") or {}).items() if k in ("tiers", "minItemPrice")},
        "quotes": CFG.get("quotes", {}),
        "categories": [{"id": c[0], "name": c[1]} for c in CATEGORIES],
        "sections": [{"id": c[0], "name": c[1]} for c in SECTIONS],
        "updated": now.strftime("%A %-d %B %Y, %-I:%M %p").replace("AM", "am").replace("PM", "pm"),
    }
    with open(os.path.join(out_dir, "data", "products.json"), "w") as f:
        json.dump(products, f, separators=(",", ":"))
    with open(os.path.join(out_dir, "data", "config.json"), "w") as f:
        json.dump(public_cfg, f, separators=(",", ":"))
    with open(os.path.join(out_dir, "CNAME"), "w") as f:
        f.write(CFG["site"]["url"].split("//", 1)[1] + "\n")
    write_seo_pages(products, out_dir, now)
    write_missing_photos(products, out_dir)
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
