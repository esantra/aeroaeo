# Deploying AeroAEO Radar's Backend (Cloudflare Worker)

Five minutes, no credit card, $0/month within the free tier (100,000 requests/day). This is the one piece of Radar that needs a server — everything else is the same static HTML pattern as the rest of the site.

## Steps

1. **Create a free Cloudflare account:** go to [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) and sign up with your email. No payment method required for the free tier.

2. **Create a Worker:**
   - In the Cloudflare dashboard, go to **Workers & Pages** in the left sidebar.
   - Click **Create** → **Create Worker**.
   - Give it a name, e.g. `aeroaeo-radar`. Click **Deploy** to create it with the default "Hello World" code (you'll replace this next).

3. **Paste in the real code:**
   - Click **Edit code** (or "Quick edit").
   - Delete everything in the editor.
   - Open `cloudflare-worker-radar.js` (in this same folder) on your computer, copy the entire contents, and paste it into the Cloudflare editor.
   - Click **Deploy** (or **Save and Deploy**).

4. **Get your Worker's URL:**
   - After deploying, Cloudflare shows a URL like `https://aeroaeo-radar.YOUR-SUBDOMAIN.workers.dev`.
   - Copy that exact URL.

5. **Wire it into the site:**
   - Open `aeo-radar.html` in this folder.
   - Find this line near the bottom (inside the `<script>` tag):
     ```
     const WORKER_URL = "https://REPLACE-WITH-YOUR-WORKER-URL.workers.dev";
     ```
   - Replace the placeholder with your actual Worker URL from step 4.
   - Save the file.

6. **Test it:**
   - Open `aeo-radar.html` (locally or on the live site once pushed).
   - Enter a URL, like `aeroaeo.marketing`, and click **Scan Now**.
   - You should see a real score and a checklist within a few seconds.

## Optional: lock down CORS

By default the Worker allows requests from any domain (`Access-Control-Allow-Origin: *`), which is fine for getting started. Once you've confirmed it works, you can restrict this to your own domain only — open `cloudflare-worker-radar.js`, find:

```js
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
```

and change `"*"` to `"https://aeroaeo.marketing"`, then re-paste the updated file into the Cloudflare Worker editor and redeploy.

## If something goes wrong

- **"Scan failed" / network error:** double-check the `WORKER_URL` in `aeo-radar.html` exactly matches what Cloudflare shows you (including `https://` and no trailing slash).
- **A specific site's scan errors out:** some sites block automated requests entirely (Cloudflare/bot-protection on *their* end) — this will show as a fetch error. That's a limitation of any external scanner, not a bug in this one.
- **Free tier limits:** 100,000 requests/day is enormous for this use case — you will not hit it at any realistic scan volume. If you ever do, Cloudflare will show usage warnings in the dashboard before anything breaks.

---

# Deploying AEO Copilot's Backend (Cloudflare Worker + OpenAI)

This one is different from Radar: it costs real money per message (though a small amount — roughly $0.001-$0.01 per message with gpt-4o-mini), because it's actually calling a paid AI provider. Follow the spending-limit step below before doing anything else — it's the guardrail that keeps a mistake or an abused access code from turning into a surprise bill.

## Steps

1. **Create an OpenAI account:** go to [platform.openai.com/signup](https://platform.openai.com/signup). This one *does* need a payment method on file, since API usage is metered.

2. **Set a hard spending limit FIRST, before creating a key:**
   - In the OpenAI dashboard, go to **Settings → Limits** (or **Billing → Limits**).
   - Set a monthly budget you're comfortable with — even $5-10/month covers a large number of Copilot conversations at gpt-4o-mini pricing.
   - This is the real safety net. Do this before step 3.

3. **Create an API key:**
   - Go to **API keys** in the OpenAI dashboard.
   - Click **Create new secret key**, name it something like `aeroaeo-copilot`.
   - Copy the key immediately — OpenAI only shows it once.

4. **Create the Worker:**
   - In Cloudflare, **Workers & Pages** → **Create** → **Create Worker**.
   - Name it `aeroaeo-copilot`, deploy the default code, then **Edit code**, delete everything, and paste in the full contents of `cloudflare-worker-copilot.js` from this folder. **Deploy**.

5. **Add your OpenAI key as a Worker secret (never paste it directly into the code):**
   - On the Worker's page in Cloudflare, go to **Settings → Variables**.
   - Under **Environment Variables**, add a new variable named exactly `OPENAI_API_KEY`, paste in your key as the value, and make sure to click **Encrypt** (this stores it as a secret, not plain text).
   - Save.

6. **Get your Worker's URL** (same as Radar — shown after deploying, looks like `https://aeroaeo-copilot.YOUR-SUBDOMAIN.workers.dev`).

7. **Wire it into the site:**
   - Open `aeo-copilot.html`, find `const WORKER_URL = "https://REPLACE-WITH-YOUR-COPILOT-WORKER-URL.workers.dev";` near the bottom, and replace with your real Worker URL.

8. **Set up payment + access codes:**
   - Create a Stripe Payment Link for Copilot (same way you did for the marketer certification — a one-time $49 product works well, no subscription needed).
   - Open `aeo-copilot.html`, replace `https://buy.stripe.com/REPLACE-WITH-YOUR-COPILOT-PAYMENT-LINK` with your real link.
   - Decide on an access code (default in the code is `COPILOT2026`) and update it in **both** `aeo-copilot.html` (search for `COPILOT2026` — actually the code lives server-side only in the Worker; the frontend doesn't hardcode it) and `cloudflare-worker-copilot.js` (`const ACCESS_CODE = "COPILOT2026";`) if you want to change it. They must match exactly.
   - Same manual process as the exam for now: check Stripe for new payments, then email the buyer their access code.

9. **Test it:** open `aeo-copilot.html`, enter your access code, and try a real question like "what schema should my SaaS homepage have?"

## Copilot-specific safety notes

- **Session cap:** the frontend stops a single browser session at 40 messages as a basic safeguard — refreshing resets it, so this isn't hard security, just friction against runaway cost from one session.
- **Server-side validation:** every message is re-checked against the access code on the Worker side, not just at the start — so a leaked/guessed code only works if it matches exactly.
- **Optional daily cap:** `cloudflare-worker-copilot.js` has a commented-out block for a Cloudflare KV-based daily message limit across all users. If you want it, create a KV namespace in Cloudflare (**Workers & Pages → KV**), bind it to this Worker as `RATE_LIMIT_KV`, then uncomment that block and redeploy.
- **Watch usage for the first week or two** in the OpenAI dashboard (**Usage**) after launch, just to confirm real-world cost matches expectations before you stop paying attention to it.
