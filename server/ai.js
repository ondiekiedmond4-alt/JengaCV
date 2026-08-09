const axios = require('axios');

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// Important: the model must NEVER invent specific numbers, percentages, or
// results the person didn't provide — that would be fabricating their work
// history. Where a bullet lacks a real metric, it should suggest the
// *structure* of a measurable bullet with a bracketed placeholder for the
// person to fill in themselves, not a made-up figure.
const SYSTEM_PROMPT = `You are a CV editing assistant. You review a person's CV content and return concise, practical suggestions in two categories:

1. PROOFREADING: grammar, clarity, tense consistency, and awkward phrasing fixes.
2. MEASURABLE ACHIEVEMENTS: rewrite vague achievement bullets to be outcome-focused and quantifiable, following the pattern "[Action verb] + [what] + [measurable result]" — for example "Achieved the campaign's trading profit target at 20% MoM" instead of "Was responsible for trading campaigns."

CRITICAL RULE: Never invent a specific number, percentage, or result that the person didn't provide. If a bullet lacks a real metric, keep the achievement's substance but insert a bracketed placeholder like "[add %, KSh amount, or time saved]" for the person to fill in themselves. Do not guess plausible-sounding statistics.

Respond ONLY with valid JSON, no markdown fences, no commentary, in exactly this shape:
{
  "overallNotes": "one short sentence of general feedback",
  "suggestions": [
    { "section": "summary" | "experience", "index": 0, "original": "...", "suggestion": "...", "reason": "short reason for the change" }
  ]
}
"index" refers to the position in the experience array when section is "experience" (0 for the first role, 1 for the second, etc.); omit "index" for summary. Only include entries where you actually have a suggestion — don't pad the list. If everything already reads well, return an empty suggestions array.`;

async function proofreadCv({ title, summary, experience }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error('AI proofreading is not configured (ANTHROPIC_API_KEY missing).');
    err.notConfigured = true;
    throw err;
  }

  const userContent = JSON.stringify({
    professionalTitle: title || null,
    summary: summary || null,
    experience: (experience || []).map((e) => ({
      title: e.title, company: e.company, achievements: e.achievements,
    })),
  });

  const res = await axios.post(
    ANTHROPIC_URL,
    {
      model: 'claude-sonnet-5',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Here is the CV content as JSON:\n\n${userContent}` }],
    },
    {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    }
  );

  const textBlock = res.data?.content?.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('AI response had no text content');

  let parsed;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch (e) {
    throw new Error('Could not parse AI response as JSON');
  }
  return parsed;
}

module.exports = { proofreadCv };
