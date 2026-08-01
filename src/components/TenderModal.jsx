import React, { useMemo } from 'react';
import Modal from './Modal';
import { fmt, parseMoney } from '../lib/money';

/**
 * `cash` is held by App rather than here on purpose: confirming an implausible
 * tender unmounts this modal, and a cashier who backs out of that confirmation
 * must find the box exactly as they left it. Local state would be wiped.
 */
export default function TenderModal({ total, discountTotal, cash, setCash, onComplete, onClose }) {
  const given = parseMoney(cash);
  const change = given - total;

  // Sensible bills to reach for: exact, next dollar, next five, next ten, next twenty.
  const quick = useMemo(() => {
    const opts = [
      total,
      Math.ceil(total / 100) * 100,
      Math.ceil(total / 500) * 500,
      Math.ceil(total / 1000) * 1000,
      Math.ceil(total / 2000) * 2000,
    ];
    return [...new Set(opts)].slice(0, 4);
  }, [total]);

  return (
    <Modal title={`Take payment — ${fmt(total)}`} onClose={onClose}>
      {discountTotal > 0 && (
        <p className="modal-note">Customer saved {fmt(discountTotal)} on this sale.</p>
      )}

      <div className="pay-grid">
        <button className="paybtn" onClick={() => onComplete('card', total)}>
          <span className="paybtn-k">Card</span>
          <span className="paybtn-v">{fmt(total)}</span>
        </button>

        <div className="cashbox">
          <span className="paybtn-k">Cash</span>
          <input
            className="cash-in"
            value={cash}
            onChange={(e) => setCash(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && given >= total && onComplete('cash', given)}
            placeholder="0.00"
            inputMode="decimal"
            aria-label="Cash received"
            autoFocus
          />
          <div className="quick">
            {quick.map((v) => (
              <button key={v} onClick={() => setCash((v / 100).toFixed(2))}>{fmt(v)}</button>
            ))}
          </div>
          <div className="change">
            <span>Change due</span>
            <strong>{fmt(Math.max(0, change))}</strong>
          </div>
          <button
            className="btn pay wide"
            onClick={() => onComplete('cash', given)}
            disabled={given < total}
          >
            {given < total && given > 0 ? `Need ${fmt(total - given)} more` : 'Complete cash sale'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
