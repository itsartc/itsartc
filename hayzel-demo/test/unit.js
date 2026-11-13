// Unit checks: CSV parser, header mapping, formatting, config round trip.
const assert = require('assert');
const HZ = require('../assets/hz.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

t('quoted commas, newlines, "" escapes, CRLF', () => {
  const csv = 'a,b,c\r\n"x, y","line1\nline2","say ""hi"""\r\n1,,3\n';
  assert.deepStrictEqual(HZ.parseCSV(csv), [['a', 'b', 'c'], ['x, y', 'line1\nline2', 'say "hi"'], ['1', '', '3']]);
});
t('BOM, trailing field without newline, empty rows dropped', () => {
  assert.deepStrictEqual(HZ.parseCSV('﻿h1,h2\n\n,\nv1,"v2"'), [['h1', 'h2'], ['v1', 'v2']]);
});
t('quoted field with comma+newline+quotes together', () => {
  assert.deepStrictEqual(HZ.parseCSV('"a,\r\n""b"""'), [['a,\r\n"b"']]);
});
t('header normalisation', () => {
  assert.strictEqual(HZ.normHeader('Price (AED)'), 'price_aed');
  assert.strictEqual(HZ.normHeader('  Agent Name '), 'agent_name');
  assert.strictEqual(HZ.normHeader('Size (sq.ft)'), 'size_sq_ft');
  assert.strictEqual(HZ.normHeader('__Photo URL 1__'), 'photo_url_1');
});
t('flexible mapping with header variants', () => {
  const csv = [
    'Listing Reference,Listing Agent,Tower,Area,Unit,Beds,Baths,Area (sqft),Price (AED),Price Period,Furnishing,Cheques,Self Viewing,Photo URL 1,Image 2,photo_3',
    'R1,Sara Khan,"Marina, Tower A",Dubai Marina,12,studio,1,"1,200","AED 135,000",yearly,Furnished,4,yes,https://x/1.jpg,ftp://bad,',
    ',omar,,JLT,,1,1,,9000,Monthly,,,no,,,',
    ',Omar,Bay 7,Business Bay,,3,,,"2,500,000",Sale,,,Y,https://x/a.jpg,,'
  ].join('\n');
  const L = HZ.parseListings(csv);
  assert.strictEqual(L.length, 3);
  assert.strictEqual(L[0].id, 'R1');
  assert.strictEqual(L[0].agent, 'Sara Khan');
  assert.strictEqual(L[0].building, 'Marina, Tower A');
  assert.strictEqual(L[0].community, 'Dubai Marina');
  assert.strictEqual(L[0].price, 135000);
  assert.strictEqual(L[0].size, '1,200');
  assert.deepStrictEqual(L[0].photos, ['https://x/1.jpg']);
  assert.strictEqual(L[0].selfView, true);
  assert.strictEqual(L[1].id, 'row-2');
  assert.strictEqual(L[1].selfView, false);
  assert.strictEqual(L[1].period, 'month');
  assert.strictEqual(L[2].period, 'sale');
  assert.strictEqual(HZ.fmtBeds(L[0].beds), 'Studio');
  assert.strictEqual(HZ.fmtBeds('0'), 'Studio');
  assert.strictEqual(HZ.fmtBeds('1'), '1 bed');
  assert.strictEqual(HZ.fmtBeds('3'), '3 beds');
  assert.strictEqual(HZ.fmtPrice(L[0]), 'AED 135,000/year');
  assert.strictEqual(HZ.fmtPrice(L[1]), 'AED 9,000/month');
  assert.strictEqual(HZ.fmtPrice(L[2]), 'AED 2,500,000');
  assert.strictEqual(HZ.cardSub({ beds: '1', community: 'Business Bay' }), '1 bed, Business Bay');
  // agent matching is case-insensitive, self-view only, newest first
  const om = HZ.agentListings(L, 'OMAR');
  assert.deepStrictEqual(om.map(x => x.building), ['Bay 7']);
  assert.strictEqual(HZ.agents(L).length, 2);
});
t('self_viewing defaults to true when column missing; photo fallbacks', () => {
  const L = HZ.parseListings('agent,price,image\nA,100,https://p/1.png\n');
  assert.strictEqual(L[0].selfView, true);
  assert.deepStrictEqual(L[0].photos, ['https://p/1.png']);
  assert.strictEqual(L[0].period, 'year');
});
t('sample data: 4 listings, 2 agents', () => {
  const s = HZ.sampleListings('https://hayzel-demo.vercel.app');
  assert.strictEqual(s.length, 4); assert.strictEqual(HZ.agents(s).length, 2);
  assert.ok(s[0].photos[0].startsWith('https://hayzel-demo.vercel.app/img/'));
});
t('config encode/decode round trip (UTF-8, sheet compression)', () => {
  const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT_abc-DEF123/pub?gid=987654&single=true&output=csv';
  const s = HZ.compressSource(url);
  assert.strictEqual(s, 'g:2PACX-1vT_abc-DEF123:987654');
  assert.strictEqual(HZ.expandSource(s), url);
  const cfg = { v: 1, s, a: 'Zoë Al-Maktoum ✓', g: 'Dar «Ñ» عقارات', h: [9, 20], l: 'https://x/logo.png', p: 'https://x/me.jpg' };
  const enc = HZ.encodeConfig(cfg);
  assert.ok(/^[A-Za-z0-9_-]+$/.test(enc), 'base64url alphabet');
  assert.deepStrictEqual(HZ.decodeConfig(enc), cfg);
  const cfg2 = { v: 1, s: 'sample', a: 'Sara Khan', g: 'Acme', h: [10, 19] };
  assert.deepStrictEqual(HZ.decodeConfig(HZ.encodeConfig(cfg2)), cfg2);
  assert.strictEqual(HZ.decodeConfig('not-valid!!'), null);
  assert.strictEqual(HZ.decodeConfig(''), null);
  assert.strictEqual(HZ.decodeConfig(HZ.b64urlEncode('{"v":2}')), null);
  assert.strictEqual(HZ.buildLink('https://o', cfg2), 'https://o/b/sara-khan?c=' + HZ.encodeConfig(cfg2));
});
t('escaping', () => {
  assert.strictEqual(HZ.esc('<img src=x onerror="a">&\''), '&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;');
});
t('busy slots ~35% and deterministic', () => {
  let busy = 0, tot = 0;
  for (let d = 1; d <= 28; d++) for (let h = 10; h < 19; h++) for (const m of ['00', '30']) {
    tot++; if (HZ.isBusy('Sara Khan', '2026-11-' + String(d).padStart(2, '0'), h + ':' + m)) busy++;
  }
  const r = busy / tot; assert.ok(r > 0.25 && r < 0.45, 'ratio ' + r);
  assert.strictEqual(HZ.isBusy('a', 'b', 'c'), HZ.isBusy('A', 'b', 'c'));
});
console.log(`\n${n} checks passed`);
