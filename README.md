# Heart Health Plan

A personal indoor-cycling and strength plan for iPhone, hosted on GitHub Pages:
https://natalie-poulson.github.io/weekly-fitness/

- **Workouts tab**: today's ride with a live, color-coded player (cadence, resistance, zone), a header refresh button, the Bike/Swim choice on Tue/Thu, Reformer Pilates days and the dumbbell finishers (with a built-in 75s rest timer).
- **Progress tab**: weight trend, exercise and nutrition consistency and the Coach's weekly take. The data is encrypted (`history.enc`) and needs your passcode.
- **Weekly Coach**: every Sunday morning, Claude Code runs `/weekly-checkin`, sets next week to PROGRESS, HOLD or DELOAD and writes `plan.json`, then `/meal-plan` plans the week's meals.

## Files

| Path | Public? | What it is |
|---|---|---|
| `index.html`, `style.css`, `app.js` | yes | The app |
| `plan.json` | yes | This week's plan, written by `coach/build-plan.mjs` |
| `history.enc` | yes (encrypted) | Your progress, written by `coach/encrypt.mjs` |
| `CLAUDE.md`, `.claude/commands/` | yes | Instructions and slash commands for Claude Code |
| `coach/*.mjs`, `coach/*.md`, `coach/training.json`, `coach/history.example.json` | yes | Coach scripts, rules and settings |
| `coach/profile.json`, `coach/history.json`, `coach/*.local.json` | **no** | Private data, blocked by `.gitignore` |

Setup and the weekly routine: see [SETUP-GUIDE.md](SETUP-GUIDE.md).

Personal project, not medical advice.
