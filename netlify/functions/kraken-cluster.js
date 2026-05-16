// netlify/functions/kraken-cluster.js
//
// First synthesis call: cluster the 50 framings into 10 attractors AND
// expand each into a finalized story. Returns:
//   { cluster_map, top_stories }
//
// Designed to finish under ~7 seconds so it fits comfortably in Netlify's
// default 10-second function timeout. Uses gpt-4o-mini.

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL_SYNTH || "gpt-4o-mini";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const SYSTEM = `You cluster narrative framings into stable attractors and expand
the top 10 into finalized story descriptions.

You are the first synthesis layer of the Kraken — a Monte Carlo predictive
newsroom engine.

ESV (Editorial Success Value) composite:
- Clarity, novelty against saturation, emotional activation,
  cross-audience appeal, diffusion potential, rejection resistance,
  evidence groundability.

Output strict JSON. No markdown. No preamble. Be concise.

{
  "input_echo": "<one-sentence restatement of what was analyzed>",
  "cluster_map": {
    "attractors": [
      {
        "rank": 1,
        "id": "c1",
        "label": "<3-5 word cluster label>",
        "esv": 0.92,
        "saturation_risk": "low",
        "weight": 0.92
      }
    ],
    "narrative_distribution_note": "<1-2 sentence read on the result space>"
  },
  "top_stories": [
    {
      "rank": 1,
      "cluster_id": "c1",
      "story_title": "<working title, not a headline>",
      "frame": "<interpretive lens anchoring this story>",
      "core_hook": "<the psychological hook>",
      "survives_filter_because": "<1-2 sentence editorial defense>",
      "audience_resonance": "<who wants this and why>",
      "publication_tier_likelihood": "<tier of outlet most likely to publish>",
      "example_headline": "<one finished headline>"
    }
  ]
}

RULES:
- attractors AND top_stories must each contain exactly 10 items.
- rank 1-10, descending ESV.
- saturation_risk: "low" | "medium" | "high"
- esv, weight: 0-1 numbers
- Avoid generic startup/AI/disruption framing.`;

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
  const framings = Array.isArray(body.framings) ? body.framings : [];
  const coverageBrief = body.coverageBrief || "";

  if (!input || framings.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing input or framings" }) };
  }

  const framingsCompact = framings.map((f, i) =>
    `[${i + 1}] (${f.lens || "?"}) ${f.headline_seed || "(no seed)"}\n    angle: ${f.angle || "—"}\n    tension: ${f.core_tension || "—"}\n    novelty: ${f.novelty_note || "—"}`
  ).join("\n\n");

  const userMessage = `INPUT: ${input}

COVERAGE BRIEF:
${coverageBrief || "(none)"}

50 CANDIDATE FRAMINGS:
${framingsCompact}

Cluster these into 10 stable attractors. Expand the top 10 into finalized stories. Return strict JSON.`;

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
        temperature: 0.55,
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
      return { statusCode: 500, body: JSON.stringify({ error: "Cluster returned invalid JSON", detail: raw.slice(0, 400) }) };
    }
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "Cluster failed", detail: String(err).slice(0, 500) }) };
  }
};
