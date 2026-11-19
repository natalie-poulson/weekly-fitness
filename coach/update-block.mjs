#!/usr/bin/env node
// coach/update-block.mjs: daily targets for Natalie and B, plus the training days.
// Reads coach/profile.json (stats + goal weight), coach/training.json (factors) and
// coach/history.json (Natalie's 3-week weight trend). Writes coach/targets.local.json (private).
//
//   node coach/update-block.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'coach/targets.local.json');
const HIST = resolve(ROOT, 'coach/history.json');
function fail(msg) { console.error('✗ ' + msg); process.exit(1); }
function readJson(p) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { fail(`Couldn't read ${p}: ${e.message}`); } }

const P = readJson(resolve(ROOT, 'coach/profile.json'));
const T = readJson(resolve(ROOT, 'coach/training.json'));
const H = existsSync(HIST) ? readJson(HIST) : null;
const N = Object.assign({ fiberGPer1000Kcal: 14, fiberMinG: 25, satFatMaxPctKcal: 10, sodiumMaxMg: 2300 }, T.nutrition);
const round = (v, to) => Math.round(v / to) * to;
const REQUIRED = ['sex', 'age', 'heightIn', 'weightLb', 'activity', 'goal'];
const HIST_PERSON = P.historyPerson || 'natalie';   // whose weigh-ins live in history.json

// Same 3-week trend as the app's Progress tab: average of weigh-ins in the last 3 weeks, missed weeks skipped.
function latestTrend(h) {
  const W = h && Array.isArray(h.weeks) ? h.weeks : [];
  const lbs = w => (w && w.weighIn && typeof w.weighIn.lbs === 'number') ? w.weighIn.lbs : null;
  for (let i = W.length - 1; i >= 0; i--) {
    if (lbs(W[i]) == null) continue;
    const vals = W.slice(Math.max(0, i - 2), i + 1).map(lbs).filter(v => v != null);
    return { lbs: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10, weekOf: W[i].weekOf };
  }
  return null;
}

const people = {};
for (const [key, p0] of Object.entries(P.people || {})) {
  const p = Object.assign({}, p0), notes = [];
  let weightSource = 'profile.json';

  // Weight: latest 3-week trend from history.json (falls back to profile.json until the first weigh-in).
  // Goal weight: always profile.json. encrypt.mjs copies it into history so the Progress tab can show it.
  if (key === HIST_PERSON && H) {
    const t = latestTrend(H);
    if (t) {
      if (typeof p.weightLb === 'number' && Math.abs(p.weightLb - t.lbs) >= 0.1) notes.push(`weight ${p.weightLb} → ${t.lbs} lb (3-week trend)`);
      p.weightLb = t.lbs; weightSource = `history.json trend (${t.weekOf})`;
    }
    const hg = H.goals && typeof H.goals.goalWeight === 'number' ? H.goals.goalWeight : null;
    if (typeof p.goalWeightLb === 'number' && hg !== p.goalWeightLb) notes.push(`Progress tab goal is ${hg ?? 'not set'}; run node coach/encrypt.mjs to update it to ${p.goalWeightLb} lb`);
  }

  const missing = REQUIRED.filter(k => p[k] == null || p[k] === '');
  const row = { name: p.name || key, weightLb: p.weightLb ?? null, weightSource, goalWeightLb: p.goalWeightLb ?? null,
                kcal: null, kcalFormula: null, kcalAdjust: 0, proteinG: null, fiberG: null, satFatMaxG: null,
                sodiumMaxMg: N.sodiumMaxMg, missing, notes };

  if (!missing.length) {
    if (!['female', 'male'].includes(p.sex)) fail(`${row.name}: sex must be "female" or "male".`);
    const factor = N.activityFactors[p.activity];
    if (!factor) fail(`${row.name}: activity must be one of: ${Object.keys(N.activityFactors).join(', ')}.`);
    if (!N.goals.includes(p.goal)) fail(`${row.name}: goal must be one of: ${N.goals.join(', ')}.`);
    const kg = p.weightLb * 0.45359237, cm = p.heightIn * 2.54;
    const bmr = 10 * kg + 6.25 * cm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
    const tdee = bmr * factor;
    const deficit = p.goal === 'lose' ? p.weightLb * (N.weeklyLossPctTarget / 100) * 3500 / 7 : 0;
    row.bmr = Math.round(bmr); row.tdee = Math.round(tdee); row.deficit = Math.round(deficit);
    row.kcalFormula = round(tdee - deficit, 50);
  }

  // kcalAdjust (set by the weekly check-in) rides on top of the formula, so targets keep updating as weight drops.
  row.kcalAdjust = typeof p.kcalAdjust === 'number' ? p.kcalAdjust : 0;
  if (typeof p.kcalOverride === 'number') {
    row.kcal = p.kcalOverride;
    notes.push('kcalOverride is set, so weekly recalibration is paused. Prefer kcalAdjust.');
  } else if (row.kcalFormula != null) row.kcal = row.kcalFormula + row.kcalAdjust;

  const floor = N.minKcal[p.sex];
  if (row.kcal != null && floor && row.kcal < floor) { notes.push(`raised to the ${floor} kcal floor`); row.kcal = floor; }

  const basis = typeof p.goalWeightLb === 'number' ? p.goalWeightLb : p.weightLb;
  if (typeof p.proteinOverrideG === 'number') row.proteinG = p.proteinOverrideG;
  else if (typeof basis === 'number') row.proteinG = round(basis * N.proteinGPerLbGoalWeight, 5);

  // Heart-health targets, checked by check-meals.mjs.
  if (row.kcal != null) {
    row.fiberG = Math.max(N.fiberMinG, Math.round(row.kcal / 1000 * N.fiberGPer1000Kcal));
    row.satFatMaxG = Math.round(row.kcal * N.satFatMaxPctKcal / 100 / 9);
  }
  people[key] = row;
}

// Training days, with a load tag the meal plan uses (bigger / higher-carb meals before hard days).
const c = T.current, deloadWeek = c.status === 'DELOAD';
const LOAD = { z5: 'hard', z34: 'hard', z2: 'moderate', z1: 'easy', rest: 'rest' };
function rideMinutes(d) {
  if (!d.ride) return null;
  const rt = T.rideTypes && T.rideTypes[d.ride.type];
  if (deloadWeek && rt && rt.levels) {
    const dlv = d.ride.type === 'hiit' ? T.deload.hiitLevel : d.ride.type === 'tempo' ? T.deload.tempoLevel : null;
    const li = dlv ? rt.levels.find(l => l.level === dlv) : null;
    if (li) return li.minutes;
  }
  return c.minutes[d.key];
}
const trainingDays = T.days.map(d => {
  const deload = deloadWeek && T.deload.days.includes(d.key);
  let load = deload ? 'rest' : (LOAD[d.zc] || 'easy');
  if (!deload && load === 'easy' && d.pilates) load = 'moderate';
  return { day: d.key, title: deload ? T.deload.title : d.title, load,
           minutes: !deload ? rideMinutes(d) : null,
           finisher: !deload && !!d.finisher, pilates: !deload && !!d.pilates };
});

writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), status: c.status, stepGoal: c.stepGoal, people, trainingDays }, null, 2) + '\n');

console.log('Daily targets');
for (const r of Object.values(people)) {
  const k = r.kcal != null ? `${r.kcal.toLocaleString('en-US')} kcal${r.kcalAdjust ? ` (formula ${r.kcalFormula} ${r.kcalAdjust > 0 ? '+' : ''}${r.kcalAdjust})` : ''}` : 'kcal: —';
  const pr = r.proteinG != null ? `${r.proteinG} g protein` : 'protein: —';
  const hh = r.fiberG != null ? ` · fiber ≥${r.fiberG} g · sat fat ≤${r.satFatMaxG} g · sodium ≤${r.sodiumMaxMg} mg` : '';
  console.log(`  ${r.name.padEnd(8)} ${k} · ${pr}${hh}`);
  if (r.weightLb != null) console.log(`           weight ${r.weightLb} lb from ${r.weightSource}${r.goalWeightLb != null ? ` · goal ${r.goalWeightLb} lb` : ''}`);
  if (r.missing.length) console.log(`           fill in coach/profile.json: ${r.missing.join(', ')}`);
  for (const n of r.notes) console.log(`           • ${n}`);
}
console.log(`Training days · ${c.status} · steps ${c.stepGoal.toLocaleString('en-US')}`);
for (const d of trainingDays) console.log(`  ${d.day}  ${d.load.padEnd(8)} ${d.title}${d.minutes ? ` · ${d.minutes} min` : ''}`);
console.log('✓ Wrote coach/targets.local.json (private).');
