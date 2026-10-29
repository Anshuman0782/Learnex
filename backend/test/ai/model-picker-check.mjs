// Checks how we choose a replacement when a provider retires a model.
// Run from backend/ after `npx nest build`:  node test/ai/model-picker-check.mjs
const { pickGeminiModel, pickGroqChatModel, pickGroqWhisperModel, suggestedModel, isModelMissing } = await import(
  new URL('../../dist/modules/ai/providers/model-picker.js', import.meta.url)
);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };

// Gemini — Google's own suggestion wins when it's in the list.
const gList = ['gemini-3.8-flash', 'gemini-3.8-flash-lite', 'gemini-3.8-pro', 'gemini-3.9-flash-preview', 'text-embedding-004', 'gemini-3.8-flash-tts', 'gemini-3.8-flash-image', 'gemma-4-27b-it'];
const msg = 'This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.8-flash for the latest features.';
ok(suggestedModel(msg) === 'gemini-3.8-flash', `reads Google's suggested model from the error (${suggestedModel(msg)})`);
ok(pickGeminiModel(gList, 'gemini-3.8-flash') === 'gemini-3.8-flash', 'uses the suggested model when available');
ok(pickGeminiModel(gList, null) === 'gemini-3.8-flash', `without a hint: stable flash, not lite/preview/tts/image (${pickGeminiModel(gList, null)})`);
ok(pickGeminiModel(['gemini-4.0-flash', 'gemini-3.8-flash'], null) === 'gemini-4.0-flash', 'newer flash preferred');
ok(pickGeminiModel(['gemini-4.1-pro', 'gemini-4.1-flash-lite'], null) !== null, 'still picks something when no plain flash exists');
ok(pickGeminiModel(['text-embedding-004'], null) === null, 'never picks an embedding-only model');

// Groq — largest general text model; never whisper/guard/tts.
const qList = ['whisper-large-v3', 'whisper-large-v3-turbo', 'llama-3.1-8b-instant', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'meta-llama/llama-guard-4-12b', 'playai-tts', 'meta-llama/llama-4-maverick-17b-128e-instruct'];
ok(pickGroqChatModel(qList) === 'openai/gpt-oss-120b', `largest text model chosen (${pickGroqChatModel(qList)})`);
ok(!/whisper|guard|tts/.test(pickGroqChatModel(qList)), 'no speech / safety / tts model as judge');
ok(pickGroqWhisperModel(qList) === 'whisper-large-v3-turbo', 'whisper turbo preferred for speech-to-text');
ok(pickGroqChatModel(['llama-9-70b-versatile', 'llama-9-8b-instant']) === 'llama-9-70b-versatile', 'bigger llama preferred');

// Which errors mean "model gone".
ok(isModelMissing(404, '{"error":{"code":"model_not_found"}}'), '404 = model missing');
ok(isModelMissing(400, '{"error":{"message":"The model `x` has been decommissioned","code":"model_decommissioned"}}'), 'decommissioned (400) = model missing');
ok(!isModelMissing(400, '{"error":{"message":"bad request: messages required"}}'), 'other 400s are not treated as a missing model');
ok(!isModelMissing(429, 'rate limit'), '429 is not a missing model');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
