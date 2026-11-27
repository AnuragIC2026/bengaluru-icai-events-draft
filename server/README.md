# Bengaluru ICAI Events API

The backend for the event registration portal: Node, Express and MongoDB.

## What it does

- **Events:** a public list and event pages. Admins add, edit, copy, close and delete events, and upload images.
- **Bookings:**
  - The server checks every detail again: category, member and student numbers, GSTIN, the booking limit and seats.
  - It works out the price itself (fee, group discount, GST) using the same code as the front end, so the browser can never set its own price.
- **Seats** are taken only when payment succeeds, with an atomic database update. Two people paying for the last seats at the same time can't both get them. The second payment is marked failed and flagged for refund.
- **Booking numbers** carry on from the old portal: EICAI00158187 onwards.
- **Private booking links:** each booking gets a random key. The receipt link only works with that key, and "find a booking" needs the booking number plus the billing email or mobile.
- **Payments:**
  - `PAYMENT_MODE=test` simulates the bank.
  - `PAYMENT_MODE=eazypay` sends people to ICICI Eazypay and checks the bank's reply with its SHA-512 hash before marking anything paid. Replies that fail the check, or show a different amount, never confirm a booking.
- **Emails:** a receipt to the billing email and a confirmation to each participant, sent through any SMTP account. Switched off until `EMAIL_ENABLED=true`.
- **Admin:**
  - Admin and Manager roles, with logins signed as 8 hour tokens. Manager sees registrations and failed registrations only.
  - Passwords are hashed with bcrypt.
  - Logins, bookings and searches are rate limited.
- **Images** are checked, resized to 1,400 pixels and re-encoded as WebP, which also strips hidden data such as GPS tags.

## Run it

Needs Node 18 or newer, and MongoDB 6 or newer for real use.

```bash
cd server
npm install
cp .env.example .env      # then fill it in
npm run seed              # loads the 22 events, sample images and admin logins (safe to run again)
npm start
```

Without `MONGODB_URI` it runs on an in-memory database that fills itself with the 22 events on every start. That's handy for a quick look, but everything is lost on restart. With no admin logins in `.env`, it uses admin@demo.in / admin123 and accounts@demo.in / accounts123.

Run the tests with `npm test`. They use the in-memory database, so they need no MongoDB.

## Connect the front end

Build the front end with the API address:

```bash
VITE_API_URL=https://events-api.bangaloreicai.org npm run build
```

On GitHub, set a repository variable named `VITE_API_URL` (Settings, Secrets and variables, Actions, Variables). The Pages workflow picks it up on the next push. Leave it empty to keep the browser-only test version.

Set `FRONTEND_URL` and `CORS_ORIGINS` in the server's `.env` to the front end's address. Use the origin only, for example `https://anuragic2026.github.io`.

## Deploy on the new server (outline)

1. Install Node 20, MongoDB 7 (or use MongoDB Atlas), Nginx and certbot.
2. Copy the repository, run `npm ci --omit=dev` in `server`, then create `.env`.
3. Run it with systemd or pm2, for example `pm2 start src/index.js --name icai-events-api`.
4. Set up an Nginx site for the API subdomain that proxies to port 4000, and get HTTPS with certbot. The API must be on HTTPS, or browsers will block calls from the HTTPS front end.
5. Run `npm run seed` once, then log in to the admin.
6. Back up MongoDB and the uploads folder every night.

## Before switching on real payments

- [ ] Get the merchant ID, sub merchant ID and the 16 character AES key from ICICI. Put them only in `.env` on the server.
- [ ] Check `EAZYPAY_MANDATORY_FIELDS` against ICICI's merchant kit.
- [ ] Do a test payment with ICICI's test credentials.
- [ ] Register the return URL with ICICI: `https://<api address>/api/payments/eazypay/return`.
- [ ] Set `PAYMENT_MODE=eazypay` and restart.

## API

| Method | Path | Who |
|---|---|---|
| GET | /api/health | anyone |
| GET | /api/settings | anyone |
| GET | /api/events, /api/events/:id | anyone |
| GET | /share/event/:id | anyone (WhatsApp link preview page, then sends the visitor to the event) |
| POST | /api/bookings | anyone |
| GET | /api/bookings/:id?k=key | person with the link |
| POST | /api/bookings/find | anyone (number plus email or mobile) |
| POST | /api/interest | anyone |
| POST | /api/payments/test/:id | person with the link, test mode only |
| POST | /api/payments/eazypay/return | ICICI Eazypay |
| POST | /api/admin/login | anyone |
| GET | /api/admin/events | admin, manager |
| POST, PUT, DELETE | /api/admin/events | admin |
| POST, DELETE | /api/admin/events/:id/image | admin |
| GET | /api/admin/bookings | admin, manager |
| GET | /api/admin/interest | admin |
| GET, PUT | /api/admin/settings | admin |
