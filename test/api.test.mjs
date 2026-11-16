// Static API checks: every generated file parses, isClean is sound, and files match a fresh engine run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ROOT, FROM, TO, dates, loadEngine, engineHash, dayData, dayText } from '../scripts/build-api.mjs';

const dir = path.join(ROOT, 'api');
const CW = loadEngine();
const list = dates(FROM, TO);
const read = f => readFileSync(path.join(dir, f), 'utf8');
const files = readdirSync(dir).sort();

test('api/ holds exactly one .json and .txt per date plus index.json', () => {
  const want = list.flatMap(d => [d + '.json', d + '.txt']).concat('index.json').sort();
  assert.deepEqual(files, want);
  const idx = JSON.parse(read('index.json'));
  assert.equal(idx.from, FROM); assert.equal(idx.to, TO); assert.equal(idx.days, list.length);
});

test('every api file matches a fresh engine run (determinism) and was built from the current engine', () => {
  const hash = engineHash();
  for (const d of list) {
    const j = JSON.parse(read(d + '.json'));
    assert.equal(j.generatedFrom.engine, hash, `${d}: api is stale, run node scripts/build-api.mjs`);
    assert.deepEqual(j, JSON.parse(JSON.stringify(dayData(CW, d, j.generatedFrom))), d);
    assert.equal(read(d + '.txt'), dayText(j), d + '.txt');
  }
});

const ms = s => Date.parse(s);
const windows = j => [j.overlays.rahuKaal, j.overlays.yamaganda, j.overlays.gulika, ...j.overlays.vaarVela, ...j.overlays.kaalVela, ...j.overlays.kaalRatri];

test('no clean slot overlaps an overlay or is shorter than 20 minutes', () => {
  let clean = 0;
  list.forEach((d, i) => {
    const j = JSON.parse(read(d + '.json'));
    assert.equal(j.day.length, 8); assert.equal(j.night.length, 8); assert.equal(j.tz, 'Asia/Kolkata');
    const near = [j];
    if (i > 0) near.push(JSON.parse(read(list[i - 1] + '.json')));
    if (i < list.length - 1) near.push(JSON.parse(read(list[i + 1] + '.json')));
    const bad = near.flatMap(windows).map(w => w.map(ms));
    for (const s of j.day.concat(j.night)) {
      assert.match(s.start, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+05:30$/);
      if (!s.isClean) continue;
      clean++;
      const a = ms(s.start), b = ms(s.end);
      assert.ok(['Amrit', 'Shubh', 'Labh'].includes(s.name), `${d} ${s.name}`);
      assert.ok(b - a >= 20 * 60000, `${d} ${s.name} too short`);
      assert.deepEqual(s.overlays, []);
      for (const [x, y] of bad) assert.ok(y <= a + 1000 || x >= b - 1000, `${d} ${s.name} ${s.start} overlaps overlay ${x}-${y}`);
    }
  });
  assert.ok(clean > list.length, 'some clean slots exist');
});
