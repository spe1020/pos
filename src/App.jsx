import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

import Header from './components/Header';
import Modal from './components/Modal';
import SellPane from './components/SellPane';
import ItemsPane from './components/ItemsPane';
import DiscountsPane from './components/DiscountsPane';
import DiscountPicker from './components/DiscountPicker';
import TenderModal from './components/TenderModal';
import { RefundPane, SalesPane } from './components/SalesPanes';
import { Tape, RefundTape, CustomerDisplay, PrintedReceipt } from './components/Register';

import { fmt, parseMoney, stamp, isToday, IMPLAUSIBLE_CENTS } from './lib/money';
import { priceCart, refundValue, remainingQty } from './lib/pricing';
import { load, save, KEYS, exportBackup, importBackup, storageIsPersistent } from './lib/storage';
import { useScanner } from './hooks/useScanner';
import { useBeep } from './hooks/useBeep';

const MODES = [
  { id: 'sell', label: 'Sell', key: 'F1' },
  { id: 'refund', label: 'Refund', key: 'F2' },
  { id: 'discounts', label: 'Discounts', key: 'F3' },
  { id: 'items', label: 'Items', key: 'F4' },
  { id: 'sales', label: 'Sales', key: 'F5' },
];

const DEFAULT_SETTINGS = {
  store: 'The Corner Store',
  taxPct: 0,
  muted: false,
  trackStock: false,
};

export default function App() {
  /* ------------------------------- state ------------------------------- */
  const [catalog, setCatalog] = useState(() => load(KEYS.catalog, {}));
  const [sales, setSales] = useState(() => load(KEYS.sales, []));
  const [discounts, setDiscounts] = useState(() => load(KEYS.discounts, []));
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, ...load(KEYS.settings, {}) }));

  const [mode, setMode] = useState('sell');
  const [cart, setCart] = useState([]);
  const [orderDiscounts, setOrderDiscounts] = useState([]);

  const [pending, setPending] = useState(null);      // unknown barcode being named
  const [customItem, setCustomItem] = useState(null); // open-price item
  const [picker, setPicker] = useState(null);        // {target:'line'|'order', key?}
  const [tendering, setTendering] = useState(false);
  const [confirming, setConfirming] = useState(null); // implausibly large amount awaiting a nod
  const [lastReceipt, setLastReceipt] = useState(null);
  const [viewReceipt, setViewReceipt] = useState(null);

  const [display, setDisplay] = useState('READY');
  const [flash, setFlash] = useState(null);

  const [refundSaleId, setRefundSaleId] = useState(null);
  const [refundQty, setRefundQty] = useState({});
  const [saleSearch, setSaleSearch] = useState('');

  const nameRef = useRef(null);
  const beep = useBeep(settings.muted);

  /* ------------------------------ persistence --------------------------- */
  useEffect(() => save(KEYS.catalog, catalog), [catalog]);
  useEffect(() => save(KEYS.sales, sales), [sales]);
  useEffect(() => save(KEYS.discounts, discounts), [discounts]);
  useEffect(() => save(KEYS.settings, settings), [settings]);

  const notify = useCallback((text, tone = 'ok') => {
    setFlash({ text, tone, id: Date.now() });
    setTimeout(() => setFlash((f) => (f && f.text === text ? null : f)), 2600);
  }, []);

  /* -------------------------------- pricing ----------------------------- */
  const priced = useMemo(
    () => priceCart(cart, orderDiscounts, settings.taxPct),
    [cart, orderDiscounts, settings.taxPct]
  );

  /* ------------------------------ cart actions -------------------------- */
  const addToCart = useCallback((product, qty = 1) => {
    setCart((prev) => {
      // Only merge undiscounted lines of the same product — a discounted line
      // stays its own line so the cashier can see what got the deal.
      const i = prev.findIndex((l) => l.barcode === product.barcode && !l.discount && !l.custom);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + qty };
        return next;
      }
      return [
        ...prev,
        {
          key: product.barcode + ':' + Date.now(),
          barcode: product.barcode,
          name: product.name,
          price: product.price,
          qty,
          discount: null,
          custom: !!product.custom,
        },
      ];
    });
    setDisplay(`${product.name.slice(0, 18).toUpperCase()}  ${fmt(product.price)}`);
  }, []);

  const bumpLine = (key, delta) =>
    setCart((prev) =>
      prev.map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l)).filter((l) => l.qty > 0)
    );

  const removeLine = (key) => setCart((prev) => prev.filter((l) => l.key !== key));

  const voidSale = () => {
    if (!cart.length && !orderDiscounts.length) return;
    setCart([]);
    setOrderDiscounts([]);
    setDisplay('SALE VOIDED');
    beep('error');
    notify('Sale voided');
  };

  /* -------------------------------- scanning ---------------------------- */
  const handleScan = useCallback(
    (raw) => {
      const barcode = raw.replace(/\s+/g, '');
      if (!barcode) return;

      // A coupon barcode beats an item barcode.
      const coupon = discounts.find((d) => d.barcode && d.barcode === barcode && d.active !== false);
      if (coupon) {
        if (coupon.scope === 'line') {
          beep('error');
          notify(`${coupon.name} applies to a single item — use the discount button on a line`, 'bad');
          return;
        }
        beep('discount');
        setOrderDiscounts((prev) => [...prev, coupon]);
        setDisplay(`COUPON  ${coupon.name.toUpperCase()}`);
        notify(`${coupon.name} applied`);
        if (mode !== 'sell') setMode('sell');
        return;
      }

      if (mode === 'refund') {
        const hit = sales.find(
          (s) => s.type === 'sale' && s.lines.some((l) => l.barcode === barcode && remainingQty(l) > 0)
        );
        if (hit) {
          beep('scan');
          setRefundSaleId(hit.id);
          setRefundQty({});
          notify(`Found receipt ${hit.number}`);
        } else {
          beep('error');
          notify('No refundable sale found with that item', 'bad');
        }
        return;
      }

      if (mode !== 'sell') setMode('sell');

      const product = catalog[barcode];
      if (product) {
        if (settings.trackStock && Number(product.stock) <= 0) {
          beep('error');
          notify(`${product.name} is out of stock — ringing it anyway`, 'bad');
        } else {
          beep('scan');
        }
        addToCart(product);
      } else {
        beep('error');
        setPending({ barcode, name: '', price: '', stock: '' });
        setDisplay('NEW ITEM — NEEDS PRICE');
        setTimeout(() => nameRef.current?.focus(), 60);
      }
    },
    [catalog, discounts, mode, sales, settings.trackStock, addToCart, beep, notify]
  );

  const blocked = !!(pending || customItem || picker || tendering || viewReceipt || confirming);

  /**
   * A slipped decimal point is the one input error a parser can't catch: "500"
   * for "5.00" is a perfectly valid amount, just not the one anybody meant.
   * So anything over IMPLAUSIBLE_CENTS asks once before it counts. The source
   * modal stays mounted underneath, so backing out returns to it as it was.
   */
  const guardAmount = (cents, what, run) => {
    if (cents > IMPLAUSIBLE_CENTS) setConfirming({ cents, what, run });
    else run();
  };
  useScanner(handleScan, { enabled: !blocked });

  /* --------------------------- keyboard shortcuts ----------------------- */
  useEffect(() => {
    const onKey = (e) => {
      const m = MODES.find((x) => x.key === e.key);
      if (m && !blocked) {
        e.preventDefault();
        setMode(m.id);
        return;
      }
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
      if (typing || blocked) return;
      if (e.key === '+' && mode === 'sell' && cart.length) { e.preventDefault(); setTendering(true); }
      if (e.key === 'Escape' && mode === 'sell') voidSale();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [blocked, mode, cart.length]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ------------------------------ catalog ops --------------------------- */
  const commitPending = () => {
    const name = pending.name.trim();
    if (!name) { notify('Give the item a name first', 'bad'); return; }
    const product = {
      barcode: pending.barcode,
      name,
      price: parseMoney(pending.price),
      stock: parseInt(pending.stock, 10) || 0,
      added: stamp(),
    };
    guardAmount(product.price, `${name} costs`, () => {
      setCatalog((c) => ({ ...c, [product.barcode]: product }));
      addToCart(product);
      beep('scan');
      setPending(null);
      notify(`${name} saved to items`);
    });
  };

  const commitCustom = () => {
    const name = customItem.name.trim() || 'Custom item';
    const price = parseMoney(customItem.price);
    if (price <= 0) { notify('Give it a price first', 'bad'); return; }
    guardAmount(price, `${name} costs`, () => {
      addToCart({ barcode: 'CUSTOM-' + Date.now(), name, price, custom: true });
      beep('scan');
      setCustomItem(null);
    });
  };

  const updateProduct = (barcode, patch) => {
    const apply = () =>
      setCatalog((c) => (c[barcode] ? { ...c, [barcode]: { ...c[barcode], ...patch } } : c));
    if (patch.price == null) return apply();
    guardAmount(patch.price, `${catalog[barcode]?.name || 'This item'} costs`, apply);
  };

  const deleteProduct = (barcode) =>
    setCatalog((c) => {
      const next = { ...c };
      delete next[barcode];
      return next;
    });

  /* ----------------------------- discount ops --------------------------- */
  const saveDiscount = (d) =>
    setDiscounts((prev) => {
      const i = prev.findIndex((x) => x.id === d.id);
      if (i >= 0) { const next = [...prev]; next[i] = d; return next; }
      return [...prev, d];
    });

  const deleteDiscount = (id) => setDiscounts((prev) => prev.filter((d) => d.id !== id));

  const applyPicked = (d) => {
    if (picker.target === 'line') {
      setCart((prev) => prev.map((l) => (l.key === picker.key ? { ...l, discount: d } : l)));
    } else {
      setOrderDiscounts((prev) => [...prev, d]);
    }
    beep('discount');
    setPicker(null);
  };

  /* ------------------------------- checkout ----------------------------- */
  const nextNumber = () => {
    const seq = sales.reduce((max, s) => Math.max(max, s.seq || 0), 1000) + 1;
    return { seq, number: String(seq) };
  };

  const completeSale = (method, cashGiven) => {
    if (!cart.length) return;
    const { seq, number } = nextNumber();
    const sale = {
      id: 'S' + Date.now(),
      seq, number,
      type: 'sale',
      at: stamp(),
      lines: priced.lines.map((l) => ({
        barcode: l.barcode, name: l.name, price: l.price, qty: l.qty,
        discount: l.discount, lineDisc: l.lineDisc,
        orderDisc: l.orderDisc, finalNet: l.finalNet,
        refunded: 0,
      })),
      appliedOrderDiscounts: priced.appliedOrderDiscounts,
      subtotal: priced.subtotal,
      discountTotal: priced.discountTotal,
      taxable: priced.taxable,
      taxPct: priced.taxPct,
      tax: priced.tax,
      total: priced.total,
      method,
      cash: method === 'cash' ? cashGiven : null,
      change: method === 'cash' ? cashGiven - priced.total : null,
    };

    if (settings.trackStock) {
      setCatalog((c) => {
        const next = { ...c };
        for (const l of sale.lines) {
          if (next[l.barcode]) next[l.barcode] = { ...next[l.barcode], stock: (next[l.barcode].stock || 0) - l.qty };
        }
        return next;
      });
    }

    setSales((prev) => [sale, ...prev]);
    setLastReceipt(sale);
    setCart([]);
    setOrderDiscounts([]);
    setTendering(false);
    beep('sale');
    setDisplay(method === 'cash' ? `CHANGE  ${fmt(sale.change)}` : 'THANK YOU');
    notify(`Receipt ${number} — ${fmt(sale.total)} paid`);
  };

  /* -------------------------------- refunds ----------------------------- */
  const refundSale = sales.find((s) => s.id === refundSaleId) || null;
  const refValue = useMemo(
    () => (refundSale ? refundValue(refundSale, refundQty) : { net: 0, tax: 0, total: 0 }),
    [refundSale, refundQty]
  );

  const issueRefund = () => {
    if (!refundSale || refValue.total <= 0) return;
    const lines = refundSale.lines
      .map((l, i) => ({ ...l, qty: refundQty[i] || 0, refunded: 0 }))
      .filter((l) => l.qty > 0);
    const { seq, number } = nextNumber();

    const record = {
      id: 'R' + Date.now(),
      seq, number,
      type: 'refund',
      at: stamp(),
      againstId: refundSale.id,
      againstNumber: refundSale.number,
      lines,
      appliedOrderDiscounts: [],
      subtotal: refValue.net,
      discountTotal: 0,
      taxPct: refundSale.taxPct,
      tax: refValue.tax,
      total: refValue.total,
      method: refundSale.method,
    };

    if (settings.trackStock) {
      setCatalog((c) => {
        const next = { ...c };
        for (const l of lines) {
          if (next[l.barcode]) next[l.barcode] = { ...next[l.barcode], stock: (next[l.barcode].stock || 0) + l.qty };
        }
        return next;
      });
    }

    setSales((prev) => [
      record,
      ...prev.map((s) =>
        s.id === refundSale.id
          ? { ...s, lines: s.lines.map((l, i) => ({ ...l, refunded: (l.refunded || 0) + (refundQty[i] || 0) })) }
          : s
      ),
    ]);

    setRefundQty({});
    setRefundSaleId(null);
    setLastReceipt(record);
    beep('refund');
    setDisplay(`REFUND  ${fmt(refValue.total)}`);
    notify(`Refunded ${fmt(refValue.total)} on receipt ${refundSale.number}`);
  };

  /* ------------------------------- day report --------------------------- */
  const today = useMemo(() => {
    const t = sales.filter((s) => isToday(s.at));
    const gross = t.filter((s) => s.type === 'sale').reduce((a, s) => a + s.total, 0);
    const refunds = t.filter((s) => s.type === 'refund').reduce((a, s) => a + s.total, 0);
    const discountsGiven = t.filter((s) => s.type === 'sale').reduce((a, s) => a + (s.discountTotal || 0), 0);
    const byMethod = (m) =>
      t.reduce((a, s) => a + (s.method === m ? (s.type === 'sale' ? s.total : -s.total) : 0), 0);
    return {
      count: t.filter((s) => s.type === 'sale').length,
      gross, refunds, discounts: discountsGiven,
      net: gross - refunds,
      cash: byMethod('cash'), card: byMethod('card'),
    };
  }, [sales]);

  const usageByDiscount = useMemo(() => {
    const counts = {};
    for (const s of sales) {
      for (const d of s.appliedOrderDiscounts || []) counts[d.id] = (counts[d.id] || 0) + 1;
      for (const l of s.lines || []) if (l.discount) counts[l.discount.id] = (counts[l.discount.id] || 0) + 1;
    }
    return counts;
  }, [sales]);

  const catalogList = useMemo(
    () => Object.values(catalog).sort((a, b) => a.name.localeCompare(b.name)),
    [catalog]
  );

  /* ------------------------------- backup ------------------------------- */
  const doImport = async (file) => {
    try {
      const data = await importBackup(file);
      setCatalog(data.catalog);
      setSales(data.sales);
      setDiscounts(data.discounts);
      setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      notify('Backup restored');
    } catch (err) {
      notify(err.message || 'Could not read that file', 'bad');
    }
  };

  const lineForPicker = picker?.target === 'line' ? cart.find((l) => l.key === picker.key) : null;

  /* ================================ render ============================== */
  return (
    <div className="pos-root">
      <Header
        modes={MODES}
        mode={mode}
        setMode={setMode}
        storeName={settings.store}
        onStoreName={(v) => setSettings((s) => ({ ...s, store: v }))}
        net={today.net}
        muted={settings.muted}
        onMute={() => setSettings((s) => ({ ...s, muted: !s.muted }))}
      />

      {flash && <div className={'flash ' + (flash.tone === 'bad' ? 'bad' : 'ok')}>{flash.text}</div>}

      <main className="stage">
        <section className="pane">
          {mode === 'sell' && (
            <SellPane
              catalog={catalogList}
              scanning={!blocked}
              trackStock={settings.trackStock}
              onPick={(p) => { beep('scan'); addToCart(p); }}
              onManual={handleScan}
              onCustomItem={() => setCustomItem({ name: '', price: '' })}
            />
          )}

          {mode === 'refund' && (
            <RefundPane
              sales={sales}
              search={saleSearch}
              setSearch={setSaleSearch}
              selectedId={refundSaleId}
              onSelect={(id) => { setRefundSaleId(id); setRefundQty({}); }}
            />
          )}

          {mode === 'discounts' && (
            <DiscountsPane
              discounts={discounts}
              onSave={saveDiscount}
              onDelete={deleteDiscount}
              usageByDiscount={usageByDiscount}
              totalGiven={today.discounts}
            />
          )}

          {mode === 'items' && (
            <ItemsPane
              list={catalogList}
              onUpdate={updateProduct}
              onDelete={deleteProduct}
              settings={settings}
              onSettings={setSettings}
              onExport={exportBackup}
              onImport={doImport}
              persistent={storageIsPersistent}
            />
          )}

          {mode === 'sales' && <SalesPane sales={sales} today={today} onOpen={setViewReceipt} />}
        </section>

        <aside className="rail">
          {mode === 'refund' ? (
            <RefundTape
              sale={refundSale}
              qty={refundQty}
              setQty={setRefundQty}
              value={refValue}
              onIssue={issueRefund}
              onClear={() => { setRefundSaleId(null); setRefundQty({}); }}
            />
          ) : (
            <>
              <Tape
                store={settings.store}
                priced={priced}
                lastReceipt={lastReceipt}
                onBump={bumpLine}
                onRemove={removeLine}
                onLineDiscount={(key) => setPicker({ target: 'line', key })}
                onRemoveOrderDiscount={(i) =>
                  setOrderDiscounts((prev) => prev.filter((_, x) => x !== i))
                }
              />

              <CustomerDisplay line={display} amount={priced.total} />

              <div className="totals">
                <div className="trow"><span>Items ({priced.itemCount})</span><span>{fmt(priced.gross)}</span></div>
                {priced.discountTotal > 0 && (
                  <div className="trow saved">
                    <span>Discounts</span><span>-{fmt(priced.discountTotal)}</span>
                  </div>
                )}
                <div className="trow"><span>Tax {priced.taxPct}%</span><span>{fmt(priced.tax)}</span></div>
              </div>

              <div className="actions three">
                <button className="btn ghost" onClick={voidSale} disabled={!cart.length}>Void</button>
                <button
                  className="btn ghost"
                  onClick={() => setPicker({ target: 'order' })}
                  disabled={!cart.length}
                >Discount</button>
                <button className="btn pay" onClick={() => setTendering(true)} disabled={!cart.length}>
                  Pay {fmt(priced.total)}
                </button>
              </div>
            </>
          )}
        </aside>
      </main>

      {/* ---------------------------- overlays ---------------------------- */}
      {pending && !confirming && (
        <Modal title="New item" onClose={() => setPending(null)}>
          <p className="modal-note">
            Barcode <code>{pending.barcode}</code> isn't in the store yet. Name it and price it once —
            it'll be recognised from now on.
          </p>
          <label className="field">
            <span>Item name</span>
            <input
              ref={nameRef}
              value={pending.name}
              onChange={(e) => setPending({ ...pending, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && commitPending()}
              placeholder="Fruit snacks"
            />
          </label>
          <label className="field">
            <span>Price</span>
            <input
              value={pending.price}
              onChange={(e) => setPending({ ...pending, price: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && commitPending()}
              placeholder="1.50"
              inputMode="decimal"
            />
          </label>
          {settings.trackStock && (
            <label className="field">
              <span>How many on the shelf</span>
              <input
                value={pending.stock}
                onChange={(e) => setPending({ ...pending, stock: e.target.value.replace(/[^0-9]/g, '') })}
                onKeyDown={(e) => e.key === 'Enter' && commitPending()}
                placeholder="12"
                inputMode="numeric"
              />
            </label>
          )}
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setPending(null)}>Cancel</button>
            <button className="btn pay" onClick={commitPending}>Save and add to sale</button>
          </div>
        </Modal>
      )}

      {customItem && !confirming && (
        <Modal title="Custom item" onClose={() => setCustomItem(null)}>
          <p className="modal-note">
            For anything without a barcode — a cookie, a bottle of lemonade, a favour. It's rung
            once and not saved to the item list.
          </p>
          <label className="field">
            <span>What is it</span>
            <input
              value={customItem.name}
              onChange={(e) => setCustomItem({ ...customItem, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && commitCustom()}
              placeholder="Lemonade"
              autoFocus
            />
          </label>
          <label className="field">
            <span>Price</span>
            <input
              value={customItem.price}
              onChange={(e) => setCustomItem({ ...customItem, price: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && commitCustom()}
              placeholder="0.75"
              inputMode="decimal"
            />
          </label>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setCustomItem(null)}>Cancel</button>
            <button className="btn pay" onClick={commitCustom}>Add to sale</button>
          </div>
        </Modal>
      )}

      {picker && (
        <DiscountPicker
          title={picker.target === 'line' ? `Discount — ${lineForPicker?.name || 'item'}` : 'Discount the whole sale'}
          presets={discounts}
          target={picker.target}
          onPick={applyPicked}
          onClose={() => setPicker(null)}
          canClear={picker.target === 'line' && !!lineForPicker?.discount}
          onClear={() => {
            setCart((prev) => prev.map((l) => (l.key === picker.key ? { ...l, discount: null } : l)));
            setPicker(null);
          }}
        />
      )}

      {tendering && !confirming && (
        <TenderModal
          total={priced.total}
          discountTotal={priced.discountTotal}
          onComplete={(method, given) =>
            method === 'cash'
              ? guardAmount(given, 'Cash handed over is', () => completeSale(method, given))
              : completeSale(method, given)
          }
          onClose={() => setTendering(false)}
        />
      )}

      {confirming && (
        <Modal title="Does that look right?" onClose={() => setConfirming(null)}>
          <p className="modal-note">
            {confirming.what} <strong>{fmt(confirming.cents)}</strong>. That's more than{' '}
            {fmt(IMPLAUSIBLE_CENTS)}, so it's worth a second look — check the decimal point.
          </p>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setConfirming(null)}>
              Go back and fix it
            </button>
            <button
              className="btn pay"
              autoFocus
              onClick={() => {
                const go = confirming.run;
                setConfirming(null);
                go();
              }}
            >
              Yes, {fmt(confirming.cents)} is right
            </button>
          </div>
        </Modal>
      )}

      {viewReceipt && (
        <Modal title={`Receipt #${viewReceipt.number}`} onClose={() => setViewReceipt(null)}>
          <div className="receipt-view">
            <PrintedReceipt sale={viewReceipt} store={settings.store} />
          </div>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => window.print()}>Print</button>
            <button className="btn pay" onClick={() => setViewReceipt(null)}>Done</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
