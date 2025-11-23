import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';

export default function AuthGate({
  children,
  householdId,
  households = [],
  onSelectHousehold = () => {},
  onAddHousehold = () => {},
  onLeaveHousehold = () => {}
}) {
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [userState, setUserState] = useState(() => auth.currentUser);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [newHouseholdId, setNewHouseholdId] = useState('');

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
              alignItems: 'center',
              position: 'relative'
            }}
          >
            <button
              className="btn btn-secondary"
              onClick={() => setMenuOpen(open => !open)}
            >
              Fiókom
            </button>
            {menuOpen && (
              <div
                className="card"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 0.5rem)',
                  right: 0,
                  minWidth: '280px',
                  zIndex: 10
                }}
              >
                <div className="card-header">
                  <div>
                    <div className="card-title">Fiók & háztartások</div>
                    <div className="card-subtitle small">
                      {userState.email}
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      signOut(auth);
                    }}
                  >
                    Kilépés
                  </button>
                </div>

                <div className="card-body" style={{ display: 'grid', gap: '0.5rem' }}>
                  <div>
                    <div className="small text-muted">Aktív háztartás</div>
                    <div style={{ fontWeight: 500 }}>
                      {householdId || 'Nincs kiválasztva'}
                    </div>
                    {householdId && (
                      <button
                        className="btn btn-secondary"
                        style={{ marginTop: '0.35rem' }}
                        onClick={() => {
                          onLeaveHousehold();
                          setMenuOpen(false);
                        }}
                      >
                        Kilépés a háztartásból
                      </button>
                    )}
                  </div>

                  <div>
                    <div className="small text-muted">
                      Háztartás váltása
                    </div>
                    {households.length === 0 && (
                      <div className="small text-muted">
                        Még nincs felvéve háztartás.
                      </div>
                    )}
                    {households.length > 0 && (
                      <div style={{ display: 'grid', gap: '0.35rem' }}>
                        {households.map(id => (
                          <button
                            key={id}
                            className="btn btn-secondary"
                            style={{
                              justifyContent: 'space-between',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            onClick={() => {
                              onSelectHousehold(id);
                              setMenuOpen(false);
                            }}
                          >
                            <span>{id}</span>
                            {householdId === id && (
                              <span className="chip">Aktív</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="small text-muted">
                      Új háztartás hozzáadása
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.25rem' }}>
                      <input
                        className="input"
                        placeholder="Háztartás azonosító"
                        value={newHouseholdId}
                        onChange={e => setNewHouseholdId(e.target.value)}
                      />
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          onAddHousehold(newHouseholdId);
                          setNewHouseholdId('');
                          setMenuOpen(false);
                        }}
                      >
                        Hozzáadás
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {children}
      </div>
    );
}
