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
   - `coach/MEAL-RULES.md`: every meal rule. The swap must still follow all of them.

## 2. Offer 3 candidates

Offer 3 real, verified options found the way MEAL-RULES.md § Recipes describes (never invent a dish or guess quantities). Prefer what's already at home, match that day's training slot (MEAL-RULES.md § Training) and keep the week's rules. If the swapped dinner provides Wednesday's leftover lunch, say whether the new one still makes the extra portion or what Wednesday's lunch becomes.
- Show each candidate with: name, source, total cook time, Natalie's portion (kcal, protein), and B's portion (kcal, protein).

## 3. Apply the swap

After Natalie picks:
1. Update that meal in `coach/meal-history.local.json`:
   - Write all fields required by check-meals.mjs: `slot`, `recipe`, `cuisine`, `method`, `totalMin`, `rating`, `isNew`, `favorite`, `protein`, `tags`, `grains`, `ingredients` (with `sideForB`), and `per` nutrition.
   - If the new meal changes the day's totals outside ±10% kcal or <90% protein, adjust a snack (e.g. Straus nonfat Greek yogurt, fruit, or nuts) to bring the day back on target.
2. Run `node coach/check-meals.mjs --week <weekOf>`. Fix any ✗ before proceeding.

## 4. Update Paprika

Same as /meal-plan step 5, for just the changed meals: update the meal's `recipes` (uid, title, Coach Notes lines), `plannerName`, `plannerExtras` and any reminders in the plan first, then:
1. A new recipe: create it verbatim from its verified source (category "Coach", empty rating).
2. `node coach/paprika-sync.mjs` lists what changed: the planner entries to add and the old ones to delete, and the Notes to write. Write them, `record` each tool output and run `notes-done` for each recipe.
3. New ingredients go on "My Grocery List" by the Paprika rules in MEAL-RULES.md (run `node coach/grocery-list.mjs` for packages), then `record` the output.
4. Run `compare` on that day's list_meal_history, and `compare-grocery`.
5. Save `meal-history.local.json` with `status: "final"` and confirm in chat: the swapped meal, the updated daily totals, any adjusted snack, and the items added to My Grocery List.
