import { useEffect, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Download, FileSpreadsheet, Share2 } from 'lucide-react';
import { accountsApi } from '../api';
import DataTable from '../components/DataTable';
import DateRangePicker from '../components/DateRangePicker';
import PrintButton from '../components/PrintButton';
import SummaryCard from '../components/SummaryCard';
import { buildPdfReport, downloadPdfReport, sharePdfReportOnWhatsApp } from '../services/pdfReport';
import { csvCell, exportCsv } from '../services/printReport';

const rupees = (v: any) => `Rs ${Number(v || 0).toLocaleString('en-IN')}`;
const dateLabel = (iso: string) => (iso ? new Date(iso).toLocaleDateString('en-IN') : '—');
const todayIso = () => new Date().toISOString().split('T')[0];

export default function DayBook() {
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

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

  const handleDownloadPdf = async () => {
    if (rows.length === 0) return;
    setDownloading(true);
    try {
      const { doc, filename } = await buildPdfReport({
        filename: `daybook-${from}-to-${to}.pdf`,
        title: 'Day Book Statement',
        subtitle: `Transactions from ${dateLabel(from)} to ${dateLabel(to)}`,
        orientation: 'landscape',
        summaryBoxes: [
          { label: 'Total Received', value: rupees(totalIn), color: '#15803d' },
          { label: 'Total Paid', value: rupees(totalOut), color: '#e23744' },
          { label: 'Net Position', value: rupees(totalIn - totalOut) },
        ],
        tables: [
          {
            title: `Transactions (${rows.length})`,
            head: ['#', 'Date', 'Role', 'Flow', 'Category', 'Party', 'Payment Method', 'Description', 'Amount (Rs)'],
            body: rows.map((r, i) => [
              i + 1,
              dateLabel(r.date),
              r.role,
              r.flow,
              r.category,
              r.party_name || '-',
              r.payment_method || 'Cash',
              r.description || '-',
              Number(r.amount).toLocaleString('en-IN'),
            ]),
            foot: ['', '', '', '', '', '', '', 'TOTAL', (totalIn - totalOut).toLocaleString('en-IN')],
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
        filename: `daybook-${from}-to-${to}.pdf`,
        title: 'Day Book Statement',
        subtitle: `Transactions from ${dateLabel(from)} to ${dateLabel(to)}`,
        orientation: 'landscape',
        summaryBoxes: [
          { label: 'Total Received', value: rupees(totalIn), color: '#15803d' },
          { label: 'Total Paid', value: rupees(totalOut), color: '#e23744' },
          { label: 'Net Position', value: rupees(totalIn - totalOut) },
        ],
        tables: [
          {
            title: `Transactions (${rows.length})`,
            head: ['#', 'Date', 'Role', 'Flow', 'Category', 'Party', 'Payment Method', 'Description', 'Amount (Rs)'],
            body: rows.map((r, i) => [
              i + 1,
              dateLabel(r.date),
              r.role,
              r.flow,
              r.category,
              r.party_name || '-',
              r.payment_method || 'Cash',
              r.description || '-',
              Number(r.amount).toLocaleString('en-IN'),
            ]),
          },
        ],
      });
      const text = `Day Book Statement (${dateLabel(from)} to ${dateLabel(to)})\nReceived: ${rupees(totalIn)}\nPaid: ${rupees(totalOut)}\nNet Position: ${rupees(totalIn - totalOut)}`;
      await sharePdfReportOnWhatsApp(pdf, text);
    } finally {
      setDownloading(false);
    }
  };

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
        <SummaryCard label="Total Received" value={rupees(totalIn)} color="#15803d" icon={ArrowDownCircle} />
        <SummaryCard label="Total Paid" value={rupees(totalOut)} color="#e23744" icon={ArrowUpCircle} />
      </div>

      <div className="toolbar no-print" style={{ justifyContent: 'flex-end' }}>
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
        <PrintButton />
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
