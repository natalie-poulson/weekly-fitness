# Health Plan · Setup Guide

For: Natalie | Repo: natalie-poulson/weekly-fitness | First check-in: Sunday morning, Nov 22

Parts 1–3 are one-time setup (about an hour). Part 4 is your weekly routine (about 30 minutes on Sunday morning, meal planning included). Commands go in the Terminal app on your Mac, run from inside your repo folder unless noted.

## What goes where

| Goes on GitHub (public) | Stays on your laptop only (blocked by .gitignore) |
|---|---|
| index.html, style.css, app.js, plan.json, LICENSE, README.md, .gitignore, SETUP-GUIDE.md | coach/profile.json: stats, goal weight and targets for you and B |
| CLAUDE.md and .claude/commands/ (weekly-checkin, meal-plan, meal-swap, good-eggs) | coach/history.json: your weigh-ins and weekly results |
| coach/RULES.md, README.md, CLAUDE-SETUP.md, stats.mjs, build-plan.mjs, update-block.mjs, check-meals.mjs, encrypt.mjs, training.json, history.example.json (fake data) | coach/meal-prefs.local.json: food rules, staples, meal timing |
| history.enc (encrypted, safe to publish) | coach/meal-history.local.json and coach/targets.local.json |

## Part 1 · Get the files onto your laptop (15 min)

You need: a GitHub account with the weekly-fitness repo, Git, Node.js 18 or newer, and Python 3. Check with `node --version` and `python3 --version`.

1. Get your repo on the laptop (skip if it's already there): `cd ~/Documents` → `git clone https://github.com/natalie-poulson/weekly-fitness.git` → `cd weekly-fitness`
2. Copy all the new files in, replacing the old ones. Hidden items count: make sure `.gitignore` and the `.claude` folder come along (in Finder, Cmd + Shift + . shows hidden files).
3. Before any commit, check the private files are blocked:
   `git check-ignore -v coach/profile.json coach/history.json coach/meal-prefs.local.json coach/meal-history.local.json coach/targets.local.json`
   All five lines must print. If any is missing, stop and fix `.gitignore` first.

## Part 2 · Fill in, test locally, then publish (25 min)

1. Confirm your first weigh-in: `coach/profile.json` and `coach/history.json` already have `148.8` lb on `2026-11-15`; update the date or weight in `coach/history.json` only if your actual first Sunday reading differed.
2. Dry-run the scripts: `node coach/build-plan.mjs --dry-run` (expect 5 rides · HOLD · steps 7,500), then `node coach/update-block.mjs` (kcal, protein, fiber, saturated fat and sodium for you and B, plus each day's hard/easy tag), then `node coach/stats.mjs`.
3. Test Progress with fake data: `node coach/encrypt.mjs --in coach/history.example.json` with a test passcode (12+ plain keyboard characters, e.g. three random words like cedar-lamp-otter). Then `python3 -m http.server 8000` and open http://localhost:8000. Tap through the days, start a ride, check the finisher weights show in 5 lb steps, and unlock Progress (a wrong passcode should show an error). Optional: `heartplanSelfTest()` in the browser console returns "OK". Ctrl + C stops the server.
4. Create your real encrypted history and save the passcode to macOS Keychain: `node coach/encrypt.mjs --save-keychain` with your real passcode (12+ plain keyboard characters). Saving it to macOS Keychain (`heartplan-vault`) lets Sunday check-ins encrypt `history.enc` automatically in one tab without Claude ever seeing your passcode, and also keep a backup copy in your password manager. This copies your goal weight from profile.json into history.
5. Check what's about to be published: `git status`. You must NOT see profile.json, history.json or any .local. file.
6. Publish: `git add -A` → `git status` (one last look) → `git commit -m "Coach upgrade"` → `git push`.
7. Turn on GitHub Pages if needed: repo → Settings → Pages → Deploy from a branch → main / (root) → Save. Wait 1–2 minutes.

## Part 3 · Phone, Garmin and Claude Code (20 min)

1. iPhone: open https://natalie-poulson.github.io/weekly-fitness/ in Safari → Share → Add to Home Screen. Unlock Progress with your real passcode; you should see your first weigh-in and the 125 lb goal line.
2. Garmin Lily 2, this week: start each swim, Pilates class and finisher from the watch, then check what shows up in Garmin Connect. Your HRV Status card is there too; the coach uses it, with resting heart rate, for the early easier-week rule. Anything Garmin doesn't log is asked at the check-in instead.
3. Install Claude Code, then run `claude` inside your repo folder. It reads CLAUDE.md automatically.
4. Connect the tools with `claude mcp add`, following each project's README: Paprika (bojanrajkovic/mcp-paprika), NYT Cooking (bramboe/nyt-cooking-mcp) and a Garmin Connect MCP server. Allow web search when asked. Type `/mcp` inside Claude to confirm. Details in coach/CLAUDE-SETUP.md.
5. Tell Claude if B is more active than "desk job + light activity" so it can recalculate his targets.

## Part 4 · Every week

| When | You do | Where |
|---|---|---|
| Sunday morning | Weigh in: after the bathroom, before food or drink, same scale | Scale / Garmin Connect |
| Sun morning | `cd ~/Documents/weekly-fitness` → `claude` → `/weekly-checkin`. Answer the one question message: weigh-in, days on the meal plan, anything coming up, and the two finisher questions (any move at 15 reps with 1–2 to spare? any move too heavy, stalled or hurting?). Bike vs swim comes from Garmin. Read the summary, reply OK, then say "Go ahead" to encrypt (via macOS Keychain) and push | Claude Code |
| Sun morning | `/meal-plan` follows straight on: answer office days, nights out, swims and holidays. Review the week, ask for swaps, then "looks good". Claude fills every planned slot in the Paprika planner (breakfasts/smoothies, lunches, dinners, pre-ride snacks, and daily snacks), puts portions in recipe Notes, and adds to your Groceries list | Claude Code → Paprika |
| Sunday | Fish market for the early-week fish meals; shop the rest from Paprika Groceries | Paprika |
| Mon–Fri | Open the app (tap `↻` in the header after a push) → today's tab → Start ride. Use the built-in 75s rest timer during finishers. Check Paprika for meals and snack portions | iPhone |
| Mid-week / tired week | `/meal-swap` to change a meal; `/good-eggs` for kit or prepared-meal suggestions (never orders) | Claude Code |

You never log workouts, food or heart rate on the phone. Once you unlock Progress on your iPhone, it stays unlocked across weekly Sunday pushes unless you tap Lock / Clear Key or rotate your passcode (`--new-salt`).

## Quick fixes

| Problem | Fix |
|---|---|
| App says "Couldn't load plan.json" | Check the push on github.com, wait 2 minutes, reopen the app |
| Old workouts or progress still showing | Tap the `↻` refresh button in the top-right header (or close and reopen the app) |
| Progress says "No progress yet" | history.enc wasn't pushed: run `node coach/encrypt.mjs`, then push |
| Passcode rejected but you're sure | You likely re-encrypted with a different one: run `node coach/encrypt.mjs` again and push |
| encrypt.mjs says "at least 12 characters" or "plain keyboard characters" | Use 3 random words joined by hyphens; no emoji, accents or curly quotes |
| Goal line missing or wrong on Progress | Check goalWeightLb in coach/profile.json, then run `node coach/encrypt.mjs` and push |
| git status shows profile.json or history.json | Don't commit. Recopy .gitignore and rerun Part 1, step 3 |

Personal project, not medical advice.
