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

## Update: real accounts + CV background patterns

Two changes since the initial deployment:

**Real accounts replace the anonymous-ID system.** Users now register with
name/email/password before they can access the builder — this is enforced
by an auth gate on the frontend and `requireAuth` middleware on every
credit-related API route. Sessions are JWTs stored in the browser
(`jengacv_token` in localStorage) and sent as `Authorization: Bearer <token>`
on each request. Passwords are hashed with bcrypt; the server never stores
or logs a plaintext password.

**If you're updating an existing deployment** (not a fresh install), you
must do two things after pulling this update:
1. **Re-run `server/schema.sql`** against your database — it's written to be
   safe to re-run, and adds the new `email`/`password_hash`/`name` columns.
2. **Add a `JWT_SECRET` environment variable** if it isn't already set. The
   updated `render.yaml` has Render auto-generate one (`generateValue: true`),
   but Render only applies new Blueprint fields on a **Manual Sync** — go to
   your Blueprint page and click **Manual Sync**, or add `JWT_SECRET`
   yourself under the web service's Environment tab with any long random
   string. Without this, sessions won't survive a server restart.

**Background patterns.** The CV preview/download now has a "Background"
selector next to the template and accent-color controls — Plain, Dots,
Diagonal lines, Grid, or Corner glow. These render as a low-opacity layer
behind the resume content (tinted with the selected accent color) so they
stay decorative without hurting text readability, and they appear on the
downloaded PDF the same as the on-screen preview.

## Update: password reset + promotional emails

Two new capabilities, both requiring email sending, which the app didn't
have before:

**Get a Resend API key first.** Go to https://resend.com, sign up (free
tier is generous — plenty for this), and grab an API key from the
dashboard. For testing, you can send from `onboarding@resend.dev`
immediately with no setup; for real use later, verify your own domain in
Resend and update `EMAIL_FROM` accordingly.

**If you're updating an existing deployment:**
1. Add `RESEND_API_KEY` to your Render environment (Environment tab → Edit)
2. `EMAIL_FROM` is optional — defaults to the Resend test address if unset
3. Re-run `server/schema.sql` — it now adds a `marketing_opt_in` column to
   `users` and a new `password_resets` table. Safe to re-run.
4. Without `RESEND_API_KEY` set, the app doesn't crash — it logs a warning
   and skips sending, so registration/login still work, but reset links and
   promo emails won't actually arrive until this is configured.

**Password reset.** A "Forgot password?" link on the login screen emails a
one-time link (`/reset-password.html?token=...`) valid for 1 hour. The
token itself is never stored in the database — only its SHA-256 hash — so
a database leak alone can't be used to reset anyone's password. Requesting
a reset always returns the same generic response whether or not the email
is registered, so this can't be used to check who has an account.

**Marketing opt-in.** A checkbox appears at registration ("Send me
occasional tips and promotions"), and any logged-in user can change their
mind anytime — click their name in the top bar to open Account settings.

**Sending promotional emails.** There's no admin dashboard for this —
instead, a simple script:
```
cd server
npm run promo -- "Your subject line" "Your message body text"
```
This emails everyone who's currently opted in. Run it locally (pointed at
your production `DATABASE_URL` and `RESEND_API_KEY` in your `.env`) or
directly on Render via the Shell tab under your web service.

## Update: margins now apply correctly to every PDF page (1 inch, every side, every page)

Follow-up fix to the margin work below. Padding on the resume's content
div only creates space at the true start and end of the whole document,
not at each page break — so a multi-page CV had no top margin on page 2+
and no bottom margin on page 1, with content running edge-to-edge at every
page break.

**The fix:** margin is now set via the `@page` CSS rule
(`@page{ margin:1in; }`) instead of div padding. `@page` margins are part
of the CSS Paged Media spec and apply uniformly to every generated page,
regardless of how many pages the content spans — the correct, standard way
to get consistent 1-inch margins on every page of a PDF. The resume's own
padding was removed to avoid stacking both, which would have produced a
2-inch margin instead of 1.

## Update: fixed uneven margins and inconsistent multi-page backgrounds in PDFs

Real bug found from an actual generated CV: the browser's own default print
margins were stacking on top of the resume's own padding (causing uneven
spacing), and the background wasn't rendering consistently when a CV
spanned more than one page.

**Root causes, both in `server/resume-template.js`:**
1. No explicit `@page` CSS rule meant Chromium applied its own default
   print margins in addition to the resume's padding — fixed with
   `@page{ size:A4; margin:0; }`, so the resume's own CSS is now the only
   source of spacing.
2. `overflow:hidden` on the resume's outer container can clip background
   rendering when content spans multiple PDF pages — removed.
3. The background pattern layer used `position:absolute`, which doesn't
   reliably repeat across paginated PDF output. Switched to
   `position:fixed`, which is the standard, correct CSS technique for
   making an element repeat identically on every page of a generated PDF
   (well-supported by Chromium's print engine, which is what CustomJS
   uses under the hood).

No new environment variables, no schema changes — just the template fix.

## Update: real server-side PDF downloads (fixes mobile downloads + quality)

Previously, "Download PDF" used the browser's own print-to-PDF
(`window.print()`). This caused two real problems: mobile browsers often
don't surface the resulting file in Downloads at all (since it's a print
dialog, not a file download), and print-to-PDF frequently rasterizes the
page, making it look like a low-quality scan instead of sharp text.

**The fix:** PDFs are now generated server-side and sent as an actual file:

1. `server/resume-template.js` — a Node port of the client's CV rendering
   logic (`public/index.html`'s `renderPreview()`), producing a standalone
   HTML document from the CV's JSON content. Kept deliberately close in
   structure to the client version so the PDF matches the on-screen preview.
2. `server/pdf-service.js` — sends that HTML to **CustomJS**
   (customjs.space), a hosted API that renders it with a real Chromium
   browser and returns a proper PDF. 600 free conversions/month.
3. The `/api/generate-pdf` route returns the PDF with
   `Content-Disposition: attachment`, which is what makes browsers — mobile
   included — treat it as a genuine downloadable file rather than opening a
   print preview.
4. The frontend now fetches that PDF as a blob and triggers the download
   via a temporary `<a download>` element — the standard, reliable pattern
   for real file downloads from JavaScript, working the same way on
   desktop and mobile.

**Why CustomJS instead of self-hosting Puppeteer:** Puppeteer needs to
launch a real Chromium binary on the server, and Render specifically has
well-documented issues with this ("Could not find Chrome" errors from a
misconfigured cache path), often requiring a custom build script to fix.
Given the deployment friction already hit in this project, a hosted API
with a simple key — the same pattern already working for Resend and
Anthropic — is the lower-risk choice.

**If you're updating an existing deployment:**
1. Sign up at customjs.space, grab an API key
2. Add `CUSTOMJS_API_KEY` in Render's Environment tab
3. No schema changes, no other setup — this is frontend + backend code only

**Note on quality:** since CustomJS uses real Chromium rendering server-side
(and Render's servers have normal internet access, unlike some restricted
environments), Google Fonts, background patterns, and icons should all
render at full fidelity — a genuine improvement over the old print-to-PDF
approach in every respect, not just the download reliability.

## Update: referral program simplified to credit-only

The referral program no longer tracks or pays out real KSh — it's purely a
free download credit now, which is much simpler to run:

- Every account still gets a unique referral code and shareable link
- When someone they referred pays for their **first** download, the
  referrer automatically gets **+1 bonus download credit** — instantly, no
  manual step
- No cash ledger, no manual M-Pesa payouts, no need for Safaricom's B2C
  API — `server/scripts/pay-referrals.js` has been removed since there's
  nothing left to pay out

**What changed under the hood:** `rewardReferrerIfEligible()` in
`server/routes/api.js` now only bumps `downloads_remaining` — the earlier
`referral_earnings` INSERT is gone. The `referral_earnings` table itself
is left in the schema (harmless, unused) rather than dropped, consistent
with how earlier unused columns were handled — safer than a destructive
migration for something that was never storing real production data.

Adjust the reward amount via the `REFERRAL_BONUS_CREDITS` constant at the
top of `server/routes/api.js` if you want to change it from 1 later.

## Update: referral program + new background patterns

**Referral program.** Every account gets a unique 6-character referral
code and shareable link (`yoursite.com/?ref=CODE`). When someone signs up
via that link and makes their **first** successful payment, the referrer
earns:
- A logged cash reward (default **KSh 75**, i.e. 15% of the KSh 500 price
  — see the reasoning below) in the new `referral_earnings` table
- An instant bonus of 1 free download credit, immediately

**Payouts are manual, on purpose.** Automatically sending real M-Pesa cash
to referrers requires Safaricom's **B2C API** — a separate product from
the C2B/STK Push this app already uses, needing its own application and
approval. Rather than promise automation that isn't actually built, run:
```
npm run referrals
```
This lists everyone owed money and their contact info. Pay each person
manually via M-Pesa, then run `npm run referrals -- mark <userId>` to
record it as paid. Worth automating via B2C later once volume justifies
the extra integration work.

**Adjusting the reward:** it's one constant, `REFERRAL_REWARD_PERCENT`, at
the top of `server/routes/api.js`.

**If you're updating an existing deployment:** re-run `server/schema.sql`
— it adds `referral_code`, `referred_by`, and `referral_rewarded` columns
to `users`, plus the new `referral_earnings` table. No new environment
variables needed.

**New background patterns:** Circuit, Hex mesh, Wave, and Triangles join
the existing Dots/Lines/Grid/Corner options — same low-opacity,
accent-tinted approach so they stay decorative without hurting
readability, built with pure CSS gradients (no image assets).

## Update: CV emailing, verification, AI proofreading, autosave, and more

A large batch of related features. Covering each briefly:

**Email CVs to the account holder.** After a successful M-Pesa payment, a
copy of the person's autosaved CV is emailed to their account address.
**Honest limitation:** this is a clean, readable HTML email of the CV
*content* — not a pixel-perfect match of the exact template/font/pattern
they chose. True PDF-attachment emailing needs server-side PDF rendering
(e.g. Puppeteer), which isn't set up in this deployment. Worth adding later
if it matters enough to invest in that infrastructure.

**Email verification.** A verification email now sends at registration
(24-hour link). Unverified accounts see a dismissible banner in the app
with a "Resend link" option — verification is prompted, not enforced;
nothing is blocked if someone ignores it.

**AI CV proofreading.** "Improve with AI" in the Work Experience step
sends the summary + experience content to Claude via the Anthropic API,
which suggests grammar/clarity fixes and rewrites vague achievements into
measurable ones (e.g. "Achieved the campaign's trading profit target at
20% MoM"). **Important:** the system prompt explicitly forbids the model
from inventing specific numbers that weren't provided — where a bullet
lacks a real metric, it suggests the *structure* with a placeholder like
"[add %, KSh amount, or time saved]" instead of guessing a statistic.
Needs `ANTHROPIC_API_KEY` set — get one at console.anthropic.com.

**Downloads per payment: 3 → 2.** `CREDITS_PER_PAYMENT` in
`server/routes/api.js`, updated everywhere in the UI and copy.

**Salary insights.** Right when someone clicks Download (once per
session), a declinable prompt asks their target monthly income for the
role — pure aggregate market data for Eddie, never blocking the download.

**Post-edit referral prompt.** Immediately after (or if skipped), a second
declinable prompt offers sharing the referral link via WhatsApp. The
always-available "Refer & Earn" button in the top bar still exists
separately for anytime access.

**Fonts.** Four pairings (Classic, Modern, Elegant, Minimal) selectable per
CV, applied to the name and body text; the small uppercase section-label
style stays in IBM Plex Mono regardless, since that's a structural design
choice rather than "the CV's font."

**Certifications moved** to the optional Additional Sections step, and now
have Started / Completed / Expires date fields instead of one generic date.

**Mini icons on skill/tool/hobby pills.** Best-effort keyword matching
(`PILL_ICON_KEYWORDS` in `public/index.html`) — covers common categories
(coding, data, design, finance, sports, music, etc.) with a star fallback
for anything unmatched. No dictionary can cover every possible skill or
hobby someone types, so this is deliberately a heuristic, not exhaustive.
Hidden on the Classic/ATS template for the same reason icons are hidden
elsewhere there.

**Autosave.** Debounced (2s after the last edit) save to a new `cvs` table,
keyed to the account. Loads automatically on login, so editing can resume
on any device, any time.

**If you're updating an existing deployment:**
1. Add `ANTHROPIC_API_KEY` in Render's Environment tab
2. Re-run `server/schema.sql` — adds `email_verified`, the
   `email_verifications`, `cvs`, and `salary_insights` tables, and the new
   certification date fields (those live in the `cvs.content` JSON, not a
   separate column, so no migration needed there specifically)
3. No changes needed to `RESEND_API_KEY`/`EMAIL_FROM` — verification and
   CV-copy emails reuse the same Resend setup as password reset

## Update: admin account (unlimited downloads)

There's now an `is_admin` flag on `users`, checked in the download-consume
route: admin accounts skip the credit check entirely — no decrementing,
no payment gate — while every download they make is still logged (so the
site-wide download counter stays accurate).

**Not self-serve, on purpose.** There's no UI to grant yourself admin —
that would be a security hole. To make your own account admin, run this
once in pgAdmin's Query Tool:
```sql
UPDATE users SET is_admin = true WHERE email = 'your-account-email@example.com';
```
Log out and back in afterward so the app picks up the change — you'll see
"Unlimited downloads (admin)" in place of the normal credit count, and the
Download button skips straight past the payment modal every time.

**If you're updating an existing deployment:** re-run `server/schema.sql`
— it adds the `is_admin` column. No new environment variables.

## Update: back to M-Pesa only

Card payments (Flutterwave) and location-based currency conversion have
both been removed — `server/flutterwave.js`, `server/currency.js`, the
`/api/flutterwave/*` routes, `/api/currency`, and the Card tab in the
payment modal are all gone. The app now offers M-Pesa exclusively, the same
as the very first deployment.

The `payments` table still has `currency` and `charged_amount` columns from
that experiment — they're harmless and unused now, left in place rather
than doing a riskier column-drop migration. `server/pesapal.js` and its
routes are also still present and untouched from earlier, in case card
payments come back via Pesapal instead down the line.

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
