// Checks for the AI-ready preview (aiready/index.html). Run with `npm test` from the repo root (node --test finds this file).
// 1. Its engine and planner are byte-for-byte the live wheel's, so it can never drift from index.html or the api/ files.
// 2. The WebMCP tools register, and their answers match the published api/ files for every date.
// 3. The whole page runs in a small fake DOM: tap, drag, keyboard, table rows, the AI tools panel and show_on_wheel.
process.env.TZ = 'Asia/Kolkata'; // the wheel draws in the device time zone; pin it so taps land on known IST times
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { ROOT, FROM, TO, dates } from '../../scripts/build-api.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const live = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ai = readFileSync(path.join(HERE, '..', 'index.html'), 'utf8');
const between = (h, a, b) => { const i = h.indexOf(a), j = h.indexOf(b); assert.ok(i >= 0 && j > i, a + ' markers'); return h.slice(i, j); };
const engine = h => between(h, '/* ENGINE:START', '/* PLANNER:END */');
const webmcp = between(ai, '/* WEBMCP:START', '/* WEBMCP:END */');
const MIN = 60000;
const plain = x => JSON.parse(JSON.stringify(x));
// the tools round the exact time to the minute; the api/ files keep seconds, so the two agree within half a minute (plus a second of rounding)
const near = (toolIso, apiIso, msg) => assert.ok(Math.abs(Date.parse(toolIso) - Date.parse(apiIso)) <= 31000, msg + ': ' + toolIso + ' vs ' + apiIso);

test('engine and planner are identical to the live wheel', () => {
  assert.equal(engine(ai), engine(live));
});

function toolsCtx(extra = {}) {
  const reg = [];
  const ctx = vm.createContext({ console, document: { modelContext: { registerTool(t) { reg.push(t); return Promise.resolve(); } } }, ...extra });
  ctx.window = ctx;
  vm.runInContext(engine(ai) + '\n' + webmcp, ctx);
  const call = async (n, a) => (await reg.find(t => t.name === n).execute(a || {}));
  return { reg, call, ctx };
}

test('four tools register with schemas, Vedic descriptions and honest read-only hints', () => {
  const { reg } = toolsCtx();
  assert.deepEqual(reg.map(t => t.name), ['get_current_choghadiya', 'get_choghadiya_for_date', 'find_next_clean_muhurat', 'show_on_wheel']);
  for (const t of reg) {
    assert.ok(/Vedic Panchang/.test(t.description), t.name);
    assert.equal(t.inputSchema.type, 'object');
    assert.equal(typeof t.execute, 'function');
    assert.equal(t.annotations.readOnlyHint, t.name !== 'show_on_wheel', t.name);
  }
});

test('get_choghadiya_for_date matches every api/ file (names, overlays, clean, minute times)', async () => {
  const { call } = toolsCtx();
  for (const d of dates(FROM, TO)) {
    const j = JSON.parse(readFileSync(path.join(ROOT, 'api', d + '.json'), 'utf8'));
    const r = (await call('get_choghadiya_for_date', { date: d })).structuredContent;
    assert.equal(r.vedicDate, d); assert.equal(r.weekday, j.weekday);
    near(r.sunrise, j.sunrise, d + ' sunrise');
    const a = [...j.day, ...j.night], b = [...r.day, ...r.night];
    a.forEach((x, i) => {
      assert.equal(b[i].name, x.name, d); assert.deepEqual(plain(b[i].overlays), x.overlays, d);
      assert.equal(b[i].isClean, x.isClean, d); near(b[i].start, x.start, d + ' ' + x.name); near(b[i].end, x.end, d + ' ' + x.name);
    });
    const cleanA = a.filter(x => x.isClean), cleanB = plain(r.cleanWindows);
    assert.equal(cleanB.length, cleanA.length, d + ' clean windows');
    cleanA.forEach((x, i) => { assert.equal(cleanB[i].name, x.name, d); near(cleanB[i].start, x.start, d + ' clean'); });
  }
});

test('get_current_choghadiya finds the slot at a moment, and before sunrise uses the previous night', async () => {
  const { call } = toolsCtx();
  const j = JSON.parse(readFileSync(path.join(ROOT, 'api', '2026-11-26.json'), 'utf8'));
  for (const s of [...j.day, ...j.night]) {
    const mid = new Date((Date.parse(s.start) + Date.parse(s.end)) / 2).toISOString();
    const r = (await call('get_current_choghadiya', { at: mid })).structuredContent;
    assert.equal(r.current.name, s.name); assert.equal(r.current.n, s.n); assert.equal(r.vedicDate, '2026-11-26');
  }
  const pre = (await call('get_current_choghadiya', { at: '2026-11-26T06:30:00+05:30' })).structuredContent;
  assert.equal(pre.vedicDate, '2026-11-25'); assert.equal(pre.current.part, 'night'); assert.equal(pre.current.n, 8);
});

test('find_next_clean_muhurat returns clean slots from the api/ files, in order', async () => {
  const { call } = toolsCtx();
  const r = (await call('find_next_clean_muhurat', { after: '2026-11-26T07:05:00+05:30', count: 3 })).structuredContent;
  assert.deepEqual(plain(r.windows).map(w => w.name + ' ' + w.start.slice(11, 16)), ['Labh 12:10', 'Amrit 17:23', 'Shubh 03:33']);
  const amrit = (await call('find_next_clean_muhurat', { after: '2026-11-26T12:30:00+05:30', names: ['Amrit'], minMinutes: 60 })).structuredContent;
  assert.equal(amrit.windows[0].start, '2026-11-26T17:23:00+05:30');
});

test('bad input comes back as an error result, never a throw', async () => {
  const { call } = toolsCtx();
  for (const [n, a] of [['get_current_choghadiya', { lat: 1 }], ['get_current_choghadiya', { at: 'soon' }], ['get_choghadiya_for_date', { date: '2026-13-40' }], ['show_on_wheel', {}]]) {
    const r = await call(n, a);
    assert.equal(r.isError, true, n); assert.match(r.content[0].text, /^Error: /);
  }
});

test('without WebMCP nothing registers, and the tools still run for the page panel', async () => {
  const ctx = vm.createContext({ console, document: {} }); ctx.window = ctx;
  vm.runInContext(engine(ai) + '\n' + webmcp, ctx);
  assert.equal(ctx.__cwWebMCP.available, false);
  const r = await ctx.__cwTools.get_current_choghadiya({ at: '2026-11-26T12:30:00+05:30' });
  assert.equal(r.structuredContent.current.name, 'Labh');
});

// ---------- the whole page in a small fake DOM ----------
function fakePage(now) {
  const els = {}, docListeners = {};
  class El {
    constructor(id, tag = 'div') { this.id = id; this.tagName = tag.toUpperCase(); this.style = {}; this.attrs = {}; this.listeners = {}; this.children = [];
      this.innerHTML = ''; this.textContent = ''; this.value = ''; this.hidden = false; this.tBodies = [{ innerHTML: '' }];
      this.clientWidth = 560; this.offsetWidth = 120; this.offsetHeight = 40; this.offsetLeft = 0; this.offsetTop = 0; this.width = 560; this.height = 560;
      const cls = new Set(); this.classList = { add: c => cls.add(c), remove: c => cls.delete(c), toggle: (c, on) => (on ?? !cls.has(c)) ? cls.add(c) : cls.delete(c), contains: c => cls.has(c) }; }
    setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return this.attrs[k] ?? null; } removeAttribute(k) { delete this.attrs[k]; }
    addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
    fire(t, e = {}) { e.target ||= this; e.preventDefault ||= () => {}; e.stopPropagation ||= () => {}; (this.listeners[t] || []).forEach(f => f(e)); if (this['on' + t]) this['on' + t](e); }
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; } removeChild(c) { this.children = this.children.filter(x => x !== c); }
    closest() { return null; } focus() {} scrollIntoView() {} setPointerCapture() {}
    getBoundingClientRect() { return { left: 0, top: 0, width: 560, height: 560 }; }
    getContext() { return new Proxy({}, { get: (o, k) => k === 'measureText' ? () => ({ width: 30 }) : k in o ? o[k] : () => {}, set: (o, k, v) => (o[k] = v, true) }); }
  }
  const byId = id => (els[id] ||= new El(id, id === 'wheel' ? 'canvas' : 'div'));
  const document = { documentElement: { dataset: {} }, hidden: false, getElementById: byId, createElement: t => new El('', t),
    addEventListener: (t, f) => (docListeners[t] ||= []).push(f) };
  const RealDate = Date;
  class FakeDate extends RealDate { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return now; } }
  const store = {};
  const ctx = { console, document, Intl, Math, JSON, Promise, Error, URLSearchParams, Date: FakeDate,
    navigator: {}, location: { search: '' }, devicePixelRatio: 1,
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } },
    getComputedStyle: () => ({ getPropertyValue: () => '#123456' }),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    requestAnimationFrame: f => { f(); return 1; }, setInterval: () => 0, CanvasRenderingContext2D: function () {},
    addEventListener() {} };
  ctx.window = ctx;
  vm.createContext(ctx);
  const scripts = [...ai.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  for (const s of scripts) vm.runInContext(s, ctx);
  return { ctx, byId, docListeners };
}

test('the page runs: tap, drag, keyboard, table rows, AI panel and show_on_wheel', async () => {
  const now = Date.parse('2026-11-26T07:05:00+05:30');
  const { ctx, byId } = fakePage(now);
  const cw = ctx.__cw, canvas = byId('wheel');
  let m = cw.model();
  assert.equal(m.live, true); assert.equal(m.hit.slot.name, 'Shubh');
  assert.match(byId('aiStatus').textContent, /no WebMCP yet/);

  // tap the top of the ring (noon) → the Chal slot 10:51–12:10 IST, picked, "now" wording off
  const c = 280, g = { Rout: c - 4 }, Rseg = g.Rout - 24, Rin = Rseg * 0.56, r = (Rseg + Rin) / 2;
  canvas.fire('pointerdown', { clientX: c, clientY: c - r, pointerId: 1 });
  canvas.fire('pointerup', {});
  m = cw.model();
  assert.equal(m.picked, true); assert.equal(m.live, false);
  assert.equal(new Date(m.target + 330 * MIN).toISOString().slice(11, 16), '12:00');
  assert.equal(m.hit.slot.name, 'Chal');
  assert.ok(byId('pickBar').classList.contains('on'));
  assert.match(byId('pickTxt').textContent, /Looking at .* · in 4 h 55 min/);
  assert.match(byId('wheelCap').textContent, /the moment you picked/);

  // drag to the left of the ring (06:00 → before sunrise, previous night N8)
  canvas.fire('pointerdown', { clientX: c - r, clientY: c, pointerId: 1 });
  canvas.fire('pointermove', { clientX: c - r, clientY: c + 1, pointerType: 'mouse' });
  canvas.fire('pointerup', {});
  m = cw.model();
  assert.ok(m.target >= m.wheelDay.sunrise && m.target < m.wheelDay.nextSunrise);

  // keyboard: Escape back to now; ArrowDown steps to the next slot
  canvas.fire('keydown', { key: 'Escape' });
  assert.equal(cw.model().live, true);
  canvas.fire('keydown', { key: 'ArrowDown' });
  m = cw.model();
  assert.equal(m.hit.slot.name, 'Rog'); assert.equal(m.hit.slot.n, 2);
  // tap the centre → back to now
  canvas.fire('pointerdown', { clientX: c, clientY: c, pointerId: 1 });
  assert.equal(cw.model().live, true);

  // hover shows a tooltip with the slot under the pointer
  canvas.fire('pointermove', { clientX: c, clientY: c - r, pointerType: 'mouse' });
  assert.equal(byId('tip').style.display, 'block'); assert.match(byId('tip').innerHTML, /Chal/);

  // a table row click picks that slot
  const rowT = Date.parse('2026-11-26T12:09:32+05:30') + 1000;
  byId('tbl').fire('click', { target: { closest: () => ({ getAttribute: () => String(rowT) }) } });
  assert.equal(cw.model().hit.slot.name, 'Labh');

  // AI panel button runs a tool with the wheel's moment
  const btn = { getAttribute: k => (k === 'data-tool' ? 'get_current_choghadiya' : null) };
  byId('aiSec').fire('click', { target: { closest: () => btn } });
  await new Promise(res => setImmediate(res));
  assert.match(byId('aiSummary').textContent, /^Now Labh/);
  assert.equal(byId('aiOut').hidden, false);

  // show_on_wheel points the visible wheel at a moment
  const r2 = await ctx.__cwTools.show_on_wheel({ at: '2026-11-27T04:00:00+05:30' });
  assert.equal(r2.structuredContent.shown.slot.name, 'Shubh'); assert.equal(r2.structuredContent.shown.vedicDate, '2026-11-26');
  assert.equal(cw.model().hit.slot.part, 'night');
  const r3 = await ctx.__cwTools.show_on_wheel({ date: '2026-11-26', at: '2026-11-28T04:00:00+05:30' });
  assert.equal(r3.isError, true);

  // Today button and day changes clear the pick
  byId('today').fire('click');
  assert.equal(cw.model().live, true);
});
