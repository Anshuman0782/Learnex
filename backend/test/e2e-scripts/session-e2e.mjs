import { createRequire } from 'node:module';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const BASE = 'http://127.0.0.1:3001/api/v1';
const rnd = Math.random().toString(36).slice(2, 7);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const refresh = async (rt) => {
  const r = await fetch(BASE + '/auth/refresh', { method: 'POST', headers: { Authorization: `Bearer ${rt}` } });
  return { status: r.status, data: await r.json().catch(() => null) };
};
const decode = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());
for (let i = 0; i < 40; i++) { try { if ((await fetch(BASE + '/health/live')).ok) break; } catch {} await wait(1000); }
const email = `sess${rnd}@lernex.test`;
try {
  const reg = await fetch(BASE + '/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Session Test', email, password: 'password123', dob: '2000-01-01' }) });
  const r0 = await reg.json();
  const RT1 = r0.tokens.refreshToken;
  ok(reg.status === 201, 'registered');
  ok(!('prevRefreshTokenHash' in r0.user) && !('hashedRefreshToken' in r0.user) && !('refreshRotatedAt' in r0.user), 'no token hashes leak in user payload');
  const days = (decode(RT1).exp - decode(RT1).iat) / 86400;
  ok(days >= 364, `login lasts a year (${Math.round(days)} days, renewed on use)`);

  const a = await refresh(RT1);
  ok(a.status === 200 && !!a.data.tokens?.refreshToken, 'normal renewal works');
  const RT2 = a.data.tokens.refreshToken;
  // The reply above was "lost": the phone still holds RT1 and retries.
  const lost = await refresh(RT1);
  ok(lost.status === 200, 'lost-reply retry with previous key accepted (no logout)');
  const RT3 = lost.data.tokens.refreshToken;
  ok((await refresh(RT3)).status === 200, 'session continues normally afterwards');

  // Old key long after rotation → rejected and session revoked (theft protection).
  const u = await prisma.user.findUnique({ where: { email } });
  await prisma.user.update({ where: { id: u.id }, data: { refreshRotatedAt: new Date(Date.now() - 10 * 60_000) } });
  const stale = await refresh(RT2);
  ok(stale.status === 401, 'stale key outside the 2-minute window rejected');
  const after = await prisma.user.findUnique({ where: { email } });
  ok(after.hashedRefreshToken === null, 'and the session is revoked (stolen-token protection)');

  // Logout kills both current and grace keys.
  const login = await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: email, password: 'password123' }) });
  const L = await login.json();
  const r1 = await refresh(L.tokens.refreshToken);
  const at = r1.data.tokens.accessToken;
  await fetch(BASE + '/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${at}` } });
  ok((await refresh(L.tokens.refreshToken)).status === 401, 'after logout the previous key is dead too');
  ok((await refresh(r1.data.tokens.refreshToken)).status === 401, 'after logout the current key is dead');
} finally {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
}
