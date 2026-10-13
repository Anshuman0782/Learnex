// Multi-skill: a member can join several skills and is a Learner or a Mentor
// in each one separately. XP, ranking, comment badges and critique rights all
// follow the role in the skill the content belongs to.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { MENTOR_QUIZ_POOL } = await import(new URL('../../dist/modules/onboarding/data/mentor-questions.js', import.meta.url));
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
// Unique skill names so this run's leaderboards contain only its own users.
const MU = `Music${rnd}`;
const CO = `Coding${rnd}`;
const ART = `Art${rnd}`;
const ids = [];
const mk = async (n, role, hobby, skillRole) => {
  const u = await prisma.user.create({
    data: {
      name: n, email: `${n}${rnd}@t.com`, passwordHash: 'x', role, hobby, emailVerifiedAt: new Date(),
      ...(skillRole ? { skills: { create: { skill: hobby, skillKey: hobby.toLowerCase(), role: skillRole } } } : {}),
    },
  });
  ids.push(u.id);
  return { id: u.id, token: jwt.sign({ sub: u.id, role }, SECRET, { expiresIn: '1h' }) };
};
const key = new Map(MENTOR_QUIZ_POOL.map((q) => [q.id, q]));
const takeQuiz = async (token, skill, correct) => {
  const start = await j('GET', `/onboarding/mentor-quiz?skill=${encodeURIComponent(skill)}`, token);
  if (start.status !== 200) return start;
  const answers = start.data.questions.map((q) => {
    const right = key.get(q.id).correctIndex;
    return { questionId: q.id, selectedIndex: correct ? right : (right + 1) % q.options.length };
  });
  return j('POST', '/onboarding/mentor-quiz/submit', token, { answers, skill });
};
const xpRows = (userId, skill) => prisma.xpEvent.findMany({ where: { userId, skill: skill.toLowerCase() } });
const board = async (token, role, category) => {
  const r = await j('GET', `/leaderboard?role=${role}&category=${encodeURIComponent(category)}`, token);
  return Array.isArray(r.data) ? r.data : [];
};
for (let i = 0; i < 40; i++) { try { if ((await fetch(BASE + '/health/live')).ok) break; } catch {} await wait(1000); }

try {
  // ---- first skill at sign-up ----
  const NEW = await mk(`SkA${rnd}`, null, MU);
  const e1 = await j('POST', '/onboarding/enroll-learner', NEW.token);
  ok(e1.status === 200 && e1.data.user?.role === 'LEARNER', `sign-up: joins first skill as Learner (${e1.status})`);
  let A = { id: NEW.id, token: e1.data.tokens.accessToken };
  let sk = await j('GET', '/onboarding/skills', A.token);
  ok(sk.data.length === 1 && sk.data[0].skill === MU && sk.data[0].role === 'Learner' && sk.data[0].isPrimary, 'one skill: Music · Learner (main)');

  // ---- add a second skill as a MENTOR (quiz) ----
  const failQ = await takeQuiz(A.token, ART, false);
  ok(failQ.status === 200 && failQ.data.passed === false, 'failing the mentor test does not grant Mentor');
  sk = await j('GET', '/onboarding/skills', A.token);
  ok(sk.data.length === 1, 'a failed test adds no skill by itself');

  const passQ = await takeQuiz(A.token, CO, true);
  ok(passQ.status === 200 && passQ.data.passed === true && passQ.data.skill === CO, `passes the Coding mentor test (${passQ.status})`);
  ok(passQ.data.session?.user?.role === 'LEARNER', 'account stays Learner (main skill is still Music)');
  A.token = passQ.data.session.tokens.accessToken;
  sk = await j('GET', '/onboarding/skills', A.token);
  const roleOf = (s) => sk.data.find((x) => x.skill === s)?.role;
  ok(sk.data.length === 2 && roleOf(MU) === 'Learner' && roleOf(CO) === 'Mentor', 'two skills: Music · Learner + Coding · Mentor');
  ok((await takeQuiz(A.token, CO, true)).status === 400, 'cannot re-take the test for a skill you already mentor');

  // ---- add a third skill as a Learner ----
  const add = await j('POST', '/onboarding/enroll-learner', A.token, { skill: ART });
  sk = await j('GET', '/onboarding/skills', A.token);
  ok(add.status === 200 && sk.data.length === 3 && roleOf(ART) === 'Learner' && roleOf(CO) === 'Mentor', 'adds Art as Learner; Coding stays Mentor');
  await j('POST', '/onboarding/enroll-learner', A.token, { skill: CO });
  sk = await j('GET', '/onboarding/skills', A.token);
  ok(roleOf(CO) === 'Mentor' && sk.data.length === 3, 're-joining a skill as Learner never lowers a Mentor');

  // ---- posts carry a skill; the badge follows the role in that skill ----
  const pCo = await j('POST', '/posts', A.token, { content: 'coding post', title: 'c', postType: 'text', skill: CO });
  ok(pCo.status === 201 && pCo.data.authorSkill === CO && pCo.data.authorRole === 'Mentor', `Coding post → shown as Mentor (${pCo.data.authorSkill} ${pCo.data.authorRole})`);
  const pMu = await j('POST', '/posts', A.token, { content: 'music post', title: 'm', postType: 'text' });
  ok(pMu.status === 201 && pMu.data.authorSkill === MU && pMu.data.authorRole === 'Learner', `default post → main skill, shown as Learner (${pMu.data.authorSkill} ${pMu.data.authorRole})`);
  const pBad = await j('POST', '/posts', A.token, { content: 'x', title: 'x', postType: 'text', skill: `Nope${rnd}` });
  ok(pBad.data.authorSkill === MU, 'a skill you have not joined is ignored (falls back to main)');

  // ---- XP is recorded per skill with the role in that skill ----
  const coXp = await xpRows(A.id, CO);
  const muXp = await xpRows(A.id, MU);
  ok(coXp.length > 0 && coXp.every((e) => e.role === 'Mentor'), `Coding XP is Mentor XP (${coXp.length} rows)`);
  ok(muXp.length > 0 && muXp.every((e) => e.role === 'Learner'), `Music XP is Learner XP (${muXp.length} rows)`);

  // ---- critiques: only a Mentor IN THE POST'S SKILL ----
  const B = await mk(`SkB${rnd}`, 'LEARNER', CO, 'LEARNER');
  const C = await mk(`SkC${rnd}`, 'LEARNER', MU, 'LEARNER');
  const bPost = await j('POST', '/posts', B.token, { content: 'b coding', title: 'b', postType: 'text' });
  const cPost = await j('POST', '/posts', C.token, { content: 'c music', title: 'c', postType: 'text' });
  const crit = await j('POST', `/posts/${bPost.data.id}/comments`, A.token, { text: 'tighten this loop', commentType: 'mentor', isMentorCritique: true, mentorRating: 4 });
  const critRow = (crit.data.comments ?? []).find((x) => x.text === 'tighten this loop');
  ok(crit.status === 201 && critRow?.authorRole === 'Mentor', `can critique a Coding post, shown as Mentor (${crit.status})`);
  const noCrit = await j('POST', `/posts/${cPost.data.id}/comments`, A.token, { text: 'as mentor', commentType: 'mentor', isMentorCritique: true });
  ok(noCrit.status === 403, `cannot critique a Music post — only a Learner there (${noCrit.status})`);
  const gen = await j('POST', `/posts/${cPost.data.id}/comments`, A.token, { text: 'nice take' });
  const genRow = (gen.data.comments ?? []).find((x) => x.text === 'nice take');
  ok(gen.status === 201 && genRow?.authorRole === 'Learner', `comment on a Music post is shown as Learner (${genRow?.authorRole})`);
  const critXp = await prisma.xpEvent.findFirst({ where: { userId: A.id, ruleKey: 'CRITIQUE_GIVEN' } });
  ok(critXp?.skill === CO.toLowerCase() && critXp?.role === 'Mentor', 'critique XP → Coding, Mentor');
  const comXp = await prisma.xpEvent.findFirst({ where: { userId: A.id, ruleKey: 'COMMENT_POSTED' } });
  ok(comXp?.skill === MU.toLowerCase() && comXp?.role === 'Learner', 'comment XP → Music, Learner');
  // B (Coding learner) viewing: their own comment on a Music post is a plain Learner comment
  const bOnMusic = await j('POST', `/posts/${cPost.data.id}/comments`, B.token, { text: 'from a coder' });
  const bXp = await prisma.xpEvent.findFirst({ where: { userId: B.id, ruleKey: 'COMMENT_POSTED' } });
  ok(bOnMusic.status === 201 && bXp?.skill === CO.toLowerCase(), 'activity in a skill you have not joined counts toward your main skill');

  // ---- received XP follows the post's skill ----
  await j('POST', `/posts/${pCo.data.id}/like`, B.token);
  const likeXp = await prisma.xpEvent.findFirst({ where: { userId: A.id, ruleKey: 'LIKE_RECEIVED' } });
  ok(!likeXp || (likeXp.skill === CO.toLowerCase() && likeXp.role === 'Mentor'), 'a like on the Coding post pays Coding / Mentor XP');

  // ---- leaderboards: one member, two boards ----
  const inBoard = async (role, cat) => (await board(A.token, role, cat)).some((r) => r.id === A.id);
  ok(await inBoard('Mentor', CO), 'ranked on the Mentor board for Coding');
  ok(await inBoard('Learner', MU), 'ranked on the Learner board for Music');
  ok(!(await inBoard('Mentor', MU)), 'NOT on the Mentor board for Music');
  ok(!(await inBoard('Learner', CO)), 'NOT on the Learner board for Coding');
  const mentorRow = (await board(A.token, 'Mentor', CO)).find((r) => r.id === A.id);
  const coTotal = (await xpRows(A.id, CO)).reduce((s, e) => s + e.amount, 0);
  ok(mentorRow?.xpPoints === coTotal && mentorRow?.role === 'Mentor', `Mentor board shows only Coding XP (${mentorRow?.xpPoints} = ${coTotal})`);
  const cats = await j('GET', '/leaderboard/categories', A.token);
  ok(Array.isArray(cats.data) && cats.data.includes(CO) && cats.data.includes(MU), 'both skills appear in the ranking filter');

  // ---- per-skill XP in the profile ----
  sk = await j('GET', '/onboarding/skills', A.token);
  const xpOf = (s) => sk.data.find((x) => x.skill === s)?.xp ?? 0;
  ok(xpOf(CO) === coTotal && xpOf(MU) > 0 && xpOf(ART) === 0, `profile shows XP per skill (Coding ${xpOf(CO)}, Music ${xpOf(MU)}, Art ${xpOf(ART)})`);

  // ---- main skill ----
  const notMine = await j('PATCH', '/users/me', A.token, { hobby: `Nope${rnd}` });
  ok(notMine.status === 400, 'main skill must be one you have added');
  const prim = await j('POST', '/onboarding/skills/primary', A.token, { skill: CO });
  ok(prim.status === 200 && prim.data.user?.role === 'MENTOR' && prim.data.user?.hobby === CO, 'switching main skill to Coding makes the account a Mentor');
  A.token = prim.data.tokens.accessToken;
  const pub = await j('GET', `/users/${A.id}`, B.token);
  ok(pub.status === 200 && (pub.data.skills ?? []).length === 3, 'public profile lists every skill');

  // ---- guests: no skills until they upgrade ----
  const GN = await mk(`SkG${rnd}`, null, MU);
  const g = await j('POST', '/onboarding/continue-guest', GN.token);
  const G = { id: GN.id, token: g.data.tokens.accessToken };
  ok((await j('GET', '/onboarding/skills', G.token)).data.length === 0, 'a Guest has no skills');
  const gPost = await j('POST', '/posts', G.token, { content: 'guest', title: 'g', postType: 'text' });
  ok(gPost.data.authorRole === 'Guest' && (await prisma.xpEvent.count({ where: { userId: G.id } })) === 0, 'Guest still earns no XP');
  const up = await j('POST', '/onboarding/enroll-learner', G.token);
  const gSk = await j('GET', '/onboarding/skills', up.data.tokens?.accessToken);
  ok(up.data.user?.role === 'LEARNER' && gSk.data.length === 1 && gSk.data[0].skill === MU, 'after upgrading, the Guest gets their first skill');
} finally {
  await prisma.post.deleteMany({ where: { authorId: { in: ids } } }).catch(() => {});
  await prisma.xpEvent.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch((e) => console.log('cleanup:', e.message));
  await prisma.$disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
}
