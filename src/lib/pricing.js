import { allocate } from './money.js';

/**
 * A discount looks like:
 *   { id, name, kind: 'percent' | 'amount', value, scope, barcode, active }
 *
 * `value` is a whole percent for 'percent' (10 = 10% off)
 * or an amount in cents for 'amount' (150 = $1.50 off).
 */

export const discountLabel = (d) =>
  d.kind === 'percent' ? `${d.value}% off` : `$${(d.value / 100).toFixed(2)} off`;

export const lineGross = (line) => line.price * line.qty;

export function lineDiscountAmount(line) {
  if (!line.discount) return 0;
  const gross = lineGross(line);
  const d = line.discount;
  const raw = d.kind === 'percent' ? Math.round((gross * d.value) / 100) : d.value;
  return Math.max(0, Math.min(raw, gross)); // never discount below free
}

/**
 * The single source of truth for what a sale costs.
 *
 * Order of operations, which matters and is the same order a real register uses:
 *   1. line discounts come off each line
 *   2. order discounts come off the running subtotal, in the order they were added
 *   3. tax is charged on what's left, not on the pre-discount price
 */
export function priceCart(cart, orderDiscounts = [], taxPct = 0) {
  const lines = cart.map((l) => {
    const gross = lineGross(l);
    const lineDisc = lineDiscountAmount(l);
    return { ...l, gross, lineDisc, net: gross - lineDisc };
  });

  const gross = lines.reduce((a, l) => a + l.gross, 0);
  const lineDiscTotal = lines.reduce((a, l) => a + l.lineDisc, 0);
  const subtotal = gross - lineDiscTotal;

  let running = subtotal;
  let orderDiscTotal = 0;
  const applied = [];
  for (const d of orderDiscounts) {
    const raw = d.kind === 'percent' ? Math.round((running * d.value) / 100) : d.value;
    const amount = Math.max(0, Math.min(raw, running));
    applied.push({ ...d, amount });
    running -= amount;
    orderDiscTotal += amount;
  }

  const taxable = subtotal - orderDiscTotal;
  const rate = Number(taxPct) || 0;
  const tax = Math.round((taxable * rate) / 100);
  const total = taxable + tax;

  // Spread the order-level discount back onto the lines so refunds can be exact.
  const shares = allocate(orderDiscTotal, lines.map((l) => l.net));
  lines.forEach((l, i) => {
    l.orderDisc = shares[i];
    l.finalNet = l.net - shares[i];
  });

  return {
    lines,
    gross,
    lineDiscTotal,
    subtotal,
    appliedOrderDiscounts: applied,
    orderDiscTotal,
    discountTotal: lineDiscTotal + orderDiscTotal,
    taxable,
    tax,
    taxPct: rate,
    total,
    itemCount: lines.reduce((a, l) => a + l.qty, 0),
  };
}

/**
 * What a partial return is worth. Uses the discounted price the customer
 * actually paid for those units, not the shelf price — otherwise a 20%-off
 * sale becomes a way to make money by returning things.
 */
export function refundValue(sale, quantities) {
  let net = 0;
  sale.lines.forEach((l, i) => {
    const q = quantities[i] || 0;
    if (q <= 0) return;
    net += q === l.qty ? l.finalNet : Math.round((l.finalNet * q) / l.qty);
  });
  const tax = Math.round((net * (sale.taxPct || 0)) / 100);
  return { net, tax, total: net + tax };
}

export const remainingQty = (line) => line.qty - (line.refunded || 0);
