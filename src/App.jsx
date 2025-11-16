import React from 'react';
import { db } from './firebase';
import {
  collection,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';

import AuthGate from './components/AuthGate.jsx';
import HouseholdSelector from './components/HouseholdSelector.jsx';
import TransactionForm from './components/TransactionForm.jsx';
import Dashboard from './components/Dashboard.jsx';
import Savings from './components/Savings.jsx';
import Reports from './components/Reports.jsx';

export default function App() {
  const [householdId, setHouseholdId] = React.useState('');
  const [transactions, setTransactions] = React.useState([]);
  const [tab, setTab] = React.useState('dashboard');

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
    <AuthGate>
      <HouseholdSelector
        householdId={householdId}
        setHouseholdId={setHouseholdId}
      />

      {!hasHousehold && (
        <div className="card" style={{ marginTop: '0.75rem' }}>
          <div className="small">
            Add meg a háztartás azonosítóját, hogy a több felhasználó közösen,
            valós időben tudja vezetni a költségeket. Ugyanazt az azonosítót
            használjátok mindannyian.
          </div>
        </div>
      )}

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
