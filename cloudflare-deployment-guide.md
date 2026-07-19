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
