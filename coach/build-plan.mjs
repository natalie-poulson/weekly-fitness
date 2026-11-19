#!/usr/bin/env node
// coach/build-plan.mjs: writes ./plan.json for the app from coach/training.json.
//
//   node coach/build-plan.mjs --dry-run         # print next week, write nothing
//   node coach/build-plan.mjs --status PROGRESS --res mon=+1 \
//        --note "mon: +1 resistance on Max Effort intervals" --headline "Small bump this week." --save
//
// Flags (see coach/README.md):
//   --status PROGRESS|HOLD|DELOAD     --steps N            --ride day=min (tue, wed, fri)
//   --level day=N (mon HIIT, thu tempo)                    --res day=+n
//   --headline "..."   --note "day: text" (repeatable; cleared each run unless --keep-notes)
//   --week YYYY-MM-DD (a Monday; default next Monday)      --save   --dry-run   --force
//
// RULES.md allows one change a week (progression.maxChangesPerWeek). --steps, --ride, --level and --res
// each count as one; --force allows more, for fixing a mistake. DELOAD changes go into plan.json only:
// the saved values in training.json stay as they were, so the week after a deload goes back to them.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TRAINING = resolve(ROOT, 'coach/training.json');
const OUT = resolve(ROOT, 'plan.json');
const STATUSES = ['PROGRESS', 'HOLD', 'DELOAD'];

function fail(msg) { console.error('✗ ' + msg); process.exit(1); }
function warn(msg) { console.log('! ' + msg); }
function readJson(p) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { fail(`Couldn't read ${p}: ${e.message}`); } }
const fmtOff = v => (v > 0 ? '+' : '') + v;

// ---- Arguments: unknown options and missing values stop the run instead of being ignored ----
const VALUED = new Set(['--status', '--steps', '--ride', '--level', '--res', '--headline', '--note', '--week']);
const SWITCHES = new Set(['--save', '--dry-run', '--force', '--keep-notes', '--clear-notes']);
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (VALUED.has(a)) {
    if (args[i + 1] == null || args[i + 1].startsWith('--')) fail(`${a} needs a value.`);
    i++;
  } else if (!SWITCHES.has(a)) fail(`Unknown option ${a}. See coach/README.md.`);
}
const has = f => args.includes(f);
const all = f => args.flatMap((a, i) => (a === f ? [args[i + 1]] : []));
const one = f => { const v = all(f); if (v.length > 1) fail(`${f} can only be given once.`); return v[0]; };
const force = has('--force');

const T = readJson(TRAINING);
const cur = structuredClone(T.current);
cur.levels = cur.levels || {};
const P = T.progression || {};
const D = T.deload || {};
const [RES_LO, RES_HI] = T.limits.resistanceOffset;
const clampRes = v => Math.min(RES_HI, Math.max(RES_LO, v));
const typeOf = key => { const d = T.days.find(x => x.key === key); return d && d.ride ? T.rideTypes[d.ride.type] : null; };
const levelInfo = (key, n) => { const t = typeOf(key); return t && t.levels ? t.levels.find(l => l.level === n) : null; };
const prevStatus = T.current.status;
const changes = [];

// ---- --status ----
const status = one('--status');
if (status) {
  if (!STATUSES.includes(status.toUpperCase())) fail('--status must be PROGRESS, HOLD or DELOAD.');
  cur.status = status.toUpperCase();
}

// ---- --steps: one step of limits.stepGoalChange at a time, never above limits.stepGoalMax ----
const steps = one('--steps');
if (steps) {
  const n = parseInt(String(steps).replace(/,/g, ''), 10);
  if (!(n >= 1000 && n <= 30000)) fail('--steps must be a number like 8000.');
  const max = T.limits.stepGoalMax || 30000, step = T.limits.stepGoalChange || 500;
  if (n > max) fail(`--steps: the step goal is capped at ${max.toLocaleString('en-US')}.`);
  if (Math.abs(n - cur.stepGoal) > step && !force) fail(`--steps: change by ${step} at most (now ${cur.stepGoal.toLocaleString('en-US')}). Add --force to override.`);
  if (n !== cur.stepGoal) changes.push(`steps ${cur.stepGoal} → ${n}`);
  cur.stepGoal = n;
}

// ---- --ride: days whose length isn't set by a level (tue cruise, wed, fri) ----
for (const r of all('--ride')) {
  const [day, m] = r.split('=');
  const t = typeOf(day);
  if (!t) fail(`--ride ${r}: use a ride day (tue, wed, fri), like tue=50.`);
  if (t.levels) fail(`--ride ${r}: ${t.name} length comes from its level. Use --level ${day}=N.`);
  const min = parseInt(m, 10);
  if (!(min >= t.min && min <= t.max)) fail(`--ride ${r}: ${t.name} stays between ${t.min} and ${t.max} min.`);
  if (min !== cur.minutes[day]) changes.push(`${day} ${cur.minutes[day]} → ${min} min`);
  cur.minutes[day] = min;
}

// ---- --level: mon HIIT, thu tempo. Up one level at a time; a level-up lowers resistance by levelUpResistanceDrop ----
for (const r of all('--level')) {
  const [day, v] = r.split('=');
  const t = typeOf(day);
  if (!t || !t.levels) fail(`--level ${r}: only mon (HIIT) and thu (tempo) have levels.`);
  const n = parseInt(v, 10), was = cur.levels[day] || 1;
  if (!levelInfo(day, n)) fail(`--level ${r}: ${t.name} has levels 1–${t.levels.length}.`);
  if (n > was + 1 && !force) fail(`--level ${r}: go up one level at a time (now ${was}). Add --force to override.`);
  if (n === was) continue;
  if (n > was) cur.resistance[day] = clampRes((cur.resistance[day] || 0) - (P.levelUpResistanceDrop || 0));
  cur.levels[day] = n;
  changes.push(`${day} level ${was} → ${n}`);
}

// ---- --res: adds to the saved offset on that day's work intervals ----
for (const r of all('--res')) {
  const [day, v] = r.split('=');
  const n = parseInt(v, 10);
  if (!(day in cur.resistance) || Number.isNaN(n)) fail(`--res ${r}: use a ride day and a number, like mon=+1.`);
  const next = cur.resistance[day] + n;
  if (next < RES_LO || next > RES_HI) fail(`--res ${r}: the total offset for ${day} must stay between ${RES_LO} and +${RES_HI} (now ${fmtOff(cur.resistance[day])}).`);
  if (n) changes.push(`${day} resistance ${fmtOff(cur.resistance[day])} → ${fmtOff(next)}`);
  cur.resistance[day] = next;
}

// Days with levels always take their length from the level.
for (const d of T.days) {
  const t = d.ride && T.rideTypes[d.ride.type];
  if (!t || !t.levels) continue;
  cur.levels[d.key] = cur.levels[d.key] || 1;
  const li = levelInfo(d.key, cur.levels[d.key]);
  if (!li) fail(`training.json: ${d.key} is at level ${cur.levels[d.key]}, but ${t.name} has levels 1–${t.levels.length}.`);
  cur.minutes[d.key] = li.minutes;
}

const maxChanges = P.maxChangesPerWeek || 1;
if (changes.length > maxChanges && !force) fail(`${changes.length} changes (${changes.join('; ')}). RULES.md allows ${maxChanges} a week. Add --force to override.`);
if (changes.length && cur.status !== 'PROGRESS') warn(`Ride changes on a ${cur.status} week. RULES.md only changes rides on PROGRESS weeks.`);

// ---- Headline and notes. Notes describe this week's change, so they never carry over by accident ----
const headline = one('--headline');
if (headline) cur.headline = headline;
const notes = all('--note');
if (notes.length) {
  cur.adjustments = notes.map(n => {
    const m = n.match(/^(mon|tue|wed|thu|fri|sat|sun):\s*(.+)$/);
    return m ? { day: m[1], text: m[2] } : { day: null, text: n };
  });
} else if (!has('--keep-notes')) cur.adjustments = [];   // --clear-notes still works; it's now the default

// ---- --week: a real Monday, in local time. Default: the Monday after today ----
const DAY_MS = 86400000;
const isoLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function nextMonday(from) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12);
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return isoLocal(d);
}
const today = new Date();
const weekOf = one('--week') || nextMonday(today);
const wm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekOf);
const wDate = wm ? new Date(+wm[1], +wm[2] - 1, +wm[3], 12) : null;
if (!wDate || isoLocal(wDate) !== weekOf) fail(`--week ${weekOf}: use a real date like 2026-11-23.`);
if (wDate.getDay() !== 1) fail(`--week ${weekOf} is a ${wDate.toLocaleDateString('en-US', { weekday: 'long' })}. The next Monday is ${nextMonday(new Date(wDate.getTime() - DAY_MS))}.`);
const daysAhead = Math.round((wDate - new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12)) / DAY_MS);
if (daysAhead < -6 && !force) fail(`--week ${weekOf} is in the past. Add --force to rebuild an old week.`);
if (daysAhead > 14) warn(`--week ${weekOf} is more than 2 weeks away.`);
const lastWeek = T.current.lastPlanWeekOf || null;
if (lastWeek && weekOf < lastWeek && !force) fail(`--week ${weekOf} is before the last saved plan (${lastWeek}). Add --force to override.`);

// ---- Easier-week counter (RULES.md): training weeks completed since the last DELOAD ----
// Saving a plan for a new week counts the week before it. Re-saving the same week doesn't count twice.
if (lastWeek !== weekOf) cur.weeksSinceDeload = prevStatus === 'DELOAD' ? 0 : (T.current.weeksSinceDeload || 0) + 1;
if (cur.status === 'DELOAD') { cur.weeksSinceDeload = 0; cur.lastDeloadWeekOf = weekOf; }
cur.lastPlanWeekOf = weekOf;
const every = D.everyWeeks || [4, 6];
if (cur.status !== 'DELOAD' && cur.weeksSinceDeload >= every[1] - 1) warn(`This would be week ${cur.weeksSinceDeload + 1} without an easier week. RULES.md says DELOAD is due.`);

// ---- Build the week ----
const deloadOn = cur.status === 'DELOAD';
function levelText(minutes, lv) {
  if (lv.rounds) return `${minutes} min stationary bike, level ${lv.level}. Warm up, then ${lv.rounds} rounds of ${lv.workMin} min max effort + ${lv.easyMin} min easy spin.`;
  if (lv.blocks) return `${minutes} min bike tempo burn (comfortably hard), level ${lv.level}: ${lv.blocks} at tempo.`;
  return null;
}
const days = structuredClone(T.days).map(d => {
  if (deloadOn && (D.days || []).includes(d.key)) {
    delete d.ride; delete d.swap; delete d.finisher;
    return Object.assign(d, { zone: 'Zone 1', zc: 'rest', focus: 'Deload', title: D.title, short: 'Easy spin', text: D.text, rest: true, deload: true });
  }
  if (!d.ride) return d;
  const t = T.rideTypes[d.ride.type];
  let level = t.levels ? cur.levels[d.key] : null;
  let off = cur.resistance[d.key] || 0;
  if (deloadOn) {
    off = clampRes(off + (D.otherDaysResistanceOffset || 0));
    if (d.ride.type === 'hiit' && D.hiitLevel) level = D.hiitLevel;
    if (d.ride.type === 'tempo' && D.tempoLevel) level = D.tempoLevel;
  }
  const lv = level ? levelInfo(d.key, level) : null;
  const minutes = lv ? lv.minutes : cur.minutes[d.key];
  d.ride = { type: d.ride.type, minutes };
  if (lv) { d.ride.level = level; d.text = levelText(minutes, lv) || d.text; }
  if (off) d.ride.adjust = { segment: t.workSegment, resistance: off };
  return d;
});

const plan = {
  schema: 1,
  weekOf,
  generatedAt: new Date().toISOString(),
  calibration: { status: cur.status, headline: cur.headline, stepGoal: cur.stepGoal, adjustments: cur.adjustments },
  days
};

const rides = days.filter(d => d.ride).length;
console.log(`${rides} rides · ${cur.status} · steps ${cur.stepGoal.toLocaleString('en-US')}`);
console.log(`Week of ${weekOf} · ${cur.headline}`);
for (const d of days) {
  const r = d.ride;
  const what = r ? `${T.rideTypes[r.type].name}${r.level ? ` L${r.level}` : ''} ${r.minutes} min${r.adjust ? ` (resistance ${fmtOff(r.adjust.resistance)})` : ''}` : d.title;
  console.log(`  ${d.name.padEnd(10)} ${what}${d.swap ? ' · or swim' : ''}${d.finisher ? ' + finisher' : ''}${d.pilates ? ' + Pilates' : ''}`);
}
for (const a of cur.adjustments) console.log(`  • ${a.day ? a.day + ': ' : ''}${a.text}`);
console.log(`Easier-week counter: ${cur.weeksSinceDeload} week(s) since the last DELOAD${cur.lastDeloadWeekOf ? ` (${cur.lastDeloadWeekOf})` : ''}.`);

if (has('--dry-run')) { console.log('Dry run: nothing written.'); process.exit(0); }
writeFileSync(OUT, JSON.stringify(plan, null, 2) + '\n');
if (has('--save')) { T.current = cur; writeFileSync(TRAINING, JSON.stringify(T, null, 2) + '\n'); }
else warn('training.json not saved. Add --save so next week starts from these values and the easier-week counter moves on.');
console.log(`✓ Wrote plan.json${has('--save') ? ' and saved coach/training.json' : ''}.`);
