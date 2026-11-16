#!/usr/bin/env node
// Builds the static bot API: api/YYYY-MM-DD.json, api/YYYY-MM-DD.txt and api/index.json for Pipli.
// No dependencies. The engine is read from index.html, between /* ENGINE:START */ and /* ENGINE:END */.
// Usage: node scripts/build-api.mjs [FROM TO]   (dates as YYYY-MM-DD; default range below)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FROM = '2026-11-16';
export const TO = '2027-12-31';
export const BASE = 'https://anandvip.github.io/choghadiya-wheel/api/';
export const PIPLI = { name: 'Pipli, Kurukshetra', lat: 29.9775, lon: 76.8928, tz: () => 330 };
const TZ_MIN = 330;
const ABBR = { 'Vaar Vela': 'VV', 'Kaal Vela': 'KV', 'Kaal Ratri': 'KR', 'Rahu Kaal': 'RK', 'Yamaganda': 'YG', 'Gulika': 'GK' };
export const BEFORE_SUNRISE_RULE = "A Vedic day runs sunrise to sunrise: if the time now is before this date's sunrise, use the previous date's file and its night slots.";

export function engineSource(html = readFileSync(path.join(ROOT, 'index.html'), 'utf8')) {
  const a = html.indexOf('/* ENGINE:START'), b = html.indexOf('/* ENGINE:END */');
  if (a < 0 || b < a) throw new Error('ENGINE:START / ENGINE:END markers not found in index.html');
  return html.slice(a, b);
}
export function loadEngine(src = engineSource()) {
  const ctx = vm.createContext({});
  vm.runInContext(src + '\n;this.CW = CW;', ctx, { filename: 'index.html#engine' });
  return ctx.CW;
}
export const engineHash = (src = engineSource()) => createHash('sha256').update(src).digest('hex').slice(0, 12);

// ISO time in IST, to the second
export function isoIST(t) {
  return new Date(Math.round(t / 1000) * 1000 + TZ_MIN * 60000).toISOString().slice(0, 19) + '+05:30';
}
const hm = t => new Date(Math.round(t / 60000) * 60000 + TZ_MIN * 60000).toISOString().slice(11, 16);

export function dayData(CW, date, generatedFrom) {
  const D = CW.computeDay(CW.parseISO(date), PIPLI);
  const slot = s => {
    const ov = CW.warnings(s);
    return { n: s.n, name: s.name, quality: s.quality, start: isoIST(s.start), end: isoIST(s.end), overlays: ov,
      isClean: CW.GOOD_CHOG.indexOf(s.name) >= 0 && ov.length === 0 && (s.end - s.start) >= 20 * 60000 };
  };
  const w = x => [isoIST(x.start), isoIST(x.end)];
  return {
    date, weekday: D.weekdayName, vaar: D.vaar,
    location: { name: PIPLI.name, lat: PIPLI.lat, lon: PIPLI.lon }, tz: 'Asia/Kolkata',
    sunrise: isoIST(D.sunrise), sunset: isoIST(D.sunset), nextSunrise: isoIST(D.nextSunrise),
    day: D.slots.slice(0, 8).map(slot), night: D.slots.slice(8).map(slot),
    overlays: { rahuKaal: w(D.rahu), yamaganda: w(D.yama), gulika: w(D.guli),
      vaarVela: D.vaarVela.map(w), kaalVela: D.kaalVela.map(w), kaalRatri: D.kaalRatri.map(w) },
    generatedFrom
  };
}

export function dayText(j) {
  const L = [`Choghadiya ${j.date} ${j.weekday} (${j.vaar}) · Pipli 29.9775N 76.8928E · IST`,
    `Sunrise ${hm(Date.parse(j.sunrise))} · Sunset ${hm(Date.parse(j.sunset))} · Next sunrise ${hm(Date.parse(j.nextSunrise))}`];
  const row = (p, s) => `${p}${s.n} ${hm(Date.parse(s.start))}-${hm(Date.parse(s.end))} ${s.name.padEnd(6)}${s.quality.padEnd(8)}${s.isClean ? 'clean' : s.overlays.map(x => ABBR[x]).join(',')}`.trimEnd();
  j.day.forEach(s => L.push(row('D', s)));
  j.night.forEach(s => L.push(row('N', s)));
  L.push('VV/KV Vaar/Kaal Vela, KR Kaal Ratri, RK Rahu Kaal, YG Yamaganda, GK Gulika. clean: no overlay.');
  L.push('Before sunrise, use the previous date\'s night slots.');
  return L.join('\n') + '\n';
}

export function dates(from = FROM, to = TO) {
  const out = [];
  for (let d = from; d <= to; ) { out.push(d); const [y, m, dd] = d.split('-').map(Number); d = new Date(Date.UTC(y, m - 1, dd + 1)).toISOString().slice(0, 10); }
  return out;
}

function gitCommit() {
  try { return execFileSync('git', ['log', '-1', '--format=%h', '--', 'index.html'], { cwd: ROOT, encoding: 'utf8' }).trim() || 'uncommitted'; }
  catch { return 'unknown'; }
}

export function build(from = FROM, to = TO) {
  const src = engineSource(), CW = loadEngine(src);
  const generatedFrom = { file: 'index.html', commit: gitCommit(), engine: engineHash(src) };
  const dir = path.join(ROOT, 'api'); mkdirSync(dir, { recursive: true });
  const list = dates(from, to);
  for (const d of list) {
    const j = dayData(CW, d, generatedFrom);
    writeFileSync(path.join(dir, d + '.json'), JSON.stringify(j) + '\n');
    writeFileSync(path.join(dir, d + '.txt'), dayText(j));
  }
  const idx = { name: 'Choghadiya Wheel static API', location: { name: PIPLI.name, lat: PIPLI.lat, lon: PIPLI.lon }, tz: 'Asia/Kolkata',
    from, to, days: list.length, json: BASE + '{YYYY-MM-DD}.json', txt: BASE + '{YYYY-MM-DD}.txt',
    rule: BEFORE_SUNRISE_RULE, page: 'https://anandvip.github.io/choghadiya-wheel/?date={YYYY-MM-DD}', generatedFrom };
  writeFileSync(path.join(dir, 'index.json'), JSON.stringify(idx, null, 1) + '\n');
  return list.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [from, to] = process.argv.slice(2);
  const n = build(from || FROM, to || TO);
  console.log(`wrote ${n} days (${n * 2} files) + api/index.json`);
}
