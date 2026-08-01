import React, { useRef, useState, useMemo } from 'react';
import { parseMoney, toInput } from '../lib/money';

export default function ItemsPane({
  list, onUpdate, onDelete, settings, onSettings, onExport, onImport, persistent,
}) {
  const fileRef = useRef(null);
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => p.name.toLowerCase().includes(q) || p.barcode.includes(q));
  }, [list, query]);

  return (
    <>
      <div className="pane-head">
        <h2>Items</h2>
        <div className="head-tools">
          <label className="taxfield">
            Tax %
            <input
              value={settings.taxPct}
              onChange={(e) => onSettings({ ...settings, taxPct: e.target.value.replace(/[^0-9.]/g, '') })}
              inputMode="decimal"
            />
          </label>
          <label className="checkfield">
            <input
              type="checkbox"
              checked={!!settings.trackStock}
              onChange={(e) => onSettings({ ...settings, trackStock: e.target.checked })}
            />
            Track stock
          </label>
        </div>
      </div>

      <div className="manual tight">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search items"
          aria-label="Search items"
        />
        <button className="btn ghost" onClick={onExport}>Back up</button>
        <button className="btn ghost" onClick={() => fileRef.current?.click()}>Restore</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
            e.target.value = '';
          }}
        />
      </div>

      {!persistent && (
        <p className="warnbar">
          This browser is blocking local storage, so nothing will survive a refresh. Open the app
          over <code>http://localhost</code> rather than a <code>file://</code> path.
        </p>
      )}

      {list.length === 0 ? (
        <div className="empty">
          <h3>No items saved.</h3>
          <p>Scan something to add the first one, or restore from a backup file.</p>
        </div>
      ) : (
        <div className={'table' + (settings.trackStock ? ' with-stock' : '')}>
          <div className="th">
            <span>Name</span>
            <span>Price</span>
            {settings.trackStock && <span>Stock</span>}
            <span>Barcode</span>
            <span />
          </div>
          {shown.map((p) => (
            <div className="tr" key={p.barcode}>
              <input
                className="cell"
                value={p.name}
                onChange={(e) => onUpdate(p.barcode, { name: e.target.value })}
                aria-label={`Name for ${p.name}`}
              />
              <input
                className="cell num"
                defaultValue={toInput(p.price)}
                key={p.barcode + p.price}
                onBlur={(e) => onUpdate(p.barcode, { price: parseMoney(e.target.value) })}
                inputMode="decimal"
                aria-label={`Price for ${p.name}`}
              />
              {settings.trackStock && (
                <input
                  className="cell num small"
                  value={p.stock ?? 0}
                  onChange={(e) =>
                    onUpdate(p.barcode, { stock: parseInt(e.target.value.replace(/[^0-9-]/g, ''), 10) || 0 })
                  }
                  inputMode="numeric"
                  aria-label={`Stock for ${p.name}`}
                />
              )}
              <span className="cell code">{p.barcode}</span>
              <button className="del" onClick={() => onDelete(p.barcode)} aria-label={`Delete ${p.name}`}>×</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
