import React from 'react';
import { db } from './firebase';
import {
  collection,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';

import AuthGate from './components/AuthGate.jsx';
import TransactionForm from './components/TransactionForm.jsx';
import Dashboard from './components/Dashboard.jsx';
import Savings from './components/Savings.jsx';
import Reports from './components/Reports.jsx';

export default function App() {
  const [householdId, setHouseholdId] = React.useState('');
  const [households, setHouseholds] = React.useState([]);
  const [transactions, setTransactions] = React.useState([]);
  const [tab, setTab] = React.useState('dashboard');

  // Háztartás lista & aktív háztartás visszatöltése
  React.useEffect(() => {
    try {
      const storedList = JSON.parse(
        localStorage.getItem('households') || '[]'
      );
      if (Array.isArray(storedList) && storedList.length) {
        setHouseholds(storedList);
      }
    } catch (err) {
      console.warn('Nem sikerült olvasni a háztartás listát', err);
    }

    const storedActive = localStorage.getItem('householdId');
    if (storedActive) {
      setHouseholdId(storedActive);
    }
  }, []);

  const persistHouseholds = (list, activeId = householdId) => {
    setHouseholds(list);
    localStorage.setItem('households', JSON.stringify(list));
    if (activeId) {
      localStorage.setItem('householdId', activeId);
    } else {
      localStorage.removeItem('householdId');
    }
  };

  const handleSelectHousehold = id => {
    const trimmed = (id || '').trim();
    if (!trimmed) return;

    if (!households.includes(trimmed)) {
      persistHouseholds([...households, trimmed], trimmed);
    } else {
      persistHouseholds(households, trimmed);
    }
    setHouseholdId(trimmed);
  };

  const handleAddHousehold = id => {
    const trimmed = (id || '').trim();
    if (!trimmed) return;
    if (households.includes(trimmed)) {
      handleSelectHousehold(trimmed);
      return;
    }
    persistHouseholds([...households, trimmed], trimmed);
    setHouseholdId(trimmed);
  };

  const handleLeaveHousehold = () => {
    setHouseholdId('');
    localStorage.removeItem('householdId');
  };

  // Firestore-ból tranzakciók betöltése
  React.useEffect(() => {
    if (!householdId) {
      setTransactions([]);
      return;
    }

    const q = query(
      collection(db, 'transactions'),
      where('householdId', '==', householdId)
      // ha lesz index, ide visszatehetjük: orderBy('date', 'asc')
    );

    const unsub = onSnapshot(q, snapshot => {
      const list = snapshot.docs.map(doc => {
        const data = doc.data();
        const date =
          data.date && data.date.toDate ? data.date.toDate() : new Date();
        return {
          id: doc.id,
          ...data,
          date,
          amount: Number(data.amount) || 0
        };
      });
      setTransactions(list);
    });

    return () => unsub();
  }, [householdId]);

  const hasHousehold = Boolean(householdId);

  return (
    <AuthGate
      householdId={householdId}
      households={households}
      onSelectHousehold={handleSelectHousehold}
      onAddHousehold={handleAddHousehold}
      onLeaveHousehold={handleLeaveHousehold}
    >
      {!hasHousehold ? (
        <div className="card" style={{ marginTop: '0.75rem' }}>
          <div className="card-header">
            <div className="card-title">
              Válassz háztartást a Fiókom menüben
            </div>
          </div>
          <div className="card-body small">
            A jobb felső sarokban a „Fiókom” gombnál válassz ki egy meglévő
            háztartást vagy adj hozzá újat, hogy közösen vezethessétek a
            költségeket.
          </div>
        </div>
      ) : null}

      {hasHousehold && (
        <>
          <div className="tabs">
            <button
              className={`tab ${tab === 'dashboard' ? 'tab-active' : ''}`}
              onClick={() => setTab('dashboard')}
            >
              Dashboard
            </button>
            <button
              className={`tab ${tab === 'reports' ? 'tab-active' : ''}`}
              onClick={() => setTab('reports')}
            >
              Tranzakciók
            </button>
            <button
              className={`tab ${tab === 'savings' ? 'tab-active' : ''}`}
              onClick={() => setTab('savings')}
            >
              Megtakarítások
            </button>
          </div>

          {tab === 'dashboard' && (
            <>
              <Dashboard transactions={transactions} />
              <TransactionForm householdId={householdId} />
              {/* Itt már nincs tranzakció lista */}
            </>
          )}

          {tab === 'reports' && (
            <Reports transactions={transactions} />
          )}

          {tab === 'savings' && (
            <Savings householdId={householdId} />
          )}
        </>
      )}
    </AuthGate>
  );
}
