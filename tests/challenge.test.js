// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../src/static/challenge.js');

const rounds = C.SCENARIO.rounds;
const allPaths = [];
(function walk(prefix) {
  if (prefix.length === rounds.length) return allPaths.push(prefix);
  rounds[prefix.length].options.forEach((_, i) => walk(prefix.concat(i)));
})([]);

const pageSlugs = new Set(fs.readdirSync(path.join(__dirname, '../src/pages')).map((f) => f.replace(/\.html$/, '')));

test('every path scores an integer between 0 and 100', () => {
  assert.equal(allPaths.length, 4 ** rounds.length);
  for (const p of allPaths) {
    const s = C.score(p);
    assert.ok(Number.isInteger(s) && s >= 0 && s <= 100, `path ${p} scored ${s}`);
  }
});

test('only the best reply in every round reaches 100', () => {
  const perfect = allPaths.filter((p) => C.score(p) === 100);
  assert.equal(perfect.length, 1);
  const best = rounds.map((r) => r.options.reduce((bi, o, i, a) => (o.points > a[bi].points ? i : bi), 0));
  assert.deepEqual(perfect[0], best);
});

test('the best reply is not always in the same position', () => {
  const positions = rounds.map((r) => r.options.findIndex((o) => o.points === Math.max(...r.options.map((x) => x.points))));
  assert.ok(new Set(positions).size > 1, `best replies all at index ${positions[0]}`);
});

test('pushing after "busy" scores zero for that round', () => {
  const pressure = rounds.flatMap((r) => r.options).filter((o) => o.tags.includes('pressure'));
  assert.ok(pressure.length >= 1);
  pressure.forEach((o) => assert.equal(o.points, 0));
});

test('every summary is complete and its tip links to a real page', () => {
  for (const p of allPaths) {
    const s = C.summarize(p);
    for (const k of ['title', 'blurb', 'strength', 'weakness', 'tip']) assert.ok(s[k], `${k} missing for ${p}`);
    assert.equal(s.breakdown.length, rounds.length);
    if (s.tipHref) assert.ok(pageSlugs.has(s.tipHref.replace(/\//g, '')), `tip links to missing page ${s.tipHref}`);
  }
});

test('a perfect run reports no weakness', () => {
  const best = rounds.map((r) => r.options.findIndex((o) => o.points === Math.max(...r.options.map((x) => x.points))));
  const s = C.summarize(best);
  assert.equal(s.weakness, 'None in this chat');
  assert.equal(s.title, 'Effortless charm');
});

test('pressure is flagged as the weakness whenever it was chosen', () => {
  for (const p of allPaths) {
    const chosePressure = p.some((i, r) => rounds[r].options[i].tags.includes('pressure'));
    if (chosePressure) assert.equal(C.summarize(p).weakness, 'Pushes after a “busy”');
  }
});

test('share text and URL carry the score only, never reply text', () => {
  const allText = rounds.flatMap((r) => r.options.map((o) => o.text));
  for (const s of [0, 6, 68, 100]) {
    const out = C.shareText(s) + ' ' + C.shareUrl(s);
    assert.ok(out.includes(String(s)));
    allText.forEach((t) => assert.ok(!out.includes(t.slice(0, 12)), 'share leaked reply text'));
  }
  assert.equal(C.shareUrl(68), 'https://flirtlessons.com/rizz-test/?beat=68&utm_source=share&utm_medium=challenge');
});

test('parseBeat accepts 0..100 and rejects everything else', () => {
  assert.equal(C.parseBeat('?beat=68'), 68);
  assert.equal(C.parseBeat('?utm_source=share&beat=0'), 0);
  assert.equal(C.parseBeat('?beat=100&x=1'), 100);
  for (const bad of ['', '?beat=101', '?beat=-5', '?beat=abc', '?beat=6a', '?beat=1000', '?nobeat=5']) {
    assert.equal(C.parseBeat(bad), null, bad);
  }
});

test('score buckets are coarse and cover 0..100', () => {
  assert.equal(C.scoreBucket(0), '0-9');
  assert.equal(C.scoreBucket(68), '60-69');
  assert.equal(C.scoreBucket(99), '90-100');
  assert.equal(C.scoreBucket(100), '90-100');
});

test('analytics stays off in the shipped layout unless explicitly enabled', () => {
  const build = fs.readFileSync(path.join(__dirname, '../build.py'), 'utf8');
  assert.match(build, /^ANALYTICS_ENABLED = False$/m);
});
