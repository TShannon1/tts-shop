/**
 * Tony's Tech Support Shop – card payments (Cloudflare Worker + Stripe Checkout).
 *
 * The shop sends the order here. This worker re-checks every product price against the live
 * shop data (so nobody can change prices in their browser), creates a Stripe Checkout page,
 * and sends the customer there. Stripe emails the receipt.
 *
 * Settings (Cloudflare dashboard → Worker → Settings → Variables and Secrets):
 *   STRIPE_SECRET_KEY      secret   sk_live_… (or sk_test_… while testing)
 *   SHOP_URL               text     https://shop.tonystechsupport.com.au
 *   STRIPE_WEBHOOK_SECRET  secret   whsec_… (optional, for "payment received" texts)
 *   NOTIFY_WEBHOOK         text     your Tech Automation inbound webhook URL (optional)
 */
const MAX_EXTRA = 1500;   // largest single service charge accepted from the cart (AUD)
const MAX_QTY = 10;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": env.SHOP_URL,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    try {
      if (url.pathname === "/checkout" && request.method === "POST") {
        const out = await createCheckout(await request.json(), env);
        return json(out, 200, cors);
      }
      if (url.pathname === "/webhook" && request.method === "POST") {
        return await stripeWebhook(request, env);
      }
      return json({ error: "not found" }, 404, cors);
    } catch (e) {
      return json({ error: String(e.message || e) }, 400, cors);
    }
  },
};

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

async function createCheckout(order, env) {
  if (!order || !Array.isArray(order.items) || !order.items.length) throw new Error("empty order");
  if (order.deliveryToConfirm) throw new Error("delivery cost not worked out yet");
  const shop = env.SHOP_URL.replace(/\/$/, "");
  const res = await fetch(shop + "/data/products.json", { cf: { cacheTtl: 300 } });
  if (!res.ok) throw new Error("could not load shop prices");
  const catalogue = new Map((await res.json()).map((p) => [p.id, p]));
  const cfgRes = await fetch(shop + "/data/config.json", { cf: { cacheTtl: 300 } });
  const mb = cfgRes.ok ? ((await cfgRes.json()).multiBuy || {}) : {};
  const tiers = Array.isArray(mb.tiers) ? mb.tiers : [];
  const minItem = Number(mb.minItemPrice || 0);

  // Same multi-buy maths as the shop: count qualifying items, pick the tier, never past a product's own limit.
  const items = [];
  let count = 0;
  for (const it of order.items) {
    const p = catalogue.get(String(it.part));
    const qty = Math.floor(Number(it.qty));
    if (!p) throw new Error("item no longer available: " + it.part);
    if (!(qty >= 1 && qty <= MAX_QTY)) throw new Error("bad quantity");
    items.push({ p, qty });
    if (p.p >= minItem) count += qty;
  }
  let pct = 0;
  for (const t of tiers) if (count >= t.items && t.pct > pct) pct = t.pct;

  const lines = [];
  let total = 0;
  for (const { p, qty } of items) {
    const ip = pct && p.p >= minItem ? Math.min(pct, p.md == null ? pct : p.md) : 0;
    const unit = p.p - Math.floor((p.p * ip) / 100);
    lines.push({ name: (p.n + (ip ? ` (${ip}% multi-buy)` : "")).slice(0, 250), amount: Math.round(unit * 100), qty });
    total += unit * qty;
  }
  for (const ex of order.extras || []) {
    const price = Number(ex.price);
    if (typeof ex.price !== "number" || price === 0) continue; // free items and "to be confirmed"
    if (/multi-buy discount/i.test(String(ex.item)) && price < 0) continue; // already applied to the item prices above
    if (!(price > 0 && price <= MAX_EXTRA)) throw new Error("bad service price");
    lines.push({ name: String(ex.item).slice(0, 250), amount: Math.round(price * 100), qty: 1 });
    total += price;
  }
  if (Math.abs(total - Number(order.total)) > 0.5) throw new Error("prices have changed, please refresh the shop");

  const ref = String(order.ref || "").replace(/[^A-Z0-9-]/gi, "").slice(0, 40);
  const f = new URLSearchParams();
  f.set("mode", "payment");
  f.set("currency", "aud");
  f.set("client_reference_id", ref);
  f.set("success_url", shop + "/#/paid");
  f.set("cancel_url", shop + "/#/checkout");
  f.set("payment_intent_data[description]", "Tony's Tech Support order " + ref);
  f.set("metadata[ref]", ref);
  f.set("metadata[phone]", String(order.customer?.phone || "").slice(0, 30));
  f.set("metadata[name]", String(order.customer?.name || "").slice(0, 80));
  if (order.customer?.email && /.+@.+\..+/.test(order.customer.email)) f.set("customer_email", order.customer.email);
  lines.forEach((l, i) => {
    f.set(`line_items[${i}][quantity]`, String(l.qty));
    f.set(`line_items[${i}][price_data][currency]`, "aud");
    f.set(`line_items[${i}][price_data][unit_amount]`, String(l.amount));
    f.set(`line_items[${i}][price_data][product_data][name]`, l.name);
  });
  const s = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: "Bearer " + env.STRIPE_SECRET_KEY, "Content-Type": "application/x-www-form-urlencoded" },
    body: f.toString(),
  });
  const body = await s.json();
  if (!s.ok) throw new Error(body.error?.message || "Stripe error");
  return { url: body.url };
}

// Optional: when Stripe confirms payment, text Tony through Tech Automation.
async function stripeWebhook(request, env) {
  const raw = await request.text();
  if (!env.STRIPE_WEBHOOK_SECRET) return new Response("webhook secret not set", { status: 400 });
  const sig = request.headers.get("Stripe-Signature") || "";
  const parts = Object.fromEntries(sig.split(",").map((kv) => kv.split("=")));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(parts.t + "." + raw));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (!parts.v1 || hex !== parts.v1 || Math.abs(Date.now() / 1000 - Number(parts.t)) > 600) return new Response("bad signature", { status: 400 });
  const event = JSON.parse(raw);
  if (event.type === "checkout.session.completed" && env.NOTIFY_WEBHOOK) {
    const s = event.data.object;
    const summary = `PAID by card: shop order ${s.client_reference_id} – $${(s.amount_total / 100).toFixed(2)} – ${s.metadata?.name || ""} ${s.metadata?.phone || ""}`;
    await fetch(env.NOTIFY_WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref: s.client_reference_id, paid: true, amount: s.amount_total / 100, summary }) });
  }
  return new Response("ok");
}
