import React, { useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Loader2, Lock, Trash2, X } from 'lucide-react';
import { adminApi } from '../api';

interface ClearDataModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ClearDataModal({ isOpen, onClose }: ClearDataModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    if (loading) return;
    setPassword('');
    setError(null);
    setSuccess(false);
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
      const res = await adminApi.clearOperationalData(password);
      if (res.success) {
        setSuccess(true);
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

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal-card clear-data-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
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
              <p className="sub" style={{ margin: 0 }}>Reset database records</p>
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

        <div
          style={{
            background: 'rgba(226, 55, 68, 0.06)',
            border: '1px solid rgba(226, 55, 68, 0.25)',
            borderRadius: 10,
            padding: '12px 14px',
            margin: '12px 0 16px',
            fontSize: 13,
            lineHeight: 1.5,
            color: '#7f1d1d',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4 }}>
            <AlertTriangle size={16} />
            <span>Permanent Operational Reset</span>
          </div>
          <div>
            This action wipes all <strong>transactions, daily sheets, ledger bills, attendance, driver logs, site photos, leads, and sites</strong>.
          </div>
          <div style={{ marginTop: 6, color: '#15803d', fontWeight: 600 }}>
            ✓ Staff login credentials & passwords will NOT be touched.
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

        {success ? (
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
            ✓ Operational data cleared successfully!
            <div style={{ fontSize: 12, fontWeight: 400, marginTop: 4 }}>Reloading dashboard...</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="clear-data-password-input">
              Enter Password to Confirm
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                id="clear-data-password-input"
                type={showPassword ? 'text' : 'password'}
                className="input"
                placeholder="Enter password"
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
                    <span>Clear All Data</span>
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
