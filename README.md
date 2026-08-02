# JengaCV — deployment guide

This is the real, deployable version of JengaCV: an Express server that serves
the frontend, talks to a Postgres database, and processes M-Pesa payments via
Safaricom's Daraja API. Credits are only ever granted after Safaricom confirms
payment through a server-to-server callback — never by the browser.

```
jengacv/
  server/          Express backend + Daraja integration
    index.js
    db.js
    daraja.js
    schema.sql
    routes/api.js
    .env.example
  public/
    index.html     Frontend (CV builder UI)
  render.yaml       Render Blueprint (one-click deploy config)
```

---

## Part 1 — Get your Daraja (M-Pesa) credentials

You don't have these yet, so start here. Everything below is free to set up.

1. **Create a developer account.**
   Go to https://developer.safaricom.co.ke and register with your email.

2. **Create an app.**
   In the dashboard, click "My Apps" → "Add a new App". Give it a name (e.g.
   "JengaCV"). Select the **Lipa Na M-Pesa Online (STK Push)** product when
   prompted.

3. **Copy your sandbox keys.**
   Once created, the app page shows a **Consumer Key** and **Consumer
   Secret** — these are your `DARAJA_CONSUMER_KEY` / `DARAJA_CONSUMER_SECRET`.

4. **Use the standard sandbox test credentials for STK Push:**
   - `DARAJA_SHORTCODE=174379`
   - `DARAJA_PASSKEY` — Safaricom publishes this test passkey on the Daraja
     docs page for the "Lipa Na M-Pesa Online" API (search "STK Push" in
     their API reference — the sandbox passkey is listed there and is safe
     to use for testing since it only works with the sandbox shortcode above).
   - Test with the Safaricom test phone number **254708374149** — sandbox
     transactions don't move real money and don't require entering a real PIN.

5. **When you're ready to accept real payments (Go-Live):**
   - Apply for Go-Live in the Daraja dashboard — this requires your business
     details and a real Paybill or Till number (get one from Safaricom or
     your bank if you don't have one).
   - Once approved, Safaricom issues **production** Consumer Key/Secret and
     your real shortcode + passkey.
   - Set `DARAJA_ENV=production` and swap in the production credentials.
   - This usually takes a few business days, so it's worth starting the
     Go-Live application while you're still testing in sandbox.

---

## Part 2 — Get your Pesapal (card) credentials

1. **Create a developer account.**
   Go to https://developer.pesapal.com and sign up.

2. **Create an app / get sandbox keys.**
   In the dashboard, your **Consumer Key** and **Consumer Secret** for the
   sandbox environment are shown immediately — these are your
   `PESAPAL_CONSUMER_KEY` / `PESAPAL_CONSUMER_SECRET`.

3. **Test with sandbox card numbers.**
   Pesapal's sandbox checkout accepts test card numbers listed in their docs
   (search "test cards" in the Pesapal developer docs) — no real money moves.

4. **IPN registration happens automatically.**
   The server registers its IPN (webhook) URL with Pesapal the first time it
   needs one, and caches the resulting `ipn_id` in memory. You'll see it
   logged on server startup — copy it into `PESAPAL_IPN_ID` in your env vars
   if you want to skip re-registration on every restart (optional).

5. **When you're ready for real card payments (Go-Live):**
   - Apply for a production account in the Pesapal dashboard — this requires
     your business details and bank account for settlement.
   - Once approved, set `PESAPAL_ENV=production` and swap in your production
     Consumer Key/Secret.

---

## Part 3 — Deploy to Render

Render was chosen because it hosts the web service and the database in one
dashboard, and has a free tier to test on before you're paying anything.

1. **Push this project to a GitHub repository.**
   ```
   cd jengacv
   git init
   git add .
   git commit -m "Initial JengaCV deployment"
   git branch -M main
   git remote add origin https://github.com/<you>/jengacv.git
   git push -u origin main
   ```

2. **Create the Render Blueprint.**
   - Go to https://dashboard.render.com → New → Blueprint
   - Connect your GitHub repo. Render will detect `render.yaml` automatically
     and propose one **Web Service** and one **Postgres database**.
   - Click "Apply".

3. **Set the secret environment variables.**
   Render will prompt for the vars marked `sync: false` in `render.yaml`:
   - `DARAJA_CONSUMER_KEY`, `DARAJA_CONSUMER_SECRET`, `DARAJA_PASSKEY`
   - `PESAPAL_CONSUMER_KEY`, `PESAPAL_CONSUMER_SECRET`
   - `CALLBACK_BASE_URL` — leave this blank on first deploy; Render will give
     you a URL like `https://jengacv.onrender.com` once it's live. Come back
     and set `CALLBACK_BASE_URL` to that URL, then redeploy (both M-Pesa's
     callback and Pesapal's IPN/redirect depend on this being correct).

4. **Run the database schema.**
   - In the Render dashboard, open your new Postgres database → "Connect" →
     copy the "External Connection String".
   - From your machine:
     ```
     psql "<connection string>" -f server/schema.sql
     ```

5. **Test both payment paths.**
   - Visit your Render URL, build a CV, click Download.
   - **M-Pesa:** pay with test number `254708374149` (sandbox).
   - **Card:** choose Card, enter an email, complete checkout in the new tab
     with a Pesapal sandbox test card. Confirm the tab shows "Payment
     confirmed" and the main JengaCV tab unlocks 3 downloads automatically.

---

## Notes on what's stubbed vs. real

- **M-Pesa**: fully wired — real STK Push, real webhook, real credit
  granting. Production-ready once you swap in Go-Live credentials.
- **Card (Pesapal)**: fully wired — real hosted checkout, real IPN webhook,
  plus a fallback status check on the callback page so confirmation doesn't
  depend on the IPN alone. Production-ready once you swap in Go-Live
  credentials. Note the UX difference from M-Pesa: this opens a **new tab**
  for checkout (Pesapal is redirect-based, not an inline prompt), and the
  main tab polls in the background until it detects success.
- **Users**: anonymous, tracked via a random ID stored in the browser
  (`localStorage`). Good enough for an MVP; add real accounts (email/phone +
  OTP) if you want credits to follow a person across devices.
- **PDF quality**: downloads currently use the browser's print-to-PDF. Fine
  for launch; for pixel-perfect output later, render the same HTML
  server-side with Puppeteer and stream the PDF back directly instead of
  using `window.print()`.

## Local development

```
cd server
cp .env.example .env   # fill in your sandbox credentials for both providers
npm install
npm start
```
Then visit `http://localhost:3000`. Note: neither Safaricom nor Pesapal can
reach `localhost` for their callbacks, so for local testing you'll need a
tunnel (e.g. `ngrok http 3000`) and set `CALLBACK_BASE_URL` to the tunnel's
HTTPS URL for both providers.
