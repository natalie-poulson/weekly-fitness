---
description: Sunday check-in. Reviews the week, sets next week to PROGRESS, HOLD or DELOAD, writes plan.json and history.
---
# Weekly check-in

Follow CLAUDE.md and coach/RULES.md. Keep it to one question message, one summary and one OK.

## Dates (one convention)

- The check-in is on Sunday. The week reviewed is Monday–Sunday, ending today.
- coach/history.json: `weekOf` and `weighIn.date` are today's date (the Sunday), e.g. `2026-11-22`.
- plan.json: `weekOf` is tomorrow (the Monday the new plan starts), e.g. `2026-11-23`. Always pass it to build-plan.mjs with `--week`.
- Write every date as YYYY-MM-DD. If the check-in runs on another day, use the Sunday that ended the week for history and the Monday after it for the plan, and say so in the summary.

## 1. Gather the week

1. Read `coach/history.json`, `coach/profile.json`, `coach/targets.local.json`, `coach/training.json` and `plan.json` (what was scheduled, including any DELOAD days).
2. From the Garmin Connect MCP server, for Monday–Sunday:
   - activities (rides, swims, Pilates, strength) with time in each heart-rate zone, and whether each was finished;
   - daily steps, intensity minutes, Body Battery and Sleep Score;
   - daily resting heart rate for this week and the 4 weeks before (the baseline);
   - HRV status, if Garmin reports it;
   - this morning's weight, if it's in Garmin.
   If Garmin isn't connected, ask for: average daily steps, intensity minutes, average Body Battery, average Sleep Score, average resting heart rate, and the workouts done (rides, swims, Pilates classes, finishers). Heart-rate checks are then skipped, so those days can't progress this week (RULES.md).
3. Compare what Garmin logged with plan.json, day by day. Note anything planned but missing, and anything extra.
4. Ask in one message:
   - This morning's weigh-in, if Garmin doesn't have it. "Skipped" is fine: record `weighIn: null`.
   - Tuesday or Thursday: bike or swim? Ask only if Garmin is unclear (nothing logged, or an activity that isn't a ride or a swim). Otherwise use Garmin's activity type.
   - Any session done that isn't in Garmin (Pilates, finishers, a swim the watch missed)?
   - Finishers: any move where every set hit 15 reps with 1–2 to spare? Any move that felt too heavy, stopped improving, or hurt? ("Nope" is a full answer.)
   - Did you cut any Monday HIIT round or Thursday tempo block short?
   - How many days (0–7) you stayed on the meal plan.
   - Anything next week the plan should know about (travel, illness, injury, a heavy work week)? Any chest pain, dizziness, palpitations or joint pain?

## 2. Decide

Work through coach/RULES.md in this order.

1. Safety first. Chest pain, dizziness, palpitations, an injury or illness → DELOAD, no other changes, and recommend she talk to her doctor.
2. Signals: Weight, Workouts, Nutrition and Recovery, green or amber, using the RULES.md thresholds. Workouts = completed ÷ planned, where planned counts rides and swims as she chose them on Tue/Thu, plus Pilates and finishers.
3. Heart-rate checks for Mon, Tue and Thu (and drift on Wed/Fri), from Garmin's zones. Record each as pass, fail or skip (no data, or she swam).
4. Early easier-week triggers: resting HR 5+ bpm above the 4-week baseline on 3 or more days; HRV status low on 3 or more days (only if Garmin reports it); two hard sessions in a row not finished (this Monday and Thursday, or last Thursday and this Monday, so check last week's history).
5. Decision: DELOAD, PROGRESS or HOLD, exactly as in RULES.md, including the due check from `current.weeksSinceDeload` (5 → due; 3–4 and Workouts or Recovery amber → due). Fewer than 2 weigh-ins → HOLD, though a DELOAD for illness, injury or travel still applies.
6. Change (PROGRESS weeks only): one change. Find the item changed most recently (`coach.changed` in past weeks) and take the next one in the order Mon → Thu → Tue → steps. Skip an item that is maxed, failed its heart-rate check, or (Tue/Thu) where she swam. Within a day, follow `progression.ladders`.
   - Mon: `--res mon=+1`, then `--level mon=N` once resistance is at +4.
   - Thu: `--level thu=N`, then `--res thu=+1` once at level 5.
   - Tue: `--ride tue=N` (+5 min), then `--res tue=+1` once at 60 min, and only if the Tuesday check passed.
   - Steps: `--steps N`, only if last week's average beat the goal (+500, max 10,000).
   Use `--force` only to fix a mistake, never to make two changes.
7. Strength (not a ride change; every week except DELOAD). Each finisher move is done once a week (Workout A on Tue, Workout B on Thu), so a session is a week. Start from `current.dumbbells`; a move not there yet starts at the app's default weight with topStreak 0 and stalls 0 (gsq 20, fp 15, rl 10, row1 20, rdl 20, ohp 10, ssq 10, bor 15 lb). For each move whose finisher was done this week: named as "15 reps with 1–2 to spare" → topStreak +1 and stalls 0, and at topStreak 2 go up 5 lb (max 50) and set topStreak 0; named as stopped improving → stalls +1 and topStreak 0, and at stalls 3 drop 5 lb (min 5) and set stalls 0; named as too heavy (couldn't get 8 clean reps) → drop 5 lb now and set both to 0; named as hurting (joint pain, not normal muscle effort) → keep the weight, tell her to cut the reps, and suggest skipping the move if it continues; not named → topStreak 0 and stalls 0. A finisher that wasn't done changes nothing.
8. Calories (Natalie), only with at least 3 weigh-ins. For each of the last 2 check-ins, work out the weekly change of the 3-week trend: (previous trend − this trend) ÷ previous trend × 100.
   - Below 0.25% both times, with Nutrition 6/7 or better → kcalAdjust −100.
   - Above 0.8% both times → kcalAdjust +100.
   - Otherwise no change, and no change if one was made at either of the last 2 check-ins (`nutrition.recalibration`).
   - Never write `kcalOverride`. If one is set in profile.json, tell Natalie and ask before clearing it.
   Run `node coach/stats.mjs` if you want the trend numbers.

## 3. Show the summary

```
Week of <Mon date>–<Sun date>: <DECISION>
Weight <±x.x lb 3-week trend, x.xx%/wk> · Workouts <done>/<planned> · Nutrition <n>/7 · Recovery <Body Battery> / <Sleep Score>
Heart rate: Mon <pass/fail/skip> · Tue <…> · Thu <…> · resting HR <avg> (baseline <avg>)
Next week: <the change, or "No changes">
Strength: <e.g. "Goblet squat 20 → 25 lb", or "No changes">
Calories: <"No change", or "1,750 → 1,650 (kcalAdjust −100)">
Easier week: <"week N since the last one", or "this is an easier week">
Your focus: <one concrete thing to do>
```

Then ask: "Reply OK to save, or tell me what to change."

## 4. Save (only after OK)

1. Append the week to `coach/history.json` (format in coach/README.md), with `weekOf` = today (the Sunday):
   - `weighIn`: { date, lbs }, or null
   - `sessions.planned` (rides and swims split by her Tue/Thu choice, Pilates, finishers) and `sessions.completed`
   - `garmin`: avgSteps, stepGoal, intensityMin, avgBodyBattery, avgSleepScore, avgRestingHr, restingHrBaseline
   - `hr`: { mon, tue, thu }, each "pass", "fail" or "skip"; `hardNotFinished`: the days cut short (e.g. ["thu"])
   - `choices`: { tue, thu }, from Garmin's activity type, or her answer if Garmin was unclear
   - `nutrition`: daysOnPlan, kcalTarget, proteinTargetG, recalibration (or null)
   - `coach`: decision, next, focus, changed ("mon", "thu", "tue", "steps" or null)
   Never rewrite past weeks unless Natalie asks.
2. If calories changed: set `kcalAdjust` for Natalie in coach/profile.json and add `nutrition.recalibration`: { fromKcal, toKcal, kcalAdjust, reason }.
3. Strength: update `current.dumbbells` in coach/training.json for each exercise, { lb, topStreak, stalls }, before building the plan (build-plan.mjs keeps them when it saves). The app shows these weights after the push.
4. Build next week: `node coach/build-plan.mjs --status <DECISION> --week <Monday> [one change flag] --headline "<one line>" [--note "day: text"] --save`. Use `--dry-run` first if unsure. Notes clear automatically when there's no change. If the week is a DELOAD for any reason other than being due, say why in the headline. Show its output, including the easier-week counter.
5. Run `node coach/update-block.mjs` so the targets and training days for next week (including easier-week rest days) are ready for the meal plan. Check the new calorie target if it changed.
6. Run `node coach/encrypt.mjs` directly (it reads the passcode privately from macOS Keychain `"heartplan-vault"` without printing or exposing it, and reuses the existing salt so her iPhone stays unlocked). If it exits saying Keychain isn't set up yet, ask Natalie to run `node coach/encrypt.mjs --save-keychain` once in a second Terminal tab and wait for "done".
7. Run `git status`. If profile.json, history.json or any .local. file is listed, stop (see Quick fixes in SETUP-GUIDE.md).
8. Show the push line and run it if she says "Go ahead":
   `git add plan.json history.enc coach/training.json && git commit -m "Weekly check-in <Sunday date>" && git push`
9. Ask: "Ready to plan meals?" If yes, run /meal-plan.
