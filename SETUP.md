# Tony's Tech Support Shop – setup guide
Version v7.1 (15 Nov 2026). See CHANGELOG.md for what changed.

This folder builds **shop.tonystechsupport.com.au**. It is hosted free on GitHub Pages. Every night at about 1:40 am (Perth time), GitHub:

1. downloads your Leader Computers and Dicker Data price/stock feeds,
2. keeps the in-stock products in your shop's categories,
3. picks the cheaper supplier for each item (stock already in Perth wins unless the other supplier is more than 2% cheaper),
4. prices it at (buy price + estimated freight) × 1.25, plus GST, rounded up to the nearest $5,
5. adds product photos, clearer names and descriptions from Open Icecat (a free product database; no account needed),
6. works out which uses each computer suits (everyday, study, business, photo/video, gaming, portable, big screen) for the use filter and the "Help me choose" picker,
7. writes a separate page for every product, plus a sitemap, so Google can list them,
8. republishes the shop.

Your buy prices and feed links never appear on the website. Only selling prices are published.

---

## One-time setup (about 30 minutes)

### 1. Put the files on GitHub
1. Sign in at github.com (the same account that hosts your callout fee calculator works).
2. Click **New repository**. Name it `tts-shop`, set it to **Public** (required for free Pages), and click **Create repository**.
3. Click **uploading an existing file**, drag in everything in this folder (including the hidden `.github` folder: on a Mac, press Cmd + Shift + . in Finder to see it), then click **Commit changes**.

### 2. Add your private feed links
In the repository, go to **Settings → Secrets and variables → Actions → New repository secret** and add two secrets:

| Name | Value |
|---|---|
| `DICKER_FEED_URL` | your Dicker Data "Datafeeds — CSV" link |
| `LEADER_FEED_URL` | your Leader "Stock Data Feed - CSV with Heading and Long Description - No Compression" link |

Secrets are hidden from everyone, even on a public repository.

> **Leader feed note:** at the moment Leader's link returns "Cannot generate file". Leader only activates the feed after your first purchase through the Dealershop. Ask Andoni (08 6369 6017) to switch it on. Until then, the shop runs on Dicker Data alone and picks up Leader automatically once the feed works.

### 3. Turn on GitHub Pages
**Settings → Pages → Build and deployment → Source: GitHub Actions.**
Then go to the **Actions** tab, click **Update shop → Run workflow** to build it for the first time. It takes about 2 minutes.

### 4. Point shop.tonystechsupport.com.au at it
1. In **Settings → Pages → Custom domain**, enter `shop.tonystechsupport.com.au` and click **Save**.
2. In Squarespace, go to **Settings → Domains → tonystechsupport.com.au → DNS settings → Add record**:
   - Type: **CNAME**
   - Host: **shop**
   - Data: **YOUR-GITHUB-USERNAME.github.io** (for example `tshannon1.github.io`)
3. Wait up to an hour, then back in GitHub Pages tick **Enforce HTTPS**.
4. Add a **Shop** link to your Squarespace navigation pointing to https://shop.tonystechsupport.com.au.

### 5. Delivery cost calculator
Built in, so there's nothing to set up. It uses a table of every WA suburb (`site_src/suburbs.json`) with its distance from Hazelmere, and your callout rules: round trip × $1.45/km, rounded up to $5, $10 minimum, free within 2 km. Straight-line distance is multiplied by `callout.roadFactor` (1.3) to allow for real roads. That matches your calculator for Huntingdale ($80). Suburbs more than 120 km away show "I'll confirm the cost". Adjust these in `config.json` → `callout`.

### 6. Get a text for every order (Tech Automation) – done
A workflow called **Shop order alert (shop.tonystechsupport.com.au)** is set up and published in Tech Automation (Automation → Workflows). Each order is sent to its Inbound Webhook, and it texts you (user Tony Shannon) the full order summary. The webhook URL is already in `config.json` → `orders.webhookUrl`.

The order fields available in the workflow are: `ref`, `name`, `first_name`, `phone`, `email`, `address`, `total`, `payment`, `items`, `summary`. Inbound Webhook is a premium trigger, so Tech Automation charges a small fee for each order it receives.

If the alert can't be reached, the confirmation page falls back to the "send your order to Tony" button.

### 6b. Quote requests by email – done
The **"Can't find what you're looking for?"** form at the bottom of every page (and the "Get a free custom quote" button in Help me choose) sends requests by **email only**, through a second workflow: **Shop quote request email (shop.tonystechsupport.com.au)**. It emails tony@tonystechsupport.com.au with the client's answers, the options they saw, their special requests and a link to their results. The webhook URL is in `config.json` → `quotes.webhookUrl`. The first test landed in Gmail's **Promotions** tab: drag it to Primary (or make a filter for "Help me choose page") so you don't miss them.

### 7. Payment details
Already filled in from your payment options (PayID, UBank transfer, card via a Zeller link, PayPal, cash by arrangement). Bank details only appear on the order confirmation page, never in Google. Edit `config.json` → `payments` to change them.

### 8. Get the shop on Google (10 minutes)
1. Go to **search.google.com/search-console** and sign in with your business Google account.
2. If tonystechsupport.com.au is already there as a **Domain** property, the shop is already covered. Otherwise click **Add property → URL prefix → https://shop.tonystechsupport.com.au** and verify with the **DNS record** option, adding the TXT record it gives you in Squarespace DNS settings.
3. Open **Sitemaps** and submit `https://shop.tonystechsupport.com.au/sitemap.xml`.
4. Optional: in **Google Merchant Center** (merchants.google.com), add the shop as your website. Each product page already includes the price and stock details Google needs for its free shopping listings.

Google usually starts showing new pages within a few days to a few weeks.

### 9. Card payments (optional)
See `stripe-worker/README.md`. You'll need free Stripe and Cloudflare accounts (I can't create accounts for you). Once set up, a "Credit or debit card" option appears at checkout.

### Refurbished machines
- Refurbished and ex-demo computers in the supplier feeds are now included and labelled with their grade.
- To add refurbs you source yourself, edit `refurbished.json` (instructions are at the top of the file). Enter the **selling price**, never your buy price: the repo is public.

### Multi-buy discount
`config.json` → `pricing.multiBuy`: 2% off 2 items, 4% off 3, 6% off 4, 8% off 5 or more (items $30+, across the whole shop). Each product is checked so it never drops below a 15% markup on its cost plus freight (`floorMarkup`). With your 25% markup, 8% is the most any tier can be.

### Product photos
- **Automatic:** photos come from Open Icecat. Each night the shop looks up every product that doesn't have a photo yet, including other spellings of the part number (HP's Australian codes and Lenovo's other-region codes), six at a time. After the first couple of runs, every product will have been checked.
- **Add your own:** put a photo in the `photos` folder named after the part number shown on the product page, e.g. `photos/B9GD4PT.jpg` (on GitHub: open the folder → **Add file → Upload files**). It's used from the next update.
- **Extra angles:** where the photo database has more photos of a product, they appear as a gallery on its page. The first update after this version re-checks products it has already found, to collect the extra photos.
- **Same model, different configuration:** if one configuration of a model has a photo, the others borrow it (the product page notes that colour and ports can vary).
- **Barcodes:** once Leader's feed is active, its barcodes are used to look up photos as well.
- **What's still missing:** after every update, open https://shop.tonystechsupport.com.au/missing-photos.csv (opens in Excel). It lists every product without a photo, laptops and desktops first, with the exact file name to use in the `photos` folder. It's hidden from Google.
- **Hide products without photos:** set `pricing.hideWithoutPhoto` to `true` in `config.json`.

### Product photos (more detail)
Photos and clearer product names come from Open Icecat using its public login, so you don't need to do anything. In a test with your Dicker Data stock, about half the products got a photo and a proper name. Leader's feed adds its own photos once it's active. Results are saved between nightly runs, so each product is only looked up once (unmatched items are retried every 3 weeks). If you ever want more photos, you can register a free Icecat account and add `ICECAT_USER` to the workflow.

---

## Changing things later
Everything is in `config.json`. Edit it on GitHub (click the file → pencil icon → **Commit changes**) and the shop rebuilds in about 2 minutes.

| Setting | What it does |
|---|---|
| `pricing.markup` | 1.25 = 25% |
| `pricing.roundTo` | 5 = every price and calculated charge rounds up to the nearest $5. Note: one extra hour of setup ($99) shows as $100. |
| `pricing.capAtRRP` | `true` never prices anything above the manufacturer's RRP. In a test with Dicker Data stock, about a third of items came out above RRP at 25%. |
| `pricing.freightExGst` | Your estimated freight per item from the distributor, by category. **Please check these against your real freight costs.** |
| `leadTimes` | Supplier days (Perth stock vs interstate) plus the 7 extra days you asked for. |
| `services` | Setup, courier, data transfer prices, free apps, add-ons. |

Categories and filters (what is included or excluded) are near the top of `scripts/build.py`.

## "In stock in Perth" vs "Available"
Only Leader's feed shows which state the stock is in. Items in a Perth warehouse are marked **In stock in Perth**, and everything else shows **Available to order** (with the longer delivery estimate). Clients can tick "In stock in Perth only" to filter. Until the Leader feed is switched on, everything shows as "Available to order".

## Handling an order
Each order text includes the **part number** and **supplier number**: 1 = Leader, 2 = Dicker Data (whichever was the better buy that night). Search the part number in that portal, confirm stock and price, then order. If it has sold out, offer an equivalent or a refund, as the site promises.

## Testing on your own computer (optional)
```
python3 scripts/build.py --dicker-file Dicker.csv --leader-file Leader.csv --out site
cd site && python3 -m http.server 8000
```
Then open http://localhost:8000. Don't upload the CSV files or the `site` folder to GitHub (they're blocked by `.gitignore`).
