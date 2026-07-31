import React, { useState, useMemo } from 'react';
import { fmt } from '../lib/money';

export default function SellPane({
  catalog, onPick, onManual, onCustomItem, scanning, trackStock,
}) {
  const [manual, setManual] = useState('');
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (p) => p.name.toLowerCase().includes(q) || p.barcode.includes(q)
    );
  }, [catalog, query]);

  const submitManual = () => {
    const v = manual.trim();
    if (!v) return;
    onManual(v);
    setManual('');
  };

  return (
    <>
      <div className="pane-head">
        <h2>Ring up</h2>
        <div className={'scan-state' + (scanning ? ' live' : '')}>
          <span className="dot" aria-hidden="true" />
          {scanning ? 'Scanner ready' : 'Scanner paused'}
        </div>
      </div>

      <div className="manual">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitManual()}
          placeholder="No scanner handy? Type a barcode and press Enter"
          aria-label="Enter barcode manually"
        />
        <button className="btn ghost" onClick={submitManual}>Enter</button>
        <button className="btn ghost" onClick={onCustomItem} title="Something with no barcode">
          Custom item
        </button>
      </div>

      {catalog.length === 0 ? (
        <div className="empty">
          <h3>The shelves are empty.</h3>
          <p>
            Scan anything with a barcode — a cereal box, a soda can, a library book. The first
            scan asks for a name and a price, and every scan after that is instant.
          </p>
        </div>
      ) : (
        <>
          <div className="manual tight">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items"
              aria-label="Search items"
            />
          </div>
          <div className="grid">
            {shown.map((p) => {
              const out = trackStock && Number(p.stock) <= 0;
              const low = trackStock && Number(p.stock) > 0 && Number(p.stock) <= 3;
              return (
                <button
                  className={'tile' + (out ? ' out' : '')}
                  key={p.barcode}
                  onClick={() => onPick(p)}
                >
                  <span className="tile-name">{p.name}</span>
                  <span className="tile-price">{fmt(p.price)}</span>
                  <span className="tile-foot">
                    <span className="tile-code">{p.barcode}</span>
                    {trackStock && (
                      <span className={'stock' + (out ? ' out' : low ? ' low' : '')}>
                        {out ? 'out' : `${p.stock} left`}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
            {shown.length === 0 && <p className="nores">Nothing matches “{query}”.</p>}
          </div>
        </>
      )}
    </>
  );
}
