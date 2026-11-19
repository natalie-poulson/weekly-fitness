#!/usr/bin/env node
// coach/check-meals.mjs: checks a week's meal plan for Natalie before Claude shows it.
// The plan is for Natalie; B shares dinner and isn't checked (/meal-plan still sizes his portion).
// Reads coach/meal-history.local.json (the plan), coach/targets.local.json (from update-block.mjs),
// coach/meal-prefs.local.json (the food rules) and coach/training.json (tolerance). Writes nothing.
// ✗ = a rule is broken, so it exits 1 and Claude fixes the plan first. ! = worth a look; doesn't fail.
//
//   node coach/check-meals.mjs                     # latest plan
//   node coach/check-meals.mjs --week 2026-11-23   # the plan starting that Monday
//   node coach/check-meals.mjs --strict            # warnings fail too
//
// What /meal-plan writes for each meal (full format in coach/README.md):
//   slot         breakfast | lunch | dinner | snack | preRide | office | out
//   recipe, cuisine, method, totalMin, rating (Paprika stars), isNew, favorite
//   protein      main protein tags: salmon, trout, sole, tuna, albacore, chicken breast, chicken thighs,
//                turkey, ground chicken, ground turkey, chicken sausage, pork sausage, beef, lamb,
//                tofu, tempeh, beans, lentils, chickpeas, eggs
//   tags         carbForward, sweet, smoothie, sheetPan, prepAhead, frozenFish, burrata, fruit, needsFridge, goodEggs
//   grains       [{ name, servings }] in Natalie's servings ("whole": true | false | 0.5 overrides the guess)
//   ingredients  [{ name, amount, sideForB }]
//   leftoverOf   (lunch) the day of the dinner it comes from;  extraPortion (dinner) true if it makes one
//   per.natalie  kcal, proteinG, fiberG, satFatG, sodiumMg, addedSugarG, vegServings, fruitServings,
//                cheesePortions, butterTbsp, creamTbsp, wholeMilkYogurtG   (per.b is optional, not checked)
// Day flags: office, nightOut, holiday (its name), swim, mealsOut (away all day).
// Monthly limits in meal-prefs (red meat, beef, lamb, pork sausage, chicken thighs) count over any rolling 30 days.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function fail(msg) { console.error('✗ ' + msg); process.exit(1); }
function readJson(p) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { fail(`Couldn't read ${p}: ${e.message}`); } }
function need(rel, hint) { const p = resolve(ROOT, rel); if (!existsSync(p)) fail(`No ${rel}. ${hint}`); return readJson(p); }

const TG = need('coach/targets.local.json', 'Run node coach/update-block.mjs first.');
const MP = need('coach/meal-prefs.local.json', 'See coach/README.md or SETUP-GUIDE.md.');
const MH = need('coach/meal-history.local.json', 'Run /meal-plan first.');
const T = need('coach/training.json', 'It should be in the repo.');
const TOL = ((T.nutrition && T.nutrition.checkTolerancePct) || 10) / 100;

// Rules meal-prefs gives in words, as numbers. Change them here.
const ADDED_SUGAR_MAX_G = 15;          // planned food, outside the weekend treat. AHA's limit for women is 25 g;
                                       // the gap covers office meals, restaurants and condiments the plan can't see.
const OFFICE_PROTEIN_MAX_G = 40;       // office oats (~8-10 g) + a palm of protein at lunch (~25-30 g)
const NIGHT_OUT_KCAL = [900, 1000];
const PILATES_SNACK_KCAL = [100, 200]; // the 11:30 snack on Wed/Fri
const DINNER_VEG_MIN = 2;              // "about half the plate" = 2+ vegetable servings
const WINDOW_DAYS = 30;                // monthly limits = any rolling 30 days

const ME = 'natalie';
const t = TG.people && TG.people[ME];
if (!t || t.kcal == null) fail('No kcal target for Natalie yet. Fill in coach/profile.json and run node coach/update-block.mjs.');

const args = process.argv.slice(2);
const wi = args.indexOf('--week');
const weekArg = wi >= 0 ? args[wi + 1] : null;
if (wi >= 0 && !/^\d{4}-\d{2}-\d{2}$/.test(weekArg || '')) fail('--week needs a Monday, like 2026-11-23.');
const strict = args.includes('--strict');

const plans = Array.isArray(MH.plans) ? MH.plans : [];
if (!plans.length) { console.log('No meal plans yet.'); process.exit(0); }
const plan = weekArg ? plans.find(p => p.weekOf === weekArg) : plans[plans.length - 1];
if (!plan) fail(`No plan for week ${weekArg}.`);

// ---- Dates ----
const KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const isWeekend = k => k === 'sat' || k === 'sun';
const pad = n => String(n).padStart(2, '0');
function dateOf(weekOf, day) { const [y, m, d] = weekOf.split('-').map(Number); return new Date(y, m - 1, d + KEYS.indexOf(day), 12); }
const iso = dt => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
const dayNum = dt => Math.round(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()) / 86400000);
const md = dt => `${dt.getMonth() + 1}/${dt.getDate()}`;
const validWeek = w => /^\d{4}-\d{2}-\d{2}$/.test(w || '') && dateOf(w, 'mon').getDay() === 1;
if (!validWeek(plan.weekOf)) fail(`The plan's weekOf (${plan.weekOf}) must be the Monday it starts, like 2026-11-23.`);

// ---- Helpers ----
const low = s => String(s ?? '').toLowerCase().trim();
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const n0 = v => (isNum(v) ? v : 0);
const fmt = v => Math.round(v).toLocaleString('en-US');
const mark = ok => (ok ? '✓' : '✗');
const list = v => (Array.isArray(v) ? v : []);
const tagsOf = m => list(m.tags).map(low);
const protOf = m => list(m.protein).map(low);
const ingsOf = m => list(m.ingredients).filter(i => i && i.name);
const hasTag = (m, tag) => tagsOf(m).includes(tag.toLowerCase());
const nameKey = m => low(m.recipe).replace(/[^a-z0-9]+/g, ' ').trim();
const foodText = m => [m.recipe, ...ingsOf(m).map(i => i.name), ...list(m.grains).map(g => g.name)].map(low).join(' | ');
const mine = m => (m.per && m.per[ME]) || null;

const errs = [], warns = [];
const bad = (w, msg) => errs.push(`${w}: ${msg}`);
const warn = (w, msg) => warns.push(`${w}: ${msg}`);

// ---- Vocabulary ----
const FISH = ['salmon', 'trout', 'sole', 'tuna', 'albacore', 'cod', 'halibut', 'arctic char', 'sardines', 'mackerel', 'rockfish', 'snapper', 'fish'];
const MEAT = ['chicken', 'chicken breast', 'chicken thighs', 'ground chicken', 'turkey', 'ground turkey', 'chicken sausage', 'pork sausage', 'beef', 'lamb'];
const OTHER = ['tofu', 'tempeh', 'beans', 'lentils', 'chickpeas', 'edamame', 'eggs', 'yogurt', 'cheese', 'dairy', 'nuts'];
const KNOWN = new Set([...FISH, ...MEAT, ...OTHER]);
const isFishMeal = m => protOf(m).some(p => FISH.includes(p));
const isVegetarian = m => protOf(m).length > 0 && !protOf(m).some(p => FISH.includes(p) || MEAT.includes(p));

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const words = (arr, extra) => new RegExp('\\b(' + [...list(arr), ...extra].map(w => esc(low(w)).replace(/s$/, 's?')).join('|') + ')\\b');
const R = MP.rules || {}, TR = MP.training || {}, ML = MP.meals || {}, HH = MP.household || {}, DIET = MP.diet || {};
const SHELLFISH = words(R.noShellfish, ['prawns', 'shellfish']);
const CURED = words(R.noCuredOrProcessedMeats, ['deli', 'pancetta', 'guanciale', 'pepperoni', 'chorizo', 'hot dogs', 'ham']);
const HOT = /(red pepper flakes|chil[ei] flakes|crushed red pepper|cayenne|sriracha|gochujang|gochugaru|sambal|harissa|chil[ei] crisp|chil[ei] oil|hot sauce|serrano|habanero|scotch bonnet|thai chil[ei]|bird'?s[- ]eye|in adobo|chil[ei] de [aá]rbol|curry paste)/;
const JALAPENO = /jalape[nñ]o/;
const OLIVE = /\bolives?\b(?! oil)/;
const SOY = /soy sauce|tamari|shoyu/;
const LOW_NA = /low[- ]sodium|reduced[- ]sodium|less[- ]sodium/;
const NUTS = /\b(almonds?|cashews?|walnuts?|pistachios?|pine nuts|pecans?|hazelnuts?|peanuts?|peanut butter|almond butter|cashew butter|nut butter|tahini|pumpkin seeds|pepitas|sunflower seeds|hemp seeds|chia( seeds)?|flax( ?seeds?)?|sesame seeds)\b/;
const POWDER = /protein powder|whey|collagen/;
const OATS = /\boats?\b|oatmeal|steel[- ]cut/;
const STARCH = /rice|pasta|potato|polenta|bread|tortilla|couscous|noodle|farro|bulgur|barley|quinoa|pita|orzo|gnocchi/;
const CARB_FORWARD = /rice|pasta|potato|polenta|orzo|gnocchi/;
const PANTRY = /^(salt|kosher salt|flaky salt|sea salt|black pepper|pepper|olive oil|extra[- ]virgin olive oil|neutral oil|vegetable oil|canola oil|avocado oil|sesame oil|garlic|onions?|yellow onions?|red onions?|shallots?|lemons?|limes?|water|stock|broth|.* stock|.* broth|flour|sugar|brown sugar|honey|maple syrup|butter|.*soy sauce|.*vinegar|dijon mustard|mustard|.*cumin|.*paprika|garam masala|cinnamon|dried oregano|bay leaf|bay leaves|baking powder|baking soda|cornstarch)$/;

function wholeShare(g) {
  if (isNum(g.whole)) return g.whole;
  if (g.whole === true) return 1;
  if (g.whole === false) return 0;
  const n = low(g.name);
  if (/haiga/.test(n)) return 0.5;                     // partly milled: half a whole-grain serving
  if (/whole[- ]wheat|whole[- ]grain|farro|bulgur|barley|quinoa|oat|brown rice|wild rice|freekeh|buckwheat|millet|dave|corn tortilla|popcorn/.test(n)) return 1;
  return 0;
}

// ---- Week context ----
const deload = TG.status === 'DELOAD';
if (!Array.isArray(TG.trainingDays)) warn('targets', 'no trainingDays in targets.local.json, so ride-day checks are skipped; run node coach/update-block.mjs');
const TD = Object.fromEntries(list(TG.trainingDays).map(d => [d.day, d]));
const rides = k => !!(TD[k] && TD[k].minutes != null);
const EVENING = list(TR.preRideSnack && TR.preRideSnack.days);
const PILATES = list(TR.pilatesDays && TR.pilatesDays.days);
const CARB_NIGHTS = deload ? [] : list(TR.hardDays && TR.hardDays.carbForwardDinnerBefore);
const OFFICE_DEFAULT = list(HH.officeDaysDefault);
const PER_MEAL = list(TR.proteinPerMealG)[0] ?? 25;
const PER_SNACK = list(TR.proteinPerSnackG)[0] ?? 10;
const RIDE_SNACK_KCAL = list(TR.preRideSnack && TR.preRideSnack.kcal).length ? TR.preRideSnack.kcal : [150, 200];
const DINNER_MAX = (ML.dinner && ML.dinner.maxMin) ?? 30;
const LONG = (ML.dinner && ML.dinner.longNight) || { perWeek: 1, days: ['sat', 'sun'], maxMin: 45 };
const BFAST_MAX = (ML.weekdayBreakfast && ML.weekdayBreakfast.maxMin) ?? 5;
const LUNCH_MAX = (ML.weekdayLunch && ML.weekdayLunch.maxMin) ?? 10;
const CHEESE_MAX = (R.cheese && R.cheese.portionsPerPersonPerDayMax) ?? 1;
const YOGURT_MAX = (R.yogurt && R.yogurt.wholeMilkMaxGPerDay) ?? 170;
const BC = R.butterAndCream || {};
const BUTTER_MAX = BC.butterTbspPerPersonMax ?? 1, CREAM_MAX = BC.creamTbspPerPersonMax ?? 2, BC_DINNERS = BC.dinnersPerWeekMax ?? 2;
const VEG = R.vegetables || {};
const VEG_MIN = VEG.vegServingsPerDayMin ?? 3, VF_MIN = VEG.vegAndFruitServingsPerDayMin ?? 5;

// ---- Rules for every meal ----
function checkFood(m, where) {
  const label = `${where} ${m.slot}${m.recipe ? ` (${m.recipe})` : ''}`;
  const all = foodText(m);
  if (SHELLFISH.test(all)) bad(label, 'shellfish (no clams, mussels or shrimp)');
  if (CURED.test(all)) bad(label, 'cured or processed meat');
  if (POWDER.test(all)) bad(label, 'protein powder (protein comes from food)');
  for (const i of ingsOf(m)) {
    const n = low(i.name);
    if (!i.sideForB && (HOT.test(n) || (JALAPENO.test(n) && !/seeded/.test(n)))) bad(label, `"${i.name}" is hot; leave it out or serve it on the side for B (sideForB)`);
    if (/\bpork\b/.test(n) && !/sausage/.test(n)) bad(label, `"${i.name}": no pork other than pork sausage`);
    if (OLIVE.test(n) && !/castelvetrano/.test(n)) bad(label, `"${i.name}": Castelvetrano olives only`);
    if (SOY.test(n) && !LOW_NA.test(n)) warn(label, `"${i.name}": use low-sodium`);
    if (NUTS.test(n) && !low(i.amount)) bad(label, `"${i.name}" needs a measured amount (1 oz nuts or seeds, 1 tbsp nut butter or tahini)`);
    if (/sausage/.test(n) && !/nitrate[- ]free|uncured/.test(n)) warn(label, `"${i.name}": buy nitrate-free`);
  }
  if (protOf(m).includes('pork')) bad(label, 'no pork other than pork sausage');
  for (const p of protOf(m)) if (!KNOWN.has(p)) warn(label, `protein "${p}" isn't a known tag, so the protein limits can't count it`);
  if (/sausage/.test(all) && !protOf(m).some(p => /sausage/.test(p))) warn(label, 'has sausage: tag it "chicken sausage" or "pork sausage" so the limits count it');
  if (m.slot === 'dinner' && !protOf(m).length) warn(label, 'no protein tag');
  if (isNum(m.rating) && m.rating <= 2) bad(label, `rated ${m.rating}★ in Paprika; 1-2★ recipes are never repeated`);
}

// ---- Day by day ----
console.log(`Meal plan · week of ${plan.weekOf} (${plan.status || 'draft'}) · ${TG.status || 'HOLD'} week · tolerance ±${Math.round(TOL * 100)}%`);
const byDay = Object.fromEntries(list(plan.days).map(d => [d.day, d]));
for (const d of list(plan.days)) if (!KEYS.includes(d.day)) bad(`day "${d.day}"`, 'use mon, tue, wed, thu, fri, sat or sun');
const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack', 'preRide', 'office', 'out'];
const rows = [];
let longNights = 0;

for (const k of KEYS) {
  const d = byDay[k], dt = dateOf(plan.weekOf, k), where = `${k} ${md(dt)}`;
  if (!d) { bad(where, 'missing from the plan'); continue; }
  if (d.mealsOut) { console.log(`  ${where}: away all day, not planned`); continue; }
  const meals = list(d.meals);
  for (const m of meals) {
    if (!SLOTS.includes(m.slot)) bad(where, `unknown slot "${m.slot}" (use ${SLOTS.join(', ')})`);
    rows.push({ k, dt, m });
    checkFood(m, where);
  }
  const slot = s => meals.filter(m => m.slot === s);

  let office = d.office;
  if (typeof office !== 'boolean') {
    office = !isWeekend(k) && OFFICE_DEFAULT.includes(k);
    if (!isWeekend(k)) warn(where, `office day not set, so ${office ? 'office' : 'home'} was assumed (ask at /meal-plan)`);
  }
  const away = !!(d.nightOut || d.holiday);
  const evening = EVENING.includes(k) && rides(k);
  const pilates = PILATES.includes(k) && rides(k) && TD[k].pilates !== false;
  const tags = [office && 'office', d.nightOut && 'night out', d.holiday && (d.holiday === true ? 'holiday' : String(d.holiday)), d.swim && 'swim', rides(k) && 'ride'].filter(Boolean);

  // Dinner, office and night out
  const dinners = slot('dinner');
  if (away && dinners.length) bad(where, `${d.holiday ? 'holiday' : 'night out'}: don't plan dinner`);
  if (!away && dinners.length !== 1) bad(where, dinners.length ? `${dinners.length} dinners planned` : 'no dinner planned');
  if (office) {
    if (slot('breakfast').length || slot('lunch').length) bad(where, 'office day: the office provides breakfast and lunch, so plan only dinner and snacks');
    const o = slot('office')[0];
    if (!o) bad(where, 'office day: add an "office" entry with the kcal and protein left for office meals');
    else if (mine(o) && n0(mine(o).proteinG) > OFFICE_PROTEIN_MAX_G) warn(where, `office meals would need ${fmt(mine(o).proteinG)} g protein (they cover about ${OFFICE_PROTEIN_MAX_G}); add a protein snack like Straus yogurt or a bigger dinner portion`);
  } else if (slot('office').length) warn(where, 'has an "office" entry but isn\'t an office day');
  if (d.nightOut) {
    const o = slot('out')[0], kc = o && mine(o) ? mine(o).kcal : null;
    if (!isNum(kc)) warn(where, `night out: add an "out" entry of ${NIGHT_OUT_KCAL.join('-')} kcal for the restaurant meal`);
    else if (kc < NIGHT_OUT_KCAL[0] || kc > NIGHT_OUT_KCAL[1]) warn(where, `night-out allowance is ${fmt(kc)} kcal; plan ${NIGHT_OUT_KCAL.join('-')}`);
  }

  // Snacks before rides
  const pre = slot('preRide');
  if (evening || pilates) {
    const [lo, hi] = evening ? RIDE_SNACK_KCAL : PILATES_SNACK_KCAL;
    if (!pre.length) bad(where, evening ? 'evening ride: add the pre-ride snack (packed from home, about 3:30-4:00)' : 'Pilates day: add the 11:30 snack');
    for (const p of pre) {
      const kc = mine(p) ? mine(p).kcal : null;
      if (isNum(kc) && (kc < lo || kc > hi)) bad(where, `pre-ride snack is ${fmt(kc)} kcal; keep it ${lo}-${hi}`);
      if (evening && hasTag(p, 'needsFridge')) bad(where, 'pre-ride snack needs a fridge; pack one that travels');
      if (evening && !ingsOf(p).every(i => low(i.amount))) bad(where, 'pre-ride snack: give every item its exact portion');
    }
  } else if (pre.length) warn(where, 'pre-ride snack on a day without a ride');

  // Weekday breakfast and lunch, eggs, sweets
  if (!isWeekend(k)) {
    for (const b of slot('breakfast')) {
      if (isNum(b.totalMin) && b.totalMin > BFAST_MAX) bad(where, `breakfast takes ${b.totalMin} min; weekday breakfasts are ${BFAST_MAX} min or less`);
      if (OATS.test(foodText(b))) bad(where, 'breakfast: something other than oats (she has steel-cut oats at the office)');
    }
    for (const l of slot('lunch')) if (isNum(l.totalMin) && l.totalMin > LUNCH_MAX) bad(where, `lunch takes ${l.totalMin} min; weekday lunches are ${LUNCH_MAX} min or less`);
    for (const m of meals) if (protOf(m).includes('eggs')) bad(where, `${m.slot}: eggs as a meal only on weekends`);
    for (const m of meals) if (hasTag(m, 'sweet')) bad(where, `${m.slot}: sweet treats only on Sat or Sun`);
  }

  // Dinner rules
  for (const m of dinners) {
    const text = foodText(m), v = mine(m);
    if (!isNum(m.totalMin)) warn(where, 'dinner has no totalMin');
    else if (m.totalMin > DINNER_MAX) {
      if (list(LONG.days).includes(k) && m.totalMin <= LONG.maxMin) longNights++;
      else bad(where, `dinner takes ${m.totalMin} min; ${DINNER_MAX} max, plus one ${LONG.maxMin}-min dinner on Sat or Sun`);
    }
    if (!m.cuisine) warn(where, 'dinner has no cuisine');
    if (!m.method) warn(where, 'dinner has no cooking method');
    if (evening) {
      if (v && n0(v.proteinG) < 30) bad(where, `ride-day dinner has ${fmt(n0(v.proteinG))} g protein; the recovery meal needs 30+`);
      if (!STARCH.test(text)) bad(where, 'ride-day dinner needs a starch');
    }
    if (CARB_NIGHTS.includes(k) && !(hasTag(m, 'carbForward') || CARB_FORWARD.test(text))) bad(where, `carb-forward dinner (rice, pasta, potatoes or polenta) the night before ${k === 'sun' ? 'Monday HIIT' : 'Thursday tempo'}`);
    if (d.swim && !(hasTag(m, 'sheetPan') || hasTag(m, 'prepAhead') || /sheet/.test(low(m.method)))) warn(where, 'swim night: dinner at about 7:45 should be sheet-pan or prepped ahead');
    if (isFishMeal(m) && ['thu', 'fri', 'sat', 'sun'].includes(k) && !hasTag(m, 'frozenFish')) warn(where, 'fresh fish is planned early in the week; move it or tag frozenFish');
    if (v && n0(v.vegServings) < DINNER_VEG_MIN) bad(where, `dinner has ${n0(v.vegServings)} vegetable servings; make it about half the plate (${DINNER_VEG_MIN}+)`);
    if (hasTag(m, 'goodEggs') && v && n0(v.sodiumMg) >= 900) warn(where, `Good Eggs dinner has ${fmt(v.sodiumMg)} mg sodium; target 800 mg or less (900+ flagged)`);
  }

  // Natalie's day
  if (!meals.length) { console.log(`  ${where}${tags.length ? ` [${tags.join(', ')}]` : ''}: nothing planned`); continue; }
  const gaps = meals.filter(m => !(mine(m) && isNum(mine(m).kcal) && isNum(mine(m).proteinG)));
  if (gaps.length) bad(where, `kcal or protein missing on ${gaps.map(m => m.slot).join(', ')}`);
  const S = { kcal: 0, protein: 0, fiber: 0, satFat: 0, sodium: 0, sugar: 0, veg: 0, fruit: 0, cheese: 0, yogurt: 0 };
  let unlisted = 0;
  for (const m of meals) {
    const v = mine(m) || {};
    S.kcal += n0(v.kcal); S.protein += n0(v.proteinG);
    S.fiber += n0(v.fiberG); S.satFat += n0(v.satFatG); S.sodium += n0(v.sodiumMg);
    if (!hasTag(m, 'sweet')) S.sugar += n0(v.addedSugarG);
    S.veg += n0(v.vegServings); S.fruit += n0(v.fruitServings);
    S.cheese += n0(v.cheesePortions); S.yogurt += n0(v.wholeMilkYogurtG);
    if (!['office', 'out'].includes(m.slot) && !(isNum(v.fiberG) && isNum(v.satFatG) && isNum(v.sodiumMg))) unlisted++;
    if (n0(v.butterTbsp) > BUTTER_MAX) bad(where, `${m.slot}: ${v.butterTbsp} tbsp butter; max ${BUTTER_MAX}`);
    if (n0(v.creamTbsp) > CREAM_MAX) bad(where, `${m.slot}: ${v.creamTbsp} tbsp cream; max ${CREAM_MAX}`);
    if (isNum(v.proteinG)) {
      const min = m.slot === 'breakfast' && hasTag(m, 'smoothie') ? 20 : PER_MEAL;
      if (['breakfast', 'lunch', 'dinner'].includes(m.slot) && v.proteinG < min) warn(where, `${m.slot} has ${fmt(v.proteinG)} g protein; aim for ${min}+`);
      if (m.slot === 'snack' && !hasTag(m, 'fruit') && v.proteinG < PER_SNACK) warn(where, `snack${m.recipe ? ` (${m.recipe})` : ''} has ${fmt(v.proteinG)} g protein; aim for ${PER_SNACK}-15`);
    }
  }
  if (unlisted) warn(where, `fiber, sat fat or sodium missing on ${unlisted} meal(s), so those checks are incomplete`);
  if (S.cheese > CHEESE_MAX) bad(where, `${S.cheese} cheese portions; max ${CHEESE_MAX} a day (Parmesan garnish doesn't count)`);
  if (S.yogurt > YOGURT_MAX) bad(where, `${fmt(S.yogurt)} g whole milk yogurt; max ${YOGURT_MAX} g a day`);

  const partial = office || !!d.nightOut;   // office and restaurant meals aren't itemised
  let line = '';
  if (d.holiday) line = `${fmt(S.kcal)} kcal planned (holiday, not totalled)`;
  else {
    const kOk = Math.abs(S.kcal - t.kcal) <= t.kcal * TOL;
    const pOk = t.proteinG == null || S.protein >= t.proteinG * (1 - TOL);
    if (!kOk) bad(where, `${fmt(S.kcal)} kcal; target ${fmt(t.kcal)} ±${Math.round(TOL * 100)}%`);
    if (!pOk) bad(where, `${fmt(S.protein)} g protein; target ${t.proteinG} g`);
    line = `${fmt(S.kcal)}/${fmt(t.kcal)} kcal ${mark(kOk)}, ${fmt(S.protein)}/${t.proteinG ?? '—'} g protein ${mark(pOk)}`;
  }
  if (!partial && !d.holiday) {
    if (t.fiberG) { const ok = S.fiber >= t.fiberG; if (!ok) bad(where, `fiber ${fmt(S.fiber)} g; at least ${t.fiberG} g`); line += `, fiber ${fmt(S.fiber)}/${t.fiberG} ${mark(ok)}`; }
    if (S.veg < VEG_MIN) bad(where, `${S.veg} vegetable servings; at least ${VEG_MIN}`);
    if (S.veg + S.fruit < VF_MIN) bad(where, `${S.veg + S.fruit} vegetable and fruit servings; at least ${VF_MIN}`);
  }
  if (t.satFatMaxG) { const ok = S.satFat <= t.satFatMaxG; if (!ok) bad(where, `saturated fat ${fmt(S.satFat)} g; max ${t.satFatMaxG} g`); line += `, sat fat ${fmt(S.satFat)}/${t.satFatMaxG} ${mark(ok)}`; }
  if (t.sodiumMaxMg) { const ok = S.sodium <= t.sodiumMaxMg; if (!ok) bad(where, `sodium ${fmt(S.sodium)} mg; max ${fmt(t.sodiumMaxMg)} mg`); line += `, sodium ${fmt(S.sodium)}/${fmt(t.sodiumMaxMg)} ${mark(ok)}`; }
  { const ok = S.sugar <= ADDED_SUGAR_MAX_G; if (!ok) bad(where, `${fmt(S.sugar)} g added sugar outside treats; keep it to ${ADDED_SUGAR_MAX_G} g`); line += `, added sugar ${fmt(S.sugar)}/${ADDED_SUGAR_MAX_G} ${mark(ok)}`; }
  if (partial) line += ' (office/restaurant food not itemised)';
  console.log(`  ${where}${tags.length ? ` [${tags.join(', ')}]` : ''}: ${line}`);
}

// ---- The week ----
const planned = rows.filter(r => !['office', 'out'].includes(r.m.slot));
const dinnersW = planned.filter(r => r.m.slot === 'dinner');
const fresh = planned.filter(r => !r.m.leftoverOf);

const fishMin = R.fishMealsPerWeekMin ?? 2;
const fish = fresh.filter(r => isFishMeal(r.m)).length;
if (fish < fishMin) bad('week', `${fish} fish meal(s); plan at least ${fishMin}`);
const tunaMax = R.tunaServingsPerWeekMax ?? 2;
const tuna = planned.reduce((a, r) => { const p = protOf(r.m); return a + (p.includes('albacore') ? (r.m.tunaServings ?? 2) : p.includes('tuna') ? (r.m.tunaServings ?? 1) : 0); }, 0);
if (tuna > tunaMax) bad('week', `${tuna} tuna servings (albacore counts as 2); max ${tunaMax}`);
const vegMin = R.vegetarianDinnersPerWeek ?? 2;
const vegDinners = dinnersW.filter(r => isVegetarian(r.m)).length;
if (vegDinners < vegMin) bad('week', `${vegDinners} vegetarian dinner(s); plan ${vegMin}`);
const csMax = (R.sausage && R.sausage.chickenPerWeekMax) ?? 1;
const cs = fresh.filter(r => protOf(r.m).includes('chicken sausage')).length;
if (cs > csMax) bad('week', `${cs} chicken sausage meals; max ${csMax} a week`);
const burrata = fresh.filter(r => hasTag(r.m, 'burrata') || /burrata/.test(foodText(r.m))).length;
if (burrata > 1) bad('week', `burrata ${burrata} times; once a week at most`);
const bc = dinnersW.filter(r => { const v = mine(r.m); return v && (n0(v.butterTbsp) > 0 || n0(v.creamTbsp) > 0); }).length;
if (bc > BC_DINNERS) bad('week', `${bc} dinners with butter or cream; max ${BC_DINNERS}`);
if (longNights > (LONG.perWeek ?? 1)) bad('week', `${longNights} long (over ${DINNER_MAX} min) dinners; ${LONG.perWeek ?? 1} a week`);
const [sweetMin, sweetMax] = list(R.sweetTreats && R.sweetTreats.perWeek).length ? R.sweetTreats.perWeek : [1, 2];
const sweets = planned.filter(r => hasTag(r.m, 'sweet')).length;
if (sweets > sweetMax) bad('week', `${sweets} sweet treats; ${sweetMin}-${sweetMax} a week, weekends only`);
else if (sweets < sweetMin) warn('week', `no sweet treat planned; plan ${sweetMin}-${sweetMax} on the weekend so the plan doesn't feel restrictive`);

// Variety: every recipe a different dish; shared ingredients need a different cuisine and method
const seen = new Map();
for (const r of fresh) {
  if (['snack', 'preRide'].includes(r.m.slot) || (r.m.slot === 'breakfast' && !isWeekend(r.k))) continue;
  const key = nameKey(r.m);
  if (!key) continue;
  if (seen.has(key)) bad('week', `"${r.m.recipe}" is planned twice (${seen.get(key)} and ${r.k}); every recipe in a week is a different dish`);
  else seen.set(key, r.k);
}
const recipes = fresh.filter(r => r.m.slot === 'dinner' || r.m.slot === 'lunch' || (r.m.slot === 'breakfast' && isWeekend(r.k)));
const sharedSet = r => new Set(ingsOf(r.m).map(i => low(i.name)).filter(n => !PANTRY.test(n)));
for (let i = 0; i < recipes.length; i++) for (let j = i + 1; j < recipes.length; j++) {
  const A = recipes[i], B = recipes[j], SB = sharedSet(B);
  const both = [...sharedSet(A)].filter(x => SB.has(x));
  if (!both.length) continue;
  const same = [low(A.m.cuisine) && low(A.m.cuisine) === low(B.m.cuisine) && 'cuisine', low(A.m.method) && low(A.m.method) === low(B.m.method) && 'cooking method'].filter(Boolean);
  if (same.length) warn('week', `"${A.m.recipe}" (${A.k}) and "${B.m.recipe}" (${B.k}) share ${both.slice(0, 3).join(', ')} but have the same ${same.join(' and ')}; vary them`);
}

// Whole grains
let gAll = 0, gWhole = 0;
for (const r of planned) for (const g of list(r.m.grains)) { const s = isNum(g.servings) ? g.servings : 1; gAll += s; gWhole += s * wholeShare(g); }
const wgMin = DIET.wholeGrainsMinShare ?? 0.5;
if (gAll && gWhole / gAll < wgMin) bad('week', `whole grains are ${Math.round(gWhole / gAll * 100)}% of grain servings (${gWhole}/${gAll}); at least ${Math.round(wgMin * 100)}% (haiga rice counts as half)`);

// Cuisines, new recipes, favorites
const often = list(DIET.cuisines && DIET.cuisines.often).map(low), sometimes = list(DIET.cuisines && DIET.cuisines.sometimes).map(low);
const inList = (c, arr) => !!c && arr.some(x => x.includes(c) || c.includes(x.split(' (')[0]));
let sometimesN = 0;
for (const r of dinnersW) {
  const c = low(r.m.cuisine);
  if (!c) continue;
  if (inList(c, sometimes)) sometimesN++;
  else if (!inList(c, often)) warn(r.k, `dinner cuisine "${r.m.cuisine}" isn't in the often or sometimes lists`);
}
if (sometimesN > 2) warn('week', `${sometimesN} dinners from the "sometimes" cuisines; about 1 a week`);
const wkDinners = dinnersW.filter(r => !isWeekend(r.k));
const fullGoodEggs = wkDinners.length > 0 && wkDinners.every(r => hasTag(r.m, 'goodEggs'));
const newTarget = isNum(plan.newRecipeTarget) ? plan.newRecipeTarget : ((MP.newRecipes && MP.newRecipes.perWeekToStart) ?? 4);
const newN = new Set(fresh.filter(r => r.m.isNew).map(r => nameKey(r.m))).size;
if (!fullGoodEggs && newN !== newTarget) warn('week', `${newN} new recipe(s); the plan calls for ${newTarget} (set newRecipeTarget to 2 once Paprika has about 20 recipes at 4★+)`);
const favNames = list(MP.favorites).map(f => nameKey({ recipe: f.name }));
if (!fullGoodEggs && !dinnersW.some(r => r.m.favorite || favNames.includes(nameKey(r.m)))) warn('week', 'no favorite this week (about 1 a week)');

// Leftovers: 1 dinner makes an extra portion for a work-from-home lunch
const extra = dinnersW.filter(r => r.m.extraPortion);
if (extra.length > 1) warn('week', `${extra.length} dinners make an extra portion; 1 a week`);
const lefts = planned.filter(r => r.m.slot === 'lunch' && r.m.leftoverOf);
if (lefts.length > 1) warn('week', `${lefts.length} leftover lunches; 1 a week plus 1 quick lunch`);
for (const r of lefts) {
  const src = dinnersW.find(x => x.k === r.m.leftoverOf);
  if (!src) bad(r.k, `lunch is a leftover of ${r.m.leftoverOf}'s dinner, which isn't planned`);
  else {
    if (KEYS.indexOf(src.k) >= KEYS.indexOf(r.k)) bad(r.k, `leftover lunch comes before its dinner (${src.k})`);
    if (!src.m.extraPortion) bad(src.k, `dinner needs extraPortion: true for ${r.k}'s leftover lunch`);
  }
}
const wedL = planned.find(r => r.k === 'wed' && r.m.slot === 'lunch'), friL = planned.find(r => r.k === 'fri' && r.m.slot === 'lunch');
if (wedL && friL && (!wedL.m.leftoverOf || friL.m.leftoverOf)) warn('week', 'Pilates days: the leftover lunch goes on Wed and the quick lunch on Fri');

// Repeats: only 4-5★ recipes come back within 2 weeks
const prevWeek = (() => { const dt = dateOf(plan.weekOf, 'mon'); dt.setDate(dt.getDate() - 7); return iso(dt); })();
const prev = plans.find(p => p !== plan && p.weekOf === prevWeek);
if (prev) {
  const last = new Set(list(prev.days).flatMap(d => list(d.meals)).filter(m => m.slot === 'dinner').map(nameKey));
  for (const r of dinnersW) if (last.has(nameKey(r.m)) && !(isNum(r.m.rating) && r.m.rating >= 4)) bad(r.k, `"${r.m.recipe}" was on last week's plan; only 4-5★ recipes repeat within 2 weeks`);
}

// Rolling 30-day limits, across this plan and earlier final plans.
// Every window that ends on a day of this week is checked; later windows are checked with later plans.
const RM = R.redMeat || {}, SS = R.sausage || {}, PY = R.poultry || {};
const LIMITS = [
  ['red-meat meals (beef, lamb, pork sausage)', p => p.some(x => ['beef', 'lamb', 'pork sausage'].includes(x)), RM.mealsPerMonthMax ?? 4],
  ['beef meals', p => p.includes('beef'), RM.beefPerMonthMax ?? 2],
  ['lamb meals', p => p.includes('lamb'), RM.lambPerMonthMax ?? 1],
  ['pork sausage meals', p => p.includes('pork sausage'), SS.porkPerMonthMax ?? 2],
  ['chicken thigh meals', p => p.includes('chicken thighs'), PY.chickenThighsPerMonthMax ?? 2]
];
const byWeek = new Map();
for (const p of plans) if (p !== plan && p.status === 'final' && validWeek(p.weekOf)) byWeek.set(p.weekOf, p);
byWeek.set(plan.weekOf, plan);   // this plan replaces any saved version of the same week
const dated = [...byWeek.values()].flatMap(p => list(p.days)
  .filter(d => KEYS.includes(d.day) && !d.mealsOut)
  .flatMap(d => { const n = dayNum(dateOf(p.weekOf, d.day)); return list(d.meals).filter(m => !m.leftoverOf && !['office', 'out'].includes(m.slot)).map(m => ({ n, p: protOf(m) })); }));
for (const [label, test, max] of LIMITS) {
  let worst = 0, worstDay = null;
  for (const k of KEYS) {
    const end = dayNum(dateOf(plan.weekOf, k));
    const c = dated.filter(x => x.n > end - WINDOW_DAYS && x.n <= end && test(x.p)).length;
    if (c > worst) { worst = c; worstDay = k; }
  }
  if (worst > max) bad(`${WINDOW_DAYS} days`, `${worst} ${label} in the ${WINDOW_DAYS} days ending ${worstDay} ${md(dateOf(plan.weekOf, worstDay))}; max ${max}`);
}

// ---- Result ----
if (deload) console.log('  Easier week: no carb-forward dinners needed; Tue/Thu are rest days for meals.');
if (warns.length) { console.log(`! ${warns.length} warning(s):`); for (const w of warns) console.log('  ! ' + w); }
if (errs.length) { console.log(`✗ ${errs.length} problem(s) to fix before showing the plan:`); for (const e of errs) console.log('  ✗ ' + e); process.exit(1); }
if (strict && warns.length) { console.log('✗ --strict: fix the warnings too.'); process.exit(1); }
console.log('✓ Every day is on target and every meal rule passes.');
