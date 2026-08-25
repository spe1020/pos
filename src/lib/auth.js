import { load, save, KEYS } from './storage.js';

export const LOGIN = '1234';
export const PASSWORD = '1234';
export const SESSION_MS = 60 * 60 * 1000; // 1 hour of idle time

export function credentialsMatch(user, pass) {
  return user === LOGIN && pass === PASSWORD;
}

export function sessionIsValid(session, now = Date.now()) {
  return !!(session && typeof session.expiresAt === 'number' && now < session.expiresAt);
}

export function readSession() {
  const s = load(KEYS.session, null);
  return sessionIsValid(s) ? s : null;
}

export function writeSession(now = Date.now()) {
  const next = { expiresAt: now + SESSION_MS };
  save(KEYS.session, next);
  return next;
}

export function clearSession() {
  save(KEYS.session, null);
}
