// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Q = require('../src/static/quiz.js');

const page = fs.readFileSync(path.join(__dirname, '../src/pages/friend-zone-quiz.html'), 'utf8');
const src = fs.readFileSync(path.join(__dirname, '../src/static/quiz.js'), 'utf8');
const items = [...page.matchAll(/class="q-item" data-area="([^"]+)" data-tip="([^"]+)"/g)].map((m) => ({ area: m[1], tip: m[2] }));
const N = items.length;

// Every possible answer sheet for N questions with answers 0..2 (3^8 = 6561).
function* sheets(n) {
  const a = new Array(n).fill(0);
  for (;;) {
    yield a.slice();
    let i = 0;
    while (i < n && a[i] === 2) a[i++] = 0;
    if (i === n) return;
    a[i]++;
  }
}

test('the page has 8 questions, each with an area and a tip', () => {
  assert.equal(N, 8);
  items.forEach((x) => assert.ok(x.area && x.tip.length > 20));
  assert.equal((page.match(/type="radio"/g) || []).length, N * 3);
});

test('every possible answer sheet gets exactly one valid type', () => {
  const seen = new Set();
  for (const s of sheets(N)) {
    const r = Q.result(s);
    assert.ok(r.type && Q.TYPES.includes(r.type), `no type for ${s}`);
    assert.equal(r.max, 16);
    assert.ok(r.signal >= 0 && r.signal <= 100);
    seen.add(r.type.id);
  }
  assert.deepEqual([...seen].sort(), Q.TYPES.map((t) => t.id).sort(), 'every type must be reachable');
});

test('types get more hidden as habit points rise', () => {
  let last = -1;
  for (let total = 0; total <= 16; total++) {
    const s = new Array(N).fill(0);
    for (let k = 0; k < total; k++) s[k % N]++;
    const idx = Q.TYPES.indexOf(Q.result(s).type);
    assert.ok(idx >= last, `total ${total} went back to ${Q.TYPES[idx].id}`);
    last = idx;
  }
  assert.equal(Q.result(new Array(N).fill(0)).type.id, 'open');
  assert.equal(Q.result(new Array(N).fill(0)).signal, 100);
  assert.equal(Q.result(new Array(N).fill(2)).type.id, 'undercover');
  assert.equal(Q.result(new Array(N).fill(2)).signal, 0);
});

test('bad input is rejected instead of silently scored', () => {
  assert.throws(() => Q.result([]));
  assert.throws(() => Q.result([0, 1, 3]));
  assert.throws(() => Q.result([0, '1']));
});

test('flags list only the habits that showed up, "often" first', () => {
  const f = Q.flags([1, 0, 2, 0, 1, 0, 0, 2], items);
  assert.deepEqual(f.map((x) => x.i), [2, 7, 0, 4]);
  assert.equal(f[0].area, items[2].area);
  assert.deepEqual(Q.flags(new Array(N).fill(0), items), []);
});

test('share text and URL carry the result type only, never answers or habits', () => {
  for (const t of Q.TYPES) {
    const out = Q.shareText(t) + ' ' + Q.shareUrl(t);
    assert.ok(out.includes(t.name) && out.includes('r=' + t.id));
    items.forEach((x) => {
      assert.ok(!out.includes(x.area), 'share leaked a habit');
      assert.ok(!out.includes(x.tip.slice(0, 20)), 'share leaked a tip');
    });
    assert.doesNotMatch(Q.shareUrl(t), /q\d=|score|total/);
  }
  assert.equal(Q.shareUrl(Q.typeById('slow')), 'https://flirtlessons.com/friend-zone-quiz/?r=slow&utm_source=share&utm_medium=quiz');
});

test('parseFriend accepts known types only', () => {
  assert.equal(Q.parseFriend('?r=secret').id, 'secret');
  assert.equal(Q.parseFriend('?utm_source=share&r=open&utm_medium=quiz').id, 'open');
  for (const bad of ['', '?r=', '?r=admin', '?r=SECRET', '?r=open1', '?r=<b>', '?x=open']) {
    assert.equal(Q.parseFriend(bad), null, bad);
  }
});

test('every result type is described on the page', () => {
  Q.TYPES.forEach((t) => assert.ok(page.includes(`<h3>${t.name}</h3>`), `${t.name} missing from page`));
});

test('quiz events never carry answers, habits or tips', () => {
  const calls = [...src.matchAll(/track\('([a-z_]+)', \{([^}]*)\}/g)];
  assert.ok(calls.length >= 6);
  for (const m of calls) assert.doesNotMatch(m[2], /scores|area|tip|answer|flag|total|signal/, `${m[1]} sends ${m[2]}`);
});

test('the form can never submit answers to the server', () => {
  assert.match(page, /<form id="quiz" class="quiz" method="dialog"/);
  assert.doesNotMatch(page, /<form id="quiz"[^>]*action=/);
});
