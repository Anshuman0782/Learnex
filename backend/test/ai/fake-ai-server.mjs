// A local stand-in for the Gemini and Groq HTTP APIs, used by ai-e2e.mjs.
// It checks that our requests have the real APIs' shape, records them, and
// answers according to a scenario the test controls (scores, outages, 429s,
// broken JSON). Never used in production.
import http from 'node:http';

export function startFakeAi(port) {
  const calls = [];
  const S = {
    gemini: { mode: 'ok', times: Infinity }, // 'ok' | '429' | '429day' | '503' | 'garbage' | '401'
    groq: { mode: 'ok', times: Infinity },
    score: { coding: 70, codingTest: 90, critique: 85, music: 60, english: 70 },
    codingQueue: [],
    confidence: 0.9,
    taskCompliance: 90,
    transcript: 'hello my name is test orange river seven and today I will talk about learning',
    spokenIntro: '',
    whisperText: null,
  };

  const schemaKeys = (prompt) => {
    const m = /"scores": \{([^}]*)\}/.exec(prompt);
    if (!m) return [];
    return [...m[1].matchAll(/"(\w+)":/g)].map((x) => x[1]);
  };

  function classify(system, prompt) {
    if (prompt.includes('Return {"ok": true}')) return 'ping';
    if (system.includes('precise transcription')) return 'transcribe';
    if (system.includes('programming mentor reviewing')) return 'coding';
    if (system.includes('grading a timed MENTOR')) return 'codingTest';
    if (system.includes('assess whether an applicant can MENTOR')) return 'critique';
    if (system.includes('music teacher')) return 'music';
    if (system.includes('spoken-English') || system.includes('spoken-english')) return 'english';
    return 'unknown';
  }

  function answer(kind, prompt) {
    if (kind === 'ping') return { ok: true };
    if (kind === 'transcribe') return { text: S.transcript };
    const keys = schemaKeys(prompt);
    let score = S.score[kind] ?? 70;
    if (kind === 'coding' && S.codingQueue.length) score = S.codingQueue.shift();
    const scores = Object.fromEntries(keys.map((k) => [k, score]));
    return {
      scores,
      strengths: ['Clear structure'],
      improvements: ['Handle edge cases'],
      summary: `Fake ${kind} review.`,
      confidence: S.confidence,
      taskCompliance: S.taskCompliance,
      spokenIntro: S.spokenIntro,
      transcript: S.transcript,
      missedIssues: [],
    };
  }

  function failure(res, mode) {
    if (mode === '429') return res.writeHead(429).end(JSON.stringify({ error: { message: 'Resource exhausted (per minute)' } }));
    if (mode === '429day') return res.writeHead(429).end(JSON.stringify({ error: { message: 'Quota exceeded: RequestsPerDay' } }));
    if (mode === '503') return res.writeHead(503).end('{"error":"overloaded"}');
    if (mode === '401') return res.writeHead(401).end('{"error":"bad key"}');
    return null;
  }

  const take = (p) => {
    const st = S[p];
    if (st.mode === 'ok') return 'ok';
    if (st.times <= 0) return 'ok';
    st.times -= 1;
    return st.mode;
  };

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/json');
      try {
        // ---------------- Gemini ----------------
        const gm = /^\/v1beta\/models\/([^:]+):generateContent$/.exec(req.url);
        if (gm) {
          const body = JSON.parse(raw.toString());
          const parts = body?.contents?.[0]?.parts ?? [];
          const prompt = parts.map((p) => p.text ?? '').join('\n');
          const media = parts.find((p) => p.inlineData);
          const system = body?.systemInstruction?.parts?.[0]?.text ?? '';
          const kind = classify(system, prompt);
          calls.push({
            provider: 'gemini',
            kind,
            model: gm[1],
            key: req.headers['x-goog-api-key'],
            json: body?.generationConfig?.responseMimeType,
            mediaMime: media?.inlineData?.mimeType ?? null,
            mediaBytes: media ? Buffer.from(media.inlineData.data, 'base64').length : 0,
            prompt,
            system,
          });
          const mode = take('gemini');
          if (failure(res, mode) !== null) return;
          const text = mode === 'garbage' ? 'Sure! Here is my opinion, no JSON today.' : '```json\n' + JSON.stringify(answer(kind, prompt)) + '\n```';
          return res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }));
        }
        // ---------------- Groq chat ----------------
        if (req.url === '/openai/v1/chat/completions') {
          const body = JSON.parse(raw.toString());
          const system = body.messages?.find((m) => m.role === 'system')?.content ?? '';
          const prompt = body.messages?.find((m) => m.role === 'user')?.content ?? '';
          const kind = classify(system, prompt);
          calls.push({ provider: 'groq', kind, model: body.model, auth: req.headers.authorization, format: body.response_format?.type, prompt, system });
          const mode = take('groq');
          if (failure(res, mode) !== null) return;
          const content = mode === 'garbage' ? 'not json' : JSON.stringify(answer(kind, prompt));
          return res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }));
        }
        // ---------------- Groq Whisper ----------------
        if (req.url === '/openai/v1/audio/transcriptions') {
          const ct = req.headers['content-type'] ?? '';
          const text = raw.toString('latin1');
          calls.push({
            provider: 'groq',
            kind: 'whisper',
            auth: req.headers.authorization,
            multipart: ct.startsWith('multipart/form-data'),
            hasFile: /name="file"; filename="audio\.mp3"/.test(text),
            model: /name="model"\r\n\r\n([^\r]+)/.exec(text)?.[1],
            format: /name="response_format"\r\n\r\n([^\r]+)/.exec(text)?.[1],
            bytes: raw.length,
          });
          const mode = take('groq');
          if (failure(res, mode) !== null) return;
          const words = S.whisperText ?? S.transcript;
          const n = words.split(' ').length;
          return res.end(
            JSON.stringify({
              text: words,
              duration: 60,
              segments: [
                { start: 0.5, end: 20, text: words.split(' ').slice(0, Math.ceil(n / 2)).join(' ') },
                { start: 23, end: 58, text: words.split(' ').slice(Math.ceil(n / 2)).join(' ') },
              ],
            }),
          );
        }
        res.writeHead(404).end('{"error":"not found"}');
      } catch (e) {
        res.writeHead(400).end(JSON.stringify({ error: String(e) }));
      }
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, calls, S })));
}
