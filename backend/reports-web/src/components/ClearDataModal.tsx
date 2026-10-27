import React, { useState } from 'react';
import { AlertTriangle, Calendar, Eye, EyeOff, Layers, Loader2, Trash2, X } from 'lucide-react';
import { adminApi } from '../api';

interface ClearDataModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ClearScope = 'month' | 'year' | 'all';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export default function ClearDataModal({ isOpen, onClose }: ClearDataModalProps) {
  const currentDate = new Date();
  const [scope, setScope] = useState<ClearScope>('month');
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentYearNum = currentDate.getFullYear();
  const availableYears = Array.from({ length: 6 }, (_, i) => currentYearNum - 3 + i);

  const selectedMonthName = MONTHS.find((m) => m.value === selectedMonth)?.label || 'Month';

  const handleClose = () => {
    if (loading) return;
    setPassword('');
    setError(null);
    setSuccessMsg(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter the password to confirm.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await adminApi.clearOperationalData({
        password,
        scope,
        year: selectedYear,
        month: selectedMonth,
      });

      if (res.success) {
        setSuccessMsg(res.message || 'Data cleared successfully!');
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setError(res.message || 'Incorrect password.');
      }
    } catch (err: any) {
      setError(err.message || 'Incorrect password or operation failed.');
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = () => {
    if (scope === 'month') return `Clear ${selectedMonthName} ${selectedYear} Data`;
    if (scope === 'year') return `Clear Year ${selectedYear} Data`;
    return 'Clear All Operational Data';
  };

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal-card clear-data-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'rgba(226, 55, 68, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#c9182b',
              }}
            >
              <Trash2 size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, color: '#111827' }}>Clear Operational Data</h3>
              <p className="sub" style={{ margin: 0 }}>Reset reports & accounts records</p>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={handleClose}
            disabled={loading}
            style={{ padding: 6, minHeight: 'auto', border: 'none', background: 'transparent' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scope Selector: Month, Year, All */}
        <div style={{ marginBottom: 14 }}>
          <label className="field-label" style={{ marginTop: 0 }}>
            Choose Timeframe to Clear
          </label>
          <div className="chip-row" style={{ gap: 8, marginTop: 4 }}>
            <button
              type="button"
              className={`chip ${scope === 'month' ? 'active' : ''}`}
              onClick={() => setScope('month')}
              disabled={loading}
              style={{ cursor: 'pointer', fontWeight: 700 }}
            >
              <Calendar size={14} style={{ marginRight: 6 }} />
              By Month
            </button>
            <button
              type="button"
              className={`chip ${scope === 'year' ? 'active' : ''}`}
              onClick={() => setScope('year')}
              disabled={loading}
              style={{ cursor: 'pointer', fontWeight: 700 }}
            >
              <Calendar size={14} style={{ marginRight: 6 }} />
              By Year
            </button>
            <button
              type="button"
              className={`chip ${scope === 'all' ? 'active' : ''}`}
              onClick={() => setScope('all')}
              disabled={loading}
              style={{ cursor: 'pointer', fontWeight: 700 }}
            >
              <Layers size={14} style={{ marginRight: 6 }} />
              Overall (All Time)
            </button>
          </div>
        </div>

        {/* Month & Year Pickers */}
        {scope === 'month' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label className="field-label" style={{ marginTop: 0 }}>
                Month
              </label>
              <select
                className="select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                disabled={loading}
                style={{ width: '100%' }}
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" style={{ marginTop: 0 }}>
                Year
              </label>
              <select
                className="select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                disabled={loading}
                style={{ width: '100%' }}
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {scope === 'year' && (
          <div style={{ marginBottom: 14 }}>
            <label className="field-label" style={{ marginTop: 0 }}>
              Select Year
            </label>
            <select
              className="select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              disabled={loading}
              style={{ width: '100%' }}
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Warning / Impact Box */}
        <div
          style={{
            background: 'rgba(226, 55, 68, 0.06)',
            border: '1px solid rgba(226, 55, 68, 0.25)',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 16,
            fontSize: 13,
            lineHeight: 1.5,
            color: '#7f1d1d',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4 }}>
            <AlertTriangle size={16} />
            <span>
              {scope === 'month'
                ? `Clear Data for ${selectedMonthName} ${selectedYear}`
                : scope === 'year'
                ? `Clear Data for Year ${selectedYear}`
                : 'Permanent Overall Operational Reset'}
            </span>
          </div>

          <div>
            {scope === 'month' ? (
              <>
                Clears all <strong>accounts overview, cash input/output, daily sheets, expenses, site bills, and driver logs</strong> for{' '}
                <strong>
                  {selectedMonthName} {selectedYear}
                </strong>
                .
              </>
            ) : scope === 'year' ? (
              <>
                Clears all <strong>accounts overview, cash input/output, daily sheets, expenses, site bills, and driver logs</strong> for the entire year{' '}
                <strong>{selectedYear}</strong>.
              </>
            ) : (
              <>
                Wipes all <strong>historical transactions, daily sheets, ledger bills, attendance, driver logs, site photos, leads, and sites</strong> across all time.
              </>
            )}
          </div>

          <div style={{ marginTop: 6, color: '#15803d', fontWeight: 600 }}>
            {scope === 'all'
              ? '✓ Staff login credentials & passwords will NOT be touched.'
              : '✓ Sites, staff accounts, workers, and other months remain completely safe & untouched.'}
          </div>
        </div>

        {error && (
          <div
            style={{
              background: '#fee2e2',
              color: '#991b1b',
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 14,
              border: '1px solid #f87171',
            }}
          >
            {error}
          </div>
        )}

        {successMsg ? (
          <div
            style={{
              background: '#dcfce7',
              color: '#166534',
              padding: '16px',
              borderRadius: 8,
              fontSize: 14,
              textAlign: 'center',
              fontWeight: 700,
            }}
          >
            ✓ {successMsg}
            <div style={{ fontSize: 12, fontWeight: 400, marginTop: 4 }}>Reloading dashboard...</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="clear-data-password-input">
              Enter Admin Password to Confirm
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                id="clear-data-password-input"
                type={showPassword ? 'text' : 'password'}
                className="input"
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoFocus
                style={{
                  width: '100%',
                  paddingRight: 42,
                  boxSizing: 'border-box',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontSize: 14,
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 10,
                  background: 'none',
                  border: 'none',
                  padding: 4,
                  cursor: 'pointer',
                  color: 'var(--text-light)',
                  display: 'flex',
                  alignItems: 'center',
                }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button
                type="button"
                className="btn secondary"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn danger"
                disabled={loading || !password}
                style={{
                  background: '#c9182b',
                  color: '#fff',
                  border: '1px solid #c9182b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="spin-animation" />
                    <span>Clearing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>{getActionLabel()}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
