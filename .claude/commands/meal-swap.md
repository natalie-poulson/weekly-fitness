---
description: Swap one meal mid-week in this week's plan while keeping both people on target and updating Paprika.
---

# Meal swap

Follow CLAUDE.md. Everything read here is private: never copy kcal, weights or targets into a public file, a commit message or a web search. Keep it to one question message, one selection to review, then apply.

## 1. Ask & inspect

1. Ask:
   - Which meal to swap? (day and slot, e.g. "Wednesday dinner")
   - Reason: tired, missing ingredient, plans changed, or craving?
   - Any specific ingredient to use up or avoid?
2. If the reason is "too tired", offer ≤20-minute or no-cook options, or suggest `/good-eggs`.
3. Read:
   - `coach/targets.local.json`: current targets and training schedule.
   - `coach/meal-prefs.local.json`: food rules, favorites, and staples.
   - `coach/meal-history.local.json`: find the current week's plan (`status: "final"` or `"draft"`).

## 2. Offer 3 candidates

Offer 3 real, verified options from Paprika (4–5★ or untested), NYT Cooking MCP, or a fetched web URL from Natalie's approved authors (Ina Garten, Alison Roman, Smitten Kitchen, Claire Saffitz)—never invent a dish or guess recipe quantities from memory:
- Prioritize recipes using what's already on hand or in the pantry to minimize extra shopping.
- Match training context:
  - Evening ride day (Mon/Tue/Thu): recovery meal with 30g+ protein for Natalie and a starch, 30 min or less.
  - Carb-forward night (Sun/Wed): pasta, rice, potatoes or polenta (skip if DELOAD).
  - Thu–Sun fish must be frozen (`frozenFish: true`).
- Maintain rolling 30-day meat limits, 2+ weekly fish, 2+ vegetarian dinners, cheese cap (1/day), butter/cream limits (≤2 dinners), and mild chiles for Natalie (`sideForB: true` for B).
- If swapping the dinner that provides Wednesday's lunch, confirm whether it still makes an extra portion (`extraPortion: true`) or if Wednesday's lunch needs a quick alternative. A fish dinner never provides the leftover.
- Scale the recipe so the portions use the whole batch (no unplanned leftovers), and label the meal with its `source` and `sourceUrl`, or "Quick Assembly".
- Show each candidate with: name, source, total cook time, Natalie's portion (kcal, protein), and B's portion (kcal, protein).

## 3. Apply the swap

After Natalie picks:
1. Update that meal in `coach/meal-history.local.json`:
   - Write all fields required by check-meals.mjs: `slot`, `recipe`, `cuisine`, `method`, `totalMin`, `rating`, `isNew`, `favorite`, `protein`, `tags`, `grains`, `ingredients` (with `sideForB`), and `per` nutrition.
   - If the new meal changes the day's totals outside ±10% kcal or <90% protein, adjust a snack (e.g. Straus nonfat Greek yogurt, fruit, or nuts) to bring the day back on target.
2. Run `node coach/check-meals.mjs --week <weekOf>`. Fix any ✗ before proceeding.

## 4. Update Paprika

1. If the recipe is new to Paprika, create it using the exact verbatim ingredients, quantities, and directions fetched from the NYT Cooking MCP or the verified `sourceUrl`—never paraphrase steps or estimate amounts from memory (category "Coach", empty rating).
2. Write the coach block in its Notes:
   ```
   — Coach · week of <weekOf> · <Day> <slot> —
   Natalie: <portion> (<kcal> kcal, <g> g protein)
   B: <portion> (<kcal> kcal, <g> g protein)
   Changes: Straus nonfat Greek yogurt for sauce; chile on side for B.
   Prep: none.
   ```
3. Update the Paprika meal planner on that date with the new recipe, and if a snack was adjusted in Step 3 to keep daily totals on target, update that day's **Snack** entry in the Paprika meal planner with its exact portion too.
4. Groceries: Add any new ingredients directly to **"My Grocery List"** in Paprika. **Never overwrite or clear existing cart/list items**. Check the recipe's full ingredient list (garnishes included). Every item gets an explicit `aisle`, a `quantity` and an `instruction` naming the meal and amount, as in /meal-plan.
5. Save `meal-history.local.json` with `status: "final"`.
6. Confirm in chat: the swapped meal, the updated daily totals, any adjusted snack, and the specific items added to My Grocery List.
