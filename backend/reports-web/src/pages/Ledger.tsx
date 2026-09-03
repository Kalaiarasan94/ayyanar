import { useEffect, useState } from 'react';
import { accountsApi } from '../api';
import DataTable from '../components/DataTable';
import DateRangePicker from '../components/DateRangePicker';
import { csvCell, exportCsv } from '../services/printReport';

const rupees = (v: any) => `Rs ${Number(v || 0).toLocaleString('en-IN')}`;

export default function Ledger() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = (f = from, t = to) => {
    setLoading(true);
    accountsApi
      .getLedger(f || undefined, t || undefined)
      .then(setRows)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = () => {
    const header = ['Party', 'Category', 'Received', 'Paid', 'Net', 'Entries', 'Last Date'];
    const lines = rows.map((r) => [r.party || '', r.category, r.receivedFrom, r.paidTo, r.net, r.entries, r.lastDate].map(csvCell).join(','));
    exportCsv('ledger.csv', [header.join(','), ...lines].join('\n'));
  };

  return (
    <div>
      <h1 className="page-title">Ledger</h1>
      <p className="page-subtitle">Net position per party/category, across all roles.</p>

      <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} onApply={() => load(from, to)} onClear={() => { setFrom(''); setTo(''); load('', ''); }} />

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
            rowKey={(r, i) => `${r.category}-${r.party}-${i}`}
            rows={rows}
            emptyText="No ledger entries yet."
            columns={[
              { header: 'Party', render: (r) => r.party || '—' },
              { header: 'Category', render: (r) => r.category },
              { header: 'Received', align: 'right', render: (r) => <span className="text-success">{rupees(r.receivedFrom)}</span> },
              { header: 'Paid', align: 'right', render: (r) => <span className="text-primary">{rupees(r.paidTo)}</span> },
              { header: 'Net', align: 'right', render: (r) => <b>{rupees(r.net)}</b> },
              { header: 'Entries', align: 'right', render: (r) => r.entries },
              { header: 'Last Activity', render: (r) => new Date(r.lastDate).toLocaleDateString('en-IN') },
            ]}
          />
        )}
      </div>
    </div>
  );
}
