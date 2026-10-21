(function () {
'use strict';

/* ---------- Constants & plan data ---------- */
var $ = function (id) { return document.getElementById(id); };
var KEYS = ['mon','tue','wed','thu','fri','sat','sun'];
var SKEY = 'heartplan.v2', RKEY = 'heartplan.ride', TKEY = 'heartplan.tab',
    SNDKEY = 'heartplan.sound', HKEY = 'heartplan.hint', WKEY = 'heartplan.weights';
var THREE_H = 3 * 3600 * 1000;

var HOURS_TT = { king: '7:30a–12:30p · 6:30–8p*', west: '8a–1p · 5:30–7p' };
var FOOT = '*Limited lanes. Buy passes in advance via the City of Berkeley Online Rec Catalog. No payment on deck.';
var REST = 'No structured workouts. Let HRV rebound, allow muscle repair, and lower baseline heart tension.';
var SWIM = { kind: 'swim', text: '45 min steady swim' };

/* Dumbbell finishers: superset A, then superset B. w = default weight (lb), q = video search */
var FIN = {
  tue: { title:'Workout A', ex:[
    { id:'gsq',  g:'A', name:'Goblet Squat',      sets:3, reps:'10–12',      per:'1 dumbbell', w:20,
      q:'dumbbell goblet squat form',
      cue:'Hold one end at your chest. Sit down between your heels, chest tall.' },
    { id:'fp',   g:'A', name:'Floor Press',       sets:3, reps:'10–12',      per:'each hand',  w:15,
      q:'dumbbell floor press form',
      cue:'Lie on the floor, elbows at 45°. Lower until upper arms touch, press up.' },
    { id:'rl',   g:'B', name:'Reverse Lunge',     sets:3, reps:'8 per leg',  per:'each hand',  w:12.5,
      q:'dumbbell reverse lunge form',
      cue:'Step back, back knee toward the floor, drive through the front heel.' },
    { id:'row1', g:'B', name:'One-Arm Row',       sets:3, reps:'10 per arm', per:'1 dumbbell', w:20,
      q:'one arm dumbbell row form',
      cue:'Hand on a chair, feet staggered. Pull elbow to hip, back flat.' }
  ]},
  thu: { title:'Workout B', ex:[
    { id:'rdl',  g:'A', name:'Romanian Deadlift', sets:3, reps:'10–12',      per:'each hand',  w:20,
      q:'dumbbell romanian deadlift form',
      cue:'Soft knees, push hips back, weights slide down your thighs. Back flat.' },
    { id:'ohp',  g:'A', name:'Overhead Press',    sets:3, reps:'8–10',       per:'each hand',  w:12.5,
      q:'standing dumbbell overhead press form',
      cue:'Standing, ribs down, glutes tight. Press straight up without arching.' },
    { id:'ssq',  g:'B', name:'Split Squat',       sets:3, reps:'8 per leg',  per:'each hand',  w:12.5,
      q:'dumbbell split squat form',
      cue:'Staggered stance, drop straight down. Front knee tracks over toes.' },
    { id:'bor',  g:'B', name:'Bent-Over Row',     sets:3, reps:'10–12',      per:'each hand',  w:15,
      q:'dumbbell bent over row form',
      cue:'Hinge to about 45°, pull both elbows back, squeeze shoulder blades.' }
  ]}
};

/* Exercise drawings (inline SVG, 60×60). h = head, d = dumbbell, a = movement arrow, b = chair */
var GROUND = '<path class="g" d="M5 54H55"/>';
function hd(x, y) { return '<circle class="h" cx="' + x + '" cy="' + y + '" r="4"/>'; }
var FIG = {
  gsq:  hd(26,13) + '<path d="M26 18L23 33L35 35L33 52L39 52"/><path d="M25 21L32 27"/>' +
        '<path class="d" d="M33 21L33 29"/><path class="a" d="M47 14V30M43 26L47 30L51 26"/>',
  fp:   hd(10,50) + '<path d="M14 51L32 51"/><path d="M32 51L40 40L46 53"/><path d="M17 50L17 31"/>' +
        '<path class="d" d="M13 29L21 29"/><path class="a" d="M28 42V26M24 30L28 26L32 30"/>',
  rl:   hd(30,14) + '<path d="M30 19L30 34"/><path d="M30 34L41 35L41 53L46 53"/><path d="M30 34L21 50L11 53"/>' +
        '<path d="M30 21L33 33"/><path class="d" d="M29 35L37 35"/><path class="a" d="M24 9H10M14 5L10 9L14 13"/>',
  row1: '<path class="b" d="M40 36H52M50 36V54M42 36V54"/>' + hd(36,23) +
        '<path d="M18 30L32 26"/><path d="M18 30L14 53M18 30L24 53"/><path d="M32 27L42 36"/><path d="M30 27L30 40"/>' +
        '<path class="d" d="M26 42L34 42"/><path class="a" d="M8 44V30M4 34L8 30L12 34"/>',
  rdl:  hd(37,20) + '<path d="M20 26L33 22"/><path d="M20 26L24 40L22 53L28 53"/><path d="M31 23L31 42"/>' +
        '<path class="d" d="M27 44L35 44"/><path class="a" d="M22 14Q14 14 12 22M9 19L12 22L15 19"/>',
  ohp:  hd(30,12) + '<path d="M30 16L30 34"/><path d="M30 34L24 53M30 34L36 53"/><path d="M22 19H38"/>' +
        '<path d="M22 19L20 8M38 19L40 8"/><path class="d" d="M16 6L24 6M36 6L44 6"/>' +
        '<path class="a" d="M52 28V14M48 18L52 14L56 18"/>',
  ssq:  hd(30,14) + '<path d="M30 19L30 34"/><path d="M30 34L40 36L40 53L45 53"/><path d="M30 34L22 49L13 53"/>' +
        '<path d="M30 21L32 33"/><path class="d" d="M28 35L36 35"/><path class="a" d="M50 14V28M46 24L50 28L54 24"/>',
  bor:  hd(37,15) + '<path d="M22 30L33 18"/><path d="M22 30L26 41L24 53L30 53"/><path d="M32 19L32 36"/>' +
        '<path class="d" d="M28 38L36 38"/><path class="a" d="M44 40V26M40 30L44 26L48 30"/>'
};
function ytUrl(q) { return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q); }

var PLAN = [
  { key:'mon', name:'Monday', zone:'Zone 5', zc:'z5', focus:'VO2 Max', title:'The HIIT Engine', short:'HIIT bike',
    text:'30 min stationary bike. Warm up, then 4 rounds of 3 min max effort + 3 min easy spin.', preset:'mon' },
  { key:'tue', name:'Tuesday', zone:'Zone 2', zc:'z2', focus:'Endurance', title:'Swim or Bike Cruise', short:'Swim / cruise',
    opts:[SWIM, { kind:'bike', text:'45–60 min home bike cruise (conversational pace)', preset:'tue' }], fin:true },
  { key:'wed', name:'Wednesday', zone:'Zone 1-2', zc:'z1', focus:'Double Day', title:'Bike + Reformer Pilates', short:'Bike + Pilates',
    text:'20–30 min easy bike warm-up at home, immediately followed by Reformer Pilates.', preset:'wed' },
  { key:'thu', name:'Thursday', zone:'Zone 2-4', zc:'z34', focus:'Endurance', title:'Swim or Tempo Burn', short:'Swim / tempo',
    opts:[SWIM, { kind:'bike', text:'30–45 min bike tempo burn (comfortably hard)', preset:'thu' }], fin:true },
  { key:'fri', name:'Friday', zone:'Zone 2', zc:'z2', focus:'Double Day', title:'Bike + Reformer Pilates', short:'Bike + Pilates',
    text:'20–30 min steady bike base spin at home, immediately followed by Reformer Pilates.', preset:'fri' },
  { key:'sat', name:'Saturday', zone:'Rest', zc:'rest', focus:'Recovery', title:'Full Reset', short:'Rest', text:REST, rest:true },
  { key:'sun', name:'Sunday', zone:'Rest', zc:'rest', focus:'Recovery', title:'Full Reset', short:'Rest', text:REST, rest:true }
];

var TYPES = {
  hiit:   { name:'HIIT Engine',         min:30, range:'30 min',    day:'Mon', dk:'mon' },
  cruise: { name:'Zone 2 Cruise',       min:45, range:'45–60 min', day:'Tue', dk:'tue' },
  warm:   { name:'Pre-Pilates Warm-up', min:20, range:'20–30 min', day:'Wed', dk:'wed' },
  tempo:  { name:'Tempo Burn',          min:35, range:'30–45 min', day:'Thu', dk:'thu' },
  base:   { name:'Steady Base Spin',    min:25, range:'20–30 min', day:'Fri', dk:'fri' }
};
var PRESET = { mon:'hiit', tue:'cruise', wed:'warm', thu:'tempo', fri:'base' };
var DIFF = { easy:{ name:'Easier', off:-3 }, norm:{ name:'Plan default', off:0 }, hard:{ name:'Harder', off:4 } };

/* Segment colors: two shades per zone family, so consecutive segments never share a color */
var SEGPAL = {
  z1:  ['#7dd3fc', '#a78bfa'],
  z2:  ['#34d399', '#a3e635'],
  z34: ['#fbbf24', '#fb923c'],
  z5:  ['#f87171', '#f472b6']
};

/* ---------- Helpers ---------- */
function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
function fmt(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function rng(r) { return r[0] + '–' + r[1]; }
function todayIdx() { return (new Date().getDay() + 6) % 7; }
function mondayOf(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; }
function weekKey() { return mondayOf(new Date()).toDateString(); }
function zoneKey(z) {
  if (/5/.test(z)) return 'z5';
  if (/[34]/.test(z)) return 'z34';
  if (z === 'Zone 2') return 'z2';
  return 'z1';
}
function zoneColor(z) { return 'var(--' + zoneKey(z) + ')'; }
function colorize(segs) {
  var prev = null;
  segs.forEach(function (s) {
    var p = SEGPAL[zoneKey(s.zone)];
    s.color = (p[0] === prev) ? p[1] : p[0];
    prev = s.color;
  });
  return segs;
}
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

/* ---------- Dumbbell weights (kept across weeks) ---------- */
var weights = {};
try { var w0 = JSON.parse(lsGet(WKEY)); if (w0 && typeof w0 === 'object') weights = w0; } catch (e) {}
function wOf(ex) { var v = +weights[ex.id]; return (v > 0 && v <= 100) ? v : ex.w; }
function fmtW(v) { return (v % 1 ? v.toFixed(1) : String(v)) + ' lb'; }
function findEx(id) {
  var all = FIN.tue.ex.concat(FIN.thu.ex);
  for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
  return null;
}

/* ---------- Segment generation (heart-health tuned) ---------- */
function S(name, min, cad, res, zone, cue, cool) {
  return { name:name, sec:min * 60, cad:cad, res:res, zone:zone, cue:cue, cool:!!cool };
}
function split(total, n) {
  var b = Math.floor(total / n), r = total % n, out = [];
  for (var i = 0; i < n; i++) out.push(b + (i < r ? 1 : 0));
  return out;
}
function warmBlock(m) {
  if (m <= 0) return [];
  if (m < 4) return [S('Warm-up', m, [80,90], [22,27], 'Zone 1', 'Easy flat road. Loosen up.')];
  return [
    S('Warm-up', m - 2, [80,90], [22,27], 'Zone 1', 'Easy flat road. Loosen up, settle your breathing.'),
    S('Build', 2, [88,95], [25,30], 'Zone 2', 'Lift cadence, add a few clicks. Prime heart and legs.')
  ];
}
function coolBlock(m) {
  return m > 0 ? [S('Cool Down', m, [75,85], [18,24], 'Zone 1', 'Spin it out. Let your heart rate fall.', true)] : [];
}
var GEN = {
  hiit: function (D) {
    var r = clamp(Math.floor((D - 4) / 6), 1, 8), left = D - 6 * r;
    var cd = clamp(Math.round(left * 0.2), 1, 5), wu = Math.min(left - cd, 8), extra = left - cd - wu;
    var s = warmBlock(wu);
    for (var i = 1; i <= r; i++) {
      var easyMin = (i === r && cd === 1) ? 2 : 3;
      s.push(S('Max Effort ' + i + '/' + r, 3, [85,95], [45,52], 'Zone 5',
        'Seated, strong and steady for 3 min. Empty the tank in the last 30s.'));
      s.push(S('Easy Spin ' + i + '/' + r, easyMin, [80,90], [22,27], 'Zone 1-2',
        'Flat road. Drop resistance, deep breaths, let heart rate recover.'));
    }
    if (extra > 0) s.push(S('Zone 2 Settle', extra, [85,95], [26,31], 'Zone 2', 'Steady and conversational.'));
    return s.concat(coolBlock(cd === 1 ? 2 : cd));
  },
  cruise: function (D) {
    var wu = D >= 25 ? 5 : 3, cd = D >= 25 ? 5 : 2, main = D - wu - cd, n = Math.max(1, Math.round(main / 5));
    var mid = split(main, n).map(function (m, i) {
      return i % 2 === 0
        ? S('Cruise · Quick Legs', m, [85,95], [26,31], 'Zone 2', 'Conversational pace. Light, quick pedal stroke.')
        : S('Cruise · Road Feel', m, [78,86], [28,33], 'Zone 2', 'A bit more road under you. Still able to talk.');
    });
    return warmBlock(wu).concat(mid, coolBlock(cd));
  },
  warm: function (D) {
    var a = Math.round(D * 0.25), b = Math.round(D * 0.35), c = Math.round(D * 0.25), d = D - a - b - c;
    return [
      S('Easy Spin', a, [80,90], [22,27], 'Zone 1', 'Loosen hips and ankles. No effort yet.'),
      S('Build 1', b, [85,95], [24,28], 'Zone 1-2', 'Light sweat, smooth pedal stroke.'),
      S('Build 2', c, [85,95], [26,30], 'Zone 2', 'Warm core and glutes. No leg burn.'),
      S('Ease Into Pilates', d, [75,85], [18,24], 'Zone 1', 'Flush the legs and bring HR down. Head to Reformer class.', true)
    ].filter(function (s) { return s.sec > 0; });
  },
  tempo: function (D) {
    var wu = D >= 25 ? 5 : 3, cd = D >= 25 ? 5 : 2, main = D - wu - cd, mid = [];
    if (main < 8) {
      if (main > 0) mid.push(S('Tempo', main, [80,90], [34,41], 'Zone 3-4', 'Comfortably hard. Short phrases only.'));
    } else {
      var r = Math.floor(main / 8);
      wu += main - 8 * r;
      for (var i = 1; i <= r; i++) {
        mid.push(S('Tempo ' + i + '/' + r, 6, [80,90], [34,41], 'Zone 3-4', 'Comfortably hard. Short phrases only.'));
        mid.push(S('Recover ' + i + '/' + r, 2, [85,95], [24,29], 'Zone 2', 'Ease off, keep the legs moving.'));
      }
    }
    return warmBlock(wu).concat(mid, coolBlock(cd));
  },
  base: function (D) {
    var su = D >= 20 ? 3 : 2, tr = D >= 20 ? 2 : 1, main = D - su - tr, n = Math.max(1, Math.ceil(main / 10));
    var mid = split(main, n).map(function (m, i) {
      return i % 2 === 0
        ? S('Steady Base ' + (i + 1) + '/' + n, m, [85,92], [26,31], 'Zone 2', 'Steady and conversational. Smooth, quick rhythm.')
        : S('Steady Base ' + (i + 1) + '/' + n, m, [80,88], [28,33], 'Zone 2', 'Add 2 clicks of road feel. Even pressure, easy breathing.');
    });
    return [S('Spin-up', su, [80,90], [23,28], 'Zone 1', 'Easy legs, find your rhythm.')]
      .concat(mid, [S('Transition', tr, [75,85], [18,24], 'Zone 1', 'Flush the legs, ease off and head to Pilates.', true)]);
  }
};

/* Dev check: run heartplanSelfTest() in the console → "OK" or a list of problems */
window.heartplanSelfTest = function () {
  var errs = [];
  Object.keys(GEN).forEach(function (t) {
    for (var D = 10; D <= 90; D += 5) {
      var s = colorize(GEN[t](D)), sum = s.reduce(function (a, x) { return a + x.sec; }, 0);
      if (sum !== D * 60) errs.push(t + ' ' + D + ' min sums to ' + sum / 60);
      if (s.some(function (x) { return !(x.sec > 0); })) errs.push(t + ' ' + D + ' has a zero/negative segment');
      for (var i = 1; i < s.length; i++) {
        if (s[i].color === s[i - 1].color) errs.push(t + ' ' + D + ' segments ' + i + '/' + (i + 1) + ' share a color');
      }
    }
  });
  FIN.tue.ex.concat(FIN.thu.ex).forEach(function (e) { if (!FIG[e.id]) errs.push('missing drawing: ' + e.id); });
  return errs.length ? errs : 'OK';
};

/* ---------- Check-off state ---------- */
function fresh() {
  var days = {};
  KEYS.forEach(function (k) { days[k] = { done:false, fin:false }; });
  return { week: weekKey(), days: days };
}
function load() {
  try {
    var s = JSON.parse(lsGet(SKEY));
    if (s && s.week === weekKey() && s.days && typeof s.days === 'object') {
      var f = fresh();
      KEYS.forEach(function (k) { var d = s.days[k] || {}; f.days[k] = { done:!!d.done, fin:!!d.fin }; });
      return f;
    }
  } catch (e) {}
  return fresh();
}
function save() { lsSet(SKEY, JSON.stringify(state)); }
function checkWeek() {
  if (state.week !== weekKey()) { state = fresh(); save(); }
}
function targets() {
  var d = state.days;
  return [
    { name:'Monday HIIT', sub:'Zone 5 VO2 max', n:+d.mon.done, goal:1 },
    { name:'Aerobic base sessions', sub:'Tue / Thu swim or bike', n:d.tue.done + d.thu.done, goal:2 },
    { name:'Reformer Pilates', sub:'Wed / Fri', n:d.wed.done + d.fri.done, goal:2 },
    { name:'Strength finishers', sub:'Tue / Thu dumbbell workouts A + B', n:d.tue.fin + d.thu.fin, goal:2 },
    { name:'Rest days', sub:'Sat / Sun', n:d.sat.done + d.sun.done, goal:2 }
  ];
}
function metCount() { return targets().filter(function (t) { return t.n >= t.goal; }).length; }

var state = load();
var viewIdx = todayIdx();

/* ---------- Ride state ---------- */
var ride = { preset:'mon', type:'hiit', dur:30, diff:'norm', segs:[], starts:[], ends:[], total:0 };
var tm = { acc:0, startedAt:0, running:false, finished:false, restored:false };
var iv = null, lastIdx = 0, lastBeep = '', lastHi = -2, cueT = null;

function build() {
  var off = DIFF[ride.diff].off;
  ride.segs = colorize(GEN[ride.type](ride.dur).map(function (s) {
    var res = (s.cool || !off) ? s.res.slice() : s.res.map(function (v) { return clamp(v + off, 0, 100); });
    return { name:s.name, sec:s.sec, cad:s.cad.slice(), res:res, zone:s.zone, cue:s.cue, cool:s.cool };
  }));
  ride.starts = []; ride.ends = [];
  var t = 0;
  ride.segs.forEach(function (s) { ride.starts.push(t); t += s.sec * 1000; ride.ends.push(t); });
  ride.total = t;
}
function elapsed() { return Math.max(0, tm.acc + (tm.running ? Date.now() - tm.startedAt : 0)); }
function idxAt(el) {
  for (var i = 0; i < ride.ends.length; i++) if (el < ride.ends[i]) return i;
  return ride.ends.length - 1;
}
function saveRide() {
  lsSet(RKEY, JSON.stringify({ preset:ride.preset, type:ride.type, dur:ride.dur, diff:ride.diff,
    acc:tm.acc, startedAt:tm.startedAt, running:tm.running, savedAt:Date.now() }));
}
function saveRideIfActive() { if (!tm.finished && (tm.running || tm.acc > 0)) saveRide(); }
function clearRide() { lsDel(RKEY); }
function startTick() { if (!iv) iv = setInterval(tick, 250); }
function stopTick() { if (iv) { clearInterval(iv); iv = null; } }

/* ---------- Visual segment-change cue ---------- */
function flash(color) {
  var f = $('flash');
  f.style.setProperty('--fc', color);
  f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
}
function segCue(i) {
  var s = ride.segs[i];
  if (!s) return;
  flash(s.color);
  var c = $('tCard');
  c.style.setProperty('--zc', s.color);
  c.classList.remove('changed'); void c.offsetWidth; c.classList.add('changed');
  clearTimeout(cueT);
  cueT = setTimeout(function () { c.classList.remove('changed'); }, 6000);
  try { if (navigator.vibrate) navigator.vibrate([180, 80, 180]); } catch (e) {}
}
function clearCue() {
  clearTimeout(cueT);
  $('tCard').classList.remove('changed', 'soon');
}

function resetTimer() {
  stopTick(); lockOff(); clearCue();
  tm = { acc:0, startedAt:0, running:false, finished:false, restored:false };
  lastIdx = 0; lastBeep = '';
}
function inProgress() { return !tm.finished && (tm.running || elapsed() > 0); }

function restoreRide() {
  var r = null;
  try { r = JSON.parse(lsGet(RKEY)); } catch (e) {}
  if (!r || typeof r !== 'object') return false;
  var age = Date.now() - (+r.savedAt || 0);
  if (!TYPES[r.type] || !(age >= 0 && age < THREE_H)) { clearRide(); return false; }
  var dur = +r.dur;
  ride.type = r.type;
  ride.preset = PRESET[r.preset] ? r.preset : TYPES[r.type].dk;
  ride.dur = (dur >= 10 && dur <= 90 && dur % 5 === 0) ? dur : TYPES[r.type].min;
  ride.diff = DIFF[r.diff] ? r.diff : 'norm';
  build();
  var el = (+r.acc || 0) + (r.running ? Math.max(0, Date.now() - (+r.startedAt || Date.now())) : 0);
  el = Math.max(0, el);
  if (el >= ride.total) {
    tm.finished = true; tm.acc = ride.total; clearRide();
  } else {
    tm.acc = el; tm.restored = el > 0; lastIdx = idxAt(el);
    saveRide();
  }
  return true;
}

/* ---------- Audio ---------- */
var actx = null;
var soundOn = lsGet(SNDKEY) !== '0';
function audioUnlock() {
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!actx) actx = new AC();
    if (actx.state !== 'running') { var p = actx.resume(); if (p && p.catch) p.catch(function () {}); }
    var b = actx.createBuffer(1, 1, 22050), src = actx.createBufferSource();
    src.buffer = b; src.connect(actx.destination); src.start(0);
  } catch (e) {}
}
function resumeAudio() {
  if (!actx || actx.state === 'running') return;
  try { var p = actx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
}
function beep(f, dur, when) {
  if (!soundOn || !actx) return;
  try {
    var t = actx.currentTime + (when || 0);
    var o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  } catch (e) {}
}
function chime() { beep(988, 0.25, 0); beep(1175, 0.25, 0.25); beep(1568, 0.45, 0.5); }

/* ---------- Wake lock ---------- */
var wl = null, hintShown = false;
function showHint() {
  if (hintShown || lsGet(HKEY) === '1') return;
  hintShown = true; $('hint').hidden = false;
}
function lockOn() {
  if (wl) return;
  if (!('wakeLock' in navigator)) { showHint(); return; }
  try {
    navigator.wakeLock.request('screen').then(function (s) {
      if (!tm.running) { s.release().catch(function () {}); return; }
      wl = s;
      s.addEventListener('release', function () { if (wl === s) wl = null; });
    }).catch(function () { showHint(); });
  } catch (e) { showHint(); }
}
function lockOff() {
  if (!wl) return;
  try { wl.release().catch(function () {}); } catch (e) {}
  wl = null;
}

/* ---------- Timer actions ---------- */
function start() {
  var el = elapsed();
  tm.startedAt = Date.now(); tm.running = true; tm.restored = false; tm.finished = false;
  lastIdx = idxAt(el); lastBeep = '';
  if (el === 0) { beep(1320, 0.35); segCue(0); }
  startTick(); lockOn(); saveRide(); updateTimer();
}
function pause() {
  tm.acc = elapsed(); tm.running = false;
  stopTick(); lockOff(); saveRide(); updateTimer();
}
function finish(live) {
  stopTick(); lockOff(); clearCue();
  tm.running = false; tm.finished = true; tm.acc = ride.total; tm.restored = false;
  clearRide();
  if (live) { chime(); flash('#34d399'); }
  updateTimer();
}
function seek(ms) {
  ms = clamp(ms, 0, ride.total);
  tm.acc = ms; tm.finished = false;
  if (tm.running) tm.startedAt = Date.now();
  lastIdx = idxAt(ms); lastBeep = '';
  if (tm.running) beep(1320, 0.35);
  segCue(lastIdx);
  saveRide(); updateTimer();
}
function prevSeg() {
  if (tm.finished) { tm.finished = false; seek(ride.starts[ride.segs.length - 1]); return; }
  var el = elapsed(), i = idxAt(el);
  if (el - ride.starts[i] > 3000) seek(ride.starts[i]);
  else seek(ride.starts[Math.max(0, i - 1)]);
}
function nextSeg() {
  if (tm.finished) return;
  var i = idxAt(elapsed());
  if (i >= ride.segs.length - 1) finish(true);
  else seek(ride.starts[i + 1]);
}
function tick() {
  var el = elapsed();
  if (tm.running && el >= ride.total) { finish(true); return; }
  if (tm.running) {
    var i = idxAt(el);
    if (i !== lastIdx) { lastIdx = i; lastBeep = ''; beep(1320, 0.35); segCue(i); }
    else {
      var rem = Math.ceil((ride.ends[i] - el) / 1000);
      if (rem >= 1 && rem <= 3) {
        var k = i + ':' + rem;
        if (k !== lastBeep) { lastBeep = k; beep(880, 0.12); }
      }
    }
  }
  updateTimer();
}
function loadPreset(p) {
  var t = PRESET[p];
  if (!t) return false;
  if (ride.preset === p && ride.type === t && inProgress()) return true;
  if (inProgress() && !confirm('Replace the ride in progress?')) return false;
  if (p !== ride.preset) clearRide();
  ride.preset = p; ride.type = t; ride.dur = TYPES[t].min;
  build(); resetTimer(); renderRide();
  return true;
}

/* ---------- Rendering ---------- */
function checkRow(key, field, label, sub, big) {
  var on = state.days[key][field];
  return '<button class="check' + (big ? ' big' : '') + (on ? ' on' : '') + '" data-toggle="' + key + ':' + field +
    '" aria-pressed="' + on + '"><span class="box">✓</span><span><b>' + label + '</b>' +
    (sub ? '<small>' + sub + '</small>' : '') + '</span></button>';
}
function hoursList(h) {
  return '<ul class="hours"><li><b>King Pool</b> ' + h.king + '</li><li><b>West Campus</b> ' + h.west + '</li></ul>';
}
function finisherCard(key) {
  var F = FIN[key], h = '<div class="card">';
  h += '<div class="fhead"><h2 class="title">Required finisher</h2><span class="pill c-z34">Dumbbells</span></div>';
  h += '<p class="fsub">' + F.title + ' · ~15 min · rest 60–90 s after each round</p>';
  ['A', 'B'].forEach(function (g) {
    h += '<div class="ssh">Superset ' + g + ' · alternate · 3 rounds</div>';
    F.ex.filter(function (e) { return e.g === g; }).forEach(function (e, j) {
      h += '<div class="ex">' +
           '<svg class="fig" viewBox="0 0 60 60" role="img" aria-label="' + e.name + ' drawing">' + GROUND + FIG[e.id] + '</svg>' +
           '<div class="exm"><b>' + g + (j + 1) + ' · ' + e.name + '</b>' +
           '<small>' + e.sets + ' × ' + e.reps + ' · ' + e.per + '</small>' +
           '<small class="excue">' + e.cue + '</small></div>' +
           '<div class="exa"><div class="wt">' +
           '<button class="wb" data-wt="' + e.id + ':-1" aria-label="Lighter ' + e.name + '">−</button>' +
           '<span id="w-' + e.id + '">' + fmtW(wOf(e)) + '</span>' +
           '<button class="wb" data-wt="' + e.id + ':1" aria-label="Heavier ' + e.name + '">+</button></div>' +
           '<a class="watch" href="' + ytUrl(e.q) + '" target="_blank" rel="noopener noreferrer">Watch how ↗</a>' +
           '</div></div>';
    });
  });
  h += '<details class="tips"><summary>How to pick the weight</summary><ul>' +
       '<li>Pick a weight where the <b>last 2 reps are hard</b> but your form stays clean.</li>' +
       '<li>Hit the top of the rep range on all 3 sets? <b>Add 2.5–5 lb</b> next time.</li>' +
       '<li><b>Exhale as you lift.</b> Don’t hold your breath; it spikes blood pressure.</li>' +
       '<li>Rest until you can talk easily before starting the next round.</li>' +
       '</ul></details></div>';
  h += checkRow(key, 'fin', 'Finisher done', 'Supersets A + B, 3 rounds each', true);
  return h;
}
function renderToday() {
  var d = PLAN[viewIdx], isToday = viewIdx === todayIdx(), h = '';
  h += '<div class="dayhead"><button class="arrow" data-act="day-prev" aria-label="Previous day">‹</button>' +
       '<div><div class="lbl todaylbl"' + (isToday ? '' : ' style="visibility:hidden"') + '>Today</div><h1>' + d.name + '</h1></div>' +
       '<button class="arrow" data-act="day-next" aria-label="Next day">›</button></div>';
  h += '<div class="zone"><span class="pill c-' + d.zc + '">' + d.zone + '</span><span class="muted">' + d.focus + '</span></div>';
  h += '<div class="card"><h2 class="title">' + d.title + '</h2>';
  if (d.opts) {
    d.opts.forEach(function (o, i) {
      h += '<div class="opt"><span class="badge">' + 'AB'[i] + '</span><div class="ob"><div>' + o.text + '</div>';
      if (o.kind === 'swim') h += hoursList(HOURS_TT) + '<p class="fn">' + FOOT + '</p>';
      else h += '<button class="btn primary sm" data-preset="' + o.preset + '" data-tab="ride">Start ride →</button>';
      h += '</div></div>';
    });
  } else {
    h += '<p class="body">' + d.text + '</p>';
    if (d.preset) h += '<button class="btn primary mt" data-preset="' + d.preset + '" data-tab="ride">Start ' + TYPES[PRESET[d.preset]].name + ' →</button>';
  }
  h += '</div>';
  if (d.fin) h += finisherCard(d.key);
  h += checkRow(d.key, 'done', d.rest ? 'Rest day taken' : 'Workout done', '', false);
  var m = metCount();
  h += '<div class="card"><div class="row"><span class="muted">This week</span><b>' + m + ' / 5 targets</b></div>' +
       '<div class="bar"><i style="width:' + m * 20 + '%"></i></div></div>';
  $('v-today').innerHTML = h;
}
function renderWeek() {
  var mon = mondayOf(new Date()), ts = targets(), m = metCount(), ti = todayIdx(), h = '';
  h += '<div class="lbl">Week of ' + mon.toLocaleDateString(undefined, { month:'short', day:'numeric' }) + '</div><h1>This Week</h1>';
  h += '<div class="card"><div class="row"><b>Targets</b><b>' + m + ' / 5</b></div><div class="bar mb"><i style="width:' + m * 20 + '%"></i></div>';
  ts.forEach(function (t) {
    var met = t.n >= t.goal;
    h += '<div class="trow"><div><div>' + t.name + '</div><small>' + t.sub + '</small></div><span class="cnt' + (met ? ' met' : '') + '">' +
         (met ? '✓ ' : '') + t.n + ' / ' + t.goal + '</span></div>';
  });
  h += '</div><div class="card">';
  PLAN.forEach(function (d, i) {
    var s = state.days[d.key];
    h += '<div class="drow' + (i === ti ? ' is-today' : '') + '">' +
         '<button class="dmain" data-goto="' + i + '"><span class="dn">' + d.name.slice(0, 3) + '</span>' +
         '<span class="pill c-' + d.zc + '">' + d.zone + '</span><span class="dl">' + d.short + '</span></button>' +
         (d.fin ? '<button class="mini' + (s.fin ? ' on' : '') + '" data-toggle="' + d.key + ':fin" aria-pressed="' + s.fin + '"><span>Finisher</span></button>' : '') +
         '<button class="cb' + (s.done ? ' on' : '') + '" data-toggle="' + d.key + ':done" aria-pressed="' + s.done + '" aria-label="' + d.name + ' done"><span class="box">✓</span></button></div>';
  });
  h += '</div>';
  h += '<details class="card"><summary>Berkeley lap swim hours</summary><table>' +
       '<thead><tr><th></th><th>Tue / Thu</th><th>Mon / Wed / Fri</th></tr></thead><tbody>' +
       '<tr><th>King Pool<small>1700 Hopkins St</small></th><td>7:30a–12:30p<br>6:30–8p*</td><td>7:30a–12:30p<br>6–8p</td></tr>' +
       '<tr><th>West Campus<small>2100 Browning St</small></th><td>8a–1p<br>5:30–7p</td><td>9a–1p<br>5–7p</td></tr>' +
       '</tbody></table><p class="fn">' + FOOT + '</p></details>';
  h += '<div class="center"><button class="textbtn" data-act="reset-week">Reset week</button></div>';
  $('v-week').innerHTML = h;
}
function renderRide() {
  var T = TYPES[ride.type];
  document.querySelectorAll('.chip').forEach(function (c) {
    c.classList.toggle('on', c.dataset.preset === ride.preset && PRESET[ride.preset] === ride.type);
  });
  $('sumTitle').textContent = T.name + ' · ' + ride.dur + ' min';
  $('sumSub').textContent = DIFF[ride.diff].name + ' · plan: ' + T.range;
  $('selType').value = ride.type; $('selDur').value = String(ride.dur); $('selDiff').value = ride.diff;
  $('planSum').textContent = 'Show ride plan (' + ride.segs.length + ' segments)';
  $('planList').innerHTML = ride.segs.map(function (s) {
    return '<li style="--sc:' + s.color + '"><span>' + s.name + '</span><span>' + fmt(s.sec) + '</span><small><span style="color:' + zoneColor(s.zone) + '">' +
           s.zone + '</span> · ' + rng(s.cad) + ' rpm · R ' + rng(s.res) + '</small></li>';
  }).join('');
  $('sndBtn').textContent = 'Sound: ' + (soundOn ? 'On' : 'Off');
  lastHi = -2;
  updateTimer();
}
function updateTimer() {
  var el = elapsed(), n = ride.segs.length, totalSec = ride.total / 1000, hi, card = $('tCard');
  if (tm.finished) {
    $('tSegNo').textContent = 'Finished';
    $('tName').textContent = 'Ride complete 🎉';
    $('tClock').textContent = '0:00';
    $('tCue').textContent = 'Nice work. Log it below.';
    $('tCad').textContent = '–'; $('tRes').textContent = '–';
    $('tZone').textContent = '–'; $('tZone').style.color = '';
    card.style.setProperty('--zc', '#34d399');
    card.classList.remove('soon');
    $('tBar').style.width = '100%';
    $('tDone').textContent = fmt(totalSec) + ' done';
    $('tLeft').textContent = '0:00 left';
    $('tNext').textContent = '';
    hi = -1;
  } else {
    var i = idxAt(el), s = ride.segs[i], remain = Math.ceil((ride.ends[i] - el) / 1000);
    var done = Math.floor(el / 1000);
    $('tSegNo').textContent = 'Segment ' + (i + 1) + ' of ' + n;
    $('tName').textContent = s.name;
    $('tClock').textContent = fmt(remain);
    $('tCue').textContent = s.cue;
    $('tCad').textContent = rng(s.cad);
    $('tRes').textContent = rng(s.res);
    $('tZone').textContent = s.zone; $('tZone').style.color = zoneColor(s.zone);
    card.style.setProperty('--zc', s.color);
    $('tBar').style.width = (ride.total ? el / ride.total * 100 : 0) + '%';
    $('tDone').textContent = fmt(done) + ' done';
    $('tLeft').textContent = fmt(totalSec - done) + ' left';
    var soon = tm.running && i < n - 1 && remain <= 5;
    if (i < n - 1) {
      var ns = ride.segs[i + 1];
      card.style.setProperty('--nzc', ns.color);
      $('tNext').innerHTML = 'Next: <span class="dot" style="background:' + ns.color + '"></span><b style="color:' + ns.color + '">' +
        ns.name + '</b> · ' + fmt(ns.sec) + ' · ' + rng(ns.cad) + ' rpm · R ' + rng(ns.res);
    } else $('tNext').textContent = 'Last segment';
    card.classList.toggle('soon', soon);
    hi = i;
  }
  $('mainBtn').textContent = tm.finished ? 'Restart' : tm.running ? 'Pause' : el > 0 ? 'Resume' : 'Start';
  $('note').hidden = !tm.restored;
  var T = TYPES[ride.type];
  $('markBtn').textContent = 'Mark ' + T.day + ' done ✓';
  $('markBtn').hidden = !(tm.finished && !state.days[T.dk].done);
  if (hi !== lastHi) {
    var rows = $('planList').children;
    for (var r = 0; r < rows.length; r++) rows[r].classList.toggle('cur', r === hi);
    lastHi = hi;
  }
}
function renderAll() { renderToday(); renderWeek(); renderRide(); }

var TABS = ['today', 'ride', 'week'];
function showTab(t) {
  if (TABS.indexOf(t) < 0) t = 'today';
  TABS.forEach(function (v) { $('v-' + v).hidden = v !== t; });
  document.querySelectorAll('.tab').forEach(function (b) {
    var on = b.dataset.tab === t;
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  try { sessionStorage.setItem(TKEY, t); } catch (e) {}
  window.scrollTo(0, 0);
}

/* ---------- Events (delegation) ---------- */
function act(a) {
  switch (a) {
    case 'day-prev': viewIdx = (viewIdx + 6) % 7; renderToday(); break;
    case 'day-next': viewIdx = (viewIdx + 1) % 7; renderToday(); break;
    case 'main':
      audioUnlock();
      if (tm.finished) { resetTimer(); start(); }
      else if (tm.running) pause();
      else start();
      break;
    case 'prev': audioUnlock(); prevSeg(); break;
    case 'next': audioUnlock(); nextSeg(); break;
    case 'reset': resetTimer(); clearRide(); updateTimer(); break;
    case 'sound':
      soundOn = !soundOn; lsSet(SNDKEY, soundOn ? '1' : '0');
      $('sndBtn').textContent = 'Sound: ' + (soundOn ? 'On' : 'Off');
      if (soundOn) { audioUnlock(); beep(880, 0.12); }
      break;
    case 'adjust':
      var open = $('settings').hidden;
      $('settings').hidden = !open;
      $('adjBtn').textContent = open ? 'Done' : 'Adjust';
      $('adjBtn').setAttribute('aria-expanded', String(open));
      break;
    case 'hint': $('hint').hidden = true; lsSet(HKEY, '1'); break;
    case 'mark': state.days[TYPES[ride.type].dk].done = true; save(); renderAll(); break;
    case 'reset-week':
      if (confirm('Clear all check-offs for this week?')) { state = fresh(); save(); renderAll(); }
      break;
  }
}
document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-preset],[data-tab],[data-toggle],[data-goto],[data-act],[data-wt]');
  if (!el) return;
  var ds = el.dataset;
  if (ds.wt) {
    var q = ds.wt.split(':'), ex = findEx(q[0]);
    if (ex) {
      var v = clamp(wOf(ex) + 2.5 * (+q[1] || 0), 2.5, 100);
      weights[ex.id] = v; lsSet(WKEY, JSON.stringify(weights));
      var sp = $('w-' + ex.id); if (sp) sp.textContent = fmtW(v);
    }
    return;
  }
  if (ds.preset !== undefined) { audioUnlock(); if (!loadPreset(ds.preset)) return; }
  if (ds.tab) { showTab(ds.tab); return; }
  if (ds.toggle) {
    var p = ds.toggle.split(':'), k = p[0], f = p[1];
    if (state.days[k] && (f === 'done' || f === 'fin')) { state.days[k][f] = !state.days[k][f]; save(); renderAll(); }
    return;
  }
  if (ds.goto !== undefined) { viewIdx = clamp(+ds.goto || 0, 0, 6); renderToday(); showTab('today'); return; }
  if (ds.act) act(ds.act);
});
document.addEventListener('change', function (e) {
  var k = e.target.dataset && e.target.dataset.ride;
  if (!k) return;
  var v = e.target.value;
  if (k === 'type' && TYPES[v]) { ride.type = v; ride.dur = TYPES[v].min; }
  else if (k === 'dur') { ride.dur = clamp(parseInt(v, 10) || 30, 10, 90); }
  else if (k === 'diff' && DIFF[v]) { ride.diff = v; }
  build(); resetTimer(); saveRide(); renderRide();
});
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible') {
    checkWeek(); resumeAudio();
    renderToday(); renderWeek();
    if (tm.running) { lockOn(); tick(); } else updateTimer();
  } else {
    saveRideIfActive();
  }
});
window.addEventListener('pagehide', saveRideIfActive);
window.addEventListener('pageshow', function (e) {
  if (e.persisted) { checkWeek(); renderToday(); renderWeek(); if (tm.running) tick(); else updateTimer(); }
});

/* ---------- Init ---------- */
$('selType').innerHTML = Object.keys(TYPES).map(function (k) {
  return '<option value="' + k + '">' + TYPES[k].name + ' (' + TYPES[k].day + ')</option>';
}).join('');
var durOpts = '';
for (var m = 10; m <= 90; m += 5) durOpts += '<option value="' + m + '">' + m + ' min</option>';
$('selDur').innerHTML = durOpts;
$('selDiff').innerHTML = Object.keys(DIFF).map(function (k) {
  return '<option value="' + k + '">' + DIFF[k].name + '</option>';
}).join('');

var tab = null;
try { tab = sessionStorage.getItem(TKEY); } catch (e) {}
var ti0 = todayIdx(), defPreset = ti0 < 5 ? KEYS[ti0] : 'mon';
ride.preset = defPreset; ride.type = PRESET[defPreset]; ride.dur = TYPES[ride.type].min;
if (restoreRide()) tab = 'ride'; else build();
renderAll();
showTab(tab || 'today');
})();
