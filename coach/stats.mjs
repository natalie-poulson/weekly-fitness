#!/usr/bin/env node
// coach/stats.mjs: prints your baseline and trend in the terminal. Writes nothing.
//
//   node coach/stats.mjs                                   # coach/history.json (private)
//   node coach/stats.mjs --in coach/history.example.json   # fake data

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function fail(msg) { console.error('✗ ' + msg); process.exit(1); }
function readJson(p) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { fail(`Couldn't read ${p}: ${e.message}`); } }
const maybe = p => (existsSync(p) ? readJson(p) : null);

const args = process.argv.slice(2), i = args.indexOf('--in');
const inPath = i >= 0 && args[i + 1] ? resolve(process.cwd(), args[i + 1]) : resolve(ROOT, 'coach/history.json');
const H = readJson(inPath);
const P = maybe(resolve(ROOT, 'coach/profile.json'));
const TG = maybe(resolve(ROOT, 'coach/targets.local.json'));
const W = Array.isArray(H.weeks) ? H.weeks : [];
const f1 = n => n.toFixed(1);
const lbsOf = w => (w && w.weighIn && typeof w.weighIn.lbs === 'number' ? w.weighIn.lbs : null);

const tr = W.map((w, k) => {
  if (lbsOf(w) == null) return null;
  const vals = W.slice(Math.max(0, k - 2), k + 1).map(lbsOf).filter(v => v != null);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
});
const idx = tr.map((t, k) => (t == null ? -1 : k)).filter(k => k >= 0);
const goals = H.goals || {};

console.log(`History: ${W.length} week(s), ${idx.length} weigh-in(s)`);
if (!idx.length) console.log('  No weigh-ins yet. Add your starting weigh-in (lbs) to coach/history.json.');
else {
  const start = typeof goals.startWeight === 'number' ? goals.startWeight : lbsOf(W[idx[0]]);
  const last = idx[idx.length - 1], latest = lbsOf(W[last]);
  console.log(`  Start ${f1(start)} lb · latest ${f1(latest)} lb (${W[last].weekOf})`);
  if (idx.length >= 2) {
    const first = idx[0], span = last - first, lbsWk = span > 0 ? (tr[first] - tr[last]) / span : 0;
    const band = Array.isArray(goals.weeklyLossPct) ? goals.weeklyLossPct : [0.5, 0.8];
    console.log(`  3-week trend ${f1(tr[last])} lb · ${f1(lbsWk)} lb/week (${(lbsWk / tr[last] * 100).toFixed(2)}%; target ${band[0]}–${band[1]}%)`);
  }
  if (typeof goals.goalWeight === 'number') console.log(`  Goal ${goals.goalWeight} lb · ${f1(tr[last] - goals.goalWeight)} lb to go`);
  const me = P && P.people && P.people.natalie;
  if (me && typeof me.heightIn === 'number') console.log(`  BMI ${(703 * latest / me.heightIn ** 2).toFixed(1)}`);
}

const recent = W.slice(-4).filter(w => w.sessions && w.sessions.planned && w.sessions.completed);
if (recent.length) {
  const sum = o => (o.rides || 0) + (o.swims || 0) + (o.pilates || 0) + (o.finishers || 0);
  const p = recent.reduce((a, w) => a + sum(w.sessions.planned), 0), c = recent.reduce((a, w) => a + sum(w.sessions.completed), 0);
  console.log(`Workouts, last ${recent.length} week(s): ${c}/${p} (${p ? Math.round(c / p * 100) : 0}%)`);
}
const nut = W.slice(-4).filter(w => w.nutrition && typeof w.nutrition.daysOnPlan === 'number');
if (nut.length) console.log(`Nutrition, last ${nut.length} week(s): ${nut.reduce((a, w) => a + w.nutrition.daysOnPlan, 0)}/${nut.length * 7} days on plan`);
const g = W.length && W[W.length - 1].garmin;
if (g) console.log(`Last week: ${g.avgSteps.toLocaleString('en-US')} steps/day (goal ${g.stepGoal.toLocaleString('en-US')}) · Body Battery ${g.avgBodyBattery} · Sleep ${g.avgSleepScore}`);
if (TG) for (const r of Object.values(TG.people || {})) console.log(`Target · ${r.name}: ${r.kcal != null ? r.kcal + ' kcal' : '—'} · ${r.proteinG != null ? r.proteinG + ' g protein' : '—'}`);
