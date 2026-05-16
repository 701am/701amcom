// kraken-placements.js — 10 publication targets from clusters.
// POST { input, cluster_map } → { top_placements }

const URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const SYSTEM = `You predict 10 publication targets from 10 attractor clusters.

Output strict JSON. No markdown.

{
  "top_placements": [
    {
      "rank": 1,
      "cluster_id": "c1",
      "outlet_archetype": "<e.g. 'National economics desk', 'Founder newsletter'>",
      "specific_outlets": ["<example 1>", "<example 2>", "<example 3>"],
      "framing_adjustment": "<how the angle shifts to fit this outlet>",
      "fit_score": 0.85
    }
  ]
}

Exactly 10 placements. Name 3 real, specific publications per archetype.`;

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  if (!process.env.OPENAI_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "OPENAI_API_KEY not set" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) }; }
  const input = (body.input || "").trim();
  const clusters = body.cluster_map?.attractors || [];
  if (!input || clusters.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing input or clusters" }) };
  }

  const c = clusters.map((x) =>
    `${x.id} (rank ${x.rank}): ${x.label} — ${x.theme || ""}`
  ).join("\n");

  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `INPUT: ${input}\n\nCLUSTERS:\n${c}\n\nProduce 10 publication targets.` },
        ],
        temperature: 0.6,
        response_format: { type: "json_object" },
        max_tokens: 1700,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { statusCode: 500, body: JSON.stringify({ error: `OpenAI ${res.status}`, detail: errText.slice(0, 300) }) };
    }
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: raw,
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "Placements failed", detail: String(err).slice(0, 300) }) };
  }
};
