#!/usr/bin/env node
// coach/grocery-list.mjs: builds the week's grocery list from the plan in coach/meal-history.local.json.
// Every ingredient of every meal and snack is grouped by name, with the meals it's for and an added-up
// amount when all its amounts share a unit. /meal-plan copies this into Paprika (aisle, quantity, meals),
// then checks it against each recipe's full ingredient list. Writes nothing. Private output: don't commit it.
// Ingredients with `onHand: true` (already owned, or the same item bought for another meal) are listed
// separately and not added up. plan.prep holds shopping-day prep (beans, grains) so its extras are bought too.
// Packages: plan.buy [{ name, amount }] says how an item is bought ("1 dozen", "2 (32-oz) tubs"); plan.stock
// [{ name, amount }] is extra already at home ("enough" when Natalie confirms she has plenty), and the previous
// plan's carryOver counts as stock too. Every use of that item this week (on-hand uses included) is added up and
// compared: ✗ (exit 1) when the week needs more than there is, ! when a lot is left over.
//
//   node coach/grocery-list.mjs                     # latest plan
//   node coach/grocery-list.mjs --week 2026-11-29   # the plan starting that Sunday
//   node coach/grocery-list.mjs --json              # machine-readable

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const P = resolve(ROOT, 'coach/meal-history.local.json');
if (!existsSync(P)) { console.error('✗ No coach/meal-history.local.json. Run /meal-plan first.'); process.exit(1); }
const MH = JSON.parse(readFileSync(P, 'utf8'));
const args = process.argv.slice(2);
const wi = args.indexOf('--week');
const week = wi >= 0 ? args[wi + 1] : null;
const plans = Array.isArray(MH.plans) ? MH.plans : [];
const plan = week ? plans.find(p => p.weekOf === week) : plans[plans.length - 1];
if (!plan) { console.error(`✗ No plan${week ? ` for week ${week}` : ''}.`); process.exit(1); }

// Plans run Sunday dinner to the next Sunday's breakfast (`nextSun`); older ones Monday to Sunday. The day order follows weekOf's weekday.
const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const [y0, m0, d0] = plan.weekOf.split('-').map(Number);
const start = new Date(y0, m0 - 1, d0, 12).getDay();
const KEYS = [...DOW.map((_, i) => DOW[(start + i) % 7]), ...(start === 0 ? ['nextSun'] : [])];
const DAY = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun', nextSun: 'next Sun' };
const SLOT = { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', snack: 'snack', preRide: 'pre-ride' };

// Aisles in Natalie's Paprika. First match wins, so specific words come before general ones.
const AISLES = [
  ['Seafood', /\b(sole|salmon|trout|cod|halibut|fish|snapper|rockfish)\b/],
  ['Canned and Jar Goods', /\b(canned|can\b|tuna|broth|stock|tomatoes, no salt|tomato paste|capers|peanut butter)\b/],
  ['Meat', /\b(chicken|turkey|beef|lamb|sausage)\b/],
  ['Frozen Foods', /\bfrozen\b/],
  ['Deli', /\b(hummus|olives|castelvetrano)\b/],
  ['Produce', /\b(lettuce|banana)\b/],
  ['Dairy', /\b(yogurt|milk|cheese|feta|parmesan|cotija|ricotta|mozzarella|burrata|butter|half-and-half|cream|eggs?|tofu|tempeh)\b/],
  ['Pasta, Rice and Beans', /\b(rice|pasta|elbow|orzo|farro|quinoa|couscous|lentils|beans\b.*(rancho|dried|cooked)|rancho gordo|polenta|barley|bulgur)\b/],
  ['Bakery', /\b(pita|baguette|sourdough|shokupan)\b/],
  ['Breads and Cereals', /\b(bread|dave'?s|tortillas?|oats)\b/],
  ['Sauces and Condiments', /\b(soy sauce|mayo|mayonnaise|dijon|mustard|chile crisp|sambal|hot sauce|sriracha|fish sauce)\b/],
  ['International Cuisine', /\b(miso|nori|mirin)\b/],
  ['Oils and Dressings', /\b(oil|vinegar)\b/],
  ['Spices and Seasonings', /\b(salt|pepper\b(?! flakes)|oregano|turmeric|cumin|coriander|paprika|ground ginger|cinnamon|bay|za'?atar|garam masala|thyme dried)\b/],
  ['Baking Goods', /\b(flour|sugar|honey|hemp|chia|flax|baking|vanilla|cornstarch)\b/],
  ['Snacks', /\b(almonds?|walnuts?|pecans?|cashews?|pistachios?|chocolate|taralli|popcorn)\b/],
  ['Produce', /./]
];
const aisleOf = n => AISLES.find(([, re]) => re.test(n))[0];

// "1 1/2 cups", "3/4 lb", "2", "1 (14.5-oz) can" -> { qty, unit } or null
const UNIT = { tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  cup: 'cup', cups: 'cup', lb: 'lb', lbs: 'lb', oz: 'oz', g: 'g', clove: 'clove', cloves: 'clove', head: 'head', heads: 'head', bunch: 'bunch',
  slice: 'slice', slices: 'slice', leaf: 'leaf', leaves: 'leaf', can: 'can', cans: 'can', package: 'package', packages: 'package',
  sheet: 'sheet', sheets: 'sheet', piece: 'piece', pieces: 'piece', small: '', medium: '', large: '' };
function parse(a) {
  const s = String(a || '').trim().toLowerCase().replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim();
  const m = s.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+)\s*([a-z]+)?/);
  if (!m) return null;
  const qty = m[1].split(' ').reduce((t, p) => t + (p.includes('/') ? p.split('/').reduce((x, y) => x / y) : Number(p)), 0);
  const unit = m[2] ? (UNIT[m[2]] || null) : '';
  if (unit === null) return null;
  return { qty, unit };
}
const fmt = q => { const w = Math.floor(q), f = q - w; const fr = [[0, ''], [1 / 8, '1/8'], [1 / 4, '1/4'], [1 / 3, '1/3'], [3 / 8, '3/8'], [1 / 2, '1/2'], [5 / 8, '5/8'], [2 / 3, '2/3'], [3 / 4, '3/4'], [7 / 8, '7/8'], [1, '']].reduce((b, c) => Math.abs(c[0] - f) < Math.abs(b[0] - f) ? c : b); const ww = fr[0] === 1 ? w + 1 : w; return [ww || '', fr[1]].filter(Boolean).join(' ') || '0'; };

// Same food, different wording: merge them under one line.
const ALIASES = [
  [/^(vegetable|sunflower or vegetable|sunflower|grapeseed|canola) oil$/, 'neutral oil'],
  [/^frozen banana$/, 'banana'], [/^small apple$/, 'apple'], [/^scallion greens$/, 'scallions'],
  [/^low-sodium vegetable stock$/, 'low-sodium vegetable broth'], [/^pomegranate arils$/, 'pomegranate arils']
];
const singular = w => w.replace(/(tomato|potato)es$/, '$1').replace(/ies$/, 'y').replace(/([^s])s$/, '$1');
function keyOf(name) {
  let k = String(name).toLowerCase().replace(/\(.*?\)/g, '').split(',')[0].replace(/\s+/g, ' ').trim();
  for (const [re, to] of ALIASES) if (re.test(k)) { k = to; break; }
  const w = k.split(' '); w[w.length - 1] = singular(w[w.length - 1]);
  return w.join(' ');
}

const items = new Map();
const onHand = [];
const missingAmount = [];
// Sunday prep (beans, grains) lives in plan.prep: [{ recipe, ingredients }] so its extras get bought too.
const sources = [...(plan.prep || []).map(m => ({ k: 'prep', m: { slot: 'prep', ...m } }))];
for (const k of KEYS) {
  const d = (plan.days || []).find(x => x.day === k);
  if (!d || d.mealsOut || d.unplanned) continue;
  for (const m of d.meals || []) sources.push({ k, m });
}
DAY.prep = 'Sun'; SLOT.prep = 'prep';
for (const { k, m } of sources) {
  {
    if (['office', 'out'].includes(m.slot) || m.leftoverOf) continue;   // leftovers were bought with their dinner
    for (const i of m.ingredients || []) {
      if (!i || !i.name) continue;
      if (i.onHand) { onHand.push(`${i.name}${i.amount ? ` (${i.amount})` : ''} · ${DAY[k]} ${SLOT[m.slot] || m.slot}${m.recipe ? ` (${m.recipe})` : ''}`); continue; }
      const key = keyOf(i.name);
      const where = `${DAY[k]} ${SLOT[m.slot] || m.slot}${m.recipe ? ` (${m.recipe})` : ''}`;
      if (!items.has(key)) items.set(key, { name: i.name.replace(/\s*\(.*?\)\s*/g, ' ').trim(), uses: [], forB: true });
      const it = items.get(key);
      it.uses.push({ where, amount: i.amount || '' });
      if (!i.sideForB) it.forB = false;
      if (!String(i.amount || '').trim()) missingAmount.push(`${i.name} · ${where}`);
    }
  }
}

// ---- Packages: does what's bought (plus what's at home) cover every use? ----
const allUses = new Map();   // key -> [{ amount, where }] including onHand uses
for (const { k, m } of sources) {
  if (['office', 'out'].includes(m.slot) || m.leftoverOf) continue;
  for (const i of m.ingredients || []) {
    if (!i || !i.name) continue;
    const key = keyOf(i.name);
    if (!allUses.has(key)) allUses.set(key, []);
    allUses.get(key).push({ amount: i.amount || '', where: `${DAY[k]} ${SLOT[m.slot] || m.slot}` });
  }
}
// Units: count, volume (tsp) or weight (g). Volume and weight convert only with a known density (g per cup).
const VOL = { tsp: 1, tbsp: 3, cup: 48 }, WT = { g: 1, oz: 28.35, lb: 453.6 };
const DENSITY = { 'straus nonfat greek yogurt': 227, 'greek yogurt': 227, yogurt: 227, 'haiga rice': 184, rice: 185 };
const COUNT_WORDS = { dozen: 12, ct: 1, count: 1 };
function measure(a) {
  // "2 (32-oz) tubs" / "1 (14.5-oz) can": outer count × inner size
  const raw = String(a || '').toLowerCase().trim();
  if (/^enough\b/.test(raw)) return { inf: true };
  const pk = raw.match(/^(\d+(?:\.\d+)?|\d+\/\d+)\s*\((\d+(?:\.\d+)?)[- ]?(oz|lb|g|ct|count)\b/);
  if (pk) { const n = pk[1].includes('/') ? pk[1].split('/').reduce((x, y) => x / y) : Number(pk[1]); const u = pk[3]; return u in WT ? { w: n * Number(pk[2]) * WT[u] } : { c: n * Number(pk[2]) }; }
  const dz = raw.match(/^(\d+(?:\.\d+)?)?\s*(dozen)\b/); if (dz) return { c: (Number(dz[1]) || 1) * 12 };
  const p = parse(a); if (!p) return null;
  if (p.unit === '') return { c: p.qty };
  if (p.unit in VOL) return { v: p.qty * VOL[p.unit] };
  if (p.unit in WT) return { w: p.qty * WT[p.unit] };
  return null;
}
function toBase(m, key, want) {   // want: 'c' | 'v' | 'w'
  if (!m) return null; if (m.inf) return Infinity;
  if (want in m) return m[want];
  const g = Object.entries(DENSITY).find(([n]) => key.includes(n)); if (!g) return null;
  if (want === 'w' && 'v' in m) return m.v / 48 * g[1];
  if (want === 'v' && 'w' in m) return m.w / g[1] * 48;
  return null;
}
const showQty = (x, want) => want === 'c' ? fmt(x) : want === 'w' ? `${Math.round(x)} g` : x >= 48 ? `${fmt(x / 48)} cup` : x >= 3 ? `${fmt(x / 3)} tbsp` : `${fmt(x)} tsp`;
const prev = plans[plans.indexOf(plan) - 1];
const stockOf = key => [...(plan.stock || []), ...((prev && prev.carryOver) || [])].filter(x => x && x.name && keyOf(x.name) === key);
const packages = [];
for (const b of plan.buy || []) {
  const key = keyOf(b.name), bought = measure(b.amount);
  if (!bought) { packages.push({ bad: true, line: `${b.name}: can't read the bought amount "${b.amount}" (use e.g. "1 dozen" or "2 (32-oz) tubs")` }); continue; }
  const want = 'c' in bought ? 'c' : 'w' in bought ? 'w' : 'v';
  const uses = allUses.get(key) || [];
  let need = 0, unknown = [];
  for (const u of uses) { const q = toBase(measure(u.amount), key, want); if (q == null) unknown.push(`${u.where}: ${u.amount || '?'}`); else need += q; }
  let have = toBase(bought, key, want);
  for (const s of stockOf(key)) { const q = toBase(measure(s.amount), key, want); if (q != null) have += q; }
  const line = `${b.name}: uses ${showQty(need, want)} of ${have === Infinity ? 'plenty (at home)' : showQty(have, want)} (bought ${b.amount}${stockOf(key).length ? ' + at home' : ''})`;
  if (unknown.length) packages.push({ warn: true, line: `${line}; couldn't count ${unknown.join(', ')}` });
  if (need > have + 1e-9) packages.push({ bad: true, line: `${line} → short ${showQty(need - have, want)}: buy more or change a meal` });
  else if (have !== Infinity && have - need > Math.max(have * 0.15, want === 'c' ? 1 : 0)) packages.push({ warn: true, line: `${line} → ${showQty(have - need, want)} left over: use it or add it to carryOver` });
  else if (!unknown.length) packages.push({ ok: true, line });
}

const out = [...items.values()].map(it => {
  const parsed = it.uses.map(u => parse(u.amount));
  const units = new Set(parsed.map(p => p && p.unit));
  const total = parsed.every(Boolean) && units.size === 1 ? `${fmt(parsed.reduce((t, p) => t + p.qty, 0))}${[...units][0] ? ' ' + [...units][0] : ''}` : null;
  return { name: it.name, aisle: aisleOf(it.name.toLowerCase()), total, forB: it.forB, uses: it.uses };
}).sort((a, b) => a.aisle.localeCompare(b.aisle) || a.name.localeCompare(b.name));

if (args.includes('--json')) { console.log(JSON.stringify({ weekOf: plan.weekOf, items: out, onHand, missingAmount, packages }, null, 2)); process.exit(0); }

console.log(`Grocery list · week of ${plan.weekOf} (${plan.status || 'draft'}) · ${out.length} items from the plan`);
let aisle = null;
for (const it of out) {
  if (it.aisle !== aisle) { aisle = it.aisle; console.log(`\n${aisle}`); }
  const parts = [...new Set(it.uses.map(u => u.amount || '?'))];
  const qty = it.total || (parts.length === 1 && !parse(parts[0]) ? parts[0] : 'add up: ' + it.uses.map(u => u.amount || '?').filter((x, i, arr) => parse(x) || arr.indexOf(x) === i).join(' + '));
  console.log(`  ${it.name} · ${qty}${it.forB ? ' · for B' : ''}`);
  console.log(`      ${it.uses.map(u => `${u.where}${u.amount ? `: ${u.amount}` : ''}`).join(' · ')}`);
}
if (onHand.length) { console.log(`\nAlready have or counted with another meal (add "You have these" lines for pantry items she owns):`); for (const x of onHand) console.log('  · ' + x); }
if (missingAmount.length) { console.log(`\n! ${missingAmount.length} ingredient(s) without an amount:`); for (const x of missingAmount) console.log('  ! ' + x); }
const short = packages.filter(p => p.bad).length;
if (packages.length) {
  console.log('\nPackages (bought + at home vs every use this week):');
  for (const p of packages) console.log(`  ${p.bad ? '✗' : p.warn ? '!' : '✓'} ${p.line}`);
} else console.log('\nPackages: none set. Add plan.buy for anything bought by the package (eggs, yogurt tubs, bread, tortillas) so shortfalls get caught.');
console.log('\nNext: check every recipe\'s full ingredient list in Paprika or its source (garnishes, bean/grain cooking extras, B\'s sides), then add each item to My Grocery List with its aisle, quantity and these meals.');
if (short) { console.log(`✗ ${short} package problem(s): fix before shopping.`); process.exit(1); }
