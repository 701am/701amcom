// netlify/functions/kraken-ideate.js
//
// Five parallel OpenAI calls — one per interpretive lens — each generating
// 10 distinct narrative framings. Returns 50 framings total.
//
// POST body: { input: string, coverageBrief: string }
// Response:  { framings: [...], lensResults: [...], total: number }

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

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
    }
  ]
}

Return exactly 10 items in the framings array.`;

async function callOpenAILens(input, coverageBrief, lensKey) {
  const lensPrompt = LENS_PROMPTS[lensKey];
  const systemMessage = `${BASE_SYSTEM}\n\n${lensPrompt}`;
  const userMessage = `INPUT: ${input}

RECENT COVERAGE / GROUNDING:
${coverageBrief || "(No prior coverage retrieved. Proceed with lens-driven reasoning.)"}

Generate 10 distinct narrative framings through your assigned lens. Return strict JSON.`;

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
      temperature: 0.9,
      response_format: { type: "json_object" },
      max_tokens: 1800,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || "{}";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.framings)) {
      parsed.framings.forEach((f) => { f.lens = lensKey; });
    }
    return parsed;
  } catch {
    return { lens: lensKey, framings: [] };
  }
}

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
  const coverageBrief = body.coverageBrief || "";
  if (input.length < 8) {
    return { statusCode: 400, body: JSON.stringify({ error: "Input too short" }) };
  }

  try {
    const lensKeys = Object.keys(LENS_PROMPTS);
    const results = await Promise.all(
      lensKeys.map((lens) =>
        callOpenAILens(input, coverageBrief, lens).catch((err) => ({
          lens, framings: [], error: String(err.message || err).slice(0, 200),
        }))
      )
    );

    const allFramings = [];
    let counter = 1;
    for (const r of results) {
      if (Array.isArray(r.framings)) {
        for (const f of r.framings) {
          allFramings.push({ ...f, id: `f${counter++}` });
        }
      }
    }

    // If ALL five lenses failed, surface the error so the user sees something
    // actionable instead of an empty cluster downstream.
    if (allFramings.length === 0) {
      const firstError = results.find((r) => r.error)?.error || "Unknown ideation failure";
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "All lens calls failed", detail: firstError }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        framings: allFramings,
        lensResults: results.map((r) => ({
          lens: r.lens,
          count: Array.isArray(r.framings) ? r.framings.length : 0,
          error: r.error || null,
        })),
        total: allFramings.length,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Ideation failed", detail: String(err).slice(0, 500) }),
    };
  }
};
