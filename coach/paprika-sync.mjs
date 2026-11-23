#!/usr/bin/env node
// coach/paprika-sync.mjs: keeps Paprika in step with the plan in coach/meal-history.local.json.
// The plan is the source of truth. This script works out exactly what Paprika should hold (planner
// entries, Coach Notes blocks, grocery items), checks the plan's own text for drift, remembers what has
// already been written (UIDs in plan.paprika), and compares Paprika's actual state against the plan.
// So a frozen or interrupted session can always pick up where it stopped. Reads and writes only the
// private plan file; never commit its output.
//
//   node coach/paprika-sync.mjs                    # check + what's still to write (latest plan)
//   node coach/paprika-sync.mjs --week 2026-11-29  # a given plan
//   node coach/paprika-sync.mjs --json             # same, machine-readable (add_meals items ready to send)
//   node coach/paprika-sync.mjs record <file>      # save UIDs from Paprika tool output pasted into <file>
//                                                  #   (add_meals / update_meal / delete_meal / add_grocery_items)
//   node coach/paprika-sync.mjs notes-done <recipeUid> [...]   # mark Coach Notes as written
//   node coach/paprika-sync.mjs compare <file>     # <file> = list_meal_history output for the plan's dates
//   node coach/paprika-sync.mjs compare-grocery <file>  # <file> = read_grocery_list output
//
// Plan fields it reads (full format in coach/README.md):
//   meal.recipes      [{ uid, title, notes: [lines] }]  Paprika recipes linked in the planner, each with its Coach Notes body
//   meal.plannerName  the planner text for a meal with no linked recipe (Quick Assembly, office entry)
//   meal.plannerExtras ["Side: ...", "With: ..."]  extra freeform entries in the same slot
//   plan.reminders    [{ day, type, text }]  freeze/thaw/Instant Pot/prep/holiday entries (type defaults to Dinner)
//   plan.paprika      { planner: { key: uid }, notes: { recipeUid: hash }, grocery: { name: uid } }  written so far

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const P = resolve(ROOT, 'coach/meal-history.local.json');
const fail = m => { console.error('✗ ' + m); process.exit(1); };
if (!existsSync(P)) fail('No coach/meal-history.local.json. Run /meal-plan first.');
const MH = JSON.parse(readFileSync(P, 'utf8'));
const argv = process.argv.slice(2);
const wi = argv.indexOf('--week');
const week = wi >= 0 ? argv[wi + 1] : null;
const args = argv.filter((a, i) => !(a === '--week' || (wi >= 0 && i === wi + 1)));
const plans = Array.isArray(MH.plans) ? MH.plans : [];
const plan = week ? plans.find(p => p.weekOf === week) : plans[plans.length - 1];
if (!plan) fail(`No plan${week ? ` for week ${week}` : ''}.`);
plan.paprika = plan.paprika || {};
for (const k of ['planner', 'names', 'notes', 'grocery']) plan.paprika[k] = plan.paprika[k] || {};
const save = () => writeFileSync(P, JSON.stringify(MH, null, 1) + '\n');

// ---- Dates (same rules as check-meals: Sunday dinner to next Sunday's breakfast) ----
const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const pad = n => String(n).padStart(2, '0');
const startOf = w => { const [y, m, d] = w.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const s0 = startOf(plan.weekOf).getDay();
const KEYS = [...DOW.map((_, i) => DOW[(s0 + i) % 7]), ...(s0 === 0 ? ['nextSun'] : [])];
const dateOf = k => { const dt = startOf(plan.weekOf); dt.setDate(dt.getDate() + KEYS.indexOf(k)); return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`; };
const LABEL = { sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', nextSun: 'next Sun' };
const TYPE = { breakfast: 'Breakfast', lunch: 'Lunch', office: 'Lunch', dinner: 'Dinner', snack: 'Snacks', preRide: 'Snacks', out: 'Dinner' };
const SLOTNAME = { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', snack: 'snack', preRide: 'pre-ride snack', office: 'office', out: 'night out' };
const fmt = n => Math.round(n).toLocaleString('en-US');
const low = s => String(s || '').toLowerCase();
const hash = s => createHash('sha1').update(s).digest('hex').slice(0, 12);

// ---- What Paprika should hold ----
const errs = [], warns = [];
const bad = (w, m) => errs.push(`${w}: ${m}`), warn = (w, m) => warns.push(`${w}: ${m}`);
const planner = [];            // { key, date, type, recipeUid?, name, k, why }
const notes = new Map();       // recipeUid -> { title, block, uses: [{ label, lines }] }
const add = (k, type, e) => { const date = dateOf(k); const key = `${date}|${type}|${e.recipeUid ? 'recipe:' + e.recipeUid : e.name}`; planner.push({ key, date, type, k, ...e }); };

for (const k of KEYS) {
  const d = (plan.days || []).find(x => x.day === k);
  if (!d || d.mealsOut || d.unplanned) continue;
  for (const m of d.meals || []) {
    const where = `${k} ${SLOTNAME[m.slot] || m.slot}${m.recipe ? ` (${m.recipe})` : ''}`;
    const type = TYPE[m.slot] || 'Snacks';
    const recipes = Array.isArray(m.recipes) ? m.recipes : [];
    for (const r of recipes) {
      if (!r.uid || !r.title) { bad(where, 'each recipes[] entry needs the Paprika uid and title'); continue; }
      add(k, type, { recipeUid: r.uid, name: r.title, why: where });
      if (!Array.isArray(r.notes) || !r.notes.length) { if (m.slot !== 'snack' && m.slot !== 'preRide') bad(where, `"${r.title}" needs its Coach Notes lines (recipes[].notes)`); continue; }
      // The same recipe twice with the same Notes (a smoothie on two mornings) gets one block: "Wed + Thu breakfast".
      const n = notes.get(r.uid) || { title: r.title, uses: [] };
      const same = n.uses.find(u => u.lines.join('\n') === r.notes.join('\n'));
      if (same) same.labels.push([LABEL[k], SLOTNAME[m.slot] || m.slot]); else n.uses.push({ labels: [[LABEL[k], SLOTNAME[m.slot] || m.slot]], lines: r.notes });
      notes.set(r.uid, n);
    }
    let name = m.plannerName;
    if (m.slot === 'office' && !name) {
      const v = m.per && m.per.natalie;
      if (v) name = `Office: ~${fmt(v.kcal)} kcal / ${fmt(v.proteinG)} g protein left (${m.note || 'palm of protein + half a plate of veg at lunch'})`;
    }
    if (!recipes.length && !name) bad(where, 'needs plannerName (or recipes[] with the Paprika recipe)');
    if (name) add(k, type, { name, why: where });
    for (const x of m.plannerExtras || []) add(k, type, { name: x, why: where });
  }
}
for (const n of notes.values()) n.block = n.uses.map(u => {
  const slots = [...new Set(u.labels.map(l => l[1]))];
  const when = slots.length === 1 ? `${u.labels.map(l => l[0]).join(' + ')} ${slots[0]}` : u.labels.map(l => l.join(' ')).join(' + ');
  return [`— Coach · week of ${plan.weekOf} · ${when} —`, ...u.lines].join('\n');
}).join('\n\n');
for (const r of plan.reminders || []) {
  if (!KEYS.includes(r.day) || !r.text) { bad('reminders', `"${r.text || '?'}" needs a day (${KEYS.join(', ')}) and text`); continue; }
  add(r.day, r.type || 'Dinner', { name: r.text, why: 'reminder' });
}
const dup = planner.map(p => p.key).filter((x, i, a) => a.indexOf(x) !== i);
for (const x of new Set(dup)) bad('planner', `"${x}" is planned twice`);

// ---- Drift checks: the plan's words must match its own data ----
const textOn = k => planner.filter(p => p.k === k && !p.recipeUid).map(p => p.name).join(' \n ');
const PROTEIN_WORDS = ['salmon', 'trout', 'sole', 'cod', 'halibut', 'snapper', 'tuna', 'albacore', 'shrimp', 'chicken', 'turkey', 'beef', 'lamb', 'pork', 'tofu', 'tempeh'];
const stripSwaps = s => low(s).replace(/instead of [^.;,)]*/g, ' ').replace(/\bfor the [^.;,)]* in the recipe/g, ' ');
for (const k of KEYS) {
  const d = (plan.days || []).find(x => x.day === k);
  if (!d) continue;
  for (const m of d.meals || []) {
    const where = `${k} ${SLOTNAME[m.slot] || m.slot}${m.recipe ? ` (${m.recipe})` : ''}`;
    const v = (m.per && m.per.natalie) || {}, b = (m.per && m.per.b) || {};
    // What the meal really uses: its protein tags and ingredients (not recipe titles: "Salmon Bowl" made with trout)
    const own = [...(m.protein || []), ...(m.ingredients || []).map(i => i.name)].map(low).join(' ');
    const titles = [m.recipe, ...(m.recipes || []).map(r => r.title)].filter(Boolean).map(low).sort((a, b) => b.length - a.length);
    const allowed = PROTEIN_WORDS.filter(w => new RegExp(`\\b${w}`).test(own));
    const texts = [m.plannerName || '', ...(m.plannerExtras || []), ...(m.recipes || []).flatMap(r => r.notes || [])];
    for (const t of texts) {
      let s = stripSwaps(t); for (const ti of titles) s = s.split(ti).join(' ');
      for (const w of PROTEIN_WORDS) if (new RegExp(`\\b${w}`).test(s) && !allowed.includes(w)) bad(where, `the Paprika text says "${w}" but the plan's protein and ingredients don't ("${t.slice(0, 70)}")`);
      const mN = t.match(/^Natalie\b[^:]*:.*\((\d[\d,]*) kcal, (\d+) g protein\)/), mB = t.match(/^B\b[^:]*:.*\((\d[\d,]*) kcal, (\d+) g protein\)/);
      if (mN && (Number(mN[1].replace(',', '')) !== Math.round(v.kcal) || Number(mN[2]) !== Math.round(v.proteinG))) bad(where, `Notes say Natalie ${mN[1]} kcal / ${mN[2]} g; the plan has ${fmt(v.kcal)} / ${fmt(v.proteinG)}`);
      if (mB && (Number(mB[1].replace(',', '')) !== Math.round(b.kcal) || Number(mB[2]) !== Math.round(b.proteinG))) bad(where, `Notes say B ${mB[1]} kcal / ${mB[2]} g; the plan has ${fmt(b.kcal)} / ${fmt(b.proteinG)}`);
    }
    // Reminders the rules call for
    const tags = (m.tags || []).map(low);
    if (tags.includes('frozenfish')) {
      const fish = (m.protein || []).map(low).find(w => PROTEIN_WORDS.includes(w)) || PROTEIN_WORDS.find(w => allowed.includes(w)) || 'fish';
      const i = KEYS.indexOf(k);
      if (!new RegExp(`freeze[^\\n]*${fish}|${fish}[^\\n]*freez`, 'i').test(textOn(KEYS[0]))) bad(where, `frozen ${fish}: add a "Freeze tonight" reminder on ${LABEL[KEYS[0]]}`);
      if (i > 0 && !new RegExp(`thaw[^\\n]*${fish}|${fish}[^\\n]*thaw`, 'i').test(textOn(KEYS[i - 1]))) bad(where, `frozen ${fish}: add a "Thaw tonight" reminder on ${LABEL[KEYS[i - 1]]}`);
    }
    const STAPLE = /\b(rice|beans?|lentils?|chickpeas?|farro|quinoa|barley|bulgur|polenta|freekeh|millet)\b/, NOT = /vinegar|wine|green beans?|edamame|canned|noodles?|paper|flour|sauce|paste|hummus/;
    for (const ing of m.ingredients || []) {
      const n = low(ing.name);
      if (!STAPLE.test(n) || NOT.test(n) || !/\bdry\b|\bdried\b/.test(low(ing.amount)) || ing.onHand) continue;
      const word = n.match(STAPLE)[1].replace(/s$/, '');
      const fromPrep = (plan.prep || []).some(p => (p.ingredients || []).some(x => low(x.name) === n));
      if (!fromPrep && !new RegExp(`${word}[^\\n]*\\bdry\\b|\\bdry\\b[^\\n]*${word}`, 'i').test(textOn(k))) bad(where, `${ing.name} (${ing.amount}): add a planner reminder or side entry on ${LABEL[k]} with the dry amount to cook`);
    }
  }
}

// ---- Commands ----
const cmd = args[0];
const readArg = () => { const f = args[1]; if (!f || !existsSync(f)) fail(`Give the file with the Paprika output: ${cmd} <file>`); return readFileSync(f, 'utf8'); };

if (cmd === 'record') {
  const text = readArg();
  let n = 0, del = 0, g = 0;
  // Replay the tool outputs in order (a meal can be added, deleted and added again).
  // add_meals / update_meal blocks: "# Name\n\n**UID:** `X`\n**Date:** 2026-11-22 ...\n**Type:** Dinner\n**Recipe:** ... (`UID`) | _(freeform)_"
  // delete_meal: 'Meal "Name" on 2026-11-22 00:00:00 deleted.'   add_grocery_items: "# name\n\n**UID:** ...\n**List:** ..."
  const events = [];
  for (const m of text.matchAll(/^# .+$/gm)) events.push({ i: m.index, kind: 'block' });
  for (const m of text.matchAll(/Meal "(.+?)" on (\d{4}-\d{2}-\d{2})[^\n]*? deleted/g)) events.push({ i: m.index, kind: 'delete', name: m[1], date: m[2] });
  events.sort((x, y) => x.i - y.i);
  for (let e = 0; e < events.length; e++) {
    const ev = events[e];
    if (ev.kind === 'delete') {
      for (const [k, u] of Object.entries(plan.paprika.planner)) if (k.startsWith(ev.date + '|') && plan.paprika.names[u] === ev.name) { delete plan.paprika.planner[k]; delete plan.paprika.names[u]; del++; }
      continue;
    }
    const blk = text.slice(ev.i, e + 1 < events.length ? events[e + 1].i : text.length);
    const name = (blk.match(/^# (.+)$/m) || [])[1], uid = (blk.match(/\*\*UID:\*\* `([^`]+)`/) || [])[1];
    const date = (blk.match(/\*\*Date:\*\* (\d{4}-\d{2}-\d{2})/) || [])[1], type = (blk.match(/\*\*Type:\*\* (\w+)/) || [])[1];
    const rec = (blk.match(/\*\*Recipe:\*\* .*\(`([^`]+)`\)/) || [])[1];
    if (name && uid && date && type) {
      const key = `${date}|${type}|${rec ? 'recipe:' + rec : name.trim()}`;
      for (const [k, u] of Object.entries(plan.paprika.planner)) if (u === uid && k !== key) delete plan.paprika.planner[k];   // renamed or moved
      plan.paprika.planner[key] = uid; plan.paprika.names[uid] = name.trim(); n++;
    } else if (name && uid && /\*\*List:\*\*/.test(blk)) { plan.paprika.grocery[name.trim()] = uid; g++; }
  }
  for (const [k, u] of Object.entries(plan.paprika.planner)) if (!planner.some(p => p.key === k)) warn('record', `"${plan.paprika.names[u] || u}" (${k.split('|').slice(0, 2).join(' ')}) is in Paprika but not in the plan: delete it, or add it to the plan if Natalie wants it`);
  save();
  console.log(`Recorded ${n} planner entr${n === 1 ? 'y' : 'ies'}, ${g} grocery item(s), removed ${del} deleted entr${del === 1 ? 'y' : 'ies'}.`);
  for (const w of warns.filter(w => w.startsWith('record'))) console.log('  ! ' + w);
  process.exit(0);
}

if (cmd === 'notes-done') {
  const uids = args.slice(1);
  if (!uids.length) fail('Give the recipe UID(s) whose Coach Notes were written.');
  for (const u of uids) { const n = notes.get(u); if (!n) fail(`${u} has no Coach Notes in this plan.`); plan.paprika.notes[u] = hash(n.block); }
  save(); console.log(`Marked Coach Notes written for ${uids.length} recipe(s).`); process.exit(0);
}

if (cmd === 'compare') {
  // list_meal_history output: "### Sun 22" then "- **Dinner** · A, B *(freeform)*, C"
  const text = readArg();
  const months = {};
  for (const p of planner) months[Number(p.date.slice(8))] = p.date;
  let date = null; const seen = new Map();
  for (const line of text.split('\n')) {
    const h = line.match(/^### \w+ (\d+)/); if (h) { date = months[Number(h[1])] || `?-${h[1]}`; continue; }
    const e = line.match(/^- \*\*(\w+)\*\* · (.+)$/); if (e && date) seen.set(`${date}|${e[1]}`, e[2]);
  }
  const missing = [], extra = [];
  const rests = new Map([...seen].map(([k, v]) => [k, ` ${v} `]));
  for (const p of [...planner].sort((a, b) => b.name.length - a.name.length)) {
    const k = `${p.date}|${p.type}`, r = rests.get(k) || '';
    const i = r.indexOf(p.name);
    if (i < 0) missing.push(p); else rests.set(k, r.slice(0, i) + ' ' + r.slice(i + p.name.length));
  }
  for (const [k, r] of rests) { const left = r.replace(/\*\(freeform\)\*/g, '').replace(/[,\s]+/g, ' ').trim(); if (left) extra.push(`${k.replace('|', ' ')}: ${left}`); }
  const dates = [...new Set(planner.map(p => p.date))].sort();
  console.log(`Paprika planner vs plan · ${dates[0]} to ${dates[dates.length - 1]}`);
  if (!missing.length && !extra.length) { console.log('✓ The planner matches the plan exactly.'); process.exit(0); }
  if (missing.length) { console.log(`✗ ${missing.length} missing from Paprika (add them):`); for (const p of missing) console.log(`  + ${p.date} ${p.type}: ${p.name}${p.recipeUid ? ` (recipe ${p.recipeUid})` : ''}`); }
  if (extra.length) { console.log(`✗ In Paprika but not in the plan (delete them, or add them to the plan if Natalie added them):`); for (const x of extra) console.log(`  - ${x}`); }
  process.exit(1);
}

if (cmd === 'compare-grocery') {
  const text = readArg();
  const have = [...text.matchAll(/^\| ([^|]+?) \| ([^|]*?) \| ([^|]*?) \| (Yes|No) \|$/gm)].map(m => low(m[1]));
  let gl;
  try { gl = JSON.parse(execFileSync(process.execPath, [resolve(ROOT, 'coach/grocery-list.mjs'), '--json', '--week', plan.weekOf], { encoding: 'utf8' })); }
  catch (e) { fail('grocery-list.mjs failed: ' + (e.stdout || e.message)); }
  // Loose name match: ignore sizes and prep words, treat stock as broth.
  const SKIP = ['fresh', 'small', 'large', 'medium', 'boneless', 'skinless', 'whole', 'low', 'sodium', 'added', 'salt', 'pitted', 'frozen', 'arils', 'pure', 'extract', 'sweetened', 'flaked', 'shelled', 'cooked', 'dry', 'dried', 'fillets', 'fillet'];
  const norm = s => low(s).replace(/\(.*?\)/g, '').replace(/,.*$/, '').replace(/\bstock\b/g, 'broth').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const core = s => norm(s).split(' ').filter(w => w.length > 2 && !SKIP.includes(w));
  // Bought as something else (an item can't be renamed in Paprika): plan.groceryAs { "planned name": "name on the list" }
  const as = plan.groceryAs || {};
  const missing = gl.items.filter(it => !have.some(h => { const a = core(as[it.name] || it.name), b = core(h); return a.length && a.every(w => b.some(x => x.startsWith(w.replace(/s$/, '')) || w.startsWith(x.replace(/s$/, '')))); }));
  // Proteins on the list that the plan doesn't use (e.g. salmon on the list, trout in the plan)
  const planText = low(JSON.stringify(plan.days));
  const mine = new Set(Object.keys(plan.paprika.grocery).map(low)), asList = new Set(Object.values(as).map(low));
  const stray = have.filter(h => mine.has(h) && !asList.has(h) && PROTEIN_WORDS.some(w => new RegExp(`\\b${w}`).test(h) && !new RegExp(`\\b${w}`).test(planText)));
  console.log(`My Grocery List vs plan · week of ${plan.weekOf}`);
  if (!missing.length && !stray.length) { console.log('✓ Every planned item is on the list.'); process.exit(0); }
  if (missing.length) { console.log(`✗ ${missing.length} planned item(s) not on the list:`); for (const it of missing) console.log(`  + ${it.name} · ${it.total || it.uses.map(u => u.amount).join(' + ')} · ${it.aisle}`); }
  if (stray.length) { console.log(`! On the list but the plan uses something else (rename or note it):`); for (const s of stray) console.log(`  ? ${s}`); }
  process.exit(missing.length ? 1 : 0);
}

if (cmd && cmd !== '--json') fail(`Unknown command "${cmd}". Use record, notes-done, compare or compare-grocery.`);

// ---- Status ----
const pendingPlanner = planner.filter(p => !plan.paprika.planner[p.key]);
const expectedKeys = new Set(planner.map(p => p.key));
const stale = Object.entries(plan.paprika.planner).filter(([k]) => !expectedKeys.has(k));
const pendingNotes = [...notes].filter(([u, n]) => plan.paprika.notes[u] !== hash(n.block));
const toItem = p => p.recipeUid ? { recipe_uid: p.recipeUid, date: p.date, type: { name: p.type } } : { name: p.name, date: p.date, type: { name: p.type } };

if (args.includes('--json')) {
  console.log(JSON.stringify({ weekOf: plan.weekOf, problems: errs, warnings: warns, addMeals: pendingPlanner.map(toItem),
    deleteMeals: stale.map(([key, uid]) => ({ key, uid })), notes: pendingNotes.map(([uid, n]) => ({ uid, title: n.title, block: n.block })) }, null, 2));
  process.exit(errs.length ? 1 : 0);
}

console.log(`Paprika sync · week of ${plan.weekOf} (${plan.status || 'draft'}) · ${planner.length} planner entries, ${notes.size} Coach Notes`);
if (warns.length) for (const w of warns) console.log('  ! ' + w);
if (errs.length) { console.log(`✗ ${errs.length} problem(s) in the plan; fix them before writing to Paprika:`); for (const e of errs) console.log('  ✗ ' + e); }
console.log(`\nPlanner: ${planner.length - pendingPlanner.length}/${planner.length} written${pendingPlanner.length ? `, ${pendingPlanner.length} to add:` : ' ✓'}`);
for (const p of pendingPlanner) console.log(`  + ${p.date} ${p.type}: ${p.name}`);
if (stale.length) { console.log(`  ${stale.length} written entr${stale.length === 1 ? 'y is' : 'ies are'} no longer in the plan (delete_meal, then record the output):`); for (const [k, u] of stale) console.log(`  - ${k.replace(/\|/g, ' ')} · uid ${u}`); }
console.log(`\nCoach Notes: ${notes.size - pendingNotes.length}/${notes.size} up to date${pendingNotes.length ? `, ${pendingNotes.length} to write (replace the old Coach block, keep her own notes):` : ' ✓'}`);
for (const [u, n] of pendingNotes) console.log(`\n  ${n.title} (${u})\n${n.block.split('\n').map(l => '    ' + l).join('\n')}`);
const g = Object.keys(plan.paprika.grocery).length;
console.log(`\nGrocery: ${g ? `${g} item(s) recorded as added` : 'nothing recorded yet'}. After adding, check with: compare-grocery <read_grocery_list output>`);
if (pendingPlanner.length || pendingNotes.length || stale.length) console.log('\nNext: write the items above (--json gives add_meals input), save each tool output to a file and run `record <file>` or `notes-done <uid>`, then `compare` against list_meal_history.');
else if (!errs.length) console.log('\n✓ Everything in the plan has been written. Run `compare` to confirm Paprika still matches.');
process.exit(errs.length ? 1 : 0);
