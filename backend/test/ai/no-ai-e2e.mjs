// With NO AI keys configured (e.g. production before keys are added), the app
// must behave normally: posts work, reviews wait, mentor tests go to an admin,
// music still gets our own pitch measurement.
// Start the API WITHOUT GEMINI_API_KEY / GROQ_API_KEY:  PORT=3001 node dist/main
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
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
function tone(seconds) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `aevalsrc='0.5*sin(2*PI*440*t)':s=16000:d=${seconds}`, '-ac', '1', '-b:a', '64k', '-f', 'mp3', 'pipe:1'], { maxBuffer: 32 * 1024 * 1024 });
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
async function until(fn, ms = 20000) {
  const end = Date.now() + ms;
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) return null; await wait(300); }
}
for (let i = 0; i < 40; i++) { try { if ((await fetch(BASE + '/health/live')).ok) break; } catch {} await wait(1000); }

try {
  const A = await mk(`NoAiA${rnd}`, 'LEARNER', [['Marketing', 'LEARNER']], { isAdmin: true });
  const st = await j('GET', '/admin/ai/status', A.token);
  ok(st.status === 200 && st.data.providers.every((p) => !p.configured), 'admin sees: no AI provider configured');
  const ping = await j('POST', '/admin/ai/test', A.token);
  ok(ping.data.every((p) => !p.ok && /No API key/.test(p.error)), 'connection test explains the missing keys');

  const L = await mk(`NoAiL${rnd}`, 'LEARNER', [['Coding', 'LEARNER']]);
  const p = await j('POST', '/posts', L.token, { content: 'function add(a, b) { return a + b; } // my first function, explained', title: 'add', postType: 'text' });
  ok(p.status === 201, 'posting works with no AI');
  const job = await until(async () => {
    const x = await prisma.aiJob.findUnique({ where: { kind_refId: { kind: 'POST_REVIEW', refId: p.data.id } } });
    return x && x.status === 'PENDING' && x.runAfter.getTime() > Date.now() + 60 * 60_000 ? x : null;
  });
  ok(!!job && job.attempts === 0, 'review waits quietly (no retries burned) until keys are added');
  const prog = await j('GET', '/ai/progress', L.token);
  ok(prog.status === 200 && Array.isArray(prog.data.skills), 'progress endpoint still answers');

  const MU = await mk(`NoAiM${rnd}`, 'LEARNER', [['Music', 'LEARNER']]);
  const up = await upload(MU.token, tone(8), 'audio/mpeg', 'a.mp3');
  const mp = await j('POST', '/posts', MU.token, { content: 'A4 long note', title: 'tone', postType: 'audio', audioUrl: up.data.url });
  const mr = await until(() => prisma.aiReview.findUnique({ where: { postId: mp.data.id } }));
  ok(mr?.provider === 'lernex-analyser' && mr.metrics?.partial === true && mr.confidence < 0.5, `music still gets OUR pitch measurement without AI (pitch ${mr?.scores?.pitch})`);

  const N = await mk(`NoAiN${rnd}`, null, [], { hobby: 'Coding' });
  const s = await j('POST', '/ai/mentor-test/start', N.token, { skill: 'Coding' });
  ok(s.status === 200, 'mentor test can still be taken');
  const sub = await j('POST', `/ai/mentor-test/${s.data.id}/submit`, N.token, { codeAnswer: 'function f(a){ return a.sort()[1] } // explanation', critiqueText: 'Start the loop at index 0 and guard against an empty list before dividing.' });
  ok(sub.status === 200 && sub.data.session?.user?.role === 'LEARNER', 'hand-in works; joins as Learner meanwhile');
  const app = await until(async () => { const a = await prisma.mentorApplication.findUnique({ where: { id: s.data.id } }); return a?.status === 'REVIEW' ? a : null; });
  ok(!!app && /not set up/i.test(app.aiNote ?? ''), 'goes straight to admin review (not stuck waiting)');
} catch (e) {
  fail++;
  console.log('  FAIL test crashed:', e);
} finally {
  const posts = await prisma.post.findMany({ where: { authorId: { in: ids } }, select: { id: true } });
  const apps = await prisma.mentorApplication.findMany({ where: { userId: { in: ids } }, select: { id: true } });
  await prisma.aiJob.deleteMany({ where: { refId: { in: [...posts.map((x) => x.id), ...apps.map((x) => x.id)] } } }).catch(() => {});
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.post.deleteMany({ where: { authorId: { in: ids } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch((e) => console.log('cleanup:', e.message));
  await prisma.$disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
