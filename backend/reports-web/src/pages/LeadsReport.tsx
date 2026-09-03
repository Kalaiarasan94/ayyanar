import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import DataTable from '../components/DataTable';
import SummaryCard from '../components/SummaryCard';
import { csvCell, exportCsv } from '../services/printReport';

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('en-IN');

export default function LeadsReport() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .getLeads()
      .then(setLeads)
      .finally(() => setLoading(false));
  }, []);

  const total = leads.length;
  const converted = leads.filter((l) => l.status === 'Converted').length;
  const bySource = new Map<string, { total: number; converted: number }>();
  leads.forEach((l) => {
    const key = l.source || 'Unknown';
    const e = bySource.get(key) || { total: 0, converted: 0 };
    e.total += 1;
    if (l.status === 'Converted') e.converted += 1;
    bySource.set(key, e);
  });
  const sourceRows = Array.from(bySource.entries()).map(([source, v]) => ({ source, ...v }));

  const handleExport = () => {
    const header = ['Name', 'Phone', 'Project Needed', 'Source', 'Status', 'Created'];
    const lines = leads.map((l) => [l.name, l.phone, l.project_needed || '', l.source || '', l.status, l.created_at].map(csvCell).join(','));
    exportCsv('leads.csv', [header.join(','), ...lines].join('\n'));
  };

  return (
    <div>
      <h1 className="page-title">Leads Report</h1>
      <p className="page-subtitle">Pipeline by status and channel, with conversion rate.</p>

      {loading ? (
        <div className="empty-note">Loading…</div>
      ) : (
        <>
          <div className="summary-row">
            <SummaryCard label="Total Leads" value={total.toString()} />
            <SummaryCard label="Converted" value={converted.toString()} color="#15803d" />
            <SummaryCard label="Conversion Rate" value={total > 0 ? `${Math.round((converted / total) * 100)}%` : '0%'} />
          </div>

          <div className="toolbar">
            <button className="btn secondary" onClick={handleExport} disabled={leads.length === 0}>
              Download CSV
            </button>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>By Channel</h3>
            <DataTable<any>
              rowKey={(r) => r.source}
              rows={sourceRows}
              emptyText="No leads yet."
              columns={[
                { header: 'Source', render: (r) => r.source },
                { header: 'Total', align: 'right', render: (r) => r.total },
                { header: 'Converted', align: 'right', render: (r) => r.converted },
                { header: 'Conversion %', align: 'right', render: (r) => (r.total > 0 ? `${Math.round((r.converted / r.total) * 100)}%` : '0%') },
              ]}
            />
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>All Leads ({leads.length})</h3>
            <DataTable<any>
              rowKey={(l) => l.id}
              rows={leads}
              emptyText="No leads yet."
              columns={[
                { header: 'Name', render: (l: any) => l.name },
                { header: 'Phone', render: (l: any) => l.phone },
                { header: 'Project', render: (l: any) => l.project_needed || '—' },
                { header: 'Source', render: (l: any) => l.source || '—' },
                { header: 'Status', render: (l: any) => l.status },
                { header: 'Created', render: (l: any) => dateLabel(l.created_at) },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}
