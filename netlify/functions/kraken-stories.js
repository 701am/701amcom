// kraken-stories.js — produces 10 finalized stories.
// POST { input, cluster_map } → { top_stories }

const URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const SYSTEM = `You expand 10 attractor clusters into 10 finalized story descriptions.

Output strict JSON. No markdown.

{
  "top_stories": [
    {
      "rank": 1,
      "cluster_id": "c1",
      "story_title": "<working title, not a headline>",
      "frame": "<interpretive lens>",
      "core_hook": "<psychological hook>",
      "survives_filter_because": "<1-2 sentence editorial defense>",
      "audience_resonance": "<who wants this and why>",
      "publication_tier_likelihood": "<tier most likely to publish>",
      "example_headline": "<one finished headline>"
    }
  ]
}

Exactly 10 stories, ranked 1-10 matching input clusters.`;

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
          { role: "user", content: `INPUT: ${input}\n\nCLUSTERS:\n${c}\n\nExpand into 10 stories.` },
        ],
        temperature: 0.55,
        response_format: { type: "json_object" },
        max_tokens: 1800,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { statusCode: 500, body: JSON.stringify({ error: `OpenAI ${res.status}`, detail: errText.slice(0, 300) }) };
    }
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    try {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: raw,
      };
    } catch {
      return { statusCode: 500, body: JSON.stringify({ error: "Stories returned invalid JSON", detail: raw.slice(0, 300) }) };
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "Stories failed", detail: String(err).slice(0, 300) }) };
  }
};
