import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore';

/**
 * Egyszerű grafikon a megtakarítás értékének alakulásáról.
 * X tengely: dátum, Y tengely: aktuális érték (Ft).
 */
function SavingsChart({ snapshots }) {
  if (!snapshots.length) {
    return (
      <div className="small text-muted" style={{ marginTop: '0.25rem' }}>
        Még nincs mentett érték ehhez a számlához.
      </div>
    );
  }

  const sorted = [...snapshots].sort((a, b) => {
    const da =
      a.createdAt && a.createdAt.toDate ? a.createdAt.toDate() : new Date();
    const db =
      b.createdAt && b.createdAt.toDate ? b.createdAt.toDate() : new Date();
    return da - db;
  });

  const width = 260;
  const height = 80;
  const padding = 10;

  const values = sorted.map(s => Number(s.value) || 0);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const range = maxVal - minVal || 1;

  const points = sorted
    .map((s, index) => {
      const x =
        padding +
        (sorted.length === 1
          ? (width - 2 * padding) / 2
          : (index / (sorted.length - 1)) * (width - 2 * padding));

      const norm = (Number(s.value) - minVal) / range;
      const y =
        height - padding - norm * (height - 2 * padding); // SVG-ben fentről lefelé megy az y
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: '80px' }}
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          points={points}
        />
      </svg>
      <div className="small text-muted">
        Érték alakulása időben (naplózott módosítások alapján).
      </div>
    </div>
  );
}

export default function Savings({ householdId }) {
  const [accounts, setAccounts] = useState([]);
  const [savingTx, setSavingTx] = useState([]);
  const [snapshots, setSnapshots] = useState([]);

  const [newName, setNewName] = useState('');
  const [newStart, setNewStart] = useState('');
  const [saving, setSaving] = useState(false);

  // szerkesztés állapot
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    startingAmount: '',
    currentValue: ''
  });

  // melyik számla van lenyitva (grafikon)
  const [expandedId, setExpandedId] = useState(null);

  // 🔄 Megtakarítási számlák
  useEffect(() => {
    if (!householdId) {
      setAccounts([]);
      return;
    }

    const q = query(
      collection(db, 'savingsAccounts'),
      where('householdId', '==', householdId)
    );

    const unsub = onSnapshot(q, snapshot => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAccounts(list);
    });

    return () => unsub();
  }, [householdId]);

  // 🔄 saving_deposit tranzakciók (befizetések)
  useEffect(() => {
    if (!householdId) {
      setSavingTx([]);
      return;
    }

    const q = query(
      collection(db, 'transactions'),
      where('householdId', '==', householdId),
      where('type', '==', 'saving_deposit')
    );

    const unsub = onSnapshot(q, snapshot => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        amount: Number(doc.data().amount) || 0
      }));
      setSavingTx(list);
    });

    return () => unsub();
  }, [householdId]);

  // 🔄 érték-napló (savingsSnapshots)
  useEffect(() => {
    if (!householdId) {
      setSnapshots([]);
      return;
    }

    const q = query(
      collection(db, 'savingsSnapshots'),
      where('householdId', '==', householdId)
    );

    const unsub = onSnapshot(q, snapshot => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSnapshots(list);
    });

    return () => unsub();
  }, [householdId]);

  // 📊 Számlák tőkéjének kiszámítása (kezdőtőke + befizetések)
  const accountsWithStats = useMemo(() => {
    return accounts.map(acc => {
      const base = Number(acc.startingAmount ?? 0) || 0;

      const deposits = savingTx
        .filter(tx => tx.savingsAccountId === acc.id)
        .reduce((sum, tx) => sum + tx.amount, 0);

      const capital = base + deposits;

      const currentValue =
        acc.currentValue != null
          ? Number(acc.currentValue)
          : capital;

      const profit = currentValue - capital;
      const profitPct =
        capital > 0 ? (profit / capital) * 100 : 0;

      return {
        ...acc,
        base,
        deposits,
        capital,
        currentValue,
        profit,
        profitPct
      };
    });
  }, [accounts, savingTx]);

  // 📝 helper: snapshot logolása minden módosításkor
  const logSnapshot = async (accountId, capital, value) => {
    if (!householdId) return;
    try {
      await addDoc(collection(db, 'savingsSnapshots'), {
        householdId,
        accountId,
        capital,
        value,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Nem sikerült elmenteni a snapshotot:', err);
    }
  };

  // ➕ Új számla létrehozása
  const handleCreateAccount = async e => {
    e.preventDefault();
    if (!householdId) return;

    const name = newName.trim();
    const start = parseFloat(newStart) || 0;

    if (!name) return;

    setSaving(true);
    try {
      const ref = await addDoc(collection(db, 'savingsAccounts'), {
        householdId,
        name,
        startingAmount: start,
        currentValue: start,
        createdAt: serverTimestamp()
      });

      // első snapshot (kezdő érték)
      await logSnapshot(ref.id, start, start);

      setNewName('');
      setNewStart('');
    } finally {
      setSaving(false);
    }
  };

  // ✏️ szerkesztés indítása
  const startEdit = acc => {
    setEditingId(acc.id);
    setEditForm({
      name: acc.name || '',
      startingAmount:
        acc.startingAmount != null ? String(acc.startingAmount) : '',
      currentValue:
        acc.currentValue != null ? String(acc.currentValue) : ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      name: '',
      startingAmount: '',
      currentValue: ''
    });
  };

  // 💾 szerkesztés mentése (név + kezdőtőke + aktuális érték)
  const saveEdit = async id => {
    const name = editForm.name.trim();
    const start = parseFloat(editForm.startingAmount) || 0;
    const current = parseFloat(editForm.currentValue) || 0;

    if (!name) {
      alert('A név nem lehet üres.');
      return;
    }

    // depozitokat a már kiszámolt stats-ból vesszük
    const accStats = accountsWithStats.find(a => a.id === id);
    const deposits = accStats ? accStats.deposits : 0;
    const capital = start + deposits;

    try {
      await updateDoc(doc(db, 'savingsAccounts', id), {
        name,
        startingAmount: start,
        currentValue: current
      });

      // log: új érték + tőke
      await logSnapshot(id, capital, current);

      setEditingId(null);
    } catch (err) {
      console.error('Nem sikerült menteni a módosítást:', err);
    }
  };

  // ⚡ gyors frissítés csak az aktuális piaci értékre (normál nézetben)
  const handleUpdateCurrentValue = async (id, value) => {
    const numeric = parseFloat(value);
    if (Number.isNaN(numeric)) return;

    const accStats = accountsWithStats.find(a => a.id === id);
    const capital = accStats ? accStats.capital : 0;

    try {
      await updateDoc(doc(db, 'savingsAccounts', id), {
        currentValue: numeric
      });

      // logoljuk a módosítást is
      await logSnapshot(id, capital, numeric);
    } catch (err) {
      console.error('Nem sikerült frissíteni az aktuális értéket:', err);
    }
  };

  const toggleExpanded = id => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Megtakarítások</div>
          <div className="card-subtitle">
            Hozz létre külön megtakarítási számlákat (pl. Nyugdíj, Utazás),
            majd a tranzakcióknál „Megtakarítás” típust választva ide
            utalhatsz pénzt. Minden módosítás naplózásra kerül.
          </div>
        </div>
      </div>

      {/* Új számla létrehozása */}
      <form onSubmit={handleCreateAccount} style={{ marginBottom: '1rem' }}>
        <div className="grid-2" style={{ marginBottom: '0.5rem' }}>
          <input
            className="input"
            placeholder="Megtakarítás neve (pl. Utazás)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            placeholder="Kezdőtőke (opcionális)"
            value={newStart}
            onChange={e => setNewStart(e.target.value)}
          />
        </div>
        <button className="btn btn-primary btn-block" disabled={saving}>
          {saving ? 'Létrehozás...' : 'Új megtakarítási számla létrehozása'}
        </button>
      </form>

      {/* Számlák listája */}
      {accountsWithStats.length === 0 ? (
        <div className="small text-muted">
          Még nincs megtakarítási számla. Hozz létre egyet fent.
        </div>
      ) : (
        <ul className="list">
          {accountsWithStats.map(acc => {
            const isEditing = editingId === acc.id;
            const snapsForAcc = snapshots.filter(
              s => s.accountId === acc.id
            );
            const isExpanded = expandedId === acc.id;

            if (isEditing) {
              // ✏️ SZERKESZTŐ MÓD
              return (
                <li className="list-item" key={acc.id}>
                  <div style={{ flex: 1, marginRight: '0.5rem' }}>
                    <input
                      className="input"
                      placeholder="Név"
                      value={editForm.name}
                      onChange={e =>
                        setEditForm({ ...editForm, name: e.target.value })
                      }
                      style={{ marginBottom: '0.25rem' }}
                    />
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      placeholder="Kezdőtőke"
                      value={editForm.startingAmount}
                      onChange={e =>
                        setEditForm({
                          ...editForm,
                          startingAmount: e.target.value
                        })
                      }
                      style={{ marginBottom: '0.25rem' }}
                    />
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      placeholder="Aktuális piaci érték"
                      value={editForm.currentValue}
                      onChange={e =>
                        setEditForm({
                          ...editForm,
                          currentValue: e.target.value
                        })
                      }
                    />
                  </div>
                  <div
                    style={{
                      textAlign: 'right',
                      minWidth: '160px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem'
                    }}
                  >
                    <div className="small text-muted">
                      Összes befektetett tőke:{' '}
                      {acc.capital.toLocaleString('hu-HU', {
                        maximumFractionDigits: 0
                      })}{' '}
                      Ft
                    </div>
                    <div
                      className={
                        acc.profit >= 0
                          ? 'amount-positive'
                          : 'amount-negative'
                      }
                    >
                      Hozam:{' '}
                      {acc.profit.toLocaleString('hu-HU', {
                        maximumFractionDigits: 0
                      })}{' '}
                      Ft ({acc.profitPct.toFixed(1)}%)
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.25rem',
                        justifyContent: 'flex-end'
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => saveEdit(acc.id)}
                      >
                        Mentés
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={cancelEdit}
                      >
                        Mégse
                      </button>
                    </div>
                  </div>
                </li>
              );
            }

            // 👀 NORMÁL NÉZET
            return (
              <li className="list-item" key={acc.id}>
                <div style={{ flex: 1, marginRight: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => toggleExpanded(acc.id)}
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 500,
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      margin: 0,
                      color: 'inherit',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    {acc.name || 'Névtelen megtakarítás'}
                  </button>
                  <div className="small text-muted">
                    Kezdőtőke:{' '}
                    {acc.base.toLocaleString('hu-HU', {
                      maximumFractionDigits: 0
                    })}{' '}
                    Ft · Befizetések:{' '}
                    {acc.deposits.toLocaleString('hu-HU', {
                      maximumFractionDigits: 0
                    })}{' '}
                    Ft
                  </div>
                  <div className="small text-muted">
                    Összes befektetett tőke:{' '}
                    {acc.capital.toLocaleString('hu-HU', {
                      maximumFractionDigits: 0
                    })}{' '}
                    Ft
                  </div>
                  <div
                    className="small text-muted"
                    style={{ marginTop: '0.25rem', display: 'flex', gap: '0.25rem' }}
                  >
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => startEdit(acc)}
                    >
                      Szerk.
                    </button>
                    <span>
                      {isExpanded ? 'Grafikon elrejtése' : 'Grafikon megjelenítése'}
                    </span>
                  </div>

                  {isExpanded && <SavingsChart snapshots={snapsForAcc} />}
                </div>
                <div style={{ textAlign: 'right', minWidth: '180px' }}>
                  <div className="small text-muted">
                    Aktuális piaci érték:
                  </div>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={acc.currentValue}
                    onChange={e =>
                      handleUpdateCurrentValue(acc.id, e.target.value)
                    }
                    style={{ marginBottom: '0.25rem' }}
                  />
                  <div
                    className={
                      acc.profit >= 0
                        ? 'amount-positive'
                        : 'amount-negative'
                    }
                  >
                    Hozam:{' '}
                    {acc.profit.toLocaleString('hu-HU', {
                      maximumFractionDigits: 0
                    })}{' '}
                    Ft ({acc.profitPct.toFixed(1)}%)
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
