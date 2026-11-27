# Bengaluru ICAI Event Registration

A separate event registration portal for the ICAI Bengaluru Branch (SIRC), meant to run on its own subdomain.

It runs in two ways:
- **Browser test version** (default): everything is saved in the browser, so it runs free on GitHub Pages with no server.
- **With the backend:** build with `VITE_API_URL` set to the API address and the same pages use the Node and MongoDB API in `server/`. See `server/README.md`.

Built by IC Solutions.

## What works in this version

**Public portal**
- Event list grouped by month, with search and a Members or Students filter. An event stays in the list until it is over (its end date and end time), even after registration closes. Then it moves by itself to "Past events", with no admin step. An open page rechecks every minute.
- Event page with date, time, venue, seats left, description, and a fee table showing GST.
- Booking form on the same page:
  - one category per booking (member, non-member or student)
  - up to the limit the admin sets
  - only the ID field that fits the category: 6 digit membership number, or a student registration number like SRO0123456
  - billing details, with an optional GSTIN (hidden for students, since they pay no GST) and an optional PAN, both format checked
  - a live summary showing fee, group discount, GST and total
- Simulated ICICI Eazypay step with success and failure buttons.
- Booking pass with print and "Add to calendar".
- "Find a booking" by booking number and email or mobile.
- Closed and fully booked events show a "notify me" form (the old portal's missed opportunity page).
- Free events skip payment.
- **Event images:** one image per event, any shape, always shown whole and never cropped. It appears as a thumbnail on the event list and next to "About this event" on the event page, where a click shows it full size. Events without an image simply show no picture.
- **Sample images:** every imported event starts with a dummy poster marked "Sample image", made by `tools/sample_posters.py` from the event's real name, date, time and venue. They are for reference only. Replace or remove them in admin. "Reset test data" brings them back.
- **Colour coded status:**
  - red for few seats left, closing today or tomorrow, or fully booked
  - amber for filling fast, or closing in 2 or 3 days
  - green for seats available, group discount or free
  - grey for registration closed or event over
- A retro poster style picture of Bengaluru heads the event list and event pages. In the middle is a real photo of Vidhana Soudha, recoloured into an orange evening. Around it are drawn Bangalore Palace, the Lalbagh Glass House, a gopuram, UB City and the CBD towers, a Namma Metro train, tiled roof houses and rain trees. The drawn parts and the photo's size and place are set in `tools/skyline.py`, so edit that file and rerun it to change the picture.

**Admin** (`#/admin`, not linked from the public pages. On the live setup it moves to its own subdomain.)
- **Two roles.** Admin sees everything. Manager sees only Registrations and Failed registrations (no dashboard, events, interest list or settings).
- **Dashboard:** open events, paid bookings, participants and amount collected, with a link to failed or not completed bookings.
- **Events:** add, edit, copy, pause, close or delete. Delete only works when there are no bookings. Upcoming and Past tabs follow the same rule as the public list.
- **Event image:** upload by clicking or by dropping a file, with a preview, Replace and Remove. JPG, PNG or WebP up to 8 MB, scaled down to 1,400 pixels on the longest side. Copying an event copies its image. The events table shows a small thumbnail.
- **Event settings:**
  - fees per category, entered before GST
  - seats, and the most people allowed in one booking
  - booking open date, and an optional early close time
  - optional CPE hours and speakers
- **Group discount per event:**
  - switch it on and set the minimum group size
  - choose a percentage or a rupee amount off each person
  - it comes off before GST
  - the form shows a live worked example and blocks impossible values
- **Registrations:**
  - filters and search
  - **Failed registrations** has its own menu item. Failed and not completed bookings are kept with all their form details, like on the old portal. "Failed" means the bank said no, with the bank's response code and reason. "Not completed" means the person reached the payment step and left, or the bank never sent a final reply, 30 minutes after booking. The dashboard links straight to them.
  - for every bank reply: payment mode, bank reference, response code and message, amount from the bank and time. Replies that fail the security check are recorded too, without changing the booking.
  - a detail panel for each booking
  - Excel download with two sheets, Bookings and Participants. Bookings includes the status, the reason a booking was not paid, the bank reply details, GSTIN and PAN.
  - PDF download of the same list, landscape A4, with the branch name and logo on top, the filters used, totals, and one row per booking with its participants, billing details, amount and payment status.
- **Interest list,** with Excel and PDF download.
- **Settings:** GST rate, booking number prefix and help desk contacts. Also has a reset for the test data.

Test logins are shown on the login page.

## Brand

- Font: Manrope, the closest free match to the lettering in the branch logo on bengaluru.icai.org (the logo is an image, so its exact font is not known).
- Colours from the logo: blue #2C3A92 for buttons, headings and links, orange #B3630D as the accent. The branch name leads the header in orange, with "Event Registration" under it in blue, like the logo. Small orange text uses #A65A0A so it stays readable.

## Naming

The branch is always written as **ICAI Bengaluru Branch (SIRC)**: on the site, in the policies, the receipt email, the share image, the sample posters and the meta tags.

## Data

- The 22 events from 1 November 2026 onwards are imported from the old portal's database backup. Fees, seats, venues, times and descriptions are unchanged.
- Seats already sold on the old portal count against seats left.
- One fix was made to the data: "Half a Day Seminar at Tumkur" on 24 Nov had its end time saved as 1:30, which has been read as 1:30 pm.
- Booking numbers continue the old format and sequence: EICAI00158187 onwards.
- Policy text is copied as it was on bangaloreicai.org, with the branch name updated.

Everything you add or book is saved in your browser only. Another browser or device starts fresh. Settings has a "Reset test data" button.

## Run it on your computer

Needs Node 18 or newer.

```bash
npm install
npm run dev
```

Then open the address it prints, usually http://localhost:5173.

## Quick preview file

`npx vite build --config vite.preview.config.js` makes `preview/index.html`, a single file that opens by double click with no server.

## Put it on GitHub Pages

1. Push this folder to the `main` branch of a public repository.
2. The workflow in `.github/workflows/deploy.yml` builds the site and publishes it to the `gh-pages` branch on every push. It takes about two minutes.
3. If the link does not work after the first run, go to Settings, then Pages, and set Source to "Deploy from a branch", branch `gh-pages`, folder `/ (root)`.

The site is then at `https://<github-username>.github.io/<repository-name>/`.

To use a subdomain such as events.bangaloreicai.org for testing, add it under Settings, then Pages, then Custom domain. Then point a CNAME record at `<github-username>.github.io`.

## Project layout

```
src/
  data/events.json      imported events
  data/policies.js      refund, cancellation, privacy and e-payment text
  lib/pricing.js        fee, discount and GST maths (no browser code, reusable on the server)
  lib/data.js           picks the data source: api.js (backend) or store.js (browser test version)
  lib/eventRules.js     event checks, shared with the server
  lib/eventState.js     open, closed, full and event over rules, shared with the server
  lib/bookingStatus.js  paid, failed, not completed, and the Eazypay response code list
  lib/validate.js       field rules and states list
  lib/excel.js          Excel exports
  lib/pdf.js            PDF exports (loaded only when used; fonts in assets/fonts/pdf)
  pages/                public pages
  admin/                admin pages
```

## Backend

The backend in `server/` covers the live version's needs:
- database storage
- server side price and seat checks
- ICICI Eazypay with a test switch
- receipt emails
- hashed admin logins
- image uploads

See `server/README.md` for setup, deployment and the checklist before real payments.

## Image credits

The Vidhana Soudha in the header is a photo by Aaron Antony Paul on Unsplash (Unsplash License, free for commercial use, no permission needed). We cut it out and recoloured it into an evening look to match the portal. The edited file is `src/assets/vidhana-soudha-evening.webp`; its size and place in the skyline are set in `tools/skyline.py`.

## Still to do for the live version

- **ICICI Eazypay keys and a test transaction** with ICICI. The code is ready. Check the response code list in `src/lib/bookingStatus.js` against the guide ICICI sends with the keys.
- **GST invoices** with the branch's GSTIN and invoice numbering. The receipts are not tax invoices yet.
- **Admin user management** from the admin panel. Logins are set in the server's `.env` for now.
- **Seat holds:** seats held for a few minutes while payment is in progress.
