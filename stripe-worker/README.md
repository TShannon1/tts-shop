# Card payments with Stripe (about 20 minutes, both accounts free)

Card payments need a tiny bit of server code, because Stripe's secret key must never be in the website itself. This folder is that code. It runs free on Cloudflare Workers (100,000 requests a day free).

What it does: the shop sends the order to the worker. The worker re-checks every product price against the live shop data (so nobody can lower a price in their browser), creates a secure Stripe payment page, and sends the customer there. Stripe emails the receipt, and the customer comes back to an "order paid" page.

Stripe's standard Australian card fee is about 1.7% + 30c for domestic cards (check stripe.com/au/pricing). It comes out of each payment, so you may want to factor it into your markup.

## 1. Stripe
1. Sign up at **stripe.com/au** with your business details (ABN, bank account for payouts).
2. Go to **Developers → API keys** and copy the **Secret key** (`sk_live_…`). While testing, switch on **Test mode** and use the test key (`sk_test_…`) instead.

## 2. Cloudflare Worker
1. Sign up at **dash.cloudflare.com** (free plan).
2. Go to **Workers & Pages → Create → Create Worker**. Name it `tts-shop-pay` and click **Deploy**.
3. Click **Edit code**, delete the sample, paste in everything from `worker.js`, and click **Deploy**.
4. Go to the worker's **Settings → Variables and Secrets** and add:
   - `STRIPE_SECRET_KEY` (type **Secret**): your Stripe secret key
   - `SHOP_URL` (type **Text**): `https://shop.tonystechsupport.com.au`
5. Copy the worker's address, for example `https://tts-shop-pay.yourname.workers.dev`.
6. In the shop's `config.json`, set `"payments": { "stripeWorker": "https://tts-shop-pay.yourname.workers.dev", … }` and commit. A "Credit or debit card" option then appears at checkout.

## 3. Optional: a text when a card payment goes through
1. In Stripe go to **Developers → Webhooks → Add endpoint**:
   - URL: `https://tts-shop-pay.yourname.workers.dev/webhook`
   - Event: `checkout.session.completed`
2. Copy the **Signing secret** (`whsec_…`) and add it to the worker as `STRIPE_WEBHOOK_SECRET` (Secret).
3. Add `NOTIFY_WEBHOOK` (Text) with your Tech Automation inbound webhook URL. You'll then get a text like "PAID by card: shop order TTS-261107-AB12 – $1,395.00 – Jane 0400 000 000".

## Testing
Use Test mode keys and Stripe's test card **4242 4242 4242 4242**, any future expiry date and any CVC. When it works, swap in the live key.

## Notes
- Card payment is only offered once the delivery cost is known (the client has entered their suburb). Otherwise they choose another payment method and you text the final amount.
- Service charges (delivery, setup and so on) come from the cart and are accepted up to $1,500 each. Product prices are always re-checked on the server. You still confirm every order before buying stock, as now.
