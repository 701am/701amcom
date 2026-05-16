// netlify/functions/kraken-research.js
//
// The Kraken's grounding pass. Two parallel Tavily searches (press + datasets)
// return a compact coverage brief that grounds the downstream ideation.
//
// POST body: { input: string }
// Response:  { coverageBrief: string, sources: [...], counts: {...} }

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_URL = "https://api.tavily.com/search";

const DATA_SOURCE_HINTS = [
  "bls.gov","census.gov","fred.stlouisfed.org","cdc.gov","nih.gov",
  "sec.gov","fda.gov","usda.gov","noaa.gov","nasa.gov",
  "data.gov","oecd.org","imf.org","worldbank.org","who.int",
  "gallup.com","pewresearch.org","kff.org","rand.org",
];

async function searchTavily(query, opts = {}) {
  const res = await fetch(TAVILY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      search_depth: "advanced",
      max_results: opts.maxResults || 8,
      include_answer: false,
      include_raw_content: false,
      include_domains: opts.includeDomains,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Tavily ${res.status}: ${errText.slice(0, 200)}`);
  }
  return res.json();
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  if (!TAVILY_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "TAVILY_API_KEY not set" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const input = (body.input || "").trim();
  if (input.length < 8) {
    return { statusCode: 400, body: JSON.stringify({ error: "Input too short" }) };
  }

  try {
    const [press, data] = await Promise.all([
      searchTavily(input, { maxResults: 8 }).catch(() => ({ results: [] })),
      searchTavily(`${input} data report study statistics`, {
        maxResults: 6,
        includeDomains: DATA_SOURCE_HINTS,
      }).catch(() => ({ results: [] })),
    ]);

    const seen = new Set();
    const dedupe = (items) =>
      (items || []).filter((it) => {
        if (!it || !it.url || seen.has(it.url)) return false;
        seen.add(it.url);
        return true;
      });

    const pressSources = dedupe(press.results).slice(0, 8).map((r) => ({
      title: r.title, url: r.url,
      snippet: (r.content || "").slice(0, 320),
      type: "press",
    }));
    const dataSources = dedupe(data.results).slice(0, 6).map((r) => ({
      title: r.title, url: r.url,
      snippet: (r.content || "").slice(0, 320),
      type: "data",
    }));

    const all = [...pressSources, ...dataSources];
    const brief = all.length === 0
      ? "(No coverage retrieved.)"
      : all.map((s, i) =>
          `[${i + 1}] (${s.type.toUpperCase()}) ${s.title}\n    ${s.snippet}\n    ${s.url}`
        ).join("\n\n");

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        coverageBrief: brief,
        sources: all,
        counts: { press: pressSources.length, data: dataSources.length, total: all.length },
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Research failed", detail: String(err).slice(0, 500) }),
    };
  }
};
