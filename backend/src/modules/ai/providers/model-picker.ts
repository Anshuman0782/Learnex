/**
 * Providers retire model names over time (a name that works today can return
 * "404 model not found" next month). Instead of hard-coding one name, we ask
 * the provider which models it currently offers and pick the best fit. These
 * rules are pure functions so they're easy to test.
 */

const versionOf = (name: string): number => {
  const m = /(\d+(?:\.\d+)?)/.exec(name);
  return m ? Number.parseFloat(m[1]) : 0;
};

/**
 * Best Gemini model for judging: a general text+audio model, preferring the
 * fast "flash" family (higher free limits), stable over preview, newest first.
 * `hint` = a model the provider itself suggested in an error message.
 */
export function pickGeminiModel(available: string[], hint?: string | null): string | null {
  const names = available.map((n) => n.replace(/^models\//, ''));
  if (hint && names.includes(hint)) return hint;
  const usable = names.filter(
    (n) =>
      /^gemini-/.test(n) &&
      !/(embed|tts|image|imagen|live|native-audio|dialog|robotics|computer-use|aqa|learnlm|veo|exp-\d|thinking)/i.test(n),
  );
  if (usable.length === 0) return hint ?? null;
  const score = (n: string) =>
    (/flash/.test(n) ? 1000 : 0) + // fast + generous free tier
    (/lite/.test(n) ? -300 : 0) + // lighter = weaker judge
    (/(preview|exp)/.test(n) ? -200 : 0) + // prefer stable
    (/latest$/.test(n) ? 50 : 0) +
    versionOf(n) * 10;
  return [...usable].sort((a, b) => score(b) - score(a) || a.localeCompare(b))[0];
}

/** Parameter count in billions from a model id ("llama-3.3-70b" → 70). */
const billions = (id: string): number => {
  const m = /(\d+(?:\.\d+)?)\s*b\b/i.exec(id.replace(/[-_]/g, ' '));
  return m ? Number.parseFloat(m[1]) : 0;
};

/** Best Groq chat model for judging: the largest general text model available. */
export function pickGroqChatModel(available: string[]): string | null {
  const usable = available.filter(
    (id) => !/(whisper|tts|playai|guard|embed|distil|prompt-guard|safeguard|vision|compound|orpheus)/i.test(id),
  );
  if (usable.length === 0) return null;
  const score = (id: string) =>
    Math.min(billions(id), 500) +
    (/(versatile|instruct|gpt-oss|maverick|kimi|qwen)/i.test(id) ? 20 : 0) +
    (/(preview|exp)/i.test(id) ? -15 : 0);
  return [...usable].sort((a, b) => score(b) - score(a) || a.localeCompare(b))[0];
}

/** Best Groq speech-to-text model (Whisper). */
export function pickGroqWhisperModel(available: string[]): string | null {
  const w = available.filter((id) => /whisper/i.test(id));
  if (w.length === 0) return null;
  const score = (id: string) => (/large-v3-turbo/.test(id) ? 30 : /large-v3/.test(id) ? 20 : /large/.test(id) ? 10 : 0) - (/distil/.test(id) ? 5 : 0);
  return [...w].sort((a, b) => score(b) - score(a))[0];
}

/** The model a 404 message tells us to use instead, e.g. "...use models/gemini-3.8-flash...". */
export function suggestedModel(message: string): string | null {
  // "...models/<old> is no longer available... use models/<new> ..." → <new>
  const after = /use\s+(?:the\s+)?(?:model\s+)?models\/(gemini-[A-Za-z0-9.\-]*[A-Za-z0-9])/i.exec(message);
  if (after) return after[1];
  const all = [...message.matchAll(/models\/(gemini-[A-Za-z0-9.\-]*[A-Za-z0-9])/g)].map((m) => m[1]);
  return all.length > 1 ? all[all.length - 1] : null; // a single mention is the failing model itself
}

/** Is this error a "model does not exist / not available" error? */
export function isModelMissing(status: number, body: string): boolean {
  if (status === 404) return true;
  return status === 400 && /(model[^"]*(not found|does not exist|decommissioned|no longer|not supported|is not available))|model_not_found|model_decommissioned/i.test(body);
}
