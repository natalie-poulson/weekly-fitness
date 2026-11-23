# Meal rules

The one place the meal rules live. `/meal-plan`, `/meal-swap` and `/good-eggs` follow this file; `coach/check-meals.mjs`
(food and day rules), `coach/grocery-list.mjs` (packages) and `coach/paprika-sync.mjs` (Paprika text and reminders)
enforce it. To change a rule, change it here and in the script that enforces it; the commands only point here.
Field formats are in coach/README.md. Natalie's own foods, timings and targets are private (meal-prefs.local.json,
targets.local.json) and never copied here.

## The meal week

- Meal weeks run **Sunday dinner to the next Sunday's breakfast**. `weekOf` is the Sunday she shops; tonight's dinner is the first meal, so the freshest food is cooked first.
- The first Sunday is `dinnerOnly` (breakfast and lunch were eaten before shopping; an after-dinner snack is fine). The last day is `nextSun` with `breakfastOnly`: next Sunday's breakfast, eaten that morning while she plans the following week, bought with this week's groceries. Next week's plan starts with that Sunday's dinner.
- The workout week in plan.json still runs Monday to Sunday; only meals moved.

## Each day

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


## Training

- Evening ride days (Mon/Tue/Thu with a ride in trainingDays): `preRide` snack of 150–200 kcal, packed from home for ~3:30–4:00, every item with an exact amount, nothing that needs a fridge. Dinner (~6:30) is the recovery meal: 30 g+ protein for Natalie plus a starch, 30 min or less using Sunday prep.
- Carb-forward Sunday dinner is tonight's (the night before Monday HIIT), the first meal of the plan.
- Carb-forward dinner (rice, pasta, potatoes or polenta; tag `carbForward`) on Wed and Sun. Skip it on a DELOAD week.
- DELOAD week: Tue/Thu are rest days for meals, so no pre-ride snack. Portions stay the same.
- Swim night: dinner ~7:45, sheet-pan or prepped ahead (tag `sheetPan` or `prepAhead`).


## The week

check-meals.mjs enforces all of these.

- Dinners: 2+ fish (fresh or frozen: see Food safety below), 2 vegetarian, the rest poultry or red meat inside the rolling 30-day limits. Chicken sausage at most 1, tuna at most 2 servings (albacore counts 2), burrata at most once, butter or cream on at most 2 dinners (1 tbsp butter, 2 tbsp cream per person). One dinner of up to 45 min on Sat or Sun.
- Leftovers at the end: nothing bought for the week should be left after next Sunday's breakfast. If something still is (a plan changed), list it as `carryOver` [{ name, amount, note }] on the plan so next Sunday's plan uses it first.
- About 1 dinner from the "sometimes" cuisines and about 1 favorite (`favorite: true`). `newRecipeTarget` new recipes (`isNew: true`).
- One dinner makes an extra portion (`extraPortion: true`) for Wednesday's leftover lunch, and it is never a fish dinner. Friday's lunch is the quick lunch.
- Sources: every breakfast, lunch and dinner is either a sourced recipe (`source` Paprika, NYT Cooking or an approved author, with `sourceUrl`) or `source: "Quick Assembly"`. Quick Assembly is only for no-recipe combinations with every amount listed: snacks, yogurt bowls, a simple sandwich, a hummus plate, leftovers, a steamed or roasted plain vegetable side. Anything cooked beyond that needs a sourced recipe; weekend egg breakfasts always do.
- Rice, grains and beans: always cooked from dry (when: see Food safety below). Every amount (ingredients, recipe Notes, prep, grocery list) gives the dry quantity to cook; plate portions may be cooked cups with "from X dry". Canned beans only when the plan says so. check-meals fails a rice, grain or bean amount with no dry quantity.
- Leftovers: the only leftover is the one planned for another meal (Wed lunch). Scale every other recipe in its Coach Notes so Natalie's and B's portions use the whole batch, with nothing left to freeze.
- Waste: plan so partial bunches and packages get used across the week (the rest of the spinach in a soup, a zested citrus as dessert, one lettuce head for two meals). Name anything that will still be left over in the review.
- Ingredients: list every ingredient of every meal and snack with its amount, including oil, salt, garnishes, B's sides and anything used to cook beans or grains. `node coach/grocery-list.mjs` builds the grocery list from these, so a missing ingredient here is missing from the cart.
- Every day for Natalie: kcal within ±10% of target (office and out entries count), protein at least 90%, sat fat, sodium and added sugar (15 g, not counting the sweet treat) under their limits. On home days also fiber at target, 3+ vegetable servings and 5+ vegetable and fruit servings. Every dinner has 2+ vegetable servings. At most 1 cheese portion a day (up to 2 tbsp Parmesan garnish doesn't count) and 170 g whole-milk yogurt.
- Protein 25–30 g per meal (the smoothie 20 g), 10–15 g per snack (fruit snacks excepted). Fruit after dinner on weeknights when there's room.
- Never: shellfish, cured meats, protein powder, olives other than Castelvetrano, 1–2★ recipes, or hot chile unless it's served on the side for B (`sideForB: true`). Eggs as a meal and sweets only on Sat/Sun. Low-sodium soy sauce, nitrate-free sausage, no-salt-added cans, rinsed beans. Nuts, seeds, nut butters and tahini always measured.
- Variety: no recipe twice in a week. Recipes that share a non-pantry ingredient differ in cuisine and cooking method. Dinners from last week repeat only if rated 4–5★. At least half of grain servings are whole grain (haiga rice counts as half).


## Recipes (zero hallucination)

Check Paprika first (4–5★ any time; unrated means untested), then NYT Cooking MCP, then web search for published recipes by NYT Cooking, Ina Garten, Alison Roman, Smitten Kitchen, Claire Saffitz, or Courtney Storer (courtneystorer.substack.com; only posts whose full recipe is free to read) (max 2 dinners per source). Build around what's in season. Never create original recipes or reconstruct cookbook recipes from memory—every new candidate must have a live `sourceUrl` whose exact ingredient list and directions you fetched and verified in this session. Adapt to Natalie's rules only in the Coach Notes block (e.g. chicken breasts for thighs, Straus nonfat yogurt, chile on the side for B), keeping the base recipe text verbatim.


## Portions and nutrition

size Natalie's portions to fill her day; B's dinner is 35–40% of his kcal and protein. Use the staple label values in meal-prefs, otherwise standard nutrition data. Round kcal to 5 and grams to whole numbers. These are estimates; say so once in the review.


## Office entry

kcal = Natalie's target minus that day's planned food; proteinG = protein target minus planned protein. Put the guide in `note`: "steel-cut oats; a palm of protein and half a plate of vegetables at lunch". If proteinG is over 40, add a protein snack (e.g. Straus nonfat yogurt) or a bigger dinner portion.

## Food safety and cooking ahead

- Fresh fish only for Sun–Mon dinners: USDA says to cook or freeze raw fish within 1–2 days, and Tue dinner is about 2½ days after Sunday shopping. Fish for Tue–Sat is frozen on shopping day (`frozenFish`), with a "Freeze tonight" planner reminder on Sunday and a "Thaw tonight" reminder the night before (thaw in the fridge; thawed fish keeps 1–2 more days). Meat cooked Wed or later gets a "Freeze tonight" reminder too.
- Haiga rice and dried beans are usually cooked in the Instant Pot the day they're eaten. It's hands-off, so that time doesn't count toward a dinner's time limit. Put the dry amount in that meal's Notes plus a planner reminder that day to start it early enough. Batch them on Sunday only when Natalie asks or several meals share one pot, and then give the total dry amount and which meals it covers.
- Sunday prep: 30 min (up to 45), done after shopping alongside tonight's dinner: anything that can't be cooked the day it's eaten, washing greens and cutting veg, any sauce or dressing. Prep-ahead steps the day before (thaw, marinate) each get a planner reminder on the day they happen.

## Packages and leftovers at home

- Anything bought by the package (eggs by the dozen, yogurt tubs, bread, tortillas) goes in `plan.buy` with how it's bought. Food already at home goes in `plan.stock` ("enough" only when Natalie confirms it). grocery-list.mjs adds up every use against bought + at home and fails on a shortfall.
- Whatever will still be left after next Sunday's breakfast is named in the review and saved as `carryOver`.

## Paprika

- The plan is the source of truth; Paprika is written from it. Every meal links its Paprika recipe(s) (`recipes`, with the Coach Notes lines) or has a `plannerName`; side entries go in `plannerExtras`; reminders (freeze, thaw, Instant Pot, prep, holidays) go in `plan.reminders`. paprika-sync.mjs builds the Notes headers, checks that every number and protein in the text matches the plan, and tracks what's been written.
- Coach Notes block, first in the recipe's Notes, replacing any older coach block and leaving her own notes as they are. Never change the recipe's own ingredients or directions:
  ```
  — Coach · week of 2026-11-29 · Mon dinner —
  Natalie: 1 fillet (4 oz) + 3/4 cup rice (560 kcal, 38 g protein)
  B: 6 oz salmon + 1 1/4 cups rice (800 kcal, 52 g protein)
  Changes: Straus nonfat Greek yogurt for the sauce; chile crisp on the side for B.
  Prep: none.
  ```
- Meal planner: every planned slot on its date (Sun = weekOf; `nextSun` = weekOf + 7, breakfast only), so Natalie never has to check the chat mid-week: breakfasts (weekend and work-from-home), lunches, every dinner, and every snack and pre-ride snack with time and exact portions (e.g. `Pre-ride (3:30p): 1 medium banana + 1 tbsp peanut butter`). Remove coach entries that are no longer in the plan; leave entries she added herself alone (mark them with paprika-sync `keep` so they're never flagged). Good Eggs meals are labeled "[Good Eggs] <name>".
- Grocery list: only Natalie's **"My Grocery List"**; never create weekly lists, never clear or overwrite items, only add. Every item gets an explicit `aisle` (never left to auto-resolve), a `quantity` (spices and oils too; salt and pepper "to taste") and an `instruction` naming each meal and amount, e.g. "Tue tagine (1 tsp) · Sun fried eggs (1/4 tsp)". Check each recipe's full ingredient list too (garnishes, bean and grain cooking extras, B's sides). Good Eggs items never go on the list. If something was bought as a different item (trout for salmon), note it on the item and record it in `plan.groceryAs`.
