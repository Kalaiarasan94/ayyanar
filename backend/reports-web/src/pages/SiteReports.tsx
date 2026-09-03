import { useEffect, useState } from 'react';
import { adminApi, fieldApi } from '../api';
import DataTable from '../components/DataTable';
import SummaryCard from '../components/SummaryCard';
import { buildPdfReport, downloadPdfReport } from '../services/pdfReport';

const rupees = (v: any) => `Rs ${Number(v || 0).toLocaleString('en-IN')}`;
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('en-IN');

export default function SiteReports() {
  const [sites, setSites] = useState<any[]>([]);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    adminApi.getSites().then((s) => {
      setSites(s);
      if (s.length > 0) setSiteId(s[0].id.toString());
    });
  }, []);

  useEffect(() => {
    if (!siteId) return;
    setLoading(true);
    fieldApi
      .getLedgerBySite(siteId)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [siteId]);

  const site = sites.find((s) => s.id.toString() === siteId);
  const direct = rows.filter((r) => r.payment_mode === 'Direct');
  const indirect = rows.filter((r) => r.payment_mode !== 'Direct');
  const directTotal = direct.reduce((s, r) => s + Number(r.amount), 0);
  const indirectTotal = indirect.reduce((s, r) => s + Number(r.amount), 0);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { doc, filename } = await buildPdfReport({
        filename: `site-expenses-${site?.name || siteId}.pdf`,
        title: 'Site Expenses Report',
        subtitle: site?.name || 'Site',
        summaryBoxes: [
          { label: 'Direct', value: rupees(directTotal), color: '#e23744' },
          { label: 'Indirect', value: rupees(indirectTotal) },
          { label: 'Grand Total', value: rupees(directTotal + indirectTotal), color: '#15803d' },
        ],
        tables: [
          {
            title: `Direct Bills (${direct.length})`,
            head: ['#', 'Date', 'Supervisor', 'Category', 'Description', 'Amount (Rs)'],
            body: direct.map((r, i) => [i + 1, dateLabel(r.date), r.supervisor_name || '-', r.category || '-', r.description || '-', Number(r.amount).toLocaleString('en-IN')]),
            foot: ['', '', '', '', 'TOTAL', directTotal.toLocaleString('en-IN')],
          },
          {
            title: `Indirect / Credit Bills (${indirect.length})`,
            head: ['#', 'Date', 'Supervisor', 'Category', 'Description', 'Amount (Rs)'],
            body: indirect.map((r, i) => [i + 1, dateLabel(r.date), r.supervisor_name || '-', r.category || '-', r.description || '-', Number(r.amount).toLocaleString('en-IN')]),
            foot: ['', '', '', '', 'TOTAL', indirectTotal.toLocaleString('en-IN')],
          },
        ],
      });
      await downloadPdfReport({ doc, filename });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Site Expense Reports</h1>
      <p className="page-subtitle">Direct vs indirect spending, per project site.</p>

      <div className="chip-row" style={{ marginBottom: 18 }}>
        {sites.map((s) => (
          <button key={s.id} className={`chip${siteId === s.id.toString() ? ' active' : ''}`} onClick={() => setSiteId(s.id.toString())}>
            {s.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-note">Loading…</div>
      ) : (
        <>
          <div className="summary-row">
            <SummaryCard label="Direct" value={rupees(directTotal)} color="#e23744" />
            <SummaryCard label="Indirect" value={rupees(indirectTotal)} />
            <SummaryCard label="Grand Total" value={rupees(directTotal + indirectTotal)} color="#15803d" />
          </div>

          <div className="toolbar">
            <button className="btn" onClick={handleDownload} disabled={downloading || rows.length === 0}>
              {downloading ? 'Building PDF…' : 'Download PDF'}
            </button>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Direct Bills ({direct.length})</h3>
            <DataTable<any>
              rowKey={(r) => r.id}
              rows={direct}
              emptyText="No direct bills."
              columns={[
                { header: 'Date', render: (r: any) => dateLabel(r.date) },
                { header: 'Supervisor', render: (r: any) => r.supervisor_name || '—' },
                { header: 'Category', render: (r: any) => r.category || '—' },
                { header: 'Description', render: (r: any) => r.description || '—' },
                { header: 'Amount', align: 'right', render: (r: any) => rupees(r.amount) },
              ]}
            />
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Indirect / Credit Bills ({indirect.length})</h3>
            <DataTable<any>
              rowKey={(r) => r.id}
              rows={indirect}
              emptyText="No indirect bills."
              columns={[
                { header: 'Date', render: (r: any) => dateLabel(r.date) },
                { header: 'Supervisor', render: (r: any) => r.supervisor_name || '—' },
                { header: 'Category', render: (r: any) => r.category || '—' },
                { header: 'Description', render: (r: any) => r.description || '—' },
                { header: 'Amount', align: 'right', render: (r: any) => rupees(r.amount) },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}
