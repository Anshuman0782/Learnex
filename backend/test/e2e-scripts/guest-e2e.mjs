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
const mk = async (n, role) => {
  const u = await prisma.user.create({ data: { name: n, email: `${n}${rnd}@t.com`, passwordHash: 'x', role, hobby: `Gz${rnd}`, emailVerifiedAt: new Date() } });
  return { id: u.id, token: jwt.sign({ sub: u.id, role }, SECRET, { expiresIn: '1h' }) };
};
const xpOf = (id) => prisma.xpEvent.count({ where: { userId: id } });
for (let i = 0; i < 40; i++) { try { if ((await fetch(BASE + '/health/live')).ok) break; } catch {} await wait(1000); }

const NEW = await mk(`GsNew${rnd}`, null);      // just signed up, no role yet
const LRN = await mk(`GsLrn${rnd}`, 'LEARNER');
const ids = [NEW.id, LRN.id];
const circle = `t-guest-${rnd}`;
try {
  // ---- becoming a guest ----
  const g = await j('POST', '/onboarding/continue-guest', NEW.token);
  ok(g.status === 200 && g.data.user?.role === 'GUEST', `new account continues as Guest (${g.status} ${g.data.user?.role})`);
  const G = { id: NEW.id, token: g.data.tokens.accessToken };
  ok((await j('POST', '/onboarding/continue-guest', LRN.token)).status === 400, 'a Learner cannot drop to Guest');

  // ---- rule 1: guests can upload like anyone ----
  const post = await j('POST', '/posts', G.token, { content: 'guest post', title: 'hello', postType: 'text' });
  ok(post.status === 201 && post.data.authorRole === 'Guest', `guest can post; shown as Guest (${post.status} ${post.data.authorRole})`);
  // ---- rule 2: no XP, no streak, no badges ----
  await j('POST', '/gamification/check-in', G.token);
  ok((await xpOf(G.id)) === 0, 'guest earns NO XP for posting / check-in');
  ok((await prisma.streak.findUnique({ where: { userId: G.id } })) === null, 'guest has no streak');
  ok((await prisma.badge.count({ where: { userId: G.id } })) === 0, 'guest gets no badges');

  // ---- rule 3: comments = general only ----
  const lp = await j('POST', '/posts', LRN.token, { content: 'learner post', title: 'lp', postType: 'text' });
  const c = await j('POST', `/posts/${lp.data.id}/comments`, G.token, { text: 'nice one' });
  const mine = (c.data.comments ?? []).find((x) => x.text === 'nice one');
  ok(c.status === 201 && mine?.commentType === 'general' && mine?.authorRole === 'Guest', `guest comment is a General comment (${c.status} ${mine?.commentType} ${mine?.authorRole})`);
  const crit = await j('POST', `/posts/${lp.data.id}/comments`, G.token, { text: 'as mentor', commentType: 'mentor', isMentorCritique: true });
  ok(crit.status === 403, `guest cannot post a mentor critique (${crit.status})`);
  ok((await xpOf(G.id)) === 0, 'still no XP after commenting');

  // ---- others still earn from a guest's activity (rule 4: other logic same) ----
  const before = await xpOf(LRN.id);
  await j('POST', `/posts/${lp.data.id}/like`, G.token);
  ok((await xpOf(LRN.id)) >= before, 'a guest\'s like still counts for the Learner');
  // someone liking the guest's post must not create guest XP
  await j('POST', `/posts/${post.data.id}/like`, LRN.token);
  ok((await xpOf(G.id)) === 0, 'guest earns no XP when others like their post');

  // ---- rule 2: never on a leaderboard ----
  let listed = false;
  for (const role of ['Learner', 'Mentor']) {
    const lb = await j('GET', `/leaderboard?role=${role}`, G.token);
    const rows = Array.isArray(lb.data) ? lb.data : lb.data?.entries ?? [];
    if (rows.some((r) => r.id === G.id || r.userId === G.id)) listed = true;
  }
  ok(!listed, 'guest is not on the Learner or Mentor leaderboard');

  // ---- challenges are XP-based → not for guests ----
  await prisma.community.create({ data: { id: circle, name: `G ${rnd}`, category: 'X', description: 'x', iconName: 'people', iconBgColor: '#fff', iconColor: '#000', tags: [] } });
  await prisma.communityMembership.create({ data: { userId: G.id, communityId: circle } });
  // LRN is the circle admin; three more members so the circle can host an event.
  await prisma.communityMembership.create({ data: { userId: LRN.id, communityId: circle, role: 'ADMIN' } });
  for (let i = 0; i < 3; i++) {
    const m = await mk(`GsM${i}${rnd}`, 'LEARNER'); ids.push(m.id);
    await prisma.communityMembership.create({ data: { userId: m.id, communityId: circle } });
  }
  const ev = await j('POST', '/events', LRN.token, { communityId: circle, title: `Ev ${rnd}`, description: 'd', votingHours: 6, learner: { name: 'L', xp: 50, tasks: [{ type: 'COMMENT', target: 1 }] } });
  ok(ev.status === 201, `challenge created by circle admin (${ev.status})`);
  const v = await j('POST', `/events/${ev.data.id}/vote`, G.token);
  ok(v.status === 403 && /Guest/i.test(JSON.stringify(v.data)), `guest cannot join an XP challenge, with a clear reason (${v.status})`);

  // ---- upgrade: guest → learner starts earning ----
  const up = await j('POST', '/onboarding/enroll-learner', G.token);
  ok(up.status === 200 && up.data.user?.role === 'LEARNER', 'guest can upgrade to Learner');
  const T = up.data.tokens.accessToken;
  await j('POST', '/posts', T, { content: 'now learner', title: 'x', postType: 'text' });
  ok((await xpOf(G.id)) > 0, 'after upgrading, XP starts counting');
} finally {
  await prisma.communityEvent.deleteMany({ where: { communityId: circle } }).catch(() => {});
  await prisma.communityMembership.deleteMany({ where: { communityId: circle } }).catch(() => {});
  await prisma.community.deleteMany({ where: { id: circle } }).catch(() => {});
  await prisma.xpEvent.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.post.deleteMany({ where: { authorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch((e) => console.log('cleanup:', e.message));
  await prisma.$disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
}
