import React from 'react';
import { fmt, dateOf, timeOf } from '../lib/money';
import { remainingQty } from '../lib/pricing';

export function RefundPane({ sales, search, setSearch, selectedId, onSelect }) {
  const q = search.trim().toLowerCase();
  const list = sales
    .filter((s) => s.type === 'sale')
    .filter(
      (s) => !q || s.number.includes(q) || s.lines.some((l) => l.name.toLowerCase().includes(q))
    );

  return (
    <>
      <div className="pane-head">
        <h2>Find the sale</h2>
        <div className="scan-state live">
          <span className="dot" aria-hidden="true" />
          Scan a returned item to find its receipt
        </div>
      </div>

      <div className="manual">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Receipt number or item name"
          aria-label="Search sales"
        />
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <h3>Nothing to refund.</h3>
          <p>Completed sales show up here as soon as they're rung.</p>
        </div>
      ) : (
        <div className="sale-list">
          {list.map((s) => {
            const left = s.lines.reduce((a, l) => a + remainingQty(l), 0);
            return (
              <button
                key={s.id}
                className={'sale-row' + (selectedId === s.id ? ' on' : '') + (left === 0 ? ' spent' : '')}
                onClick={() => onSelect(s.id)}
              >
                <span className="sr-num">#{s.number}</span>
                <span className="sr-when">{dateOf(s.at)} · {timeOf(s.at)}</span>
                <span className="sr-items">
                  {s.lines.length} item{s.lines.length === 1 ? '' : 's'}
                  {s.discountTotal > 0 ? ` · ${fmt(s.discountTotal)} off` : ''}
                </span>
                <span className="sr-amt">{fmt(s.total)}</span>
                {left === 0 && <span className="sr-tag">fully refunded</span>}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

export function SalesPane({ sales, today, onOpen }) {
  return (
    <>
      <div className="pane-head"><h2>Sales</h2></div>

      <div className="report">
        {[
          ['Sales today', String(today.count)],
          ['Gross', fmt(today.gross)],
          ['Discounts', fmt(today.discounts)],
          ['Refunds', fmt(today.refunds)],
          ['Net', fmt(today.net)],
          ['In the drawer', fmt(today.cash)],
          ['On card', fmt(today.card)],
        ].map(([k, v]) => (
          <div className="rcell" key={k}><span>{k}</span><strong>{v}</strong></div>
        ))}
      </div>

      {sales.length === 0 ? (
        <div className="empty">
          <h3>No sales yet.</h3>
          <p>Ring one up and it'll land here.</p>
        </div>
      ) : (
        <div className="sale-list">
          {sales.map((s) => (
            <button
              key={s.id}
              className={'sale-row' + (s.type === 'refund' ? ' refund' : '')}
              onClick={() => onOpen(s)}
            >
              <span className="sr-num">#{s.number}</span>
              <span className="sr-when">{dateOf(s.at)} · {timeOf(s.at)}</span>
              <span className="sr-items">
                {s.type === 'refund' ? `refund of #${s.againstNumber}` : s.method}
                {s.type === 'sale' && s.discountTotal > 0 ? ` · ${fmt(s.discountTotal)} off` : ''}
              </span>
              <span className="sr-amt">{s.type === 'refund' ? '-' + fmt(s.total) : fmt(s.total)}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
