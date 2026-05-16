// netlify/functions/build-research.js
//
// POST body: {
//   idea: { title, angle, dataset_hint, archetype },
//   industry: string,
//   geography: string
// }
//
// Returns: { sources: [{ title, url, snippet, source_type }] }

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

function buildQuery(input) {
  // Use the dataset hints from the idea as the spine of the query, plus the industry.
  const datasets = input.idea?.dataset_hint || "";
  const industry = input.industry || "";
  const geography = input.geography && input.geography !== "global" ? input.geography : "";
  return [
    datasets,
    industry,
    geography,
    "public dataset",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 300);
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  if (!TAVILY_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "TAVILY_API_KEY not set" }) };
  }

  let input;
  try {
    input = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  if (!input.idea) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing idea" }) };
  }

  const query = buildQuery(input);

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: "advanced",
        include_answer: false,
        include_raw_content: false,
        max_results: 8,
        // Bias toward authoritative data sources
        include_domains: [
          "bls.gov", "census.gov", "fred.stlouisfed.org", "cdc.gov",
          "fbi.gov", "data.gov", "oecd.org", "worldbank.org", "imf.org",
          "ftc.gov", "sec.gov", "fcc.gov", "epa.gov", "usda.gov",
          "ed.gov", "nces.ed.gov", "nih.gov", "energy.gov",
          "europa.eu", "statista.com", "pewresearch.org",
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Tavily error: ${res.status}`, detail: errText.slice(0, 500) }),
      };
    }

    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];

    // Normalize for consumption by the next step
    const sources = results.slice(0, 6).map((r) => ({
      title: r.title || "Untitled source",
      url: r.url || "",
      snippet: (r.content || "").slice(0, 400),
      source_type: classifyDomain(r.url || ""),
    }));

    // If domain-restricted search returned nothing, fall back to open search
    if (sources.length === 0) {
      const fallback = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query,
          search_depth: "advanced",
          max_results: 6,
        }),
      });
      if (fallback.ok) {
        const fdata = await fallback.json();
        const fresults = Array.isArray(fdata?.results) ? fdata.results : [];
        for (const r of fresults.slice(0, 6)) {
          sources.push({
            title: r.title || "Untitled source",
            url: r.url || "",
            snippet: (r.content || "").slice(0, 400),
            source_type: classifyDomain(r.url || ""),
          });
        }
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sources, query }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server error", detail: String(err).slice(0, 500) }),
    };
  }
};

function classifyDomain(url) {
  if (!url) return "Other";
  const u = url.toLowerCase();
  if (/\.gov(\/|$)/.test(u) || u.includes("europa.eu")) return "Government";
  if (u.includes("oecd.org") || u.includes("worldbank.org") || u.includes("imf.org")) return "International";
  if (u.includes("pewresearch.org")) return "Research";
  if (u.includes("statista.com")) return "Statistics";
  return "Source";
}
