# AeroAEO Radar — SaaS Product Plan

## What it is

An automated AEO visibility tool. Where the existing Score Calculator makes a visitor self-report 10 checkboxes, Radar actually fetches their site and checks the real signals — schema, robots.txt, sitemap, word count, heading structure, canonical/OG consistency — and returns a genuine 0–100 score in seconds. Later, it grows into tracking whether ChatGPT, Perplexity, and Google AI Overviews actually cite the brand over time.

**Name:** AeroAEO Radar (fits the aviation brand — "scanning for signals" is exactly what it does). Alternates if you want options: Altimeter, Flightpath.

**Target customer:** Businesses directly — same buyer as the certification and audit funnel.

**Ops budget:** ~$0–20/mo to start. That constraint is what shapes the phasing below — Phase 1 has zero ongoing API cost by design.

---

## Phase 1 — Free Automated Scanner (buildable now, $0/mo)

**What it does:** Visitor enters a URL. A backend function fetches that site's actual HTML, robots.txt, and sitemap.xml server-side, and automatically checks the same 10-point framework already used across the site:

1. Organization/WebSite schema present (parses real JSON-LD, not self-reported)
2. FAQPage schema present
3. robots.txt explicitly allows AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.)
4. sitemap.xml exists and resolves
5. Homepage word count (2,000+ word cornerstone signal)
6. H1–H3 heading structure present
7. Meta description present
8. Open Graph tags present
9. Canonical URL present and matches the actual domain (this check exists because of the exact bug we found and fixed on aeroaeo.marketing itself — genuinely useful, not theoretical)
10. Consistent entity name across title tag and schema

Returns the same 0–100 score and AI-Invisible/Emerging/AI-Ready/AI-Optimized tiers as the current calculator, but computed from the real page instead of self-reported checkboxes — which is both more accurate and a real differentiator from a static quiz.

**Why this needs a backend (the one non-obvious technical point):** client-side JavaScript can't fetch an arbitrary external site's HTML directly — browsers block that (CORS). So unlike everything else built so far, Phase 1 needs exactly one small server-side function to do the fetching. That's the only new piece of infrastructure required.

**Recommended stack:** a single Cloudflare Worker (free tier: 100,000 requests/day, no credit card required). You'd create a free Cloudflare account, and I'd write the Worker code — it's maybe 100 lines of JavaScript, a five-minute deploy through their dashboard. Everything else — the results page, the email capture, the styling — stays the same static-HTML pattern already used site-wide.

**Lead-gen value:** free forever, captures email like the other tools, feeds the same nurture funnel, and gives you a much stronger free asset than a self-reported quiz to promote.

---

## Phase 2 — Paid AI Citation Tracking (once Phase 1 has traction, real budget)

**What it does:** User creates an account, adds their brand name and a handful of prompts they care about ("best AEO agency," "top AI SEO tool for SaaS," etc.). A scheduled job queries ChatGPT, Perplexity, and Claude with those prompts on a set interval and logs whether/how the brand is mentioned. Dashboard shows citation trend over time, with optional competitor comparison.

**Why this costs real money:** every check is a real API call to a paid AI provider. Cost scales with (number of tracked prompts) × (number of engines) × (check frequency). Controllable by limiting frequency (weekly, not hourly) and capping tracked prompts per tier.

**Needs:** user accounts + a database — Supabase's free tier (Postgres + auth included) covers early-stage volume at $0. A scheduled job (Cloudflare Cron Triggers, also free tier) runs the checks. This is the point where the $0–20/mo budget stops being enough — plan on real per-customer API cost once this phase starts, priced into the subscription.

**Suggested pricing shape** (adjust once you see real usage/cost data): a free tier with 1 tracked prompt checked weekly, paid tiers unlocking more prompts, more engines, and daily checks — roughly in line with what Runway/Cruising Altitude customers would expect to pay on top of their existing service tier.

---

## Phase 3 — Scale (later)

- Competitor "share of voice" tracking
- Email/Slack alerts when citation status changes
- White-label version certified marketers can resell to their own clients (ties back into the $199 certification — "comes with tool access" becomes a real upsell even though the primary buyer stays direct businesses)
- Auto-suggested content topics based on citation gaps
- API access for agency-scale integration

---

## What I can build right now vs. what needs you

**I can build immediately:** the Phase 1 frontend (results page, scoring display, email capture) and the actual Cloudflare Worker backend code, in the same style as everything else on the site.

**Needs you:** creating the free Cloudflare account (no card required) and pasting the Worker code in through their dashboard — a five-minute task I can walk you through step by step, but can't do on your behalf since it's a new external account.

**My recommendation:** confirm you want to proceed with Phase 1, then I'll write the actual scanner tool (frontend + Worker code) next, and give you the exact Cloudflare deployment steps.
