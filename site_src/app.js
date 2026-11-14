/* Tony's Tech Support Shop – front end. Plain JavaScript, no build step. Version v6.1 · 2026-11-14 */
(function () {
  "use strict";
  var APP_VERSION = "v6.1";
  var P = [], CFG = null, BYID = {};
  var app = document.getElementById("app");
  var COMPUTER_CATS = { laptops: 1, desktops: 1, handhelds: 1 };
  var PAGE = 48;
  var USES = [
    ["everyday", "Everyday use: web, email, video calls"],
    ["study", "Study, school & office work"],
    ["business", "Business & heavy multitasking"],
    ["creative", "Photo & video editing"],
    ["gaming", "Gaming"],
    ["portable", "Light & portable (14\" or smaller)"],
    ["bigscreen", "Big screen"]
  ];
  function useName(id) { var u = USES.filter(function (x) { return x[0] === id; })[0]; return u ? u[1] : id; }
  function r5(n) { var step = (CFG && CFG.roundTo) || 1; return Math.ceil(n / step - 1e-9) * step; }
  function availText(p) { return p.pe ? "In stock in Perth" : "Available to order"; }

  // ---------------------------------------------------------------- storage (best effort only)
  function load(key, def) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* private mode */ } }
  var cart = load("tts-cart", []);
  var opts = load("tts-opts", null) || defaultOpts();
  function defaultOpts() {
    return { apps: { adblock: true, rustdesk: true }, browser: "Google Chrome", emailApp: "", addons: {}, migration: "none",
      delivery: "courier", extraHours: 0, suburb: "", callout: null, calloutKm: null };
  }
  function persist() { save("tts-cart", cart); save("tts-opts", opts); updateCount(); }

  // ---------------------------------------------------------------- helpers
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n) { if (n < 0) return "−" + money(-n); return "$" + Number(n).toLocaleString("en-AU", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
  function catName(id) { if (id === "refurbished") return "Refurbished"; var c = (CFG.categories || []).filter(function (x) { return x.id === id; })[0]; return c ? c.name : id; }
  function ICON(cat) {
    var paths = {
      laptops: '<rect x="12" y="12" width="40" height="26" rx="2"/><path d="M6 46h52l-4-6H10z"/>',
      desktops: '<rect x="8" y="10" width="48" height="32" rx="2"/><path d="M26 42v8M38 42v8M20 52h24"/>',
      tablets: '<rect x="16" y="6" width="32" height="52" rx="4"/><circle cx="32" cy="51" r="2"/>',
      monitors: '<rect x="6" y="10" width="52" height="32" rx="2"/><path d="M32 42v8M22 52h20"/>',
      backup: '<rect x="12" y="8" width="40" height="48" rx="4"/><circle cx="32" cy="28" r="10"/><circle cx="32" cy="28" r="2"/><path d="M20 48h8"/>',
      printers: '<path d="M18 22V8h28v14"/><rect x="8" y="22" width="48" height="20" rx="2"/><path d="M18 36h28v20H18z"/>',
      networking: '<path d="M10 26a32 32 0 0 1 44 0M17 33a22 22 0 0 1 30 0M24 40a12 12 0 0 1 16 0"/><circle cx="32" cy="48" r="3"/>',
      handhelds: '<rect x="6" y="20" width="52" height="24" rx="10"/><rect x="22" y="24" width="20" height="16" rx="1"/><path d="M13 32h5M15.5 29.5v5"/><circle cx="49" cy="30" r="1.5"/><circle cx="49" cy="35" r="1.5"/>',
      refurbished: '<path d="M44 14a20 20 0 1 0 8 20"/><path d="M44 6v9h9"/><path d="M24 33l6 6 11-13"/>',
      accessories: '<path d="M22 8h20v14H22zM18 22h28l-4 34H22z"/><path d="M32 30v10"/>'
    };
    return '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[cat] || paths.accessories) + "</svg>";
  }
  function pic(p, cls) {
    if (p.img) return '<img src="' + esc(p.img) + '" alt="' + esc(p.n) + '" loading="lazy" class="' + (cls || "") + '" onerror="this.outerHTML=window.__icon(\'' + p.c + '\')">';
    return ICON(p.c);
  }
  window.__icon = ICON;
  function eta(p) { return p.lt[0] + "–" + p.lt[1] + " days"; }
  function go(h) { if (location.pathname !== "/" && location.pathname !== "/index.html") location.href = "/" + h; else location.hash = h; }
  function prodUrl(p) { return "/p/" + p.s + ".html"; }
  function inCart() { return cart.map(function (l) { return { p: BYID[l.id], q: l.q }; }).filter(function (x) { return x.p; }); }
  function updateCount() { var n = 0; cart.forEach(function (l) { n += l.q; }); var el = document.getElementById("cartCount"); if (el) el.textContent = n; }
  function addToCart(id, q) {
    var l = cart.filter(function (x) { return x.id === id; })[0];
    if (l) l.q += q || 1; else cart.push({ id: id, q: q || 1 });
    persist();
  }
  function computersIn(lines, os) { var n = 0; lines.forEach(function (x) { if (COMPUTER_CATS[x.p.c] && (!os || x.p.os === os)) n += x.q; }); return n; }

  // ---------------------------------------------------------------- shared blocks
  function supportList() {
    return '<ul class="ticks">' +
      "<li><b>Help choosing:</b> a quick call or message to pick the right machine, rather than a sales pitch.</li>" +
      "<li><b>Delivery or setup arranged by text,</b> so nothing gets left on a porch when you're not home. It can also go to your workplace during opening hours on a day you're there.</li>" +
      "<li><b>Set up before handover:</b> updates installed, unwanted pre-installed apps removed, graphics (GPU) drivers installed, and laptops charged to 100% so they're ready to use when you receive them.</li>" +
      "<li><b>Free useful apps of your choice</b> installed, such as an ad blocker and remote support.</li>" +
      "<li><b>Optional data transfer</b> from your old computer and a walkthrough of the new one.</li>" +
      "<li><b>Warranty claims handled by Tony,</b> so you don't have to deal with the manufacturer.</li>" +
      "<li><b>A check-in a week after delivery</b> to make sure everything's working well.</li></ul>";
  }
  function elsewhereNote() {
    return '<div class="note"><b>Found it cheaper somewhere else? No hard feelings at all.</b> I\'m a sole trader without big-warehouse buying power, so my prices include my time to source, check and set up your device. If you buy it from another shop, I\'m still very happy to set it up and help you with it.</div>';
  }
  function guarantee() {
    return '<section class="guarantee" aria-labelledby="gq"><h2 id="gq">Tony\'s Tech Support guarantee</h2>' +
      '<div class="cols">' +
      '<div class="panel"><h3>Quality anyone can afford</h3><p>New products come from major Australian IT distributors with the full manufacturer\'s warranty. Refurbished computers are clearly labelled and graded. Before anything reaches you, I check it, update it and set it up.</p></div>' +
      '<div class="panel"><h3>Twelve-month warranty</h3><p>All products come with a minimum twelve-month warranty. This is in addition to, and does not affect, your rights under the Australian Consumer Law, including any rights or remedies you may have for faulty items. If a defect appears within twelve months of receiving your product, you\'ll be given a replacement or a refund.</p></div>' +
      '<div class="panel"><h3>Personal support</h3><p>You deal with me, not a call centre. I handle warranty claims for you, and I check in a week after delivery to make sure everything\'s working.</p></div>' +
      "</div><h3>Frequently asked questions</h3>" +
      faq("What is the Tony's Tech Support guarantee?", "I only list new products from established Australian IT distributors I hold reseller accounts with, and refurbished computers from trusted refurbishers. Every device is checked and set up by me before it's handed over, and I look after any warranty claims for you.") +
      faq("What will I receive?", "A new product in its original packaging, or a refurbished one clearly described on its page, with all the accessories it comes with from the manufacturer. Computers are updated, set up with the free apps you choose, and charged to 100% before handover.") +
      faq("What condition will a refurbished device be in?", "Refurbished computers are clearly labelled with their grade. They're restored to factory settings and graded: A grade (Excellent) shows no signs of cosmetic damage when held 30cm away; B grade (Good) has light scratches, barely visible when held 30cm away; C grade (Acceptable) has scratches visible when held 30cm away that you can feel. I'll tell you the battery health on the quote, and accessories may be compatible rather than original.") +
      faq("What if the item sells out before I order?", "Stock and prices are updated every day, and I confirm stock with my supplier before ordering. If your item has sold out, I'll offer you an equivalent replacement or a full refund.") +
      faq("What if I'm not satisfied with the product I receive?", "I want you to be delighted with your purchase. Products come with a minimum twelve-month warranty, in addition to your rights under the Australian Consumer Law. If any defect arises within twelve months of receipt, you'll be given a replacement or refund. Just call or text me.") +
      faq("How does delivery work?", "My standard delivery uses Uber Courier. Once your product is ready to go, you'll get a text from me, and we'll choose the best place and time so you receive it where and when you want it. That way no expensive devices are left on a porch or next to a mailbox. Or I can deliver it in person and set it up with you.") +
      faq("Can I buy it somewhere else?", "Of course. People expect to pay a little more with a sole trader, and there are no hard feelings if you buy from another shop. I'm still happy to set it up and help you with it.") +
      "</section>";
  }
  function faq(q, a) { return "<details><summary>" + esc(q) + "</summary><p>" + esc(a) + "</p></details>"; }

  // ---------------------------------------------------------------- views
  function viewHome(cat, query, all) {
    var list = P.filter(function (p) { return !cat || (cat === "refurbished" ? p.rf : p.c === cat); });
    var useF = load("tts-use", ""), perthF = load("tts-perth", false);
    if (useF) list = list.filter(function (p) { return (p.u || []).indexOf(useF) >= 0; });
    if (perthF) list = list.filter(function (p) { return p.pe; });
    if (query) {
      var words = query.toLowerCase().split(/\s+/).filter(Boolean);
      list = list.filter(function (p) { var t = (p.n + " " + p.b + " " + p.sp.join(" ") + " " + catName(p.c)).toLowerCase(); return words.every(function (w) { return t.indexOf(w) >= 0; }); });
    }
    var sort = load("tts-sort", "low");
    list.sort(function (a, b) { return sort === "high" ? b.p - a.p : sort === "name" ? a.n.localeCompare(b.n) : a.p - b.p; });
    var counts = {}; P.forEach(function (p) { counts[p.c] = (counts[p.c] || 0) + 1; if (p.rf) counts.refurbished = (counts.refurbished || 0) + 1; });
    var cats = CFG.categories.concat([{ id: "refurbished", name: "Refurbished" }]);
    var h = "";
    if (!cat && !query && !all) {
      h += '<section class="hero"><h1>Tech that\'s ready to use</h1><p class="lead">New and refurbished laptops, computers, monitors, printers and backup drives, checked, set up and delivered by Tony. Not sure what you need? <a href="' + esc(CFG.site.smsHref) + '">Send me a text</a> or <a href="' + esc(CFG.site.phoneHref) + '">give me a call</a> and I\'ll help you choose.</p></section>';
    } else {
      h += '<div class="crumbs"><a href="/#/">Shop</a> › ' + esc(cat ? catName(cat) : all ? "All items" : 'Search results for "' + query + '"') + "</div>";
      h += "<h2>" + esc(cat ? catName(cat) : all ? "All items" : "Search results" + (query ? " for \u201c" + query + "\u201d" : "")) + "</h2>";
    }
    if ((!cat && !query && !all) || COMPUTER_CATS[cat]) {
      h += '<section class="panel pickcta"><div><h2>Not sure which computer to get?</h2><p>Tell me what it\'s for and your budget, and I\'ll show you the best options. If nothing fits, I\'ll send you a free custom quote.</p></div>' +
        '<div class="quickuse"><span class="hint">Start with what it\'s for:</span>' + USES.slice(0, 4).map(function (u) { return '<button type="button" class="btn ghost small" data-quse="' + u[0] + '">' + esc(u[1].split(/[:,&]/)[0].trim()) + "</button>"; }).join("") +
        '<a class="btn" href="/picker.html">Help me choose</a></div></section>';
    }
    h += '<nav class="cats" aria-label="Categories">' + cats.filter(function (c) { return counts[c.id]; }).map(function (c) {
      return '<a class="cat' + (c.id === cat ? " on" : "") + '" href="/#/c/' + c.id + '">' + ICON(c.id) + "<b>" + esc(c.name) + "</b><small>" + counts[c.id] + " available</small></a>";
    }).join("") + "</nav>";
    var home = !cat && !query && !all && !useF && !perthF;
    if (home) {
      h += '<div class="panel"><h2>Why buy from Tony?</h2>' + supportList() + "</div>" + elsewhereNote();
      h += "<h2>Popular picks</h2>";
      list = pickPopular();
    }
    h += '<div class="toolbar"><span>' + list.length + ' products</span><label class="sr" for="use">Use</label><select id="use"><option value="">Any use</option>' + USES.map(function (u) { return '<option value="' + u[0] + '"' + (useF === u[0] ? " selected" : "") + ">" + esc(u[1]) + "</option>"; }).join("") + '</select><label class="sr" for="sort">Sort</label><select id="sort"><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="name">Name</option></select><label class="opt" style="border:0;padding:0"><input type="checkbox" id="perthOnly"' + (perthF ? " checked" : "") + '><span class="t">In stock in Perth only</span></label></div>';
    if (useF) h += '<p class="hint">Showing laptops and desktops suited to: ' + esc(useName(useF)) + '. Other products are hidden while this filter is on.</p>';
    if (!list.length) h += '<div class="empty">Nothing matches that right now. Try another search, or <a href="' + esc(CFG.site.smsHref) + '">text Tony</a> and I\'ll find it for you.</div>';
    h += '<div class="grid" id="grid"></div><div class="sentinel" id="sentinel"></div><p class="loadingmore" id="more" hidden>Loading more…</p>';
    app.innerHTML = h;
    var s = document.getElementById("sort"); s.value = sort;
    s.onchange = function () { save("tts-sort", s.value); render(); };
    document.getElementById("use").onchange = function (e) { save("tts-use", e.target.value); render(); };
    document.getElementById("perthOnly").onchange = function (e) { save("tts-perth", e.target.checked); render(); };
    Array.prototype.forEach.call(app.querySelectorAll("[data-quse]"), function (b) {
      b.onclick = function () { var q = load("tts-pick", null) || defaultPick(); q.uses = [b.getAttribute("data-quse")]; if (COMPUTER_CATS[cat]) q.type = cat; save("tts-pick", q); location.href = "/picker.html"; };
    });
    bindSearch();
    var shown = 0, grid = document.getElementById("grid"), more = document.getElementById("more");
    function page() {
      grid.insertAdjacentHTML("beforeend", list.slice(shown, shown + PAGE).map(card).join(""));
      shown += PAGE; more.hidden = shown >= list.length;
    }
    page();
    // Infinite scroll: load the next batch as the bottom of the list comes into view.
    if (window.__io) window.__io.disconnect();
    if ("IntersectionObserver" in window) {
      window.__io = new IntersectionObserver(function (es) { if (es[0].isIntersecting && shown < list.length) page(); }, { rootMargin: "800px 0px" });
      window.__io.observe(document.getElementById("sentinel"));
    } else {
      more.outerHTML = '<p style="text-align:center"><button class="btn ghost" id="moreBtn">Show more</button></p>';
      document.getElementById("moreBtn").onclick = page;
    }
  }
  function pickPopular() {
    var out = [];
    ["laptops", "desktops", "monitors", "backup", "printers", "accessories"].forEach(function (c) {
      var l = P.filter(function (p) { return p.c === c; }).sort(function (a, b) { return a.p - b.p; });
      out = out.concat(l.slice(Math.floor(l.length / 4), Math.floor(l.length / 4) + 2));
    });
    return out;
  }
  function bindSearch() { /* search now lives in the header (see setupHeader) */ }
  function setupHeader() {
    var f = document.getElementById("hsf"), q = document.getElementById("hq");
    f.onsubmit = function (e) { e.preventDefault(); var v = q.value.trim(); q.blur(); go(v ? "#/s/" + encodeURIComponent(v) : "#/all"); return false; };
    // Shop menu: categories + "View all items". Opens on hover (mouse) or tap/click/keyboard.
    var btn = document.getElementById("shopBtn"), drop = document.getElementById("shopDrop"), grid = document.getElementById("dropGrid"), timer;
    var counts = {}; P.forEach(function (p) { counts[p.c] = (counts[p.c] || 0) + 1; if (p.rf) counts.refurbished = (counts.refurbished || 0) + 1; });
    var cats = CFG.categories.concat([{ id: "refurbished", name: "Refurbished" }]).filter(function (c) { return counts[c.id]; });
    grid.innerHTML = cats.map(function (c) { return '<a href="/#/c/' + c.id + '">' + ICON(c.id) + "<span>" + esc(c.name) + "<small>" + counts[c.id] + " items</small></span></a>"; }).join("") +
      '<a href="/#/all" class="all"><span>View all items<small>' + P.length + ' items</small></span></a><a href="/picker.html" class="pick"><span>Help me choose<small>Answer a few questions</small></span></a>' +
      '<a class="extra" href="' + esc(CFG.site.mainSite) + '" target="_blank" rel="noopener"><span>Main website<small>tonystechsupport.com.au</small></span></a><a class="extra" href="' + esc(CFG.site.mainSite.replace(/\/$/, "")) + '/contact" target="_blank" rel="noopener"><span>Contact Tony<small>' + esc(CFG.site.phone) + "</small></span></a>";
    function open() { clearTimeout(timer); drop.hidden = false; btn.setAttribute("aria-expanded", "true"); place(); }
    function close() { clearTimeout(timer); drop.hidden = true; btn.setAttribute("aria-expanded", "false"); }
    function later() { clearTimeout(timer); timer = setTimeout(close, 250); }
    function place() { if (window.innerWidth > 820) { var r = btn.getBoundingClientRect(); grid.style.marginLeft = Math.max(0, Math.min(r.left - grid.parentNode.getBoundingClientRect().left - 12, window.innerWidth - 700)) + "px"; } else grid.style.marginLeft = ""; }
    var hover = window.matchMedia && window.matchMedia("(hover: hover)").matches;
    if (hover) {
      btn.addEventListener("mouseenter", open); btn.addEventListener("mouseleave", later);
      drop.addEventListener("mouseenter", function () { clearTimeout(timer); }); drop.addEventListener("mouseleave", later);
    }
    btn.addEventListener("click", function (e) { if (hover && !drop.hidden) return; e.preventDefault(); if (drop.hidden) open(); else close(); });
    btn.addEventListener("keydown", function (e) { if (e.key === "ArrowDown") { e.preventDefault(); open(); var a = grid.querySelector("a"); if (a) a.focus(); } });
    drop.addEventListener("keydown", function (e) { if (e.key === "Escape") { close(); btn.focus(); } });
    drop.addEventListener("click", function (e) { if (e.target.closest("a")) close(); });
    document.addEventListener("click", function (e) { if (!drop.hidden && !drop.contains(e.target) && !btn.contains(e.target)) close(); });
    window.addEventListener("hashchange", close);
  }
  function syncSearch(query) { var q = document.getElementById("hq"); if (q && document.activeElement !== q) q.value = query || ""; }
  function card(p) {
    return '<div class="cardwrap"><a class="card" href="' + prodUrl(p) + '"><div class="pic">' + pic(p) + '</div><div class="body"><div class="name">' + esc(p.n) + "</div>" +
      (p.rf ? '<span class="chip rfchip">Refurbished' + (p.gr ? " · " + esc(p.gr.length === 1 ? "Grade " + p.gr : p.gr) : "") + "</span>" : "") +
      (p.sp.length ? '<div class="chips">' + p.sp.slice(0, 3).map(function (s) { return '<span class="chip">' + esc(s) + "</span>"; }).join("") + "</div>" : "") +
      '<div class="price">' + money(p.p) + "</div>" + '<div class="hint">' + availText(p) + "</div>" + (p.low && !p.rf ? '<div class="low">Only a few left</div>' : "") + "</div></a>" + cmpBox(p) + "</div>";
  }

  function viewProduct(id) {
    var p = BYID[id];
    if (!p) { app.innerHTML = '<div class="empty" style="margin-top:30px"><h2>That product has sold out</h2><p>Stock changes every day. <a href="/#/">See what\'s available</a>, or <a href="' + esc(CFG.site.smsHref) + '">text Tony</a> and I\'ll find you an equivalent.</p></div>' + guarantee(); return; }
    var h = '<div class="crumbs"><a href="/#/">Shop</a> › <a href="/#/c/' + p.c + '">' + esc(catName(p.c)) + "</a></div>";
    h += '<div class="prod"><div class="gallery">' + pic(p) + (p.ims ? '<p class="hint photonote">Photo shows this model. Colour, keyboard and ports can vary by configuration.</p>' : "") + "</div><div>";
    h += "<h2>" + esc(p.n) + "</h2>";
    h += '<div class="price" style="font-size:2.2rem">' + money(p.p) + '</div><div class="hint">Includes GST. Delivery and setup options are in the cart.</div>';
    h += '<div class="meta">';
    if (p.sp.length) h += '<div class="chips">' + p.sp.map(function (s) { return '<span class="chip">' + esc(s) + "</span>"; }).join("") + "</div>";
    if (p.rf) h += '<div class="rfinfo"><b>Refurbished' + (p.gr ? ", " + esc(gradeName(p.gr)) : "") + ".</b> Professionally checked and cleaned. I reset it, update it and set it up for you just like a new one, and it's covered by my 12-month guarantee.</div>";
    h += "<div><b>" + availText(p) + ".</b> Ready for you in about " + eta(p) + ".</div>";
    if (p.u && p.u.length) h += "<div><b>Good for:</b> " + p.u.map(useName).map(esc).join(", ") + "</div>";
    if (p.w) h += "<div><b>Manufacturer's warranty:</b> " + esc(p.w) + "</div>";
    if (p.low) h += '<div class="low">Only a few left. I\'ll confirm stock before ordering.</div>';
    h += '<div class="hint">Part number: ' + esc(p.id) + "</div>" + cmpBox(p) + "</div>";
    h += '<p><button class="btn" id="add">Add to cart</button> <a class="btn ghost" href="' + esc(CFG.site.smsHref) + '">Text Tony a question</a></p>';
    h += "</div></div>";
    if (p.d) h += '<div class="panel"><h3>Product details</h3><p class="desc">' + esc(p.d) + "</p></div>";
    h += mbBlurb();
    if (p.c === "desktops") h += bundlePanel([p]);
    else if (COMPUTER_CATS[p.c]) h += backupOffer();
    h += elsewhereNote();
    h += '<div class="panel" style="margin-top:28px"><h3>What you get when you buy from Tony</h3>' + supportList() + "</div>";
    h += guarantee();
    app.innerHTML = h;
    document.getElementById("add").onclick = function () { addToCart(p.id, 1); go("#/cart"); };
    bindDriveButtons(); bindBundle(); cmpBar();
  }
  function backupDrives() {
    var d = P.filter(function (x) { return x.c === "backup" && /drive|hdd|ssd|canvio|passport|expansion|portable/i.test(x.n) && !/enclosure|dock|duplicator|nas|bay/i.test(x.n); })
      .sort(function (a, b) { return a.p - b.p; });
    var seen = {}, out = [];
    d.forEach(function (x) { var cap = (x.n.match(/(\d+(?:\.\d)?)\s?TB/i) || x.n.match(/(\d{3,4})\s?GB/i) || [""])[0].toUpperCase().replace(/\s/g, ""); if (cap && !seen[cap] && out.length < 4) { seen[cap] = 1; out.push(x); } });
    return out;
  }
  function backupOffer() {
    var d = backupDrives();
    if (!d.length) return "";
    return '<div class="panel"><h3>Add a backup drive and I\'ll set it up for free</h3><p>Cloud storage is great, but a physical backup drive protects you if your account is locked or a file is deleted. Add one to your cart and I\'ll configure automatic backups at no extra charge.</p><div class="drives">' +
      d.map(function (x) { return '<div class="drive"><span>' + esc(x.n) + "</span><b>" + money(x.p) + '</b><button class="btn small" data-drive="' + esc(x.id) + '">Add</button></div>'; }).join("") + "</div></div>";
  }
  function bindDriveButtons() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-drive]"), function (b) {
      b.onclick = function () { addToCart(b.getAttribute("data-drive"), 1); b.textContent = "Added ✓"; b.disabled = true; if (location.hash === "#/cart") render(); };
    });
  }

  // ---------------------------------------------------------------- multi-buy discount (same maths as the card-payment worker)
  function mbCfg() { return (CFG && CFG.multiBuy && CFG.multiBuy.tiers && CFG.multiBuy.tiers.length) ? CFG.multiBuy : null; }
  function mbCount(lines) { var m = mbCfg(), n = 0; if (!m) return 0; lines.forEach(function (x) { if (x.p.p >= (m.minItemPrice || 0)) n += x.q; }); return n; }
  function mbPct(count) { var m = mbCfg(), pct = 0; if (!m) return 0; m.tiers.forEach(function (t) { if (count >= t.items && t.pct > pct) pct = t.pct; }); return pct; }
  function mbNext(count) { var m = mbCfg(); if (!m) return null; var n = m.tiers.filter(function (t) { return t.items > count; }).sort(function (a, b) { return a.items - b.items; })[0]; return n || null; }
  function mbDiscount(lines) {
    var count = mbCount(lines), pct = mbPct(count), amt = 0;
    if (pct) lines.forEach(function (x) {
      var m = mbCfg(); if (x.p.p < (m.minItemPrice || 0)) return;
      var ip = x.p.md == null ? pct : Math.min(pct, x.p.md);
      amt += Math.floor(x.p.p * ip / 100) * x.q;
    });
    return { count: count, pct: pct, amount: amt, next: mbNext(count) };
  }
  function mbBlurb() {
    var m = mbCfg(); if (!m) return "";
    return '<div class="mbnote"><b>Buy more, save more</b> across the whole shop: ' + m.tiers.map(function (t) { return t.pct + "% off " + t.items + (t === m.tiers[m.tiers.length - 1] ? "+" : "") + " items"; }).join(" · ") + ". Applied automatically in your cart.</div>";
  }

  // ---------------------------------------------------------------- compare
  var cmp = load("tts-cmp", []);
  function saveCmp() { save("tts-cmp", cmp); cmpBar(); }
  function cmpBox(p) {
    if (!COMPUTER_CATS[p.c] && p.c !== "tablets") return "";
    return '<label class="cmp"><input type="checkbox" data-cmp="' + esc(p.id) + '"' + (cmp.indexOf(p.id) >= 0 ? " checked" : "") + "> Compare</label>";
  }
  document.addEventListener("change", function (e) {
    var id = e.target && e.target.getAttribute && e.target.getAttribute("data-cmp");
    if (!id) return;
    cmp = cmp.filter(function (x) { return x !== id; });
    if (e.target.checked) cmp.push(id);
    saveCmp();
  });
  function cmpBar() {
    var bar = document.getElementById("cmpbar");
    cmp = cmp.filter(function (id) { return BYID[id]; });
    if (!bar) { bar = document.createElement("div"); bar.id = "cmpbar"; bar.className = "cmpbar noprint"; document.body.appendChild(bar); }
    if (!cmp.length || location.hash.indexOf("#/compare") === 0) { bar.hidden = true; return; }
    bar.hidden = false;
    bar.innerHTML = "<span><b>" + cmp.length + "</b> ticked to compare</span>" + (cmp.length > 1 ? '<a class="btn small" href="/#/compare">Compare them</a>' : '<span class="hint">Tick at least one more</span>') + '<button type="button" class="linkbtn" id="cmpClear">Clear</button>';
    document.getElementById("cmpClear").onclick = function () { cmp = []; saveCmp(); Array.prototype.forEach.call(document.querySelectorAll("[data-cmp]"), function (c) { c.checked = false; }); };
  }
  function cpuText(p) { return (p.sp || []).filter(function (s) { return /core|ryzen|ultra|celeron|pentium|snapdragon|apple m\d|\bm[1-4]\b|athlon|\bn\d{3}|z1|\bi[3579]/i.test(s); })[0] || ""; }
  function viewCompare() {
    var L = cmp.map(function (id) { return BYID[id]; }).filter(Boolean);
    var h = '<div class="crumbs"><a href="/">Shop</a> › Compare</div><h1>Compare</h1>';
    if (L.length < 2) { app.innerHTML = h + '<div class="empty"><p>Tick "Compare" on two or more computers to see them side by side.</p><p><a class="btn" href="/picker.html">Help me choose</a> <a class="btn ghost" href="/#/c/laptops">Browse laptops</a></p></div>'; cmpBar(); return; }
    var rows = [
      ["", function (p) { return '<a href="' + prodUrl(p) + '" class="cmppic">' + pic(p) + "</a>"; }],
      ["", function (p) { return '<a href="' + prodUrl(p) + '"><b>' + esc(p.n) + "</b></a>"; }],
      ["Price", function (p) { return '<span class="price">' + money(p.p) + "</span>"; }],
      ["Condition", function (p) { return p.rf ? "Refurbished" + (p.gr ? ", " + esc(gradeName(p.gr)) : "") : "Brand new"; }],
      ["Type", function (p) { return esc(catName(p.c)); }],
      ["Processor", function (p) { return esc(cpuText(p)) || "–"; }],
      ["Memory (RAM)", function (p) { return p.ram ? p.ram + "GB" : "–"; }],
      ["Storage", function (p) { return p.sto ? (p.sto >= 1000 ? p.sto / 1000 + "TB" : p.sto + "GB") : "–"; }],
      ["Screen", function (p) { return p.scr ? p.scr + '"' : (p.c === "desktops" ? "Uses a monitor" + (/all.?in.?one|aio/i.test(p.n) ? " (built in)" : "") : "–"); }],
      ["Touchscreen", function (p) { return p.tch ? "Yes" : "–"; }],
      ["Graphics for games", function (p) { return p.gpu ? "Yes (dedicated)" : "Basic"; }],
      ["Good for", function (p) { return (p.u || []).map(function (u) { return esc(useName(u).split(/[:,&(]/)[0].trim()); }).join(", ") || "–"; }],
      ["Availability", function (p) { return esc(availText(p)) + "<br><span class=\"hint\">Ready in about " + eta(p) + "</span>"; }],
      ["Warranty", function (p) { return esc(p.w || "Minimum 12 months"); }],
      ["", function (p) { return '<button class="btn small" data-add="' + esc(p.id) + '">Add to cart</button><br><button class="linkbtn" data-uncmp="' + esc(p.id) + '">Remove</button>'; }]
    ];
    h += '<p class="hint">Scroll sideways to see them all. Highlighted cells are the best in each row.</p><div class="cmpwrap"><table class="cmptable"><tbody>';
    var bestOf = { "Price": function (p) { return -p.p; }, "Memory (RAM)": function (p) { return p.ram || 0; }, "Storage": function (p) { return p.sto || 0; } };
    rows.forEach(function (r) {
      var best = null;
      if (bestOf[r[0]]) { var vals = L.map(bestOf[r[0]]); var mx = Math.max.apply(null, vals); if (vals.filter(function (v) { return v === mx; }).length < L.length) best = mx; }
      h += "<tr><th>" + esc(r[0]) + "</th>" + L.map(function (p) { return "<td" + (best !== null && bestOf[r[0]](p) === best ? ' class="best"' : "") + ">" + r[1](p) + "</td>"; }).join("") + "</tr>";
    });
    h += '</tbody></table></div><p><a class="btn ghost" href="/picker.html">Back to Help me choose</a> <button class="btn ghost" id="cmpPrint" type="button">Print this comparison</button></p>' + mbBlurb();
    app.innerHTML = h;
    Array.prototype.forEach.call(app.querySelectorAll("[data-add]"), function (b) { b.onclick = function () { addToCart(b.getAttribute("data-add"), 1); b.textContent = "Added ✓"; b.disabled = true; }; });
    Array.prototype.forEach.call(app.querySelectorAll("[data-uncmp]"), function (b) { b.onclick = function () { cmp = cmp.filter(function (x) { return x !== b.getAttribute("data-uncmp"); }); saveCmp(); viewCompare(); }; });
    document.getElementById("cmpPrint").onclick = function () { window.print(); };
    cmpBar();
  }
  function gradeName(g) { return g === "A" ? "Grade A (excellent)" : g === "B" ? "Grade B (good)" : g === "C" ? "Grade C (acceptable)" : g; }

  // ---------------------------------------------------------------- desk bundle (desktops)
  function bundleParts(desk) {
    var aio = /all.?in.?one|\baio\b/i.test(desk.n);
    var mons = P.filter(function (x) { return x.c === "monitors" && /2[3-7](\.\d)?["”]|2[3-7](\.\d)? ?inch|\b2[47]\b/i.test(x.n) && !/bracket|mount|when you purchase|bonus|bundle|\barm\b|stand\b/i.test(x.n) && x.p >= 120; }).sort(function (a, b) { return a.p - b.p; });
    var kbm = P.filter(function (x) { return x.c === "accessories" && /keyboard/i.test(x.n) && /mouse/i.test(x.n) && !/when you purchase|bonus/i.test(x.n) && x.p >= 30 && x.p <= 200; }).sort(function (a, b) { return a.p - b.p; });
    var drv = backupDrives().filter(function (x) { return /[1-9]\s?TB/i.test(x.n); });
    var out = [];
    if (!aio && mons[0]) out.push(["Monitor", mons[Math.min(1, mons.length - 1)]]);
    if (kbm[0]) out.push([/wireless/i.test(kbm[0].n) ? "Wireless keyboard & mouse" : "Keyboard & mouse", kbm[0], /\b(kb|keyboard|mse|mouse)\b/i.test(desk.n)]);
    if (drv[0] || backupDrives()[0]) out.push(["Backup drive (set up free)", drv[0] || backupDrives()[0]]);
    return out;
  }
  function bundlePanel(desks) {
    desks = desks.filter(function (d) { return d && d.c === "desktops"; });
    if (!desks.length) return "";
    var parts = bundleParts(desks[0]);
    if (!parts.length) return "";
    var h = '<section class="panel bundle" id="bundle"><h2 style="margin-top:0">Complete desk setup</h2><p>Everything you need to start using it on day one. I\'ll set it all up together, and multi-buy savings apply.</p>';
    if (desks.length > 1) h += '<div class="field"><label for="bdesk">Computer</label><select id="bdesk">' + desks.map(function (d) { return '<option value="' + esc(d.id) + '">' + esc(d.n) + " (" + money(d.p) + ")</option>"; }).join("") + "</select></div>";
    else h += '<input type="hidden" id="bdesk" value="' + esc(desks[0].id) + '">';
    h += parts.map(function (x) { return '<label class="opt"><input type="checkbox" data-bpart="' + esc(x[1].id) + '"' + (x[2] ? "" : " checked") + '><span class="t"><b>' + esc(x[0]) + "</b>" + (x[2] ? " (this computer already comes with one)" : "") + '<br><span class="hint">' + esc(x[1].n) + '</span></span><span class="amt">' + money(x[1].p) + "</span></label>"; }).join("");
    h += '<div class="btotal" id="btotal"></div><p><button class="btn" type="button" id="baddall">Add the bundle to my cart</button></p></section>';
    return h;
  }
  function bindBundle() {
    var sel = document.getElementById("bdesk"); if (!sel) return;
    function chosen() {
      var ids = [sel.value].concat([].filter.call(document.querySelectorAll("[data-bpart]"), function (c) { return c.checked; }).map(function (c) { return c.getAttribute("data-bpart"); }));
      return ids.map(function (id) { return { p: BYID[id], q: 1 }; }).filter(function (x) { return x.p; });
    }
    function upd() {
      var L = chosen(), sum = 0; L.forEach(function (x) { sum += x.p.p; });
      var d = mbDiscount(L.concat(inCart().filter(function (x) { return !L.some(function (y) { return y.p.id === x.p.id; }); })));
      var own = mbDiscount(L);
      document.getElementById("btotal").innerHTML = "Bundle: <b>" + money(sum - own.amount) + "</b>" + (own.amount ? ' <span class="save">you save ' + money(own.amount) + " (" + own.pct + "% multi-buy)</span>" : "") + (d.amount > own.amount ? '<div class="hint">With what\'s already in your cart, you\'ll save ' + money(d.amount) + " in total.</div>" : "");
    }
    sel.onchange = upd;
    Array.prototype.forEach.call(document.querySelectorAll("[data-bpart]"), function (c) { c.onchange = upd; });
    document.getElementById("baddall").onclick = function () { chosen().forEach(function (x) { addToCart(x.p.id, 1); }); go("#/cart"); };
    upd();
  }

  // ---------------------------------------------------------------- "Help me choose" device picker
  var BUDGETS = [800, 1200, 1600, 2000, 2500, 3500, 0];
  var WHY = [
    ["slow", "It's too slow"],
    ["broken", "It won't turn on, or keeps crashing"],
    ["battery", "The battery doesn't last"],
    ["damage", "Cracked screen, broken keys or other damage"],
    ["space", "It keeps running out of space"],
    ["support", "It can't run Windows 11, or no longer gets updates"],
    ["app", "It can't run an app or game I need"],
    ["size", "I want something lighter, bigger or different"],
    ["other", "Something else"]
  ];
  function defaultPick() { return { replacing: "", age: "", oldRam: 0, oldSto: 0, oldDisk: "", oldModel: "", why: [], whyApp: "", uses: [], type: "any", budget: 2000, extras: [], refurb: "both", gradeA: false, special: "" }; }
  function pickFromLink() {
    var m = location.hash.match(/[#&]a=([^&]+)/);
    if (!m) return null;
    try { var q = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1]).replace(/-/g, "+").replace(/_/g, "/"))))); var d = defaultPick(); for (var k in d) if (q[k] === undefined) q[k] = d[k]; return q; } catch (e) { return null; }
  }
  function pickLink(q) {
    var b = btoa(unescape(encodeURIComponent(JSON.stringify(q)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return CFG.site.url.replace(/\/$/, "") + "/picker.html#a=" + b;
  }
  function radios(name, list, cur) { return list.map(function (t) { return '<label class="opt"><input type="radio" name="' + name + '" value="' + t[0] + '"' + (cur === t[0] ? " checked" : "") + '><span class="t">' + esc(t[1]) + "</span></label>"; }).join(""); }
  function checks(name, list, cur) { return list.map(function (t) { return '<label class="opt"><input type="checkbox" name="' + name + '" value="' + t[0] + '"' + (cur.indexOf(t[0]) >= 0 ? " checked" : "") + '><span class="t">' + esc(t[1]) + "</span></label>"; }).join(""); }
  function sel(id, label, list, cur) { return '<div class="field"><label for="' + id + '">' + label + '</label><select id="' + id + '">' + list.map(function (o) { return '<option value="' + o[0] + '"' + (String(cur) === String(o[0]) ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select></div>"; }
  function viewPicker() {
    var fromLink = pickFromLink();
    var q = fromLink || load("tts-pick", null) || defaultPick();
    var d0 = defaultPick(); for (var k in d0) if (q[k] === undefined) q[k] = d0[k];
    var custom = q.budget && BUDGETS.indexOf(q.budget) < 0;
    var h = '<div class="crumbs"><a href="/">Shop</a> › Help me choose</div><h1>Help me choose a computer</h1>' +
      '<p class="lead">A few quick questions and I\'ll show you a <b>Good</b>, <b>Better</b> and <b>Best</b> option for you, new or refurbished. If nothing suits, I\'ll put together a free custom quote, or tell you if fixing your current computer makes more sense.</p>';
    if (fromLink) h += '<div class="note">These are the answers someone saved for you. Your options are below; change anything you like.</div>';
    h += '<form id="pk">';
    // 1. replacing
    h += '<fieldset><legend>1. What are you replacing?</legend>' + radios("rep", [["laptop", "A Windows laptop"], ["desktop", "A Windows desktop or all-in-one"], ["mac", "A Mac or MacBook"], ["tablet", "A tablet or Chromebook"], ["none", "Nothing, this is an extra or my first computer"]], q.replacing);
    h += '<div id="oldbox"' + (q.replacing && q.replacing !== "none" ? "" : " hidden") + '><p class="hint" style="margin-top:12px">About your current one (skip anything you\'re not sure of):</p><div class="qgrid">' +
      sel("age", "How old is it?", [["", "Not sure"], ["0-3", "Under 3 years"], ["3-5", "3 to 5 years"], ["5-8", "5 to 8 years"], ["8+", "More than 8 years"]], q.age) +
      sel("oram", "Memory (RAM)", [["0", "Not sure"], ["4", "4GB or less"], ["8", "8GB"], ["16", "16GB"], ["32", "32GB or more"]], q.oldRam) +
      sel("osto", "Storage size", [["0", "Not sure"], ["128", "128GB"], ["256", "256GB"], ["512", "512GB"], ["1000", "1TB"], ["2000", "2TB or more"]], q.oldSto) +
      sel("odisk", "Storage type", [["", "Not sure"], ["ssd", "SSD (solid state)"], ["hdd", "Hard drive (spinning)"]], q.oldDisk) + "</div>" +
      '<div class="field"><label for="omodel">Make and model, if you know it</label><input id="omodel" type="text" placeholder="e.g. HP Pavilion 15, Dell Inspiron 3511" value="' + esc(q.oldModel) + '"></div>' +
      '<p><button type="button" class="btn ghost small" id="detect">I\'m on it now: check this computer for me</button></p><div class="status" id="detStatus" role="status"></div></div></fieldset>';
    // 2. why
    h += '<fieldset id="whybox"' + (q.replacing && q.replacing !== "none" ? "" : " hidden") + '><legend>2. Why are you replacing it?</legend><p class="hint">Tick everything that applies. Sometimes a repair or upgrade is the better buy, and I\'ll tell you if so.</p>' + checks("why", WHY, q.why) +
      '<div class="field" id="whyAppBox"' + (q.why.indexOf("app") >= 0 ? "" : " hidden") + '><label for="whyapp">Which app or game?</label><input id="whyapp" type="text" placeholder="e.g. Microsoft Teams, The Sims 4, MYOB" value="' + esc(q.whyApp) + '"></div></fieldset>';
    // 3. uses
    h += '<fieldset><legend>3. What will you mostly use the new one for?</legend><p class="hint">Tick everything that applies.</p>' + checks("use", USES.slice(0, 5).map(function (u) { return [u[0], u[1]]; }), q.uses) + "</fieldset>";
    // 4. type
    h += '<fieldset><legend>4. What type of computer?</legend>' + radios("type", [["laptops", "A laptop I can carry around"], ["desktops", "A desktop or all-in-one that stays on the desk"], ["handhelds", "A handheld gaming PC (plugs into a dock to work like a desktop)"], ["any", "Not sure, show me laptops and desktops"]], q.type) + "</fieldset>";
    // 5. budget
    h += '<fieldset><legend>5. What\'s your budget?</legend><p class="hint">The most you\'d like to spend on the computer itself.</p><div class="budgets">';
    BUDGETS.forEach(function (b) { h += '<label class="bchip"><input type="radio" name="bud" value="' + b + '"' + (!custom && q.budget === b ? " checked" : "") + "><span>" + (b ? "Up to " + money(b) : "No set budget") + "</span></label>"; });
    h += '<label class="bchip"><input type="radio" name="bud" value="custom"' + (custom ? " checked" : "") + '><span>Other amount</span></label></div>';
    h += '<div class="field budcustom"' + (custom ? "" : " hidden") + '><label for="budc">Your budget in dollars</label><input id="budc" type="number" inputmode="numeric" min="100" step="50" placeholder="e.g. 1000" value="' + (custom ? q.budget : "") + '"></div></fieldset>';
    // 6. new or refurbished
    h += '<fieldset><legend>6. New or refurbished?</legend><p class="hint">Refurbished computers are checked, cleaned and graded, and cost much less. I set them up just like new ones.</p>' +
      radios("rf", [["both", "Show me both"], ["new", "Brand new only"], ["refurb", "Refurbished only"]], q.refurb) +
      '<label class="opt"><input type="checkbox" id="gradeA"' + (q.gradeA ? " checked" : "") + '><span class="t">Refurbished must be Grade A (looks like new)</span></label></fieldset>';
    // 7. extras + special requests
    h += '<fieldset><legend>7. Anything else that matters?</legend>' + checks("extra", [["portable", "Light and easy to carry (14\" or smaller)"], ["bigscreen", "A big screen"], ["tch", "A touchscreen"], ["perth", "Ready quickly (already in stock in Perth)"]], q.extras) +
      '<div class="field" style="margin-top:12px"><label for="special">Special requests</label><textarea id="special" rows="3" placeholder="e.g. needs a CD/DVD drive, must run a particular game or app, Grade A only, a big keyboard, works with my printer…">' + esc(q.special) + "</textarea><div class=\"hint\">I read every one of these and include them in your custom quote.</div></div></fieldset>";
    h += '<p><button class="btn">Show me my options</button></p><div class="status" id="pkStatus" role="status"></div></form><div id="pkres" aria-live="polite"></div>' + guarantee();
    app.innerHTML = h;
    var form = document.getElementById("pk"), bc = form.querySelector(".budcustom"), budc = document.getElementById("budc");
    function showOld() { var r = (form.querySelector("input[name=rep]:checked") || {}).value; var on = r && r !== "none"; document.getElementById("oldbox").hidden = !on; document.getElementById("whybox").hidden = !on; }
    Array.prototype.forEach.call(form.querySelectorAll("input[name=rep]"), function (r) { r.onchange = showOld; });
    Array.prototype.forEach.call(form.querySelectorAll("input[name=why]"), function (c) { c.onchange = function () { document.getElementById("whyAppBox").hidden = !form.querySelector("input[name=why][value=app]").checked; }; });
    Array.prototype.forEach.call(form.querySelectorAll("input[name=bud]"), function (r) { r.onchange = function () { bc.hidden = r.value !== "custom"; if (!bc.hidden) budc.focus(); }; });
    budc.oninput = function () { form.querySelector("input[name=bud][value=custom]").checked = true; bc.hidden = false; };
    document.getElementById("detect").onclick = detectDevice;
    function read() {
      var b = (form.querySelector("input[name=bud]:checked") || { value: "0" }).value;
      function vals(n) { return [].map.call(form.querySelectorAll("input[name=" + n + "]:checked"), function (i) { return i.value; }); }
      var rep = (form.querySelector("input[name=rep]:checked") || { value: "" }).value, has = rep && rep !== "none";
      return {
        replacing: rep, age: has ? val("age") : "", oldRam: has ? Number(val("oram")) : 0, oldSto: has ? Number(val("osto")) : 0, oldDisk: has ? val("odisk") : "", oldModel: has ? val("omodel") : "",
        why: has ? vals("why") : [], whyApp: has ? val("whyapp") : "",
        uses: vals("use"), type: (form.querySelector("input[name=type]:checked") || { value: "any" }).value,
        budget: b === "custom" ? Math.max(0, Math.round(Number(budc.value) || 0)) : Number(b),
        extras: vals("extra"), refurb: (form.querySelector("input[name=rf]:checked") || { value: "both" }).value,
        gradeA: document.getElementById("gradeA").checked, special: val("special")
      };
    }
    form.onsubmit = function (e) {
      e.preventDefault();
      var st = document.getElementById("pkStatus");
      var b = (form.querySelector("input[name=bud]:checked") || {}).value;
      if (b === "custom" && !(Number(budc.value) > 0)) { st.className = "status err"; st.textContent = "Please type in your budget, or choose one of the amounts."; budc.focus(); return; }
      st.className = "status"; st.textContent = "";
      q = read(); save("tts-pick", q); showPicks(q); document.getElementById("pkres").scrollIntoView({ behavior: "smooth" });
    };
    if (q.uses.length || fromLink) showPicks(q);
  }
  function detectDevice() {
    var st = document.getElementById("detStatus"), ua = navigator.userAgent || "", found = [];
    if (/Android|iPhone|iPad|Mobile/i.test(ua) && !/Windows|Macintosh/i.test(ua)) { st.className = "status"; st.textContent = "It looks like you're on a phone or tablet. Open this page on the computer you're replacing and press the button again, or just skip these questions."; return; }
    var os = /Windows/i.test(ua) ? "Windows" : /Macintosh|Mac OS/i.test(ua) ? "Mac" : /CrOS/i.test(ua) ? "Chromebook" : /Linux/i.test(ua) ? "Linux" : "";
    if (os) { found.push(os); var rep = os === "Mac" ? "mac" : os === "Chromebook" ? "tablet" : ""; if (rep) { var r = document.querySelector("input[name=rep][value=" + rep + "]"); if (r) r.checked = true; } }
    var mem = navigator.deviceMemory;
    if (mem) { var o = mem >= 8 ? "8" : "4"; document.getElementById("oram").value = o; found.push(mem >= 8 ? "at least 8GB of memory" : "about " + mem + "GB of memory"); }
    if (navigator.hardwareConcurrency) found.push(navigator.hardwareConcurrency + " processor threads");
    if (window.screen && screen.width) found.push("screen " + Math.round(screen.width * (window.devicePixelRatio || 1)) + " × " + Math.round(screen.height * (window.devicePixelRatio || 1)));
    st.className = "status" + (found.length ? " ok" : "");
    st.innerHTML = (found.length ? "This computer: " + esc(found.join(", ")) + ". " : "Your browser doesn't share these details. ") +
      "A web page can't see your storage. " + (os === "Mac" ? "To check it: Apple menu › About This Mac › More Info › Storage." : "To check it: press the Windows key, type <b>Storage</b> and open Storage settings. For memory and model: Settings › System › About.");
  }
  function power(p) { return (p.cpu || 1) * 2 + Math.min(p.ram || 8, 32) / 8 + Math.min(p.sto || 256, 2000) / 1000 + (p.gpu ? 2 : 0); }
  function extraOk(p, x) {
    var u = p.u || [];
    if (x === "portable") return u.indexOf("portable") >= 0;
    if (x === "bigscreen") return u.indexOf("bigscreen") >= 0;
    if (x === "tch") return !!p.tch;
    if (x === "perth") return !!p.pe;
    return true;
  }
  var EXTRA_NAMES = { portable: "light and portable", bigscreen: "big screen", tch: "touchscreen", perth: "in stock in Perth", minspec: "at least as much memory and storage as your current one" };
  function minSpec(q) {
    var ram = q.oldRam || 0, sto = q.oldSto || 0;
    if (q.why.indexOf("slow") >= 0 && ram) ram = Math.min(Math.max(ram * 2, 8), 16);
    if (q.why.indexOf("space") >= 0 && sto) sto = Math.min(sto * 2, 2000);
    return { ram: ram, sto: sto };
  }
  function pickMatches(q, extras) {
    var ms = minSpec(q);
    return P.filter(function (p) {
      if (!COMPUTER_CATS[p.c]) return false;
      if (q.type === "any" ? p.c === "handhelds" : p.c !== q.type) return false;
      if (q.refurb === "new" && p.rf) return false;
      if (q.refurb === "refurb" && !p.rf) return false;
      if (q.gradeA && p.rf && p.gr && !/^(A|Ex-demo)$/.test(p.gr)) return false;
      var u = p.u || [];
      if (!q.uses.every(function (x) { return u.indexOf(x) >= 0; })) return false;
      return extras.every(function (x) {
        if (x === "minspec") return (!ms.ram || !p.ram || p.ram >= ms.ram) && (!ms.sto || !p.sto || p.sto >= ms.sto);
        return extraOk(p, x);
      });
    });
  }
  function adviceFor(q) {
    if (!q.replacing || q.replacing === "none" || !q.why.length) return null;
    var w = function (k) { return q.why.indexOf(k) >= 0; }, young = q.age === "0-3" || q.age === "3-5", old = q.age === "8+";
    var tips = [], repair = false;
    if (w("broken")) { tips.push("Before replacing it, a quick diagnosis is worth it. A faulty charger, drive or software problem is often a simple fix, and I can usually rescue your files either way."); repair = true; }
    if ((w("battery") || w("damage")) && !old) { tips.push("A new battery, screen or keyboard usually costs much less than a new computer" + (young ? ", and yours is young enough to be worth fixing." : ".")); repair = true; }
    if (w("slow") && !old && (q.oldDisk === "hdd" || (q.oldRam && q.oldRam <= 8))) { tips.push("Swapping " + (q.oldDisk === "hdd" ? "the hard drive for an SSD" : "in more memory") + " often makes a computer feel new again, for a fraction of the price of a new one."); repair = true; }
    if (w("space") && !w("slow")) { tips.push("If space is the only problem, a bigger drive or a backup drive for your photos may solve it cheaply."); repair = true; }
    if (w("support") || old) { tips.push("At " + (old ? "this age" : "this point") + ", a new or newer refurbished computer is usually the better investment: much faster, more secure and supported with updates for years."); repair = repair && !old && !w("support"); }
    if (w("app")) tips.push("I'll check that " + (q.whyApp ? "<b>" + esc(q.whyApp) + "</b>" : "the app or game you need") + " runs well on whatever you choose.");
    if (!tips.length) return null;
    return { tips: tips, repair: repair };
  }
  function whyLines(p, q) {
    var L = [];
    if (p.rf) L.push("Refurbished" + (p.gr ? ", " + gradeName(p.gr) : "") + ": a big saving on the new price");
    if (p.ram) L.push(p.ram + "GB memory" + (q.oldRam && p.ram >= q.oldRam * 2 ? " (" + (p.ram / q.oldRam) + "× your current one)" : p.ram >= 16 ? ": smooth with lots of apps open" : ": fine for everyday use"));
    if (p.sto) L.push((p.sto >= 1000 ? p.sto / 1000 + "TB" : p.sto + "GB") + " fast SSD storage" + (q.oldSto && p.sto > q.oldSto ? " (more than you have now)" : ""));
    if (p.gpu) L.push("Dedicated graphics for games and video");
    else if ((p.cpu || 0) >= 3) L.push("Fast processor for photo and video work");
    if (p.c === "handhelds") L.push("Plays PC games anywhere; docks to a TV or monitor");
    if (p.scr && p.scr <= 14.5 && p.c === "laptops") L.push(p.scr + '" screen: light and easy to carry');
    else if (p.scr >= 15.5) L.push(p.scr + '" screen: easy on the eyes');
    if (p.tch) L.push("Touchscreen");
    if (p.pe) L.push("In stock in Perth, so it's ready sooner");
    return L.slice(0, 4);
  }
  function tiersOf(within, budget) {
    if (!within.length) return [];
    if (!budget) {
      var t0 = tiersOf(within, 1);
      var ch = within.reduce(function (a, b) { return b.p < a.p ? b : a; }), cp = Math.max(ch.p * 3, 2500);
      var t1 = tiersOf(within.filter(function (p) { return p.p <= cp; }), 1);
      return t1.length >= Math.min(3, t0.length) ? t1 : t0;
    }
    if (false) { // no set budget: keep "Best" sensible rather than the most expensive machine in the shop
      var cheapest = within.reduce(function (a, b) { return b.p < a.p ? b : a; });
      var cap = Math.max(cheapest.p * 3, 2500), capped = within.filter(function (p) { return p.p <= cap; });
      if (capped.length >= 2) within = capped;
    }
    var byPrice = within.slice().sort(function (a, b) { return a.p - b.p || power(b) - power(a); });
    var good = byPrice[0];
    var best = within.slice().sort(function (a, b) { return power(b) - power(a) || a.p - b.p; })[0];
    if (best === good) {
      var alt = byPrice.filter(function (p) { return p !== good && power(p) > power(good); });
      if (!alt.length) return [good];
      best = alt.sort(function (a, b) { return power(b) - power(a) || a.p - b.p; })[0];
    }
    var mid = (good.p + best.p) / 2;
    var cands = within.filter(function (p) { return p !== good && p !== best && p.p > good.p && p.p < best.p && power(p) >= power(good); });
    var better = cands.sort(function (a, b) { return Math.abs(a.p - mid) - Math.abs(b.p - mid) || power(b) - power(a); })[0];
    return better ? [good, better, best] : [good, best];
  }
  function tierCard(p, label, q, star) {
    return '<div class="tier' + (star ? " star" : "") + '"><div class="tlabel">' + label + (star ? ' <span class="tpick">Tony\'s pick</span>' : "") + "</div>" + card(p) +
      '<ul class="why">' + whyLines(p, q).map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul></div>";
  }
  function showPicks(q) {
    var box = document.getElementById("pkres");
    if (!q.uses.length) { box.innerHTML = '<div class="note">Please tick at least one thing you\'ll use it for (question 3).</div>'; return; }
    function inBudget(p) { return !q.budget || p.p <= q.budget; }
    var keep = q.extras.slice(), dropped = [], order = ["perth", "tch", "minspec", "bigscreen", "portable"];
    if (q.oldRam || q.oldSto) keep.push("minspec");
    var all = pickMatches(q, keep), within = all.filter(inBudget);
    while (within.length < 3 && keep.length) {
      var x = order.filter(function (o) { return keep.indexOf(o) >= 0; })[0] || keep[0];
      keep.splice(keep.indexOf(x), 1); dropped.push(x);
      all = pickMatches(q, keep); within = all.filter(inBudget);
    }
    var what = q.type === "laptops" ? "laptop" : q.type === "desktops" ? "desktop" : q.type === "handhelds" ? "handheld" : "computer";
    var adv = adviceFor(q);
    var h = '<h2 style="margin-top:28px">Your best options</h2>';
    if (adv) {
      h += '<div class="panel advice"><h3>' + (adv.repair ? "Before you buy: fixing yours might be cheaper" : "Good to know") + "</h3><ul>" + adv.tips.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul>" +
        (adv.repair ? '<p><button type="button" class="btn ghost" data-ask="repair">Ask me for a repair or upgrade quote</button></p>' : "") + "</div>";
    }
    h += '<div class="note"><b>Tony\'s tip:</b> ' + esc(tipFor(q)) + "</div>";
    if (dropped.length) h += '<p class="hint">Nothing in your budget ticked every box, so I\'ve left out: ' + esc(dropped.map(function (d) { return EXTRA_NAMES[d]; }).join(", ")) + ".</p>";
    var shown = [];
    if (!within.length) {
      var over = all.slice().sort(function (a, b) { return a.p - b.p; }).slice(0, 3);
      h += '<div class="empty budgetgap"><h3>' + (over.length ? "Nothing fits " + money(q.budget) + " for that right now" : "I don't have a match in the shop for that right now") + "</h3><p>" +
        (over.length ? "The lowest-priced " + what + " in my shop for " + esc(q.uses.map(function (u) { return useName(u).split(/[:,&]/)[0].trim().toLowerCase(); }).join(" and ")) + " is <b>" + money(over[0].p) + "</b>, so I've shown the closest options below. " : "") +
        "Or ask me for a free custom quote: I can often find a good refurbished or end-of-line machine that fits your budget.</p>" +
        '<p><button type="button" class="btn" data-ask="quote">Get a free custom quote</button></p></div>';
      if (over.length) h += '<div class="grid">' + over.map(function (p, i) { shown.push(p); return card(p).replace('<div class="body">', '<div class="body">' + (i === 0 ? '<span class="chip badge">Closest to your budget</span>' : "")); }).join("") + "</div>";
    } else {
      var t = tiersOf(within, q.budget);
      var labels = t.length === 3 ? ["Good", "Better", "Best"] : t.length === 2 ? ["Good", "Best"] : ["Best match"];
      h += '<div class="tiers">' + t.map(function (p, i) { shown.push(p); return tierCard(p, labels[i], q, t.length === 3 ? i === 1 : i === t.length - 1); }).join("") + "</div>";
      var rest = within.filter(function (p) { return t.indexOf(p) < 0; }).sort(function (a, b) { return power(b) - power(a) || a.p - b.p; });
      if (rest.length) {
        h += '<h3 style="margin-top:26px">More options that suit you (' + rest.length + ')</h3><p class="hint">Tick "Compare" on any of them to see them side by side.</p><div class="grid" id="restGrid"></div><p id="restMoreP"' + (rest.length > 12 ? "" : " hidden") + '><button type="button" class="btn ghost" id="restMore">Show more</button></p>';
      }
    }
    h += bundlePanel(shown.filter(function (p) { return p.c === "desktops"; }).slice(0, 3));
    if (/\b(cd|dvd|disc|disk drive|blu-?ray)\b/i.test(q.special)) {
      var dvd = P.filter(function (p) { return /dvd|blu-?ray|optical/i.test(p.n) && p.c === "accessories"; }).sort(function (a, b) { return a.p - b.p; })[0];
      if (dvd) h += '<div class="note"><b>CD/DVD drive:</b> most new computers don\'t have one built in. This plugs into a USB port: <a href="' + prodUrl(dvd) + '">' + esc(dvd.n) + "</a>, " + money(dvd.p) + ".</div>";
    }
    h += mbBlurb();
    h += saveSendPanel(q, !within.length ? "quote" : adv && adv.repair ? "repair" : "results");
    box.innerHTML = h;
    if (rest && rest.length) {
      var n = 0, rg = document.getElementById("restGrid");
      var more = function () { rg.insertAdjacentHTML("beforeend", rest.slice(n, n + 12).map(card).join("")); n += 12; document.getElementById("restMoreP").hidden = n >= rest.length; };
      more(); document.getElementById("restMore").onclick = more;
    }
    Array.prototype.forEach.call(box.querySelectorAll("[data-ask]"), function (b) {
      b.onclick = function () { var r = document.querySelector("input[name=purpose][value=" + b.getAttribute("data-ask") + "]"); if (r) r.checked = true; document.getElementById("send").scrollIntoView({ behavior: "smooth" }); setTimeout(function () { var f = document.getElementById("sname"); if (f) f.focus({ preventScroll: true }); }, 400); };
    });
    bindBundle(); bindSaveSend(q); cmpBar();
  }
  function pickSummary(q) {
    var L = [];
    if (q.replacing && q.replacing !== "none") {
      var map = { laptop: "Windows laptop", desktop: "Windows desktop/all-in-one", mac: "Mac", tablet: "tablet/Chromebook" };
      L.push("Replacing: " + (map[q.replacing] || q.replacing) + (q.oldModel ? " (" + q.oldModel + ")" : "") + [q.age ? ", age " + q.age + " years" : "", q.oldRam ? ", " + q.oldRam + "GB RAM" : "", q.oldSto ? ", " + (q.oldSto >= 1000 ? q.oldSto / 1000 + "TB" : q.oldSto + "GB") + " storage" : "", q.oldDisk ? " (" + q.oldDisk.toUpperCase() + ")" : ""].join(""));
      if (q.why.length) L.push("Why: " + q.why.map(function (w) { return (WHY.filter(function (x) { return x[0] === w; })[0] || [0, w])[1]; }).join("; ") + (q.whyApp ? " [" + q.whyApp + "]" : ""));
    } else if (q.replacing === "none") L.push("Replacing: nothing (extra or first computer)");
    L.push("Use: " + q.uses.map(useName).join("; "));
    L.push("Type: " + ({ any: "laptop or desktop", laptops: "laptop", desktops: "desktop", handhelds: "handheld gaming PC" }[q.type] || q.type));
    L.push("Budget: " + (q.budget ? "up to " + money(q.budget) : "no set budget"));
    L.push("New or refurbished: " + ({ both: "either", "new": "new only", refurb: "refurbished only" }[q.refurb] || "either") + (q.gradeA ? ", Grade A only" : ""));
    if (q.extras.length) L.push("Also wants: " + q.extras.map(function (x) { return EXTRA_NAMES[x]; }).join(", "));
    if (q.special) L.push("Special requests: " + q.special);
    return L;
  }
  function saveSendPanel(q, purpose) {
    var d = load("tts-cust", {}), link = pickLink(q);
    var shareText = "My computer options from Tony's Tech Support: " + link;
    var h = '<section class="panel send" id="send"><h2 style="margin-top:0">Save or send my results</h2>' +
      '<p>Keep this link to come back to your options, or send it to someone helping you decide.</p>' +
      '<div class="sharerow"><input id="plink" type="text" readonly value="' + esc(link) + '" aria-label="Link to your results"><button type="button" class="btn small" id="copyLink">Copy link</button></div>' +
      '<p class="sharebtns">' + (navigator.share ? '<button type="button" class="btn ghost small" id="shareBtn">Share…</button>' : "") +
      '<a class="btn ghost small" href="sms:?&body=' + encodeURIComponent(shareText) + '">Text it to someone</a>' +
      '<a class="btn ghost small" href="mailto:?subject=' + encodeURIComponent("Computer options from Tony's Tech Support") + "&body=" + encodeURIComponent(shareText) + '">Email it to someone</a>' +
      '<button type="button" class="btn ghost small" id="printRes">Print</button></p>';
    h += '<h3 style="margin-top:22px">Send a copy to Tony</h3><p>I\'ll get your answers, the options above and anything you ask. It may take me up to ' + esc((CFG.quotes && CFG.quotes.responseTime) || "1 business day") + " to put together suitable options and reply by email.</p>" +
      '<form id="sf2" novalidate>' + radios("purpose", [["results", "I have a question about these options"], ["quote", "Please find me something: free custom quote"], ["repair", "Quote me to repair or upgrade my current computer"]], purpose) +
      '<div class="qgrid">' + field("sname", "Your name", "text", d.name, "name", true) + field("semail", "Email", "email", d.email, "email", true) + field("sphone", "Mobile (optional)", "tel", d.phone, "tel", false) + "</div>" +
      '<div class="field"><label for="squest">Your questions or anything else I should know</label><textarea id="squest" rows="3" placeholder="e.g. Is the Better option fine for Zoom? Can you transfer my photos?"></textarea></div>' +
      '<p><button class="btn">Email it to Tony</button></p><div class="status" id="sStatus" role="status"></div></form></section>';
    return h;
  }
  function bindSaveSend(q) {
    var link = pickLink(q);
    var cb = document.getElementById("copyLink");
    if (cb) cb.onclick = function () { var i = document.getElementById("plink"); i.select(); var ok = false; try { if (navigator.clipboard) { navigator.clipboard.writeText(link); ok = true; } else ok = document.execCommand("copy"); } catch (e) {} cb.textContent = ok ? "Copied ✓" : "Select and copy"; };
    var sb = document.getElementById("shareBtn");
    if (sb) sb.onclick = function () { navigator.share({ title: "My computer options", text: "My computer options from Tony's Tech Support", url: link }).catch(function () {}); };
    document.getElementById("printRes").onclick = function () { window.print(); };
    var f = document.getElementById("sf2"); if (!f) return;
    f.onsubmit = function (e) {
      e.preventDefault();
      var st = document.getElementById("sStatus"), c = { name: val("sname"), email: val("semail"), phone: val("sphone"), quest: val("squest") };
      var purpose = (f.querySelector("input[name=purpose]:checked") || { value: "results" }).value;
      if (!c.name || !/.+@.+\..+/.test(c.email)) { st.className = "status err"; st.textContent = "Please enter your name and email so I can reply."; return; }
      var old = load("tts-cust", {}); old.name = c.name; old.email = c.email; if (c.phone) old.phone = c.phone; save("tts-cust", old);
      var ref = "Q-" + Math.random().toString(36).slice(2, 7).toUpperCase();
      var kind = { results: "Question about picker results", quote: "Free custom quote request", repair: "Repair or upgrade quote request" }[purpose];
      var shownList = [].map.call(document.querySelectorAll("#pkres .tier, #pkres .budgetgap ~ .grid .card"), function (el) {
        var lab = el.querySelector(".tlabel"); var a = el.querySelector("a.card") || el; var href = a.getAttribute("href") || "";
        var id = Object.keys(BYID).filter(function (k) { return prodUrl(BYID[k]) === href; })[0]; var p = BYID[id];
        return p ? (lab ? lab.textContent.replace("Tony's pick", "(Tony's pick)") + ": " : "") + p.n + " " + money(p.p) + " [" + p.id + "]" : "";
      }).filter(Boolean);
      var lines = [kind + " " + ref, "From: " + c.name + " <" + c.email + ">" + (c.phone ? " " + c.phone : ""), ""].concat(pickSummary(q)).concat(shownList.length ? ["", "Options shown:"].concat(shownList) : []).concat(c.quest ? ["", "Their message: " + c.quest] : []).concat(["", "Their results: " + link]);
      var flat = { type: purpose, ref: ref, subject: kind + " from " + c.name + " (" + ref + ")", name: c.name, first_name: c.name.split(" ")[0], email: c.email, phone: c.phone,
        summary: lines.join("\n"), html: lines.map(esc).join("<br>").replace(esc(link), '<a href="' + esc(link) + '">' + esc(link) + "</a>"), link: link, source: "shop picker" };
      var btn = f.querySelector("button"); btn.disabled = true; st.className = "status"; st.textContent = "Sending…";
      var url = CFG.quotes && CFG.quotes.webhookUrl;
      var mail = "mailto:" + ((CFG.quotes && CFG.quotes.email) || CFG.site.email) + "?subject=" + encodeURIComponent(flat.subject) + "&body=" + encodeURIComponent(flat.summary);
      (url ? postFlat(url, flat) : Promise.reject(new Error("no webhook"))).then(function () {
        f.innerHTML = '<div class="status ok"><b>Thanks, ' + esc(flat.first_name) + "!</b> Your " + (purpose === "results" ? "question is" : "request is") + " with me. It may take me up to " + esc((CFG.quotes && CFG.quotes.responseTime) || "1 business day") + " to put together suitable options, and I'll reply to " + esc(c.email) + ".</div>";
      }, function () {
        btn.disabled = false; st.className = "status err";
        st.innerHTML = 'Sorry, that didn\'t send. Please <a href="' + esc(mail) + '">email it from your own email app</a> instead; everything will be filled in for you.';
      });
    };
  }
  function tipFor(q) {
    if (q.uses.indexOf("creative") >= 0) return "For photo and video work, aim for at least 16GB of memory, a Core i7, Ultra 7 or Ryzen 7 processor, and 512GB or more of storage. A backup drive is a must for your photos.";
    if (q.uses.indexOf("gaming") >= 0) return "For gaming, a dedicated graphics card (such as NVIDIA RTX) matters more than anything else. Let me know which games you play and I'll check they'll run well.";
    if (q.uses.indexOf("business") >= 0) return "For business use, 16GB of memory keeps things smooth with lots of apps open. Windows 11 Pro adds stronger security features like drive encryption.";
    if (q.uses.indexOf("study") >= 0) return "For study and office work, 16GB of memory will keep it running smoothly for years, but 8GB is fine on a tight budget. A comfortable keyboard and good battery life make a big difference.";
    return "For everyday use, almost any current computer will do the job. 8GB of memory is the minimum I'd recommend, and a backup drive is a great idea for your photos.";
  }

  // ---------------------------------------------------------------- pricing of extras
  function totals(lines) {
    var s = CFG.services, t = { items: 0, rows: [], tbc: false };
    lines.forEach(function (x) { t.items += x.p.p * x.q; });
    var comps = computersIn(lines), win = computersIn(lines, "windows");
    var call = opts.callout;
    var onsite = opts.migration === "onsite";
    var label, amt;
    if (onsite) { label = "Delivery, setup & on-site data transfer"; amt = call == null ? null : r5(s.migration.onsiteBase + call); }
    else if (opts.delivery === "setup") { label = "Hand delivery & 1-hour setup"; amt = call == null ? null : r5(s.setupBase + call); }
    else { label = "Uber Courier delivery"; amt = call == null ? null : r5(call * s.courierFactor); }
    if (amt == null) { t.tbc = true; t.rows.push([label, "to be confirmed"]); } else t.rows.push([label, amt]);
    if ((opts.delivery === "setup" || onsite) && opts.extraHours > 0) t.rows.push(["Extra setup time (" + opts.extraHours + " hr)", r5(opts.extraHours * s.ratePerHour)]);
    if (comps) {
      if (opts.migration === "sendin") t.rows.push(["Data transfer (old device sent to Tony)", r5(s.migration.sendIn)]);
      if (opts.migration === "remote") t.rows.push(["Remote data transfer", r5(s.migration.remote)]);
      s.addons.forEach(function (a) { if (opts.addons[a.id]) { var n = a.windowsOnly ? win : comps; if (n) t.rows.push([a.name + (n > 1 ? " × " + n : ""), r5(a.price) * n]); } });
      var free = s.freeApps.filter(function (a) { return opts.apps[a.id]; }).length + (opts.browser ? 1 : 0) + (opts.emailApp ? 1 : 0);
      if (free) t.rows.push(["Free apps installed (" + free + ")", 0]);
    }
    if (lines.some(function (x) { return x.p.c === "backup"; })) t.rows.push(["Backup drive set up", 0]);
    var mb = mbDiscount(lines); t.mb = mb;
    if (mb.amount) t.rows.unshift(["Multi-buy discount (" + mb.count + " items, " + mb.pct + "% off)", -mb.amount]);
    t.total = t.items; t.rows.forEach(function (r) { if (typeof r[1] === "number") t.total += r[1]; });
    return t;
  }
  function summaryHtml(lines, t, actions) {
    var h = '<div class="panel summary"><div class="sticky"><h3>Order summary</h3>';
    lines.forEach(function (x) { h += '<div class="row"><span>' + esc(x.p.n) + (x.q > 1 ? " × " + x.q : "") + "</span><span>" + money(x.p.p * x.q) + "</span></div>"; });
    t.rows.forEach(function (r) { h += '<div class="row' + (typeof r[1] === "number" && r[1] < 0 ? " save" : "") + '"><span>' + esc(r[0]) + "</span><span>" + (typeof r[1] === "number" ? (r[1] ? money(r[1]) : "Free") : esc(r[1])) + "</span></div>"; });
    if (t.mb && t.mb.next) h += '<p class="hint mbnext">Add ' + (t.mb.next.items - t.mb.count) + " more item" + (t.mb.next.items - t.mb.count > 1 ? "s" : "") + " to save " + t.mb.next.pct + "% on your order.</p>";
    h += '<div class="row total"><span>Total</span><span>' + money(t.total) + (t.tbc ? " + delivery" : "") + "</span></div>";
    h += '<p class="hint">Prices in Australian dollars, including GST.' + (t.tbc ? " Enter your suburb to work out delivery, or I'll confirm it by text." : "") + "</p>" + (actions ? '<div class="sumactions noprint">' + actions + "</div>" : "");
    return h;
  }

  function viewCart() {
    var lines = inCart();
    if (!lines.length) { app.innerHTML = '<div class="empty" style="margin-top:30px"><h2>Your cart is empty</h2><p><a class="btn" href="/#/">Browse the shop</a></p></div>' + guarantee(); return; }
    var s = CFG.services, comps = computersIn(lines), win = computersIn(lines, "windows");
    var h = "<h2 style=\"margin-top:24px\">Your cart</h2><div class=\"layout\"><div>";
    h += '<div class="panel">';
    lines.forEach(function (x) {
      h += '<div class="line"><a class="thumb" href="' + prodUrl(x.p) + '">' + pic(x.p) + '</a><div><a href="' + prodUrl(x.p) + '">' + esc(x.p.n) + "</a><div class=\"hint\">Ready in about " + eta(x.p) + '</div><div class="qty"><button aria-label="One less" data-q="-1" data-id="' + esc(x.p.id) + '">−</button><span>' + x.q + '</span><button aria-label="One more" data-q="1" data-id="' + esc(x.p.id) + '">+</button><button class="linkbtn" data-rm="' + esc(x.p.id) + '">Remove</button></div></div><div class="lineprice"><b>' + money(x.p.p * x.q) + "</b></div></div>";
    });
    h += "</div>";
    if (comps && !lines.some(function (x) { return x.p.c === "backup"; })) h += backupOffer();

    // delivery
    h += "<fieldset><legend>Delivery or setup</legend>";
    h += '<div class="calcbox"><div class="field" style="margin:0"><label for="sub">Your suburb or postcode</label><div class="calc"><input id="sub" list="suburbList" autocomplete="off" placeholder="Start typing, e.g. Midland" value="' + esc(opts.suburb) + '"><button class="btn small" id="calcBtn" type="button">Work out cost</button></div><datalist id="suburbList"></datalist>' +
      '<div class="status' + (opts.callout != null ? " ok" : "") + '" id="calcStatus" role="status">' + calcMsg() + '</div></div></div>';
    h += optRadio("delivery", "courier", "<b>Standard delivery by Uber Courier</b><br><span class=\"hint\">Once your order is ready, I'll text you to choose the best place and time, at home or at your workplace during opening hours on a day you're there. No expensive devices left on a porch or next to a mailbox.</span>", opts.callout != null ? money(r5(opts.callout * s.courierFactor)) : "");
    h += optRadio("delivery", "setup", "<b>Hand delivery and setup by Tony</b><br><span class=\"hint\">I'll bring it to you, set it up and give you a 1-hour walkthrough. Extra time is about " + money(r5(s.ratePerHour)) + " an hour.</span>", opts.callout != null ? money(r5(s.setupBase + opts.callout)) : money(r5(s.setupBase)) + " + callout");
    if (opts.delivery === "setup" || opts.migration === "onsite") {
      h += '<div class="field" style="margin-top:10px"><label for="xh">Extra setup time</label><select id="xh">' + [0, 1, 2, 3].map(function (n) { return '<option value="' + n + '"' + (opts.extraHours == n ? " selected" : "") + ">" + (n ? "+" + n + " hour" + (n > 1 ? "s" : "") + " (" + money(r5(n * s.ratePerHour)) + ")" : "No extra time") + "</option>"; }).join("") + "</select></div>";
    }
    h += "</fieldset>";

    if (comps) {
      h += "<fieldset><legend>Free apps I'll install for you</legend>";
      s.freeApps.forEach(function (a) { if (a.windowsOnly && !win) return; h += optCheck("apps", a.id, esc(a.name), "Free"); });
      h += '<div class="field" style="margin-top:10px"><label for="br">Default web browser</label><select id="br"><option value="">Leave as it comes</option>' + s.browsers.map(function (b) { return "<option" + (opts.browser === b ? " selected" : "") + ">" + esc(b) + "</option>"; }).join("") + "</select></div>";
      h += '<div class="field"><label for="em">Email app</label><select id="em"><option value="">No email app</option>' + s.emailApps.map(function (b) { return "<option" + (opts.emailApp === b ? " selected" : "") + ">" + esc(b) + "</option>"; }).join("") + '</select><div class="hint">Setting up your email account may cost extra, depending on your email provider.</div></div>';
      h += "</fieldset>";

      h += "<fieldset><legend>Optional add-ons</legend>";
      s.addons.forEach(function (a) { if (a.windowsOnly && !win) return; h += optCheck("addons", a.id, "<b>" + esc(a.name) + "</b>" + (a.note ? ' <span class="hint">(' + esc(a.note) + ")</span>" : ""), money(r5(a.price))); });
      h += "</fieldset>";

      h += "<fieldset><legend>Data transfer from your old computer</legend>";
      h += optRadio("migration", "none", "<b>No thanks</b>", "");
      h += optRadio("migration", "sendin", "<b>Send me your old device</b><br><span class=\"hint\">Drop it off or post it to me and I'll copy your files, photos and settings across before delivery.</span>", money(r5(s.migration.sendIn)));
      h += optRadio("migration", "remote", "<b>Remote transfer</b><br><span class=\"hint\">If your old computer still powers on, I can attempt the transfer remotely.</span>", money(r5(s.migration.remote)));
      h += optRadio("migration", "onsite", "<b>On-site transfer when I drop off your new device</b><br><span class=\"hint\">Replaces the delivery cost. Includes delivery, setup and transferring your data at your place.</span>", money(s.migration.onsiteBase) + " + callout");
      h += "</fieldset>";
    }
    h += '<p><a class="btn" href="/#/checkout" id="toCheckout">Continue to checkout</a> <a class="btn ghost" href="/#/">Keep shopping</a></p>';
    var tt = totals(lines);
    h += "</div>" + summaryHtml(lines, tt, '<a class="btn" href="/#/checkout">Continue to checkout</a><button type="button" class="linkbtn" id="printQuote">Print or save a quote (PDF)</button>') + "</div></div></div>" + guarantee();
    app.innerHTML = h;
    document.getElementById("printQuote").onclick = function () { printDoc(cartAsQuote(lines, tt), "quote"); };
    bindCart();
  }
  function calcMsg() {
    if (opts.callout != null) return "Callout fee for " + esc(opts.suburb) + ": " + money(opts.callout) + (opts.callout === 0 ? " (you're in my free area)" : "") + ". Added to your order below.";
    if (opts.suburb) return "I'll confirm the delivery cost for " + esc(opts.suburb) + " by text.";
    return "";
  }
  function optRadio(name, val, label, amt) {
    var on = opts[name] === val;
    return '<label class="opt"><input type="radio" name="' + name + '" value="' + val + '"' + (on ? " checked" : "") + '><span class="t">' + label + '</span><span class="amt">' + amt + "</span></label>";
  }
  function optCheck(group, id, label, amt) {
    return '<label class="opt"><input type="checkbox" data-group="' + group + '" value="' + id + '"' + (opts[group][id] ? " checked" : "") + '><span class="t">' + label + '</span><span class="amt">' + amt + "</span></label>";
  }
  function bindCart() {
    Array.prototype.forEach.call(app.querySelectorAll("[data-q]"), function (b) {
      b.onclick = function () { var id = b.getAttribute("data-id"); cart.forEach(function (l) { if (l.id === id) l.q = Math.max(1, l.q + Number(b.getAttribute("data-q"))); }); persist(); render(); };
    });
    Array.prototype.forEach.call(app.querySelectorAll("[data-rm]"), function (b) {
      b.onclick = function () { var id = b.getAttribute("data-rm"); cart = cart.filter(function (l) { return l.id !== id; }); persist(); render(); };
    });
    Array.prototype.forEach.call(app.querySelectorAll("input[type=radio]"), function (r) {
      r.onchange = function () { opts[r.name] = r.value; if (r.name === "migration" && r.value === "onsite") opts.delivery = "setup"; persist(); render(); };
    });
    Array.prototype.forEach.call(app.querySelectorAll("input[data-group]"), function (c) {
      c.onchange = function () { opts[c.getAttribute("data-group")][c.value] = c.checked; persist(); render(); };
    });
    var xh = document.getElementById("xh"); if (xh) xh.onchange = function () { opts.extraHours = Number(xh.value); persist(); render(); };
    var br = document.getElementById("br"); if (br) br.onchange = function () { opts.browser = br.value; persist(); render(); };
    var em = document.getElementById("em"); if (em) em.onchange = function () { opts.emailApp = em.value; persist(); render(); };
    var sub = document.getElementById("sub");
    loadSuburbs().then(function (d) {
      var dl = document.getElementById("suburbList");
      if (dl && !dl.childNodes.length) dl.innerHTML = d.filter(function (x) { return x[2] <= CFG.callout.maxOneWayKm; }).map(function (x) { return '<option value="' + esc(x[0] + " " + x[1]) + '">'; }).join("");
    }).catch(function () {});
    sub.onchange = function () { if (sub.value.trim()) calcCallout(sub.value.trim()); };
    document.getElementById("calcBtn").onclick = function () { calcCallout(sub.value.trim()); };
    sub.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); calcCallout(sub.value.trim()); } };
    bindDriveButtons();
  }

  // ---------------------------------------------------------------- callout fee (built in: no Google, works offline)
  // Distances come from suburbs.json: [suburb, postcode, straight-line km from Hazelmere].
  var SUBURBS = null;
  function loadSuburbs() {
    if (SUBURBS) return Promise.resolve(SUBURBS);
    return fetch("/suburbs.json").then(function (r) { return r.json(); }).then(function (d) { SUBURBS = d; return d; });
  }
  function calloutFee(roundTripKm) {
    var c = CFG.callout;
    if (roundTripKm <= c.freeDistanceKm) return 0;
    return Math.max(c.minFee, Math.ceil(roundTripKm * c.ratePerKm / c.roundTo - 1e-9) * c.roundTo);
  }
  function findSuburb(text) {
    var t = text.toLowerCase().replace(/,?\s*(wa|western australia)\b/g, "").replace(/\s+/g, " ").trim();
    var pc = (t.match(/\b6\d{3}\b/) || [])[0];
    var name = t.replace(/\b6\d{3}\b/, "").replace(/[,]/g, " ").replace(/\s+/g, " ").trim();
    var hits = SUBURBS.filter(function (x) { return (!name || x[0].toLowerCase() === name) && (!pc || x[1] === pc); });
    if (!hits.length && name) hits = SUBURBS.filter(function (x) { return x[0].toLowerCase().indexOf(name) === 0 && (!pc || x[1] === pc); });
    hits.sort(function (a, b) { return a[2] - b[2]; });
    return hits[0] || null;
  }
  function calcCallout(dest) {
    var st = document.getElementById("calcStatus");
    if (!dest) { st.className = "status err"; st.textContent = "Please enter your suburb or postcode."; return; }
    loadSuburbs().then(function () {
      var hit = findSuburb(dest), c = CFG.callout;
      if (!hit) { opts.suburb = dest; opts.callout = null; persist(); st.className = "status err"; st.textContent = "I couldn't find that suburb. Please check the spelling or try your postcode, or just order and I'll text you the delivery cost."; return; }
      opts.suburb = hit[0] + " " + hit[1];
      if (hit[2] > c.maxOneWayKm) { opts.callout = null; opts.calloutKm = null; persist(); render(); return; }
      var rt = hit[2] * c.roadFactor * 2;
      opts.calloutKm = Math.round(rt); opts.callout = calloutFee(rt); persist(); render();
    }).catch(function () {
      st.className = "status err"; st.textContent = "Sorry, the calculator didn't load. You can still order and I'll text you the delivery cost.";
    });
  }

  // ---------------------------------------------------------------- checkout
  var PM_NAMES = { payid: "PayID", bank: "Bank transfer", zeller: "Card (Zeller payment link)", paypal: "PayPal", cash: "Cash", card: "Card (online)", later: "Decide later" };
  function payMethods(t) {
    var pay = CFG.payments, m = [];
    if (pay.stripeWorker) m.push(["card", "<b>Card, paid online now</b><br><span class=\"hint\">" + (t.tbc ? "Enter your suburb in the cart first so the delivery cost is included." : "Secure card payment with an emailed receipt.") + "</span>", t.tbc]);
    if (pay.payId) m.push(["payid", "<b>PayID</b><br><span class=\"hint\">Instant from most Australian banks.</span>"]);
    if (pay.bsb) m.push(["bank", "<b>Bank transfer</b><br><span class=\"hint\">" + esc(pay.bankName || "") + " account details shown after you order.</span>"]);
    if (pay.zeller) m.push(["zeller", "<b>Card, no surcharge</b><br><span class=\"hint\">I'll text you a secure Zeller payment link once I've confirmed stock.</span>"]);
    if (pay.paypalMe) m.push(["paypal", "<b>PayPal</b><br><span class=\"hint\">Pay from your PayPal account or a card through PayPal.</span>"]);
    if (pay.cash) m.push(["cash", "<b>Cash</b><br><span class=\"hint\">By arrangement, when I deliver or set up your device.</span>"]);
    m.push(["later", "<b>Not sure yet</b><br><span class=\"hint\">I'll text you the payment options with your final total.</span>"]);
    return m;
  }
  function viewCheckout() {
    var lines = inCart();
    if (!lines.length) { go("#/cart"); return; }
    var t = totals(lines), pay = CFG.payments, d = load("tts-cust", {});
    var h = '<div class="crumbs"><a href="/#/cart">‹ Back to cart</a></div><h2>Checkout</h2><div class="layout"><form id="co" novalidate><div class="panel">';
    h += field("name", "Your name", "text", d.name, "name", true);
    h += field("phone", "Mobile number", "tel", d.phone, "tel", true, "I'll text you about delivery or setup.");
    h += field("email", "Email (for your receipt)", "email", d.email, "email", false);
    h += field("addr", "Street address" + (opts.suburb ? " in " + opts.suburb : ""), "text", d.addr, "street-address", false, "Only needed for delivery. We'll confirm the best place and time by text.");
    h += '<div class="field"><label for="notes">Anything I should know?</label><textarea id="notes" rows="3" placeholder="e.g. best days for delivery, what you\'ll use it for, your old computer\'s make">' + esc(d.notes || "") + "</textarea></div></div>";
    var methods = payMethods(t);
    var first = methods.filter(function (x) { return !x[2]; })[0][0];
    var sel = methods.some(function (x) { return x[0] === d.pm && !x[2]; }) ? d.pm : first;
    h += "<fieldset><legend>How would you like to pay?</legend>" + methods.map(function (m) { return '<label class="opt"><input type="radio" name="pm" value="' + m[0] + '"' + (sel === m[0] ? " checked" : "") + (m[2] ? " disabled" : "") + '><span class="t">' + m[1] + "</span></label>"; }).join("") +
      '<p class="hint" style="margin:8px 0 0">Payment details are shown after you place your order. Please send me a screenshot once you\'ve paid.</p></fieldset>';
    h += '<div class="note">I confirm stock with my supplier before ordering. If something has sold out, I\'ll offer you an equivalent replacement or a full refund.</div>';
    h += '<p><button class="btn" id="place">Place order</button></p><div class="status" id="coStatus" role="status"></div></form>';
    h += summaryHtml(lines, t) + "</div></div></div>" + guarantee();
    app.innerHTML = h;
    document.getElementById("co").onsubmit = function (e) { e.preventDefault(); placeOrder(lines, t); };
  }
  function field(id, label, type, val, ac, req, hint) {
    return '<div class="field"><label for="' + id + '">' + label + (req ? " *" : "") + '</label><input id="' + id + '" type="' + type + '" autocomplete="' + ac + '" value="' + esc(val || "") + '"' + (req ? " required" : "") + ">" + (hint ? '<div class="hint">' + hint + "</div>" : "") + "</div>";
  }
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
  // Send the order to Tony's Tech Automation inbound webhook. Flat fields make it easy to use in the workflow.
  function flatOrder(o) {
    return {
      ref: o.ref, name: o.customer.name, first_name: o.customer.name.split(" ")[0], phone: o.customer.phone, email: o.customer.email || "",
      address: fullAddr(o), total: money(o.total) + (o.deliveryToConfirm ? " + delivery TBC" : ""), payment: PM_NAMES[o.customer.pm] || o.customer.pm,
      items: o.items.map(function (i) { return i.qty + " x " + i.name + " [" + i.part + "]"; }).join("; "),
      summary: o.summary, source: "shop.tonystechsupport.com.au"
    };
  }
  function sendOrder(url, o) { return postFlat(url, flatOrder(o)); }
  function postFlat(url, flat) {
    var timeout = new Promise(function (_, rej) { setTimeout(function () { rej(new Error("timeout")); }, 10000); });
    var cors = fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(flat) })
      .then(function (r) { if (!r.ok) throw new Error("status " + r.status); });
    return Promise.race([cors, timeout]).catch(function () {
      // Some webhook services don't allow cross-site JSON; a plain form post always gets through.
      return fetch(url, { method: "POST", mode: "no-cors", body: new URLSearchParams(flat) });
    });
  }
  function placeOrder(lines, t) {
    var st = document.getElementById("coStatus");
    var cust = { name: val("name"), phone: val("phone"), email: val("email"), addr: val("addr"), notes: val("notes"), pm: (document.querySelector("input[name=pm]:checked") || {}).value };
    if (!cust.name || !/\d{8,}/.test(cust.phone.replace(/\D/g, ""))) { st.className = "status err"; st.textContent = "Please enter your name and a mobile number so I can contact you."; return; }
    save("tts-cust", cust);
    var now = new Date(), ref = "TTS-" + String(now.getFullYear()).slice(2) + ("0" + (now.getMonth() + 1)).slice(-2) + ("0" + now.getDate()).slice(-2) + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    var order = {
      ref: ref, placed: now.toISOString(), customer: cust,
      items: lines.map(function (x) { return { part: x.p.id, name: x.p.n, qty: x.q, price: x.p.p, supplier: x.p.k }; }),
      extras: t.rows.map(function (r) { return { item: r[0], price: r[1] }; }),
      options: { suburb: opts.suburb, roundTripKm: opts.calloutKm, delivery: opts.migration === "onsite" ? "onsite-migration" : opts.delivery, extraHours: opts.extraHours,
        freeApps: CFG.services.freeApps.filter(function (a) { return opts.apps[a.id]; }).map(function (a) { return a.name; }), browser: opts.browser, emailApp: opts.emailApp, migration: opts.migration },
      total: t.total, deliveryToConfirm: t.tbc
    };
    order.summary = orderText(order);
    var btn = document.getElementById("place"); btn.disabled = true; st.className = "status"; st.textContent = "Sending your order…";
    var send = CFG.orders.webhookUrl ? sendOrder(CFG.orders.webhookUrl, order) : Promise.reject(new Error("no webhook"));
    send.then(function () { done(true); }, function () { done(false); });
    function done(sent) {
      save("tts-last-order", order);
      if (cust.pm === "card" && CFG.payments.stripeWorker && !t.tbc) {
        st.textContent = "Taking you to secure card payment…";
        fetch(CFG.payments.stripeWorker.replace(/\/$/, "") + "/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(order) })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (!j.url) throw new Error(j.error || "no url");
            cart = []; opts.extraHours = 0; persist();
            location.href = j.url;
          })
          .catch(function (e) {
            btn.disabled = false; st.className = "status err";
            st.textContent = "Sorry, card payment isn't available right now (" + e.message + "). Please choose another way to pay; your order details are saved.";
          });
        return;
      }
      cart = []; opts.extraHours = 0; persist();
      viewConfirm(order, sent);
    }
  }
  function fullAddr(o) {
    var a = (o.customer.addr || "").trim(), sub = (o.options.suburb || "").trim();
    if (!a) return sub;
    if (!sub || a.toLowerCase().indexOf(sub.split(" ")[0].toLowerCase()) >= 0) return a;
    return a + ", " + sub;
  }
  function orderText(o) {
    var L = ["New shop order " + o.ref, o.customer.name + " " + o.customer.phone + (o.customer.email ? " " + o.customer.email : ""), fullAddr(o)];
    o.items.forEach(function (i) { L.push(i.qty + " x " + i.name + " [" + i.part + "] " + money(i.price * i.qty) + " (supplier " + i.supplier + ")"); });
    o.extras.forEach(function (e) { L.push(e.item + ": " + (typeof e.price === "number" ? money(e.price) : e.price)); });
    if (o.options.freeApps.length) L.push("Apps: " + o.options.freeApps.join(", "));
    if (o.options.browser) L.push("Browser: " + o.options.browser);
    if (o.options.emailApp) L.push("Email app: " + o.options.emailApp);
    L.push("Total: " + money(o.total) + (o.deliveryToConfirm ? " + delivery TBC" : ""));
    L.push("Payment: " + (PM_NAMES[o.customer.pm] || o.customer.pm));
    if (o.customer.notes) L.push("Notes: " + o.customer.notes);
    return L.join("\n");
  }
  function viewConfirm(o, sent) {
    var pay = CFG.payments, first = esc(o.customer.name.split(" ")[0]), pm = o.customer.pm, tbc = o.deliveryToConfirm;
    var placed = new Date(o.placed);
    var h = '<div class="panel" style="margin-top:24px">';
    h += '<div class="steps"><span class="on">1. Order placed</span><span>2. Stock confirmed</span><span>3. Payment</span><span>4. Delivery or setup</span></div>';
    if (sent) {
      h += "<h2>Thanks, " + first + "! Your order is in.</h2><p>I'll text you on " + esc(o.customer.phone) + " to confirm stock, usually within one business day.</p>";
    } else {
      var smsBody = encodeURIComponent(o.summary);
      h += "<h2>Almost done, " + first + ". Please send your order to me.</h2><p>Tap the button below to send your order details straight to my phone. Your message app will open with everything filled in, so you just press send.</p>";
      h += '<div class="bigactions"><a class="btn" href="' + esc(CFG.site.smsHref) + "?&body=" + smsBody + '">Text my order to Tony</a><a class="btn ghost" href="mailto:' + esc(CFG.site.email) + "?subject=" + encodeURIComponent("Shop order " + o.ref) + "&body=" + smsBody + '">Email it instead</a></div>';
    }
    // receipt
    h += '<h3 style="margin-top:20px">Order ' + esc(o.ref) + '</h3><p class="hint">Placed ' + placed.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + "</p>";
    h += '<table class="receipt">';
    o.items.forEach(function (i) { h += "<tr><td>" + esc(i.name) + (i.qty > 1 ? " × " + i.qty : "") + "</td><td>" + money(i.price * i.qty) + "</td></tr>"; });
    o.extras.forEach(function (e) { h += "<tr><td>" + esc(e.item) + "</td><td>" + (typeof e.price === "number" ? (e.price ? money(e.price) : "Free") : "To be confirmed") + "</td></tr>"; });
    h += '<tr class="total"><td>Total' + (tbc ? " (plus delivery, to be confirmed)" : "") + "</td><td>" + money(o.total) + "</td></tr></table>";
    var addr = fullAddr(o);
    h += '<p class="hint">' + esc(o.customer.name) + " · " + esc(o.customer.phone) + (addr ? " · " + esc(addr) : "") + "</p>";

    // payment
    h += '<div class="paybox" style="margin-top:18px"><h3>Payment: ' + esc(PM_NAMES[pm] || "") + "</h3>";
    var ref = "<dt>Reference</dt><dd>" + esc(o.ref) + "</dd>";
    var amt = "<dt>Amount</dt><dd>" + (tbc ? "I'll text you the final total first" : money(o.total)) + "</dd>";
    var holdNote = '<p class="hint">Your order is held until payment arrives. If a low-stock item sells out in the meantime, I\'ll offer an equivalent replacement or a full refund.</p>';
    if (o.paid) h += "<p>Thanks, your card payment of " + money(o.total) + " went through. Your receipt has been emailed to you.</p>";
    else if (pm === "card") h += "<p>Your card payment wasn't completed. I'll text you the final total and a payment link.</p>";
    else if (pm === "payid") h += "<dl><dt>PayID</dt><dd>" + esc(pay.payId) + "</dd>" + amt + ref + "</dl>" + (pay.nameNote ? '<p class="hint">' + esc(pay.nameNote) + "</p>" : "") + holdNote;
    else if (pm === "bank") h += "<dl><dt>Bank</dt><dd>" + esc(pay.bankName || "") + "</dd><dt>Account name</dt><dd>" + esc(pay.accountName) + "</dd><dt>BSB</dt><dd>" + esc(pay.bsb) + "</dd><dt>Account</dt><dd>" + esc(pay.accountNumber) + "</dd>" + amt + ref + "</dl>" + (pay.nameNote ? '<p class="hint">' + esc(pay.nameNote) + "</p>" : "") + holdNote;
    else if (pm === "zeller") h += "<p>Once I've confirmed stock, I'll text you a secure card payment link from Zeller. There's no card surcharge.</p>";
    else if (pm === "paypal") h += tbc ? "<p>I'll text you the final total, including delivery, before you pay. Then pay at <b>paypal.me/" + esc(pay.paypalMe) + "</b> with your order number " + esc(o.ref) + " in the note.</p>"
      : '<p><a class="btn" target="_blank" rel="noopener" href="https://www.paypal.com/paypalme/' + encodeURIComponent(pay.paypalMe) + "/" + o.total.toFixed(2) + 'AUD">Pay ' + money(o.total) + ' with PayPal</a></p><p class="hint">Please add your order number ' + esc(o.ref) + " in the note.</p>" + holdNote;
    else if (pm === "cash") h += "<p>Cash on delivery or setup, by arrangement. I'll confirm the exact amount when I text you.</p>";
    else h += "<p>I'll text you the payment options with your final total once I've confirmed stock.</p>";
    if (!o.paid && (pm === "payid" || pm === "bank" || pm === "paypal")) {
      h += '<p><b>Once you\'ve paid,</b> please send me a screenshot of the payment: <a href="' + esc(pay.screenshotSms || CFG.site.smsHref) + '">text it to ' + esc(pay.screenshotNumber || CFG.site.phone) + '</a> (this number can receive photos) or email it to <a href="mailto:' + esc(CFG.site.email) + '">' + esc(CFG.site.email) + "</a>.</p>";
    }
    h += "</div>";

    h += "<h3 style=\"margin-top:20px\">What happens next</h3><ol><li>I'll confirm stock with my supplier and text you, usually within one business day.</li><li>Once your device arrives, I'll update it, set it up with the options you chose and charge it to 100%.</li><li>I'll text you to arrange delivery or setup at a time and place that suits you.</li><li>A week later, I'll check in to make sure everything's working well.</li></ol>";
    h += '<p class="noprint" style="margin-top:18px"><a class="btn ghost" href="/#/">Back to the shop</a> <button class="btn ghost" type="button" id="printInv">Print or save invoice (PDF)</button></p></div>' + guarantee();
    app.innerHTML = h;
    document.getElementById("printInv").onclick = function () { printDoc(o, "invoice"); };
    window.scrollTo(0, 0);
    if (location.pathname === "/" && location.hash.indexOf("#/paid") !== 0) location.hash = "#/done";
  }

  // ---------------------------------------------------------------- printer-friendly invoice / quote
  function printDoc(o, kind) {
    var s = CFG.site, pay = CFG.payments, quote = kind === "quote", placed = new Date(o.placed);
    var dt = placed.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
    var h = '<div class="pd-head"><div><img src="' + esc(s.logo) + '" alt="" width="64" height="64"><div><b>Tony\'s Tech Support</b><br>' + esc(s.address) + "<br>" + esc(s.phone) + " · " + esc(s.email) + "<br>ABN " + esc(s.abn) + "</div></div>" +
      '<div class="pd-title"><h1>' + (quote ? "Quote" : "Invoice") + "</h1><table><tr><td>" + (quote ? "Quote" : "Order") + " no.</td><td>" + esc(o.ref) + "</td></tr><tr><td>Date</td><td>" + dt + "</td></tr>" +
      (quote ? "<tr><td>Valid for</td><td>7 days, subject to stock</td></tr>" : "<tr><td>Status</td><td>" + (o.paid ? "Paid" : "Awaiting payment") + "</td></tr>") + "</table></div></div>";
    if (o.customer && o.customer.name) {
      var addr = fullAddr(o);
      h += '<div class="pd-to"><b>' + (quote ? "Prepared for" : "Bill to") + "</b><br>" + esc(o.customer.name) + (addr ? "<br>" + esc(addr) : "") + "<br>" + esc(o.customer.phone) + (o.customer.email ? "<br>" + esc(o.customer.email) : "") + "</div>";
    }
    h += '<table class="pd-items"><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>';
    o.items.forEach(function (i) { h += "<tr><td>" + esc(i.name) + '<br><small>Part no. ' + esc(i.part) + "</small></td><td>" + i.qty + "</td><td>" + money(i.price) + "</td><td>" + money(i.price * i.qty) + "</td></tr>"; });
    o.extras.forEach(function (e) { var n = typeof e.price === "number"; h += "<tr><td>" + esc(e.item) + "</td><td>1</td><td>" + (n ? (e.price ? money(e.price) : "Free") : "TBC") + "</td><td>" + (n ? (e.price ? money(e.price) : "Free") : "To be confirmed") + "</td></tr>"; });
    h += "</tbody></table>";
    var gst = Math.round(o.total / 11 * 100) / 100;
    h += '<table class="pd-tot"><tr><td>Total (AUD, incl. GST)</td><td>' + money(o.total) + (o.deliveryToConfirm ? " + delivery" : "") + "</td></tr><tr><td>Includes GST of</td><td>" + money(gst) + "</td></tr></table>";
    if (o.options && (o.options.freeApps.length || o.options.browser || o.options.emailApp)) {
      h += '<p class="pd-note"><b>Set up for you:</b> ' + esc(o.options.freeApps.concat(o.options.browser ? ["Default browser: " + o.options.browser] : []).concat(o.options.emailApp ? ["Email app: " + o.options.emailApp] : []).join(", ")) + "</p>";
    }
    if (!o.paid) {
      var p = [];
      if (pay.payId) p.push("PayID: " + pay.payId);
      if (pay.bsb) p.push("Bank transfer (" + (pay.bankName || "") + "): " + pay.accountName + ", BSB " + pay.bsb + ", Account " + pay.accountNumber);
      if (pay.zeller) p.push("Card: secure payment link sent by text (no surcharge)");
      if (pay.paypalMe) p.push("PayPal: paypal.me/" + pay.paypalMe);
      if (pay.cash) p.push("Cash: by arrangement");
      h += '<div class="pd-pay"><b>How to pay</b>' + (quote ? " (once I've confirmed stock)" : "") + "<ul>" + p.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul><small>Please use " + esc(o.ref) + " as the reference. " + esc(pay.nameNote || "") + "</small></div>";
    }
    h += '<p class="pd-foot">Thank you for supporting a local business. Every product is checked, set up and supported by Tony. If a low-stock item sells out, I\'ll offer an equivalent replacement or a full refund.<br>' + esc(s.url.replace(/^https?:\/\//, "")) + " · " + APP_VERSION + "</p>";
    var d = document.getElementById("printdoc");
    if (!d) { d = document.createElement("div"); d.id = "printdoc"; document.body.appendChild(d); }
    d.innerHTML = h;
    document.body.classList.add("printing");
    var done = function () { document.body.classList.remove("printing"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    var img = d.querySelector("img");
    var go = function () { window.print(); setTimeout(done, 1000); };
    if (img && !img.complete) { img.onload = img.onerror = go; setTimeout(function () { if (document.body.classList.contains("printing")) go(); }, 1500); } else go();
  }
  function cartAsQuote(lines, t) {
    var d = load("tts-cust", {}), now = new Date();
    return {
      ref: "Q-" + String(now.getFullYear()).slice(2) + ("0" + (now.getMonth() + 1)).slice(-2) + ("0" + now.getDate()).slice(-2) + "-" + Math.random().toString(36).slice(2, 5).toUpperCase(),
      placed: now.toISOString(), customer: { name: d.name || "", phone: d.phone || "", email: d.email || "", addr: d.addr || "" },
      items: lines.map(function (x) { return { part: x.p.id, name: x.p.n, qty: x.q, price: x.p.p }; }),
      extras: t.rows.map(function (r) { return { item: r[0], price: r[1] }; }),
      options: { suburb: opts.suburb, freeApps: CFG.services.freeApps.filter(function (a) { return opts.apps[a.id]; }).map(function (a) { return a.name; }), browser: opts.browser, emailApp: opts.emailApp },
      total: t.total, deliveryToConfirm: t.tbc
    };
  }

  // ---------------------------------------------------------------- router
  function render() {
    var h = location.hash.replace(/^#/, "") || "/";
    var parts = h.split("/").filter(Boolean);
    syncSearch(parts[0] === "s" ? decodeURIComponent(parts.slice(1).join("/")) : "");
    if (parts[0] === "done") { var o = load("tts-last-order", null); if (o && app.querySelector(".paybox")) return; if (o) { viewConfirm(o, true); return; } }
    if (parts[0] === "paid") { var po = load("tts-last-order", null); if (po) { po.paid = true; viewConfirm(po, true); } else viewHome(); return; }
    if (parts[0] === "picker") { viewPicker(); return; }
    if (parts[0] === "compare") { viewCompare(); return; }
    if (parts[0] === "u") { save("tts-use", parts[1] || ""); viewHome(); return; }
    if (!parts.length && window.TTS_PRODUCT) { viewProduct(window.TTS_PRODUCT); return; }
    if (window.TTS_VIEW === "picker" && (!parts.length || /^a=/.test(parts[0]))) { viewPicker(); return; }
    if (!parts.length && window.TTS_VIEW === "gone") { viewProduct("__gone__"); return; }
    if (parts[0] === "p") viewProduct(decodeURIComponent(parts[1] || ""));
    else if (parts[0] === "c") viewHome(parts[1]);
    else if (parts[0] === "s") viewHome(null, decodeURIComponent(parts.slice(1).join("/")));
    else if (parts[0] === "all") viewHome(null, null, true);
    else if (parts[0] === "cart") viewCart();
    else if (parts[0] === "checkout") viewCheckout();
    else viewHome();
  }
  var lastRoute = "";
  window.addEventListener("hashchange", function () {
    var route = location.hash.split("/").slice(0, 2).join("/");
    render(); cmpBar();
    if (route !== lastRoute) { window.scrollTo(0, 0); app.focus({ preventScroll: true }); }
    lastRoute = route;
  });

  // ---------------------------------------------------------------- start
  Promise.all([fetch("/data/products.json").then(function (r) { return r.json(); }), fetch("/data/config.json").then(function (r) { return r.json(); })])
    .then(function (res) {
      P = res[0]; CFG = res[1];
      P.forEach(function (p) { BYID[p.id] = p; });
      cart = cart.filter(function (l) { return BYID[l.id]; });
      var s = CFG.site;
      document.getElementById("logo").src = s.logo;
      document.getElementById("fAddr").textContent = s.address;
      document.getElementById("fHours").textContent = s.hours;
      var fp = document.getElementById("fPhone"); fp.textContent = s.phone; fp.href = s.phoneHref;
      var fe = document.getElementById("fEmail"); fe.textContent = s.email; fe.href = "mailto:" + s.email;
      document.getElementById("fAbn").textContent = s.abn;
      document.getElementById("fUpdated").textContent = "Prices and stock updated " + CFG.updated + ".";
      var fv = document.getElementById("fVer"); if (fv) fv.textContent = APP_VERSION;
      setupHeader(); persist(); render(); cmpBar();
    })
    .catch(function () { app.innerHTML = '<div class="empty" style="margin-top:30px"><h2>The shop is being updated</h2><p>Please try again in a few minutes, or call Tony.</p></div>'; });
})();
