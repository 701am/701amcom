// kraken-cluster.js — produces only 10 attractor clusters.
// POST { input, framings } → { input_echo, cluster_map: { attractors, narrative_distribution_note } }

const URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const SYSTEM = `You cluster narrative framings into 10 stable attractors and rank by ESV.

ESV = composite of clarity, novelty, emotional activation, audience appeal,
diffusion potential, rejection resistance, and evidence groundability.

Output strict JSON. No markdown. Concise.

{
  "input_echo": "<one-sentence restatement of what was analyzed>",
  "cluster_map": {
    "attractors": [
      {
        "rank": 1,
        "id": "c1",
        "label": "<3-5 word label>",
        "theme": "<one sentence theme>",
        "esv": 0.92,
        "saturation_risk": "low",
        "weight": 0.92
      }
    ],
    "narrative_distribution_note": "<1-2 sentences on the shape of the result space>"
  }
}

Exactly 10 attractors. rank 1-10 descending by ESV. saturation_risk: low|medium|high.`;

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
  const framings = Array.isArray(body.framings) ? body.framings : [];
  if (!input || framings.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing input or framings" }) };
  }

  const f = framings.map((x, i) =>
    `[${i + 1}] (${x.lens || "?"}) ${x.headline_seed || "—"} — ${x.core_tension || "—"}`
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
          { role: "user", content: `INPUT: ${input}\n\n10 FRAMINGS:\n${f}\n\nCluster into 10 attractors.` },
        ],
        temperature: 0.5,
        response_format: { type: "json_object" },
        max_tokens: 1500,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { statusCode: 500, body: JSON.stringify({ error: `OpenAI ${res.status}`, detail: errText.slice(0, 300) }) };
    }
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    try {
      const parsed = JSON.parse(raw);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      };
    } catch {
      return { statusCode: 500, body: JSON.stringify({ error: "Cluster returned invalid JSON", detail: raw.slice(0, 300) }) };
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "Cluster failed", detail: String(err).slice(0, 300) }) };
  }
};
