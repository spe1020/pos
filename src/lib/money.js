// Every amount in this app is an integer number of cents.
// Floats are never used for money — 0.1 + 0.2 problems have no place in a register.

export const fmt = (cents) => {
  const n = Number(cents) || 0;
  return (n < 0 ? '-' : '') + '$' + (Math.abs(n) / 100).toFixed(2);
};

/** "1.50", "$1.50", "1,50" -> 150 */
export const parseMoney = (input) => {
  const n = parseFloat(String(input).replace(/,/g, '.').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

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
