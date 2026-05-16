// netlify/functions/kraken-research.js
//
// Grounding pass for the Kraken. Before ideation runs, we hand the model
// the recent press coverage about the input topic so that:
// 1) Generated framings know what's already been written (avoid duplication)
// 2) The "saturation penalty" can be honestly applied
// 3) Generated novelty_notes have grounding for "this hasn't been done yet"
//
// Uses Tavily for the search. Returns a compact coverage brief — title + url
// + snippet for each result, plus a small list of detected dataset/source
// mentions extracted from the snippets.

const TAVILY_URL = 'https://api.tavily.com/search';

const DATA_SOURCE_HINTS = [
  'bls.gov', 'census.gov', 'fred.stlouisfed.org', 'cdc.gov', 'nih.gov',
  'sec.gov', 'fda.gov', 'usda.gov', 'noaa.gov', 'nasa.gov',
  'data.gov', 'oecd.org', 'imf.org', 'worldbank.org', 'who.int',
  'gallup.com', 'pewresearch.org', 'kff.org', 'rand.org',
];

async function searchTavily(query, opts = {}) {
  const response = await fetch(TAVILY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'advanced',
      max_results: opts.maxResults || 8,
      include_answer: false,
      include_raw_content: false,
      include_domains: opts.includeDomains,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Tavily ${response.status}: ${errText.slice(0, 200)}`);
  }
  return response.json();
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { input } = body || {};
  if (!input || typeof input !== 'string' || input.trim().length < 8) {
    return new Response(JSON.stringify({ error: 'Input too short' }), { status: 400 });
  }
  if (!process.env.TAVILY_API_KEY) {
    return new Response(JSON.stringify({ error: 'Missing TAVILY_API_KEY' }), { status: 500 });
  }

  try {
    // Two parallel passes: open press coverage, plus dataset-source-tilted.
    const [pressCoverage, dataCoverage] = await Promise.all([
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

    const press = dedupe(pressCoverage.results).slice(0, 8).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: (r.content || '').slice(0, 320),
      type: 'press',
    }));
    const data = dedupe(dataCoverage.results).slice(0, 6).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: (r.content || '').slice(0, 320),
      type: 'data',
    }));

    const all = [...press, ...data];

    // Build a compact coverage brief that the ideation prompt can consume.
    const brief = all.length === 0
      ? '(No coverage retrieved.)'
      : all
          .map((s, i) =>
            `[${i + 1}] (${s.type.toUpperCase()}) ${s.title}\n    ${s.snippet}\n    ${s.url}`
          )
          .join('\n\n');

    return new Response(
      JSON.stringify({
        coverageBrief: brief,
        sources: all,
        counts: { press: press.length, data: data.length, total: all.length },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Research failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const config = { path: '/api/kraken-research' };
