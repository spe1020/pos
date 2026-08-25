import { useCallback, useEffect, useState } from 'react';
import {
  credentialsMatch,
  readSession,
  writeSession,
  clearSession,
} from '../lib/auth';

export function useAuth() {
  const [session, setSession] = useState(readSession);
  const [timedOut, setTimedOut] = useState(false);
  const loggedIn = !!session;

  const login = useCallback((user, pass) => {
    if (!credentialsMatch(user, pass)) return false;
    setSession(writeSession());
    setTimedOut(false);
    return true;
  }, []);

  const logout = useCallback((reason = 'manual') => {
    clearSession();
    setSession(null);
    setTimedOut(reason === 'timeout');
  }, []);

  useEffect(() => {
    if (!loggedIn) return;

    const tick = () => {
      if (!readSession()) logout('timeout');
    };
    const id = setInterval(tick, 5000);

    let lastBump = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastBump < 15000) return;
      lastBump = now;
      writeSession();
    };

    window.addEventListener('pointerdown', onActivity);
    window.addEventListener('keydown', onActivity);
    return () => {
      clearInterval(id);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, [loggedIn, logout]);

  return { loggedIn, login, logout, timedOut };
}
