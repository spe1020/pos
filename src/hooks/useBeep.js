import { useCallback, useRef } from 'react';

/** Register sounds, synthesised so there are no audio files to ship. */
export function useBeep(muted) {
  const ctxRef = useRef(null);

  return useCallback(
    (kind) => {
      if (muted) return;
      try {
        if (!ctxRef.current) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          ctxRef.current = new AC();
        }
        const ctx = ctxRef.current;
        if (ctx.state === 'suspended') ctx.resume();
        const t0 = ctx.currentTime;

        const tone = (freq, start, dur, type = 'square', vol = 0.05) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = type;
          osc.frequency.setValueAtTime(freq, t0 + start);
          gain.gain.setValueAtTime(vol, t0 + start);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t0 + start);
          osc.stop(t0 + start + dur + 0.02);
        };

        switch (kind) {
          case 'scan':     tone(2350, 0, 0.07); break;
          case 'error':    tone(190, 0, 0.14, 'sawtooth', 0.06); tone(150, 0.13, 0.18, 'sawtooth', 0.06); break;
          case 'sale':     tone(880, 0, 0.07); tone(1320, 0.07, 0.12); break;
          case 'refund':   tone(1320, 0, 0.07); tone(660, 0.07, 0.16); break;
          case 'discount': tone(1050, 0, 0.05); tone(1570, 0.05, 0.09); break;
          default: break;
        }
      } catch {
        /* audio unavailable — silence is fine */
      }
    },
    [muted]
  );
}
