import React, { useMemo } from 'react';

/**
 * Összegzés kiszámítása:
 * - aktuális hónap (calendar month)
 * - all time
 * A "saving_deposit" típusú tranzakciót kiadásként kezeljük.
 */
function buildSummary(transactions) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0–11

  let monthIncome = 0;
  let monthExpense = 0;
  let allIncome = 0;
  let allExpense = 0;

  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0;
    const type = tx.type;

    const d = tx.date instanceof Date ? tx.date : new Date(tx.date);
    const isCurrentMonth =
      d.getFullYear() === currentYear && d.getMonth() === currentMonth;

    const isIncome = type === 'income';
    const isOut = type === 'expense' || type === 'saving_deposit';

    if (isIncome) {
      allIncome += amount;
      if (isCurrentMonth) monthIncome += amount;
    }
    if (isOut) {
      allExpense += amount;
      if (isCurrentMonth) monthExpense += amount;
    }
  }

  return {
    month: {
      income: monthIncome,
      expense: monthExpense,
      net: monthIncome - monthExpense
    },
    allTime: {
      income: allIncome,
      expense: allExpense,
      net: allIncome - allExpense
    }
  };
}

/**
 * All-time trend: kumulált nettó egyenleg időben.
 */
function buildTrend(transactions) {
  if (!transactions.length) return [];

  const sorted = [...transactions].sort((a, b) => {
    const da = a.date instanceof Date ? a.date : new Date(a.date);
    const db = b.date instanceof Date ? b.date : new Date(b.date);
    return da - db;
  });

  let balance = 0;
  const points = [];

  for (const tx of sorted) {
    const amount = Number(tx.amount) || 0;
    const type = tx.type;

    if (type === 'income') balance += amount;
    if (type === 'expense' || type === 'saving_deposit') balance -= amount;

    const d = tx.date instanceof Date ? tx.date : new Date(tx.date);
    points.push({ date: d, value: balance });
  }

  return points;
}

/**
 * Egyszerű vonaldiagram SVG-vel.
 */
function TrendChart({ data }) {
  if (!data.length) {
    return (
      <div className="small text-muted">
        A grafikonhoz először rögzíts néhány tranzakciót.
      </div>
    );
  }

  const width = 320;
  const height = 90;
  const padding = 10;

  const values = data.map(p => p.value);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const range = maxVal - minVal || 1;

  const points = data
    .map((p, index) => {
      const x =
        padding +
        (data.length === 1
          ? (width - 2 * padding) / 2
          : (index / (data.length - 1)) * (width - 2 * padding));
      const norm = (p.value - minVal) / range;
      const y =
        height - padding - norm * (height - 2 * padding); // fentről lefelé
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: '100%', height: '90px' }}
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        points={points}
      />
    </svg>
  );
}

export default function Dashboard({ transactions }) {
  const { month, allTime } = useMemo(
    () => buildSummary(transactions),
    [transactions]
  );

  const trendData = useMemo(
    () => buildTrend(transactions),
    [transactions]
  );

  const formatFt = value =>
    value.toLocaleString('hu-HU', { maximumFractionDigits: 0 }) + ' Ft';

  const netClassMonth = month.net >= 0 ? 'amount-positive' : 'amount-negative';
  const netClassAll = allTime.net >= 0 ? 'amount-positive' : 'amount-negative';

  return (
    <>
      {/* Két azonos méretű összegző kártya */}
      <div
        className="grid-2"
        style={{ alignItems: 'stretch', marginBottom: '1rem' }}
      >
        {/* Aktuális hónap */}
        <div className="card" style={{ height: '100%' }}>
          <div className="card-header">
            <div className="card-title">Aktuális hónap</div>
          </div>
          <div className="card-body">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}
            >
              <div>
                <div className="small text-muted">Összes bevétel</div>
                <div className="amount-positive">
                  + {formatFt(month.income).replace('-', '')}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="small text-muted">Összes kiadás</div>
                <div className="amount-negative">
                  - {formatFt(month.expense).replace('-', '')}
                </div>
              </div>
            </div>

            <div
              className={netClassMonth}
              style={{
                textAlign: 'center',
                padding: '0.4rem 0.8rem',
                borderRadius: '999px',
                border: '1px solid currentColor',
                display: 'inline-block',
                minWidth: '60%'
              }}
            >
              Egyenleg:{' '}
              {month.net >= 0
                ? '+ ' + formatFt(month.net)
                : formatFt(month.net)}
            </div>
          </div>
        </div>

        {/* All time */}
        <div className="card" style={{ height: '100%' }}>
          <div className="card-header">
            <div className="card-title">All time</div>
          </div>
          <div className="card-body">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}
            >
              <div>
                <div className="small text-muted">Bevételek összesen</div>
                <div className="amount-positive">
                  + {formatFt(allTime.income).replace('-', '')}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="small text-muted">Kiadások összesen</div>
                <div className="amount-negative">
                  - {formatFt(allTime.expense).replace('-', '')}
                </div>
              </div>
            </div>

            <div
              className={netClassAll}
              style={{
                textAlign: 'center',
                padding: '0.4rem 0.8rem',
                borderRadius: '999px',
                border: '1px solid currentColor',
                display: 'inline-block',
                minWidth: '60%'
              }}
            >
              Nettó:{' '}
              {allTime.net >= 0
                ? '+ ' + formatFt(allTime.net)
                : formatFt(allTime.net)}
            </div>
          </div>
        </div>
      </div>

      {/* All-time pénzügyi trend grafikon */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">All-time pénzügyi trend</div>
            <div className="card-subtitle">
              Kumulatív nettó egyenleg időben. A „Megtakarítás” típusú
              tranzakciók kiadásként számítanak.
            </div>
          </div>
        </div>
        <div className="card-body">
          <TrendChart data={trendData} />
        </div>
      </div>
    </>
  );
}
