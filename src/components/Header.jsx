import React from 'react';
import { fmt } from '../lib/money';

export default function Header({
  modes, mode, setMode, storeName, onStoreName, net, muted, onMute,
}) {
  return (
    <header className="bar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <input
          className="brand-name"
          value={storeName}
          onChange={(e) => onStoreName(e.target.value)}
          aria-label="Store name"
        />
      </div>

      <nav className="modes" role="tablist" aria-label="Register mode">
        {modes.map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={mode === m.id}
            className={'mode' + (mode === m.id ? ' on' : '')}
            onClick={() => setMode(m.id)}
          >
            {m.label}
            <kbd aria-hidden="true">{m.key}</kbd>
          </button>
        ))}
      </nav>

      <div className="bar-right">
        <div className="daybox">
          <span className="daybox-k">Today</span>
          <span className="daybox-v">{fmt(net)}</span>
        </div>
        <button
          className="icon-btn"
          onClick={onMute}
          aria-label={muted ? 'Turn beeper on' : 'Turn beeper off'}
          title={muted ? 'Beeper off' : 'Beeper on'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </header>
  );
}
