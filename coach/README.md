# coach/

Scripts, rules and data for the weekly Coach. Run everything from the repo root with Node 18+.
Files marked **private** are blocked by `.gitignore`: never commit them or paste what's in them anywhere public.

## Sunday order

1. `/weekly-checkin` reviews the week, appends it to `coach/history.json`, sets `kcalAdjust` and `current.dumbbells` if they change, runs `build-plan.mjs --save`, `update-block.mjs`, and `encrypt.mjs` (reading your passcode silently from macOS Keychain), then pushes.
3. `/meal-plan` writes the week to `coach/meal-history.local.json`, runs `check-meals.mjs` until it passes, then fills Paprika.

Mid-week: `/meal-swap` changes one meal; `/good-eggs` suggests kits (never orders).

## Scripts

| Command | What it does | Writes |
|---|---|---|
| `node coach/build-plan.mjs --dry-run` | Prints next week from `training.json` | nothing |
| `node coach/build-plan.mjs [flags] --save` | Builds next week and saves the new values, the easier-week counter and `lastPlanWeekOf` | `plan.json`, `coach/training.json` |
| `node coach/update-block.mjs` | Daily targets for Natalie and B, plus the training days with a load tag | `coach/targets.local.json` (private) |
| `node coach/stats.mjs [--in file]` | Prints the baseline, 3-week trend, workout and nutrition rates | nothing |
| `node coach/check-meals.mjs [--week YYYY-MM-DD] [--strict]` | Checks Natalie's days and the week's food rules, including sources (every meal a sourced recipe or "Quick Assembly") and no fish leftovers. ✗ = broken rule (exits 1); ! = warning; `--strict` fails on warnings too | nothing |
| `node coach/grocery-list.mjs [--week YYYY-MM-DD] [--json]` | Builds the grocery list from the plan: every ingredient by aisle, added up where the units match, with the meals it's for. Skips leftovers and `onHand` items (listed separately) and includes `prep` | nothing |
| `node coach/encrypt.mjs [--save-keychain] [--ask] [--new-salt] [--in file]` | Copies the goal weight from `profile.json` into `history.json` (real history only), then encrypts using macOS Keychain (keeping the existing salt so your iPhone stays unlocked) | `history.enc` (and `history.json` when the goal changed) |

### build-plan.mjs flags

An unknown option or a missing value stops the run.

- `--status PROGRESS|HOLD|DELOAD`
- `--steps N` · daily step goal. Moves 500 at most (`limits.stepGoalChange`), never above 10,000 (`limits.stepGoalMax`).
- `--ride day=min` · **tue, wed or fri only**, inside the ride type's range (tue 45–60, wed 20–30, fri 20–30). Mon and Thu take their length from their level.
- `--level day=N` · **mon** (HIIT, levels 1–4) or **thu** (tempo, levels 1–5). One level at a time. A level-up lowers that day's resistance by 2 (`progression.levelUpResistanceDrop`) and sets the ride length from the level.
- `--res day=+n` · adds to the saved resistance offset on that day's work intervals. The total stays between −3 and +4 (`limits.resistanceOffset`).
- `--headline "..."` · one line shown with the plan.
- `--note "day: text"` or `--note "text"` · change notes shown in the app (repeatable). Notes describe *this* week's change, so a run with no `--note` clears last week's.
- `--keep-notes` · keep last week's notes when there's no new `--note`. (`--clear-notes` still works; clearing is now the default.)
- `--week YYYY-MM-DD` · the Monday the plan starts, in local time. Default: the Monday after today. A non-Monday is rejected with the right Monday named. More than 6 days in the past, or earlier than `current.lastPlanWeekOf`, needs `--force`; more than 2 weeks ahead prints a warning.
- `--save` · writes `current` back to `training.json`, so next week starts from these values and the easier-week counter moves on.
- `--dry-run` · print only.
- `--force` · allows more than one change a week, a jump of more than one level or 500 steps, and past weeks. Only for fixing a mistake.

**One change a week** (`progression.maxChangesPerWeek`): each `--steps`, `--ride`, `--level` or `--res` that changes a value counts as one. A ride change on a HOLD or DELOAD week prints a warning.

**DELOAD** (`--status DELOAD`): Tue and Thu become an optional 20 min Zone 1 spin (`deload: true`, `rest: true`, no ride, swap or finisher). Mon, Wed and Fri keep their rides with resistance −2 on the work intervals (never below −3), and Monday HIIT drops to Level 1. These changes go into `plan.json` only; the saved values in `training.json` don't change, so the week after goes back to them.

**Easier-week counter:** saving a plan for a new week adds 1 to `current.weeksSinceDeload` (re-saving the same week doesn't count twice; the week after a DELOAD starts again from 0). A DELOAD sets it to 0 and sets `current.lastDeloadWeekOf`. The run warns when the next week would be week 6 without an easier week.

## Targets (update-block.mjs)

- **Weight:** Natalie's comes from the latest 3-week trend in `history.json` (average of the weigh-ins in the last 3 weekly entries, missed weeks skipped). `profile.json` `weightLb` is used only until the first weigh-in, and always for B.
- **kcalFormula** = Mifflin-St Jeor BMR × activity factor − deficit, rounded to 50. Deficit = weight × `weeklyLossPctTarget`% × 3,500 ÷ 7 when `goal` is `"lose"`.
- **kcal** = kcalFormula + `kcalAdjust` (set by the check-in), never below `minKcal` (1,200 female, 1,500 male). `kcalOverride` replaces the target and pauses recalibration, so avoid it.
- **Protein** = goal weight × `proteinGPerLbGoalWeight`, rounded to 5 (`proteinOverrideG` wins when set).
- **Heart health:** fiber = the larger of 25 g and kcal ÷ 1,000 × 14 g; saturated fat max = 10% of kcal ÷ 9; sodium max 2,300 mg.
- **Load tag per day:** Zone 5 and Zone 3–4 → `hard`; Zone 2 → `moderate`; Zone 1 → `easy` (`moderate` on a Pilates day); rest → `rest`. On a DELOAD week Tue and Thu are `rest`.

All factors live in `training.json` → `nutrition`.

## Data formats

Example values below are placeholders. Real numbers stay in the private files.

### training.json (public)

You edit most of it by hand, rarely. `current` is written by `build-plan.mjs --save` and `/weekly-checkin`.

```json
"current": {
  "status": "HOLD", "stepGoal": 7500, "headline": "One line for the app",
  "minutes":    { "mon": 30, "tue": 45, "wed": 20, "thu": 35, "fri": 25 },
  "resistance": { "mon": 0, "tue": 0, "wed": 0, "thu": 0, "fri": 0 },
  "levels":     { "mon": 1, "thu": 1 },
  "weeksSinceDeload": 0, "lastDeloadWeekOf": null, "lastPlanWeekOf": "2026-11-23",
  "dumbbells": { "gsq": { "lb": 0, "topStreak": 0, "stalls": 0 } },
  "adjustments": [{ "day": "mon", "text": "+1 resistance on Max Effort intervals" }]
}
```

- `minutes.mon` and `minutes.thu` always follow the level.
- `dumbbells` is keyed by the app's exercise ids (`gsq`, `fp`, `rl`, `row1`, `rdl`, `ohp`, `ssq`, `bor`). `topStreak` = sessions in a row with every set at 15 reps and 1–2 to spare (2 → up 5 lb, restart at 8 reps). `stalls` = sessions in a row with no added reps or weight (3 → down 5 lb). `/weekly-checkin` updates it before running build-plan.

| Section | What it holds |
|---|---|
| `rideTypes` | Name, min–max minutes, `workSegment` (the segment `--res` changes) and, for HIIT and tempo, the level ladder |
| `limits` | `resistanceOffset` [−3, 4], `stepGoalChange` 500, `stepGoalMax` 10,000 |
| `progression` | `maxChangesPerWeek` 1, `levelUpResistanceDrop` 2, `ladders` (mon: resistance → level; tue: minutes → resistance; thu: level → resistance; wed/fri: none), `tueResistanceOnlyIfZone2` |
| `strength` | Dumbbell pair 5–50 lb in 5 lb steps, 3 × 8–15 reps, go-up and stall rules |
| `deload` | Tue/Thu easy-spin text, `everyWeeks` [4, 6], `otherDaysResistanceOffset` −2, `hiitLevel` 1, `tempoLevel` 1 |
| `nutrition` | Activity factors, loss pace, protein factor, kcal floors, check tolerance (10%), fiber, saturated-fat and sodium limits |
| `days` | The 7 days: zone, title, text, ride type, swim swap, finisher, Pilates |

HIIT levels: L1 4 × 3 min max / 3 min easy (30 min) · L2 4 × 3 / 2 (30) · L3 5 × 3 / 2 (35) · L4 4 × 4 / 2 (35).
Tempo levels: L1 1 × 15 min (35 min) · L2 2 × 10 (35) · L3 2 × 12 (40) · L4 3 × 10 (45) · L5 2 × 15 (45).

### plan.json (public; written by build-plan.mjs, never by hand)

```json
{
  "schema": 1, "weekOf": "2026-11-23", "generatedAt": "2026-11-22T17:00:00.000Z",
  "calibration": { "status": "PROGRESS", "headline": "Small bump this week.", "stepGoal": 7500,
                   "adjustments": [{ "day": "mon", "text": "+1 resistance on Max Effort intervals" }] },
  "days": [
    { "key": "mon", "name": "Monday", "zone": "Zone 5", "zc": "z5", "title": "The HIIT Engine", "text": "...",
      "ride": { "type": "hiit", "minutes": 30, "level": 1, "adjust": { "segment": "Max Effort", "resistance": 1 } } },
    { "key": "tue", "name": "Tuesday", "zone": "Zone 1", "zc": "rest", "focus": "Deload", "title": "Deload Easy Spin",
      "short": "Easy spin", "text": "...", "rest": true, "deload": true }
  ]
}
```

`ride.level` appears on Mon and Thu; `ride.adjust` only when the offset isn't 0. The second day shows a DELOAD Tuesday. plan.json never holds weights or calories.

### targets.local.json (private; written by update-block.mjs)

```json
{
  "generatedAt": "...", "status": "HOLD", "stepGoal": 7500,
  "people": {
    "natalie": { "name": "Natalie", "weightLb": 0, "weightSource": "history.json trend (2026-11-22)", "goalWeightLb": 0,
                 "bmr": 0, "tdee": 0, "deficit": 0, "kcalFormula": 0, "kcalAdjust": 0, "kcal": 0,
                 "proteinG": 0, "fiberG": 0, "satFatMaxG": 0, "sodiumMaxMg": 2300, "missing": [], "notes": [] },
    "b": { "...": "same fields" }
  },
  "trainingDays": [
    { "day": "mon", "title": "The HIIT Engine", "load": "hard", "minutes": 30, "finisher": false, "pilates": false }
  ]
}
```

`missing` lists profile fields still empty; `notes` explains anything unusual (trend weight used, kcal floor applied, override set, Progress-tab goal out of date). `minutes` is null on rest days and DELOAD Tue/Thu.

### history.json (private; history.example.json shows a full fake example)

```json
{
  "schema": 1, "units": "lb",
  "goals": { "startWeight": 0, "goalWeight": 0, "weeklyLossPct": [0.5, 0.8] },
  "weeks": [{
    "weekOf": "2026-11-22",
    "weighIn": { "date": "2026-11-22", "lbs": 0 },
    "sessions": { "planned":   { "rides": 4, "swims": 1, "pilates": 2, "finishers": 2 },
                  "completed": { "rides": 4, "swims": 1, "pilates": 2, "finishers": 2 } },
    "garmin": { "avgSteps": 0, "stepGoal": 7500, "intensityMin": 0, "avgBodyBattery": 0, "avgSleepScore": 0,
                "avgRestingHr": 0, "restingHrBaseline": 0 },
    "hr": { "mon": "pass", "tue": "skip", "thu": "fail" },
    "hardNotFinished": ["thu"],
    "choices": { "tue": "swim", "thu": "bike" },
    "nutrition": { "daysOnPlan": 0, "kcalTarget": 0, "proteinTargetG": 0, "recalibration": null },
    "coach": { "decision": "HOLD", "next": "No changes", "focus": "", "changed": null }
  }]
}
```

- `weekOf` and `weighIn.date` are the Sunday of the check-in (the week reviewed ends that day). plan.json's `weekOf` is the next day.
- Only `weekOf` and `weighIn` are required; a missed weigh-in is `"weighIn": null`. Older weeks without the newer fields are fine.
- `goals.goalWeight` is copied from `profile.json` by encrypt.mjs: edit the goal there, not here.
- `sessions.planned` counts rides and swims as she chose them on Tue/Thu, plus Pilates and finishers.
- `garmin.restingHrBaseline` = average resting HR over the previous 4 weeks.
- `hr`: each check is `"pass"`, `"fail"` or `"skip"` (no data, or she swam). `hardNotFinished`: hard days cut short (`"mon"`, `"thu"`).
- `nutrition.recalibration`, when calories change: `{ "fromKcal": 0, "toKcal": 0, "kcalAdjust": -100, "reason": "..." }`.
- `coach.changed`: `"mon"`, `"thu"`, `"tue"`, `"steps"` or null. The next PROGRESS change starts after the last one in the order Mon → Thu → Tue → steps.
- Append one entry per week. Never rewrite past weeks unless Natalie asks.

### profile.json (private)

`historyPerson` (whose weigh-ins are in history.json), then for each person in `people`: `name`, `sex`, `age`, `heightIn`, `weightLb`, `goalWeightLb`, `activity`, `goal`, `kcalAdjust`, `kcalOverride` (avoid), `proteinOverrideG`. Run `node coach/update-block.mjs` after any change.

### meal-history.local.json (private)

Written by `/meal-plan`, `/meal-swap` and `/good-eggs`; read by `check-meals.mjs`.

**Plan:** meal weeks run Sunday (shopping day, dinner only) to the next Sunday's breakfast (`nextSun`, breakfast only); plans saved before 2026-11-22 started on a Monday and still check. `prep` (optional: Sunday prep like cooking beans or grains, `[{ recipe, ingredients }]`, so its extras get bought), `weekOf` (the Sunday it starts; older plans: the Monday), `carryOver` (optional: food bought but not used, `[{ name, amount, note }]`; the next /meal-plan uses it first), `status` (`"draft"` or `"final"`; only final plans count toward the rolling 30-day limits), `newRecipeTarget` (4, or 2 once Paprika has about 20 recipes at 4★+), `plannedWith` { kcal, proteinG, status }, `days` (all 7, plus `nextSun` on Sunday-start plans). Fresh fish only Sun–Mon (bought on shopping day; USDA: cook or freeze raw fish within 1–2 days); Tue–Sat fish is frozen and needs `frozenFish`, or check-meals fails.

**Day:** `day` (sun–sat, or `nextSun` for the following Sunday), `office` (true or false on every weekday), `nightOut`, `holiday` (its name, or null), `swim`, `mealsOut` (away all day; nothing else planned), `dinnerOnly` (the first Sunday: only dinner and an evening snack, not totalled), `breakfastOnly` (`nextSun`: only breakfast, not totalled), `unplanned` (another plan covers this day), `meals`.

**Meal:**

| Field | On | Notes |
|---|---|---|
| `slot` | every meal | `breakfast`, `lunch`, `dinner`, `snack`, `preRide`, `office`, `out` |
| `per.natalie.kcal`, `.proteinG` | every meal | |
| `per.natalie.fiberG`, `.satFatG`, `.sodiumMg`, `.addedSugarG`, `.vegServings`, `.fruitServings` | planned food (not `office` or `out`) | |
| `per.natalie.cheesePortions`, `.butterTbsp`, `.creamTbsp`, `.wholeMilkYogurtG` | breakfast, lunch, dinner | 0 when none |
| `per.b` { kcal, proteinG } | every dinner | sized by /meal-plan, not checked |
| `recipe`, `cuisine`, `method`, `totalMin`, `rating`, `isNew`, `favorite` | breakfast, lunch, dinner | `rating` = Paprika stars, or null if unrated |
| `protein` | breakfast, lunch, dinner | salmon, trout, sole, tuna, albacore, chicken breast, chicken thighs, turkey, ground chicken, ground turkey, chicken sausage, pork sausage, beef, lamb, tofu, tempeh, beans, lentils, chickpeas, eggs |
| `tags` | any | carbForward, sweet, smoothie, sheetPan, prepAhead, frozenFish, burrata, fruit, needsFridge; `goodEggs` labels a Good Eggs meal (warns at ≥900 mg dinner sodium and skips new-recipe/favorite warnings on a Good Eggs week) |
| `grains` | breakfast, lunch, dinner | `[{ name, servings, whole? }]`, servings in Natalie's portions; `whole` true, false or 0.5 overrides the guess (haiga rice counts as 0.5) |
| `ingredients` | every planned meal and snack | `[{ name, amount, sideForB?, onHand? }]`, every ingredient including oil, salt and garnishes, because grocery-list.mjs builds the cart from these. `onHand: true` = already owned or bought for another meal (not added up) |
| `source` | breakfast, lunch, dinner | the recipe's source (Paprika, NYT Cooking, an approved author) or `"Quick Assembly"` for no-recipe combinations with every amount listed |
| `sourceUrl` | sourced recipes | required except for "Quick Assembly" and Natalie's own Paprika recipes; always required when `isNew` |
| `leftoverOf` | a leftover lunch | the day of the dinner it comes from |
| `extraPortion` | dinner | true on the one dinner that makes a leftover lunch; never a fish dinner |
| `tunaServings` | optional | overrides the count (tuna 1, albacore 2) |
| `note` | `office` | the guide for office meals |

```json
{ "plans": [{
  "weekOf": "2026-11-29", "status": "draft", "newRecipeTarget": 4,
  "plannedWith": { "kcal": 0, "proteinG": 0, "status": "HOLD" },
  "days": [{
    "day": "mon", "office": true, "nightOut": false, "holiday": null, "swim": false, "mealsOut": false,
    "meals": [
      { "slot": "preRide", "recipe": "Banana + peanut butter",
        "ingredients": [{ "name": "banana", "amount": "1 medium" }, { "name": "peanut butter", "amount": "1 tbsp" }],
        "per": { "natalie": { "kcal": 0, "proteinG": 0, "fiberG": 0, "satFatG": 0, "sodiumMg": 0,
                              "addedSugarG": 0, "vegServings": 0, "fruitServings": 1 } } },
      { "slot": "dinner", "recipe": "Recipe name", "source": "Paprika", "cuisine": "Italian", "method": "oven",
        "totalMin": 30, "rating": null, "isNew": true, "favorite": false,
        "protein": ["salmon"], "tags": [], "grains": [{ "name": "farro", "servings": 1 }],
        "ingredients": [{ "name": "salmon fillet", "amount": "3/4 lb" }], "extraPortion": false,
        "per": { "natalie": { "kcal": 0, "proteinG": 0, "fiberG": 0, "satFatG": 0, "sodiumMg": 0, "addedSugarG": 0,
                              "vegServings": 2, "fruitServings": 0, "cheesePortions": 0, "butterTbsp": 0,
                              "creamTbsp": 0, "wholeMilkYogurtG": 0 },
                 "b": { "kcal": 0, "proteinG": 0 } } },
      { "slot": "office", "note": "steel-cut oats; a palm of protein and half a plate of vegetables at lunch",
        "per": { "natalie": { "kcal": 0, "proteinG": 0 } } }
    ] }] }] }
```

### meal-prefs.local.json (private)

Every food, timing and grocery rule, read by /meal-plan, /meal-swap, /good-eggs and check-meals.mjs. check-meals.mjs reads `household.officeDaysDefault`; `training` (preRideSnack, pilatesDays, hardDays, proteinPerMealG, proteinPerSnackG); `rules` (meat, fish, tuna, eggs, sweets, cheese, yogurt, butter and cream, vegetables, shellfish, cured meats); `meals` (dinner, weekdayBreakfast, weekdayLunch time limits); `diet` (cuisines, wholeGrainsMinShare); `newRecipes`; `favorites`. Change a rule there and the check follows it.

Personal project, not medical advice.
