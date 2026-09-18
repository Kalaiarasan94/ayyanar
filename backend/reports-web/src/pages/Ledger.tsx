import { useEffect, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Download, FileSpreadsheet, Share2, Wallet } from 'lucide-react';
import { accountsApi } from '../api';
import DataTable from '../components/DataTable';
import DateFilterBar, { DateFilterMode } from '../components/DateFilterBar';
import PrintButton from '../components/PrintButton';
import SummaryCard from '../components/SummaryCard';
import { buildPdfReport, downloadPdfReport, sharePdfReportOnWhatsApp } from '../services/pdfReport';
import { csvCell, exportCsv } from '../services/printReport';

const rupees = (v: any) => `Rs ${Number(v || 0).toLocaleString('en-IN')}`;
const dateLabel = (iso: string) => (iso ? new Date(iso).toLocaleDateString('en-IN') : '—');
const todayIso = () => new Date().toISOString().split('T')[0];

export default function Ledger() {
  const [mode, setMode] = useState<DateFilterMode>('all');
  const [date, setDate] = useState(todayIso());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const load = (m = mode, d = date, f = from, t = to) => {
    setLoading(true);
    const [qFrom, qTo] = m === 'single' ? [d, d] : m === 'range' ? [f, t] : [undefined, undefined];
    accountsApi
      .getLedger(qFrom, qTo)
      .then(setRows)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rangeLabel = mode === 'single' ? dateLabel(date) : mode === 'range' ? `${dateLabel(from)} to ${dateLabel(to)}` : 'All Time';

  const totalReceived = rows.reduce((s, r) => s + Number(r.receivedFrom || 0), 0);
  const totalPaid = rows.reduce((s, r) => s + Number(r.paidTo || 0), 0);

  // Inputs (received) listed first, outputs (paid) listed after — each sorted
  // by its own amount rather than sharing the combined-row order
  const receivedRows = rows
    .filter((r) => Number(r.receivedEntries || 0) > 0)
    .slice()
    .sort((a, b) => Number(b.receivedFrom) - Number(a.receivedFrom));
  const paidRows = rows
    .filter((r) => Number(r.paidEntries || 0) > 0)
    .slice()
    .sort((a, b) => Number(b.paidTo) - Number(a.paidTo));

  const handleDownloadPdf = async () => {
    if (rows.length === 0) return;
    setDownloading(true);
    try {
      const { doc, filename } = await buildPdfReport({
        filename: `ledger-${mode === 'single' ? date : mode === 'range' ? `${from}-to-${to}` : 'all'}.pdf`,
        title: 'Party Ledger Statement',
        subtitle: rangeLabel,
        summaryBoxes: [
          { label: 'Total Received', value: rupees(totalReceived), color: '#15803d' },
          { label: 'Total Paid', value: rupees(totalPaid), color: '#e23744' },
          { label: 'Net Balance', value: rupees(totalReceived - totalPaid) },
        ],
        tables: [
          {
            title: `Received From — Input (${receivedRows.length})`,
            head: ['#', 'Party', 'Category', 'Received (Rs)', 'Entries', 'Last Activity'],
            body: receivedRows.map((r, i) => [i + 1, r.party || '-', r.category, Number(r.receivedFrom || 0).toLocaleString('en-IN'), r.receivedEntries, dateLabel(r.receivedLastDate)]),
            columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } },
            foot: ['', '', 'TOTAL', totalReceived.toLocaleString('en-IN'), '', ''],
          },
          {
            title: `Paid To — Output (${paidRows.length})`,
            head: ['#', 'Party', 'Category', 'Paid (Rs)', 'Entries', 'Last Activity'],
            body: paidRows.map((r, i) => [i + 1, r.party || '-', r.category, Number(r.paidTo || 0).toLocaleString('en-IN'), r.paidEntries, dateLabel(r.paidLastDate)]),
            columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } },
            foot: ['', '', 'TOTAL', totalPaid.toLocaleString('en-IN'), '', ''],
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
        filename: `ledger-${mode === 'single' ? date : mode === 'range' ? `${from}-to-${to}` : 'all'}.pdf`,
        title: 'Party Ledger Statement',
        subtitle: rangeLabel,
        summaryBoxes: [
          { label: 'Total Received', value: rupees(totalReceived), color: '#15803d' },
          { label: 'Total Paid', value: rupees(totalPaid), color: '#e23744' },
          { label: 'Net Balance', value: rupees(totalReceived - totalPaid) },
        ],
        tables: [
          {
            title: `Received From — Input (${receivedRows.length})`,
            head: ['#', 'Party', 'Category', 'Received (Rs)', 'Entries', 'Last Activity'],
            body: receivedRows.map((r, i) => [i + 1, r.party || '-', r.category, Number(r.receivedFrom || 0).toLocaleString('en-IN'), r.receivedEntries, dateLabel(r.receivedLastDate)]),
            columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } },
          },
          {
            title: `Paid To — Output (${paidRows.length})`,
            head: ['#', 'Party', 'Category', 'Paid (Rs)', 'Entries', 'Last Activity'],
            body: paidRows.map((r, i) => [i + 1, r.party || '-', r.category, Number(r.paidTo || 0).toLocaleString('en-IN'), r.paidEntries, dateLabel(r.paidLastDate)]),
            columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } },
          },
        ],
      });
      const text = `Ledger Statement (${rangeLabel})\nTotal Received: ${rupees(totalReceived)}\nTotal Paid: ${rupees(totalPaid)}\nNet: ${rupees(totalReceived - totalPaid)}`;
      await sharePdfReportOnWhatsApp(pdf, text);
    } finally {
      setDownloading(false);
    }
  };

  const handleExport = () => {
    const lines: string[] = [];
    lines.push('RECEIVED FROM — INPUT');
    lines.push(['Party', 'Category', 'Received', 'Entries', 'Last Date'].join(','));
    receivedRows.forEach((r) => lines.push([r.party || '', r.category, r.receivedFrom, r.receivedEntries, r.receivedLastDate].map(csvCell).join(',')));
    lines.push('');
    lines.push('PAID TO — OUTPUT');
    lines.push(['Party', 'Category', 'Paid', 'Entries', 'Last Date'].join(','));
    paidRows.forEach((r) => lines.push([r.party || '', r.category, r.paidTo, r.paidEntries, r.paidLastDate].map(csvCell).join(',')));
    exportCsv('ledger.csv', lines.join('\n'));
  };

  return (
    <div>
      <h1 className="page-title">Ledger</h1>
      <p className="page-subtitle">Every party's inputs first, then every party's outputs — across all roles.</p>

      <DateFilterBar
        mode={mode}
        onModeChange={(m) => { setMode(m); load(m, date, from, to); }}
        date={date}
        onDateChange={(d) => { setDate(d); load('single', d, from, to); }}
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onApplyRange={(f = from, t = to) => { setFrom(f); setTo(t); load('range', date, f, t); }}
      />

      {!loading && (
        <div className="summary-row">
          <SummaryCard label="Total Received" value={rupees(totalReceived)} color="#15803d" icon={ArrowDownCircle} />
          <SummaryCard label="Total Paid" value={rupees(totalPaid)} color="#e23744" icon={ArrowUpCircle} />
          <SummaryCard label="Net Balance" value={rupees(totalReceived - totalPaid)} icon={Wallet} />
        </div>
      )}

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

      {loading ? (
        <div className="card">
          <div className="empty-note">Loading…</div>
        </div>
      ) : (
        <>
          <div className="card">
            <h3 className="section-heading">Received From — Input ({receivedRows.length})</h3>
            <DataTable<any>
              rowKey={(r, i) => `in-${r.category}-${r.party}-${i}`}
              rows={receivedRows}
              emptyText="No money received yet."
              columns={[
                { header: 'Party', render: (r) => r.party || '—' },
                { header: 'Category', render: (r) => r.category },
                { header: 'Received', align: 'right', render: (r) => <span className="text-success">{rupees(r.receivedFrom)}</span> },
                { header: 'Entries', align: 'right', render: (r) => r.receivedEntries },
                { header: 'Last Activity', render: (r) => dateLabel(r.receivedLastDate) },
              ]}
            />
          </div>

          <div className="card">
            <h3 className="section-heading">Paid To — Output ({paidRows.length})</h3>
            <DataTable<any>
              rowKey={(r, i) => `out-${r.category}-${r.party}-${i}`}
              rows={paidRows}
              emptyText="No payments made yet."
              columns={[
                { header: 'Party', render: (r) => r.party || '—' },
                { header: 'Category', render: (r) => r.category },
                { header: 'Paid', align: 'right', render: (r) => <span className="text-primary">{rupees(r.paidTo)}</span> },
                { header: 'Entries', align: 'right', render: (r) => r.paidEntries },
                { header: 'Last Activity', render: (r) => dateLabel(r.paidLastDate) },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}
