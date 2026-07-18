import { GoogleGenAI, Type } from '@google/genai';

/**
 * AI issue triage via Google Gemini.
 *
 * CONTRACT: this function NEVER throws and ALWAYS resolves to a valid triage
 * object of the fixed shape below. On timeout, invalid JSON, a missing API key,
 * or any API error it returns a safe fallback — issue submission must never be
 * blocked by an AI failure.
 *
 * The GEMINI_API_KEY is read from the environment and is never logged or
 * returned to callers.
 */

const MODEL = 'gemini-2.5-flash';
const TIMEOUT_MS = 8000;

const SYSTEM_INSTRUCTION = [
  'You are a maintenance issue triage assistant for a facilities/asset team.',
  'Given an asset and a complaint, classify the issue and suggest safe first checks.',
  'Safety rules (hard constraints):',
  '- NEVER give unsafe electrical, mechanical, fire, or medical instructions.',
  '- Do NOT tell anyone to open panels, bypass safety devices, handle live wiring,',
  '  work on pressurized/hot systems, or perform anything hazardous themselves.',
  '- For ANYTHING safety-related, ALWAYS include the exact string',
  '  "Recommend qualified technician inspection" as one of the initialChecks.',
  'Keep suggestions short, practical, and non-hazardous.',
].join('\n');

// Enforced response shape (matches the required contract exactly).
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    category: { type: Type.STRING },
    priority: { type: Type.STRING, enum: ['Low', 'Medium', 'High', 'Critical'] },
    possibleCauses: { type: Type.ARRAY, items: { type: Type.STRING } },
    initialChecks: { type: Type.ARRAY, items: { type: Type.STRING } },
    recurringPatternWarning: { type: Type.STRING, nullable: true },
  },
  required: [
    'title',
    'category',
    'priority',
    'possibleCauses',
    'initialChecks',
    'recurringPatternWarning',
  ],
  propertyOrdering: [
    'title',
    'category',
    'priority',
    'possibleCauses',
    'initialChecks',
    'recurringPatternWarning',
  ],
};

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

/**
 * Deterministic, safe fallback used whenever the AI can't be trusted/reached.
 */
const buildFallback = (complaint = '') => {
  const words = String(complaint).trim().split(/\s+/).filter(Boolean).slice(0, 6);
  const title = words.length ? words.join(' ') : 'New reported issue';
  return {
    title,
    category: '',
    priority: 'Medium',
    possibleCauses: [],
    initialChecks: [],
    recurringPatternWarning: null,
  };
};

/**
 * Coerce the model output into the strict contract, dropping anything unexpected.
 * Returns null if the payload is unusable (caller then falls back).
 */
const normalize = (raw) => {
  if (!raw || typeof raw !== 'object') return null;

  const priority = PRIORITIES.includes(raw.priority) ? raw.priority : 'Medium';
  const toStringArray = (v) =>
    Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];

  if (typeof raw.title !== 'string' || typeof raw.category !== 'string') return null;

  return {
    title: raw.title,
    category: raw.category,
    priority,
    possibleCauses: toStringArray(raw.possibleCauses),
    initialChecks: toStringArray(raw.initialChecks),
    recurringPatternWarning:
      typeof raw.recurringPatternWarning === 'string' ? raw.recurringPatternWarning : null,
  };
};

/**
 * Reject after `ms`, clearing the timer so it never dangles.
 */
const withTimeout = (promise, ms) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('AI triage timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

/**
 * @param {object} input
 * @param {string} input.category  asset category
 * @param {string} input.condition asset condition
 * @param {string} input.location  asset location
 * @param {string} input.historySummary short recent-history summary
 * @param {string} input.complaint the reporter's natural-language complaint
 * @returns {Promise<object>} always-valid triage object
 */
export const triageComplaint = async ({
  category,
  condition,
  location,
  historySummary,
  complaint,
} = {}) => {
  // No key configured → don't attempt a call; fall back immediately.
  if (!process.env.GEMINI_API_KEY) {
    return buildFallback(complaint);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = [
      'Asset context:',
      `- Category: ${category || 'unknown'}`,
      `- Condition: ${condition || 'unknown'}`,
      `- Location: ${location || 'unknown'}`,
      `- Recent history: ${historySummary || 'none'}`,
      '',
      'Reporter complaint:',
      String(complaint || '').trim(),
      '',
      'Classify this issue and respond with the required JSON only.',
      'If recent history suggests this problem has happened before, set',
      'recurringPatternWarning to a short note; otherwise null.',
    ].join('\n');

    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.2,
        },
      }),
      TIMEOUT_MS,
    );

    const parsed = JSON.parse(response.text);
    const normalized = normalize(parsed);
    return normalized || buildFallback(complaint);
  } catch (err) {
    // Log a generic message only — never the API key or full config.
    console.warn('AI triage unavailable, using fallback:', err?.message || 'unknown error');
    return buildFallback(complaint);
  }
};
