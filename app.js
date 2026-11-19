/* Heart Health Plan · app.js
   Reads ./plan.json (this week, written by coach/build-plan.mjs), ./coach/training.json (public; only the
   Coach's dumbbell weights in current.dumbbells are used) and ./history.enc (progress, encrypted by
   coach/encrypt.mjs). Formats: coach/README.md.
   The phone only reads: nothing is logged or sent back. Garmin records the workouts (bike vs swim included),
   and the Sunday check-in asks two quick finisher questions; the Coach then saves new weights in
   training.json, which this app shows after the push. */
(function () {
'use strict';
const $ = id => document.getElementById(id);
const KEYS = ['mon','tue','wed','thu','fri','sat','sun'];
const SKEY = 'heartplan.week.v5', CKEY = 'heartplan.coach.v2', SNDKEY = 'heartplan.sound', HKEY = 'heartplan.hint';
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
function lsJson(k) { try { const v = JSON.parse(lsGet(k)); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
['heartplan.weights', 'heartplan.v3', 'heartplan.week.v4', 'heartplan.coachLb'].forEach(lsDel);   // old phone-side weights and logs: no longer used

/* ================= Workout content ================= */
const HOURS_TT = { king: '7:30a–12:30p · 6:30–8p*', west: '8a–1p · 5:30–7p' };
const FOOT = '*Limited lanes. Buy passes in advance via the City of Berkeley Online Rec Catalog. No payment on deck.';

/* Dumbbell finishers: Core Home Fitness pair, 5–50 lb in 5 lb steps, 3 × 8–15 reps (coach/training.json → strength).
   w = starting weight until the Coach saves one in current.dumbbells. */
const LB_MIN = 5, LB_MAX = 50, LB_STEP = 5;
const FIN = {
  tue: { title:'Workout A', ex:[
    { id:'gsq',  g:'A', name:'Goblet Squat',      sets:3, reps:'8–15',         per:'1 dumbbell', w:20, q:'dumbbell goblet squat form', cue:'Hold one end at your chest. Sit down between your heels, chest tall.' },
    { id:'fp',   g:'A', name:'Floor Press',       sets:3, reps:'8–15',         per:'each hand',  w:15, q:'dumbbell floor press form', cue:'Lie on the floor, elbows at 45°. Lower until upper arms touch, press up.' },
    { id:'rl',   g:'B', name:'Reverse Lunge',     sets:3, reps:'8–15 per leg', per:'each hand',  w:10, q:'dumbbell reverse lunge form', cue:'Step back, back knee toward the floor, drive through the front heel.' },
    { id:'row1', g:'B', name:'One-Arm Row',       sets:3, reps:'8–15 per arm', per:'1 dumbbell', w:20, q:'one arm dumbbell row form', cue:'Hand on a chair, feet staggered. Pull elbow to hip, back flat.' }
  ]},
  thu: { title:'Workout B', ex:[
    { id:'rdl',  g:'A', name:'Romanian Deadlift', sets:3, reps:'8–15',         per:'each hand',  w:20, q:'dumbbell romanian deadlift form', cue:'Soft knees, push hips back, weights slide down your thighs. Back flat.' },
    { id:'ohp',  g:'A', name:'Overhead Press',    sets:3, reps:'8–15',         per:'each hand',  w:10, q:'standing dumbbell overhead press form', cue:'Standing, ribs down, glutes tight. Press straight up without arching.' },
    { id:'ssq',  g:'B', name:'Split Squat',       sets:3, reps:'8–15 per leg', per:'each hand',  w:10, q:'dumbbell split squat form', cue:'Staggered stance, drop straight down. Front knee tracks over toes.' },
    { id:'bor',  g:'B', name:'Bent-Over Row',     sets:3, reps:'8–15',         per:'each hand',  w:15, q:'dumbbell bent over row form', cue:'Hinge to about 45°, pull both elbows back, squeeze shoulder blades.' }
  ]}
};
const GROUND = '<path class="g" d="M5 54H55"/>';
function hd(x, y) { return '<circle class="h" cx="' + x + '" cy="' + y + '" r="4"/>'; }
const FIG = {
  gsq:  hd(26,13) + '<path d="M26 18L23 33L35 35L33 52L39 52"/><path d="M25 21L32 27"/><path class="d" d="M33 21L33 29"/><path class="a" d="M47 14V30M43 26L47 30L51 26"/>',
  fp:   hd(10,50) + '<path d="M14 51L32 51"/><path d="M32 51L40 40L46 53"/><path d="M17 50L17 31"/><path class="d" d="M13 29L21 29"/><path class="a" d="M28 42V26M24 30L28 26L32 30"/>',
  rl:   hd(30,14) + '<path d="M30 19L30 34"/><path d="M30 34L41 35L41 53L46 53"/><path d="M30 34L21 50L11 53"/><path d="M30 21L33 33"/><path class="d" d="M29 35L37 35"/><path class="a" d="M24 9H10M14 5L10 9L14 13"/>',
  row1: '<path class="b" d="M40 36H52M50 36V54M42 36V54"/>' + hd(36,23) + '<path d="M18 30L32 26"/><path d="M18 30L14 53M18 30L24 53"/><path d="M32 27L42 36"/><path d="M30 27L30 40"/><path class="d" d="M26 42L34 42"/><path class="a" d="M8 44V30M4 34L8 30L12 34"/>',
  rdl:  hd(37,20) + '<path d="M20 26L33 22"/><path d="M20 26L24 40L22 53L28 53"/><path d="M31 23L31 42"/><path class="d" d="M27 44L35 44"/><path class="a" d="M22 14Q14 14 12 22M9 19L12 22L15 19"/>',
  ohp:  hd(30,12) + '<path d="M30 16L30 34"/><path d="M30 34L24 53M30 34L36 53"/><path d="M22 19H38"/><path d="M22 19L20 8M38 19L40 8"/><path class="d" d="M16 6L24 6M36 6L44 6"/><path class="a" d="M52 28V14M48 18L52 14L56 18"/>',
  ssq:  hd(30,14) + '<path d="M30 19L30 34"/><path d="M30 34L40 36L40 53L45 53"/><path d="M30 34L22 49L13 53"/><path d="M30 21L32 33"/><path class="d" d="M28 35L36 35"/><path class="a" d="M50 14V28M46 24L50 28L54 24"/>',
  bor:  hd(37,15) + '<path d="M22 30L33 18"/><path d="M22 30L26 41L24 53L30 53"/><path d="M32 19L32 36"/><path class="d" d="M28 38L36 38"/><path class="a" d="M44 40V26M40 30L44 26L48 30"/>'
};
function ytUrl(q) { return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q); }

const TYPES = {
  hiit:   { name:'HIIT Engine',         min:30, range:'30–35 min', day:'Mon' },
  cruise: { name:'Zone 2 Cruise',       min:45, range:'45–60 min', day:'Tue' },
  warm:   { name:'Pre-Pilates Warm-up', min:20, range:'20–30 min', day:'Wed' },
  tempo:  { name:'Tempo Burn',          min:35, range:'35–45 min', day:'Thu' },
  base:   { name:'Steady Base Spin',    min:25, range:'20–30 min', day:'Fri' },
  easy:   { name:'Easy Spin',           min:20, range:'20 min',    day:'Easier week', hidden:true }
};
const EASY_MIN = 20;   // coach/training.json → deload.text: optional 20 min Zone 1 spin
/* Mirrors coach/training.json → rideTypes.hiit.levels and rideTypes.tempo.levels. Change both together. */
const LEVELS = {
  hiit:  { 1:{ rounds:4, work:3, easy:3, min:30 }, 2:{ rounds:4, work:3, easy:2, min:30 }, 3:{ rounds:5, work:3, easy:2, min:35 }, 4:{ rounds:4, work:4, easy:2, min:35 } },
  tempo: { 1:{ blocks:1, work:15, easy:3, min:35 }, 2:{ blocks:2, work:10, easy:3, min:35 }, 3:{ blocks:2, work:12, easy:3, min:40 },
           4:{ blocks:3, work:10, easy:3, min:45 }, 5:{ blocks:2, work:15, easy:3, min:45 } }
};
const DIFF = { easy:{ name:'Easier', off:-3 }, norm:{ name:'Plan default', off:0 }, hard:{ name:'Harder', off:4 } };
const SEGPAL = { z1:['#7dd3fc','#a78bfa'], z2:['#34d399','#a3e635'], z34:['#fbbf24','#fb923c'], z5:['#f87171','#f472b6'] };

function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
function fmt(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function rng(r) { return r[0] + '–' + r[1]; }
function todayIdx() { return (new Date().getDay() + 6) % 7; }
function zoneKey(z) { if (/5/.test(z)) return 'z5'; if (/[34]/.test(z)) return 'z34'; if (z === 'Zone 2') return 'z2'; return 'z1'; }
function zoneColor(z) { return 'var(--' + zoneKey(z) + ')'; }
function colorize(segs) { let prev = null; segs.forEach(s => { const p = SEGPAL[zoneKey(s.zone)]; s.color = (p[0] === prev) ? p[1] : p[0]; prev = s.color; }); return segs; }

function S(name, min, cad, res, zone, cue, cool) { return { name, sec:min * 60, cad, res, zone, cue, cool:!!cool }; }
function split(total, n) { const b = Math.floor(total / n), r = total % n, out = []; for (let i = 0; i < n; i++) out.push(b + (i < r ? 1 : 0)); return out; }
function warmBlock(m) {
  if (m <= 0) return [];
  if (m < 4) return [S('Warm-up', m, [80,90], [22,27], 'Zone 1', 'Easy flat road. Loosen up.')];
  return [S('Warm-up', m - 2, [80,90], [22,27], 'Zone 1', 'Easy flat road. Loosen up, settle your breathing.'),
          S('Build', 2, [88,95], [25,30], 'Zone 2', 'Lift cadence, add a few clicks. Prime heart and legs.')];
}
function coolBlock(m) { return m > 0 ? [S('Cool Down', m, [75,85], [18,24], 'Zone 1', 'Spin it out. Let your heart rate fall.', true)] : []; }
/* Each generator takes the ride length in minutes and, for HIIT and tempo, the level from plan.json.
   With a level that fits the length, the ride follows the level; otherwise it is built from the length alone. */
const GEN = {
  hiit(D, lv) {
    const L = LEVELS.hiit[lv];
    if (L) {
      const left = D - L.rounds * (L.work + L.easy);
      if (left >= 4) {
        const cd = clamp(Math.round(left * 0.35), 2, 5), s = warmBlock(left - cd);
        for (let i = 1; i <= L.rounds; i++) {
          s.push(S('Max Effort ' + i + '/' + L.rounds, L.work, [85,95], [45,52], 'Zone 5', 'Seated, strong and steady for ' + L.work + ' min. Empty the tank in the last 30s.'));
          s.push(S('Easy Spin ' + i + '/' + L.rounds, L.easy, [80,90], [22,27], 'Zone 1-2', 'Flat road. Drop resistance, deep breaths, let heart rate recover.'));
        }
        return s.concat(coolBlock(cd));
      }
    }
    const r = clamp(Math.floor((D - 4) / 6), 1, 8), left = D - 6 * r;
    const cd = clamp(Math.round(left * 0.2), 1, 5), wu = Math.min(left - cd, 8), extra = left - cd - wu;
    const s = warmBlock(wu);
    for (let i = 1; i <= r; i++) {
      const easyMin = (i === r && cd === 1) ? 2 : 3;
      s.push(S('Max Effort ' + i + '/' + r, 3, [85,95], [45,52], 'Zone 5', 'Seated, strong and steady for 3 min. Empty the tank in the last 30s.'));
      s.push(S('Easy Spin ' + i + '/' + r, easyMin, [80,90], [22,27], 'Zone 1-2', 'Flat road. Drop resistance, deep breaths, let heart rate recover.'));
    }
    if (extra > 0) s.push(S('Zone 2 Settle', extra, [85,95], [26,31], 'Zone 2', 'Steady and conversational.'));
    return s.concat(coolBlock(cd === 1 ? 2 : cd));
  },
  cruise(D) {
    const wu = D >= 25 ? 5 : 3, cd = D >= 25 ? 5 : 2, main = D - wu - cd, n = Math.max(1, Math.round(main / 5));
    const mid = split(main, n).map((m, i) => i % 2 === 0
      ? S('Cruise · Quick Legs', m, [85,95], [26,31], 'Zone 2', 'Conversational pace. Light, quick pedal stroke.')
      : S('Cruise · Road Feel', m, [78,86], [28,33], 'Zone 2', 'A bit more road under you. Still able to talk.'));
    return warmBlock(wu).concat(mid, coolBlock(cd));
  },
  warm(D) {
    const a = Math.round(D * 0.25), b = Math.round(D * 0.35), c = Math.round(D * 0.25), d = D - a - b - c;
    return [S('Easy Spin', a, [80,90], [22,27], 'Zone 1', 'Loosen hips and ankles. No effort yet.'),
            S('Build 1', b, [85,95], [24,28], 'Zone 1-2', 'Light sweat, smooth pedal stroke.'),
            S('Build 2', c, [85,95], [26,30], 'Zone 2', 'Warm core and glutes. No leg burn.'),
            S('Ease Into Pilates', d, [75,85], [18,24], 'Zone 1', 'Flush the legs and bring HR down. Head to Reformer class.', true)
           ].filter(s => s.sec > 0);
  },
  tempo(D, lv) {
    const L = LEVELS.tempo[lv];
    if (L) {
      const left = D - (L.blocks * L.work + (L.blocks - 1) * L.easy);
      if (left >= 4) {
        const cd = clamp(left - 4, 2, 5), wu = Math.min(10, left - cd), settle = left - cd - wu, mid = [];
        if (settle > 0) mid.push(S('Zone 2 Settle', settle, [85,95], [26,31], 'Zone 2', 'Steady and conversational before the tempo work.'));
        for (let i = 1; i <= L.blocks; i++) {
          mid.push(S(L.blocks > 1 ? 'Tempo ' + i + '/' + L.blocks : 'Tempo', L.work, [80,90], [34,41], 'Zone 3-4', 'Comfortably hard. Short phrases only. Hold it steady for ' + L.work + ' min.'));
          if (i < L.blocks) mid.push(S('Recover ' + i + '/' + (L.blocks - 1), L.easy, [85,95], [24,29], 'Zone 2', 'Ease off, keep the legs moving.'));
        }
        return warmBlock(wu).concat(mid, coolBlock(cd));
      }
    }
    let wu = D >= 25 ? 5 : 3; const cd = D >= 25 ? 5 : 2, main = D - wu - cd, mid = [];
    if (main < 8) { if (main > 0) mid.push(S('Tempo', main, [80,90], [34,41], 'Zone 3-4', 'Comfortably hard. Short phrases only.')); }
    else {
      const r = Math.floor(main / 8); wu += main - 8 * r;
      for (let i = 1; i <= r; i++) {
        mid.push(S('Tempo ' + i + '/' + r, 6, [80,90], [34,41], 'Zone 3-4', 'Comfortably hard. Short phrases only.'));
        mid.push(S('Recover ' + i + '/' + r, 2, [85,95], [24,29], 'Zone 2', 'Ease off, keep the legs moving.'));
      }
    }
    return warmBlock(wu).concat(mid, coolBlock(cd));
  },
  base(D) {
    const su = D >= 20 ? 3 : 2, tr = D >= 20 ? 2 : 1, main = D - su - tr, n = Math.max(1, Math.ceil(main / 10));
    const mid = split(main, n).map((m, i) => i % 2 === 0
      ? S('Steady Base ' + (i + 1) + '/' + n, m, [85,92], [26,31], 'Zone 2', 'Steady and conversational. Smooth, quick rhythm.')
      : S('Steady Base ' + (i + 1) + '/' + n, m, [80,88], [28,33], 'Zone 2', 'Add 2 clicks of road feel. Even pressure, easy breathing.'));
    return [S('Spin-up', su, [80,90], [23,28], 'Zone 1', 'Easy legs, find your rhythm.')]
      .concat(mid, [S('Transition', tr, [75,85], [18,24], 'Zone 1', 'Flush the legs, ease off and head to Pilates.', true)]);
  },
  /* Easier-week Tue/Thu: optional, all Zone 1, no finisher. */
  easy(D) {
    const wu = D >= 10 ? 3 : 1, cd = D >= 10 ? 2 : 1;
    return [S('Easy Spin-up', wu, [80,90], [18,24], 'Zone 1', 'Light legs, no pressure.'),
            S('Easy Zone 1', D - wu - cd, [80,90], [18,24], 'Zone 1', 'Conversational, low resistance. This is recovery, not training.'),
            S('Cool Down', cd, [75,85], [15,20], 'Zone 1', 'Spin it out.', true)].filter(s => s.sec > 0);
  }
};

/* ================= plan.json ================= */
function applyAdjust(segs, adj) {
  if (!adj) return segs;
  return segs.map(s => (!s.cool && s.name.indexOf(adj.segment) === 0) ? Object.assign({}, s, { res: s.res.map(v => clamp(v + adj.resistance, 0, 100)) }) : s);
}
const fromPlanSeg = s => ({ name:s.name, sec:s.sec, cad:s.rpm.slice(), res:s.res.slice(), zone:s.zone, cue:s.cue, cool:!!s.cool });
async function loadPlan() {
  const res = await fetch('./plan.json?t=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const p = await res.json();
  if (!p || !Array.isArray(p.days)) throw new Error('plan.json has no days');
  p.days.sort((a, b) => KEYS.indexOf(a.key) - KEYS.indexOf(b.key));
  if (p.days.length !== 7 || !KEYS.every((k, i) => p.days[i].key === k)) throw new Error('plan.json needs mon–sun');
  p.calibration = p.calibration || {};
  if (!Array.isArray(p.calibration.adjustments)) p.calibration.adjustments = [];
  p.days.forEach(d => {
    if (d.ride && !GEN[d.ride.type]) delete d.ride;
    if (!d.ride) return;
    if (!(d.ride.minutes > 0)) d.ride.minutes = TYPES[d.ride.type].min;
    if (d.ride.level != null && !(LEVELS[d.ride.type] && LEVELS[d.ride.type][d.ride.level])) delete d.ride.level;
  });
  return p;
}

/* ================= Week state: only which screen to show on Tue/Thu (bike or swim). Never sent anywhere. ================= */
function fresh(weekOf) { return { weekOf: weekOf || null, swap: { tue:null, thu:null } }; }
function loadState(weekOf) {
  const s = lsJson(SKEY), f = fresh(weekOf);
  if (!s || s.weekOf !== weekOf) return f;
  ['tue', 'thu'].forEach(k => { const v = s.swap && s.swap[k]; f.swap[k] = (v === 'swim' || v === 'bike') ? v : null; });
  return f;
}
function save() { lsSet(SKEY, JSON.stringify(state)); }
let state = fresh(null);

/* ================= Dumbbell weights from the Coach (coach/training.json → current.dumbbells) =================
   Kept on the phone so they show offline. "at" = the plan week in which the Coach changed the weight,
   so the finisher card can show "↑ was 15 lb" for that week. */
function normLb(v) { v = +v; if (!(v > 0)) return null; return clamp(Math.floor(v / LB_STEP) * LB_STEP, LB_MIN, LB_MAX); }
function findEx(id) { return FIN.tue.ex.concat(FIN.thu.ex).find(e => e.id === id) || null; }
let coachSeen = lsJson(CKEY) || {};
function wOf(ex) { const s = coachSeen[ex.id]; return (s && normLb(s.lb)) || ex.w; }
function fmtW(v) { return v + ' lb'; }
function changedThisWeek(id) { const s = coachSeen[id]; return s && s.prev != null && s.prev !== s.lb && PLAN && s.at === PLAN.weekOf ? s : null; }
async function loadCoach() {
  try {
    const res = await fetch('./coach/training.json?t=' + Date.now(), { cache:'no-store' }); if (!res.ok) return;
    const T = await res.json(), D = T && T.current && T.current.dumbbells; if (!D || typeof D !== 'object') return;
    let changed = false;
    Object.keys(D).forEach(id => {
      const v = normLb(D[id] && D[id].lb), s = coachSeen[id];
      if (!findEx(id) || v == null) return;
      if (!s) { coachSeen[id] = { lb:v, prev:null, at:null }; changed = true; }
      else if (s.lb !== v) { coachSeen[id] = { lb:v, prev:s.lb, at: PLAN ? PLAN.weekOf : null }; changed = true; }
    });
    if (changed) { lsSet(CKEY, JSON.stringify(coachSeen)); if (PLAN) renderDay(); }
  } catch (e) {}
}

let PLAN = null, viewIdx = todayIdx(), adjOpen = false, planOpen = false, finOpen = false;
const rideCfg = {};
const dayBy = k => PLAN.days.find(d => d.key === k);
const modeOf = d => d.swap ? (state.swap[d.key] || d.swap.default) : 'bike';
function levelOf(k, cfg) { const pr = dayBy(k).ride; return pr && pr.type === cfg.type && pr.level ? pr.level : null; }

/* ================= Ride engine ================= */
function segsFor(k, cfg) {
  const pr = dayBy(k).ride || null, same = !!pr && cfg.type === pr.type;
  let base;
  if (same && cfg.dur === pr.minutes && Array.isArray(pr.segments) && pr.segments.length) base = pr.segments.map(fromPlanSeg); // straight from plan.json
  else base = applyAdjust(GEN[cfg.type](cfg.dur, levelOf(k, cfg)), same ? pr.adjust : null);                                // generate locally
  const off = DIFF[cfg.diff].off;
  return colorize(base.map(s => Object.assign({}, s, { res: (s.cool || !off) ? s.res.slice() : s.res.map(v => clamp(v + off, 0, 100)) })));
}
let ride = { sig:null, dayKey:null, type:'hiit', dur:30, diff:'norm', segs:[], starts:[], ends:[], total:0 };
let tm = { acc:0, startedAt:0, running:false, finished:false };
let iv = null, lastIdx = 0, lastBeep = '', lastHi = -2, cueT = null;

function loadRide(k, cfg, sig) {
  ride.sig = sig; ride.dayKey = k; ride.type = cfg.type; ride.dur = cfg.dur; ride.diff = cfg.diff;
  ride.segs = segsFor(k, cfg); ride.starts = []; ride.ends = [];
  let t = 0; ride.segs.forEach(s => { ride.starts.push(t); t += s.sec * 1000; ride.ends.push(t); });
  ride.total = t;
  resetTimer();
  const lv = levelOf(k, cfg);
  $('pTitle').textContent = TYPES[ride.type].name + (lv ? ' · L' + lv : '') + ' · ' + ride.dur + ' min';
  $('pSub').textContent = dayBy(k).name + ' · ' + DIFF[ride.diff].name;
  $('planSum').textContent = 'Show ride plan (' + ride.segs.length + ' segments)';
  $('planList').innerHTML = planItems(ride.segs);
  lastHi = -2;
}
function planItems(segs) {
  return segs.map(s => '<li style="--sc:' + s.color + '"><span>' + esc(s.name) + '</span><span>' + fmt(s.sec) + '</span><small><span style="color:' + zoneColor(s.zone) + '">' +
    esc(s.zone) + '</span> · ' + rng(s.cad) + ' rpm · R ' + rng(s.res) + '</small></li>').join('');
}
const elapsed = () => Math.max(0, tm.acc + (tm.running ? Date.now() - tm.startedAt : 0));
function idxAt(el) { for (let i = 0; i < ride.ends.length; i++) if (el < ride.ends[i]) return i; return ride.ends.length - 1; }
const inProgress = () => !!ride.sig && !tm.finished && (tm.running || elapsed() > 0);
function startTick() { if (!iv) iv = setInterval(tick, 250); }
function stopTick() { if (iv) { clearInterval(iv); iv = null; } }
function flash(color) { const f = $('flash'); f.style.setProperty('--fc', color); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
function segCue(i) {
  const s = ride.segs[i]; if (!s) return;
  flash(s.color);
  const c = $('tCard'); c.style.setProperty('--zc', s.color);
  c.classList.remove('changed'); void c.offsetWidth; c.classList.add('changed');
  clearTimeout(cueT); cueT = setTimeout(() => c.classList.remove('changed'), 6000);
  try { if (navigator.vibrate) navigator.vibrate([180, 80, 180]); } catch (e) {}
}
function clearCue() { clearTimeout(cueT); $('tCard').classList.remove('changed', 'soon'); }
function resetTimer() { stopTick(); lockOff(); clearCue(); tm = { acc:0, startedAt:0, running:false, finished:false }; lastIdx = 0; lastBeep = ''; }

let actx = null, soundOn = lsGet(SNDKEY) !== '0';
function audioUnlock() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    if (!actx) actx = new AC();
    if (actx.state !== 'running') { const p = actx.resume(); if (p && p.catch) p.catch(() => {}); }
    const b = actx.createBuffer(1, 1, 22050), src = actx.createBufferSource(); src.buffer = b; src.connect(actx.destination); src.start(0);
  } catch (e) {}
}
function beep(f, dur, when) {
  if (!soundOn || !actx) return;
  try {
    const t = actx.currentTime + (when || 0), o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch (e) {}
}
function chime() { beep(988, 0.25, 0); beep(1175, 0.25, 0.25); beep(1568, 0.45, 0.5); }

const REST_SEC = 75;
let rest = { endAt:0, remMs:0, running:false, done:false, iv:null, lastBeep:0 };
let wl = null, hintShown = false;
function showHint() { if (hintShown || lsGet(HKEY) === '1') return; hintShown = true; $('hint').hidden = false; }
function lockOn() {
  if (wl) return;
  if (!('wakeLock' in navigator)) { showHint(); return; }
  try {
    navigator.wakeLock.request('screen').then(s => {
      if (!tm.running && !rest.running) { s.release().catch(() => {}); return; }
      wl = s; s.addEventListener('release', () => { if (wl === s) wl = null; });
    }).catch(showHint);
  } catch (e) { showHint(); }
}
function lockOff() { if (!wl || tm.running || rest.running) return; try { wl.release().catch(() => {}); } catch (e) {} wl = null; }

function stopRestTick() { if (rest.iv) { clearInterval(rest.iv); rest.iv = null; } }
function updateRestUI() {
  const bar = $('restBar'), clk = $('restClk'), btn = $('restBtn'), rst = $('restRst');
  if (!bar || !clk || !btn || !rst) return;
  bar.classList.toggle('on', rest.running);
  bar.classList.toggle('done', rest.done);
  if (rest.done) {
    clk.textContent = 'Go!'; btn.textContent = 'Start 75s rest'; rst.hidden = false;
  } else if (rest.running) {
    clk.textContent = fmt(Math.ceil(rest.remMs / 1000)); btn.textContent = 'Pause'; rst.hidden = false;
  } else if (rest.remMs > 0) {
    clk.textContent = fmt(Math.ceil(rest.remMs / 1000)); btn.textContent = 'Resume'; rst.hidden = false;
  } else {
    clk.textContent = fmt(REST_SEC); btn.textContent = 'Start 75s rest'; rst.hidden = true;
  }
}
function restTick() {
  if (!rest.running) return;
  const rem = rest.endAt - Date.now();
  if (rem <= 0) {
    rest.running = false; rest.remMs = 0; rest.done = true; stopRestTick(); lockOff();
    chime(); flash('#34d399');
    try { if (navigator.vibrate) navigator.vibrate([180, 80, 180]); } catch (e) {}
    updateRestUI();
    return;
  }
  const sec = Math.ceil(rem / 1000);
  if (sec >= 1 && sec <= 3 && rest.lastBeep !== sec) { rest.lastBeep = sec; beep(880, 0.12); }
  rest.remMs = rem;
  updateRestUI();
}
function toggleRest() {
  audioUnlock();
  if (rest.running) {
    rest.remMs = Math.max(0, rest.endAt - Date.now());
    rest.running = false; stopRestTick(); lockOff(); updateRestUI();
    return;
  }
  const durMs = (rest.remMs > 0 && !rest.done) ? rest.remMs : REST_SEC * 1000;
  rest.endAt = Date.now() + durMs; rest.remMs = durMs; rest.running = true; rest.done = false; rest.lastBeep = 0;
  beep(880, 0.12);
  if (!rest.iv) rest.iv = setInterval(restTick, 200);
  lockOn(); updateRestUI();
}
function resetRest() {
  rest.running = false; rest.remMs = 0; rest.done = false; rest.lastBeep = 0;
  stopRestTick(); lockOff(); updateRestUI();
}

function start() {
  const el = elapsed();
  tm.startedAt = Date.now(); tm.running = true; tm.finished = false;
  lastIdx = idxAt(el); lastBeep = '';
  if (el === 0) { beep(1320, 0.35); segCue(0); }
  startTick(); lockOn(); updateTimer();
}
function pause() { tm.acc = elapsed(); tm.running = false; stopTick(); lockOff(); updateTimer(); }
function finish(live) {
  stopTick(); lockOff(); clearCue();
  tm.running = false; tm.finished = true; tm.acc = ride.total;
  if (live) { chime(); flash('#34d399'); }
  updateTimer();
}
function seek(ms) {
  ms = clamp(ms, 0, ride.total); tm.acc = ms; tm.finished = false;
  if (tm.running) tm.startedAt = Date.now();
  lastIdx = idxAt(ms); lastBeep = '';
  if (tm.running) beep(1320, 0.35);
  segCue(lastIdx); updateTimer();
}
function prevSeg() {
  if (tm.finished) { tm.finished = false; seek(ride.starts[ride.segs.length - 1]); return; }
  const el = elapsed(), i = idxAt(el);
  if (el - ride.starts[i] > 3000) seek(ride.starts[i]); else seek(ride.starts[Math.max(0, i - 1)]);
}
function nextSeg() {
  if (tm.finished) return;
  const i = idxAt(elapsed());
  if (i >= ride.segs.length - 1) finish(true); else seek(ride.starts[i + 1]);
}
function tick() {
  const el = elapsed();
  if (tm.running && el >= ride.total) { finish(true); return; }
  if (tm.running) {
    const i = idxAt(el);
    if (i !== lastIdx) { lastIdx = i; lastBeep = ''; beep(1320, 0.35); segCue(i); }
    else {
      const rem = Math.ceil((ride.ends[i] - el) / 1000);
      if (rem >= 1 && rem <= 3) { const k = i + ':' + rem; if (k !== lastBeep) { lastBeep = k; beep(880, 0.12); } }
    }
  }
  updateTimer();
}
function updateTimer() {
  if (!ride.sig) return;
  const el = elapsed(), n = ride.segs.length, totalSec = ride.total / 1000, card = $('tCard');
  let hi;
  if (tm.finished) {
    $('tSegNo').textContent = 'Finished'; $('tName').textContent = 'Ride complete 🎉'; $('tClock').textContent = '0:00';
    $('tCue').textContent = 'Nice work. Garmin logs it automatically at Sunday’s sync.';
    $('tCad').textContent = '–'; $('tRes').textContent = '–'; $('tZone').textContent = '–'; $('tZone').style.color = '';
    card.style.setProperty('--zc', '#34d399'); card.classList.remove('soon');
    $('tBar').style.width = '100%'; $('tDone').textContent = fmt(totalSec) + ' done'; $('tLeft').textContent = '0:00 left'; $('tNext').textContent = '';
    hi = -1;
  } else {
    const i = idxAt(el), s = ride.segs[i], remain = Math.ceil((ride.ends[i] - el) / 1000), done = Math.floor(el / 1000);
    $('tSegNo').textContent = 'Segment ' + (i + 1) + ' of ' + n;
    $('tName').textContent = s.name; $('tClock').textContent = fmt(remain); $('tCue').textContent = s.cue;
    $('tCad').textContent = rng(s.cad); $('tRes').textContent = rng(s.res);
    $('tZone').textContent = s.zone; $('tZone').style.color = zoneColor(s.zone);
    card.style.setProperty('--zc', s.color);
    $('tBar').style.width = (ride.total ? el / ride.total * 100 : 0) + '%';
    $('tDone').textContent = fmt(done) + ' done'; $('tLeft').textContent = fmt(totalSec - done) + ' left';
    if (i < n - 1) {
      const ns = ride.segs[i + 1];
      card.style.setProperty('--nzc', ns.color);
      $('tNext').innerHTML = 'Next: <span class="dot" style="background:' + ns.color + '"></span><b style="color:' + ns.color + '">' + esc(ns.name) + '</b> · ' + fmt(ns.sec) + ' · ' + rng(ns.cad) + ' rpm · R ' + rng(ns.res);
    } else $('tNext').textContent = 'Last segment';
    card.classList.toggle('soon', tm.running && i < n - 1 && remain <= 5);
    hi = i;
    $('mDot').style.background = s.color; $('mini').querySelector('button').style.setProperty('--mc', s.color);
    $('mName').textContent = s.name + ' · ' + rng(s.cad) + ' rpm · R ' + rng(s.res);
    $('mClk').textContent = fmt(remain);
  }
  $('mainBtn').textContent = tm.finished ? 'Restart' : tm.running ? 'Pause' : el > 0 ? 'Resume' : 'Start';
  $('mini').hidden = !$('player').hidden || !inProgress();
  if (hi !== lastHi) { const rows = $('planList').children; for (let r = 0; r < rows.length; r++) rows[r].classList.toggle('cur', r === hi); lastHi = hi; }
}
function openPlayer() { $('player').hidden = false; document.body.style.overflow = 'hidden'; $('sndBtn').textContent = 'Sound: ' + (soundOn ? 'On' : 'Off'); updateTimer(); }
function closePlayer() { $('player').hidden = true; document.body.style.overflow = ''; updateTimer(); renderDay(); }
function startFor(k) {
  const cfg = rideCfg[k], sig = k + '|' + cfg.type + '|' + cfg.dur + '|' + cfg.diff;
  if (ride.sig === sig && (inProgress() || tm.finished)) { openPlayer(); return; }
  const go = () => { audioUnlock(); loadRide(k, cfg, sig); openPlayer(); start(); };
  if (inProgress()) ask('Replace the ride in progress?', 'Replace', go); else go();
}

/* ================= Modal ================= */
let modalOk = null;
function ask(text, okLabel, onOk) { $('mText').textContent = text; $('mOk').textContent = okLabel; modalOk = onOk; $('modal').hidden = false; $('mOk').focus(); }
function closeModal() { $('modal').hidden = true; modalOk = null; }

/* ================= "This week" card ================= */
const SC = { PROGRESS:'s-PROGRESS', HOLD:'s-HOLD', DELOAD:'s-DELOAD' };
function fmtDate(iso, opts) { return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', Object.assign({ month:'short', day:'numeric', timeZone:'UTC' }, opts || {})); }
function weekEnded() {
  if (!PLAN || !/^\d{4}-\d{2}-\d{2}$/.test(PLAN.weekOf || '')) return false;
  const [y, m, d] = PLAN.weekOf.split('-').map(Number);
  return new Date() >= new Date(y, m - 1, d + 7);   // the Monday after the plan's week
}
function renderWeek() {
  const el = $('week'); if (!el || !PLAN) return;
  const c = PLAN.calibration, st = c.status || 'HOLD', notes = c.adjustments || [];
  let h = '<div class="card"><div class="row"><div><div class="lbl">This week</div><b>' + (PLAN.weekOf ? 'Week of ' + fmtDate(PLAN.weekOf) : 'Current plan') + '</b></div>' +
    '<span class="stat ' + (SC[st] || '') + '">' + esc(st) + '</span></div>';
  if (c.headline) h += '<p class="body">' + esc(c.headline) + '</p>';
  if (c.stepGoal) h += '<div class="crow"><span>Steps</span><b>' + Number(c.stepGoal).toLocaleString('en-US') + ' a day</b></div>';
  if (st === 'DELOAD') h += '<div class="crow"><span>Easier week</span><b>Tue and Thu: optional 20 min easy spin, no finishers. Mon, Wed and Fri rides are a little lighter.</b></div>';
  if (notes.length) h += '<div class="crow"><span>Changed</span><b>' + notes.map(a => (a.day && dayBy(a.day) ? esc(dayBy(a.day).name) + ': ' : '') + esc(a.text)).join('<br>') + '</b></div>';
  if (weekEnded()) h += '<p class="fn" style="color:var(--z34)">This plan was for the week of ' + fmtDate(PLAN.weekOf) + '. After Sunday’s check-in and push, tap ↻ above to refresh.</p>';
  el.innerHTML = h + '</div>';
}

/* ================= Workouts rendering ================= */
function renderDays() {
  const ti = todayIdx();
  $('days').innerHTML = PLAN.days.map((d, i) => '<button class="dtab' + (i === viewIdx ? ' on' : '') + (i === ti ? ' today' : '') + '" data-day="' + i + '" aria-pressed="' + (i === viewIdx) + '" aria-label="' + esc(d.name) + '" style="--zc:var(--' + d.zc + ')">' +
    esc(d.name.slice(0, 3)) + '<i></i></button>').join('');
}
function hoursList(h) { return '<ul class="hours"><li><b>King Pool</b> ' + h.king + ' · 1700 Hopkins St</li><li><b>West Campus</b> ' + h.west + ' · 2100 Browning St</li></ul>'; }
const SUNDAY_QS = 'Sunday’s check-in asks two things: any move where every set hit 15 reps with 1–2 to spare, and any move that felt too heavy, stopped improving or hurt. Nothing to log here.';
function finisherCard(key) {
  const F = FIN[key]; if (!F) return '';
  const openAttr = (finOpen || rest.running) ? ' open' : '';
  let h = '<details class="card fin-d"' + openAttr + '><summary><span class="fs"><b>Required finisher</b><small>' + F.title + ' · ~15 min · 3 × 8–15</small></span><span class="pill c-z34">Show</span></summary>';
  h += '<p class="fsub">Rest 60–90 s after each round. Use the weight shown; the Coach changes it after Sunday’s check-in.</p>';
  h += '<div class="restbar" id="restBar"><div class="restmeta"><span class="lbl">Round rest</span><b id="restClk">' + fmt(REST_SEC) + '</b></div>' +
       '<div class="restbtns"><button class="btn sm ghost" id="restRst" data-act="rest-reset" hidden>Reset</button>' +
       '<button class="btn sm primary" id="restBtn" data-act="rest-toggle">Start 75s rest</button></div></div>';
  ['A', 'B'].forEach(g => {
    h += '<div class="ssh">Superset ' + g + ' · alternate · 3 rounds</div>';
    F.ex.filter(e => e.g === g).forEach((e, j) => {
      const ch = changedThisWeek(e.id);
      h += '<div class="ex"><svg class="fig" viewBox="0 0 60 60" role="img" aria-label="' + e.name + ' drawing">' + GROUND + FIG[e.id] + '</svg>' +
        '<div class="exm"><b>' + g + (j + 1) + ' · ' + e.name + '</b><small>' + e.sets + ' × ' + e.reps + ' · ' + e.per + '</small><small class="excue">' + e.cue + '</small></div>' +
        '<div class="exa"><div class="wt"><span style="line-height:44px;padding:0 12px">' + fmtW(wOf(e)) + '</span></div>' +
        (ch ? '<small style="color:var(--accent);font-weight:700">' + (ch.lb > ch.prev ? '↑' : '↓') + ' was ' + ch.prev + ' lb</small>' : '') +
        '<a class="watch" href="' + ytUrl(e.q) + '" target="_blank" rel="noopener noreferrer">Watch how ↗</a></div></div>';
    });
  });
  h += '<p class="fn" style="margin-top:12px">' + SUNDAY_QS + '</p>';
  h += '<details class="tips"><summary>How the weights move</summary><ul>' +
    '<li>Aim for <b>8–15 clean reps</b> with the last 2 hard.</li>' +
    '<li><b>Every set at 15 with 1–2 to spare, two weeks in a row:</b> the Coach adds 5 lb and you start again at 8 reps.</li>' +
    '<li><b>Stopped improving three weeks in a row:</b> down 5 lb and build back up. <b>Can’t get 8 clean reps:</b> down 5 lb right away.</li>' +
    '<li><b>Exhale as you lift.</b> Don’t hold your breath; it spikes blood pressure.</li>' +
    '<li>Joint pain (not normal muscle effort): keep the weight, cut the reps, and skip the move if it continues.</li></ul></details></details>';
  return h;
}
function opt(v, label, cur) { return '<option value="' + v + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + label + '</option>'; }
function rideSection(d) {
  const cfg = rideCfg[d.key], T = TYPES[cfg.type], segs = segsFor(d.key, cfg), lv = levelOf(d.key, cfg);
  const sig = d.key + '|' + cfg.type + '|' + cfg.dur + '|' + cfg.diff, live = ride.sig === sig && inProgress();
  let h = '<p class="body">' + esc(d.text) + '</p>';
  if (d.deload) h += '<p class="fn">Optional. Skip it if you feel run down; it never counts as a missed workout.</p>';
  h += '<button class="btn primary mt" data-start="' + d.key + '">' + (live ? 'Open live ride →' : d.deload ? 'Start easy spin →' : 'Start ride →') + '</button>';
  h += '<div class="tools"><button class="link" data-act="plan" aria-expanded="' + planOpen + '">' + (planOpen ? 'Hide plan' : 'Ride plan') + '</button>' +
       '<button class="link" data-act="adjust" aria-expanded="' + adjOpen + '">' + (adjOpen ? 'Done' : 'Adjust') + '</button></div>';
  if (planOpen) h += '<p class="rmeta">' + T.name + (lv ? ' · Level ' + lv : '') + ' · ' + cfg.dur + ' min · ' + DIFF[cfg.diff].name + ' · ' + segs.length + ' segments</p><ol class="plan inl">' + planItems(segs) + '</ol>';
  if (adjOpen) {
    const hasCoach = PLAN.calibration.adjustments.some(a => a.day === d.key);
    if (hasCoach) h += '<p class="fn">The Coach’s change is already in this ride. Only adjust if you want something different today.</p>';
    if (lv) h += '<p class="fn">Level ' + lv + ' is built for ' + LEVELS[cfg.type][lv].min + ' min. Another length builds a simpler ride from the length alone.</p>';
    let durs = ''; for (let m = 10; m <= 90; m += 5) durs += opt(m, m + ' min', cfg.dur);
    const types = Object.keys(TYPES).filter(k => !TYPES[k].hidden || k === cfg.type);
    h += '<div class="settings">' +
      '<label class="field">Ride type<select data-cfg="type">' + types.map(k => opt(k, TYPES[k].name + ' (' + TYPES[k].day + ')', cfg.type)).join('') + '</select></label>' +
      '<label class="field">Duration<select data-cfg="dur">' + durs + '</select></label>' +
      '<label class="field">Difficulty<select data-cfg="diff">' + Object.keys(DIFF).map(k => opt(k, DIFF[k].name, cfg.diff)).join('') + '</select></label></div>';
  }
  return h;
}
function renderDay() {
  if (!PLAN) return;
  const prevFin = document.querySelector('.fin-d'); if (prevFin) finOpen = prevFin.open;
  const d = PLAN.days[viewIdx], isToday = viewIdx === todayIdx(), mode = modeOf(d);
  const adj = PLAN.calibration.adjustments.filter(a => a.day === d.key);
  let h = '<div class="dayhead"><div class="lbl todaylbl"' + (isToday ? '' : ' style="visibility:hidden"') + '>Today</div><h1>' + esc(d.name) + '</h1>' +
    '<div class="zone"><span class="pill c-' + d.zc + '">' + esc(d.zone) + '</span><span class="muted">' + esc(d.focus || '') + '</span></div></div>';
  h += '<div class="card">';
  h += '<h2 class="title">' + esc(d.title) + '</h2>';
  if (mode === 'bike') adj.forEach(a => { h += '<p class="coachln">✓ Coach change applied: ' + esc(a.text) + '</p>'; });
  if (d.swap) {
    h += '<div class="seg" role="group" aria-label="Bike or swim"><button data-swap="' + d.key + ':bike" aria-pressed="' + (mode === 'bike') + '">Bike</button>' +
         '<button data-swap="' + d.key + ':swim" aria-pressed="' + (mode === 'swim') + '">Swim</button></div>';
    if (mode === 'swim') h += '<p class="body">' + esc(d.swap.swim.text) + '</p>' + (d.swap.swim.pools ? hoursList(HOURS_TT) + '<p class="fn">' + FOOT + '</p>' : '') +
      '<p class="fn">Start a pool swim on your watch; Garmin tells the Coach you swam.</p>';
    else h += rideSection(d);
  } else if (d.ride || (d.deload && rideCfg[d.key])) {
    h += rideSection(d);
  } else {
    h += '<p class="body">' + esc(d.text) + '</p>';
  }
  if (d.pilates) h += '<div class="then"><span class="badge">2</span><div><b>' + esc(d.pilates.name) + '</b><small>Immediately after the ride’s final transition segment.</small></div></div>';
  h += '</div>';
  if (d.finisher) h += finisherCard(d.finisher);
  if (d.checkin) {
    h += '<div class="card checkin"><b>Weekly check-in this morning</b>' +
      '<p>Weigh in first: after the bathroom, before food or drink. Then run /weekly-checkin and /meal-plan on your Mac. Garmin supplies your workouts; you’ll answer a few quick questions, including the two finisher ones: any move where every set hit 15 with 1–2 to spare, and any move that felt too heavy, stopped improving or hurt.</p></div>';
  }
  $('day').innerHTML = h;
  updateRestUI();
}
function renderWork() { renderWeek(); renderDays(); renderDay(); }

/* ================= history.enc (written by coach/encrypt.mjs) ================= */
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function pbkdf2Key(pass, salt, iter, usage) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name:'PBKDF2', hash:'SHA-256', salt, iterations:iter }, base, { name:'AES-GCM', length:256 }, false, [usage]);
}
async function fetchHistoryEnc() {
  let res;
  try { res = await fetch('./history.enc?t=' + Date.now(), { cache:'no-store' }); }
  catch (e) { throw new Error('Couldn’t reach history.enc. Check your connection and try again.'); }
  if (res.status === 404) { const e = new Error('No progress yet'); e.code = 'NONE'; throw e; }
  if (!res.ok) throw new Error('Couldn’t load history.enc (HTTP ' + res.status + ').');
  let env;
  try { env = await res.json(); } catch (e) { throw new Error('history.enc is damaged. Run node coach/encrypt.mjs and push again.'); }
  if (!env || env.v !== 1 || env.kdf !== 'PBKDF2-SHA256' || !(env.iter >= 100000) || !env.salt || !env.iv || !env.ct) throw new Error('Unsupported history.enc format.');
  return env;
}
async function decryptEnv(key, env) {
  const pt = await crypto.subtle.decrypt({ name:'AES-GCM', iv:b64d(env.iv) }, key, b64d(env.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
/* Non-extractable CryptoKey in IndexedDB; falls back to memory if IndexedDB is blocked */
const KeyStore = {
  mem: null, mode: 'IndexedDB',
  open() { return new Promise((res, rej) => { let r; try { r = indexedDB.open('wf-vault', 1); } catch (e) { rej(e); return; }
    r.onupgradeneeded = () => r.result.createObjectStore('keys'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async run(mode, fn) { const db = await this.open(); return new Promise((res, rej) => {
    const tx = db.transaction('keys', mode), q = fn(tx.objectStore('keys'));
    tx.oncomplete = () => { db.close(); res(q && q.result); }; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); }); },
  async get() { if (this.mode === 'memory') return this.mem; try { return await this.run('readonly', s => s.get('k')); } catch (e) { this.mode = 'memory'; return this.mem; } },
  async put(v) { if (this.mode !== 'memory') { try { await this.run('readwrite', s => s.put(v, 'k')); return; } catch (e) { this.mode = 'memory'; } } this.mem = v; },
  async del() { this.mem = null; if (this.mode !== 'memory') { try { await this.run('readwrite', s => s.delete('k')); } catch (e) {} } }
};

/* ================= Progress view ================= */
let progState = 'locked', progErr = '', history = null;
const hasCrypto = () => !!(window.crypto && crypto.subtle);
async function syncHistory() {
  if (progState === 'unlocking') return;
  if (!hasCrypto()) { progState = 'error'; progErr = 'Web Crypto isn’t available here (it needs HTTPS or localhost).'; if (!$('v-prog').hidden) renderProg(); return; }
  let env;
  try { env = await fetchHistoryEnc(); }
  catch (e) { if (e.code === 'NONE') { progState = 'empty'; if (!$('v-prog').hidden) renderProg(); } return; }
  try {
    const s = await KeyStore.get();
    if (!s || s.salt !== env.salt || s.iter !== env.iter) {
      if (progState === 'open') { await KeyStore.del(); history = null; progState = 'locked'; if (!$('v-prog').hidden) renderProg(); }
      return;
    }
    history = await decryptEnv(s.key, env); progState = 'open';
    if (!$('v-prog').hidden) renderProg();
  } catch (e) {
    await KeyStore.del();
    if (progState === 'open') { history = null; progState = 'locked'; if (!$('v-prog').hidden) renderProg(); }
  }
}
async function unlock(pass) {
  if (!pass) { progErr = 'Enter your passcode.'; renderProg(); return; }
  progState = 'unlocking'; progErr = ''; renderProg();
  await new Promise(r => setTimeout(r, 40));
  try {
    const env = await fetchHistoryEnc();
    const key = await pbkdf2Key(pass, b64d(env.salt), env.iter, 'decrypt');
    let data;
    try { data = await decryptEnv(key, env); } catch (e) { throw new Error('That passcode didn’t work. Try again.'); }
    await KeyStore.put({ key, salt: env.salt, iter: env.iter });               // CryptoKey only; passcode never stored
    history = data; progState = 'open';
  } catch (e) {
    if (e.code === 'NONE') { progState = 'empty'; }
    else { progState = 'locked'; progErr = e.message || 'Couldn’t decrypt history.enc.'; }
  }
  renderProg();
  if (progState === 'locked') { const i = $('passIn'); if (i) i.focus(); }
}
async function lockVault() { await KeyStore.del(); history = null; progState = 'locked'; progErr = ''; renderProg(); }

const LOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>';
const PHEAD = '<div class="phead"><div><div class="lbl">Private · encrypted</div><h1>Progress</h1></div></div>';
function renderProg() {
  const v = $('v-prog');
  if (progState === 'error') { v.innerHTML = PHEAD + '<div class="card state" role="alert"><b style="color:var(--err)">Progress unavailable</b><p class="note">' + esc(progErr) + '</p></div>'; return; }
  if (progState === 'empty') {
    v.innerHTML = PHEAD + '<div class="card state"><b style="color:var(--text)">No progress yet</b><p class="note">history.enc wasn’t found. Run <code>node coach/encrypt.mjs</code>, then push.</p>' +
      '<button class="btn ghost sm" data-act="retry">Try again</button></div>';
    return;
  }
  if (progState === 'locked' || progState === 'unlocking') {
    const busy = progState === 'unlocking';
    v.innerHTML = PHEAD +
      '<div class="card lockcard"><div class="lockico">' + LOCK_SVG + '</div><b>Your progress is encrypted</b>' +
      '<p class="muted" style="font-size:14px;margin-top:4px">Enter your passcode once on this device. A non-extractable key stays saved across weekly pushes until you lock it.</p>' +
      '<form class="pass" id="passForm" autocomplete="on"><label for="passIn">Passcode</label>' +
      '<input id="passIn" type="password" autocomplete="current-password" inputmode="text" ' + (busy ? 'disabled ' : '') + 'aria-invalid="' + (!!progErr) + '" aria-describedby="passErr">' +
      '<div class="err" id="passErr" role="alert">' + esc(progErr) + '</div>' +
      '<button class="btn primary" type="submit"' + (busy ? ' disabled' : '') + '>' + (busy ? '<span class="spin"></span>Decrypting…' : 'Unlock') + '</button></form></div>';
    return;
  }
  v.innerHTML = renderUnlocked(history);
}

/* ---- Weight semantics ---- */
function trendSeries(weeks) {
  return weeks.map((w, i) => {
    if (!w.weighIn) return null;                      // missed week = gap
    const vals = [];
    for (let j = Math.max(0, i - 2); j <= i; j++) if (weeks[j].weighIn) vals.push(weeks[j].weighIn.lbs);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  });
}
const f1 = n => n.toFixed(1);
function weightCard(H) {
  const W = H.weeks, tr = trendSeries(W);
  const idx = tr.map((t, i) => t == null ? -1 : i).filter(i => i >= 0);
  if (!idx.length) return '<div class="card"><div class="ch-h"><h2>Weight</h2></div><p class="verdict">No weigh-ins yet. Weigh in Sunday morning before the check-in.</p></div>';
  const G0 = H.goals || {};
  const g = { startWeight: typeof G0.startWeight === 'number' ? G0.startWeight : W[idx[0]].weighIn.lbs,
              goalWeight: typeof G0.goalWeight === 'number' ? G0.goalWeight : null,
              weeklyLossPct: Array.isArray(G0.weeklyLossPct) ? G0.weeklyLossPct : [0.5, 0.8] };
  if (idx.length < 2) {
    return '<div class="card"><div class="ch-h"><h2>Weight</h2></div>' +
      '<div class="hero"><span class="big">' + f1(W[idx[0]].weighIn.lbs) + ' lb</span><span class="muted">starting weigh-in · ' + fmtDate(W[idx[0]].weekOf) + '</span></div>' +
      '<p class="verdict">' + (g.goalWeight != null ? 'Goal <b>' + g.goalWeight + ' lb</b>. ' : '') + 'Your trend appears after a few Sunday weigh-ins.</p></div>';
  }
  const first = idx[0], last = idx[idx.length - 1], prev = idx[idx.length - 2];
  const span = last - first, lbsWk = span > 0 ? (tr[first] - tr[last]) / span : 0;
  const pct = lbsWk / tr[last] * 100, wkChg = tr[last] - tr[prev];
  const lost = g.startWeight - tr[last], weeksToGoal = (lbsWk > 0 && g.goalWeight != null) ? Math.ceil((tr[last] - g.goalWeight) / lbsWk) : null;
  const band = g.weeklyLossPct, cls = pct < band[0] ? 'lo' : pct > band[1] ? 'hi' : 'ok';
  const lbl = cls === 'ok' ? 'On target' : cls === 'lo' ? 'Below target' : 'Above target';
  const hasGoal = g.goalWeight != null;

  const VW = 340, VH = 210, L = 36, R = 10, T = 12, B = 26, n = W.length;
  const vals = W.filter(w => w.weighIn).map(w => w.weighIn.lbs);
  const lo = Math.min(hasGoal ? g.goalWeight : Infinity, Math.min(...vals)) - 3, hi = Math.max(g.startWeight, Math.max(...vals)) + 3;
  const x = i => L + (n === 1 ? 0 : i * (VW - L - R) / (n - 1)), y = v => T + (hi - v) * (VH - T - B) / (hi - lo);
  let s = '<svg class="chart" viewBox="0 0 ' + VW + ' ' + VH + '" role="img" aria-label="Weight trajectory: weekly weigh-ins, 3-week rolling average and goal line">';
  for (let v = Math.ceil(lo / 5) * 5; v <= hi; v += 5) s += '<line x1="' + L + '" x2="' + (VW - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#263146"/><text x="' + (L - 6) + '" y="' + (y(v) + 3) + '" text-anchor="end">' + v + '</text>';
  if (hasGoal) s += '<line x1="' + L + '" x2="' + (VW - R) + '" y1="' + y(g.goalWeight) + '" y2="' + y(g.goalWeight) + '" stroke="#34d399" stroke-width="1.5" stroke-dasharray="5 4"/>' +
       '<text x="' + (VW - R) + '" y="' + (y(g.goalWeight) - 5) + '" text-anchor="end" style="fill:#34d399">Goal ' + g.goalWeight + '</text>';
  W.forEach((w, i) => {
    if (i % 2 === 0 || i === n - 1) s += '<text x="' + x(i) + '" y="' + (VH - 8) + '" text-anchor="middle">' + fmtDate(w.weekOf) + '</text>';
    if (!w.weighIn) s += '<line x1="' + x(i) + '" x2="' + x(i) + '" y1="' + T + '" y2="' + (VH - B) + '" stroke="#8a96a8" stroke-opacity=".35" stroke-dasharray="2 3"/><text x="' + x(i) + '" y="' + (T + 8) + '" text-anchor="middle" style="font-size:9px">missed</text>';
    else s += '<circle cx="' + x(i) + '" cy="' + y(w.weighIn.lbs) + '" r="4" fill="#4cc2ff" fill-opacity=".35"/>';
  });
  let d = '', pen = false;
  tr.forEach((t, i) => { if (t == null) { pen = false; return; } d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(t).toFixed(1) + ' '; pen = true; });
  s += '<path d="' + d + '" fill="none" stroke="#4cc2ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
  tr.forEach((t, i) => { if (t != null) s += '<circle cx="' + x(i) + '" cy="' + y(t) + '" r="2.2" fill="#4cc2ff"/>'; });
  s += '</svg>';

  const toGo = hasGoal ? tr[last] - g.goalWeight : null;
  return '<div class="card"><div class="ch-h"><h2>Weight</h2><span class="tgt ' + cls + '">' + lbl + '</span></div>' +
    '<div class="hero"><span class="big">' + (lost >= 0 ? '−' : '+') + f1(Math.abs(lost)) + ' lb</span><span class="muted">since you started</span></div>' +
    '<p class="verdict">Losing about <b>' + f1(lbsWk) + ' lb a week</b> (' + pct.toFixed(1) + '%; target ' + band[0] + '–' + band[1] + '%).' +
    (hasGoal ? ' <b>' + f1(toGo) + ' lb</b> to your goal of ' + g.goalWeight + (weeksToGoal != null ? ', about <b>' + weeksToGoal + ' weeks</b> at this pace.' : '.') : '') + '</p>' +
    (W[n - 1].weighIn ? '' : '<p class="note">No weigh-in this week.</p>') +
    '<details class="chart-d"><summary>Show chart</summary>' + s +
    '<div class="legend"><span><i class="lg-dot"></i>Weigh-in</span><span><i class="lg-line"></i>3-week trend</span>' + (hasGoal ? '<span><i class="lg-dash"></i>Goal</span>' : '') + '</div>' +
    '<p class="fn">Trend ' + f1(tr[last]) + ' lb · ' + (wkChg <= 0 ? '−' : '+') + f1(Math.abs(wkChg)) + ' lb since last weigh-in. Judged on the 3-week trend, not single weigh-ins.</p></details></div>';
}
function exerciseCard(W) {
  const lw = W[W.length - 1], P = lw.sessions.planned, C = lw.sessions.completed, G = lw.garmin;
  const items = [['Rides','rides'],['Swims','swims'],['Pilates','pilates'],['Finishers','finishers']];
  const sum = o => (o.rides || 0) + (o.swims || 0) + (o.pilates || 0) + (o.finishers || 0);
  const recent = W.slice(-4), rp = recent.reduce((a, w) => a + sum(w.sessions.planned), 0), rc = recent.reduce((a, w) => a + sum(w.sessions.completed), 0);
  const rate = rp ? Math.round(rc / rp * 100) : 0, cls = rate >= 90 ? 'ok' : rate >= 75 ? 'lo' : 'hi';
  const lbl = rate >= 90 ? 'Very consistent' : rate >= 75 ? 'Mostly consistent' : 'Slipping';
  const missed = items.filter(it => (C[it[1]] || 0) < (P[it[1]] || 0)).map(it => it[0].toLowerCase());
  const stepsOk = G.avgSteps >= G.stepGoal;
  return '<div class="card"><div class="ch-h"><h2>Exercise consistency</h2><span class="tgt ' + cls + '">' + lbl + '</span></div>' +
    '<div class="hero"><span class="big">' + rate + '%</span><span class="muted">of planned sessions, last ' + recent.length + ' week' + (recent.length === 1 ? '' : 's') + '</span></div>' +
    '<p class="verdict">Last week: <b>' + sum(C) + ' of ' + sum(P) + ' sessions</b>' + (missed.length ? ' (missed ' + missed.join(', ') + ')' : ', nothing missed') + '. ' +
    'Steps averaged <b>' + G.avgSteps.toLocaleString('en-US') + '</b> a day, ' + (stepsOk ? 'above' : 'below') + ' your ' + G.stepGoal.toLocaleString('en-US') + ' goal.</p>' +
    '<details class="chart-d"><summary>Show chart</summary>' +
    barChart(W, w => { const p = sum(w.sessions.planned); return p ? sum(w.sessions.completed) / p * 100 : 0; }, 100, w => sum(w.sessions.completed) + '/' + sum(w.sessions.planned), 90, 75, null, 'Sessions completed vs planned each week') +
    '<p class="fn">Sessions done out of planned each week, synced from Garmin Lily 2.</p></details></div>';
}
/* Shared weekly bar chart: green when at/above okAt, amber at/above loAt, red below. mark(w) adds a diamond marker. */
function barChart(W, val, max, label, okAt, loAt, mark, aria) {
  const VW = 340, VH = 120, T = 18, B = 22, L = 4, n = W.length, bw = (VW - L * 2) / n, y = v => T + (max - v) * (VH - T - B) / max;
  let s = '<svg class="chart" viewBox="0 0 ' + VW + ' ' + VH + '" role="img" aria-label="' + aria + '">';
  s += '<line x1="0" x2="' + VW + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="#263146"/>';
  W.forEach((w, i) => {
    const v = val(w), xx = L + i * bw + 3, cx = xx + (bw - 6) / 2, h = Math.max(2, y(0) - y(v));
    const col = v >= okAt ? '#34d399' : v >= loAt ? '#fbbf24' : '#f87171';
    s += '<rect x="' + xx + '" y="' + (y(0) - h) + '" width="' + (bw - 6) + '" height="' + h + '" rx="3" fill="' + col + '" fill-opacity=".8"/>';
    s += '<text x="' + cx + '" y="' + (y(0) - h - 3) + '" text-anchor="middle" style="fill:#c9d2de;font-size:8.5px">' + label(w) + '</text>';
    if (mark && mark(w)) s += '<rect x="' + (cx - 3.5) + '" y="2" width="7" height="7" transform="rotate(45 ' + cx + ' 5.5)" fill="#4cc2ff"/>';
    if (i % 2 === 0 || i === n - 1) s += '<text x="' + cx + '" y="' + (VH - 6) + '" text-anchor="middle">' + fmtDate(w.weekOf) + '</text>';
  });
  return s + '</svg>';
}
function nutritionCard(W) {
  const N = W[W.length - 1].nutrition, recent = W.slice(-4);
  const rate = Math.round(recent.reduce((a, w) => a + w.nutrition.daysOnPlan, 0) / (recent.length * 7) * 100);
  const cls = rate >= 85 ? 'ok' : rate >= 70 ? 'lo' : 'hi', lbl = rate >= 85 ? 'Very consistent' : rate >= 70 ? 'Mostly consistent' : 'Slipping';
  const lastRecal = W.filter(w => w.nutrition.recalibration).pop();
  return '<div class="card"><div class="ch-h"><h2>Nutrition consistency</h2><span class="tgt ' + cls + '">' + lbl + '</span></div>' +
    '<div class="hero"><span class="big">' + rate + '%</span><span class="muted">of days on your meal plan, last ' + recent.length + ' week' + (recent.length === 1 ? '' : 's') + '</span></div>' +
    '<p class="verdict">Last week: <b>' + N.daysOnPlan + ' of 7 days</b> on plan. Daily targets: <b>' + N.kcalTarget.toLocaleString('en-US') + ' kcal</b> and <b>' + N.proteinTargetG + ' g protein</b>.</p>' +
    '<details class="chart-d"><summary>Show chart</summary>' +
    barChart(W, w => w.nutrition.daysOnPlan, 7, w => w.nutrition.daysOnPlan + '/7', 6, 5, w => !!w.nutrition.recalibration, 'Days on meal plan each week, with calorie changes marked') +
    '<div class="legend"><span><i class="lg-dia"></i>Calories changed</span></div>' +
    '<p class="fn">Days on plan = your answer at the Sunday check-in.' + (lastRecal ? ' Calories last changed ' + fmtDate(lastRecal.weekOf) + ': ' + lastRecal.nutrition.recalibration.fromKcal.toLocaleString('en-US') + ' → ' + lastRecal.nutrition.recalibration.toKcal.toLocaleString('en-US') + '.' : '') + '</p></details></div>';
}
/* Same fields every week. Tile dots: green = good, amber = the signal that held or eased the plan. */
function coachCard(W) {
  const tr = trendSeries(W), sum = o => (o.rides || 0) + (o.swims || 0) + (o.pilates || 0) + (o.finishers || 0);
  const rows = W.map((w, i) => {
    let wt = 'Missed', ws = 'na';
    if (tr[i] != null) {
      let j = i - 1; while (j >= 0 && tr[j] == null) j--;
      const d = j < 0 ? null : tr[i] - tr[j];
      wt = d == null ? 'Start' : (d <= 0 ? '−' : '+') + f1(Math.abs(d)) + ' lb';
      ws = d == null ? 'na' : (d <= -0.3 ? 'ok' : 'warn');
    }
    const p = sum(w.sessions.planned), cpl = sum(w.sessions.completed), G = w.garmin;
    return { w, wt, ws,
      wo: cpl + '/' + p, wos: p && cpl / p >= 0.9 ? 'ok' : 'warn',
      nu: w.nutrition.daysOnPlan + '/7', nus: w.nutrition.daysOnPlan >= 6 ? 'ok' : 'warn',
      rc: String(G.avgBodyBattery), rcs: G.avgBodyBattery >= 55 && G.avgSleepScore >= 72 ? 'ok' : 'warn' };
  }).reverse();
  const c = rows[0], past = rows.slice(1);
  const f = (k, v, s) => '<div class="cf"><span><i class="sd ' + s + '"></i>' + k + '</span><b>' + v + '</b></div>';
  return '<div class="card"><div class="ch-h"><h2>Coach’s take</h2><span class="stat ' + (SC[c.w.coach.decision] || '') + '">' + esc(c.w.coach.decision) + '</span></div>' +
    '<p class="cweek">Week of ' + fmtDate(c.w.weekOf) + '</p>' +
    '<div class="cf3">' + f('Weight', c.wt, c.ws) + f('Workouts', c.wo, c.wos) + f('Nutrition', c.nu, c.nus) + f('Recovery', c.rc, c.rcs) + '</div>' +
    '<div class="crow"><span>Next week</span><b>' + esc(c.w.coach.next || 'No changes') + '</b></div>' +
    '<div class="crow"><span>Your focus</span><b>' + esc(c.w.coach.focus || '–') + '</b></div>' +
    (past.length ? '<details class="tips"><summary>Past weeks</summary><ul class="past">' +
    '<li class="ph"><span>Week</span><span>Weight</span><span>Workouts</span><span>Nutrition</span><span></span></li>' +
    past.map(r => '<li><span class="ld">' + fmtDate(r.w.weekOf) + '</span><span>' + r.wt + '</span><span>' + r.wo + '</span><span>' + r.nu + '</span>' +
      '<span class="stat ' + (SC[r.w.coach.decision] || '') + '">' + esc(r.w.coach.decision) + '</span><span class="nx">Next: ' + esc(r.w.coach.next || 'No changes') + '</span></li>').join('') +
    '</ul><p class="fn">Weight = change in the 3-week trend. Recovery = average Body Battery.</p></details>' : '') + '</div>';
}
function renderUnlocked(H) {
  if (!H || !Array.isArray(H.weeks) || !H.weeks.length) return PHEAD + '<div class="card state">No weeks in history yet.</div>';
  const W = H.weeks;
  const ex = W.filter(w => w.sessions && w.sessions.planned && w.sessions.completed && w.garmin);
  const nu = W.filter(w => w.nutrition && typeof w.nutrition.daysOnPlan === 'number');
  const co = W.filter(w => w.coach && w.coach.decision && w.sessions && w.sessions.planned && w.sessions.completed && w.garmin && w.nutrition);
  return '<div class="phead"><div><div class="lbl">' + (H.sample ? 'Sample history · ' : '') + W.length + ' week' + (W.length === 1 ? '' : 's') + '</div><h1>Progress</h1></div>' +
    '<button class="btn ghost sm" data-act="lock">' + LOCK_SVG.replace('<svg', '<svg width="16" height="16" style="margin-right:6px"') + 'Lock / Clear Key</button></div>' +
    weightCard(H) + (ex.length ? exerciseCard(ex) : '') + (nu.length ? nutritionCard(nu) : '') + (co.length ? coachCard(co) : '');
}

/* ================= Navigation & events ================= */
function showTab(t) {
  ['work', 'prog'].forEach(v => { $('v-' + v).hidden = v !== t; });
  document.querySelectorAll('.tab').forEach(b => { const on = b.dataset.tab === t; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  window.scrollTo(0, 0);
  if (t === 'prog') { if (progState === 'empty') progState = 'locked'; renderProg(); syncHistory(); }
}
let refreshing = false;
async function manualRefresh() {
  if (refreshing) return;
  refreshing = true;
  const btn = $('refBtn'); if (btn) btn.classList.add('spinning');
  try { await Promise.all([refreshPlan(true), syncHistory()]); } catch (e) {}
  setTimeout(() => { if (btn) btn.classList.remove('spinning'); refreshing = false; }, 350);
}
function act(a) {
  switch (a) {
    case 'main': audioUnlock(); if (tm.finished) { resetTimer(); start(); } else if (tm.running) pause(); else start(); break;
    case 'prev': audioUnlock(); prevSeg(); break;
    case 'next': audioUnlock(); nextSeg(); break;
    case 'reset': resetTimer(); updateTimer(); break;
    case 'sound': soundOn = !soundOn; lsSet(SNDKEY, soundOn ? '1' : '0'); $('sndBtn').textContent = 'Sound: ' + (soundOn ? 'On' : 'Off'); if (soundOn) { audioUnlock(); beep(880, 0.12); } break;
    case 'hint': $('hint').hidden = true; lsSet(HKEY, '1'); break;
    case 'minimize': closePlayer(); break;
    case 'open-player': openPlayer(); break;
    case 'adjust': adjOpen = !adjOpen; renderDay(); break;
    case 'plan': planOpen = !planOpen; renderDay(); break;
    case 'rest-toggle': toggleRest(); break;
    case 'rest-reset': resetRest(); break;
    case 'refresh': manualRefresh(); break;
    case 'm-cancel': closeModal(); break;
    case 'm-ok': { const f = modalOk; closeModal(); if (f) f(); break; }
    case 'lock': lockVault(); break;
    case 'retry': progState = 'locked'; renderProg(); syncHistory(); break;
  }
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-day],[data-swap],[data-start],[data-act],[data-tab]');
  if (!el) return;
  const ds = el.dataset;
  if (ds.day !== undefined) { viewIdx = clamp(+ds.day || 0, 0, 6); adjOpen = false; planOpen = false; finOpen = false; renderDays(); renderDay(); return; }
  if (ds.swap) { const p = ds.swap.split(':'); if (p[0] in state.swap) { state.swap[p[0]] = p[1]; save(); } renderDay(); return; }
  if (ds.start) { startFor(ds.start); return; }
  if (ds.tab) { showTab(ds.tab); return; }
  if (ds.act) act(ds.act);
});
document.addEventListener('change', e => {
  const k = e.target.dataset && e.target.dataset.cfg; if (!k) return;
  const d = PLAN.days[viewIdx], cfg = rideCfg[d.key], v = e.target.value;
  if (k === 'type' && TYPES[v]) { cfg.type = v; cfg.dur = (d.ride && d.ride.type === v) ? d.ride.minutes : TYPES[v].min; }
  else if (k === 'dur') cfg.dur = clamp(parseInt(v, 10) || 30, 10, 90);
  else if (k === 'diff' && DIFF[v]) cfg.diff = v;
  renderDay();
});
document.addEventListener('submit', e => { if (e.target.id === 'passForm') { e.preventDefault(); unlock($('passIn').value); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('modal').hidden) closeModal(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (!inProgress()) { refreshPlan(false).catch(() => {}); if (progState === 'open') syncHistory().catch(() => {}); }
    if (tm.running) { lockOn(); tick(); } else updateTimer();
    if (rest.running) { lockOn(); restTick(); } else updateRestUI();
  }
});

/* ================= Self-test (browser console: heartplanSelfTest()) ================= */
window.heartplanSelfTest = function () {
  const errs = [];
  Object.keys(GEN).forEach(t => {
    for (let m = 10; m <= 90; m += 5) {
      const s = GEN[t](m), total = s.reduce((a, x) => a + x.sec, 0);
      if (total !== m * 60) errs.push(t + ' ' + m + ' min adds up to ' + (total / 60) + ' min');
      if (s.some(x => !(x.sec > 0))) errs.push(t + ' ' + m + ' min has an empty segment');
    }
  });
  Object.keys(LEVELS).forEach(t => Object.keys(LEVELS[t]).forEach(lv => {
    const L = LEVELS[t][lv], s = GEN[t](L.min, +lv), total = s.reduce((a, x) => a + x.sec, 0);
    const work = s.filter(x => x.name.indexOf(t === 'hiit' ? 'Max Effort' : 'Tempo') === 0).length, want = t === 'hiit' ? L.rounds : L.blocks;
    if (total !== L.min * 60) errs.push(t + ' level ' + lv + ' adds up to ' + (total / 60) + ' min, not ' + L.min);
    if (work !== want) errs.push(t + ' level ' + lv + ' has ' + work + ' work segments, not ' + want);
    if (s.some(x => !(x.sec > 0))) errs.push(t + ' level ' + lv + ' has an empty segment');
  }));
  if ([12.5, 2.5, 55, 20].map(normLb).join() !== '10,5,50,20') errs.push('dumbbell rounding is off');
  if (!PLAN) errs.push('plan.json not loaded');
  else PLAN.days.forEach(d => { if (rideCfg[d.key] && !segsFor(d.key, rideCfg[d.key]).length) errs.push(d.key + ' ride has no segments'); });
  if (!$('refBtn')) errs.push('refresh button missing');
  if (REST_SEC !== 75) errs.push('finisher rest timer not 75s');
  if (!hasCrypto()) errs.push('Web Crypto unavailable (use https or localhost)');
  return errs.length ? errs : 'OK';
};

/* ================= Init ================= */
let lastFetch = 0;
function applyPlan(p) {
  PLAN = p; state = loadState(p.weekOf);
  Object.keys(rideCfg).forEach(k => { delete rideCfg[k]; });
  PLAN.days.forEach(d => {
    if (d.ride) rideCfg[d.key] = { type:d.ride.type, dur:d.ride.minutes, diff:'norm' };
    else if (d.deload) rideCfg[d.key] = { type:'easy', dur:EASY_MIN, diff:'norm' };
  });
  adjOpen = false; planOpen = false;
  renderWork();
}
function refreshPlan(force) {
  if (!force && Date.now() - lastFetch < 10 * 60000) return Promise.resolve();
  lastFetch = Date.now();
  return loadPlan().then(p => {
    if (!PLAN || p.weekOf !== PLAN.weekOf || p.generatedAt !== PLAN.generatedAt) applyPlan(p);
    return loadCoach();
  });
}
const weekEl = document.createElement('div'); weekEl.id = 'week';
$('v-work').insertBefore(weekEl, $('days'));
$('day').innerHTML = '<div class="card state"><span class="spin lt"></span>Loading this week’s plan…</div>';
showTab('work');
refreshPlan(true).catch(() => { $('day').innerHTML = '<div class="card state" role="alert">Couldn’t load plan.json. Check the push on GitHub, wait 2 minutes, then reopen the app.</div>'; });
})();
