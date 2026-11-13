/* Tony's Tech Support Shop – front end. Plain JavaScript, no build step. */
(function () {
  "use strict";
  var P = [], CFG = null, BYID = {};
  var app = document.getElementById("app");
  var COMPUTER_CATS = { laptops: 1, desktops: 1 };
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
  function money(n) { return "$" + Number(n).toLocaleString("en-AU", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
  function catName(id) { var c = (CFG.categories || []).filter(function (x) { return x.id === id; })[0]; return c ? c.name : id; }
  function ICON(cat) {
    var paths = {
      laptops: '<rect x="12" y="12" width="40" height="26" rx="2"/><path d="M6 46h52l-4-6H10z"/>',
      desktops: '<rect x="8" y="10" width="48" height="32" rx="2"/><path d="M26 42v8M38 42v8M20 52h24"/>',
      tablets: '<rect x="16" y="6" width="32" height="52" rx="4"/><circle cx="32" cy="51" r="2"/>',
      monitors: '<rect x="6" y="10" width="52" height="32" rx="2"/><path d="M32 42v8M22 52h20"/>',
      backup: '<rect x="12" y="8" width="40" height="48" rx="4"/><circle cx="32" cy="28" r="10"/><circle cx="32" cy="28" r="2"/><path d="M20 48h8"/>',
      printers: '<path d="M18 22V8h28v14"/><rect x="8" y="22" width="48" height="20" rx="2"/><path d="M18 36h28v20H18z"/>',
      networking: '<path d="M10 26a32 32 0 0 1 44 0M17 33a22 22 0 0 1 30 0M24 40a12 12 0 0 1 16 0"/><circle cx="32" cy="48" r="3"/>',
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
      '<div class="panel"><h3>Quality anyone can afford</h3><p>Every product in this shop is brand new, sourced from major Australian IT distributors, and backed by the full manufacturer\'s warranty. Before it reaches you, I check it, update it and set it up.</p></div>' +
      '<div class="panel"><h3>Twelve-month warranty</h3><p>All products come with a minimum twelve-month warranty. This is in addition to, and does not affect, your rights under the Australian Consumer Law, including any rights or remedies you may have for faulty items. If a defect appears within twelve months of receiving your product, you\'ll be given a replacement or a refund.</p></div>' +
      '<div class="panel"><h3>Personal support</h3><p>You deal with me, not a call centre. I handle warranty claims for you, and I check in a week after delivery to make sure everything\'s working.</p></div>' +
      "</div><h3>Frequently asked questions</h3>" +
      faq("What is the Tony's Tech Support guarantee?", "I only list brand-new products from established Australian IT distributors that I hold reseller accounts with. Every device is checked and set up by me before it's handed over, and I look after any warranty claims for you.") +
      faq("What will I receive?", "A brand-new product in its original packaging with all the accessories it comes with from the manufacturer. Computers are updated, set up with the free apps you choose, and charged to 100% before handover.") +
      faq("What condition will a refurbished device be in?", "Everything in this shop is brand new. If I quote you a refurbished device separately, it will be restored to factory settings and graded: A grade (Excellent) shows no signs of cosmetic damage when held 30cm away; B grade (Good) has light scratches, barely visible when held 30cm away; C grade (Acceptable) has scratches visible when held 30cm away that you can feel. I'll tell you the battery health on the quote, and accessories may be compatible rather than original.") +
      faq("What if the item sells out before I order?", "Stock and prices are updated every day, and I confirm stock with my supplier before ordering. If your item has sold out, I'll offer you an equivalent replacement or a full refund.") +
      faq("What if I'm not satisfied with the product I receive?", "I want you to be delighted with your purchase. Products come with a minimum twelve-month warranty, in addition to your rights under the Australian Consumer Law. If any defect arises within twelve months of receipt, you'll be given a replacement or refund. Just call or text me.") +
      faq("How does delivery work?", "My standard delivery uses Uber Courier. Once your product is ready to go, you'll get a text from me, and we'll choose the best place and time so you receive it where and when you want it. That way no expensive devices are left on a porch or next to a mailbox. Or I can deliver it in person and set it up with you.") +
      faq("Can I buy it somewhere else?", "Of course. People expect to pay a little more with a sole trader, and there are no hard feelings if you buy from another shop. I'm still happy to set it up and help you with it.") +
      "</section>";
  }
  function faq(q, a) { return "<details><summary>" + esc(q) + "</summary><p>" + esc(a) + "</p></details>"; }

  // ---------------------------------------------------------------- views
  function viewHome(cat, query) {
    var list = P.filter(function (p) { return !cat || p.c === cat; });
    var useF = load("tts-use", ""), perthF = load("tts-perth", false);
    if (useF) list = list.filter(function (p) { return (p.u || []).indexOf(useF) >= 0; });
    if (perthF) list = list.filter(function (p) { return p.pe; });
    if (query) {
      var words = query.toLowerCase().split(/\s+/).filter(Boolean);
      list = list.filter(function (p) { var t = (p.n + " " + p.b + " " + p.sp.join(" ") + " " + catName(p.c)).toLowerCase(); return words.every(function (w) { return t.indexOf(w) >= 0; }); });
    }
    var sort = load("tts-sort", "low");
    list.sort(function (a, b) { return sort === "high" ? b.p - a.p : sort === "name" ? a.n.localeCompare(b.n) : a.p - b.p; });
    var counts = {}; P.forEach(function (p) { counts[p.c] = (counts[p.c] || 0) + 1; });
    var h = "";
    if (!cat && !query) {
      h += '<section class="hero"><h1>Tech that\'s ready to use</h1><p class="lead">Brand-new laptops, computers, monitors, printers and backup drives, checked, set up and delivered by Tony. Not sure what you need? <a href="' + esc(CFG.site.smsHref) + '">Send me a text</a> or <a href="' + esc(CFG.site.phoneHref) + '">give me a call</a> and I\'ll help you choose.</p>' + searchBox("") + "</section>";
    } else {
      h += '<div class="crumbs"><a href="/#/">Shop</a> › ' + esc(cat ? catName(cat) : 'Search results for "' + query + '"') + "</div>";
      h += "<h2>" + esc(cat ? catName(cat) : "Search results") + "</h2>" + searchBox(query || "");
    }
    h += '<nav class="cats" aria-label="Categories">' + CFG.categories.filter(function (c) { return counts[c.id]; }).map(function (c) {
      return '<a class="cat' + (c.id === cat ? " on" : "") + '" href="/#/c/' + c.id + '">' + ICON(c.id) + "<b>" + esc(c.name) + "</b><small>" + counts[c.id] + " available</small></a>";
    }).join("") + "</nav>";
    var home = !cat && !query && !useF && !perthF;
    if (!cat && !query) {
      h += '<div class="panel" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;justify-content:space-between"><div><h2 style="margin:0">Not sure which computer to get?</h2><p style="margin:.3em 0 0">Answer three quick questions and I\'ll show you the best options for your budget.</p></div><a class="btn" href="/picker.html">Help me choose</a></div>';
    }
    if (home) {
      h += '<div class="panel"><h2>Why buy from Tony?</h2>' + supportList() + "</div>" + elsewhereNote();
      h += "<h2>Popular picks</h2>";
      list = pickPopular();
    }
    h += '<div class="toolbar"><span>' + list.length + ' products</span><label class="sr" for="use">Use</label><select id="use"><option value="">Any use</option>' + USES.map(function (u) { return '<option value="' + u[0] + '"' + (useF === u[0] ? " selected" : "") + ">" + esc(u[1]) + "</option>"; }).join("") + '</select><label class="sr" for="sort">Sort</label><select id="sort"><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="name">Name</option></select><label class="opt" style="border:0;padding:0"><input type="checkbox" id="perthOnly"' + (perthF ? " checked" : "") + '><span class="t">In stock in Perth only</span></label></div>';
    if (useF) h += '<p class="hint">Showing laptops and desktops suited to: ' + esc(useName(useF)) + '. Other products are hidden while this filter is on.</p>';
    if (!list.length) h += '<div class="empty">Nothing matches that right now. Try another search, or <a href="' + esc(CFG.site.smsHref) + '">text Tony</a> and I\'ll find it for you.</div>';
    h += '<div class="grid" id="grid"></div><p style="text-align:center;margin:18px 0"><button class="btn ghost" id="more" hidden>Show more</button></p>';
    app.innerHTML = h;
    var s = document.getElementById("sort"); s.value = sort;
    s.onchange = function () { save("tts-sort", s.value); render(); };
    document.getElementById("use").onchange = function (e) { save("tts-use", e.target.value); render(); };
    document.getElementById("perthOnly").onchange = function (e) { save("tts-perth", e.target.checked); render(); };
    bindSearch();
    var shown = 0, grid = document.getElementById("grid"), more = document.getElementById("more");
    function page() {
      grid.insertAdjacentHTML("beforeend", list.slice(shown, shown + PAGE).map(card).join(""));
      shown += PAGE; more.hidden = shown >= list.length;
    }
    more.onclick = page; page();
  }
  function pickPopular() {
    var out = [];
    ["laptops", "desktops", "monitors", "backup", "printers", "accessories"].forEach(function (c) {
      var l = P.filter(function (p) { return p.c === c; }).sort(function (a, b) { return a.p - b.p; });
      out = out.concat(l.slice(Math.floor(l.length / 4), Math.floor(l.length / 4) + 2));
    });
    return out;
  }
  function searchBox(v) {
    return '<form class="search" id="sf" role="search"><label class="sr" for="q">Search products</label><input id="q" type="search" placeholder="Search, e.g. 14 inch laptop, 2TB drive, printer" value="' + esc(v) + '"><button class="btn">Search</button></form>';
  }
  function bindSearch() {
    var f = document.getElementById("sf");
    if (f) f.onsubmit = function (e) { e.preventDefault(); var q = document.getElementById("q").value.trim(); go(q ? "#/s/" + encodeURIComponent(q) : "#/"); };
  }
  function card(p) {
    return '<a class="card" href="' + prodUrl(p) + '"><div class="pic">' + pic(p) + '</div><div class="body"><div class="name">' + esc(p.n) + "</div>" +
      (p.sp.length ? '<div class="chips">' + p.sp.slice(0, 3).map(function (s) { return '<span class="chip">' + esc(s) + "</span>"; }).join("") + "</div>" : "") +
      '<div class="price">' + money(p.p) + "</div>" + '<div class="hint">' + availText(p) + "</div>" + (p.low ? '<div class="low">Only a few left</div>' : "") + "</div></a>";
  }

  function viewProduct(id) {
    var p = BYID[id];
    if (!p) { app.innerHTML = '<div class="empty" style="margin-top:30px"><h2>That product has sold out</h2><p>Stock changes every day. <a href="/#/">See what\'s available</a>, or <a href="' + esc(CFG.site.smsHref) + '">text Tony</a> and I\'ll find you an equivalent.</p></div>' + guarantee(); return; }
    var h = '<div class="crumbs"><a href="/#/">Shop</a> › <a href="/#/c/' + p.c + '">' + esc(catName(p.c)) + "</a></div>";
    h += '<div class="prod"><div class="gallery">' + pic(p) + "</div><div>";
    h += "<h2>" + esc(p.n) + "</h2>";
    h += '<div class="price" style="font-size:2.2rem">' + money(p.p) + '</div><div class="hint">Includes GST. Delivery and setup options are in the cart.</div>';
    h += '<div class="meta">';
    if (p.sp.length) h += '<div class="chips">' + p.sp.map(function (s) { return '<span class="chip">' + esc(s) + "</span>"; }).join("") + "</div>";
    h += "<div><b>" + availText(p) + ".</b> Ready for you in about " + eta(p) + ".</div>";
    if (p.u && p.u.length) h += "<div><b>Good for:</b> " + p.u.map(useName).map(esc).join(", ") + "</div>";
    if (p.w) h += "<div><b>Manufacturer's warranty:</b> " + esc(p.w) + "</div>";
    if (p.low) h += '<div class="low">Only a few left. I\'ll confirm stock before ordering.</div>';
    h += '<div class="hint">Part number: ' + esc(p.id) + "</div></div>";
    h += '<p><button class="btn" id="add">Add to cart</button> <a class="btn ghost" href="' + esc(CFG.site.smsHref) + '">Text Tony a question</a></p>';
    h += "</div></div>";
    if (COMPUTER_CATS[p.c]) h += backupOffer();
    h += '<div class="panel"><h3>What you get when you buy from Tony</h3>' + supportList() + "</div>";
    if (p.d) h += '<div class="panel"><h3>Product details</h3><p class="desc">' + esc(p.d) + "</p></div>";
    h += elsewhereNote() + guarantee();
    app.innerHTML = h;
    document.getElementById("add").onclick = function () { addToCart(p.id, 1); go("#/cart"); };
    bindDriveButtons();
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

  // ---------------------------------------------------------------- "Help me choose" device picker
  var BUDGETS = [800, 1200, 1600, 2000, 2500, 3500, 0];
  function viewPicker() {
    var q = load("tts-pick", { uses: [], type: "any", budget: 1600, extras: [] });
    var h = '<div class="crumbs"><a href="/">Shop</a> › Help me choose</div><h1>Help me choose a computer</h1>' +
      '<p class="lead">Tell me what you\'ll use it for and how much you\'d like to spend, and I\'ll show you the best options in stock. Not sure about any of this? <a href="' + esc(CFG.site.smsHref) + '">Text me</a> and I\'ll help you pick.</p>';
    h += '<form id="pk"><fieldset><legend>1. What will you mostly use it for?</legend><p class="hint">Tick everything that applies.</p>';
    USES.slice(0, 5).forEach(function (u) { h += '<label class="opt"><input type="checkbox" name="use" value="' + u[0] + '"' + (q.uses.indexOf(u[0]) >= 0 ? " checked" : "") + '><span class="t">' + esc(u[1]) + "</span></label>"; });
    h += '</fieldset><fieldset><legend>2. What type of computer?</legend>';
    [["laptops", "A laptop I can carry around"], ["desktops", "A desktop or all-in-one that stays on the desk"], ["any", "Not sure, show me both"]].forEach(function (t) {
      h += '<label class="opt"><input type="radio" name="type" value="' + t[0] + '"' + (q.type === t[0] ? " checked" : "") + '><span class="t">' + esc(t[1]) + "</span></label>";
    });
    h += '</fieldset><fieldset><legend>3. What\'s your budget?</legend><div class="field"><label for="bud">Up to</label><select id="bud">' +
      BUDGETS.map(function (b) { return '<option value="' + b + '"' + (q.budget === b ? " selected" : "") + ">" + (b ? money(b) : "No set budget") + "</option>"; }).join("") + "</select></div></fieldset>";
    h += '<fieldset><legend>4. Anything else that matters?</legend>';
    [["portable", "Light and easy to carry (14\" or smaller)"], ["bigscreen", "A big screen"], ["tch", "A touchscreen"], ["perth", "Ready quickly (already in stock in Perth)"]].forEach(function (x) {
      h += '<label class="opt"><input type="checkbox" name="extra" value="' + x[0] + '"' + (q.extras.indexOf(x[0]) >= 0 ? " checked" : "") + '><span class="t">' + esc(x[1]) + "</span></label>";
    });
    h += '</fieldset><p><button class="btn">Show me my options</button></p></form><div id="pkres" aria-live="polite"></div>' + guarantee();
    app.innerHTML = h;
    var form = document.getElementById("pk");
    function read() {
      return {
        uses: [].map.call(form.querySelectorAll("input[name=use]:checked"), function (i) { return i.value; }),
        type: (form.querySelector("input[name=type]:checked") || { value: "any" }).value,
        budget: Number(document.getElementById("bud").value),
        extras: [].map.call(form.querySelectorAll("input[name=extra]:checked"), function (i) { return i.value; })
      };
    }
    form.onsubmit = function (e) { e.preventDefault(); q = read(); save("tts-pick", q); showPicks(q); document.getElementById("pkres").scrollIntoView({ behavior: "smooth" }); };
    if (q.uses.length) showPicks(q);
  }
  function power(p) { return (p.cpu || 1) * 2 + Math.min(p.ram || 8, 32) / 8 + Math.min(p.sto || 256, 2000) / 1000 + (p.gpu ? 2 : 0); }
  function pickMatches(q, strictExtras) {
    return P.filter(function (p) {
      if (!COMPUTER_CATS[p.c]) return false;
      if (q.type !== "any" && p.c !== q.type) return false;
      var u = p.u || [];
      if (!q.uses.every(function (x) { return u.indexOf(x) >= 0; })) return false;
      if (strictExtras) {
        if (q.extras.indexOf("portable") >= 0 && u.indexOf("portable") < 0) return false;
        if (q.extras.indexOf("bigscreen") >= 0 && u.indexOf("bigscreen") < 0) return false;
        if (q.extras.indexOf("tch") >= 0 && !p.tch) return false;
        if (q.extras.indexOf("perth") >= 0 && !p.pe) return false;
      }
      return true;
    });
  }
  function showPicks(q) {
    var box = document.getElementById("pkres");
    if (!q.uses.length) { box.innerHTML = '<div class="note">Please tick at least one thing you\'ll use it for.</div>'; return; }
    var all = pickMatches(q, true), relaxed = false;
    var within = all.filter(function (p) { return !q.budget || p.p <= q.budget; });
    if (within.length < 3 && q.extras.length) { all = pickMatches(q, false); within = all.filter(function (p) { return !q.budget || p.p <= q.budget; }); relaxed = true; }
    within.sort(function (a, b) { return power(b) - power(a) || a.p - b.p; });
    var picks = within.slice(0, 6);
    var cheapest = within.slice().sort(function (a, b) { return a.p - b.p; })[0];
    if (cheapest && picks.indexOf(cheapest) < 0) picks[picks.length - 1] = cheapest;
    var h = '<h2 style="margin-top:28px">Your best options</h2>';
    h += '<div class="note"><b>Tony\'s tip:</b> ' + esc(tipFor(q)) + "</div>";
    if (relaxed) h += '<p class="hint">Nothing ticked every box, so I\'ve relaxed the "anything else" options.</p>';
    if (!picks.length) {
      var over = all.sort(function (a, b) { return a.p - b.p; }).slice(0, 3);
      h += '<div class="empty">Nothing in stock right now fits that budget for those uses.' + (over.length ? " Here are the closest options just above it." : "") + ' Or <a href="' + esc(CFG.site.smsHref) + '">text Tony</a>, and I\'ll find something that suits.</div>';
      picks = over;
    }
    h += '<div class="grid">' + picks.map(function (p) {
      var badge = p === cheapest ? "Lowest price" : p === picks[0] ? "Most powerful in your budget" : "";
      return card(p).replace('<div class="body">', '<div class="body">' + (badge ? '<span class="chip" style="background:var(--accent);color:#fff;align-self:flex-start">' + badge + "</span>" : ""));
    }).join("") + "</div>";
    if (within.length > picks.length) h += '<p><a class="btn ghost" href="/#/u/' + q.uses[q.uses.length - 1] + '">See all ' + within.length + " matches</a></p>";
    box.innerHTML = h;
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
    t.total = t.items; t.rows.forEach(function (r) { if (typeof r[1] === "number") t.total += r[1]; });
    return t;
  }
  function summaryHtml(lines, t) {
    var h = '<div class="panel summary"><div class="sticky"><h3>Order summary</h3>';
    lines.forEach(function (x) { h += '<div class="row"><span>' + esc(x.p.n) + (x.q > 1 ? " × " + x.q : "") + "</span><span>" + money(x.p.p * x.q) + "</span></div>"; });
    t.rows.forEach(function (r) { h += '<div class="row"><span>' + esc(r[0]) + "</span><span>" + (typeof r[1] === "number" ? (r[1] ? money(r[1]) : "Free") : esc(r[1])) + "</span></div>"; });
    h += '<div class="row total"><span>Total</span><span>' + money(t.total) + (t.tbc ? " + delivery" : "") + "</span></div>";
    h += '<p class="hint">Prices in Australian dollars, including GST.' + (t.tbc ? " Enter your suburb to work out delivery, or I'll confirm it by text." : "") + "</p>";
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
    h += '<div class="field"><label for="sub">Your suburb or postcode</label><div class="calc"><input id="sub" autocomplete="address-level2" placeholder="e.g. Midland, 6056" value="' + esc(opts.suburb) + '"><button class="btn small" id="calcBtn" type="button">Work out cost</button></div><div class="status" id="calcStatus" role="status">' + (opts.callout != null ? "Based on " + esc(opts.suburb) + "." : "") + "</div></div>";
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
    h += "</div>" + summaryHtml(lines, totals(lines)) + "</div></div></div>" + guarantee();
    app.innerHTML = h;
    bindCart();
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
    document.getElementById("calcBtn").onclick = function () { calcCallout(sub.value.trim()); };
    sub.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); calcCallout(sub.value.trim()); } };
    bindDriveButtons();
  }

  // ---------------------------------------------------------------- callout fee (same rules as Tony's calculator)
  var mapsLoading = null;
  function loadMaps() {
    if (window.google && google.maps && google.maps.DistanceMatrixService) return Promise.resolve();
    if (mapsLoading) return mapsLoading;
    mapsLoading = new Promise(function (res, rej) {
      if (!CFG.callout.googleMapsKey) return rej(new Error("no key"));
      window.__mapsReady = res;
      var s = document.createElement("script");
      s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(CFG.callout.googleMapsKey) + "&callback=__mapsReady";
      s.async = true; s.onerror = function () { rej(new Error("maps failed")); };
      document.head.appendChild(s);
      setTimeout(function () { rej(new Error("timeout")); }, 12000);
    });
    return mapsLoading;
  }
  function calloutFee(roundTripKm) {
    var c = CFG.callout;
    if (roundTripKm <= c.freeDistanceKm) return 0;
    return Math.max(c.minFee, Math.ceil(roundTripKm * c.ratePerKm / c.roundTo) * c.roundTo);
  }
  function calcCallout(dest) {
    var st = document.getElementById("calcStatus");
    if (!dest) { st.className = "status err"; st.textContent = "Please enter your suburb or postcode."; return; }
    st.className = "status"; st.textContent = "Working it out…";
    var q = /\b(WA|western australia)\b/i.test(dest) ? dest : dest + " WA, Australia";
    loadMaps().then(function () {
      new google.maps.DistanceMatrixService().getDistanceMatrix({ origins: [CFG.callout.origin], destinations: [q], travelMode: google.maps.TravelMode.DRIVING, unitSystem: google.maps.UnitSystem.METRIC }, function (r, status) {
        var el = r && r.rows && r.rows[0] && r.rows[0].elements[0];
        if (status !== "OK" || !el || el.status !== "OK") { fail(); return; }
        var km = el.distance.value / 1000 * 2;
        opts.suburb = dest; opts.calloutKm = Math.round(km); opts.callout = calloutFee(km); persist(); render();
      });
    }).catch(fail);
    function fail() {
      opts.suburb = dest; opts.callout = null; persist();
      st.className = "status err";
      st.textContent = "Sorry, I couldn't work out the distance automatically. You can still order and I'll text you the delivery cost.";
    }
  }

  // ---------------------------------------------------------------- checkout
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
    var methods = [];
    if (pay.stripeWorker) methods.push(["card", "<b>Credit or debit card</b><br><span class=\"hint\">" + (t.tbc ? "To pay by card now, go back to the cart and enter your suburb so the delivery cost can be worked out." : "Secure card payment. You'll get an emailed receipt straight away.") + "</span>", t.tbc]);
    if (pay.paypalMe) methods.push(["paypal", "<b>PayPal or card through PayPal</b><br><span class=\"hint\">Fastest. Your order is confirmed as soon as payment arrives.</span>"]);
    if (pay.payId || pay.bsb) methods.push(["bank", "<b>PayID or bank transfer</b><br><span class=\"hint\">Your order is held until payment arrives. If a low-stock item sells out in the meantime, I'll offer an equivalent replacement or a full refund.</span>"]);
    methods.push(["text", "<b>Text me the payment details</b><br><span class=\"hint\">I'll confirm stock and the final total first, then text you how to pay.</span>"]);
    h += "<fieldset><legend>How would you like to pay?</legend>" + methods.map(function (m) { var first = methods.filter(function (x) { return !x[2]; })[0][0]; var sel = methods.some(function (x) { return x[0] === d.pm && !x[2]; }) ? d.pm : first; return '<label class="opt"><input type="radio" name="pm" value="' + m[0] + '"' + (sel === m[0] ? " checked" : "") + (m[2] ? " disabled" : "") + '><span class="t">' + m[1] + "</span></label>"; }).join("") + "</fieldset>";
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
    var send = CFG.orders.webhookUrl
      ? fetch(CFG.orders.webhookUrl, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify(order) })
      : Promise.reject(new Error("no webhook"));
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
  function orderText(o) {
    var L = ["New shop order " + o.ref, o.customer.name + " " + o.customer.phone + (o.customer.email ? " " + o.customer.email : ""), (o.customer.addr || "") + " " + (o.options.suburb || "")];
    o.items.forEach(function (i) { L.push(i.qty + " x " + i.name + " [" + i.part + "] " + money(i.price * i.qty) + " (supplier " + i.supplier + ")"); });
    o.extras.forEach(function (e) { L.push(e.item + ": " + (typeof e.price === "number" ? money(e.price) : e.price)); });
    if (o.options.freeApps.length) L.push("Apps: " + o.options.freeApps.join(", "));
    if (o.options.browser) L.push("Browser: " + o.options.browser);
    if (o.options.emailApp) L.push("Email app: " + o.options.emailApp);
    L.push("Total: " + money(o.total) + (o.deliveryToConfirm ? " + delivery TBC" : ""));
    L.push("Payment: " + o.customer.pm);
    if (o.customer.notes) L.push("Notes: " + o.customer.notes);
    return L.join("\n");
  }
  function viewConfirm(o, sent) {
    var pay = CFG.payments, h = '<div class="panel" style="margin-top:24px"><h2>Thanks, ' + esc(o.customer.name.split(" ")[0]) + '! Your order is in.</h2><p>Your order number is <b>' + esc(o.ref) + "</b>.</p>";
    if (!sent) {
      h += '<div class="note"><b>One more step:</b> please send your order to Tony so he receives it.<br><a class="btn small" href="mailto:' + esc(CFG.site.email) + "?subject=" + encodeURIComponent("Shop order " + o.ref) + "&body=" + encodeURIComponent(o.summary) + '">Email my order to Tony</a> <a class="btn small ghost" href="' + esc(CFG.site.smsHref) + "?&body=" + encodeURIComponent("Hi Tony, I've placed shop order " + o.ref + ".") + '">Text Tony</a></div>';
    }
    if (sent) h += '<p class="hint">If you haven\'t heard from me within one business day, please <a href="' + esc(CFG.site.smsHref) + '">text me</a> your order number.</p>';
    h += "<h3>What happens next</h3><ol><li>I'll confirm stock with my supplier and text you, usually within one business day.</li><li>Once your device arrives, I'll update it, set it up with the options you chose and charge it to 100%.</li><li>I'll text you to arrange delivery or setup at a time and place that suits you.</li><li>A week later, I'll check in to make sure everything's working well.</li></ol>";
    var amount = o.total.toFixed(2);
    if (o.paid) {
      h += '<div class="paybox"><h3>Payment received</h3><p>Thanks, your card payment of ' + money(o.total) + ' went through. Your receipt has been emailed to you.</p></div>';
    } else if (o.customer.pm === "card") {
      h += '<div class="paybox"><h3>Payment</h3><p>Your card payment wasn\'t completed. I\'ll text you the final total and a payment link.</p></div>';
    } else if (!o.deliveryToConfirm && o.customer.pm === "paypal" && pay.paypalMe) {
      h += '<div class="paybox"><h3>Pay with PayPal</h3><p>Total to pay: <b>' + money(o.total) + '</b></p><p><a class="btn" target="_blank" rel="noopener" href="https://www.paypal.com/paypalme/' + encodeURIComponent(pay.paypalMe) + "/" + amount + 'AUD">Pay ' + money(o.total) + " with PayPal</a></p><p class=\"hint\">Please add your order number " + esc(o.ref) + " in the note.</p></div>";
    } else if (!o.deliveryToConfirm && o.customer.pm === "bank" && (pay.payId || pay.bsb)) {
      h += '<div class="paybox"><h3>Pay by PayID or bank transfer</h3><dl><dt>Amount</dt><dd>' + money(o.total) + "</dd>" + (pay.payId ? "<dt>PayID</dt><dd>" + esc(pay.payId) + "</dd>" : "") + "<dt>Account name</dt><dd>" + esc(pay.accountName) + "</dd>" + (pay.bsb ? "<dt>BSB</dt><dd>" + esc(pay.bsb) + "</dd><dt>Account</dt><dd>" + esc(pay.accountNumber) + "</dd>" : "") + "<dt>Reference</dt><dd>" + esc(o.ref) + '</dd></dl><p class="hint">Your order is held until payment arrives. If a low-stock item sells out in the meantime, I\'ll offer an equivalent replacement or a full refund.</p></div>';
    } else {
      h += '<div class="paybox"><h3>Payment</h3><p>I\'ll text you the final total and how to pay once I\'ve confirmed stock' + (o.deliveryToConfirm ? " and your delivery cost" : "") + ".</p></div>";
    }
    h += '<p style="margin-top:18px"><a class="btn ghost" href="/#/">Back to the shop</a> <button class="btn ghost noprint" onclick="window.print()">Print this page</button></p></div>' + guarantee();
    app.innerHTML = h;
    if (location.pathname === "/" && location.hash.indexOf("#/paid") !== 0) location.hash = "#/done";
  }

  // ---------------------------------------------------------------- router
  function render() {
    var h = location.hash.replace(/^#/, "") || "/";
    var parts = h.split("/").filter(Boolean);
    if (parts[0] === "done") { var o = load("tts-last-order", null); if (o && app.querySelector(".paybox")) return; if (o) { viewConfirm(o, true); return; } }
    if (parts[0] === "paid") { var po = load("tts-last-order", null); if (po) { po.paid = true; viewConfirm(po, true); } else viewHome(); return; }
    if (parts[0] === "picker") { viewPicker(); return; }
    if (parts[0] === "u") { save("tts-use", parts[1] || ""); viewHome(); return; }
    if (!parts.length && window.TTS_PRODUCT) { viewProduct(window.TTS_PRODUCT); return; }
    if (!parts.length && window.TTS_VIEW === "picker") { viewPicker(); return; }
    if (!parts.length && window.TTS_VIEW === "gone") { viewProduct("__gone__"); return; }
    if (parts[0] === "p") viewProduct(decodeURIComponent(parts[1] || ""));
    else if (parts[0] === "c") viewHome(parts[1]);
    else if (parts[0] === "s") viewHome(null, decodeURIComponent(parts.slice(1).join("/")));
    else if (parts[0] === "cart") viewCart();
    else if (parts[0] === "checkout") viewCheckout();
    else viewHome();
  }
  var lastRoute = "";
  window.addEventListener("hashchange", function () {
    var route = location.hash.split("/").slice(0, 2).join("/");
    render();
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
      persist(); render();
    })
    .catch(function () { app.innerHTML = '<div class="empty" style="margin-top:30px"><h2>The shop is being updated</h2><p>Please try again in a few minutes, or call Tony.</p></div>'; });
})();
