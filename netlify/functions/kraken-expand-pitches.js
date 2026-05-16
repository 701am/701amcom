// netlify/functions/kraken-expand-pitches.js
//
// Second synthesis call: take the 10 clusters + stories from kraken-cluster
// and produce the pitches and headline sets. Returns:
//   { top_pitches, top_headlines }

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL_SYNTH || "gpt-4o-mini";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const SYSTEM = `You produce journalist-ready pitches and headline sets from
clustered story attractors.

You are the pitch-and-headline layer of the Kraken — a Monte Carlo predictive
newsroom engine.

Output strict JSON. No markdown. No preamble. Be concise.

{
  "top_pitches": [
    {
      "rank": 1,
      "cluster_id": "c1",
      "subject_line": "<email subject, < 70 chars>",
      "body": "<3-4 sentence pitch body. Hook first sentence. Specific offer last.>",
      "implied_frame": "<frame being sold to the journalist>"
    }
  ],
  "top_headlines": [
    {
      "rank": 1,
      "cluster_id": "c1",
      "variations": [
        "<headline v1>",
        "<headline v2>",
        "<headline v3>",
        "<headline v4>",
        "<headline v5>"
      ],
      "format_notes": "<which outlet style each variation suits>"
    }
  ]
}

RULES:
- Both lists must contain exactly 10 items, ranked 1-10.
- Each item's cluster_id and rank must match the input clusters exactly.
- Pitches must read like real human journalists wrote them — not LLM boilerplate.
- Headline variations: mix straight news, feature, data-led, contrarian, question forms.`;

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
    headline: s.example_headline,
  }));

  const userMessage = `INPUT: ${input}

10 STORIES TO PRODUCE PITCHES AND HEADLINES FOR:
${JSON.stringify(ctx, null, 2)}

Produce 10 pitches and 10 headline sets (5 variations each). Return strict JSON.`;

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
      return { statusCode: 500, body: JSON.stringify({ error: "Pitches returned invalid JSON", detail: raw.slice(0, 400) }) };
    }
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "Pitches failed", detail: String(err).slice(0, 500) }) };
  }
};
