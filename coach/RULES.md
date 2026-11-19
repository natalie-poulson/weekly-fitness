# Coach rules

The Sunday check-in follows these rules. The signal thresholds match the app's Progress tab, so the dots you see there are what the Coach used. Settings named in `backticks` live in coach/training.json unless noted. These are starting rules: change them here any time.

## Signals (the week just ended)

| Signal | Green when | Source |
|---|---|---|
| Weight | the 3-week trend fell 0.3 lb or more since the last weigh-in | history.json |
| Workouts | completed sessions ≥ 90% of planned | Garmin |
| Nutrition | 6 or more of 7 days on the meal plan | check-in answer |
| Recovery | average Body Battery ≥ 55 **and** Sleep Score ≥ 72 | Garmin |

3-week trend = average of the weigh-ins from the last 3 weeks (missed weeks are skipped). Never judge on a single weigh-in. Target pace: 0.5% of body weight a week (`nutrition.weeklyLossPctTarget`); the safe range is 0.5–0.8% (`goals.weeklyLossPct` in history.json).

## Heart-rate checks

From Garmin's heart-rate zones for each ride. They decide whether a day can progress and feed the early-deload check. They are not a fifth signal on the Progress tab.

| Day | Passes when | If it fails |
|---|---|---|
| Mon HIIT | every Max Effort round reached Zone 4 or 5, and all rounds were finished | no Monday change; cut rounds count as a hard session not finished |
| Tue cruise | at least 80% of the main set (warm-up and cool-down excluded) in Zone 2 | no Tuesday resistance increase (`progression.tueResistanceOnlyIfZone2`) |
| Thu tempo | tempo blocks mostly Zone 3–4, under 5 min in Zone 5, all blocks finished | no Thursday change; cut blocks count as a hard session not finished |
| Wed / Fri | rides stayed in Zone 1–2 | these days don't progress; mention drift into Zone 3+ in the summary as a fatigue sign |

Resting heart rate: baseline = Garmin's average resting HR over the previous 4 weeks. 5+ bpm above baseline on 3 or more days of the week is an early-deload trigger. If Garmin reports HRV status, 3+ days below its baseline range counts the same way.

No heart-rate data (Garmin not connected, or a ride not recorded): skip that check. That day can't progress this week; everything else applies as normal. A swim on Tue or Thu means no bike check and no bike change for that day.

## Decision

1. **DELOAD** if any of:
   - next week includes illness, injury or travel;
   - Recovery was amber two weeks running;
   - early trigger: the resting-HR flag above, or two hard sessions in a row not finished (hard = Mon HIIT, Thu tempo);
   - it's due: `current.weeksSinceDeload` is 5 (next week would be week 6 of the block), or it is 3–4 and Workouts or Recovery was amber.
2. **PROGRESS** if Workouts, Nutrition and Recovery are all green.
3. Otherwise **HOLD**.

Fewer than 2 weigh-ins in history: HOLD (a DELOAD for illness, injury or travel still applies). After a DELOAD week, go back to HOLD at the values from before the deload.

`current.weeksSinceDeload` counts the training weeks completed since the last deload. It goes up by 1 each week; a DELOAD week resets it to 0 and sets `current.lastDeloadWeekOf`. build-plan.mjs updates both with `--save`.

## Changes (PROGRESS weeks only)

One change a week (`progression.maxChangesPerWeek`). Take turns in this order, starting after the item changed last time: **Monday → Thursday → Tuesday → step goal**. Skip an item that is maxed, whose heart-rate check failed, or (Tue/Thu) where Natalie swam. Within a day, follow its ladder (`progression.ladders`): move to the next lever only when the current one is at its limit.

| Item | Ladder | Flags |
|---|---|---|
| Mon HIIT | resistance +1 (up to +4) → level up (1–4) | `--res mon=+1`; `--level mon=2`. A level-up lowers resistance by 2 (`progression.levelUpResistanceDrop`) and sets the ride length from the level (30–35 min). |
| Thu tempo | level up (1–5) → resistance +1 (up to +4) | `--level thu=2` (ride length from the level, 35–45 min; resistance −2); then `--res thu=+1` |
| Tue cruise | +5 min (45–60) → resistance +1 (up to +4) | `--ride tue=50`; then `--res tue=+1`, only if the Tuesday check passed |
| Step goal | +500 (max 10,000) if last week's average steps beat the goal | `--steps 8000` |

Wed and Fri don't progress. When every item is maxed, a PROGRESS week has no ride change; say so in the summary.

Write the change as a `--note`, e.g. `--note "mon: +1 resistance on Max Effort intervals"` or `--note "Daily step goal 7,500 → 8,000"`.

## Strength (Tue and Thu finishers)

Adjustable pair, 5–50 lb in 5 lb steps (`strength`). Each exercise: 3 sets of 8–15 reps (per side for lunges, split squats and one-arm rows). These rules run every week except DELOAD and don't count toward the one-change limit.

- **Go up** one 5 lb step when every set reached 15 reps with 1–2 reps left, 2 sessions in a row. Restart at 8 reps.
- **Stall:** 3 sessions in a row with no added reps or weight → drop one 5 lb step and build the reps back up. A missed session isn't a stall.
- Stay between 5 and 50 lb.
- Save each exercise in `current.dumbbells`, e.g. `"gsq": { "lb": 20, "topStreak": 0, "stalls": 0 }`. The app shows these weights and never sends anything back. Each finisher is done once a week, so a session is a week. At the check-in Natalie answers two questions: any move where every set reached 15 reps with 1–2 left, and any move that felt too heavy, stopped improving or hurt. /weekly-checkin turns her answers into topStreak and stalls. A move too heavy for 8 clean reps drops 5 lb right away.
- Joint pain (not normal muscle effort): keep the weight, cut the reps, and skip the move if it continues.

## DELOAD

`build-plan.mjs --status DELOAD`:

- Tue and Thu: optional 20 min easy Zone 1 spin (`deload.title`), no finisher. Skip it if run down. Meals treat these as rest days.
- Mon, Wed and Fri: rides as usual, with resistance −2 on the work intervals (`deload.otherDaysResistanceOffset`, never below −3) and Monday HIIT at Level 1 (`deload.hiitLevel`).
- The saved values in training.json don't change, so the week after goes back to them (HOLD). The step goal stays the same.

## Calories (Natalie)

The check-in sets `kcalAdjust` in coach/profile.json; update-block.mjs adds it to the formula target, so the target keeps updating as weight drops. Never write `kcalOverride`: it freezes the target. If one is set, tell Natalie and ask before clearing it.

Judge by the 3-week trend, as % of body weight lost per week. Needs at least 3 weigh-ins.

- **Too slow:** lost less than 0.25% a week at each of the last 2 check-ins, with Nutrition 6/7 or better → `kcalAdjust` −100 (e.g. 0 → −100).
- **Too fast:** lost more than 0.8% a week at each of the last 2 check-ins → `kcalAdjust` +100.
- Otherwise leave it. If Nutrition was below 6/7, the focus is the meal plan, not calories.
- One change at a time, then wait 2 check-ins before another so the trend can catch up.
- The floor (`nutrition.minKcal`) always wins; update-block.mjs applies it.
- After a change, run `node coach/update-block.mjs` and record `nutrition.recalibration` in history: `{ "fromKcal": 1750, "toKcal": 1650, "kcalAdjust": -100, "reason": "..." }`.

## Safety

If Natalie reports chest pain, dizziness, palpitations, an injury or illness: stop plan changes, choose DELOAD and recommend she talk to her doctor.

Personal project, not medical advice.
