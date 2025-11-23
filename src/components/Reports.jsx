import React, { useMemo, useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';

function formatFt(value) {
  return (
    value.toLocaleString('hu-HU', { maximumFractionDigits: 0 }) + ' Ft'
  );
}

function normalizeDate(d) {
  if (!d) return new Date();
  if (d.toDate) return d.toDate(); // Firestore Timestamp
  if (d instanceof Date) return d;
  return new Date(d);
}

function toDateInputValue(date) {
  const d = normalizeDate(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function Reports({ transactions }) {
  const [yearFilter, setYearFilter] = useState('all');
  const [copyMsg, setCopyMsg] = useState('');

  // szerkesztés állapot
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    date: '',
    type: 'income',
    category: '',
    amount: '',
    description: ''
  });

  const {
    monthIncome,
    monthExpense,
    monthSavings,
    monthTotalOut,
    monthRemaining,
    monthRemainingClass,
    monthlyCategorySummary,
    years,
    transactionsByMonth
  } = useMemo(() => {
    if (!Array.isArray(transactions)) {
      return {
        monthIncome: 0,
        monthExpense: 0,
        monthSavings: 0,
        monthTotalOut: 0,
        monthRemaining: 0,
        monthRemainingClass: 'amount-positive',
        monthlyCategorySummary: [],
        years: [],
        transactionsByMonth: []
      };
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0–11

    let monthIncome = 0;
    let monthExpense = 0;
    let monthSavings = 0;

    const monthCategoryMap = new Map(); // aktuális hónap kategóriái
    const yearsSet = new Set();
    const monthTxMap = new Map(); // havi tranzakciólista (minden hónapra)

    for (const tx of transactions) {
      const amount = Number(tx.amount) || 0;
      const type = tx.type;
      const date = normalizeDate(tx.date);
      const year = date.getFullYear();
      const monthIdx = date.getMonth(); // 0–11
      const key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;

      yearsSet.add(year);

      const isCurrentMonth =
        year === currentYear && monthIdx === currentMonth;

      // Aktuális hónap összegzése
      if (isCurrentMonth) {
        if (type === 'income') {
          monthIncome += amount;
        } else if (type === 'expense') {
          monthExpense += amount;
        } else if (type === 'saving_deposit') {
          monthSavings += amount;
        }

        // Aktuális hónap kategória bontása (csak kiadás + megtakarítás)
        if (type === 'expense' || type === 'saving_deposit') {
          const categoryName =
            type === 'saving_deposit'
              ? 'Megtakarítás'
              : tx.category || 'Egyéb';
          if (!monthCategoryMap.has(categoryName)) {
            monthCategoryMap.set(categoryName, 0);
          }
          monthCategoryMap.set(
            categoryName,
            monthCategoryMap.get(categoryName) + amount
          );
        }
      }

      // Havi tranzakciólista (minden hónapra)
      if (!monthTxMap.has(key)) {
        monthTxMap.set(key, {
          year,
          monthIdx,
          transactions: []
        });
      }
      monthTxMap.get(key).transactions.push({ ...tx, date });
    }

    // Aktuális hónap végső értékek
    const monthTotalOut = monthExpense + monthSavings;
    const monthRemaining = monthIncome - monthTotalOut;
    const monthRemainingClass =
      monthRemaining >= 0 ? 'amount-positive' : 'amount-negative';

    // Aktuális hónap kategória bontás
    const totalOutMonth = Array.from(monthCategoryMap.values()).reduce(
      (sum, v) => sum + v,
      0
    );
    const monthlyCategorySummary = Array.from(monthCategoryMap.entries())
      .map(([name, value]) => ({
        name,
        value,
        pct: totalOutMonth > 0 ? (value / totalOutMonth) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);

    // elérhető évek a szűrőhöz
    const years = Array.from(yearsSet).sort((a, b) => b - a);

    // havi tranzakciók lista (hónapok újabbtól régebbig, tranzakciók dátum szerint)
    const transactionsByMonth = Array.from(monthTxMap.values())
      .map(group => ({
        ...group,
        transactions: group.transactions
          .slice()
          .sort(
            (a, b) => normalizeDate(b.date) - normalizeDate(a.date)
          )
      }))
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.monthIdx - a.monthIdx;
      });

    return {
      monthIncome,
      monthExpense,
      monthSavings,
        monthTotalOut,
        monthRemaining,
        monthRemainingClass,
        monthlyCategorySummary,
        years,
        transactionsByMonth
      };
  }, [transactions]);

  const copyCategories = async () => {
    if (!monthlyCategorySummary.length) return;
    const rows = monthlyCategorySummary.map(
      cat => `${cat.name}: ${formatFt(cat.value)}`
    );
    const text = rows.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg('Kimásolva');
      setTimeout(() => setCopyMsg(''), 2000);
    } catch (err) {
      console.error('Másolási hiba:', err);
      setCopyMsg('Nem sikerült másolni');
      setTimeout(() => setCopyMsg(''), 2000);
    }
  };

  // Év szűrő a tranzakciólistára
  const filteredTxByMonth =
    yearFilter === 'all'
      ? transactionsByMonth
      : transactionsByMonth.filter(m => m.year === Number(yearFilter));

  // === Szerkesztés / törlés logika ===

  const startEdit = tx => {
    setEditingId(tx.id);
    setEditForm({
      date: toDateInputValue(tx.date),
      type: tx.type || 'income',
      category: tx.category || '',
      amount: String(tx.amount ?? ''),
      description: tx.description || ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      date: '',
      type: 'income',
      category: '',
      amount: '',
      description: ''
    });
  };

  const saveEdit = async id => {
    const amountNum = Number(editForm.amount) || 0;
    const dateVal = editForm.date ? new Date(editForm.date) : new Date();
    const type = editForm.type || 'income';
    const category = editForm.category || null;
    const description = editForm.description || '';

    try {
      await updateDoc(doc(db, 'transactions', id), {
        amount: amountNum,
        date: dateVal,
        type,
        category,
        description
      });
      cancelEdit();
    } catch (err) {
      console.error('Nem sikerült frissíteni a tranzakciót:', err);
      alert('Nem sikerült menteni a módosítást.');
    }
  };

  const deleteTx = async id => {
    const ok = window.confirm('Biztosan törlöd ezt a tranzakciót?');
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'transactions', id));
      if (editingId === id) {
        cancelEdit();
      }
    } catch (err) {
      console.error('Nem sikerült törölni a tranzakciót:', err);
      alert('Nem sikerült törölni a tranzakciót.');
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Tranzakciók & kimutatások</div>
          <div className="card-subtitle">
            Bevétel, kiadás, megtakarítás és havi kategória bontás, plusz
            havi tranzakciólista (szerkesztéssel és törléssel).
          </div>
        </div>
      </div>

      <div className="card-body">
        {/* AKTUÁLIS HÓNAP ÖSSZEFOGLALÓ */}
        <section style={{ marginBottom: '1.5rem' }}>
          <div
            style={{
              fontSize: '0.9rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: '0.5rem'
            }}
          >
            Aktuális hónap
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div className="small text-muted">Bevétel</div>
              <div className="amount-positive">
                + {formatFt(monthIncome).replace('-', '')}
              </div>

              <div className="small text-muted" style={{ marginTop: '0.4rem' }}>
                Megtakarításba utalt összeg
              </div>
              <div className="amount-negative">
                - {formatFt(monthSavings).replace('-', '')}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div className="small text-muted">Kiadás + megtakarítás</div>
              <div className="amount-negative">
                - {formatFt(monthTotalOut).replace('-', '')}
              </div>

              <div
                className={monthRemainingClass}
                style={{ marginTop: '0.4rem' }}
              >
                Egyenleg:{' '}
                {monthRemaining >= 0
                  ? '+ ' + formatFt(monthRemaining)
                  : formatFt(monthRemaining)}
              </div>
            </div>
          </div>
        </section>

        {/* HAVI KATEGÓRIA BONTÁS (AKTUÁLIS HÓNAP) */}
        <section style={{ marginBottom: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem'
            }}
          >
            <div
              style={{
                fontSize: '0.9rem',
                letterSpacing: '0.12em',
                textTransform: 'uppercase'
              }}
            >
              Kategória bontás (aktuális hónap)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {copyMsg && (
                <span className="small text-muted">{copyMsg}</span>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={copyCategories}
                disabled={!monthlyCategorySummary.length}
              >
                Másolom
              </button>
            </div>
          </div>

          {monthlyCategorySummary.length === 0 ? (
            <div className="small text-muted">
              Ebben a hónapban még nincs kiadás vagy megtakarítás.
            </div>
          ) : (
            <ul className="list">
              {monthlyCategorySummary.map(cat => (
                <li className="list-item" key={cat.name}>
                  <div>{cat.name}</div>
                  <div style={{ textAlign: 'right' }}>
                    <div>{formatFt(cat.value)}</div>
                    <div className="small text-muted">
                      {cat.pct.toFixed(1)}%
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* HAVI TRANZAKCIÓLISTA ÉVSZŰRŐVEL */}
        <section>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem'
            }}
          >
            <div
              style={{
                fontSize: '0.9rem',
                letterSpacing: '0.12em',
                textTransform: 'uppercase'
              }}
            >
              Tranzakciólista havi bontásban
            </div>
            <div>
              <select
                className="input"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                value={yearFilter}
                onChange={e => setYearFilter(e.target.value)}
              >
                <option value="all">Összes év</option>
                {years.map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredTxByMonth.length === 0 ? (
            <div className="small text-muted">
              Nincs megjeleníthető tranzakció ebben az időszakban.
            </div>
          ) : (
            filteredTxByMonth.map(group => (
              <div
                key={`${group.year}-${group.monthIdx}`}
                style={{ marginBottom: '0.75rem' }}
              >
                <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                  {group.year}. {String(group.monthIdx + 1).padStart(2, '0')}.
                </div>
                <ul className="list">
                  {group.transactions.map(tx => {
                    const isEditing = editingId === tx.id;

                    if (isEditing) {
                      // SZERKESZTŐ NÉZET
                      return (
                        <li className="list-item" key={tx.id}>
                          <div style={{ flex: 1, marginRight: '0.5rem' }}>
                            <div className="small text-muted">Dátum</div>
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
                              style={{ marginBottom: '0.25rem' }}
                            />

                            <div className="small text-muted">Típus</div>
                            <select
                              className="input"
                              value={editForm.type}
                              onChange={e =>
                                setEditForm({
                                  ...editForm,
                                  type: e.target.value
                                })
                              }
                              style={{ marginBottom: '0.25rem' }}
                            >
                              <option value="income">Bevétel</option>
                              <option value="expense">Kiadás</option>
                              <option value="saving_deposit">
                                Megtakarítás
                              </option>
                            </select>

                            <div className="small text-muted">Kategória</div>
                            <input
                              className="input"
                              value={editForm.category}
                              onChange={e =>
                                setEditForm({
                                  ...editForm,
                                  category: e.target.value
                                })
                              }
                              style={{ marginBottom: '0.25rem' }}
                            />

                            <div className="small text-muted">Leírás</div>
                            <input
                              className="input"
                              value={editForm.description}
                              onChange={e =>
                                setEditForm({
                                  ...editForm,
                                  description: e.target.value
                                })
                              }
                              style={{ marginBottom: '0.25rem' }}
                            />
                          </div>

                          <div
                            style={{
                              minWidth: '180px',
                              textAlign: 'right',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.25rem'
                            }}
                          >
                            <div className="small text-muted">Összeg</div>
                            <input
                              className="input"
                              type="number"
                              step="0.01"
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
                                justifyContent: 'flex-end',
                                gap: '0.25rem',
                                marginTop: '0.5rem'
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
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ marginTop: '0.25rem' }}
                              onClick={() => deleteTx(tx.id)}
                            >
                              Törlés
                            </button>
                          </div>
                        </li>
                      );
                    }

                    // NORMÁL NÉZET
                    return (
                      <li className="list-item" key={tx.id}>
                        <div>
                          <div className="small text-muted">
                            {normalizeDate(tx.date).toLocaleDateString(
                              'hu-HU'
                            )}
                          </div>
                          <div style={{ fontSize: '0.9rem' }}>
                            {tx.description || '(nincs leírás)'}
                          </div>
                          <div className="small text-muted">
                            {tx.type === 'income'
                              ? 'Bevétel'
                              : tx.type === 'saving_deposit'
                              ? 'Megtakarítás'
                              : 'Kiadás'}{' '}
                            · {tx.category || 'Egyéb'}
                          </div>
                        </div>
                        <div
                          style={{
                            textAlign: 'right',
                            minWidth: '160px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem',
                            alignItems: 'flex-end'
                          }}
                        >
                          <div
                            className={
                              tx.type === 'income'
                                ? 'amount-positive'
                                : 'amount-negative'
                            }
                          >
                            {tx.type === 'income' ? '+ ' : '- '}
                            {formatFt(Number(tx.amount) || 0).replace(
                              '-',
                              ''
                            )}
                          </div>
                          <div>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ marginRight: '0.25rem' }}
                              onClick={() => startEdit(tx)}
                            >
                              Szerk.
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => deleteTx(tx.id)}
                            >
                              Törlés
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
