# Register

A point-of-sale terminal that runs in a browser and takes input from a plain USB barcode
scanner. Built for a kid's store, but the money math is the real thing.

---

## Getting it running

You need [Node.js](https://nodejs.org) 18 or newer. Then:

```bash
npm install
npm run dev
```

Open the address it prints (usually `http://localhost:5173`).

To use it from a tablet or another computer on the same wifi:

```bash
npm start          # same thing, but reachable from other devices
```

It prints a `Network:` address like `http://192.168.1.42:5173` — open that on the tablet.

To build a version you can keep:

```bash
npm run build      # writes dist/
npm run preview    # serve dist/ to check it
```

Run the money tests any time you change pricing:

```bash
npm test
```

Before using this at a real counter for the first time, work through
[`CHECKLIST.md`](CHECKLIST.md) once with the scanner plugged in. The tests cover the
arithmetic; the checklist covers the hardware and the browser, which they can't.

---

## Keeping GitHub up to date

This folder is already a git repository and it already lives at
**<https://github.com/spe1020/pos>**. Nothing needs setting up.

To send changes up, from inside this folder:

```bash
git add -A
git commit -m "say what changed"
git push
```

`node_modules/` and `dist/` are ignored, so only source goes up.

GitHub is a copy of the *code*, not of the shop's data. Items and sales live in the browser
— see [Where the data lives](#where-the-data-lives). Pushing is not a backup; exporting is.

<details>
<summary>Starting over somewhere else</summary>

To point this at a different repo, make an empty one on GitHub — **no README, no .gitignore,
no licence**, since this folder already has all three — then:

```bash
git remote set-url origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

</details>

---

## How the scanner works

Almost every USB barcode scanner is a **keyboard wedge**. The computer thinks it's a
keyboard; a scan arrives as the barcode's digits typed extremely fast, followed by Enter.
No driver, no setup, no permission prompt — plug it into a USB port and it works.

The app listens on the whole window and tells a scan apart from a person typing by the gap
between keystrokes: scanners fire characters 2–15ms apart, a fast human manages maybe 80ms.
That's why you never have to click into a box first. The register is always listening.

The logic lives in `src/hooks/useScanner.js`. If your scanner is configured to send
something other than Enter as its suffix, that's the file to change.

No scanner nearby? There's a box on the Sell screen to type a barcode by hand.

---

## How it works at the counter

**Selling.** Scan something. If it's a known item it drops onto the tape and beeps. If it's
new, the register buzzes and asks for a name and a price — once. Every scan after that is
instant. Things with no barcode go through **Custom item**.

**Discounts.** Three ways in:

- *Saved discounts* — set them up on the Discounts screen. Name, percent or dollars, and
  whether it can apply to one item, the whole sale, or either.
- *Coupon barcodes* — give a saved discount its own barcode. Print it on a slip of paper,
  scan the slip at the register, and the discount applies itself.
- *One-off* — type a percent or an amount right in the discount box for a deal that only
  happens once.

Order of operations is the same as a real register: item discounts come off each line, sale
discounts come off what's left, and tax is charged on the remainder. A customer is never
taxed on money they didn't spend.

**Refunds.** Switch to Refund and either pick the receipt or **scan one of the items being
returned** — the register finds the sale it came from. Choose how many of each line come
back. Partial returns are tracked per line, so the same shirt can't be refunded twice.

Returns are valued at **what was actually paid**, including any discount. A $10 item bought
at 25% off refunds $7.50 plus its tax, not $10. Otherwise a sale becomes a way to make money
by returning things.

Returns that come back a few at a time are valued cumulatively — what the line is worth
returned up to here, minus what has already gone back — rather than rounding each visit on
its own. Rounding each visit separately loses pennies: a $1.00 line of three would refund
33c three times and the shop would eat the missing cent. Done cumulatively, giving a line
back one unit at a time pays exactly what giving it all back at once pays, and so does any
interleaving across lines. Tax is handled the same way.

**Money.** Every amount in the app is an integer number of cents. Floats are never used, so
totals can't drift. When a discount is split across several lines it uses largest-remainder
allocation, which means the parts always add back up to exactly the discount — no lost penny.

Typed amounts are read leniently. `$`, spaces and stray characters are ignored, and the last
`.` or `,` in what you typed is the decimal point — so `1.50` and `1,50` are both $1.50, and
`1,250.00` is $1250.00. A bare comma is always a decimal point, never a thousands mark, so
`2,500` reads as $2.50. In a store where nothing costs $20 that is the safer guess, and it
errs cheap rather than expensive. Nothing ever parses to a negative amount.

Because a slipped decimal point produces a perfectly valid number, the register asks before
accepting an implausible one: over **$50** for an item price, or over **$150** in cash handed
over. Cash gets the higher ceiling so that paying for a $3 sale with a $100 bill — an
ordinary morning — doesn't raise a question every time. Both numbers live at the top of
`src/lib/money.js` and are one line each to change.

---

## Where the data lives

In `localStorage`, which means **this browser on this machine**. It survives refreshes,
reboots, and closing the laptop. It does *not* follow you to another browser or another
computer, and clearing site data wipes it.

So: **Items → Back up** writes a `.json` file with the whole store — items, sales,
discounts, settings. **Restore** reads one back. Do this before anything risky, and keep a
copy somewhere that isn't the same laptop.

---

## Keyboard

| Key | Does |
| --- | --- |
| `F1`–`F5` | Switch between Sell, Refund, Discounts, Items, Sales |
| `+` | Open the payment screen |
| `Esc` | Void the sale in progress |
| `Enter` | What the scanner sends — also submits any open box |

---

## Layout

```
SPEC.md                     what this was built to do, and why each rule exists
src/
├─ App.jsx                  state, scanning, checkout, refunds
├─ styles.css               everything visual, including print styles
├─ lib/
│  ├─ money.js              cents, parsing, penny-exact allocation, sanity ceilings
│  ├─ pricing.js            discounts, tax, refund valuation
│  └─ storage.js            localStorage + backup export/import
├─ hooks/
│  ├─ useScanner.js         keyboard-wedge scan detection
│  └─ useBeep.js            register sounds, synthesised
└─ components/
   ├─ Header.jsx            mode tabs, day total
   ├─ SellPane.jsx          scan status, item grid
   ├─ DiscountsPane.jsx     manage saved discounts
   ├─ DiscountPicker.jsx    apply one at the register
   ├─ ItemsPane.jsx         catalog, stock, tax, backups
   ├─ SalesPanes.jsx        refund search + sales history
   ├─ Register.jsx          receipt tape, printed receipt, customer display
   ├─ TenderModal.jsx       cash and card
   └─ Modal.jsx
```

`pricing.js` is the file to be careful with. It's the only place money is decided, and
`tests/pricing.test.mjs` covers it.

---

## Things it deliberately doesn't do

No card processing — "Card" just records how it was paid. No multi-user accounts, no cloud
sync, no receipt hardware. If a thermal printer ever turns up, the Print button on a receipt
already uses the browser's print dialog and there's a `@media print` block in `styles.css`
that strips the app chrome down to just the paper.

## License

MIT — see `LICENSE`.
