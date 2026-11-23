---
description: Plan the meal week (Sunday dinner to the next Sunday's breakfast) for Natalie (and B's dinners) on Sunday morning as part of the weekly check-in before shopping, check them with check-meals.mjs, then fill Paprika (recipes, Notes, meal planner, grocery list).
---

# Meal plan

Follow CLAUDE.md. Everything read here is private: never copy kcal, weights or targets into a public file, a commit message or a web search. One question message, one plan to review, one "looks good". Runs on Sunday morning immediately after /weekly-checkin, using the freshly updated targets and training status for next week.

## 0. Read first

0. `coach/MEAL-RULES.md`: every meal rule (read it in full first).
1. Dates: `weekOf` = today, the Sunday she shops (YYYY-MM-DD); the plan runs from tonight's dinner to next Sunday's breakfast (`nextSun`), as in MEAL-RULES.md. On another day, use the coming Sunday and say so.
1a. The plan just before this one in meal-history: if it has `carryOver` (food already bought but not used), use those items first and mark them `onHand: true` so they aren't bought twice.
2. `coach/targets.local.json`: Natalie's kcal, proteinG, fiberG, satFatMaxG, sodiumMaxMg; B's kcal and proteinG; `status`; `trainingDays`. These are this week's targets (already updated by this morning's check-in).
3. `coach/training.json` → `current.status`. If it is `DELOAD`: plan Tue/Thu as rest days for meals (no pre-ride snack), skip the carb-forward dinners, and say so in the review. Otherwise plan the normal week.
4. `coach/meal-prefs.local.json`: every food, timing and grocery rule.
5. `coach/meal-history.local.json`: every `final` plan from the last 5 weeks (rolling 30-day meat limits, repeats).
6. Paprika MCP: the recipe list with ratings. Fewer than about 20 recipes rated 4★ or more → `newRecipeTarget` 4, otherwise 2. (If Paprika MCP is unavailable, print all blocks and lists in chat for manual copy-pasting).
7. NYT Cooking MCP: your saved recipes and favorites. Use them as candidates; they count as untested until they're in Paprika with a rating.

## 1. Ask (one message)

Ask the `household.askBeforePlanning` questions, with defaults filled in so "defaults" is a full answer:
- Tonight (Sunday): dinner only? (default yes; say if lunch still needs planning)
- Office days next week? (default Mon, Tue, Thu)
- Nights out, takeout or away? Which day, and is it dinner only or all day?
- Swimming instead of biking on Tue or Thu? (rare)
- Holidays or special days (e.g. Thanksgiving, Thu Nov 26: ride as usual, dinner at a friend's)?
- Anything else: guests, a late night, travel, food to use up?
- Already at home in quantity (eggs, yogurt, bread, tortillas)? (sets `plan.stock` so the package check counts it)
- Too tired to cook next week? If yes, suggest /good-eggs instead.

If B's weight or activity changed, update coach/profile.json and run `node coach/update-block.mjs`.

## 2. Lay out the week

Set every day's flags first:
- `office`: true or false on every weekday (never leave it out); false on Sat/Sun
- `nightOut`: true for a restaurant or takeout dinner
- `holiday`: the holiday's name, e.g. "Thanksgiving"
- `swim`: true if she swims that evening
- `mealsOut`: true only if away all day (nothing else is planned)
- `dinnerOnly`: true on the first Sunday (only dinner and an evening snack; the day isn't totalled)
- `breakfastOnly`: true on `nextSun`, the last day (only breakfast; the day isn't totalled)
- `unplanned`: true only for a day another plan covers (e.g. switching week formats)

Then plan every day by **coach/MEAL-RULES.md** (the slots for each kind of day, training, the week's rules, recipes, portions, food safety, packages and Paprika). It is the only place the rules are written down.

## 3. Save the draft and check it

Write the plan to `coach/meal-history.local.json` → `plans`, replacing any plan with the same `weekOf`, with `status: "draft"`. Every field check-meals.mjs reads (full format in coach/README.md):

```json
{ "weekOf": "2026-11-29", "status": "draft", "newRecipeTarget": 4, "plannedWith": { "kcal": 0, "proteinG": 0, "status": "HOLD" },
  "days": [
    { "day": "mon", "office": true, "nightOut": false, "holiday": null, "swim": false, "mealsOut": false,
      "meals": [
        { "slot": "preRide", "recipe": "Banana + peanut butter",
          "ingredients": [{ "name": "banana", "amount": "1 medium" }, { "name": "peanut butter", "amount": "1 tbsp" }],
          "per": { "natalie": { "kcal": 200, "proteinG": 5, "fiberG": 3, "satFatG": 1.5, "sodiumMg": 75,
                                "addedSugarG": 1, "vegServings": 0, "fruitServings": 1 } } },
        { "slot": "dinner", "recipe": "Sticky Miso Salmon Bowl", "source": "Paprika", "sourceUrl": "https://cooking.nytimes.com/recipes/1025510-sticky-miso-salmon-bowl",
          "cuisine": "Japanese", "method": "oven", "totalMin": 30, "rating": 5, "isNew": false, "favorite": true,
          "protein": ["salmon"], "tags": [], "grains": [{ "name": "haiga rice", "servings": 1 }],
          "ingredients": [{ "name": "salmon fillet", "amount": "3/4 lb" }, { "name": "low-sodium soy sauce", "amount": "1 tbsp" },
                          { "name": "chile crisp", "amount": "1 tsp", "sideForB": true }],
          "extraPortion": false,
          "per": { "natalie": { "kcal": 560, "proteinG": 38, "fiberG": 6, "satFatG": 3, "sodiumMg": 780, "addedSugarG": 6,
                                "vegServings": 2, "fruitServings": 0, "cheesePortions": 0, "butterTbsp": 0, "creamTbsp": 0, "wholeMilkYogurtG": 0 },
                   "b": { "kcal": 800, "proteinG": 52 } } },
        { "slot": "snack", "recipe": "Straus nonfat Greek yogurt", "tags": [],
          "per": { "natalie": { "kcal": 130, "proteinG": 14, "fiberG": 0, "satFatG": 0, "sodiumMg": 95, "addedSugarG": 0,
                                "vegServings": 0, "fruitServings": 0 } } },
        { "slot": "office", "note": "steel-cut oats; a palm of protein and half a plate of vegetables at lunch",
          "per": { "natalie": { "kcal": 860, "proteinG": 33 } } }
      ] }
  ] }
```

- Every meal: `slot` and `per.natalie.kcal` and `proteinG`. Every planned food (not `office` or `out`): also `fiberG`, `satFatG`, `sodiumMg`, `addedSugarG`, `vegServings` and `fruitServings`, plus `cheesePortions`, `butterTbsp`, `creamTbsp` and `wholeMilkYogurtG` on meals (0 when none).
- Breakfast, lunch and dinner: `recipe`, `source` (and `sourceUrl` unless it's "Quick Assembly"), `cuisine`, `method`, `totalMin`, `rating` (Paprika stars; null if unrated), `isNew`, `favorite`, `protein`, `tags`, `grains` ({ name, servings in Natalie's servings, optional `whole`: true, false or 0.5 }) and `ingredients` ({ name, amount, optional `sideForB` }).
- `protein` tags: salmon, trout, sole, tuna, albacore, chicken breast, chicken thighs, turkey, ground chicken, ground turkey, chicken sausage, pork sausage, beef, lamb, tofu, tempeh, beans, lentils, chickpeas, eggs.
- `tags`: carbForward, sweet, smoothie, sheetPan, prepAhead, frozenFish, burrata, fruit, goodEggs (never needsFridge on a pre-ride snack).
- Leftover lunch: `leftoverOf: "<day of the dinner>"`; that dinner has `extraPortion: true`. `tunaServings` only to override the default count.
- B: `per.b` { kcal, proteinG } on every dinner.
- `plannedWith`: the targets and status used.
- Paprika (written now, so the preview and the sync come straight from the plan): `recipes` [{ uid, title, notes: [Coach Notes lines] }] on every meal with a Paprika recipe (look up or create the recipe first to get its uid), `plannerName` on every meal without one (Quick Assembly: every amount; office: "Office: ~<kcal> kcal / <g> g protein left (<guide>)"), `plannerExtras` for side entries, and `plan.reminders` [{ day, type, text }].
- Packages: `plan.buy` for anything bought by the package, `plan.stock` for food already at home (ask; "enough" only when she confirms).

Run `node coach/check-meals.mjs --week <weekOf>`. Fix every ✗ and run it again until it passes. Fix warnings where it's easy; list the rest in the review. Never show a plan that fails.

## 4. Review

Show:
1. Week of <Sun date> (Sun dinner – Sat) · planned for a <status> week · Natalie <kcal> kcal / <protein> g protein · B dinner ~<kcal> kcal / <protein> g.
2. An 8-row table, Sunday dinner first and next Sunday's breakfast last: Day | Breakfast | Lunch | Dinner | Snacks. Every meal shows its source in italics (*Paprika · NYT Cooking*, *NYT Cooking (author)*, *Quick Assembly*); Quick Assembly items show every amount. The Snacks column lists every snack for the day, pre-ride snacks included, with time and exact portions. Snacks appear only here, never in a second section. On office days: "Office: <kcal> kcal, <g> g protein left (palm of protein, half a plate of veg)". On nights out: "Out: ~<kcal> kcal". Below the table: the daily Natalie kcal / protein range and B's dinner range.
3. The week: fish <n>, vegetarian <n>, new <n>/<target>, favorite, red meat <n> in the last 30 days, sweet treat(s).
4. Weight goal: one line on how the week lines up with it (target vs estimated burn, expected loss per week, days that run over target, the biggest unplanned risk such as a holiday dinner).
5. Leftovers and waste: the one planned leftover, and anything that will still be left over because of package sizes.
6. Sunday prep and reminders: the Sunday prep list, then each day's reminders (freeze, thaw, Instant Pot, prep-ahead) from `plan.reminders`, as MEAL-RULES.md describes.
7. Any warnings check-meals left, one line each, and one line saying the nutrition numbers are estimates.

Then ask: "Reply 'looks good', or tell me what to swap." After each swap, run check-meals again and show only the days that changed.

## 5. After "looks good": Paprika

Paprika is written from the plan, never by hand, and every write is recorded so an interrupted session can resume. If a session stopped partway, start at step 2: the sync shows exactly what's left.

1. Check and preview. Run `node coach/grocery-list.mjs --week <weekOf>` (fix any package ✗) and `node coach/paprika-sync.mjs --week <weekOf>` (fix any ✗: numbers or proteins in the text that don't match the plan, missing freeze/thaw or Instant Pot reminders). Show the preview: each new recipe's full text, every Coach Notes block and planner entry the sync prints, and the full grocery list (aisle, quantity, meals). Wait for "looks good" on the preview too. Create the "Coach" category if it doesn't exist.
2. New recipes: check Paprika for the same name or source URL first. If it isn't there, create it from the exact verbatim ingredients, quantities and directions fetched from the NYT Cooking MCP or the verified `sourceUrl` (never paraphrase steps or estimate amounts from memory). Set servings, total time, source, `sourceUrl` and category "Coach"; leave the rating empty. Put its uid in the meal's `recipes`.
3. Planner: send `addMeals` from `node coach/paprika-sync.mjs --json` to add_meals (and delete_meal anything in `deleteMeals`). Save each tool output to a file in the scratchpad and run `node coach/paprika-sync.mjs record <file>` right away, one batch at a time.
4. Notes: for each block the sync prints, read the recipe, replace its old Coach block with the new one (keep her own notes below it), then `node coach/paprika-sync.mjs notes-done <recipeUid>`.
5. Grocery list: add the grocery-list.mjs items to "My Grocery List" following the Paprika rules in MEAL-RULES.md, and `record` the add_grocery_items output.
6. Confirm: save list_meal_history (weekOf to weekOf + 7) and read_grocery_list outputs to files and run `compare <file>` and `compare-grocery <file>`. Fix anything they list: add what's missing, delete stale coach entries, and for an entry Natalie added herself run `keep <date> <type> "<name>"` (never delete hers). Last week's next-Sunday breakfast on today's date is expected and isn't flagged. Both must pass.
7. Set `status: "final"` in meal-history and run check-meals once more. Final plans count toward the rolling 30-day limits. meal-history is private: never commit it.
8. In the chat, show one simple, ungrouped grocery list with amounts added up across recipes (pantry basics included, so she can tick off what she has). Finish with: the recipes added, the Notes updated, the planner filled, the grocery items added, the Sunday prep list, and a reminder to rate each new recipe in Paprika after cooking it.

To change a meal mid-week, use /meal-swap. For a too-tired week, use /good-eggs.
