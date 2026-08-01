// Every amount in this app is an integer number of cents.
// Floats are never used for money — 0.1 + 0.2 problems have no place in a register.

export const fmt = (cents) => {
  const n = Number(cents) || 0;
  return (n < 0 ? '-' : '') + '$' + (Math.abs(n) / 100).toFixed(2);
};

/**
 * "1.50", "$1.50", "1,50" -> 150. Also "1,250.00" -> 125000 and "-5.00" -> -500.
 *
 * The whole thing is string arithmetic — the input never becomes a float, so
 * there is no rounding to inherit. Sub-cent input rounds half up: "1.999" -> 200.
 *
 * A comma is a decimal point in "1,50" and a thousands separator in "1,250",
 * which is genuinely ambiguous. The rule: a lone comma followed by exactly
 * three digits at the end is a thousands separator, anything else is a decimal
 * point. When both separators appear, whichever comes last is the decimal one.
 */
export function parseMoney(input) {
  const cleaned = String(input ?? '').replace(/[^0-9.,-]/g, '');
  if (!/\d/.test(cleaned)) return 0;

  const negative = cleaned.trimStart().startsWith('-');
  const body = cleaned.replace(/-/g, '');
  const commas = (body.match(/,/g) || []).length;
  const dots = (body.match(/\./g) || []).length;

  let decimalSep = '';
  if (commas && dots) decimalSep = body.lastIndexOf(',') > body.lastIndexOf('.') ? ',' : '.';
  else if (commas === 1 && !/,\d{3}$/.test(body)) decimalSep = ',';
  else if (dots === 1) decimalSep = '.';

  const at = decimalSep ? body.lastIndexOf(decimalSep) : -1;
  const whole = (at < 0 ? body : body.slice(0, at)).replace(/\D/g, '') || '0';
  const frac = (at < 0 ? '' : body.slice(at + 1)).replace(/\D/g, '');

  const cents =
    Number(whole) * 100 + Number((frac + '00').slice(0, 2)) + (Number(frac[2] || 0) >= 5 ? 1 : 0);
  return negative ? -cents : cents;
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
