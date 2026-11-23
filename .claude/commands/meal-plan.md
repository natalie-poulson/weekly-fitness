---
description: Plan the meal week (Sunday dinner to the next Sunday's breakfast) for Natalie (and B's dinners) on Sunday morning as part of the weekly check-in before shopping, check them with check-meals.mjs, then fill Paprika (recipes, Notes, meal planner, grocery list).
---

# Meal plan

Follow CLAUDE.md. Everything read here is private: never copy kcal, weights or targets into a public file, a commit message or a web search. One question message, one plan to review, one "looks good". Runs on Sunday morning immediately after /weekly-checkin, using the freshly updated targets and training status for next week.

## 0. Read first

1. Dates: run on Sunday morning right after /weekly-checkin. Meal weeks run **Sunday dinner to the next Sunday's breakfast**: `weekOf` = today (the Sunday she shops), YYYY-MM-DD, and tonight's dinner is the first meal, so the freshest food is cooked first. Sunday is planned `dinnerOnly: true` (she has already eaten breakfast and lunch before shopping; an after-dinner snack is fine). The last day is `nextSun` with `breakfastOnly: true`: next Sunday's breakfast, eaten that morning while she plans the following week, bought with this week's groceries. Next week's plan then starts with that Sunday's dinner. On another day, use the coming Sunday and say so. (The workout week in plan.json still runs Monday to Sunday; only meals moved.)
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

| Day | Plan these slots |
|---|---|
| Office day | `dinner`, an `office` entry, snacks; `preRide` on a ride day |
| Home weekday | `breakfast` (5 min or less, no oats, no eggs), `lunch` (10 min or less), `dinner`, snacks; on Wed/Fri the 11:30 snack is the `preRide` slot (100–200 kcal) |
| Sunday (shopping day) | `dinner` (carb-forward, the up-to-45-min dinner is fine here), an optional evening snack; `dinnerOnly: true` |
| Next Sunday (`nextSun`, planning morning) | cooked savory `breakfast` only (eggs OK, ready while she plans), from food bought this week; `breakfastOnly: true` |
| Saturday | cooked savory `breakfast` (~10:00, the bigger meal; eggs OK), light `lunch`, `dinner` (6:00–7:00), snacks; the weekend sweet treat (1–2 a week, Sat or Sun evening) |
| Night out | no dinner; an `out` entry of 900–1,000 kcal; breakfast + lunch (or the office entry) about 250 kcal lighter in total |
| Holiday | no dinner; the rest of the day light, like a night out. If it's a ride day she still rides, so plan the pre-ride snack. |
| Away all day | `mealsOut: true`, nothing else |

Training:
- Evening ride days (Mon/Tue/Thu with a ride in trainingDays): `preRide` snack of 150–200 kcal, packed from home for ~3:30–4:00, every item with an exact amount, nothing that needs a fridge. Dinner (~6:30) is the recovery meal: 30 g+ protein for Natalie plus a starch, 30 min or less using Sunday prep.
- Carb-forward Sunday dinner is tonight's (the night before Monday HIIT), the first meal of the plan.
- Carb-forward dinner (rice, pasta, potatoes or polenta; tag `carbForward`) on Wed and Sun. Skip it on a DELOAD week.
- DELOAD week: Tue/Thu are rest days for meals, so no pre-ride snack. Portions stay the same.
- Swim night: dinner ~7:45, sheet-pan or prepped ahead (tag `sheetPan` or `prepAhead`).

The week (check-meals.mjs enforces all of these):
- Dinners: 2+ fish (fresh only Sun–Mon, since USDA says to cook or freeze raw fish within 1–2 days and Tue dinner is about 2½ days after Sunday shopping; fish for Tue–Sat is frozen on shopping day, tagged `frozenFish`, with a planner reminder the night before to move it to the fridge to thaw), 2 vegetarian, the rest poultry or red meat inside the rolling 30-day limits. Chicken sausage at most 1, tuna at most 2 servings (albacore counts 2), burrata at most once, butter or cream on at most 2 dinners (1 tbsp butter, 2 tbsp cream per person). One dinner of up to 45 min on Sat or Sun.
- Leftovers at the end: nothing bought for the week should be left after next Sunday's breakfast. If something still is (a plan changed), list it as `carryOver` [{ name, amount, note }] on the plan so next Sunday's plan uses it first.
- About 1 dinner from the "sometimes" cuisines and about 1 favorite (`favorite: true`). `newRecipeTarget` new recipes (`isNew: true`).
- One dinner makes an extra portion (`extraPortion: true`) for Wednesday's leftover lunch, and it is never a fish dinner. Friday's lunch is the quick lunch.
- Sources: every breakfast, lunch and dinner is either a sourced recipe (`source` Paprika, NYT Cooking or an approved author, with `sourceUrl`) or `source: "Quick Assembly"`. Quick Assembly is only for no-recipe combinations with every amount listed: snacks, yogurt bowls, a simple sandwich, a hummus plate, leftovers, a steamed or roasted plain vegetable side. Anything cooked beyond that needs a sourced recipe; weekend egg breakfasts always do.
- Rice, grains and beans: always cooked from dry. Every amount (ingredients, recipe Notes, prep, grocery list) gives the dry quantity to cook, usually in the Instant Pot the day it's eaten; plate portions may be cooked cups with "from X dry". Canned beans only when the plan says so. check-meals fails a rice, grain or bean amount with no dry quantity.
- Leftovers: the only leftover is the one planned for another meal (Wed lunch). Scale every other recipe in its Coach Notes so Natalie's and B's portions use the whole batch, with nothing left to freeze.
- Waste: plan so partial bunches and packages get used across the week (the rest of the spinach in a soup, a zested citrus as dessert, one lettuce head for two meals). Name anything that will still be left over in the review.
- Ingredients: list every ingredient of every meal and snack with its amount, including oil, salt, garnishes, B's sides and anything used to cook beans or grains. `node coach/grocery-list.mjs` builds the grocery list from these, so a missing ingredient here is missing from the cart.
- Every day for Natalie: kcal within ±10% of target (office and out entries count), protein at least 90%, sat fat, sodium and added sugar (15 g, not counting the sweet treat) under their limits. On home days also fiber at target, 3+ vegetable servings and 5+ vegetable and fruit servings. Every dinner has 2+ vegetable servings. At most 1 cheese portion a day (up to 2 tbsp Parmesan garnish doesn't count) and 170 g whole-milk yogurt.
- Protein 25–30 g per meal (the smoothie 20 g), 10–15 g per snack (fruit snacks excepted). Fruit after dinner on weeknights when there's room.
- Never: shellfish, cured meats, protein powder, olives other than Castelvetrano, 1–2★ recipes, or hot chile unless it's served on the side for B (`sideForB: true`). Eggs as a meal and sweets only on Sat/Sun. Low-sodium soy sauce, nitrate-free sausage, no-salt-added cans, rinsed beans. Nuts, seeds, nut butters and tahini always measured.
- Variety: no recipe twice in a week. Recipes that share a non-pantry ingredient differ in cuisine and cooking method. Dinners from last week repeat only if rated 4–5★. At least half of grain servings are whole grain (haiga rice counts as half).

Recipes (zero hallucination): Check Paprika first (4–5★ any time; unrated means untested), then NYT Cooking MCP, then web search for published recipes by NYT Cooking, Ina Garten, Alison Roman, Smitten Kitchen, Claire Saffitz, or Courtney Storer (courtneystorer.substack.com; only posts whose full recipe is free to read) (max 2 dinners per source). Build around what's in season. Never create original recipes or reconstruct cookbook recipes from memory—every new candidate must have a live `sourceUrl` whose exact ingredient list and directions you fetched and verified in this session. Adapt to Natalie's rules only in the Coach Notes block (e.g. chicken breasts for thighs, Straus nonfat yogurt, chile on the side for B), keeping the base recipe text verbatim.

Portions and nutrition: size Natalie's portions to fill her day; B's dinner is 35–40% of his kcal and protein. Use the staple label values in meal-prefs, otherwise standard nutrition data. Round kcal to 5 and grams to whole numbers. These are estimates; say so once in the review.

Office entry: kcal = Natalie's target minus that day's planned food; proteinG = protein target minus planned protein. Put the guide in `note`: "steel-cut oats; a palm of protein and half a plate of vegetables at lunch". If proteinG is over 40, add a protein snack (e.g. Straus nonfat yogurt) or a bigger dinner portion.

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

Run `node coach/check-meals.mjs --week <weekOf>`. Fix every ✗ and run it again until it passes. Fix warnings where it's easy; list the rest in the review. Never show a plan that fails.

## 4. Review

Show:
1. Week of <Sun date> (Sun dinner – Sat) · planned for a <status> week · Natalie <kcal> kcal / <protein> g protein · B dinner ~<kcal> kcal / <protein> g.
2. An 8-row table, Sunday dinner first and next Sunday's breakfast last: Day | Breakfast | Lunch | Dinner | Snacks. Every meal shows its source in italics (*Paprika · NYT Cooking*, *NYT Cooking (author)*, *Quick Assembly*); Quick Assembly items show every amount. The Snacks column lists every snack for the day, pre-ride snacks included, with time and exact portions. Snacks appear only here, never in a second section. On office days: "Office: <kcal> kcal, <g> g protein left (palm of protein, half a plate of veg)". On nights out: "Out: ~<kcal> kcal". Below the table: the daily Natalie kcal / protein range and B's dinner range.
3. The week: fish <n>, vegetarian <n>, new <n>/<target>, favorite, red meat <n> in the last 30 days, sweet treat(s).
4. Weight goal: one line on how the week lines up with it (target vs estimated burn, expected loss per week, days that run over target, the biggest unplanned risk such as a holiday dinner).
5. Leftovers and waste: the one planned leftover, and anything that will still be left over because of package sizes.
6. Sunday prep (30 min, up to 45, done after shopping, alongside tonight's dinner): any grain or beans that can't be cooked the day they're eaten (haiga rice and dried beans are usually cooked in the Instant Pot the day they're eaten: it's hands-off, so that time doesn't count toward a dinner's time limit; put the dry amount in that meal's Notes plus a planner reminder that day to start it early enough; only batch them on Sunday when Natalie asks or several meals share one pot, and then give the total dry amount and which meals it covers), wash greens and cut veg, any sauce or dressing. Prep-ahead steps the day before (thaw fish in the fridge, marinate), each added to the Paprika planner as a reminder on the day it happens, plus a "Freeze tonight" reminder on Sunday for any fish cooked Tue or later (and meat cooked Wed or later).
7. Any warnings check-meals left, one line each, and one line saying the nutrition numbers are estimates.

Then ask: "Reply 'looks good', or tell me what to swap." After each swap, run check-meals again and show only the days that changed.

## 5. After "looks good": Paprika

0. Preview first. Before writing anything to Paprika, show exactly what will be written: each new recipe's full text, every Coach Notes block, every planner entry, and the full grocery list from `node coach/grocery-list.mjs` (aisle, quantity, meals). Wait for "looks good" on that preview too. Check Paprika for missing pieces before writing: create the "Coach" category if it doesn't exist.
1. New recipes: check Paprika for the same name or source URL first. If it isn't there, create it using the exact verbatim ingredients, quantities, and directions fetched from the NYT Cooking MCP or the verified `sourceUrl`—never paraphrase steps or estimate amounts from memory. Set servings, total time, source, `sourceUrl`, and category "Coach". Leave the rating empty; Natalie rates it after cooking.
2. Every recipe used next week: write a coach block in its Notes. Replace any older coach block and leave her own notes as they are. Never change the recipe's own ingredients or directions.
   ```
   — Coach · week of 2026-11-29 · Mon dinner —
   Natalie: 1 fillet (4 oz) + 3/4 cup rice (560 kcal, 38 g protein)
   B: 6 oz salmon + 1 1/4 cups rice (800 kcal, 52 g protein)
   Changes: Straus nonfat Greek yogurt for the sauce; chile crisp on the side for B.
   Prep: none.
   ```
3. Meal planner: add every planned slot to the Paprika meal planner on its date (Sun = weekOf = today; `nextSun` = weekOf + 7, breakfast only) so Natalie never has to check Sunday's chat transcript mid-week:
   - **Breakfast**: weekend breakfasts AND work-from-home weekday breakfasts (smoothies or quick breakfasts, including portion notes if not a standalone recipe).
   - **Lunch**: weekday home lunches and weekend light lunches.
   - **Dinner**: every planned dinner.
   - **Snack**: every `preRide` snack (e.g. `Pre-ride (3:30p): 1 medium banana + 1 tbsp peanut butter`) and daily `snack` entries with exact portions (e.g. `Snack: 3/4 cup Straus nonfat Greek yogurt`).
   Remove any coach entries already there for those dates first. Leave entries she added herself alone.
4. Grocery list:
   - Add items directly to Natalie's **"My Grocery List"** in Paprika (her only list). Never create separate weekly lists.
   - **Never override or clear what's already in the cart/list** — only add the new items to it.
   - Build the list with `node coach/grocery-list.mjs --week <weekOf>`: it totals every ingredient in the plan and names the meals each one is for. Then check it against each recipe's full ingredient list in Paprika or the source (garnishes, bean-cooking extras like bay leaf, onion and garlic, B's sides). Add things she already has as "You have these" lines.
   - Every item gets an explicit `aisle` (never leave it to auto-resolve; it lands in Miscellaneous), a `quantity` (spices and oils too; salt and pepper "to taste"), and an `instruction` naming each meal and amount, e.g. "Tue tagine (1 tsp) · Sun fried eggs (1/4 tsp)".
   - In the chat, display one simple, ungrouped grocery list (do not group by store), adding up amounts across recipes (e.g. 3/4 lb salmon, 1 1/2 bunches chard), including snacks, smoothie ingredients and staples. Put pantry basics (oil, salt, spices, vinegar) on the list too, so she can tick off what she has.
5. Set `status: "final"` in meal-history and run check-meals once more. Final plans count toward the rolling 30-day limits. meal-history is private: never commit it.
6. Finish with: the recipes added to Paprika, the Notes updated, the meal planner filled, the grocery items added, the Sunday prep list, and a reminder to rate each new recipe in Paprika after cooking it.

To change a meal mid-week, use /meal-swap. For a too-tired week, use /good-eggs.
