import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';

export default function TransactionList({ transactions }) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    amount: '',
    category: '',
    description: '',
    date: ''
  });

  const lastTransactions = [...transactions]
    .sort((a, b) => b.date - a.date)
    .slice(0, 20);

  const startEdit = tx => {
    const d = tx.date instanceof Date ? tx.date : new Date(tx.date);
    setEditingId(tx.id);
    setEditForm({
      amount: String(tx.amount ?? ''),
      category: tx.category ?? '',
      description: tx.description ?? '',
      date: d.toISOString().slice(0, 10)
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      amount: '',
      category: '',
      description: '',
      date: ''
    });
  };

  const saveEdit = async id => {
    const numeric = parseFloat(editForm.amount);
    if (Number.isNaN(numeric) || numeric <= 0) return;

    try {
      await updateDoc(doc(db, 'transactions', id), {
        amount: numeric,
        category: editForm.category || 'Egyéb',
        description: editForm.description || '',
        date: new Date(editForm.date)
      });
      setEditingId(null);
    } catch (err) {
      console.error('Szerkesztési hiba:', err);
      alert('Nem sikerült menteni a módosítást.');
    }
  };

  const deleteTx = async id => {
    const ok = window.confirm('Biztosan törlöd ezt a tranzakciót?');
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (err) {
      console.error('Törlési hiba:', err);
      alert('Nem sikerült törölni a tranzakciót.');
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Legutóbbi tranzakciók</div>
      </div>

      {lastTransactions.length === 0 ? (
        <div className="small text-muted">
          Még nincsenek rögzített tranzakciók.
        </div>
      ) : (
        <ul className="list">
          {lastTransactions.map(tx => {
            const isIncome = tx.type === 'income';
            const isSaving = tx.type === 'saving_deposit';
            const sign = isIncome ? '+' : '-';
            const cls = isIncome
              ? 'amount-positive'
              : 'amount-negative';

            const isEditing = editingId === tx.id;

            if (isEditing) {
              // 🔧 Szerkesztő mód
              return (
                <li className="list-item" key={tx.id}>
                  <div
                    style={{
                      flex: 1,
                      marginRight: '0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem'
                    }}
                  >
                    <input
                      className="input"
                      type="text"
                      placeholder="Leírás"
                      value={editForm.description}
                      onChange={e =>
                        setEditForm({
                          ...editForm,
                          description: e.target.value
                        })
                      }
                    />
                    <input
                      className="input"
                      type="text"
                      placeholder="Kategória"
                      value={editForm.category}
                      onChange={e =>
                        setEditForm({
                          ...editForm,
                          category: e.target.value
                        })
                      }
                    />
                    <input
                      className="input"
                      type="date"
                      value={editForm.date}
                      onChange={e =>
                        setEditForm({
                          ...editForm,
                          date: e.target.value
                        })
                      }
                    />
                  </div>

                  <div
                    style={{
                      textAlign: 'right',
                      minWidth: '140px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem'
                    }}
                  >
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.amount}
                      onChange={e =>
                        setEditForm({
                          ...editForm,
                          amount: e.target.value
                        })
                      }
                    />
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
                        onClick={() => saveEdit(tx.id)}
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

            // 👀 Normál nézet
            return (
              <li className="list-item" key={tx.id}>
                <div>
                  <div style={{ fontSize: '0.9rem' }}>
                    {tx.description || tx.category}
                  </div>
                  <div className="small text-muted">
                    {tx.date.toLocaleDateString('hu-HU')} · {tx.category}{' '}
                    {isSaving && '· megtakarítás'}
                  </div>
                  <div
                    className="small text-muted"
                    style={{
                      marginTop: '0.25rem',
                      display: 'flex',
                      gap: '0.25rem'
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => startEdit(tx)}
                    >
                      Szerk.
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => deleteTx(tx.id)}
                    >
                      Töröl
                    </button>
                  </div>
                </div>
                <div className={`text-right ${cls}`}>
                  {sign}
                  {tx.amount.toLocaleString('hu-HU', {
                    maximumFractionDigits: 0
                  })}{' '}
                  Ft
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
