// netlify/functions/kraken-ideate.js
//
// The Kraken's ideation layer.
//
// Runs 5 parallel OpenAI calls with different "lens biases" (economic,
// cultural, structural, behavioral, technological) — each generating 10
// distinct narrative framings of the user's input.
//
// Returns 50 framings total. The cluster-and-synthesize function downstream
// reduces these to 10 stable attractors.
//
// This is the genuine variance layer. Five independent calls with different
// system prompts produce real diversity that one giant call cannot — each
// call doesn't see the others' outputs and can't unconsciously repeat them.

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const LENS_PROMPTS = {
  economic: `You apply an ECONOMIC interpretive lens.
You see prices, capital flows, market structure, incentive distortions,
labor dynamics, and macro forces. You are skeptical of culture-war framing
and prefer mechanisms grounded in measurable money movements.`,

  cultural: `You apply a CULTURAL interpretive lens.
You see identity formation, generational shifts, narrative dominance,
in-group/out-group dynamics, status competition, and the symbolic order.
You treat culture as causal, not downstream.`,

  structural: `You apply a STRUCTURAL / INSTITUTIONAL lens.
You see how rules, regulators, hierarchies, supply chains, networks, and
governance shape outcomes more than individual choice. You favor systemic
explanations over hero-or-villain narratives.`,

  behavioral: `You apply a BEHAVIORAL / PSYCHOLOGICAL lens.
You see cognitive biases, status games, fear cycles, dopamine economics,
attention scarcity, and the gap between stated and revealed preferences.
You are interested in why humans act against their own interests.`,

  technological: `You apply a TECHNOLOGICAL lens.
You see how new capability changes constraint sets, how diffusion S-curves
play out, who captures the gains, what becomes possible that wasn't, and
what the unintended second-order effects look like. You are skeptical of
hype but attentive to genuine capability shifts.`,
};

const BASE_SYSTEM = `You are an editorial ideation engine that generates story
framings under a specific interpretive lens.

Your job: given an input (a dataset, organization, event, trend, or phenomenon)
and a pre-fetched set of recent press coverage about that input, generate
exactly 10 DISTINCT narrative framings that a working journalist might pursue.

Each framing must:
- Be DIFFERENT from the others (no near-duplicates)
- Be specific enough that a senior editor could approve or reject it in 30 seconds
- AVOID generic startup/AI/disruption framing
- AVOID over-saturated angles (the press coverage you receive shows what's
  already been done — propose what HASN'T been written yet)
- Be honest about uncertainty; don't hallucinate specific statistics

Output strict JSON, no preamble, no markdown:

{
  "lens": "<lens name>",
  "framings": [
    {
      "id": "f1",
      "headline_seed": "<short working headline, ~10 words>",
      "angle": "<2-3 sentence statement of the story's spine>",
      "core_tension": "<the friction/contradiction the story exposes>",
      "novelty_note": "<why this hasn't been written yet, given the coverage shown>",
      "evidence_required": "<what data or sources would make this real>"
    },
    ... 10 items total
  ]
}`;

async function callOpenAI(input, coverageBrief, lensKey) {
  const lensPrompt = LENS_PROMPTS[lensKey];
  const systemMessage = `${BASE_SYSTEM}

${lensPrompt}`;

  const userMessage = `INPUT: ${input}

RECENT COVERAGE / GROUNDING:
${coverageBrief || '(No prior coverage retrieved. Proceed with lens-driven reasoning.)'}

Generate 10 distinct narrative framings through your assigned lens. Return strict JSON.`;

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.9,         // high temp for divergence
      response_format: { type: 'json_object' },
      max_tokens: 2200,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI ${response.status}: ${errText.slice(0, 200)}`);
  }
  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || '{}';
  try {
    const parsed = JSON.parse(raw);
    // Tag each framing with its lens
    if (Array.isArray(parsed.framings)) {
      parsed.framings.forEach((f) => { f.lens = lensKey; });
    }
    return parsed;
  } catch {
    return { lens: lensKey, framings: [] };
  }
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { input, coverageBrief } = body || {};
  if (!input || typeof input !== 'string' || input.trim().length < 8) {
    return new Response(JSON.stringify({ error: 'Input too short' }), { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'Missing OPENAI_API_KEY' }), { status: 500 });
  }

  try {
    // 5 PARALLEL CALLS — one per lens
    const lensKeys = Object.keys(LENS_PROMPTS);
    const results = await Promise.all(
      lensKeys.map((lens) =>
        callOpenAI(input, coverageBrief, lens).catch((err) => ({
          lens,
          framings: [],
          error: err.message,
        }))
      )
    );

    // Flatten all framings into one array, re-id sequentially for downstream clustering
    const allFramings = [];
    let counter = 1;
    for (const result of results) {
      if (Array.isArray(result.framings)) {
        for (const f of result.framings) {
          allFramings.push({ ...f, id: `f${counter++}` });
        }
      }
    }

    return new Response(
      JSON.stringify({
        framings: allFramings,
        lensResults: results.map((r) => ({
          lens: r.lens,
          count: Array.isArray(r.framings) ? r.framings.length : 0,
          error: r.error || null,
        })),
        total: allFramings.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Ideation failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const config = { path: '/api/kraken-ideate' };
