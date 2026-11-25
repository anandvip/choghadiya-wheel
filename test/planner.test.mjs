// Clear-slots overlap rule and calendar export. Runs the PLANNER block from index.html in Node with the engine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT, PIPLI, dates, FROM, TO, engineSource } from '../scripts/build-api.mjs';

const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const a = html.indexOf('/* PLANNER:START'), b = html.indexOf('/* PLANNER:END */');
assert.ok(a > 0 && b > a, 'PLANNER markers found');
const ctx = vm.createContext({});
vm.runInContext(engineSource(html) + '\n' + html.slice(a, b) + '\n;this.CW = CW; this.CP = CP;', ctx, { filename: 'index.html#planner' });
const { CW, CP } = ctx;
const MIN = 60000;
const plain = x => JSON.parse(JSON.stringify(x));
const dayPlan = d => {
  const D = CW.computeDay(CW.parseISO(d), PIPLI), Dp = CW.computeDay(CW.addDays(D.ymd, -1), PIPLI), Dn = CW.computeDay(CW.addDays(D.ymd, 1), PIPLI);
  return { D, Dp, Dn, P: CP.plan([Dp, D, Dn], D.slots) };
};

test('synthetic partial overlap: slot is spoiled with the reason, clean remainder kept and marked trimmed', () => {
  const t0 = Date.UTC(2026, 10, 25, 3, 0);
  const fake = { slots: [], rahu: { start: t0 + 50 * MIN, end: t0 + 70 * MIN }, yama: { start: 0, end: 0 }, guli: { start: 0, end: 0 }, vaarVela: [], kaalVela: [], kaalRatri: [] };
  const slot = { part: 'day', n: 1, name: 'Amrit', quality: 'best', start: t0, end: t0 + 80 * MIN, date: '2026-11-25' };
  const P = plain(CP.plan([fake], [slot]));
  assert.equal(P.spoiled.length, 1);
  assert.deepEqual(P.spoiled[0].reasons.map(r => [r.name, r.whole]), [['Rahu Kaal', false]]);
  assert.equal(P.spoiled[0].reasons[0].start, t0 + 50 * MIN);
  // 0-50 kept (>= 20 min), 70-80 dropped (10 min)
  assert.deepEqual(P.clean.map(c => [c.start, c.end, c.trimmed]), [[t0, t0 + 50 * MIN, true]]);
});

test('touching at a boundary is not an overlap; whole cover is reported as whole', () => {
  const t0 = 1e12, bad = [[t0 - 60 * MIN, t0, 'Gulika'], [t0 + 90 * MIN, t0 + 120 * MIN, 'Yamaganda']];
  assert.equal(CP.overlaps(t0, t0 + 90 * MIN, bad).length, 0);
  assert.equal(CP.overlaps(t0 + 400, t0 + 90 * MIN - 400, bad).length, 0, 'sub-second float edges ignored');
  const w = plain(CP.overlaps(t0, t0 + 30 * MIN, [[t0 - MIN, t0 + 31 * MIN, 'Vaar Vela']]));
  assert.deepEqual(w.map(x => [x.name, x.whole]), [['Vaar Vela', true]]);
});

test('Wed 25 Nov 2026, Pipli: clean, spoiled and not-for-new-starts slots', () => {
  const { P } = dayPlan('2026-11-25');
  const lbl = x => (x.part === 'day' ? 'D' : 'N') + x.n + ' ' + x.name;
  assert.deepEqual(plain(P.clean.map(lbl)), ['D1 Labh', 'D8 Labh', 'N2 Shubh', 'N3 Amrit']);
  assert.deepEqual(plain(P.spoiled.map(x => lbl(x) + ': ' + x.reasons.map(r => r.name).join('+'))), ['D2 Amrit: Yamaganda', 'D4 Shubh: Gulika', 'N7 Labh: Kaal Ratri']);
  assert.deepEqual(plain(P.avoid.map(lbl)), ['D3 Kaal', 'D5 Rog', 'D6 Udveg', 'N1 Udveg', 'N5 Rog', 'N6 Kaal', 'N8 Udveg']);
  assert.ok(P.clean.every(c => !c.trimmed));
});

test(`every date ${FROM}..${TO}: clean windows never overlap an overlay, every good slot is classified, matches the engine`, () => {
  for (const d of dates(FROM, TO)) {
    const { D, Dp, Dn, P } = dayPlan(d);
    const bad = [Dp, D, Dn].flatMap(x => CW.badIntervals(x));
    for (const c of P.clean) {
      assert.ok(['Amrit', 'Shubh', 'Labh'].includes(c.name) && c.end - c.start >= 20 * MIN, `${d} ${c.name}`);
      for (const [x, y, nm] of bad) assert.ok(y <= c.start + 1000 || x >= c.end - 1000, `${d} ${c.name} overlaps ${nm}`);
    }
    const good = D.slots.filter(s => CW.GOOD_CHOG.includes(s.name)).length;
    const spoiledOnly = P.spoiled.filter(s => !s.keptParts.length).length;
    const trimmedSlots = new Set(P.clean.filter(c => c.trimmed).map(c => c.slotStart)).size;
    assert.equal(P.clean.filter(c => !c.trimmed).length + spoiledOnly + trimmedSlots, good, `${d} good slots`);
    for (const s of P.spoiled) assert.ok(s.reasons.length > 0, `${d} spoiled without reason`);
    assert.ok(P.avoid.every(s => ['Rog', 'Kaal', 'Udveg'].includes(s.name)));
    assert.equal(P.avoid.length, D.slots.filter(s => ['Rog', 'Kaal', 'Udveg'].includes(s.name)).length);
    // same windows as the engine's own cleanSlots (used by the "next clean slot" line and the API)
    const eng = CW.cleanSlots([Dp, D, Dn]).filter(c => c.date === d).map(c => [Math.round(c.start), Math.round(c.end)]);
    assert.deepEqual(plain(P.clean.map(c => [Math.round(c.start), Math.round(c.end)])), plain(eng), d);
  }
});

const { P: P25 } = dayPlan('2026-11-25');
const slotOf = (c, place = 'Pipli, Kurukshetra') => ({ key: CP.key(c), date: c.date, part: c.part, n: c.n, name: c.name, start: c.start, end: c.end, trimmed: false, place });
const tasks = [
  { id: 't1', title: 'Write, review; then ship\\done', term: 'short', status: 'open', note: 'line one\nline two', slot: slotOf(P25.clean[2]) },
  { id: 't2', title: 'Long plan', term: 'long', status: 'moved', note: '', slot: slotOf(P25.clean[1]) },
  { id: 't3', title: 'Finished', term: 'short', status: 'done', note: '', slot: slotOf(P25.clean[0]) },
  { id: 't4', title: 'Skipped', term: 'short', status: 'skipped', note: '', slot: slotOf(P25.clean[3]) },
  { id: 't5', title: 'Unassigned', term: 'short', status: 'open', note: '', slot: null }
];
const NOW = Date.UTC(2026, 10, 25, 3, 0);
const unfold = s => s.replace(/\r\n /g, '');

test('.ics: valid structure, UTC times that match IST slots, default 15-min alarm, only open/moved assigned tasks', () => {
  const s = CP.ics(tasks, { now: NOW });
  assert.ok(s.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n') && s.endsWith('END:VCALENDAR\r\n'));
  assert.ok(!/[^\r]\n/.test(s), 'CRLF line endings only');
  const u = unfold(s);
  assert.equal(u.match(/^BEGIN:VEVENT$/gm).length, 2);
  assert.equal(u.match(/^END:VEVENT$/gm).length, 2);
  assert.equal(u.match(/^TRIGGER:-PT15M$/gm).length, 2);
  // sorted by start: t2 (D8 Labh 16:05 IST = 10:35 UTC) then t1 (N2 Shubh 19:05 IST = 13:35 UTC)
  const starts = [...u.matchAll(/^DTSTART:(\d{8}T\d{6}Z)$/gm)].map(m => m[1]);
  assert.equal(starts.length, 2);
  assert.match(starts[0], /^20261125T103500Z$/);
  assert.match(starts[1], /^20261125T133500Z$/);
  assert.equal(starts[0], CP.icsTime(P25.clean[1].start));
  assert.match(u, /^SUMMARY:Write\\, review\\; then ship\\\\done$/m);
  assert.match(u, /^DESCRIPTION:Shubh choghadiya \(night 2\)\\, 19:05–20:46 IST\\, Pipli\\, Kurukshetra\. Short-term task\.\\nNote: line one\\nline two$/m);
  assert.match(u, /^DTSTAMP:20261125T030000Z$/m);
  assert.ok(!/Finished|Skipped|Unassigned/.test(u));
});

test('.ics: alarm minutes are configurable and clamped', () => {
  assert.match(CP.ics(tasks, { alarmMin: 30, now: NOW }), /TRIGGER:-PT30M\r\n/);
  assert.match(CP.ics(tasks, { alarmMin: 0, now: NOW }), /TRIGGER:-PT0M\r\n/);
  assert.match(CP.ics(tasks, { alarmMin: 99999, now: NOW }), /TRIGGER:-PT1440M\r\n/);
});

test('.ics: long lines fold at 75 octets without splitting UTF-8 characters', () => {
  const long = [{ id: 'x', title: 'चौघड़िया '.repeat(20) + 'a'.repeat(100), term: 'short', status: 'open', note: '', slot: tasks[0].slot }];
  const s = CP.ics(long, { now: NOW });
  for (const line of s.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `line too long: ${Buffer.byteLength(line)}`);
  assert.match(unfold(s), new RegExp('^SUMMARY:' + ('चौघड़िया '.repeat(20) + 'a'.repeat(100)) + '$', 'm'));
});

test('copy-for-calendar text uses IST and lists the same tasks', () => {
  const t = CP.calText(tasks, { alarmMin: 15, now: NOW });
  assert.match(t, /^Focus tasks for the calendar · times in IST \(Asia\/Kolkata\)$/m);
  assert.match(t, /^Exported Wed 25 Nov 2026 08:30 IST/m);
  assert.match(t, /^1\. Wed 25 Nov 2026, 16:05–17:23 IST · Labh choghadiya \(day 8\) · Pipli, Kurukshetra$/m);
  assert.match(t, /^   Task: Long plan \(long-term, moved\)$/m);
  assert.match(t, /^2\. Wed 25 Nov 2026, 19:05–20:46 IST · Shubh choghadiya \(night 2\)/m);
  assert.match(t, /^   Note: line one\nline two$/m);
  assert.equal((t.match(/Reminder: 15 min before/g) || []).length, 2);
  assert.ok(!/Finished|Skipped|Unassigned/.test(t));
  assert.match(CP.calText([], { now: NOW }), /No assigned open or moved tasks/);
});

test('planner block makes no network calls and touches no storage', () => {
  const src = html.slice(a, b);
  for (const w of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'localStorage', 'document.', 'window.']) assert.ok(!src.includes(w), w);
  for (const w of ['fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'import(', '<script src', '<link rel="stylesheet"']) assert.ok(!html.includes(w), `index.html uses ${w}`);
});
