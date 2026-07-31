import React, { useState } from 'react';
import Modal from './Modal';
import { parseMoney } from '../lib/money';
import { discountLabel } from '../lib/pricing';

/**
 * Shared by "discount this line" and "discount the whole sale".
 * `target` is 'line' or 'order' and filters which presets are offered.
 */
export default function DiscountPicker({ title, presets, target, onPick, onClose, onClear, canClear }) {
  const [kind, setKind] = useState('percent');
  const [value, setValue] = useState('');

  const usable = presets.filter(
    (d) => d.active !== false && (d.scope === 'both' || d.scope === target)
  );

  const applyCustom = () => {
    const v = kind === 'percent' ? Math.min(100, Math.max(0, parseFloat(value) || 0)) : parseMoney(value);
    if (v <= 0) return;
    onPick({
      id: 'custom-' + Date.now(),
      name: kind === 'percent' ? `${v}% off` : 'Amount off',
      kind,
      value: v,
    });
  };

  return (
    <Modal title={title} onClose={onClose}>
      {usable.length > 0 && (
        <>
          <p className="modal-note">Saved discounts</p>
          <div className="preset-grid">
            {usable.map((d) => (
              <button key={d.id} className="preset" onClick={() => onPick(d)}>
                <span className="preset-name">{d.name}</span>
                <span className="preset-val">{discountLabel(d)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <p className="modal-note spaced">One-off discount</p>
      <div className="oneoff">
        <div className="seg">
          <button className={kind === 'percent' ? 'on' : ''} onClick={() => setKind('percent')}>%</button>
          <button className={kind === 'amount' ? 'on' : ''} onClick={() => setKind('amount')}>$</button>
        </div>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyCustom()}
          placeholder={kind === 'percent' ? '10' : '1.00'}
          inputMode="decimal"
          aria-label="Discount amount"
          autoFocus
        />
        <button className="btn pay" onClick={applyCustom}>Apply</button>
      </div>

      {canClear && (
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClear}>Remove discount</button>
        </div>
      )}
    </Modal>
  );
}
