#!/usr/bin/env node
// coach/encrypt.mjs: encrypts your progress history into ./history.enc for the app's Progress tab.
//
//   node coach/encrypt.mjs                                   # encrypts coach/history.json (uses macOS Keychain if saved)
//   node coach/encrypt.mjs --save-keychain                   # prompts once and saves passcode in macOS Keychain
//   node coach/encrypt.mjs --ask                             # prompts in Terminal even if Keychain is set
//   node coach/encrypt.mjs --new-salt                        # rotates salt (forces iPhone to re-prompt once)
//   node coach/encrypt.mjs --in coach/history.example.json   # fake data, for testing (always prompts)
//
// Before encrypting coach/history.json, the goal weight is copied from coach/profile.json
// (the one place you edit it) into history.goals.goalWeight, so the Progress tab can draw the goal line.
//
// Format (read by app.js): { v:1, kdf:"PBKDF2-SHA256", iter, salt, iv, ct }
//   key = PBKDF2-SHA256(passcode, salt, iter) -> 256-bit AES-GCM key
//   ct  = base64(ciphertext || 16-byte GCM tag).
//   When encrypting with the same passcode, the existing 16-byte salt from history.enc is reused with a
//   brand-new random 12-byte IV every run, so your iPhone stays unlocked across Sunday pushes.
//   Changing the passcode (or passing --new-salt) automatically generates a fresh salt.
//
// Passcode rule: 12+ plain keyboard characters (3 random words like cedar-lamp-otter works).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes, pbkdf2Sync, createCipheriv, createDecipheriv } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { userInfo } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ITER = 600000;
const MIN_LEN = 12;
const KEYCHAIN_SVC = 'heartplan-vault';
const DEFAULT_IN = resolve(ROOT, 'coach/history.json');
const PROFILE = resolve(ROOT, 'coach/profile.json');

const args = process.argv.slice(2);
const has = f => args.includes(f);
const inFlag = args.indexOf('--in');
const inPath = inFlag >= 0 && args[inFlag + 1] ? resolve(process.cwd(), args[inFlag + 1]) : DEFAULT_IN;
const outPath = resolve(ROOT, 'history.enc');

function fail(msg) { console.error('✗ ' + msg); process.exit(1); }

function validatePass(p) {
  if (!p || p.length < MIN_LEN) fail(`Passcode must be at least ${MIN_LEN} characters. 3 random words like cedar-lamp-otter works.`);
  if (!/^[\x20-\x7E]+$/.test(p)) fail('Use plain keyboard characters only (no emoji, accents or curly quotes), so it types the same on your iPhone.');
}

function readKeychain() {
  if (process.platform !== 'darwin') return null;
  try {
    const out = execFileSync('security', ['find-generic-password', '-s', KEYCHAIN_SVC, '-w'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
    }).replace(/[\r\n]+$/, '');
    return out || null;
  } catch { return null; }
}

function saveKeychain(p) {
  if (process.platform !== 'darwin') fail('--save-keychain is only supported on macOS.');
  try {
    execFileSync('security', [
      'add-generic-password', '-U', '-a', userInfo().username,
      '-s', KEYCHAIN_SVC, '-l', 'Heart Health Plan Progress', '-w', p
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (e) { fail(`Couldn't save to macOS Keychain: ${e.message}`); }
}

function askHidden(question) {
  return new Promise((res, rej) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      rej(new Error(`No passcode in macOS Keychain ("${KEYCHAIN_SVC}") and no interactive Terminal. Run "node coach/encrypt.mjs --save-keychain" once in Terminal.`));
      return;
    }
    process.stdout.write(question);
    let value = '';
    const done = () => { stdin.setRawMode(false); stdin.pause(); stdin.removeListener('data', onData); process.stdout.write('\n'); };
    const onData = chunk => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') { done(); res(value); return; }
        if (ch === '\u0003') { done(); process.exit(130); }            // Ctrl+C
        if (ch === '\u007f' || ch === '\b') { value = value.slice(0, -1); continue; }
        value += ch;
      }
    };
    stdin.setRawMode(true); stdin.setEncoding('utf8'); stdin.resume(); stdin.on('data', onData);
  });
}

let data;
try { data = JSON.parse(readFileSync(inPath, 'utf8')); }
catch (e) { fail(`Couldn't read ${relative(process.cwd(), inPath) || inPath}: ${e.message}`); }
if (!data || !Array.isArray(data.weeks)) fail('Expected a JSON object with a "weeks" array.');
data.weeks.forEach((w, i) => {
  if (!w || !/^\d{4}-\d{2}-\d{2}$/.test(w.weekOf || '')) fail(`Week ${i + 1}: weekOf must be a date like 2026-11-15.`);
  if (w.weighIn != null && typeof w.weighIn.lbs !== 'number') fail(`Week ${i + 1} (${w.weekOf}): weighIn.lbs must be a number, or set weighIn to null.`);
});

// Goal weight sync: coach/profile.json -> history (real history only, never the example file).
let goalChanged = false;
if (inPath === DEFAULT_IN && existsSync(PROFILE)) {
  let prof;
  try { prof = JSON.parse(readFileSync(PROFILE, 'utf8')); } catch (e) { fail(`Couldn't read coach/profile.json: ${e.message}`); }
  const who = prof.historyPerson || 'natalie';
  const g = prof.people && prof.people[who] ? prof.people[who].goalWeightLb : null;
  data.goals = data.goals || {};
  if (typeof g === 'number') {
    if (data.goals.goalWeight !== g) {
      console.log(`• Goal weight ${data.goals.goalWeight ?? 'not set'} → ${g} lb (from coach/profile.json)`);
      data.goals.goalWeight = g; goalChanged = true;
    }
  } else console.log('• No goalWeightLb in coach/profile.json yet, so the Progress tab will skip the goal line.');
}

const saveKc = has('--save-keychain');
const forceAsk = has('--ask') || saveKc || inPath !== DEFAULT_IN;
let pass = !forceAsk ? readKeychain() : null;
let fromKeychain = !!pass;

if (pass) {
  validatePass(pass);
} else {
  try {
    pass = await askHidden(`Passcode (${MIN_LEN}+ characters, e.g. 3 random words): `);
    validatePass(pass);
    const again = await askHidden('Type it again: ');
    if (again !== pass) fail("Passcodes didn't match. Nothing was written.");
    if (saveKc) saveKeychain(pass);
  } catch (e) { fail(e.message); }
}

// Reuse the existing 16-byte salt if this passcode unlocks the current history.enc (and --new-salt wasn't passed).
let salt = null, keptSalt = false;
if (!has('--new-salt') && existsSync(outPath)) {
  try {
    const prev = JSON.parse(readFileSync(outPath, 'utf8'));
    if (prev && prev.v === 1 && prev.kdf === 'PBKDF2-SHA256' && prev.iter === ITER && prev.salt && prev.iv && prev.ct) {
      const prevSalt = Buffer.from(prev.salt, 'base64');
      const prevIv = Buffer.from(prev.iv, 'base64');
      const prevCt = Buffer.from(prev.ct, 'base64');
      if (prevSalt.length === 16 && prevIv.length === 12 && prevCt.length > 16) {
        const testKey = pbkdf2Sync(pass, prevSalt, ITER, 32, 'sha256');
        const dec = createDecipheriv('aes-256-gcm', testKey, prevIv);
        dec.setAuthTag(prevCt.subarray(prevCt.length - 16));
        dec.update(prevCt.subarray(0, prevCt.length - 16));
        dec.final(); // succeeds only if the passcode matches
        salt = prevSalt; keptSalt = true;
      }
    }
  } catch { salt = null; keptSalt = false; }
}
if (!salt) salt = randomBytes(16);

const plain = Buffer.from(JSON.stringify(data), 'utf8');
const iv = randomBytes(12);
const key = pbkdf2Sync(pass, salt, ITER, 32, 'sha256');
const cipher = createCipheriv('aes-256-gcm', key, iv);
const ct = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);

// Round-trip check before writing
const decipher = createDecipheriv('aes-256-gcm', key, iv);
decipher.setAuthTag(ct.subarray(ct.length - 16));
const back = Buffer.concat([decipher.update(ct.subarray(0, ct.length - 16)), decipher.final()]);
if (!back.equals(plain)) fail('Self-check failed. Nothing was written.');

writeFileSync(outPath, JSON.stringify({
  v: 1, kdf: 'PBKDF2-SHA256', iter: ITER,
  salt: salt.toString('base64'), iv: iv.toString('base64'), ct: ct.toString('base64')
}) + '\n');
if (goalChanged) writeFileSync(inPath, JSON.stringify(data, null, 2) + '\n');   // keep history.json in step

const srcNote = fromKeychain ? ' · passcode from macOS Keychain' : (saveKc ? ' · saved passcode to macOS Keychain' : '');
const saltNote = keptSalt ? ' · salt kept so your iPhone stays unlocked' : ' · new salt';
console.log(`✓ Wrote history.enc (${data.weeks.length} week${data.weeks.length === 1 ? '' : 's'} from ${relative(ROOT, inPath)}${srcNote}${saltNote}).`);
if (goalChanged) console.log('  Updated the goal weight in coach/history.json.');
if (!fromKeychain && !saveKc && process.platform === 'darwin' && inPath === DEFAULT_IN) {
  console.log('  Tip: run "node coach/encrypt.mjs --save-keychain" once so /weekly-checkin can encrypt automatically.');
}
console.log('  Next: git add history.enc && git commit -m "Weekly check-in" && git push');
