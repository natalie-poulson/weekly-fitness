# Heart Health Plan

A small, dependency-free web app that turns a weekly heart-health routine into a phone-friendly daily checklist, with a built-in interval timer for stationary-bike rides.

No build step, no framework, no server. Plain HTML, CSS and JavaScript.

## Features

- **Today view** – step through the week day by day, with the workout, heart-rate zone and focus for each.
- **Ride timer** – generates segmented bike workouts (HIIT, Zone 2 cruise, tempo, steady base, pre-Pilates warm-up) for any duration from 10 to 90 minutes, with cadence and resistance targets for each segment.
  - Audio beeps, vibration and a screen flash on every segment change
  - Pause, resume, skip and go back by segment
  - Easier / default / harder resistance offsets
  - Screen wake lock while riding
  - A ride in progress survives a page reload
- **Dumbbell finishers** – two supersets with simple drawings, cues, adjustable weights (remembered between weeks) and links to form videos.
- **Week view** – weekly targets, check-offs per day, and a reset button. Check-offs reset automatically each Monday.
- Everything is stored in your browser's `localStorage`. Nothing is sent anywhere.

## Run it

Open `index.html` in a browser. That's it.

Or serve the folder locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

### Host it on GitHub Pages

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and `/ (root)`, and save.
4. Your app will be live at `https://<your-username>.github.io/<repo-name>/`.

On a phone, open that URL and use **Share → Add to Home Screen** for an app-like experience.

## Project layout

| File | Purpose |
| --- | --- |
| `index.html` | Page shell and tab bar |
| `style.css` | All styling (dark theme, mobile-first) |
| `app.js` | Plan data, ride generator, timer, rendering, state |

## Customizing

All plan data lives at the top of `app.js`:

- `PLAN` – the seven days (zone, focus, text, options)
- `FIN` – dumbbell exercises, default weights, cues and video search terms
- `FIG` – the inline SVG exercise drawings
- `GEN` – the ride generators, one per ride type
- `TYPES` / `DIFF` – ride types, default lengths and difficulty offsets

The lap-swim hours and pool names (`HOURS_TT`, `FOOT`, and the table in `renderWeek`) are specific to Berkeley, CA. Edit or remove them to suit your area.

### Self-test

Open the browser console and run:

```js
heartplanSelfTest()
```

It checks that every generated ride sums to its target duration, has no empty segments, never repeats a color on adjacent segments, and that every exercise has a drawing. It returns `"OK"` or a list of problems.

## Disclaimer

This is a personal project and **not medical advice**. Talk to your doctor before starting or changing an exercise program, especially if you have a heart condition or other health concerns.

## License

[MIT](LICENSE)
