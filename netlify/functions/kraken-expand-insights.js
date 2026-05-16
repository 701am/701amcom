// netlify/functions/kraken-expand-insights.js
//
// Third synthesis call: take the 10 clusters + stories from kraken-cluster
// and produce the non-obvious insights and publication placements. Returns:
//   { top_insights, top_placements }

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL_SYNTH || "gpt-4o-mini";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const SYSTEM = `You extract non-obvious insights and predict publication
placements from clustered story attractors.

You are the insight-and-placement layer of the Kraken — a Monte Carlo
predictive newsroom engine.

Output strict JSON. No markdown. No preamble. Be concise.

{
  "top_insights": [
    {
      "rank": 1,
      "cluster_id": "c1",
      "insight": "<1-2 sentence non-obvious signal. Should feel discovered, not deduced.>",
      "type": "structural",
      "why_it_feels_revealed": "<1 sentence on why a reader thinks 'I had not noticed that'>"
    }
  ],
  "top_placements": [
    {
      "rank": 1,
      "cluster_id": "c1",
      "outlet_archetype": "<e.g. 'National economics desk', 'Trade publication for X', 'Founder newsletter'>",
      "specific_outlets": ["<example 1>", "<example 2>", "<example 3>"],
      "framing_adjustment": "<how the angle must shift to fit this outlet>",
      "fit_score": 0.85
    }
  ]
}

RULES:
- Both lists must contain exactly 10 items, ranked 1-10.
- type must be one of: "structural" | "behavioral" | "economic" | "cultural" | "technological"
- fit_score: 0-1 number
- Each cluster_id and rank must match the input clusters/stories exactly.
- Insights must be SPECIFIC. Generic observations ("X is changing") are not insights.
- Placements: name 3 real, specific publications per archetype. Real outlets.`;

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  if (!OPENAI_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "OPENAI_API_KEY not set" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const input = (body.input || "").trim();
  const clusters = Array.isArray(body.cluster_map?.attractors) ? body.cluster_map.attractors : [];
  const stories = Array.isArray(body.top_stories) ? body.top_stories : [];

  if (!input || clusters.length === 0 || stories.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing input, clusters, or stories" }) };
  }

  const ctx = stories.map((s) => ({
    rank: s.rank,
    cluster_id: s.cluster_id,
    title: s.story_title,
    frame: s.frame,
    hook: s.core_hook,
    audience: s.audience_resonance,
    tier: s.publication_tier_likelihood,
  }));

  const userMessage = `INPUT: ${input}

10 STORIES TO PRODUCE INSIGHTS AND PLACEMENTS FOR:
${JSON.stringify(ctx, null, 2)}

Produce 10 non-obvious insights and 10 publication-target predictions. Return strict JSON.`;

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMessage },
        ],
        temperature: 0.6,
        response_format: { type: "json_object" },
        max_tokens: 3500,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { statusCode: 500, body: JSON.stringify({ error: `OpenAI ${res.status}`, detail: errText.slice(0, 500) }) };
    }
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch {
      return { statusCode: 500, body: JSON.stringify({ error: "Insights returned invalid JSON", detail: raw.slice(0, 400) }) };
    }
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "Insights failed", detail: String(err).slice(0, 500) }) };
  }
};
