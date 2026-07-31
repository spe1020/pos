import { useEffect, useRef } from 'react';

/**
 * Nearly every USB barcode scanner is a "keyboard wedge": the operating system
 * sees a keyboard, and a scan arrives as the barcode's characters typed very
 * fast followed by Enter. No driver, no WebUSB, no permissions prompt.
 *
 * We tell a scan apart from a person typing by the gap between keystrokes.
 * A scanner fires characters 2-15ms apart; a fast human is 80ms+ at best.
 *
 * Listening on window (rather than an input) means the cashier never has to
 * click into a box first — the register is always listening, like a real one.
 */
export function useScanner(onScan, { enabled = true, minLength = 3, gapMs = 120 } = {}) {
  const handler = useRef(onScan);
  handler.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    let buffer = '';
    let lastKeyAt = 0;
    let flushTimer = null;

    const onKeyDown = (e) => {
      // If the cashier is deliberately typing into a field, let them.
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const now = Date.now();
      if (now - lastKeyAt > gapMs) buffer = '';
      lastKeyAt = now;

      if (e.key === 'Enter') {
        if (buffer.length >= minLength) {
          e.preventDefault();
          handler.current(buffer.trim());
        }
        buffer = '';
        return;
      }

      if (e.key.length === 1) buffer += e.key;

      clearTimeout(flushTimer);
      flushTimer = setTimeout(() => {
        buffer = '';
      }, 250);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearTimeout(flushTimer);
    };
  }, [enabled, minLength, gapMs]);
}
