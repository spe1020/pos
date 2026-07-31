import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceCart, refundValue } from '../src/lib/pricing.js';
import { allocate, parseMoney } from '../src/lib/money.js';

test('tax is charged on the discounted price, not the shelf price', () => {
  const p = priceCart(
    [{ price: 1000, qty: 1, discount: { kind: 'amount', value: 200 } }],
    [{ id: 'a', kind: 'percent', value: 10 }],
    10
  );
  assert.equal(p.subtotal, 800);      // line discount first
  assert.equal(p.orderDiscTotal, 80); // then order discount
  assert.equal(p.taxable, 720);
  assert.equal(p.tax, 72);            // not 100
  assert.equal(p.total, 792);
});

test('a discount can never push a sale below zero', () => {
  const p = priceCart(
    [{ price: 100, qty: 1, discount: { kind: 'amount', value: 99999 } }],
    [{ id: 'x', kind: 'amount', value: 99999 }],
    5
  );
  assert.equal(p.total, 0);
});

test('splitting a discount across lines never loses or invents a penny', () => {
  for (const amount of [1, 7, 33, 100, 999, 1234, 8675]) {
    for (const weights of [[1, 1, 1], [100, 33, 7], [5, 5, 5, 5, 5, 5, 5], [1, 999]]) {
      const parts = allocate(amount, weights);
      assert.equal(parts.reduce((a, b) => a + b, 0), amount);
    }
  }
});

test('a return is worth what was paid, not what the tag says', () => {
  const p = priceCart(
    [{ barcode: 'A', name: 'A', price: 1000, qty: 2 }, { barcode: 'B', name: 'B', price: 500, qty: 1 }],
    [{ id: 'd', name: '25 off', kind: 'percent', value: 25 }],
    6
  );
  const sale = { lines: p.lines, taxPct: p.taxPct, total: p.total };

  const everything = refundValue(sale, { 0: 2, 1: 1 });
  assert.equal(everything.total, sale.total, 'refunding it all returns exactly what was paid');

  const one = refundValue(sale, { 0: 1 });
  assert.equal(one.total, 795, 'one unit of a 25%-off $10 item is $7.95 with tax, not $10.60');
  assert.ok(one.total < Math.round(1000 * 1.06), 'never refund more than the item cost');
});

test('money parses the ways a kid might type it', () => {
  assert.equal(parseMoney('1.50'), 150);
  assert.equal(parseMoney('$1.50'), 150);
  assert.equal(parseMoney('1,50'), 150);
  assert.equal(parseMoney(''), 0);
  assert.equal(parseMoney('abc'), 0);
});
