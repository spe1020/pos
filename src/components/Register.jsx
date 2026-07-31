import React from 'react';
import { fmt, dateOf, timeOf } from '../lib/money';
import { discountLabel, remainingQty } from '../lib/pricing';

/* ----------------------------- live cart tape ----------------------------- */

export function Tape({
  store, priced, lastReceipt, onBump, onRemove, onLineDiscount, onRemoveOrderDiscount,
}) {
  const empty = priced.lines.length === 0;

  return (
    <div className="tape-wrap">
      <div className="tape-head">
        <span>{store}</span>
        <span>{new Date().toLocaleDateString()}</span>
      </div>

      <div className="tape">
        {empty && !lastReceipt && (
          <div className="tape-empty">
            <p className="te-1">Scan an item to start.</p>
            <p className="te-2">
              Plug the scanner in and pull the trigger — it types the barcode for you.
            </p>
          </div>
        )}

        {empty && lastReceipt && <PrintedReceipt sale={lastReceipt} store={store} />}

        {priced.lines.map((l) => (
          <div className="line" key={l.key}>
            <div className="line-main">
              <span className="line-name">{l.name}</span>
              <span className="line-amt">{fmt(l.gross)}</span>
            </div>

            {l.lineDisc > 0 && (
              <div className="line-disc">
                <span>↳ {l.discount.name}</span>
                <span>-{fmt(l.lineDisc)}</span>
              </div>
            )}

            <div className="line-sub">
              <div className="qty">
                <button onClick={() => onBump(l.key, -1)} aria-label={`One less ${l.name}`}>–</button>
                <span>{l.qty}</span>
                <button onClick={() => onBump(l.key, 1)} aria-label={`One more ${l.name}`}>+</button>
              </div>
              <span className="line-unit">@ {fmt(l.price)}</span>
              <button className="line-x" onClick={() => onLineDiscount(l.key)}>
                {l.discount ? 'change discount' : 'discount'}
              </button>
              <button className="line-x danger" onClick={() => onRemove(l.key)} aria-label={`Remove ${l.name}`}>
                remove
              </button>
            </div>
          </div>
        ))}

        {priced.appliedOrderDiscounts.map((d, i) => (
          <div className="line order-disc" key={d.id + i}>
            <div className="line-main">
              <span className="line-name">{d.name} <em>({discountLabel(d)})</em></span>
              <span className="line-amt">-{fmt(d.amount)}</span>
            </div>
            <div className="line-sub">
              <button className="line-x danger" onClick={() => onRemoveOrderDiscount(i)}>remove</button>
            </div>
          </div>
        ))}
      </div>

      <div className="tear" aria-hidden="true" />
    </div>
  );
}

/* ------------------------------ paper receipt ----------------------------- */

export function PrintedReceipt({ sale, store }) {
  return (
    <div className="printed" id="printable-receipt">
      <div className="pr-head">
        <strong>{store}</strong>
        <span>{sale.type === 'refund' ? 'REFUND' : 'SALE'} · #{sale.number}</span>
        <span>{dateOf(sale.at)} {timeOf(sale.at)}</span>
      </div>

      {sale.lines.map((l, i) => (
        <React.Fragment key={i}>
          <div className="pr-line">
            <span>{l.qty} × {l.name}</span>
            <span>{fmt(l.price * l.qty)}</span>
          </div>
          {l.lineDisc > 0 && (
            <div className="pr-line sub">
              <span>&nbsp;&nbsp;{l.discount?.name || 'Discount'}</span>
              <span>-{fmt(l.lineDisc)}</span>
            </div>
          )}
        </React.Fragment>
      ))}

      <div className="pr-rule" />
      <div className="pr-line"><span>Subtotal</span><span>{fmt(sale.subtotal)}</span></div>

      {(sale.appliedOrderDiscounts || []).map((d, i) => (
        <div className="pr-line sub" key={i}>
          <span>{d.name}</span>
          <span>-{fmt(d.amount)}</span>
        </div>
      ))}

      {sale.discountTotal > 0 && (
        <div className="pr-line saved"><span>You saved</span><span>{fmt(sale.discountTotal)}</span></div>
      )}

      <div className="pr-line"><span>Tax</span><span>{fmt(sale.tax)}</span></div>
      <div className="pr-line big">
        <span>{sale.type === 'refund' ? 'Refunded' : 'Total'}</span>
        <span>{fmt(sale.total)}</span>
      </div>

      {sale.cash != null && (
        <>
          <div className="pr-line"><span>Cash</span><span>{fmt(sale.cash)}</span></div>
          <div className="pr-line"><span>Change</span><span>{fmt(sale.change)}</span></div>
        </>
      )}

      <div className="pr-foot">thank you — come again</div>
    </div>
  );
}

/* ------------------------------ refund tape ------------------------------- */

export function RefundTape({ sale, qty, setQty, value, onIssue, onClear }) {
  if (!sale) {
    return (
      <div className="tape-wrap">
        <div className="tape-head"><span>Refund</span></div>
        <div className="tape">
          <div className="tape-empty">
            <p className="te-1">Pick a receipt.</p>
            <p className="te-2">
              Or scan one of the items being returned and the right receipt comes up on its own.
            </p>
          </div>
        </div>
        <div className="tear" aria-hidden="true" />
      </div>
    );
  }

  return (
    <>
      <div className="tape-wrap">
        <div className="tape-head">
          <span>Receipt #{sale.number}</span>
          <span>{dateOf(sale.at)}</span>
        </div>
        <div className="tape">
          {sale.discountTotal > 0 && (
            <p className="tape-note">
              This sale had {fmt(sale.discountTotal)} of discounts. Returns are valued at what was
              actually paid.
            </p>
          )}
          {sale.lines.map((l, i) => {
            const left = remainingQty(l);
            const picked = qty[i] || 0;
            const unitPaid = Math.round(l.finalNet / l.qty);
            return (
              <div className={'line' + (left === 0 ? ' spent' : '')} key={i}>
                <div className="line-main">
                  <span className="line-name">{l.name}</span>
                  <span className="line-amt">{fmt(unitPaid * picked)}</span>
                </div>
                <div className="line-sub">
                  <div className="qty">
                    <button
                      disabled={picked === 0}
                      onClick={() => setQty({ ...qty, [i]: picked - 1 })}
                      aria-label="Refund one less"
                    >–</button>
                    <span>{picked}</span>
                    <button
                      disabled={picked >= left}
                      onClick={() => setQty({ ...qty, [i]: picked + 1 })}
                      aria-label="Refund one more"
                    >+</button>
                  </div>
                  <span className="line-unit">
                    {left} of {l.qty} returnable · paid {fmt(unitPaid)} ea
                  </span>
                  {left > 0 && (
                    <button className="line-x" onClick={() => setQty({ ...qty, [i]: left })}>all</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="tear" aria-hidden="true" />
      </div>

      <CustomerDisplay tone="refund" line="RETURN IN PROGRESS" label="REFUND" amount={value.total} />

      <div className="totals">
        <div className="trow"><span>Goods</span><span>{fmt(value.net)}</span></div>
        <div className="trow"><span>Tax back</span><span>{fmt(value.tax)}</span></div>
      </div>

      <div className="actions">
        <button className="btn ghost" onClick={onClear}>Cancel</button>
        <button className="btn refundbtn" onClick={onIssue} disabled={value.total <= 0}>
          Refund {fmt(value.total)}
        </button>
      </div>
    </>
  );
}

/* --------------------------- customer display ----------------------------- */

export function CustomerDisplay({ line, label = 'TOTAL', amount, tone = 'sell' }) {
  return (
    <div className={'vfd ' + tone}>
      <div className="vfd-scan" aria-hidden="true" />
      <div className="vfd-line">{line}</div>
      <div className="vfd-total">
        <span>{label}</span>
        <span>{fmt(amount)}</span>
      </div>
    </div>
  );
}
