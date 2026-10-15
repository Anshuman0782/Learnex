// Chat attachments (photo / document / audio), admin people-per-skill counts,
// and XP activity tagged with skill + role. Uses the LOCAL storage driver
// (never point this at production).
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
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
  const x = await r.text(); let d; try { d = JSON.parse(x); } catch { d = x; } return { status: r.status, data: d };
}
const MU = `Music${rnd}`;
const MK = `Marketing${rnd}`;
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
for (let i = 0; i < 40; i++) { try { if ((await fetch(BASE + '/health/live')).ok) break; } catch {} await wait(1000); }

// 1x1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

try {
  // A: Learner in Music, Mentor in Marketing (one person, two roles). B: learner.
  const A = await mk(`CaA${rnd}`, 'LEARNER', [[MU, 'LEARNER'], [MK, 'MENTOR']], { isAdmin: true });
  const B = await mk(`CaB${rnd}`, 'LEARNER', [[MK, 'LEARNER']]);

  // ---------- chat ----------
  const conv = await j('POST', `/chats/with/${B.id}`, A.token);
  ok(conv.status === 200, `open conversation (${conv.status})`);
  const cid = conv.data.id;
  const t1 = await j('POST', `/chats/${cid}/messages`, A.token, { text: 'hello 👋' });
  ok(t1.status === 201 && t1.data.attachment === null, 'plain text message still works');
  ok((await j('POST', `/chats/${cid}/messages`, A.token, { text: '   ' })).status === 400, 'empty message rejected');

  const img = await upload(A.token, PNG, 'image/png', 'pic.png');
  ok(img.status === 201 && img.data.kind === 'image', `photo uploads (${img.status})`);
  const m1 = await j('POST', `/chats/${cid}/messages`, A.token, { text: '', attachment: { url: img.data.url, type: 'image', name: 'pic.png', mime: 'image/png', size: PNG.length } });
  ok(m1.status === 201 && m1.data.attachment?.type === 'image' && m1.data.attachment.url === img.data.url, 'photo-only message sent');

  const pdf = await upload(A.token, PDF, 'application/pdf', 'notes.pdf');
  ok(pdf.status === 201 && pdf.data.kind === 'file' && pdf.data.url.endsWith('.pdf'), `PDF document uploads, keeps .pdf (${pdf.status})`);
  const m2 = await j('POST', `/chats/${cid}/messages`, A.token, { text: 'my notes', attachment: { url: pdf.data.url, type: 'file', name: 'notes.pdf', mime: 'application/pdf', size: PDF.length } });
  ok(m2.status === 201 && m2.data.text === 'my notes' && m2.data.attachment?.name === 'notes.pdf', 'document with caption sent');
  const exe = await upload(A.token, Buffer.from('MZ'), 'application/x-msdownload', 'bad.exe');
  ok(exe.status === 400, `executables are refused (${exe.status})`);

  const foreign = await j('POST', `/chats/${cid}/messages`, A.token, { attachment: { url: 'https://evil.example.com/x.png', type: 'image' } });
  ok(foreign.status === 400, `links that are not Lernex uploads are refused (${foreign.status})`);
  const badType = await j('POST', `/chats/${cid}/messages`, A.token, { attachment: { url: img.data.url, type: 'script' } });
  ok(badType.status === 400, 'unknown attachment type refused');

  const page = await j('GET', `/chats/${cid}/messages`, B.token);
  const kinds = page.data.messages.map((m) => m.attachment?.type ?? 'text');
  ok(page.status === 200 && kinds.includes('image') && kinds.includes('file') && kinds.includes('text'), 'receiver sees text, photo and document');
  const inbox = await j('GET', '/chats', B.token);
  ok(inbox.data[0]?.lastMessage?.attachment?.type === 'file', 'inbox last message carries the attachment');
  const outsider = await mk(`CaC${rnd}`, 'LEARNER', [[MU, 'LEARNER']]);
  ok((await j('GET', `/chats/${cid}/messages`, outsider.token)).status === 403, 'outsiders cannot read the conversation');

  // ---------- XP activity: skill + role on every row ----------
  await j('POST', '/posts', A.token, { content: 'music post', title: 'm', postType: 'text', skill: MU });
  const bPost = await j('POST', '/posts', B.token, { content: 'marketing post', title: 'b', postType: 'text', skill: MK });
  await j('POST', `/posts/${bPost.data.id}/comments`, A.token, { text: 'mentor tip', commentType: 'mentor', isMentorCritique: true, mentorRating: 5 });
  const hist = await j('GET', '/gamification/history?limit=100', A.token);
  const rows = Array.isArray(hist.data) ? hist.data : [];
  ok(rows.some((r) => r.skill === MU && r.role === 'Learner'), 'activity shows Music · Learner XP');
  ok(rows.some((r) => r.skill === MK && r.role === 'Mentor'), 'activity shows Marketing · Mentor XP');
  ok(rows.every((r) => r.role === 'Learner' || r.role === 'Mentor'), 'every activity row has a role');

  // ---------- admin: people counted once, per-skill breakdown ----------
  const stats = await j('GET', '/admin/stats', A.token);
  const u = stats.data?.users ?? {};
  ok(stats.status === 200 && typeof u.both === 'number' && u.both >= 1, `admin "Learner + Mentor" count includes A (${u.both})`);
  const mkRow = (u.skills ?? []).find((s) => s.skill === MK);
  ok(mkRow?.mentors === 1 && mkRow?.learners === 1, `admin skills table: ${MK} 1 learner / 1 mentor (${JSON.stringify(mkRow)})`);
  ok(u.total >= u.members && u.learners <= u.members && u.mentors <= u.members, 'Learners and Mentors are subsets of members (no double-counted total)');
  const search = await j('GET', `/admin/users/search?q=CaA${rnd}`, A.token);
  const hit = (search.data ?? [])[0];
  ok(hit?.skills?.length === 2 && hit.skills.some((s) => s.skill === MK && s.role === 'Mentor'), 'admin user search lists each skill + role');
} finally {
  await prisma.conversation.deleteMany({ where: { OR: [{ userAId: { in: ids } }, { userBId: { in: ids } }] } }).catch(() => {});
  await prisma.post.deleteMany({ where: { authorId: { in: ids } } }).catch(() => {});
  await prisma.xpEvent.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch((e) => console.log('cleanup:', e.message));
  await prisma.$disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
}
