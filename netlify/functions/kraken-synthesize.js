// netlify/functions/kraken-synthesize.js
//
// Takes 50 framings + the coverage brief, clusters them into 10 stable
// attractors, ranks by ESV, and expands into the full 6-section Kraken Report.
//
// POST body: { input: string, framings: [...], coverageBrief: string }
// Response:  { report: { input_echo, cluster_map, top_stories, top_pitches,
//                         top_headlines, top_insights, top_placements } }

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL_SYNTH || "gpt-4o";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const SYSTEM = `You are the final synthesis layer of the Kraken — a Monte Carlo
predictive newsroom engine. You take 50 candidate framings produced by 5
different interpretive lenses, cluster them, rank the clusters by their
Editorial Success Value (ESV), and produce a complete predictive report.

ESV is a composite of:
- Clarity (a senior editor must grasp it in one sentence)
- Novelty against current saturation (the coverage brief shows what's been done)
- Emotional activation (curiosity, tension, surprise, recognition)
- Cross-audience appeal (not too niche)
- Diffusion potential (does this travel beyond its first publication)
- Rejection resistance (would survive a pitch meeting with skeptical editors)
- Evidence groundability (real data exists to support it)

You produce 10 stable attractor clusters. Each cluster is the most likely
"story gravity well" given the input.

Output STRICT JSON. No markdown. No preamble. Be concise — every field should
be at most 1-2 sentences unless the schema asks for more.

Schema:

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
    "narrative_distribution_note": "<1-2 sentence read on the shape of the result space>"
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
  ],
  "top_pitches": [
    {
      "rank": 1,
      "cluster_id": "c1",
      "subject_line": "<email subject, < 70 chars>",
      "body": "<3-4 sentence pitch body, hook first, offer last>",
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
  ],
  "top_insights": [
    {
      "rank": 1,
      "cluster_id": "c1",
      "insight": "<1-2 sentence non-obvious signal>",
      "type": "structural",
      "why_it_feels_revealed": "<1 sentence on why it feels discovered>"
    }
  ],
  "top_placements": [
    {
      "rank": 1,
      "cluster_id": "c1",
      "outlet_archetype": "<e.g. 'National economics desk', 'Trade publication for ___'>",
      "specific_outlets": ["<example 1>", "<example 2>", "<example 3>"],
      "framing_adjustment": "<how the angle shifts for this outlet>",
      "fit_score": 0.85
    }
  ]
}

RULES:
- Each of the 5 main lists must contain exactly 10 items, ranked 1-10 by ESV descending.
- The 'type' field in top_insights must be one of: structural, behavioral, economic, cultural, technological.
- The 'saturation_risk' field must be one of: low, medium, high.
- The 'esv', 'weight', 'fit_score' fields must be numbers between 0 and 1.
- Every cluster_id should appear exactly once per section.
- Avoid generic startup/AI/disruption framing.
- If the coverage brief is empty, lower confidence and note in narrative_distribution_note.`;

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  if (!OPENAI_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "OPENAI_API_KEY not set" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const input = (body.input || "").trim();
  const framings = Array.isArray(body.framings) ? body.framings : [];
  const coverageBrief = body.coverageBrief || "";

  if (!input || framings.length === 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing input or framings" }),
    };
  }

  // Compact framings to fit comfortably in the prompt
  const framingsCompact = framings
    .map((f, i) =>
      `[${i + 1}] (${f.lens || "?"}) ${f.headline_seed || "(no seed)"}\n    angle: ${f.angle || "—"}\n    tension: ${f.core_tension || "—"}\n    novelty: ${f.novelty_note || "—"}`
    )
    .join("\n\n");

  const userMessage = `INPUT: ${input}

COVERAGE BRIEF:
${coverageBrief || "(none)"}

50 CANDIDATE FRAMINGS (across 5 interpretive lenses):
${framingsCompact}

Cluster these 50 framings into the 10 strongest stable attractors. Rank by ESV.
Produce the full report per the schema. Return strict JSON.`;

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
        max_tokens: 8000,    // bumped from 6500 to avoid truncation
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `OpenAI ${res.status}`, detail: errText.slice(0, 500) }),
      };
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    let report;
    try {
      report = JSON.parse(raw);
    } catch (err) {
      // If JSON parse failed, expose the first 400 chars so we can diagnose
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Synthesis returned invalid JSON",
          detail: raw.slice(0, 400),
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Synthesis failed", detail: String(err).slice(0, 500) }),
    };
  }
};
