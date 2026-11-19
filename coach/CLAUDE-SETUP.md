# Claude Code setup (Part 3)

## 1. Install and start

Install Claude Code using Anthropic's current instructions. Then:

```
cd ~/Documents/weekly-fitness
claude
```

Claude reads `CLAUDE.md` automatically. The slash commands in `.claude/commands/` show up as `/weekly-checkin`, `/meal-plan`, `/meal-swap` and `/good-eggs`.

## 2. Connect the tools

Add each server with `claude mcp add`, using the exact command and settings from that project's README. The general shape is:

```
claude mcp add <name> -- <command from the README>
```

| Tool | Project | Used for |
|---|---|---|
| Paprika | bojanrajkovic/mcp-paprika | Recipe library, meal planner, recipe Notes, the default Groceries list |
| NYT Cooking | bramboe/nyt-cooking-mcp | Recipe search and your saved favorites |
| Garmin Connect | any Garmin Connect MCP server that returns activities with heart-rate zones and activity type, daily steps, intensity minutes, resting heart rate, HRV status, Body Battery and Sleep Score | The weekly check-in |

Allow web search when Claude asks (used by `/good-eggs` and for recipe sources). Type `/mcp` inside Claude to confirm every server shows as connected.

Accounts and passwords for these services go only where each README says (usually environment variables or the MCP config). Never put them in this repo.

## 3. Until Garmin is connected

`/weekly-checkin` asks for 6 numbers from the Garmin Connect app: average daily steps, intensity minutes, average Body Battery, average Sleep Score, average resting heart rate, and the workouts done (rides, swims, Pilates classes, finishers). Heart-rate checks are skipped those weeks, so Mon, Tue and Thu can't progress (RULES.md).

## 4. Check your private files

1. `coach/profile.json`: already filled in for you and B. Run `node coach/update-block.mjs` and check the targets it prints.
2. `coach/history.json`: your first weigh-in and goals. Check that the weigh-in date is the day you actually weighed in.
3. `coach/meal-prefs.local.json`: replace any approximate staple values with the numbers from your own package labels.
4. `coach/meal-history.local.json`: starts as an empty list; /meal-plan fills it.
5. If B is more active than "desk job + light activity", tell Claude so it can update his activity and recalculate his targets.
