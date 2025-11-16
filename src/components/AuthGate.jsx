import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';

export default function AuthGate({ children }) {
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [userState, setUserState] = useState(() => auth.currentUser);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUserState(u));
    return () => unsub();
  }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, form.email, form.password);
      } else {
        await createUserWithEmailAndPassword(
          auth,
          form.email,
          form.password
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!userState) {
    return (
      <div className="app-shell">
        <div className="card auth-card">
          <div className="card-header">
            <div>
              <div className="card-title">
                {mode === 'login' ? 'Bejelentkezés' : 'Regisztráció'}
              </div>
              <div className="card-subtitle">
                Pénzügyi tervező & közös háztartási költségkövetés
              </div>
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <div
              style={{
                display: 'grid',
                gap: '0.5rem',
                marginBottom: '0.75rem'
              }}
            >
              <input
                className="input"
                type="email"
                placeholder="E-mail"
                value={form.email}
                onChange={e =>
                  setForm({ ...form, email: e.target.value })
                }
                required
              />
              <input
                className="input"
                type="password"
                placeholder="Jelszó (min. 6 karakter)"
                value={form.password}
                onChange={e =>
                  setForm({ ...form, password: e.target.value })
                }
                required
              />
            </div>
            {error && (
              <div
                className="small"
                style={{
                  color: '#f97316',
                  marginBottom: '0.5rem'
                }}
              >
                {error}
              </div>
            )}
            <button
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading
                ? 'Feldolgozás...'
                : mode === 'login'
                ? 'Belépés'
                : 'Regisztráció'}
            </button>
          </form>
          <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() =>
                setMode(mode === 'login' ? 'signup' : 'login')
              }
            >
              {mode === 'login'
                ? 'Nincs fiókod? Regisztrálj'
                : 'Már van fiókod? Jelentkezz be'}
            </button>
          </div>
          <div
            className="small"
            style={{ marginTop: '0.75rem', textAlign: 'center' }}
          >
            Tipp: Több felhasználó ugyanahhoz a háztartáshoz csatlakozhat
            közös azonosítóval.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-header">
        <div className="app-title">Pénzügyi Tervező</div>
        <div
          style={{
            display: 'flex',
            gap: '0.4rem',
            alignItems: 'center'
          }}
        >
          <span className="small text-muted">{userState.email}</span>
          <button
            className="btn btn-secondary"
            onClick={() => {
              signOut(auth);
            }}
          >
            Kilépés
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
