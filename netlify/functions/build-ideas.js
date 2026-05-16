// netlify/functions/build-ideas.js
//
// POST body: {
//   industry: string,
//   audience: string,
//   geography: string,
//   position: string,
//   beats: string[]
// }
//
// Returns: { ideas: [{ archetype, title, angle, why_it_works, dataset_hint }] }

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const SYSTEM_PROMPT = `You are the senior strategist at 701am, an earned-media agency that builds data stories for press coverage. Your job is to generate ideas that working journalists would actually want to cover.

A "data story" is a press-ready story built from public data: an index, a ranking, a surprising statistic, a geographic pattern, or a time-series trend. The angle must be specific enough that a reporter could pitch it to their editor in one sentence.

Rules:
- Never use AI cliches: leverage, robust, transformative, seamless, innovative, empowering, cutting-edge, unlock, revolutionize.
- Lead with the journalist's interest, not the company's.
- Every idea must hint at one or two public datasets (BLS, Census, FRED, CDC, OECD, World Bank, FTC, SEC EDGAR, FBI UCR, ACS, FCC, state-level open data, industry trade associations, etc.) that could power it.
- The headlines should sound like real publications wrote them, not like marketing.
- Avoid superlatives ("the best", "the most"). Prefer specific facts.

Output 5 distinct ideas covering different archetypes. Each idea should be a JSON object with:
- archetype: one of "Index", "Ranking", "Surprise Statistic", "Geographic Pattern", "Time-Series Trend"
- title: a working headline a journalist might write (under 12 words, no clickbait)
- angle: 2-3 sentences explaining what the story is and why a reporter would care
- why_it_works: 1-2 sentences on the journalistic hook (timeliness, controversy, novelty, scale)
- dataset_hint: 1-2 specific public datasets that could power the story (named, not generic — "BLS QCEW" not "labor data")

Return a single JSON object: { "ideas": [...] }. No prose outside the JSON.`;

function buildUserPrompt(input) {
  return `Generate 5 data-story angles for the following business:

INDUSTRY: ${input.industry}
AUDIENCE: ${input.audience}
GEOGRAPHY: ${input.geography}
WHAT THEY WANT TO BE KNOWN FOR: ${input.position}
PRESS BEATS THEY CARE ABOUT: ${(input.beats || []).join(", ") || "general business press"}

Five ideas, distinct archetypes, each grounded in real public data. JSON only.`;
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

  if (!input.industry || !input.position) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields" }) };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(input) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.85,
        max_tokens: 2200,
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

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { statusCode: 500, body: JSON.stringify({ error: "Could not parse model output", raw: content.slice(0, 500) }) };
    }

    if (!parsed.ideas || !Array.isArray(parsed.ideas)) {
      return { statusCode: 500, body: JSON.stringify({ error: "Output missing 'ideas' array" }) };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ideas: parsed.ideas }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server error", detail: String(err).slice(0, 500) }),
    };
  }
};
