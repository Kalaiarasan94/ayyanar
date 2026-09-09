import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, Share2 } from 'lucide-react';
import { accountsApi } from '../api';
import DataTable from '../components/DataTable';
import DateRangePicker from '../components/DateRangePicker';
import { buildPdfReport, downloadPdfReport, sharePdfReportOnWhatsApp } from '../services/pdfReport';
import { csvCell, exportCsv } from '../services/printReport';

const rupees = (v: any) => `Rs ${Number(v || 0).toLocaleString('en-IN')}`;
const dateLabel = (iso: string) => (iso ? new Date(iso).toLocaleDateString('en-IN') : '—');

export default function Ledger() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

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

  const totalReceived = rows.reduce((s, r) => s + Number(r.receivedFrom || 0), 0);
  const totalPaid = rows.reduce((s, r) => s + Number(r.paidTo || 0), 0);

  const handleDownloadPdf = async () => {
    if (rows.length === 0) return;
    setDownloading(true);
    try {
      const { doc, filename } = await buildPdfReport({
        filename: `ledger-${from || 'all'}-to-${to || 'all'}.pdf`,
        title: 'Party Ledger Statement',
        subtitle: from && to ? `From ${dateLabel(from)} to ${dateLabel(to)}` : 'All Activity',
        summaryBoxes: [
          { label: 'Total Received', value: rupees(totalReceived), color: '#15803d' },
          { label: 'Total Paid', value: rupees(totalPaid), color: '#e23744' },
          { label: 'Net Balance', value: rupees(totalReceived - totalPaid) },
        ],
        tables: [
          {
            title: `Ledger Entries (${rows.length})`,
            head: ['#', 'Party', 'Category', 'Received (Rs)', 'Paid (Rs)', 'Net Position (Rs)', 'Entries', 'Last Activity'],
            body: rows.map((r, i) => [
              i + 1,
              r.party || '-',
              r.category,
              Number(r.receivedFrom || 0).toLocaleString('en-IN'),
              Number(r.paidTo || 0).toLocaleString('en-IN'),
              Number(r.net || 0).toLocaleString('en-IN'),
              r.entries,
              dateLabel(r.lastDate),
            ]),
            foot: ['', '', 'TOTAL', totalReceived.toLocaleString('en-IN'), totalPaid.toLocaleString('en-IN'), (totalReceived - totalPaid).toLocaleString('en-IN'), '', ''],
          },
        ],
      });
      await downloadPdfReport({ doc, filename });
    } finally {
      setDownloading(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (rows.length === 0) return;
    setDownloading(true);
    try {
      const pdf = await buildPdfReport({
        filename: `ledger-${from || 'all'}-to-${to || 'all'}.pdf`,
        title: 'Party Ledger Statement',
        subtitle: from && to ? `From ${dateLabel(from)} to ${dateLabel(to)}` : 'All Activity',
        summaryBoxes: [
          { label: 'Total Received', value: rupees(totalReceived), color: '#15803d' },
          { label: 'Total Paid', value: rupees(totalPaid), color: '#e23744' },
          { label: 'Net Balance', value: rupees(totalReceived - totalPaid) },
        ],
        tables: [
          {
            title: `Ledger Entries (${rows.length})`,
            head: ['#', 'Party', 'Category', 'Received (Rs)', 'Paid (Rs)', 'Net Position (Rs)', 'Entries', 'Last Activity'],
            body: rows.map((r, i) => [
              i + 1,
              r.party || '-',
              r.category,
              Number(r.receivedFrom || 0).toLocaleString('en-IN'),
              Number(r.paidTo || 0).toLocaleString('en-IN'),
              Number(r.net || 0).toLocaleString('en-IN'),
              r.entries,
              dateLabel(r.lastDate),
            ]),
          },
        ],
      });
      const text = `Ledger Statement\nTotal Received: ${rupees(totalReceived)}\nTotal Paid: ${rupees(totalPaid)}\nNet: ${rupees(totalReceived - totalPaid)}`;
      await sharePdfReportOnWhatsApp(pdf, text);
    } finally {
      setDownloading(false);
    }
  };

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

      <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={handleDownloadPdf} disabled={downloading || rows.length === 0}>
          <Download size={16} />
          {downloading ? 'Building PDF…' : 'Download PDF'}
        </button>
        <button className="btn whatsapp" onClick={handleShareWhatsApp} disabled={downloading || rows.length === 0}>
          <Share2 size={16} />
          Share on WhatsApp
        </button>
        <button className="btn secondary" onClick={handleExport} disabled={rows.length === 0}>
          <FileSpreadsheet size={16} />
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
