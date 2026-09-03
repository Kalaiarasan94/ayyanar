import { useEffect, useState } from 'react';
import { accountsApi } from '../api';
import DataTable from '../components/DataTable';
import DateRangePicker from '../components/DateRangePicker';
import { csvCell, exportCsv } from '../services/printReport';

const rupees = (v: any) => `Rs ${Number(v || 0).toLocaleString('en-IN')}`;
const todayIso = () => new Date().toISOString().split('T')[0];

export default function DayBook() {
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = (f = from, t = to) => {
    setLoading(true);
    accountsApi
      .getDayBook(f || undefined, t || undefined)
      .then(setRows)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalIn = rows.filter((r) => r.flow === 'IN').reduce((s, r) => s + Number(r.amount), 0);
  const totalOut = rows.filter((r) => r.flow === 'OUT').reduce((s, r) => s + Number(r.amount), 0);

  const handleExport = () => {
    const header = ['Date', 'Role', 'Flow', 'Category', 'Party', 'Payment Method', 'Description', 'Amount'];
    const lines = rows.map((r) =>
      [r.date, r.role, r.flow, r.category, r.party_name || '', r.payment_method || 'Cash', r.description || '', r.amount]
        .map(csvCell)
        .join(',')
    );
    exportCsv(`daybook-${from}-to-${to}.csv`, [header.join(','), ...lines].join('\n'));
  };

  return (
    <div>
      <h1 className="page-title">Day Book</h1>
      <p className="page-subtitle">Every real transaction across all role books for a date range.</p>

      <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => load(from, to)} />

      <div className="summary-row">
        <div className="summary-tile">
          <div className="summary-tile-label">Total Received</div>
          <div className="summary-tile-value" style={{ color: '#15803d' }}>{rupees(totalIn)}</div>
        </div>
        <div className="summary-tile">
          <div className="summary-tile-label">Total Paid</div>
          <div className="summary-tile-value" style={{ color: '#e23744' }}>{rupees(totalOut)}</div>
        </div>
      </div>

      <div className="toolbar">
        <button className="btn secondary" onClick={handleExport} disabled={rows.length === 0}>
          Download CSV
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-note">Loading…</div>
        ) : (
          <DataTable<any>
            rowKey={(r) => r.id}
            rows={rows}
            emptyText="No transactions in this range."
            columns={[
              { header: 'Date', render: (r) => new Date(r.date).toLocaleDateString('en-IN') },
              { header: 'Role', render: (r) => r.role },
              { header: 'Flow', render: (r) => (r.flow === 'IN' ? <span className="text-success">IN</span> : <span className="text-primary">OUT</span>) },
              { header: 'Category', render: (r) => r.category },
              { header: 'Party', render: (r) => r.party_name || '—' },
              { header: 'Method', render: (r) => r.payment_method || 'Cash' },
              { header: 'Note', render: (r) => r.description || '—' },
              { header: 'Amount', align: 'right', render: (r) => rupees(r.amount) },
            ]}
          />
        )}
      </div>
    </div>
  );
}
