// netlify/functions/kraken-expand-pitches.js
//
// Produces 10 pitches + 10 headline sets. Runs TWO PARALLEL OpenAI calls,
// each handling 5 clusters, then merges the result. This keeps each
// individual call's output around 1200 tokens — finishing in 4-6 seconds —
// while still producing the full 10-item deliverable.
//
// POST body: { input, cluster_map, top_stories? }
// Response:  { top_pitches, top_headlines }

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
      "body": "<2-3 sentence pitch body. Hook first. Specific offer last.>",
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
      "format_notes": "<which outlet style each variation suits, in 1 sentence>"
    }
  ]
}

RULES:
- The two output arrays must have ONE ITEM PER CLUSTER provided in input.
- Match cluster_id and rank exactly to the input.
- Pitches must read like real human journalists wrote them — not LLM boilerplate.
- Headline variations: mix straight news, feature, data-led, contrarian, question forms.`;

async function expandBatch(input, clusters) {
  const clusterCompact = clusters.map((c) =>
    `${c.id} (rank ${c.rank}): ${c.label} — ${c.theme || ""}`
  ).join("\n");

  const userMessage = `INPUT: ${input}

CLUSTERS:
${clusterCompact}

Produce ${clusters.length} pitches and ${clusters.length} headline sets (5 variations each), one per cluster. Return strict JSON.`;

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
      max_tokens: 1500,    // tight per-batch, fits in ~5s
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || "{}";
  return JSON.parse(raw);
}

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

  if (!input || clusters.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing input or clusters" }) };
  }

  // Split clusters into two halves and process in parallel
  const half = Math.ceil(clusters.length / 2);
  const batchA = clusters.slice(0, half);          // typically clusters 1-5
  const batchB = clusters.slice(half);             // typically clusters 6-10

  try {
    const [resultA, resultB] = await Promise.all([
      expandBatch(input, batchA),
      expandBatch(input, batchB),
    ]);

    // Merge the two batches in rank order
    const allPitches = [
      ...(resultA.top_pitches || []),
      ...(resultB.top_pitches || []),
    ].sort((x, y) => (x.rank || 99) - (y.rank || 99));

    const allHeadlines = [
      ...(resultA.top_headlines || []),
      ...(resultB.top_headlines || []),
    ].sort((x, y) => (x.rank || 99) - (y.rank || 99));

    if (allPitches.length === 0 && allHeadlines.length === 0) {
      return { statusCode: 500, body: JSON.stringify({ error: "Both pitch batches returned empty" }) };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        top_pitches: allPitches,
        top_headlines: allHeadlines,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "Pitches failed", detail: String(err).slice(0, 500) }) };
  }
};
