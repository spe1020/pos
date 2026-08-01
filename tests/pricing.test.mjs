import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceCart, refundValue } from '../src/lib/pricing.js';
import { allocate, parseMoney, toInput, priceNeedsCheck, tenderNeedsCheck } from '../src/lib/money.js';

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

test('the last separator is the decimal point, and a bare comma is always one', () => {
  assert.equal(parseMoney('1,250.00'), 125000, 'last separator wins when both appear');
  assert.equal(parseMoney('1.250.000,50'), 125000050, 'European grouping still lands right');

  // A bare comma never means thousands. In a store where nothing costs $20 the
  // thousands reading is almost never meant, and it is the one that errs expensive.
  assert.equal(parseMoney('2,500'), 250, 'not $2500');
  assert.equal(parseMoney('$1,250'), 125, 'not $1250');

  assert.equal(parseMoney('$ 2.5 '), 250);
  assert.equal(parseMoney('.99'), 99);
  assert.equal(parseMoney('1.999'), 200, 'sub-cent input rounds half up');
  assert.equal(parseMoney('1.994'), 199);
  assert.equal(parseMoney(null), 0);
  assert.equal(parseMoney('.'), 0);
});

test('parseMoney never hands back a negative', () => {
  assert.equal(parseMoney('-5.00'), 0);
  assert.equal(parseMoney('-0.01'), 0);
  assert.equal(parseMoney('$-20'), 0);
});

test('cash gets a higher ceiling than a price, so real bills pass unquestioned', () => {
  // A $3 sale paid with a $100 bill is an ordinary morning. Asking about it
  // would train the cashier to click through the question without reading it.
  assert.equal(tenderNeedsCheck(parseMoney('100')), false, '$100 bill is not suspicious');
  assert.equal(tenderNeedsCheck(parseMoney('100.00')), false);
  assert.equal(tenderNeedsCheck(parseMoney('300')), true, '$300 in cash is');
  assert.equal(tenderNeedsCheck(parseMoney('150')), false, 'the ceiling itself still passes');
  assert.equal(tenderNeedsCheck(parseMoney('150.01')), true);

  // A price is held to the tighter limit — nothing on these shelves costs $50.
  assert.equal(priceNeedsCheck(parseMoney('1.50')), false);
  assert.equal(priceNeedsCheck(parseMoney('50')), false, 'the ceiling itself still passes');
  assert.equal(priceNeedsCheck(parseMoney('100')), true, 'a $100 price wants a second look');
  assert.equal(
    priceNeedsCheck(parseMoney('150')) && !tenderNeedsCheck(parseMoney('150')),
    true,
    'the two ceilings are genuinely different'
  );
});

test('cents survive a round trip through the input box', () => {
  const values = [0, 1, 5, 9, 10, 99, 100, 101, 999, 1000, 1234, 4999, 5000, 12345, 99999, 100000];
  for (const c of values) {
    assert.equal(parseMoney(toInput(c)), c, `${c} -> "${toInput(c)}" -> ${parseMoney(toInput(c))}`);
  }
});

test('returning a line one unit at a time pays out the same as returning it at once', () => {
  // $1.00 of value over 3 units is the classic penny-loser: 33 + 33 + 33 = 99.
  const p = priceCart([{ barcode: 'A', name: 'A', price: 50, qty: 3 }], [], 0);
  const line = { ...p.lines[0], refunded: 0 };
  assert.equal(line.finalNet, 150);

  const staggered = { lines: [{ ...line }], taxPct: p.taxPct };
  let sum = 0;
  for (let i = 0; i < 3; i++) {
    sum += refundValue(staggered, { 0: 1 }).total;
    staggered.lines[0].refunded += 1;
  }
  assert.equal(sum, refundValue({ lines: [line], taxPct: p.taxPct }, { 0: 3 }).total);
});

test('a discounted sale returned unit by unit still returns exactly the total paid', () => {
  const p = priceCart(
    [
      { barcode: 'A', name: 'A', price: 333, qty: 3 },
      { barcode: 'B', name: 'B', price: 1000, qty: 2 },
      { barcode: 'C', name: 'C', price: 799, qty: 1, discount: { kind: 'percent', value: 15 } },
    ],
    [{ id: 'd', name: '25 off', kind: 'percent', value: 25 }],
    6
  );
  const sale = { lines: p.lines.map((l) => ({ ...l, refunded: 0 })), taxPct: p.taxPct };

  let paid = 0;
  sale.lines.forEach((l, i) => {
    while (l.refunded < l.qty) {
      paid += refundValue(sale, { [i]: 1 }).total;
      l.refunded += 1;
    }
  });
  assert.equal(paid, p.total, 'penny-exact against the sale total, however it is broken up');
});

test('partial refunds interleaved across lines still sum to exactly the sale total', () => {
  const p = priceCart(
    [
      { barcode: 'A', name: 'A', price: 333, qty: 3 },
      { barcode: 'B', name: 'B', price: 1000, qty: 2 },
      { barcode: 'C', name: 'C', price: 799, qty: 1, discount: { kind: 'percent', value: 15 } },
    ],
    [{ id: 'd', name: '25 off', kind: 'percent', value: 25 }],
    6
  );
  const sale = { lines: p.lines.map((l) => ({ ...l, refunded: 0 })), taxPct: p.taxPct };

  // Customer dribbles the return back over five visits, mixed lines, mixed sizes.
  const visits = [[1, 1], [0, 2], [2, 1], [1, 1], [0, 1]];
  let paid = 0;
  for (const [line, qty] of visits) {
    paid += refundValue(sale, { [line]: qty }).total;
    sale.lines[line].refunded += qty;
  }

  assert.deepEqual(sale.lines.map((l) => l.refunded), [3, 2, 1], 'everything came back');
  assert.equal(paid, p.total, 'penny-exact however the returns are interleaved');
});

test('a line cannot be refunded past what is left on it', () => {
  const p = priceCart([{ barcode: 'A', name: 'A', price: 500, qty: 2 }], [], 0);
  const sale = { lines: [{ ...p.lines[0], refunded: 2 }], taxPct: 0 };
  assert.equal(refundValue(sale, { 0: 2 }).total, 0, 'nothing left to give back');
});
