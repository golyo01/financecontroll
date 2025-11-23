import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  addDoc,
  collection,
  serverTimestamp,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';

const DEFAULT_CATEGORIES = [
  'Élelem',
  'Lak',
  'Utazás',
  'Háztartás',
  'Szórakozás',
  'Szépség',
  'Suzi',
  'Ruha',
  'Ajándék',
  'Egészség',
  'Sport',
  'Egyéb'
];

export default function TransactionForm({ householdId }) {
  const [type, setType] = useState('expense'); // income | expense | saving
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  // 🔹 Kategóriák
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

  // 🔹 Megtakarítási számlák
  const [savingsAccounts, setSavingsAccounts] = useState([]);
  const [savingsAccountId, setSavingsAccountId] = useState('');

  // Háztartáshoz tartozó kategóriák betöltése
  useEffect(() => {
    if (!householdId) {
      setCategories(DEFAULT_CATEGORIES);
      return;
    }

    const q = query(
      collection(db, 'categories'),
      where('householdId', '==', householdId)
    );

    const unsub = onSnapshot(q, snapshot => {
      const custom = snapshot.docs
        .map(doc => doc.data().name)
        .filter(Boolean);

      const merged = [...DEFAULT_CATEGORIES, ...custom].filter(
        (value, index, arr) => arr.indexOf(value) === index
      );

      setCategories(merged);
    });

    return () => unsub();
  }, [householdId]);

  // Háztartáshoz tartozó megtakarítási számlák betöltése
  useEffect(() => {
    if (!householdId) {
      setSavingsAccounts([]);
      setSavingsAccountId('');
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
      setSavingsAccounts(list);

      // ha még nincs kiválasztva számla, de van legalább egy, válasszuk ki az elsőt
      if (!savingsAccountId && list.length > 0) {
        setSavingsAccountId(list[0].id);
      }
    });

    return () => unsub();
  }, [householdId, savingsAccountId]);

  const resetForm = () => {
    setType('expense');
    setAmount('');
    setCategory('');
    setDescription('');
    setDate(new Date().toISOString().slice(0, 10));
    setSavingsAccountId('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!householdId) return;

    const numeric = parseFloat(amount);
    if (Number.isNaN(numeric) || numeric <= 0) return;

    // megtakarítás esetén kötelező a számla
    if (type === 'saving' && !savingsAccountId) {
      alert('Válassz egy megtakarítási számlát!');
      return;
    }

    let txType;
    if (type === 'income') txType = 'income';
    else if (type === 'expense') txType = 'expense';
    else txType = 'saving_deposit'; // speciális típus megtakarításra

    setLoading(true);
    try {
      await addDoc(collection(db, 'transactions'), {
        householdId,
        type: txType,
        amount: numeric,
        category: category || (type === 'saving' ? 'Megtakarítás' : 'Egyéb'),
        description: description || '',
        date: new Date(date),
        savingsAccountId: type === 'saving' ? savingsAccountId : null,
        createdAt: serverTimestamp()
      });

      resetForm();
      setSuccess('Mentve');
      setTimeout(() => setSuccess(''), 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Új tranzakció</div>
          <div className="card-subtitle">
            Rögzíts bevételeket, kiadásokat és megtakarítási utalásokat.
          </div>
        </div>
      </div>
      <form onSubmit={handleSubmit}>
        {success && (
          <div
            className="small"
            style={{ color: '#16a34a', marginBottom: '0.35rem' }}
          >
            {success}
          </div>
        )}
        {/* típus + összeg */}
        <div className="grid-2" style={{ marginBottom: '0.5rem' }}>
          <select
            className="select"
            value={type}
            onChange={e => setType(e.target.value)}
          >
            <option value="income">Bevétel</option>
            <option value="expense">Kiadás</option>
            <option value="saving">Megtakarítás</option>
          </select>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            placeholder="Összeg"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
          />
        </div>

        {/* kategória + dátum */}
        <div className="grid-2" style={{ marginBottom: '0.5rem' }}>
          <div>
            <select
              className="select"
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              <option value="">Kategória</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <input
            className="input"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        {/* Megtakarítási számla választó – csak ha type === saving */}
        {type === 'saving' && (
          <div style={{ marginBottom: '0.5rem' }}>
            <div className="small text-muted" style={{ marginBottom: '0.25rem' }}>
              Válaszd ki, melyik megtakarítási számlára megy:
            </div>
            <select
              className="select"
              value={savingsAccountId}
              onChange={e => setSavingsAccountId(e.target.value)}
            >
              <option value="">Válassz számlát</option>
              {savingsAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name || 'Névtelen megtakarítás'}
                </option>
              ))}
            </select>
            {savingsAccounts.length === 0 && (
              <div className="small text-muted" style={{ marginTop: '0.25rem' }}>
                Nincs még megtakarítási számla. Hozd létre a „Megtakarítások”
                fülön, majd itt válaszd ki.
              </div>
            )}
          </div>
        )}

        <input
          className="input"
          placeholder="Leírás (opcionális)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          style={{ marginBottom: '0.5rem' }}
        />

        <button className="btn btn-primary btn-block" disabled={loading}>
          {loading ? 'Mentés...' : 'Tranzakció rögzítése'}
        </button>
      </form>
    </div>
  );
}
