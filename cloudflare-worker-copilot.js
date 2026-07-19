/**
 * AEO Copilot — paid AI advisor + generator
 * Cloudflare Worker
 *
 * WHAT THIS DOES: proxies chat messages to OpenAI (gpt-4o-mini by default)
 * with the AeroAEO curriculum baked into the system prompt, so it gives
 * on-brand, accurate AEO advice AND can generate ready-to-paste schema
 * markup / FAQ content / heading rewrites when asked. This is the one
 * piece of AeroAEO infrastructure that costs real (if small) money per
 * use — every message is a real paid API call. Typical cost is a
 * fraction of a cent per message with gpt-4o-mini.
 *
 * REQUIRED SETUP (see cloudflare-deployment-guide.md):
 *  1. An OpenAI account with billing enabled + a hard spending limit set
 *     in the OpenAI dashboard (Settings → Limits). Do this BEFORE deploying.
 *  2. An API key, added as a Worker SECRET named OPENAI_API_KEY —
 *     never hardcode it in this file or commit it to the repo.
 *  3. Set ACCESS_CODE below to whatever code you're distributing after
 *     Stripe purchase (same pattern as the marketer exam).
 *
 * COST SAFETY NETS included:
 *  - Server-side access code check (won't run without the right code)
 *  - Hard per-request cap on conversation history length + max response
 *    tokens, so no single request can balloon in cost
 *  - Optional daily-message-count cap via Cloudflare KV (commented out
 *    below — enable once you've created a KV namespace, or skip it and
 *    rely on the OpenAI dashboard spending limit instead)
 */

const ACCESS_CODE = "COPILOT2026"; // ← change this any time; must match aeo-copilot.html

const MODEL = "gpt-4o-mini";
const MAX_HISTORY_MESSAGES = 12; // caps how much conversation gets resent each turn
const MAX_RESPONSE_TOKENS = 700;

const SYSTEM_PROMPT = `You are AEO Copilot, the AI advisor built by AeroAEO (aeroaeo.marketing), founded by Amanda Fouts. You help marketers and business owners understand and implement Answer Engine Optimization (AEO) — the practice of getting a brand cited as the answer by ChatGPT, Perplexity, Google AI Overviews, and Microsoft Copilot.

Ground every answer in this framework:

TWO PIPELINES: Retrieval (live web search at query time — powers Perplexity, Google AI Overviews, ChatGPT/Copilot browsing mode; changes show up in 4-8 weeks; rewards technical SEO, crawlability, and extractable content) and Training (content baked into model weights during scheduled crawls; changes take months; rewards entity authority and third-party mentions over self-published content).

10-POINT AUDIT FRAMEWORK (10 pts each, 80+ = AI-Optimized): Organization/WebSite schema, FAQ schema, entity/About page with consistent NAP, 2,000+ word cornerstone content, structured H1-H3 headings, sitemap submitted, AI-crawler-friendly robots.txt (explicitly allow GPTBot, ChatGPT-User, ClaudeBot, PerplexityBot, Google-Extended, CCBot, etc.), glossary/definitional content, case study or original data, active backlinks/citations.

PEER-REVIEWED EVIDENCE: Princeton's GEO research (Aggarwal et al., KDD 2024) found the three highest-impact content changes are adding cited sources, adding statistics, and adding direct quotations — 22-41% visibility lift, with the largest gains for lower-ranked/less-established sources (the "Equalizer Effect").

ETHICS: Never suggest hidden prompt injection, citation stuffing, fake reviews, or any manipulation tactic — these get detected and penalized (dataset exclusion, trust downgrades, bans), and fake reviews are explicitly illegal under the FTC's Consumer Review Rule. Always recommend legitimate tactics: real cornerstone content, real third-party mentions, real audits/certifications.

WHAT YOU CAN DO WHEN ASKED:
- Explain any AEO concept clearly and specifically, not generically.
- Generate ready-to-paste JSON-LD schema markup (Organization, FAQPage, Article, etc.) tailored to details the user gives you about their business — output it in a clean \`\`\`json code block.
- Draft FAQ content (question + answer pairs) optimized for AI extraction — direct, declarative, no hedging language.
- Rewrite headings to be phrased as real user questions.
- Give a rough audit read based on what the user describes about their site (be clear this is a rough read, not a substitute for AeroAEO's actual Score Calculator or certification audit).

TONE: Direct, specific, no fluff. Give concrete next steps, not generic encouragement. If someone asks something outside AEO/marketing scope, gently redirect to what you're built for. Keep responses focused — this is a chat tool, not an essay generator, so default to a few tight paragraphs unless the user is explicitly asking for generated content like schema/FAQ blocks.`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // tighten to "https://aeroaeo.marketing" once confirmed working
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (request.method !== "POST") {
      return json({ error: "POST only" }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const { accessCode, messages } = body;

    if (!accessCode || accessCode.trim().toUpperCase() !== ACCESS_CODE) {
      return json({ error: "Invalid or missing access code." }, 401);
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "messages must be a non-empty array." }, 400);
    }

    // Trim history to cap cost per request
    const trimmed = messages.slice(-MAX_HISTORY_MESSAGES).map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, 4000), // guard against huge pastes
    }));

    if (!env.OPENAI_API_KEY) {
      return json({ error: "Server misconfigured: OPENAI_API_KEY secret not set. See cloudflare-deployment-guide.md." }, 500);
    }

    // ── Optional: daily rate-limit via Cloudflare KV ──
    // Uncomment once you've bound a KV namespace called RATE_LIMIT_KV to this Worker.
    /*
    const today = new Date().toISOString().slice(0, 10);
    const kvKey = `count:${today}`;
    const currentCount = parseInt((await env.RATE_LIMIT_KV.get(kvKey)) || "0", 10);
    const DAILY_LIMIT = 300; // total messages/day across all users — adjust to taste
    if (currentCount >= DAILY_LIMIT) {
      return json({ error: "Daily message limit reached. Try again tomorrow." }, 429);
    }
    await env.RATE_LIMIT_KV.put(kvKey, String(currentCount + 1), { expirationTtl: 172800 });
    */

    try {
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...trimmed],
          max_tokens: MAX_RESPONSE_TOKENS,
          temperature: 0.4,
        }),
      });

      if (!aiRes.ok) {
        const errText = await aiRes.text();
        return json({ error: `AI provider error: ${aiRes.status}`, detail: errText.slice(0, 300) }, 502);
      }

      const data = await aiRes.json();
      const reply = data?.choices?.[0]?.message?.content || "(no response)";
      return json({ reply });
    } catch (e) {
      return json({ error: `Request failed: ${e.message}` }, 502);
    }
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
