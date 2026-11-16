// Engine checks: frozen panchang.py fixtures and the overlay eighths table.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadEngine, PIPLI, dates, FROM, TO } from '../scripts/build-api.mjs';

const CW = loadEngine();
const fx = JSON.parse(readFileSync(new URL('./fixtures/panchang-pipli.json', import.meta.url), 'utf8'));
const MIN = 60000;
const plain = x => JSON.parse(JSON.stringify(x)); // engine objects come from a vm realm
const near = (a, b, what) => assert.ok(Math.abs(a - b) <= MIN, `${what}: off by ${((a - b) / MIN).toFixed(2)} min`);

test('fixture set: 12 dates, 2025-2030, five Saturdays, both solstices', () => {
  const ds = fx.days.map(d => d.date);
  assert.equal(ds.length, 12);
  assert.equal(ds.filter(d => new Date(d + 'T00:00:00Z').getUTCDay() === 6).length, 5);
  assert.ok(ds.includes('2026-06-21') && ds.includes('2026-12-21'));
});

for (const R of fx.days) {
  test(`matches panchang.py on ${R.date}`, () => {
    const D = CW.computeDay(CW.parseISO(R.date), PIPLI);
    near(D.sunrise, R.sunrise, 'sunrise'); near(D.sunset, R.sunset, 'sunset'); near(D.nextSunrise, R.next_sunrise, 'next sunrise');
    assert.equal(D.slots.length, 16);
    R.chog.forEach((c, i) => {
      const s = D.slots[i];
      near(s.start, c.s, `slot ${i} start`); near(s.end, c.e, `slot ${i} end`);
      assert.deepEqual(plain([s.part, s.name, s.quality, s.overlays]), [c.part, c.name, c.q, c.ov], `slot ${i}`);
    });
    for (const [a, b] of [['rahu', 'rahu'], ['yama', 'yama'], ['guli', 'guli']]) { near(D[a].start, R[b][0], a); near(D[a].end, R[b][1], a); }
    for (const [a, b] of [['vaarVela', 'vv'], ['kaalVela', 'kv'], ['kaalRatri', 'kr']]) {
      assert.equal(D[a].length, R[b].length, a);
      D[a].forEach((x, i) => { near(x.start, R[b][i][0], a); near(x.end, R[b][i][1], a); });
    }
  });
}

// 1-based eighths, Sunday..Saturday (reviewed table).
const TABLE = {
  rahu: [[8], [2], [7], [5], [6], [4], [3]],
  yama: [[5], [4], [3], [2], [1], [7], [6]],
  guli: [[7], [6], [5], [4], [3], [2], [1]],
  vaarVela: [[4], [7], [2], [5], [8], [3], [6]],
  kaalVela: [[5], [2], [6], [3], [7], [4], [1, 8]],
  kaalRatri: [[6], [4], [2], [7], [5], [3], [1, 8]]
};
const DAY_LABEL = { rahu: 'Rahu Kaal', yama: 'Yamaganda', guli: 'Gulika', vaarVela: 'Vaar Vela', kaalVela: 'Kaal Vela' };

test(`overlay windows follow the eighths table on every date ${FROM}..${TO} and the fixture dates`, () => {
  const all = dates(FROM, TO).concat(fx.days.map(d => d.date));
  const seen = new Set();
  for (const d of all) {
    const D = CW.computeDay(CW.parseISO(d), PIPLI), wd = D.weekday; seen.add(wd);
    const dseg = (D.sunset - D.sunrise) / 8, nseg = (D.nextSunrise - D.sunset) / 8;
    const dayW = n => [D.sunrise + (n - 1) * dseg, D.sunrise + n * dseg], nightW = n => [D.sunset + (n - 1) * nseg, D.sunset + n * nseg];
    for (const k of ['rahu', 'yama', 'guli']) {
      const w = dayW(TABLE[k][wd][0]);
      assert.ok(Math.abs(D[k].start - w[0]) < 1 && Math.abs(D[k].end - w[1]) < 1, `${d} ${k}`);
      assert.ok(D[k].start >= D.sunrise - 1 && D[k].end <= D.sunset + 1, `${d} ${k} is day-only`);
    }
    for (const k of ['vaarVela', 'kaalVela']) {
      assert.deepEqual(plain(D[k]).map(x => [Math.round(x.start), Math.round(x.end)]), TABLE[k][wd].map(n => dayW(n).map(Math.round)), `${d} ${k}`);
    }
    assert.deepEqual(plain(D.kaalRatri).map(x => [Math.round(x.start), Math.round(x.end)]), TABLE.kaalRatri[wd].map(n => nightW(n).map(Math.round)), `${d} kaalRatri`);
    // per-slot labels agree with the table; Rahu/Yama/Gulika never on a night slot
    D.slots.forEach(s => {
      const w = CW.warnings(s);
      if (s.part === 'day') {
        for (const k of Object.keys(DAY_LABEL)) assert.equal(w.includes(DAY_LABEL[k]), TABLE[k][wd].includes(s.n), `${d} D${s.n} ${k}`);
        assert.ok(!w.includes('Kaal Ratri'));
      } else {
        assert.deepEqual(plain(w), TABLE.kaalRatri[wd].includes(s.n) ? ['Kaal Ratri'] : [], `${d} N${s.n}`);
      }
    });
  }
  assert.equal(seen.size, 7, 'all weekdays covered');
});
