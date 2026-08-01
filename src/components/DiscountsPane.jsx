import React, { useState } from 'react';
import { parseMoney, toInput, fmt } from '../lib/money';
import { discountLabel } from '../lib/pricing';

const blank = () => ({
  id: 'd' + Date.now(),
  name: '',
  kind: 'percent',
  value: 10,
  scope: 'both',
  barcode: '',
  active: true,
});

export default function DiscountsPane({ discounts, onSave, onDelete, usageByDiscount, totalGiven }) {
  const [draft, setDraft] = useState(null);

  const commit = () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return;
    onSave({ ...draft, name, barcode: (draft.barcode || '').trim() });
    setDraft(null);
  };

  return (
    <>
      <div className="pane-head">
        <h2>Discounts</h2>
        <button className="btn ghost" onClick={() => setDraft(blank())}>New discount</button>
      </div>

      <div className="report slim">
        <div className="rcell"><span>Saved discounts</span><strong>{discounts.length}</strong></div>
        <div className="rcell"><span>Given away today</span><strong>{fmt(totalGiven)}</strong></div>
      </div>

      {draft && (
        <div className="editor">
          <div className="editor-grid">
            <label className="field">
              <span>Name</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Friends and family"
                autoFocus
              />
            </label>

            <label className="field">
              <span>Type</span>
              <div className="seg full">
                <button
                  className={draft.kind === 'percent' ? 'on' : ''}
                  onClick={() => setDraft({ ...draft, kind: 'percent', value: 10 })}
                >Percent</button>
                <button
                  className={draft.kind === 'amount' ? 'on' : ''}
                  onClick={() => setDraft({ ...draft, kind: 'amount', value: 100 })}
                >Amount</button>
              </div>
            </label>

            <label className="field">
              <span>{draft.kind === 'percent' ? 'Percent off' : 'Dollars off'}</span>
              <input
                value={draft.kind === 'percent' ? draft.value : toInput(draft.value)}
                onChange={(e) => {
                  const raw = e.target.value;
                  setDraft({
                    ...draft,
                    value: draft.kind === 'percent'
                      ? Math.min(100, Math.max(0, parseFloat(raw.replace(/[^0-9.]/g, '')) || 0))
                      : Math.max(0, parseMoney(raw)),
                  });
                }}
                inputMode="decimal"
              />
            </label>

            <label className="field">
              <span>Applies to</span>
              <div className="seg full">
                {[['both', 'Either'], ['line', 'One item'], ['order', 'Whole sale']].map(([v, l]) => (
                  <button
                    key={v}
                    className={draft.scope === v ? 'on' : ''}
                    onClick={() => setDraft({ ...draft, scope: v })}
                  >{l}</button>
                ))}
              </div>
            </label>

            <label className="field wide">
              <span>Coupon barcode (optional)</span>
              <input
                value={draft.barcode || ''}
                onChange={(e) => setDraft({ ...draft, barcode: e.target.value })}
                placeholder="Scan or type a code — scanning it applies this discount"
                className="mono"
              />
            </label>
          </div>

          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setDraft(null)}>Cancel</button>
            <button className="btn pay" onClick={commit} disabled={!draft.name.trim()}>Save discount</button>
          </div>
        </div>
      )}

      {discounts.length === 0 && !draft ? (
        <div className="empty">
          <h3>No discounts set up.</h3>
          <p>
            Make one for the deals he actually gives — a percent off for friends, a dollar off a
            bundle, a half-price clearance. Give a discount its own barcode and scanning a printed
            coupon applies it at the register.
          </p>
        </div>
      ) : (
        <div className="disc-list">
          {discounts.map((d) => (
            <div className={'disc-row' + (d.active === false ? ' off' : '')} key={d.id}>
              <div className="disc-main">
                <span className="disc-name">{d.name}</span>
                <span className="disc-meta">
                  {d.scope === 'both' ? 'item or sale' : d.scope === 'line' ? 'one item' : 'whole sale'}
                  {d.barcode ? ` · coupon ${d.barcode}` : ''}
                </span>
              </div>
              <span className="disc-val">{discountLabel(d)}</span>
              <span className="disc-uses">
                {usageByDiscount[d.id] ? `used ${usageByDiscount[d.id]}×` : 'unused'}
              </span>
              <button
                className="toggle"
                onClick={() => onSave({ ...d, active: d.active === false })}
                aria-label={d.active === false ? `Turn on ${d.name}` : `Turn off ${d.name}`}
              >
                {d.active === false ? 'off' : 'on'}
              </button>
              <button className="del" onClick={() => onDelete(d.id)} aria-label={`Delete ${d.name}`}>×</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
