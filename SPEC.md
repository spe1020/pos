# Build spec: Register

Hand this whole file to Claude Code as the opening brief.

**Kickoff line:**

> Read `SPEC.md` and build Phase 1. Stop when Phase 1's acceptance checks pass and show me
> what you did before starting Phase 2.

---

## What this is

A point-of-sale terminal that runs in a browser and takes input from a plain USB barcode
scanner. It's for a kid running a small store. The interface should be forgiving and fast;
the money math should be correct enough to run a real business on.

Two audiences, and they pull in different directions. Resolve in favor of the cashier: a
nine-year-old at a counter with a customer waiting should never have to read anything.

## Stack

- Vite + React 18, plain JavaScript (no TypeScript, no state library, no CSS framework)
- Zero runtime dependencies beyond `react` and `react-dom`
- Everything in one repo, runnable with `npm install && npm run dev`

Keep the dependency count near zero. This gets handed to someone who won't want to debug a
build chain in two years.

---

## The five things that are easy to get wrong

These are the whole reason this spec exists. Everything else is ordinary CRUD.

### 1. USB barcode scanners are keyboard wedges

Do **not** reach for WebUSB, WebHID, or a camera library. Nearly every USB barcode scanner
presents to the OS as a keyboard. A scan arrives as the barcode's characters typed extremely
fast, terminated by Enter.

Implementation:

- Listen for `keydown` on `window`, not on an input. The cashier must never have to click
  into a box first.
- Accumulate printable characters into a buffer. On `Enter`, if the buffer is at least 3
  characters, treat it as a scan and flush.
- If more than ~120ms passes between keystrokes, clear the buffer — that's a human typing,
  not a scanner. Scanners fire characters 2–15ms apart.
- Bail out of the handler entirely if `event.target` is an `INPUT`, `TEXTAREA`, or
  contenteditable. Otherwise typing a price into a form fires phantom scans.
- Also clear the buffer on a 250ms idle timer, so an abandoned partial scan doesn't
  contaminate the next one.
- Disable the listener while a modal is open.

Put this in `src/hooks/useScanner.js` and nowhere else.

### 2. All money is integer cents

Never store or compute money as a float. `price` is an integer number of cents throughout —
in state, in storage, in the sale record. Parse at the input boundary, format at the render
boundary, integers in between.

Provide `fmt(cents)`, `parseMoney(string)`, and `toInput(cents)` in `src/lib/money.js`.
`parseMoney` should survive `"1.50"`, `"$1.50"`, `"1,50"`, `""`, and `"abc"`.

### 3. Discount order of operations

This order is not negotiable and matches how a real register behaves:

1. **Line discounts** come off each line's gross
2. **Order discounts** come off the running subtotal, applied in the order they were added
3. **Tax** is charged on what remains

A customer must never be taxed on money they didn't spend. A discount must never push a line
or a sale below zero — clamp both.

Worked example to test against: one $10.00 item with $2.00 off the line, then 10% off the
sale, at 10% tax → subtotal $8.00, order discount $0.80, taxable $7.20, tax $0.72, total
$7.92. If you get $10.00 of tax basis anywhere, the order is wrong.

### 4. Refunds are valued at what was paid

The trap: refunding at shelf price turns a discounted sale into a money printer. Buy at 25%
off, return for full price, profit.

The fix is to resolve it at sale time, not refund time. When a sale completes, spread the
order-level discount back across the lines pro-rata and store a `finalNet` on each line —
what the customer actually paid for that line after every discount. A refund of *q* units of
a line, when *j* have already been returned, is `F(j+q) − F(j)`, where
`F(k) = round(finalNet * k / lineQty)`. Never `round(finalNet * q / lineQty)` — independent
rounding of each partial loses pennies. Apply the same cumulative treatment to tax across the
sale. Test that returning a line one unit at a time pays exactly what returning it all at
once pays.

Also: store a `refunded` count per line and decrement what's returnable. The same item must
not be refundable twice.

Test to write: a $10 item bought at 25% off with 6% tax refunds $7.95, not $10.60. And
refunding every line of a sale must return *exactly* the sale total, to the penny.

### 5. Splitting a discount can lose a penny

Spreading $1.00 across three lines naively gives 33 + 33 + 33 = 99. Use largest-remainder
allocation: floor each share, then hand out the leftover cents to the largest fractional
parts first. Write it as `allocate(amount, weights)` and property-test that the parts always
sum to exactly `amount`.

---

## Features by phase

Build in this order. Each phase should run and be usable before the next starts.

### Phase 1 — sell and persist

- Scan → known item drops onto the cart, beeps
- Scan → unknown barcode prompts for name and price, saves to catalog, adds to cart
- Cart: quantity up/down, remove line, void sale
- Subtotal, configurable tax rate, total
- Cash tender with change due and quick-cash buttons; card tender (records the method only,
  no processing)
- Completed sale prints to a receipt view and gets a sequential receipt number
- Manual barcode entry box for testing without hardware
- Persist catalog, sales and settings to `localStorage`

**Acceptance:** scan an unknown code, name it, ring it, take cash, get correct change; reload
the page and the item is still known.

### Phase 2 — discounts

- A Discounts screen to create, edit, enable/disable and delete saved discounts
- A discount is `{ id, name, kind: 'percent' | 'amount', value, scope, barcode, active }`
  where `scope` is `'line'`, `'order'`, or `'both'`
- Apply a discount to a single line, or to the whole sale
- One-off discounts typed at the register without saving them
- **Coupon barcodes**: a saved discount may carry its own barcode. Scanning it applies the
  discount. A coupon scan must take priority over an item lookup on the same code.
- The receipt shows each discount as its own line and a "You saved" total
- A discounted line must not merge with an undiscounted line of the same product — the
  cashier needs to see which units got the deal

**Acceptance:** the worked example in §3 produces $7.92. A printed coupon scans and applies.

### Phase 3 — refunds

- Refund mode: find a sale by receipt number, by item name, or **by scanning one of the
  returned items** (find the most recent sale containing it with units still returnable)
- Choose how many of each line come back; "all" shortcut per line
- Refund is a new negative transaction referencing the original, not a deletion
- Per-line `refunded` tracking prevents double refunds

**Acceptance:** the §4 test passes. A fully-refunded sale shows as spent and can't be
refunded again.

### Phase 4 — the rest

- Optional stock tracking: decrement on sale, restore on refund, flag low and out
- Custom open-price items for things with no barcode
- Sales history with a day report: count, gross, discounts given, refunds, net, cash in
  drawer, on card
- Backup: export the whole store as JSON, restore from a file. This matters — `localStorage`
  is one browser on one machine, and a kid will eventually clear it.
- Receipt printing via `window.print()` and a `@media print` block that strips the app
  chrome down to just the paper
- `F1`–`F5` to switch screens, `+` to pay, `Esc` to void

---

## Design direction

Do not ship a default admin panel. The subject has its own vernacular — a supermarket
checkout lane — and the design should come from there.

- **Palette:** dark register chrome (`#0F131A` shell, `#1E2531` panels, `#2C3542` rules),
  receipt-paper cream (`#F7F5F0`), a VFD cyan-green (`#3FE7C6`) for money and confirmation,
  a price-sticker orange (`#FF6B2C`) for discounts and refunds. Cyan means money coming in,
  orange means money going out. Hold that rule everywhere.
- **Type:** a grotesque with some width to it for UI (Archivo), a monospace for every figure,
  barcode, and the entire receipt tape (DM Mono). Numbers should never be set in the UI face.
- **Signature element:** the cart renders as an actual thermal receipt tape — cream paper,
  monospace, dotted rules between lines, and a torn perforated edge along the bottom made
  with a repeating radial-gradient mask. Completing a sale "feeds" the printed receipt in
  from the top.
- **Second signature:** a customer-display strip beneath the tape styled as a VFD tube —
  near-black inset, glowing cyan monospace with a text-shadow, faint horizontal scanlines
  over it. It shows the last item scanned and the running total. It turns orange in refund
  mode.
- **Sound:** synthesize register sounds with the Web Audio API rather than shipping audio
  files. A short high square-wave blip on scan, a low two-tone sawtooth buzz on an unknown
  barcode, a rising two-note chime on a completed sale, a falling one on a refund. Include a
  mute toggle.

Quality floor, unannounced: responsive down to a tablet, visible keyboard focus rings,
`prefers-reduced-motion` respected, every icon-only button labelled.

Copy should be plain and active. "Save and add to sale", not "Submit". Empty states are
invitations, not apologies — the empty catalog should tell the kid to go scan a cereal box.

---

## Suggested layout

```
src/
├─ App.jsx                  state, scanning, checkout, refunds
├─ styles.css
├─ lib/
│  ├─ money.js              cents, formatting, allocate()
│  ├─ pricing.js            priceCart(), refundValue()
│  └─ storage.js            localStorage + backup import/export
├─ hooks/
│  ├─ useScanner.js
│  └─ useBeep.js
└─ components/              one file per screen or widget
tests/
└─ pricing.test.mjs         node --test, no framework
```

`pricing.js` must be the only place money is decided. If a total is computed anywhere else,
that's a bug.

---

## Tests

Use the built-in Node test runner — `node --test tests/*.test.mjs`, no framework. Cover at
minimum:

1. Tax is charged on the discounted amount (the §3 worked example)
2. A discount can't push a sale below zero
3. `allocate()` parts always sum to exactly the input, across many awkward splits
4. Refunding a whole discounted sale returns exactly the total paid
5. Refunding one unit of a discounted multi-unit line returns the discounted unit price
6. `parseMoney` handles the messy inputs listed in §2

---

## Out of scope

No card processing. No accounts or multi-user. No cloud sync or backend of any kind. No
barcode *generation*. No thermal printer drivers — browser print is enough.

Don't add these even if they seem natural. Every one of them turns a thing a kid can run
into a thing that needs an adult.

---

## Definition of done

`npm install && npm run dev` works from a clean clone. `npm test` passes. A `README.md`
explains how to run it, how the keyboard-wedge scanner works, where the data lives, why
backups matter, and how to push the repo to GitHub. `.gitignore` covers `node_modules/` and
`dist/`.
