// kraken-research.js — Tavily grounding pass.
// POST { input } → { coverageBrief, sources }

const TAVILY = "https://api.tavily.com/search";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  if (!process.env.TAVILY_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "TAVILY_API_KEY not set" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) }; }
  const input = (body.input || "").trim();
  if (input.length < 8) {
    return { statusCode: 400, body: JSON.stringify({ error: "Input too short" }) };
  }

  try {
    const res = await fetch(TAVILY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: input,
        search_depth: "basic",
        max_results: 6,
        include_answer: false,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { statusCode: 500, body: JSON.stringify({ error: `Tavily ${res.status}`, detail: errText.slice(0, 300) }) };
    }
    const data = await res.json();
    const sources = (data.results || []).slice(0, 6).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: (r.content || "").slice(0, 280),
    }));
    const brief = sources.length === 0
      ? "(No coverage retrieved.)"
      : sources.map((s, i) => `[${i + 1}] ${s.title}\n    ${s.snippet}`).join("\n\n");
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coverageBrief: brief, sources }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "Research failed", detail: String(err).slice(0, 300) }) };
  }
};
