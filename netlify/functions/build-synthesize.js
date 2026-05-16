// netlify/functions/build-synthesize.js
//
// POST body: {
//   idea: { archetype, title, angle, why_it_works, dataset_hint },
//   sources: [{ title, url, snippet, source_type }],
//   context: { industry, audience, geography, position, beats }
// }
//
// Returns: {
//   headline, deck, methodology[], pitch: {subject, body},
//   reporters[], roadmap[]: { week, action, deliverable }
// }

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL_SYNTH = process.env.OPENAI_MODEL_SYNTH || process.env.OPENAI_MODEL || "gpt-4o-mini";

const SYSTEM_PROMPT = `You are the senior strategist at 701am, an earned-media agency. You write strategy memos that a working CEO and a working journalist would both respect.

You have just been given:
- A data-story angle a client wants to pursue
- A list of public datasets the research desk found
- Context about the client's industry, audience, and position

Your output is the complete strategy: the working headline, the methodology, the pitch email a reporter would actually open, a list of reporter beats to target, and a four-week execution roadmap.

Rules:
- Subject lines under 50 characters. Pitch body under 150 words. One specific ask per pitch.
- Never use AI cliches: leverage, robust, transformative, seamless, innovative, empowering, cutting-edge, unlock, revolutionize, paradigm, ecosystem.
- Never open with "I hope this finds you well." Open with the angle.
- Methodology should be replicable — a reporter looking at it should understand exactly how the dataset becomes the story.
- Reporters: name beats (e.g. "labor economics reporters at WSJ, Bloomberg, NYT business desk"), not generic categories.
- The roadmap is four weeks: source, build, pitch, place. Each week has one specific deliverable.

Output a single JSON object with this exact shape:

{
  "headline": "string (under 14 words, the working press headline)",
  "deck": "string (one sentence under 30 words, the subhead)",
  "methodology": [
    "string (step 1, e.g. 'Pull BLS QCEW Q3 data for the 50 largest metros')",
    "string (step 2)",
    "string (step 3)",
    "string (step 4)"
  ],
  "pitch": {
    "subject": "string (under 50 chars)",
    "body": "string (under 150 words, opens with the angle, ends with a specific ask)"
  },
  "reporters": [
    { "beat": "string", "outlets": "string (e.g. 'WSJ, Bloomberg, FT')" },
    { "beat": "string", "outlets": "string" },
    { "beat": "string", "outlets": "string" }
  ],
  "roadmap": [
    { "week": 1, "phase": "Source", "action": "string", "deliverable": "string" },
    { "week": 2, "phase": "Build", "action": "string", "deliverable": "string" },
    { "week": 3, "phase": "Pitch", "action": "string", "deliverable": "string" },
    { "week": 4, "phase": "Place", "action": "string", "deliverable": "string" }
  ],
  "north_star": "string (one Mandino-style aphorism, 12-20 words, the editorial principle this campaign is built on)"
}

No prose outside the JSON.`;

function buildUserPrompt({ idea, sources, context }) {
  const sourceLines = (sources || []).slice(0, 6).map((s, i) =>
    `[${i + 1}] ${s.source_type}: ${s.title}\n    ${s.url}\n    ${s.snippet}`
  ).join("\n\n");

  return `Client context:
- Industry: ${context.industry}
- Audience: ${context.audience}
- Geography: ${context.geography}
- Position: ${context.position}
- Beats: ${(context.beats || []).join(", ")}

The chosen angle:
- Archetype: ${idea.archetype}
- Working title: ${idea.title}
- Angle: ${idea.angle}
- Why it works: ${idea.why_it_works}
- Dataset hint: ${idea.dataset_hint}

Public sources the research desk found:
${sourceLines || "(no specific sources surfaced; use the dataset hints from the angle and your own knowledge of common public datasets in this area)"}

Build the complete strategy memo as a JSON object per the schema. JSON only.`;
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  if (!OPENAI_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "OPENAI_API_KEY not set" }) };
  }

  let input;
  try {
    input = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  if (!input.idea || !input.context) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing idea or context" }) };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL_SYNTH,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(input) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.75,
        max_tokens: 2400,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `OpenAI error: ${res.status}`, detail: errText.slice(0, 500) }),
      };
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return { statusCode: 500, body: JSON.stringify({ error: "Empty response from OpenAI" }) };
    }

    let memo;
    try {
      memo = JSON.parse(content);
    } catch {
      return { statusCode: 500, body: JSON.stringify({ error: "Could not parse model output", raw: content.slice(0, 500) }) };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memo, sources: input.sources || [] }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server error", detail: String(err).slice(0, 500) }),
    };
  }
};
