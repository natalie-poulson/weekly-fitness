---
description: Find Good Eggs meal kits and prepared meals that fit your heart-health rules and targets for too-tired weeks or quick meal swaps. Suggestions only, never orders.
---

# Good Eggs suggestions

**Never** log in, add to cart, check out, or place orders. Suggestions only.

Follow CLAUDE.md. Everything read here is private: never copy kcal, weights or targets into a public file, a commit message or a web search.

## 1. When to use

- **Mid-week tired night**: Called directly or via `/meal-swap` to replace tonight's dinner with a ≤15-minute meal kit or heat-and-eat entree.
- **Full too-tired week**: Chosen at Sunday morning planning. Replaces weekday cooking dinners with Good Eggs kits/prepared meals. Drops Sunday prep to 0 minutes. Breakfasts (smoothie/staples) and lunches stay standard.

## 2. Search & filter rules

1. Read `coach/targets.local.json` and `coach/meal-prefs.local.json`.
2. Use web search (`site:goodeggs.com`) to find currently available meal kits and prepared entrees.
3. Every rule in `coach/MEAL-RULES.md` still applies (no shellfish or cured meat, mild chiles with hot sauce on the side for B, fish only fresh early in the week or frozen, the tuna count). On top of those:
4. Heart-health limits:
   - Sodium: target ≤800 mg sodium per serving for dinner. Flag any entree at 900 mg or above.
   - Saturated fat: avoid heavy cream or cheese-loaded entrees to stay under Natalie's daily cap (`satFatMaxG` in targets.local.json).
   - Vegetables: prioritize kits/meals with generous vegetables (aiming for half the plate).
5. Portions:
   - Natalie dinner: sized to fill her day (targets.local.json), ≥30 g protein (especially on evening ride days).
   - B dinner: 35–40% of his daily kcal and protein (targets.local.json).
   - For a 2-serving meal kit, indicate portion split (e.g. B gets 60% of starch/protein, Natalie adds side salad).

## 3. Present options

Show 3 candidate kits/meals with:
- Item name and direct Good Eggs URL.
- Cook / heat time (e.g. "15 min kit" or "5 min heat & eat").
- Price.
- Nutrition per person: kcal, protein, saturated fat, sodium (or estimate if unlisted on site).
- Any simple pantry addition needed (e.g. "serve with 1 cup pre-washed arugula").

## 4. If selected

1. **For a single swap**: Update `coach/meal-history.local.json`, run `node coach/check-meals.mjs`, update the Paprika meal planner for that date, and write portion notes in Paprika Notes.
2. **For a full week**: Build the plan (Sunday dinner to next Sunday's breakfast) in `coach/meal-history.local.json` with `tags: ["goodEggs"]`, verify with `check-meals.mjs`, and populate all planned slots in the Paprika meal planner (weekday smoothies/breakfasts, lunches, `[Good Eggs]` dinners, pre-ride snacks, and daily snacks with exact portions).
3. **Paprika labeling**: Every Good Eggs meal's `plannerName` starts with "[Good Eggs]" (e.g. "[Good Eggs] Chicken Tinga Tacos") so it is easy to spot on the calendar. Write the planner and Notes with `node coach/paprika-sync.mjs` as in /meal-plan step 5.
4. **Groceries**: Do **not** add Good Eggs items to the Paprika grocery list. Only add any pantry staples (e.g. olive oil, salad greens) that Natalie needs to buy separately.
