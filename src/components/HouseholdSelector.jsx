import React, { useEffect, useState } from 'react';

export default function HouseholdSelector({
  householdId,
  setHouseholdId
}) {
  const [localId, setLocalId] = useState(householdId || '');

  useEffect(() => {
    const stored = localStorage.getItem('householdId');
    if (stored && !householdId) {
      setHouseholdId(stored);
      setLocalId(stored);
    }
  }, [householdId, setHouseholdId]);

  const handleApply = () => {
    const trimmed = localId.trim();
    if (!trimmed) return;
    setHouseholdId(trimmed);
    localStorage.setItem('householdId', trimmed);
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Közös háztartás</div>
          <div className="card-subtitle">
            Írjatok be egy tetszőleges azonosítót (pl.{' '}
            <code>lakás-2025</code>), és használjátok mindannyian
            ugyanazt.
          </div>
        </div>
        {householdId && (
          <span className="chip">Aktív: {householdId}</span>
        )}
      </div>
      <div
        style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}
      >
        <input
          className="input"
          placeholder="Háztartás azonosító"
          value={localId}
          onChange={e => setLocalId(e.target.value)}
        />
        <button className="btn btn-primary" onClick={handleApply}>
          Mentés
        </button>
      </div>
    </div>
  );
}
