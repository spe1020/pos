// Every amount in this app is an integer number of cents.
// Floats are never used for money — 0.1 + 0.2 problems have no place in a register.

export const fmt = (cents) => {
  const n = Number(cents) || 0;
  return (n < 0 ? '-' : '') + '$' + (Math.abs(n) / 100).toFixed(2);
};

/**
 * Anything above this wants a second look before it is accepted — a price or a
 * pile of cash past it is far more likely a slipped decimal point than a real
 * amount. Raising it is a one-line change here.
 */
export const IMPLAUSIBLE_CENTS = 5000;

/**
 * "1.50", "$1.50", "1,50" -> 150. Also "1,250.00" -> 125000.
 *
 * String arithmetic end to end — the input never becomes a float, so there is
 * no float rounding to inherit. Sub-cent input rounds half up: "1.999" -> 200.
 *
 * The last '.' or ',' in the string is the decimal point and anything before it
 * is grouping. So "1,250.00" is $1250.00, but a bare "2,500" is $2.50, not
 * $2500 — in a store where nothing costs $20 the thousands reading is almost
 * never the one meant, and it is the reading that errs expensive.
 *
 * Never returns a negative. Nothing in a register needs signed money: refunds
 * are stored positive with a `type`, stock goes through parseInt. Holding that
 * rule here means no call site has to remember it. A signed parse, if one is
 * ever needed, gets its own name.
 */
export function parseMoney(input) {
  const cleaned = String(input ?? '').replace(/[^0-9.,-]/g, '');
  if (!/\d/.test(cleaned)) return 0;
  if (cleaned.startsWith('-')) return 0;

  const at = Math.max(cleaned.lastIndexOf(','), cleaned.lastIndexOf('.'));
  const whole = (at < 0 ? cleaned : cleaned.slice(0, at)).replace(/\D/g, '') || '0';
  const frac = (at < 0 ? '' : cleaned.slice(at + 1)).replace(/\D/g, '');

  return (
    Number(whole) * 100 + Number((frac + '00').slice(0, 2)) + (Number(frac[2] || 0) >= 5 ? 1 : 0)
  );
}

export const toInput = (cents) => ((Number(cents) || 0) / 100).toFixed(2);

/**
 * Split `amount` across `weights` so the parts always sum to exactly `amount`.
 * Largest-remainder method — this is what stops a discount from losing a penny
 * when it's spread over three lines.
 */
export function allocate(amount, weights) {
  const zero = weights.map(() => 0);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (amount <= 0 || totalWeight <= 0) return zero;

  const raw = weights.map((w) => (amount * w) / totalWeight);
  const parts = raw.map(Math.floor);
  let remainder = amount - parts.reduce((a, b) => a + b, 0);

  const byFraction = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  for (let k = 0; k < remainder; k++) parts[byFraction[k % byFraction.length].i] += 1;
  return parts;
}

export const stamp = () => new Date().toISOString();
export const timeOf = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const dateOf = (iso) =>
  new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
export const isToday = (iso) =>
  new Date(iso).toDateString() === new Date().toDateString();
