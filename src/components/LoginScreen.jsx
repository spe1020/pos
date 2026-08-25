import React, { useEffect, useRef, useState } from 'react';

export default function LoginScreen({ storeName, timedOut, onLogin }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const loginRef = useRef(null);

  useEffect(() => {
    loginRef.current?.focus();
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!login.trim() || !password) {
      setError('Enter a login and password');
      return;
    }
    if (!onLogin(login.trim(), password)) {
      setError('Wrong login or password');
      setPassword('');
      return;
    }
    setError('');
  };

  return (
    <div className="pos-root lock">
      <form className="lock-card" onSubmit={submit}>
        <div className="lock-brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <div className="lock-kicker">Register</div>
            <h1 className="lock-store">{storeName || 'The Corner Store'}</h1>
          </div>
        </div>

        <p className="lock-note">
          {timedOut
            ? 'Signed out after an hour idle. Sign in to keep going.'
            : 'Sign in to open the register.'}
        </p>

        <label className="field">
          <span>Login</span>
          <input
            ref={loginRef}
            value={login}
            onChange={(e) => { setLogin(e.target.value); setError(''); }}
            autoComplete="username"
            inputMode="numeric"
            name="username"
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            autoComplete="current-password"
            inputMode="numeric"
            name="password"
          />
        </label>

        {error && <p className="lock-error" role="alert">{error}</p>}

        <button className="btn pay lock-go" type="submit">Sign in</button>
      </form>
    </div>
  );
}
