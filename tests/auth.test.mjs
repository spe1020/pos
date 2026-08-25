import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LOGIN,
  PASSWORD,
  SESSION_MS,
  credentialsMatch,
  sessionIsValid,
} from '../src/lib/auth.js';

test('1234 / 1234 is the only accepted pair', () => {
  assert.equal(credentialsMatch(LOGIN, PASSWORD), true);
  assert.equal(credentialsMatch('1234', '1234'), true);
  assert.equal(credentialsMatch('1234', '0000'), false);
  assert.equal(credentialsMatch('0000', '1234'), false);
  assert.equal(credentialsMatch('', ''), false);
  assert.equal(credentialsMatch('1234 ', '1234'), false);
});

test('a session lasts one hour from the expiry timestamp', () => {
  const now = 1_700_000_000_000;
  const session = { expiresAt: now + SESSION_MS };
  assert.equal(SESSION_MS, 60 * 60 * 1000);
  assert.equal(sessionIsValid(session, now), true);
  assert.equal(sessionIsValid(session, now + SESSION_MS - 1), true);
  assert.equal(sessionIsValid(session, now + SESSION_MS), false);
  assert.equal(sessionIsValid(session, now + SESSION_MS + 1), false);
  assert.equal(sessionIsValid(null, now), false);
  assert.equal(sessionIsValid({}, now), false);
});
