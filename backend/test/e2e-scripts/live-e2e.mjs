import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { io } = require('socket.io-client');
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
const reg = async (n) => {
  const u = await prisma.user.create({ data: { name: n, email: `${n}${rnd}@t.com`, passwordHash: 'x', role: 'LEARNER', hobby: 'Music', emailVerifiedAt: new Date() } });
  return { id: u.id, token: jwt.sign({ sub: u.id, role: 'LEARNER' }, SECRET, { expiresIn: '1h' }) };
};
const sock = (u) => new Promise((res, rej) => {
  const s = io('http://127.0.0.1:3001', { auth: { token: u.token }, transports: ['websocket'], reconnection: false });
  s.on('connect', () => setTimeout(() => res(s), 150)); s.on('connect_error', rej);
});
const next = (s, ev, pred = () => true, ms = 2500) => new Promise((res) => {
  const h = (d) => { if (pred(d)) { clearTimeout(t); s.off(ev, h); res(d); } };
  const t = setTimeout(() => { s.off(ev, h); res(null); }, ms);
  s.on(ev, h);
});
for (let i = 0; i < 40; i++) { try { if ((await fetch(BASE + '/health/live')).ok) break; } catch {} await wait(1000); }

const A = await reg(`LvA${rnd}`), B = await reg(`LvB${rnd}`), C = await reg(`LvC${rnd}`), D = await reg(`LvD${rnd}`), E = await reg(`LvE${rnd}`);
const users = [A, B, C, D, E];
const circle = `t-live-${rnd}`, other = `t-other-${rnd}`;
const socks = [];
try {
  await prisma.community.create({ data: { id: circle, name: `Live ${rnd}`, category: `Cat${rnd}`, description: 'x', iconName: 'people', iconBgColor: '#fff', iconColor: '#000', tags: [] } });
  await prisma.community.create({ data: { id: other, name: `Other ${rnd}`, category: 'Other', description: 'x', iconName: 'people', iconBgColor: '#fff', iconColor: '#000', tags: [] } });
  await prisma.communityMembership.createMany({ data: [
    { userId: A.id, communityId: circle, role: 'ADMIN' },
    { userId: B.id, communityId: circle }, { userId: C.id, communityId: circle }, { userId: D.id, communityId: circle },
    { userId: B.id, communityId: other, role: 'ADMIN' }, { userId: A.id, communityId: other }, { userId: C.id, communityId: other }, { userId: D.id, communityId: other },
  ] });
  const sB = await sock(B); socks.push(sB);

  // ---- #1 live: new post / private post / like / delete / repost / circles ----
  let evP = next(sB, 'feed:changed', (d) => d.reason === 'post');
  const post = await j('POST', '/posts', A.token, { content: 'live!', title: 'live', postType: 'text', communityIds: [circle] });
  const e1 = await evP;
  ok(e1?.postId === post.data.id, 'new public post announced live');
  evP = next(sB, 'feed:changed', (d) => d.reason === 'post', 1500);
  await j('POST', '/posts', A.token, { content: 'secret', title: 'secret', postType: 'text', isPrivate: true });
  ok((await evP) === null, 'private post is NOT announced');
  const evS = next(sB, 'post:stats', (d) => d.postId === post.data.id);
  await j('POST', `/posts/${post.data.id}/like`, C.token);
  const st = await evS;
  ok(st?.likesCount === 1, `like count pushed live (${st?.likesCount})`);
  const evC = next(sB, 'post:stats', (d) => d.postId === post.data.id && d.commentsCount === 1);
  await j('POST', `/posts/${post.data.id}/comments`, C.token, { text: 'nice' });
  ok(!!(await evC), 'comment count pushed live');
  const evR = next(sB, 'feed:changed', (d) => d.reason === 'repost' && d.postId === post.data.id);
  await j('POST', `/posts/${post.data.id}/repost`, D.token, { communityId: circle, caption: 'look' });
  ok(!!(await evR), 'repost announced live');
  const evD = next(sB, 'feed:changed', (d) => d.reason === 'delete');
  const p2 = await j('POST', '/posts', A.token, { content: 'temp', title: 'temp', postType: 'text', communityIds: [circle] });
  await j('DELETE', `/posts/${p2.data.id}`, A.token);
  ok((await evD)?.postId === p2.data.id, 'deleted post announced live');
  const evJ = next(sB, 'communities:changed', (d) => d.communityId === circle);
  await j('POST', `/communities/${circle}/join`, E.token);
  ok(!!(await evJ), 'circle membership change announced live');

  // ---- #4 follow flag / #5 repost join flag / #3 categories ----
  await j('POST', `/users/${A.id}/follow`, B.token);
  const feedB = await j('GET', '/posts/feed', B.token).catch(() => null);
  const feedRes = feedB && feedB.status === 200 ? feedB : await j('GET', '/posts', B.token);
  const items = Array.isArray(feedRes.data) ? feedRes.data : feedRes.data?.items ?? [];
  const mine = items.find((x) => x.id === post.data.id && !x.repostedById);
  ok(mine?.authorFollowed === true, 'post says viewer already follows the author');
  ok(Array.isArray(mine?.communityCategories) && mine.communityCategories.includes(`Cat${rnd}`), 'post carries its circle categories');
  const rep = items.find((x) => x.repostedById === D.id);
  ok(rep?.repostCircleJoined === true, 'member sees repostCircleJoined=true (no Join)');
  const outsider = await reg(`LvF${rnd}`); users.push(outsider);
  const fo = await j('GET', '/posts', outsider.token);
  const repO = (Array.isArray(fo.data) ? fo.data : []).find((x) => x.repostedById === D.id);
  ok(repO?.repostCircleJoined === false, 'non-member sees repostCircleJoined=false (Join shown)');

  // ---- #6 circle admins manage events ----
  const ev = { communityId: circle, title: `Ev ${rnd}`, description: 'd', votingHours: 6, learner: { name: 'L', xp: 50, tasks: [{ type: 'COMMENT', target: 1 }] } };
  const byMember = await j('POST', '/events', C.token, ev);
  ok(byMember.status === 403, `regular member cannot create (${byMember.status})`);
  const byOtherAdmin = await j('POST', '/events', B.token, ev);
  ok(byOtherAdmin.status === 403, `admin of ANOTHER circle cannot create here (${byOtherAdmin.status})`);
  const byCircleAdmin = await j('POST', '/events', A.token, ev);
  ok(byCircleAdmin.status === 201, `circle admin creates event (${byCircleAdmin.status} ${JSON.stringify(byCircleAdmin.data).slice(0, 80)})`);
  if (byCircleAdmin.data?.id) {
    ok((await j('DELETE', `/events/${byCircleAdmin.data.id}`, C.token)).status === 403, 'member cannot end it');
    ok((await j('DELETE', `/events/${byCircleAdmin.data.id}`, A.token)).status === 200, 'circle admin can end it');
  }
} finally {
  socks.forEach((s) => s.close());
  const ids = users.map((u) => u.id);
  await prisma.communityEvent.deleteMany({ where: { communityId: { in: [circle, other] } } });
  await prisma.communityMembership.deleteMany({ where: { communityId: { in: [circle, other] } } });
  await prisma.post.deleteMany({ where: { authorId: { in: ids } } });
  await prisma.community.deleteMany({ where: { id: { in: [circle, other] } } });
  await prisma.xpEvent.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch((e) => console.log('cleanup:', e.message));
  await prisma.$disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
}
