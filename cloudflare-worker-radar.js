/**
 * AeroAEO Radar — Phase 1 automated AEO scanner
 * Cloudflare Worker (free tier: 100,000 requests/day, no billing required)
 *
 * WHAT THIS DOES: fetches a target site's homepage HTML, robots.txt, and
 * sitemap.xml server-side (this is the one thing a browser can't do itself —
 * CORS blocks client-side JS from fetching another domain's HTML), then
 * checks 10 real technical AEO signals with pure parsing logic. No AI API
 * calls anywhere in this file — this costs $0 to run at any volume within
 * the free tier.
 *
 * DEPLOY: see cloudflare-deployment-guide.md in this same folder.
 *
 * Note on scope: 4 of the 10 checks here (schema, robots.txt, sitemap,
 * headings/meta/OG/canonical) are directly automatable and checked for real.
 * Two items from the full manual certification framework — "glossary page"
 * and "case study / original data" — can't be reliably auto-detected on an
 * arbitrary site, so this scanner swaps in two other real technical checks
 * (canonical/domain consistency, title tag quality) instead. The full
 * 10-point manual audit (certification.html) still covers all 10 original
 * criteria — this tool is the fast, free, automated first pass.
 */

const AI_BOTS = ["GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-SearchBot", "anthropic-ai", "PerplexityBot", "Perplexity-User", "Google-Extended", "CCBot", "Applebot-Extended"];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // tighten to "https://aeroaeo.marketing" once deployed, if you want
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const reqUrl = new URL(request.url);
    const targetRaw = reqUrl.searchParams.get("url");
    if (!targetRaw) {
      return json({ error: "Missing ?url= parameter" }, 400);
    }

    let target;
    try {
      target = new URL(targetRaw.startsWith("http") ? targetRaw : `https://${targetRaw}`);
    } catch (e) {
      return json({ error: "Invalid URL" }, 400);
    }

    const origin = `${target.protocol}//${target.host}`;
    const checks = [];

    // ── Fetch homepage HTML ──
    let html = "";
    try {
      const res = await fetchWithTimeout(target.toString(), 8000);
      html = await res.text();
    } catch (e) {
      return json({ error: `Could not fetch ${target.toString()}: ${e.message}` }, 502);
    }

    // ── Fetch robots.txt ──
    let robotsTxt = "";
    try {
      const res = await fetchWithTimeout(`${origin}/robots.txt`, 5000);
      if (res.ok) robotsTxt = await res.text();
    } catch (e) { /* treat as missing */ }

    // ── Fetch sitemap.xml ──
    let sitemapOk = false;
    try {
      const res = await fetchWithTimeout(`${origin}/sitemap.xml`, 5000);
      if (res.ok) {
        const text = await res.text();
        sitemapOk = /<urlset|<sitemapindex/i.test(text);
      }
    } catch (e) { /* treat as missing */ }

    // ── Parse JSON-LD blocks ──
    const ldBlocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
      .map(m => { try { return JSON.parse(m[1]); } catch { return null; } })
      .filter(Boolean);
    const flatTypes = [];
    for (const block of ldBlocks) {
      const nodes = block["@graph"] ? block["@graph"] : [block];
      for (const n of nodes) {
        const t = n["@type"];
        if (Array.isArray(t)) flatTypes.push(...t);
        else if (t) flatTypes.push(t);
      }
    }
    const hasOrgSchema = flatTypes.some(t => /organization|website|professionalservice/i.test(t));
    const hasFaqSchema = flatTypes.some(t => /faqpage/i.test(t));

    checks.push(mkCheck("schema", "Organization/WebSite Schema", hasOrgSchema,
      hasOrgSchema ? "Found valid Organization/WebSite/ProfessionalService schema." : "No Organization, WebSite, or ProfessionalService schema detected."));
    checks.push(mkCheck("faq_schema", "FAQ Schema", hasFaqSchema,
      hasFaqSchema ? "Found FAQPage schema." : "No FAQPage schema detected."));

    // ── Meta description ──
    const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
    const hasMetaDesc = !!(metaDescMatch && metaDescMatch[1] && metaDescMatch[1].trim().length > 20);
    checks.push(mkCheck("meta_description", "Meta Description", hasMetaDesc,
      hasMetaDesc ? "Meta description present and substantive." : "Missing or too-short meta description."));

    // ── Open Graph ──
    const hasOg = /<meta[^>]+property=["']og:title["']/i.test(html);
    checks.push(mkCheck("open_graph", "Open Graph Tags", hasOg,
      hasOg ? "og:title tag found." : "No Open Graph tags detected."));

    // ── Canonical URL consistency ──
    const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i);
    let canonicalOk = false, canonicalDetail = "No canonical link tag found.";
    if (canonicalMatch) {
      try {
        const canonicalHost = new URL(canonicalMatch[1], target).host;
        canonicalOk = canonicalHost === target.host;
        canonicalDetail = canonicalOk
          ? "Canonical URL present and matches the site's actual domain."
          : `Canonical URL points to a different domain (${canonicalHost}) than the one scanned (${target.host}) — this exact bug quietly undermines entity consistency.`;
      } catch { canonicalDetail = "Canonical tag found but href could not be parsed."; }
    }
    checks.push(mkCheck("canonical", "Canonical URL Consistency", canonicalOk, canonicalDetail));

    // ── Title tag quality ──
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const titleText = titleMatch ? titleMatch[1].trim() : "";
    const titleOk = titleText.length >= 10 && !/^untitled/i.test(titleText);
    checks.push(mkCheck("title_tag", "Descriptive Title Tag", titleOk,
      titleOk ? `Title tag: "${titleText}"` : "Title tag missing, too short, or generic."));

    // ── Heading structure ──
    const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
    const h2Count = (html.match(/<h2[\s>]/gi) || []).length;
    const headingsOk = h1Count === 1 && h2Count >= 2;
    checks.push(mkCheck("headings", "Structured Headings", headingsOk,
      `Found ${h1Count} H1 tag(s) and ${h2Count} H2 tag(s). Ideal: exactly one H1, multiple H2s.`));

    // ── Word count (homepage heuristic) ──
    const textOnly = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const wordCount = textOnly ? textOnly.split(" ").length : 0;
    const wordCountOk = wordCount >= 1500;
    checks.push(mkCheck("word_count", "Substantial Content", wordCountOk,
      `~${wordCount} words on the scanned page. Aim for 1,500+ on cornerstone pages (scan your cornerstone article URL directly for the most accurate read here).`));

    // ── Sitemap ──
    checks.push(mkCheck("sitemap", "Sitemap Submitted", sitemapOk,
      sitemapOk ? "Valid sitemap.xml found." : "No valid sitemap.xml found at /sitemap.xml."));

    // ── robots.txt AI crawler access ──
    const robotsResult = checkRobotsTxt(robotsTxt);
    checks.push(mkCheck("robots_ai", "AI-Crawler-Friendly robots.txt", robotsResult.ok, robotsResult.detail));

    // ── Score ──
    const score = checks.reduce((sum, c) => sum + (c.passed ? 10 : 0), 0);
    const tier = score >= 80 ? "AI-Optimized" : score >= 60 ? "AI-Ready" : score >= 40 ? "Emerging" : "AI-Invisible";

    return json({ url: target.toString(), score, tier, checks });
  },
};

function mkCheck(id, label, passed, detail) {
  return { id, label, passed, points: passed ? 10 : 0, detail };
}

function checkRobotsTxt(robotsTxt) {
  if (!robotsTxt) {
    return { ok: false, detail: "No robots.txt found — AI crawler access can't be confirmed." };
  }
  const lines = robotsTxt.split(/\r?\n/).map(l => l.trim());
  const blocks = [];
  let current = null;
  for (const line of lines) {
    if (/^user-agent:/i.test(line)) {
      const agent = line.split(":")[1].trim();
      current = { agent, rules: [] };
      blocks.push(current);
    } else if (current && /^(dis)?allow:/i.test(line)) {
      const [key, ...rest] = line.split(":");
      current.rules.push({ type: key.trim().toLowerCase(), path: rest.join(":").trim() });
    }
  }

  const wildcardBlocks = blocks.filter(b => b.agent === "*");
  const wildcardBlocksAll = wildcardBlocks.some(b => b.rules.some(r => r.type === "disallow" && r.path === "/"));

  let blockedBots = [];
  for (const bot of AI_BOTS) {
    const botBlocks = blocks.filter(b => b.agent.toLowerCase() === bot.toLowerCase());
    if (botBlocks.length > 0) {
      const explicitlyBlocked = botBlocks.some(b => b.rules.some(r => r.type === "disallow" && r.path === "/"));
      if (explicitlyBlocked) blockedBots.push(bot);
    } else if (wildcardBlocksAll) {
      blockedBots.push(bot);
    }
  }

  if (blockedBots.length === 0) {
    return { ok: true, detail: "No AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.) are blocked in robots.txt." };
  }
  return { ok: false, detail: `robots.txt blocks: ${blockedBots.join(", ")}. These crawlers can't reach the site, so it can't be cited by the AI systems they feed.` };
}

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "AeroAEO-Radar/1.0 (+https://aeroaeo.marketing/aeo-radar.html)" },
      redirect: "follow",
    });
  } finally {
    clearTimeout(id);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
