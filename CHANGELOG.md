# Changelog – Tony's Tech Support Shop

## v8.0 · 17 Nov 2026
- New **Special deals** page (/#/c/deals) listing every limited-time price, soonest-ending first, with a "Deals" link in the header (only shown while there are deals), a deals strip on the home page and a category tile.
- Deal cards show the end date ("Ends Fri, 20 Nov").
- Deals from marketing emails: the shop reads a private feed (`DEALS_FEED_URL` secret) made by the new Google script, with client prices only. Same rules as the Black Friday refurbs: special price until the offer ends, then "Price on request".
- Brand-new deal items are listed as new (not refurbished), with no "Only a few left" note.
- An email deal that's already listed in refurbished.json isn't added twice. If the feed can't be reached, the last good copy is used.

## v7.10 · 17 Nov 2026
- The 154 refurbished computers added on 17 Nov (supplier code A) now work like the iPads: "From $X", "Price and stock on request" and a "Request this item" button instead of Add to cart

## v7.9 · 17 Nov 2026
- Added 209 refurbished computers to Laptops, Desktops & All-in-Ones and Refurbished: Windows laptops and 2-in-1s, mobile workstations, MacBooks, desktops, all-in-ones, iMacs, desktop workstations, Mac minis and Mac Studios (client prices rounded up to the nearest $5; grades shown where known)
- Limited-time prices: items can have an end date and time. Until then they show the special price, a "Black Friday price" badge and "until Friday 20 November, 7:59 pm Perth time (10:59 pm AEDT)"; afterwards they automatically switch to "Price on request" with a "Request this item" button, are removed from carts, and can't be paid for by card
- Order texts show a private one-letter supplier code for each refurbished item
- Xeon processors and 192GB memory are now recognised in specs and sorting

## v7.8 · 17 Nov 2026
- Added 18 refurbished iPads (iPad 6th–10th Gen, iPad Mini 5 and 6, iPad Air 4 and 5, iPad Pro 12.9" and 13" M4) to Tablets and Refurbished, priced at Tony's client prices rounded up to the nearest $5 (ranges shown as e.g. $565–$575)
- New "on request" type of refurbished item: shows "Price and stock on request" and a "Request this item" button that opens the free quote form already filled in with the item, instead of Add to cart. Set "onRequest": true (and optional "priceTo") in refurbished.json
- Tablets: storage and screen size are now read from the name, so sorting by storage and screen size works for them

## v7.7 · 17 Nov 2026
- Returns policy wording for computers updated to Tony's version: no change-of-mind returns on computers he has set up at the client's request; he'll work with them to find a machine they're happy with; special cases (unopened, under 14 days) at his discretion, less 20%
- Supplier upgrade bundles (e.g. "RAM In-House Upgrade to 32GB") now appear as an option on the standard computer's page ("Upgrade memory to 32GB +$275") instead of a separate listing; choosing it orders the upgraded version
- Cart: new "Upgrades (optional)" section for computers: tick "more memory" or "more storage" (or describe something else) and Tony checks what's possible and texts a price before ordering; nothing is added to the total. The request appears in the order text and on printed quotes/invoices
- Product pages: computers with built-in (soldered) memory say it can't be upgraded later; others mention the upgrade option in the cart

## v7.6 · 16 Nov 2026
- Returns policy: computers (laptops, desktops, all-in-ones, tablets, handheld PCs) can't be returned for a change of mind, set up or not; Tony works with the client to find a machine they're happy with, and may accept one back in special cases less the 20% restocking fee
- Promotional duplicates hidden: supplier listings of the same product with a freebie or add-on ("plus Bonus mouse", "plus Eaton UPS for $79", "Bundle … for $100", "Save $25EX When You Purchase …") are dropped when the plain product is listed; if only promotions exist, the cheapest one is kept

## v7.5 · 16 Nov 2026
- Fixed: "Delivery, setup & on-site data transfer" stayed in the cart after the computer was removed; data transfer now only applies when a computer is in the cart, and the delivery choice goes back to Uber Courier
- New Returns & refunds page (footer link, checkout note and FAQ): faulty items always covered with no fee (with the Australian Consumer Law statement); change-of-mind returns within 14 days if unopened, less a 20% restocking fee. Days and fee are set in config.json → returns

## v7.4 · 16 Nov 2026
- Surveillance PCs and thin clients from Leader are back in Desktops & All-in-Ones

## v7.3 · 16 Nov 2026
- Leader's data feed is now switched on and read correctly: stock columns AT (total) and AW (Perth), short description as the product name, barcodes and photos
- "In stock in Perth" now works for Leader products (about 1,770 items had Perth stock on 16 Nov)
- Leader's categories mapped: laptops, desktops (commercial, AIO, NUC), tablets, monitors, external drives and USB sticks, printers, home/small-office networking, keyboards, mice, docks, hubs, adapters, webcams, headsets, tablet keyboards and cases
- Leader items that don't suit the shop are left out: warranties, spare parts, servers, kiosks, signage and barebone kits

## v7.2 · 15 Nov 2026
- Street address removed everywhere (footer, invoices, quotes, Google product data); the shop now only shows "Hazelmere WA 6055"
- Product cards size themselves by text size: with larger text on a phone they drop to one card per row instead of squashing two side by side
- Fixed things that pushed the page sideways with large text (the "Suits any use" box, top menu, long email address)

## v7.1 · 15 Nov 2026
- Every page now ends with "Can't find what you're looking for?": clients describe what they want (with any special requests and an optional budget) and it's emailed to Tony, who replies within 1 business day, including items not in the shop yet
- Help me choose: "Special requests" moved into that custom quote form; the old "Send a copy to Tony" section and its three options are gone. "Get a free custom quote" opens the form and includes the client's answers and the options they were shown
- Help me choose: "Print" now prints a clean summary (your answers, Good/Better/Best with reasons and part numbers, and other options) instead of the web page
- Better printing for every other page (no menus, banners or split cards)

## v7.0 · 14 Nov 2026
- New shop sections: USB Hubs & Docks, Adapters, Bags & Cases, Keyboards & Mice (everything still shows in Accessories too)
- Hubs & Docks and Adapters have a "What do you want to plug into what?" filter: pick your computer's port, then tick what you want to connect (HDMI, DisplayPort, Ethernet, SD card…)
- "All items" tile at the start of the category list, and first in the Shop menu
- Sort options change with the section, and every sort can be reversed with one tap:
  - computers: price, name, memory, storage, processor speed, screen size
  - monitors: screen size, resolution, refresh rate
  - backup drives: capacity
  - hubs, docks and adapters: number of ports
- The "Suits any use" filter only appears (and only applies) on computer pages
- Product pages show extra photos (different angles) when available, with arrows, thumbnails and swipe on phones
- Products without a photo now show a drawing that matches the product (hub, adapter, bag, keyboard, mouse, headset, webcam, charger, stand, lock, ink…)
- Search box placeholder simply says "Search"
- On phones, the category tiles scroll sideways so products appear sooner
- More adapters are included from the supplier feeds (display, USB-C and network adapters)

## v6.1 · 14 Nov 2026
- Search bar moved into the top menu, so it stays at the top of every page as you scroll (phones too)
- Shop button opens a menu of all categories (with item counts), Refurbished, "View all items" and Help me choose; it opens on hover with a mouse, and on tap on phones and tablets
- New "All items" page (/#/all)
- On smaller screens, Main website and Contact Tony move into the Shop menu to make room for the search bar
- Photos: products without a photo now borrow the photo of the same model in another configuration, with a note saying colour and ports can vary
- Photos: once Leader's feed is active, barcodes are used to look up photos too (finds many that part numbers miss)
- Photos: every update writes a list of products still missing a photo, most important first: shop.tonystechsupport.com.au/missing-photos.csv

## v6.0 · 14 Nov 2026
- Help me choose starts with "What are you replacing?" (age, memory, storage, model) and "Why are you replacing it?"
- "Check this computer for me" button reads what the browser can see (Windows/Mac, memory, processor threads, screen) and explains how to find the storage size
- Advice panel: when a repair or upgrade (SSD, memory, battery, screen) is likely cheaper than a new computer, it says so and offers a repair/upgrade quote
- New computers must have at least as much memory and storage as the old one (double the memory if it's too slow)
- Results show Good / Better / Best (Tony's pick on Better), with plain-English reasons; every other match is listed underneath
- Compare: tick any number of computers anywhere in the shop and compare them in a table (best values highlighted)
- Save or send results: copy link, share, text or email it to someone, print, or email a copy to Tony with questions
- Quote requests, repair quotes and questions go to Tony by email only; clients are told it can take up to 1 business day
- Special requests box (CD/DVD drive, Grade A only, a game or app…); asking for a CD/DVD drive suggests an external one
- New or refurbished question, with a Grade A only option
- Refurbished section: refurbished and ex-demo computers from the feeds, plus your own in refurbished.json
- New Handheld Gaming PCs section (Legion Go, ROG Ally and similar; dock to use as a desktop)
- Complete desk setup bundle (monitor, keyboard & mouse, backup drive) on desktop picks and desktop product pages
- Multi-buy discount across the whole shop: 2% / 4% / 6% / 8% for 2 / 3 / 4 / 5+ items, never below a 15% markup on any product; card payments use the same maths
- Guarantee and site wording updated to cover refurbished products

## v5.0 · 13 Nov 2026
- Version number now shows in small grey text at the bottom of every page
- Cart: removed the "Estimated from the distance…" note under the delivery calculator
- Cart and checkout: the order summary follows you down the page (desktop), with a "Continue to checkout" button in it
- Print: "Print or save invoice (PDF)" on the order confirmation page makes a clean one-page invoice (business details, ABN, items, GST, how to pay)
- Cart: new "Print or save a quote (PDF)" link
- Help me choose: budget buttons plus "Other amount" for a custom budget
- Help me choose: when nothing fits the budget, it says so plainly, shows the lowest price and the closest options, and offers a free custom quote
- Help me choose: "Email Tony for a free custom quote" form on every result (texts Tony via the order alert, with an email-app fallback)
- Help me choose: drops only the least important "anything else" wish when nothing matches, and says which one
- Help me choose is more prominent: highlighted in the menu, and a big panel with quick-start buttons near the top of the home, Laptops and Desktops pages
- Removed extended-warranty/support packs and handheld game consoles that were showing up as laptops

## v4.0 · 12 Nov 2026
- Product details moved higher; "What you get when you buy from Tony" just above the guarantee
- Tech Automation order alert; confirmation page says "Thanks, your order is in"
