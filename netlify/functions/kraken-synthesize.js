// netlify/functions/kraken-synthesize.js
//
// The Kraken's final stage. Takes:
// - 50 framings from kraken-ideate
// - The coverage brief from kraken-research
// - The original user input
//
// Produces the complete Kraken Report with all 6 sections:
//   1. Cluster Map     — 10 ranked attractors with weights for the bubble chart
//   2. Top 10 Stories  — finalized story descriptions
//   3. Top 10 Pitches  — pitch-ready email bodies
//   4. Top 10 Headlines — 3-5 variations per story
//   5. Top 10 Insights — non-obvious signals
//   6. Top 10 Placements — predicted publication targets
//
// All in one structured call to keep the output internally consistent.

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
// Use the bigger model here for higher coherence across all 6 sections.
const MODEL = process.env.OPENAI_MODEL_SYNTH || process.env.OPENAI_MODEL || 'gpt-4o';

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

Output STRICT JSON. No markdown. No preamble.

Schema:

{
  "input_echo": "<one-sentence restatement of what was analyzed>",
  "cluster_map": {
    "attractors": [
      {
        "rank": 1,
        "id": "c1",
        "label": "<3-5 word cluster label>",
        "esv": 0.92,                       // 0-1 score
        "framing_lens_mix": { "economic": 4, "cultural": 1, "structural": 3 },
        "saturation_risk": "low" | "medium" | "high",
        "weight": 0.92                     // bubble size in viz
      },
      ... 10 items, ranked by ESV descending
    ],
    "narrative_distribution_note": "<1-2 sentence read on the shape of the result space>"
  },
  "top_stories": [
    {
      "rank": 1,
      "cluster_id": "c1",
      "story_title": "<working title, not a headline>",
      "frame": "<the interpretive lens that anchors this story>",
      "core_hook": "<the psychological hook that makes a reader open it>",
      "survives_filter_because": "<2-3 sentence editorial defense>",
      "audience_resonance": "<who actively wants this story and why>",
      "publication_tier_likelihood": "<which tier of outlet will most likely run this — national broadsheet / trade / vertical / regional>",
      "example_headline": "<one finished headline>"
    },
    ... 10 items
  ],
  "top_pitches": [
    {
      "rank": 1,
      "cluster_id": "c1",
      "subject_line": "<email subject line, < 70 chars>",
      "body": "<3-5 sentence pitch body, opening with the hook, ending with the offer>",
      "implied_frame": "<what frame is being sold to the journalist>"
    },
    ... 10 items
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
    },
    ... 10 items
  ],
  "top_insights": [
    {
      "rank": 1,
      "cluster_id": "c1",
      "insight": "<a 1-2 sentence non-obvious signal extracted from the data/framing>",
      "type": "structural" | "behavioral" | "economic" | "cultural" | "technological",
      "why_it_feels_revealed": "<1 sentence on why a reader thinks 'I had not noticed that'>"
    },
    ... 10 items
  ],
  "top_placements": [
    {
      "rank": 1,
      "cluster_id": "c1",
      "outlet_archetype": "<e.g. 'National economics desk', 'Trade publication for ___', 'Newsletter — operator audience'>",
      "specific_outlets": ["<example 1>", "<example 2>", "<example 3>"],
      "framing_adjustment": "<how the angle must shift to fit this outlet>",
      "fit_score": 0.85
    },
    ... 10 items
  ]
}

RULES:
- Do NOT exceed 10 items per section.
- Every cluster_id must appear exactly once per section (1-to-1 alignment).
- ESV scores must be DESCENDING — rank 1 highest, rank 10 lowest.
- Saturation_risk must reflect what the coverage brief actually showed.
- Avoid generic startup/AI/disruption framing. Be specific. Be honest.
- If the coverage brief is empty, lower confidence and note in narrative_distribution_note.`;

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { input, framings, coverageBrief } = body || {};
  if (!input || !Array.isArray(framings) || framings.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Missing input or framings' }),
      { status: 400 }
    );
  }
  if (!process.env.OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'Missing OPENAI_API_KEY' }), { status: 500 });
  }

  // Compact the framings to fit in the prompt window
  const framingsCompact = framings
    .map(
      (f, i) =>
        `[${i + 1}] (${f.lens}) ${f.headline_seed}\n    angle: ${f.angle}\n    tension: ${f.core_tension}\n    novelty: ${f.novelty_note}`
    )
    .join('\n\n');

  const userMessage = `INPUT: ${input}

COVERAGE BRIEF:
${coverageBrief || '(none)'}

50 CANDIDATE FRAMINGS (across 5 interpretive lenses):
${framingsCompact}

Cluster these 50 framings into the 10 strongest stable attractors. Rank by ESV. Produce the full report per the schema. Return strict JSON.`;

  try {
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.55,           // lower temp for consistent ranking
        response_format: { type: 'json_object' },
        max_tokens: 6500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI ${response.status}: ${errText.slice(0, 200)}`);
    }
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '{}';
    let report;
    try { report = JSON.parse(raw); } catch (err) {
      throw new Error('Synthesis returned invalid JSON');
    }

    return new Response(
      JSON.stringify({ report }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Synthesis failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const config = { path: '/api/kraken-synthesize' };
