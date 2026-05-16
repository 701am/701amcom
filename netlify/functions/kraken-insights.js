// kraken-insights.js — 10 non-obvious insights from clusters.
// POST { input, cluster_map } → { top_insights }

const URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const SYSTEM = `You extract 10 non-obvious insights from 10 attractor clusters.
Insights should feel discovered, not deduced.

Output strict JSON. No markdown.

{
  "top_insights": [
    {
      "rank": 1,
      "cluster_id": "c1",
      "insight": "<1-2 sentence non-obvious signal>",
      "type": "structural",
      "why_it_feels_revealed": "<1 sentence on why it feels discovered>"
    }
  ]
}

Exactly 10 insights. type: structural|behavioral|economic|cultural|technological.
Be SPECIFIC. Generic observations are not insights.`;

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
          { role: "user", content: `INPUT: ${input}\n\nCLUSTERS:\n${c}\n\nProduce 10 insights.` },
        ],
        temperature: 0.65,
        response_format: { type: "json_object" },
        max_tokens: 1600,
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
    return { statusCode: 500, body: JSON.stringify({ error: "Insights failed", detail: String(err).slice(0, 300) }) };
  }
};
