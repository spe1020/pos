# Dress rehearsal

Run this once, start to finish, with the real USB scanner plugged in, **before** the store
opens for the first time. It takes about fifteen minutes. Nothing here needs any programming
— it's all clicking and scanning.

Automated tests cover the money arithmetic. They can't cover a scanner or a browser, so this
is the part a person has to do.

Start it up (`npm run dev`) and open the address it prints. Grab three or four things with
barcodes on them — cereal boxes, cans, whatever's around.

---

## Before you start

**Scanner suffix found to work:** ☐ Enter  ☐ Tab  ☐ neither — see *If the scanner does
nothing* at the bottom

*(Tick one once you've done the first section, so it's written down. Most scanners send Enter;
some send Tab. The register accepts both.)*

**Date run:** ______________  **Who ran it:** ______________

---

## 1. The scanner

- [ ] Open the Sell screen. Without clicking anywhere first, scan something. **It should
      register and beep.** You should not have to click into a box.
- [ ] Click on some empty part of the page, then scan again. **Still works.**
- [ ] Click a button (a mode tab, say), then scan again. **Still works.**
- [ ] Scan an item, then open any window that pops up over the screen — the payment window
      is easiest (press `+` or click Pay). **Scan while it's open. Nothing should happen.**
      No beep, no new line on the receipt. Close the window and scan again — it works again.
- [ ] Now the phantom-scan check. Open the payment window and **type** a number into the cash
      box slowly by hand, then press Enter. **It should behave like typing.** No extra item
      should appear on the receipt, and no scan beep.
- [ ] Same again in a different box: go to Items, click into an item's name, and type a word
      with more than three letters. **No phantom scan.**
- [ ] Find a barcode with letters in it, or print one, and scan it. **The letters should come
      through intact** — check the code shown on the New item window matches what's printed.
      If your barcodes are all digits, skip this and note it here: ☐ skipped, all-numeric.

## 2. The sanity check on big amounts

The register asks twice about implausible amounts. What matters is that backing out doesn't
lose what you typed.

- [ ] Ring up anything. Press `+` to open payment. In the cash box type **300** and complete
      the sale. **A "Check the amount" window appears** showing `$300.00`.
- [ ] Click **Go back and fix it**. **The cash box should still say 300.** This is the whole
      point — if it's empty, stop and report it.
- [ ] Correct it to a sensible amount and finish the sale normally.
- [ ] Now try a $100 tender on a small sale. **No question should appear** — $100 is an
      ordinary bill.
- [ ] Scan an unknown item to get the New item window. Give it a name and the price **300**.
      Save it. **The same "Check the amount" window appears.**
- [ ] Click **Go back and fix it**. **The name and price you typed should both still be
      there.** Fix the price and save.

## 3. A full sale, start to finish

- [ ] Scan something the register has never seen. **It should buzz** and ask for a name and
      price. Name it and price it at **2.50**. Save.
- [ ] Scan the same thing again. **This time it should just drop onto the receipt** — no
      questions. The line should now read 2.
- [ ] Apply a discount to the sale — 10% off is fine.
- [ ] Check the arithmetic on the tape: two at $2.50 is $5.00, less 10% is $4.50, plus
      whatever tax you've set. **Tax should be charged on $4.50, not $5.00.**
- [ ] Pay cash. Hand over $10 — use the quick-cash button or type it.
- [ ] **Check the change shown against what you'd count out by hand.**
- [ ] The receipt appears with a number on it. **Write that number down:** ______________

## 4. The refund

- [ ] Switch to Refund (`F2`). Find the sale you just made — either type the receipt number,
      or **scan one of the items from it**, which should find the sale on its own.
- [ ] Return **one** of the two units.
- [ ] **The refund should be the discounted price** — about $2.25 plus its tax, not $2.50.
      A refund at the full shelf price is a way to lose money and the reason this check
      exists.
- [ ] Return the second unit as well.
- [ ] **The two refunds added together should exactly equal what the customer paid.** Not a
      penny more, not a penny less.
- [ ] Try to refund the same line a third time. **It shouldn't let you** — the sale should
      show as fully refunded.

## 5. Does the data survive

- [ ] **Reload the page** (Cmd-R or F5).
- [ ] Go to Items. **The item you named in step 3 should still be there, with its price.**
- [ ] Go to Sales (`F5`). **Your sale and your refund should both still be listed.**
- [ ] On the Items screen, click **Back up**. A `.json` file downloads. **Check it actually
      landed in your Downloads folder.**
- [ ] Now prove the backup works. Click **Restore** and choose the file you just saved.
      **Everything should still be there afterwards** — same items, same sales.
- [ ] Put a copy of that backup file somewhere that isn't this laptop. Email it to yourself,
      or drop it on a USB stick. The register keeps everything in one browser on one machine,
      and clearing the browser's data wipes it.

---

## If the scanner does nothing

Work down this list before assuming anything is broken:

1. Open a plain text editor and scan into it. If nothing appears there either, it's the
   scanner or the USB port, not the register.
2. If characters appear in the text editor but **nothing happens when you press Enter after
   a scan**, the scanner is probably sending no suffix at all. Most scanners are configured
   by scanning a setup barcode from their manual — look for "suffix", "Enter" or "CR".
3. If the register reacts but only picks up the tail end of the barcode, the scanner is
   slower than expected. `gapMs` in `src/hooks/useScanner.js` is the knob; raise it from 120.
4. Note what you found here so the next person doesn't repeat the hunt:

   ________________________________________________________________

   ________________________________________________________________
