// AI Stage 1 end-to-end: learner progress + AI mentor test, against a REAL
// running API (port 3001) and a FAKE Gemini/Groq (port 4555, started here).
//
// Start the API first, pointed at the fake AI:
//   GEMINI_API_KEY=test-gemini GEMINI_BASE_URL=http://127.0.0.1:4555 \
//   GROQ_API_KEY=test-groq GROQ_BASE_URL=http://127.0.0.1:4555 \
//   AI_MIN_GAP_MS=50 PORT=3001 node dist/main
// then:  node test/ai/ai-e2e.mjs
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { startFakeAi } from './fake-ai-server.mjs';

const require = createRequire(new URL('../../package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const ffmpeg = require('ffmpeg-static');
const prisma = new PrismaClient();
const BASE = 'http://127.0.0.1:3001/api/v1';
const envText = fs.readFileSync(new URL('../../.env', import.meta.url), 'utf8');
const SECRET = /^JWT_ACCESS_SECRET=(.*)$/m.exec(envText)[1].trim().replace(/^"|"$/g, '');
const rnd = Math.random().toString(36).slice(2, 7);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const section = (t) => console.log(`\n— ${t}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function j(m, p, t, b) {
  const r = await fetch(BASE + p, { method: m, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: b ? JSON.stringify(b) : undefined });
  const x = await r.text(); let d; try { d = JSON.parse(x); } catch { d = x; } return { status: r.status, data: d };
}
async function upload(token, bytes, mime, name) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mime }), name);
  const r = await fetch(BASE + '/media/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  return { status: r.status, data: await r.json().catch(() => null) };
}
/** Generated audio (mp3) — an in-tune melody, so our pitch analyser has real sound. */
function melodyMp3(seconds) {
  const notes = [440, 493.88, 554.37, 587.33, 659.26];
  const f = notes.map((hz, i) => `between(mod(t,3),${i * 0.6},${(i + 1) * 0.6})*${hz}`).join('+');
  const r = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `aevalsrc='0.5*sin(2*PI*(${f})*t)':s=16000:d=${seconds}`, '-ac', '1', '-b:a', '64k', '-f', 'mp3', 'pipe:1'], { maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(r.stderr.toString());
  return r.stdout;
}
const ids = [];
const mk = async (n, role, skills, extra = {}) => {
  const u = await prisma.user.create({
    data: {
      name: n, email: `${n}${rnd}@t.com`, passwordHash: 'x', role, hobby: skills[0]?.[0] ?? null, emailVerifiedAt: new Date(), ...extra,
      skills: { create: skills.map(([skill, r]) => ({ skill, skillKey: skill.toLowerCase(), role: r })) },
    },
  });
  ids.push(u.id);
  return { id: u.id, token: jwt.sign({ sub: u.id, role }, SECRET, { expiresIn: '1h' }) };
};
/** Wait until a condition holds (the AI work runs in the background). */
async function until(fn, ms = 25000, step = 300) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await wait(step);
  }
}
/** Start a mentor test; if the anti-spam limit (10/min) is hit, wait a minute and retry. */
async function startTest(token, skill) {
  let r = await j('POST', '/ai/mentor-test/start', token, { skill });
  if (r.status === 429) {
    console.log('   (waiting 61 s — mentor-test start is limited to 10 per minute)');
    await wait(61_000);
    r = await j('POST', '/ai/mentor-test/start', token, { skill });
  }
  return r;
}
const reviewOf = (postId) => until(() => prisma.aiReview.findUnique({ where: { postId } }));
const jobOf = (kind, refId) => prisma.aiJob.findUnique({ where: { kind_refId: { kind, refId } } });
const appDone = (id) => until(async () => { const a = await prisma.mentorApplication.findUnique({ where: { id } }); return a && a.status !== 'SUBMITTED' ? a : null; });
const CODE = (n) => `Here is my solution #${n}:\n\nfunction sum(nums) {\n  let total = 0;\n  for (const x of nums) total += x;\n  return total;\n}\n\nI used a simple loop.`;

for (let i = 0; i < 40; i++) { try { if ((await fetch(BASE + '/health/live')).ok) break; } catch {} await wait(1000); }
const fake = await startFakeAi(4555);
const { calls, S } = fake;

try {
  const ADMIN = await mk(`AiAdm${rnd}`, 'LEARNER', [['Marketing', 'LEARNER']], { isAdmin: true });

  // ===================================================================
  section('Admin: providers + connection test');
  const st = await j('GET', '/admin/ai/status', ADMIN.token);
  const prov = (n) => st.data.providers?.find((p) => p.name === n);
  ok(st.status === 200 && prov('gemini')?.configured && prov('groq')?.configured, 'both providers configured');
  ok(st.data.audioTool === true, 'audio tool (ffmpeg) available');
  ok(st.data.skills?.length === 3 && st.data.skills.every((s) => s.progressEnabled && s.mentorTestEnabled), 'Coding, Music, Spoken English enabled by default');
  const ping = await j('POST', '/admin/ai/test', ADMIN.token);
  ok(ping.status === 200 && ping.data.every((p) => p.ok), `connection test passes for both (${JSON.stringify(ping.data.map((p) => p.name + ':' + p.ok))})`);
  ok(ping.data.some((p) => p.name === 'gemini-audio' && p.ok) && ping.data.some((p) => p.name === 'groq-speech' && p.ok), 'connection test also checks audio listening + speech-to-text');
  const audioPing = calls.find((c) => c.provider === 'gemini' && c.kind === 'ping' && c.mediaMime);
  ok(audioPing?.mediaMime === 'audio/mp3' && audioPing.mediaBytes > 500, `listening test sends a real audio clip (${audioPing?.mediaBytes} bytes)`);
  ok(calls.find((c) => c.provider === 'gemini' && c.kind === 'ping')?.thinking?.thinkingBudget === 512, 'Gemini is asked to keep "thinking" short (faster, no timeouts)');
  const gPing = calls.find((c) => c.provider === 'gemini' && c.kind === 'ping');
  ok(gPing?.key === 'test-gemini' && gPing.json === 'application/json', 'Gemini request: API key header + JSON mode');
  const qPing = calls.find((c) => c.provider === 'groq' && c.kind === 'ping');
  ok(qPing?.auth === 'Bearer test-groq' && qPing.format === 'json_object', 'Groq request: bearer key + JSON mode');
  const learnerForbidden = await mk(`AiNo${rnd}`, 'LEARNER', [['Coding', 'LEARNER']]);
  ok((await j('GET', '/admin/ai/status', learnerForbidden.token)).status === 403, 'non-admins cannot see AI admin');

  // ===================================================================
  section('Retired model names (the real 404s from Google and Groq)');
  // The providers no longer offer our configured/default model names.
  S.geminiModels = ['gemini-3.8-flash', 'gemini-3.8-flash-lite', 'gemini-3.8-pro'];
  S.groqModels = ['llama-3.1-8b-instant', 'openai/gpt-oss-120b', 'meta-llama/llama-guard-4-12b', 'whisper-large-v3', 'whisper-large-v3-turbo'];
  const ping2 = await j('POST', '/admin/ai/test', ADMIN.token);
  ok(ping2.status === 200 && ping2.data.every((p) => p.ok), `after "model not found", both providers recover by themselves (${JSON.stringify(ping2.data.map((p) => p.name + ':' + p.ok + (p.error ? ' ' + p.error : '')))})`);
  ok(calls.some((c) => c.provider === 'gemini' && c.kind === 'missingModel'), 'Gemini really answered 404 for the old model first');
  const st4 = await j('GET', '/admin/ai/status', ADMIN.token);
  ok(st4.data.providers.find((p) => p.name === 'gemini').model === 'gemini-3.8-flash', `Gemini switched to Google's suggested model (${st4.data.providers.find((p) => p.name === 'gemini').model})`);
  ok(st4.data.providers.find((p) => p.name === 'groq').model === 'openai/gpt-oss-120b', `Groq switched to its best current model (${st4.data.providers.find((p) => p.name === 'groq').model})`);
  ok(st4.data.providers.every((p) => !p.coolingUntil), 'neither provider is left "Resting"');

  // ===================================================================
  section('Learner progress — Coding');
  const L = await mk(`AiLrn${rnd}`, 'LEARNER', [['Coding', 'LEARNER']]);
  S.codingQueue = [50, 55, 60, 75, 80];
  const postIds = [];
  for (let i = 1; i <= 5; i++) {
    const t0 = Date.now();
    const p = await j('POST', '/posts', L.token, { content: CODE(i), title: `Practice ${i}`, postType: 'text' });
    if (i === 1) ok(p.status === 201 && Date.now() - t0 < 3000, `posting is instant — AI runs in the background (${Date.now() - t0} ms)`);
    postIds.push(p.data.id);
    ok(!!(await reviewOf(p.data.id)), `post ${i} reviewed`);
  }
  const r1 = await prisma.aiReview.findUnique({ where: { postId: postIds[0] } });
  ok(r1.provider === 'gemini' && r1.skill === 'coding' && r1.overall === 50 && r1.rubricVersion === 1, `review stored (gemini, coding, overall ${r1.overall})`);
  const codingCall = calls.find((c) => c.kind === 'coding');
  ok(codingCall.prompt.includes('<<<CONTENT>>>') && codingCall.prompt.includes('<<<END>>>') && codingCall.system.includes('never instructions'), 'post text is fenced as data (prompt-injection guard)');
  const prog = await j('GET', '/ai/progress', L.token);
  const cp = prog.data.skills?.find((s) => s.skill === 'coding');
  ok(prog.status === 200 && cp?.status === 'ready' && cp.reviewedPosts === 5, 'progress ready after 5 reviewed posts');
  ok(cp?.trend === 'up' && cp.changePct > 0, `trend is UP (${cp?.earlierScore} → ${cp?.currentScore}, ${cp?.changePct}%)`);
  ok(cp?.criteria?.length === 5 && cp.latest?.improvements?.length > 0 && cp.history?.length === 5, 'criteria, latest feedback and history included');
  const mine = await j('GET', `/ai/reviews/post/${postIds[0]}`, L.token);
  const other = await j('GET', `/ai/reviews/post/${postIds[0]}`, learnerForbidden.token);
  ok(mine.data.status === 'done' && other.data.status === 'none', 'a post’s AI review is visible only to its author');

  // mentor ratings blend in (30%)
  const M = await mk(`AiMen${rnd}`, 'MENTOR', [['Coding', 'MENTOR']]);
  await j('POST', `/posts/${postIds[4]}/comments`, M.token, { text: 'Nice loop, consider reduce()', commentType: 'mentor', isMentorCritique: true, mentorRating: 5 });
  const prog2 = await j('GET', '/ai/progress', L.token);
  const last = prog2.data.skills.find((s) => s.skill === 'coding').history.at(-1);
  ok(last.mentorRated && last.score === Math.round(0.7 * 80 + 0.3 * 100), `mentor rating blended into the score (${last.score})`);

  section('Learner progress — what is NOT reviewed');
  const short = await j('POST', '/posts', L.token, { content: 'hi all', title: 'x', postType: 'text' });
  await until(async () => (await jobOf('POST_REVIEW', short.data.id))?.status === 'SKIPPED');
  ok((await jobOf('POST_REVIEW', short.data.id))?.status === 'SKIPPED' && !(await prisma.aiReview.findUnique({ where: { postId: short.data.id } })), 'too-short post is skipped');
  const priv = await j('POST', '/posts', L.token, { content: CODE(9), title: 'private', postType: 'text', isPrivate: true });
  ok(priv.status === 201 && !(await jobOf('POST_REVIEW', priv.data.id)), 'private posts are never sent to AI');
  const MK = await mk(`AiMkt${rnd}`, 'LEARNER', [['Marketing', 'LEARNER']]);
  const mkt = await j('POST', '/posts', MK.token, { content: 'A long marketing post about funnels and copywriting tips.', title: 'm', postType: 'text' });
  ok(mkt.status === 201 && !(await jobOf('POST_REVIEW', mkt.data.id)), 'skills without AI (Marketing) are not reviewed');
  const GN = await mk(`AiGst${rnd}`, null, []);
  const g = await j('POST', '/onboarding/continue-guest', GN.token);
  const gp = await j('POST', '/posts', g.data.tokens.accessToken, { content: CODE(3), title: 'guest', postType: 'text' });
  await wait(1500);
  ok(gp.status === 201 && !(await prisma.aiReview.findUnique({ where: { postId: gp.data.id } })), 'guest posts are not reviewed');

  // ===================================================================
  section('Spoken English post (audio)');
  const E = await mk(`AiEng${rnd}`, 'LEARNER', [['Spoken English', 'LEARNER']]);
  const audio = await upload(E.token, melodyMp3(20), 'audio/mpeg', 'talk.mp3');
  ok(audio.status === 201, 'audio uploaded');
  S.transcript = Array(150).fill('word').join(' ') + ' um uh';
  S.score.english = 70;
  const ep = await j('POST', '/posts', E.token, { content: 'My speaking practice', title: 'Talk', postType: 'audio', audioUrl: audio.data.url });
  const er = await reviewOf(ep.data.id);
  ok(!!er && er.skill === 'spoken_english' && er.provider === 'gemini', 'spoken English reviewed by the listening model');
  const gAudio = calls.filter((c) => c.provider === 'gemini' && c.kind === 'english').at(-1);
  ok(gAudio?.mediaMime === 'audio/mp3' && gAudio.mediaBytes > 1000, `audio sent to Gemini as compact mp3 (${gAudio?.mediaBytes} bytes)`);
  const wh = calls.filter((c) => c.kind === 'whisper').at(-1);
  ok(wh?.multipart && wh.hasFile && wh.model === 'whisper-large-v3-turbo' && wh.format === 'verbose_json', 'Groq Whisper used for timestamps (multipart, verbose_json)');
  const sm = er?.metrics?.speech;
  ok(sm && sm.words === 152 && sm.fillers === 2 && sm.wordsPerMinute > 100 && sm.longPauses === 1, `our speech measurements stored (${sm?.wordsPerMinute} wpm, ${sm?.fillers} fillers, ${sm?.longPauses} long pause)`);
  ok(er.scores.fluency !== 70 && er.scores.grammar === 70, `fluency anchored to our measurement (${er.scores.fluency}), other criteria from AI`);

  // ===================================================================
  section('Music post (audio + our pitch analyser)');
  const MU = await mk(`AiMus${rnd}`, 'LEARNER', [['Singing', 'LEARNER']]);
  const song = await upload(MU.token, melodyMp3(12), 'audio/mpeg', 'song.mp3');
  S.score.music = 60;
  const mp = await j('POST', '/posts', MU.token, { content: 'Scale practice', title: 'Scale', postType: 'audio', audioUrl: song.data.url });
  const mr = await reviewOf(mp.data.id);
  ok(!!mr && mr.skill === 'music' && mr.skillLabel === 'Singing', '"Singing" is judged as Music');
  const pm = mr?.metrics?.pitch;
  ok(pm && pm.pitchScore >= 85, `our pitch analysis measured the in-tune melody (${pm?.pitchScore}/100)`);
  ok(mr.scores.pitch === Math.round((60 + pm.pitchScore) / 2) && mr.scores.rhythm === 60, `AI pitch (60) averaged with measured (${pm?.pitchScore}) → ${mr.scores.pitch}`);

  // ===================================================================
  section('Resilience: rate limit → backup, bad answers, outages');
  S.gemini = { mode: 'garbage', times: 1 };
  S.codingQueue = [];
  S.score.coding = 66;
  const gb = await j('POST', '/posts', L.token, { content: CODE(20), title: 'garbage', postType: 'text' });
  const gbr = await reviewOf(gb.data.id);
  ok(gbr?.provider === 'groq' && gbr.overall === 66, 'Gemini returned junk → Groq answered (same request)');

  S.gemini = { mode: '429', times: 1 };
  const rl = await j('POST', '/posts', L.token, { content: CODE(21), title: 'ratelimit', postType: 'text' });
  const rlr = await reviewOf(rl.data.id);
  ok(rlr?.provider === 'groq', 'Gemini rate-limited (429) → Groq answered');
  const st2 = await j('GET', '/admin/ai/status', ADMIN.token);
  ok(!!st2.data.providers.find((p) => p.name === 'gemini').coolingUntil, 'Gemini put on a short cooldown after 429');

  S.gemini = { mode: '503', times: Infinity };
  S.groq = { mode: '503', times: Infinity };
  const t1 = Date.now();
  const down = await j('POST', '/posts', L.token, { content: CODE(22), title: 'outage', postType: 'text' });
  ok(down.status === 201 && Date.now() - t1 < 3000, 'during an AI outage, posting still works instantly');
  const dj = await until(async () => { const x = await jobOf('POST_REVIEW', down.data.id); return x && x.attempts >= 1 && x.status === 'PENDING' ? x : null; });
  ok(dj && dj.runAfter.getTime() > Date.now() && dj.lastError, 'failed job is kept and retried later (back-off)');
  ok((await j('GET', '/ai/progress', L.token)).status === 200 && (await j('GET', '/posts', L.token)).status === 200, 'the rest of the app is unaffected');
  // Recovery: providers back; make the job due and wake the worker with any new job.
  S.gemini = { mode: 'ok', times: Infinity };
  S.groq = { mode: 'ok', times: Infinity };
  await wait(61_000); // let the Gemini cooldown from the 429 test pass
  await prisma.aiJob.update({ where: { id: dj.id }, data: { runAfter: new Date() } });
  const wake = await j('POST', '/posts', L.token, { content: CODE(23), title: 'wake', postType: 'text' });
  ok(!!(await reviewOf(down.data.id)) && !!(await reviewOf(wake.data.id)), 'after recovery the waiting review completes');

  // ===================================================================
  section('AI mentor test — which skills');
  const NEW = await mk(`AiNew${rnd}`, null, [], { hobby: 'Coding' });
  const elC = await j('GET', '/ai/mentor-test/eligibility?skill=Coding', NEW.token);
  const elM = await j('GET', '/ai/mentor-test/eligibility?skill=Marketing', NEW.token);
  ok(elC.data.mode === 'ai' && elM.data.mode === 'quiz', 'Coding uses the AI test; Marketing keeps the quiz');

  section('AI mentor test — Coding (pass)');
  const s1 = await startTest(NEW.token, 'Coding');
  ok(s1.status === 200 && s1.data.task?.mode === 'code' && s1.data.task.prompt.length > 20 && s1.data.status === 'STARTED', 'random coding task drawn, clock started');
  const leaked = JSON.stringify(s1.data);
  ok(!leaked.includes('judgeNotes') && !leaked.includes('keyIssues'), 'hidden judge notes / key issues are NOT sent to the applicant');
  const s1b = await startTest(NEW.token, 'Coding');
  ok(s1b.data.id === s1.data.id, 'starting again resumes the same test (no re-rolling the task)');
  ok((await j('POST', `/ai/mentor-test/${s1.data.id}/submit`, NEW.token, { codeAnswer: 'function f(){return 1}', critiqueText: 'too short' })).status === 400, 'a too-short critique is refused');
  S.score.codingTest = 90; S.score.critique = 85; S.confidence = 0.9; S.taskCompliance = 90;
  const sub = await j('POST', `/ai/mentor-test/${s1.data.id}/submit`, NEW.token, { codeAnswer: 'function secondLargest(a){ /* ... */ return null }\n// explanation: single pass tracking top two', critiqueText: 'Your loop starts at index 1 so the first element is skipped; start at 0. Also guard against an empty list to avoid dividing by zero.' });
  ok(sub.status === 200 && sub.data.application.status === 'SUBMITTED' && sub.data.session?.user?.role === 'LEARNER', 'handed in; new account joins as Learner meanwhile (fresh session)');
  const a1 = await appDone(s1.data.id);
  ok(a1?.status === 'PASSED' && a1.aiScore === Math.round(0.7 * 90 + 0.3 * 85), `PASSED with ${a1?.aiScore}/100`);
  const sk1 = await prisma.userSkill.findFirst({ where: { userId: NEW.id, skillKey: 'coding' } });
  const u1 = await prisma.user.findUnique({ where: { id: NEW.id } });
  ok(sk1?.role === 'MENTOR' && u1.role === 'MENTOR', 'now a Mentor in Coding (main skill → account role Mentor)');
  ok(!!(await prisma.notification.findFirst({ where: { userId: NEW.id, title: { contains: 'Mentor' } } })), 'applicant notified');
  ok((await startTest(NEW.token, 'Coding')).status === 400, 'cannot take the test again once a Mentor');

  section('AI mentor test — Coding (fail → 7-day retry)');
  const F = await mk(`AiFail${rnd}`, 'LEARNER', [['Coding', 'LEARNER']]);
  const sf = await startTest(F.token, 'Coding');
  S.score.codingTest = 30; S.score.critique = 40;
  await j('POST', `/ai/mentor-test/${sf.data.id}/submit`, F.token, { codeAnswer: 'print("hello world") # not the task', critiqueText: 'Looks good to me, nice job, keep going and practise more every day.' });
  const af = await appDone(sf.data.id);
  ok(af?.status === 'FAILED' && af.retryAfter && af.retryAfter.getTime() > Date.now() + 6 * 86400_000, `FAILED (${af?.aiScore}/100), retry in 7 days`);
  const again = await startTest(F.token, 'Coding');
  ok(again.status === 403, 'retry blocked until the cooldown ends');
  const mineF = await j('GET', '/ai/mentor-test/mine', F.token);
  ok(mineF.data[0]?.feedback?.improvements?.length > 0, 'failed applicant sees their feedback');
  ok((await prisma.userSkill.findFirst({ where: { userId: F.id, skillKey: 'coding' } })).role === 'LEARNER', 'still a Learner in Coding');

  section('AI mentor test — borderline → admin review');
  const B = await mk(`AiMid${rnd}`, 'LEARNER', [['Coding', 'LEARNER']]);
  const sb = await startTest(B.token, 'Coding');
  S.score.codingTest = 68; S.score.critique = 66;
  await j('POST', `/ai/mentor-test/${sb.data.id}/submit`, B.token, { codeAnswer: 'def second(a):\n  s = sorted(set(a))\n  return s[-2] if len(s) > 1 else None', critiqueText: 'The loop skips the first item because it starts at 1. Use sum(nums) and handle empty lists.' });
  const ab = await appDone(sb.data.id);
  ok(ab?.status === 'REVIEW', `score ${ab?.aiScore} (between 55 and 75) → admin review`);
  const list = await j('GET', '/admin/ai/mentor-tests?status=REVIEW', ADMIN.token);
  ok(list.data.some((x) => x.id === sb.data.id), 'appears in the admin review list');
  const det = await j('GET', `/admin/ai/mentor-tests/${sb.data.id}`, ADMIN.token);
  ok(det.data.codeAnswer && det.data.task?.judgeNotes && det.data.aiResult?.performance, 'admin sees the answer, hidden notes and the AI breakdown');
  const dec = await j('POST', `/admin/ai/mentor-tests/${sb.data.id}/decide`, ADMIN.token, { decision: 'approve', note: 'Solid answer' });
  ok(dec.status === 200 && dec.data.status === 'PASSED', 'admin approves → PASSED');
  ok((await prisma.userSkill.findFirst({ where: { userId: B.id, skillKey: 'coding' } })).role === 'MENTOR', 'approved applicant is now a Coding Mentor');
  ok((await j('POST', `/admin/ai/mentor-tests/${sb.data.id}/decide`, ADMIN.token, { decision: 'reject' })).status === 400, 'a decided test cannot be decided twice');
  ok((await j('POST', `/admin/ai/mentor-tests/${sb.data.id}/decide`, B.token, { decision: 'approve' })).status === 403, 'applicants cannot approve themselves');

  section('Admin can only decide once the AI scores are in');
  const W = await mk(`AiWait${rnd}`, 'LEARNER', [['Coding', 'LEARNER']]);
  const sw = await startTest(W.token, 'Coding');
  S.gemini = { mode: '503', times: 1 };
  S.groq = { mode: '503', times: 1 };
  S.score.codingTest = 90; S.score.critique = 90; S.confidence = 0.9;
  await j('POST', `/ai/mentor-test/${sw.data.id}/submit`, W.token, { codeAnswer: 'function f(a){ return [...new Set(a)].sort((x,y)=>y-x)[1] ?? null } // explained', critiqueText: 'Start the loop at index 0 and guard against an empty list before dividing.' });
  const waiting = await until(async () => {
    const d = await j('GET', `/admin/ai/mentor-tests/${sw.data.id}`, ADMIN.token);
    return d.data.status === 'SUBMITTED' && d.data.judging?.attempts >= 1 && d.data.judging?.state === 'PENDING' ? d : null;
  });
  ok(!!waiting && waiting.data.judging.nextTryAt && waiting.data.judging.lastError, 'admin sees the AI is still judging (attempt, next try, last problem)');
  const early = await j('POST', `/admin/ai/mentor-tests/${sw.data.id}/decide`, ADMIN.token, { decision: 'approve' });
  ok(early.status === 400 && /still judging/i.test(JSON.stringify(early.data)), 'cannot approve/reject before the AI scores are in');
  S.gemini = { mode: 'ok', times: Infinity };
  S.groq = { mode: 'ok', times: Infinity };
  await prisma.aiJob.updateMany({ where: { kind: 'MENTOR_TEST', refId: sw.data.id }, data: { runAfter: new Date() } });
  await j('POST', '/posts', L.token, { content: CODE(40), title: 'wake2', postType: 'text' }); // wakes the worker
  const aw = await until(async () => { const x = await prisma.mentorApplication.findUnique({ where: { id: sw.data.id } }); return x && x.status !== 'SUBMITTED' ? x : null; }, 75_000);
  ok(aw?.status === 'PASSED' && aw.aiResult, 'after the retry the AI scores and decides');

  section('AI mentor test — low AI confidence never auto-decides');
  const LC = await mk(`AiLow${rnd}`, 'LEARNER', [['Coding', 'LEARNER']]);
  const sl = await startTest(LC.token, 'Coding');
  S.score.codingTest = 95; S.score.critique = 95; S.confidence = 0.4;
  await j('POST', `/ai/mentor-test/${sl.data.id}/submit`, LC.token, { codeAnswer: 'function solve(){ return 42 } // explained approach here', critiqueText: 'Start the loop at 0 instead of 1 and guard the empty list before dividing.' });
  const al = await appDone(sl.data.id);
  ok(al?.status === 'REVIEW' && /confidence/i.test(al.aiNote ?? ''), `high score but low confidence → admin review (${al?.aiNote})`);
  S.confidence = 0.9;

  section('AI mentor test — time limit');
  const T = await mk(`AiTime${rnd}`, 'LEARNER', [['Coding', 'LEARNER']]);
  const stt = await startTest(T.token, 'Coding');
  await prisma.mentorApplication.update({ where: { id: stt.data.id }, data: { expiresAt: new Date(Date.now() - 10 * 60_000) } });
  const late = await j('POST', `/ai/mentor-test/${stt.data.id}/submit`, T.token, { codeAnswer: 'function late(){ return 1 }', critiqueText: 'Start the loop at zero and check for an empty list first.' });
  ok(late.status === 400 && (await prisma.mentorApplication.findUnique({ where: { id: stt.data.id } })).status === 'EXPIRED', 'late hand-in refused (EXPIRED)');

  section('AI mentor test — Spoken English (live recording + check phrase)');
  const SE = await mk(`AiSpk${rnd}`, 'LEARNER', [['Spoken English', 'LEARNER']]);
  const se = await startTest(SE.token, 'Spoken English');
  ok(se.data.task?.mode === 'audio' && se.data.task.checkPhrase?.split(' ').length === 3, `audio task with a random check phrase ("${se.data.task?.checkPhrase}")`);
  const rec = await upload(SE.token, melodyMp3(60), 'audio/mpeg', 'rec.mp3');
  ok((await j('POST', `/ai/mentor-test/${se.data.id}/submit`, SE.token, { recordingUrl: 'https://evil.example.com/x.mp3', critiqueText: 'Use went instead of go for the past and say uncle’s house.' })).status === 400, 'recordings that are not LERNEX uploads are refused');
  S.score.english = 88; S.score.critique = 86;
  S.whisperText = `${se.data.task.checkPhrase} ${Array(140).fill('word').join(' ')}`;
  S.spokenIntro = se.data.task.checkPhrase;
  await j('POST', `/ai/mentor-test/${se.data.id}/submit`, SE.token, { recordingUrl: rec.data.url, recordingMime: 'audio/mpeg', durationMs: 60000, critiqueText: 'Use past tense: went, ate, watched. Say "my uncle’s house". Replace "um" with a short pause.' });
  const ase = await appDone(se.data.id);
  ok(ase?.status === 'PASSED', `check phrase heard + strong scores → PASSED (${ase?.aiScore}/100)`);

  const SE2 = await mk(`AiSpk2${rnd}`, 'LEARNER', [['Spoken English', 'LEARNER']]);
  const se2 = await startTest(SE2.token, 'Spoken English');
  S.whisperText = Array(140).fill('word').join(' ');
  S.spokenIntro = 'hello there';
  S.transcript = 'hello there ' + S.whisperText;
  await j('POST', `/ai/mentor-test/${se2.data.id}/submit`, SE2.token, { recordingUrl: rec.data.url, recordingMime: 'audio/mpeg', durationMs: 60000, critiqueText: 'Use past tense: went, ate, watched. Say "my uncle’s house". Replace "um" with a pause.' });
  const ase2 = await appDone(se2.data.id);
  ok(ase2?.status === 'REVIEW' && /check phrase/i.test(ase2.aiNote ?? ''), 'check phrase missing → admin review, never an automatic pass');

  section('AI mentor test — Music');
  const MS = await mk(`AiMs${rnd}`, 'LEARNER', [['Music', 'LEARNER']]);
  let ms = await startTest(MS.token, 'Music');
  if (ms.status === 429) {
    ok(true, 'starting tests is rate-limited (10 per minute) — anti-spam');
    await wait(61_000);
    ms = await startTest(MS.token, 'Music');
  }
  ok(ms.status === 200 && ms.data.task?.mode === 'audio', `music test started (${ms.status})`);
  const song2 = await upload(MS.token, melodyMp3(45), 'audio/mpeg', 'perf.mp3');
  S.score.music = 84; S.score.critique = 82; S.taskCompliance = 90;
  S.whisperText = `${ms.data.task.checkPhrase} la la la`;
  S.spokenIntro = ms.data.task.checkPhrase;
  await j('POST', `/ai/mentor-test/${ms.data.id}/submit`, MS.token, { recordingUrl: song2.data.url, recordingMime: 'audio/mpeg', durationMs: 45000, critiqueText: 'Your high notes go flat because of breath support — plan breaths and practise sirens; use a metronome for the last line.' });
  const ams = await appDone(ms.data.id);
  ok(ams?.status === 'PASSED' && ams.aiResult?.performance?.metrics?.pitch?.pitchScore >= 85, `music test passed, our pitch measurement attached (${ams?.aiResult?.performance?.metrics?.pitch?.pitchScore})`);

  section('Gemini models that refuse a thinking limit');
  S.rejectThinking = true;
  const th = await j('POST', '/posts', L.token, { content: CODE(41), title: 'thinking', postType: 'text' });
  const thr = await reviewOf(th.data.id);
  ok(thr?.provider === 'gemini' && calls.some((c) => c.kind === 'thinkingRejected'), 'Gemini said no to the thinking limit → we resend without it (still Gemini)');
  S.rejectThinking = false;

  section('Admin switches');
  await j('PATCH', '/admin/ai/skills/coding', ADMIN.token, { progressEnabled: false, mentorTestEnabled: false });
  const offPost = await j('POST', '/posts', L.token, { content: CODE(30), title: 'off', postType: 'text' });
  ok(offPost.status === 201 && !(await jobOf('POST_REVIEW', offPost.data.id)), 'progress switched off → no review queued');
  ok((await j('GET', '/ai/mentor-test/eligibility?skill=Coding', L.token)).data.mode === 'quiz', 'mentor test switched off → back to the quiz');
  await j('PATCH', '/admin/ai/skills/coding', ADMIN.token, { progressEnabled: true, mentorTestEnabled: true });

  section('Usage tracking');
  const st3 = await j('GET', '/admin/ai/status', ADMIN.token);
  const g3 = st3.data.providers.find((p) => p.name === 'gemini');
  ok(g3.requestsToday > 5 && g3.failuresToday >= 1, `requests and failures counted per provider (${g3.requestsToday} / ${g3.failuresToday})`);
} catch (e) {
  fail++;
  console.log('  FAIL test crashed:', e);
} finally {
  await prisma.aiJob.deleteMany({ where: { refId: { in: (await prisma.post.findMany({ where: { authorId: { in: ids } }, select: { id: true } })).map((p) => p.id) } } }).catch(() => {});
  const apps = await prisma.mentorApplication.findMany({ where: { userId: { in: ids } }, select: { id: true } }).catch(() => []);
  await prisma.aiJob.deleteMany({ where: { refId: { in: apps.map((a) => a.id) } } }).catch(() => {});
  await prisma.aiSkillSetting.deleteMany({}).catch(() => {});
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.post.deleteMany({ where: { authorId: { in: ids } } }).catch(() => {});
  await prisma.xpEvent.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch((e) => console.log('cleanup:', e.message));
  await prisma.$disconnect();
  fake.server.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
