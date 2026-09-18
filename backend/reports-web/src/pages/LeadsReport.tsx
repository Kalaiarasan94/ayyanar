import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, Share2 } from 'lucide-react';
import { adminApi } from '../api';
import DataTable from '../components/DataTable';
import DateFilterBar, { DateFilterMode } from '../components/DateFilterBar';
import PrintButton from '../components/PrintButton';
import SummaryCard from '../components/SummaryCard';
import { buildPdfReport, downloadPdfReport, sharePdfReportOnWhatsApp } from '../services/pdfReport';
import { csvCell, exportCsv } from '../services/printReport';

const dateLabel = (iso: string) => (iso ? new Date(iso).toLocaleDateString('en-IN') : '—');
const todayIso = () => new Date().toISOString().split('T')[0];

export default function LeadsReport() {
  const [mode, setMode] = useState<DateFilterMode>('all');
  const [date, setDate] = useState(todayIso());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const load = (m = mode, d = date, f = from, t = to) => {
    setLoading(true);
    const params = m === 'single' ? { date: d } : m === 'range' ? { from: f, to: t } : {};
    adminApi
      .getLeads(params)
      .then(setLeads)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rangeLabel = mode === 'single' ? dateLabel(date) : mode === 'range' ? `${dateLabel(from)} to ${dateLabel(to)}` : 'All Time';

  const total = leads.length;
  const converted = leads.filter((l) => l.status === 'Converted').length;
  const conversionRate = total > 0 ? `${Math.round((converted / total) * 100)}%` : '0%';
  const bySource = new Map<string, { total: number; converted: number }>();
  leads.forEach((l) => {
    const key = l.source || 'Unknown';
    const e = bySource.get(key) || { total: 0, converted: 0 };
    e.total += 1;
    if (l.status === 'Converted') e.converted += 1;
    bySource.set(key, e);
  });
  const sourceRows = Array.from(bySource.entries()).map(([source, v]) => ({ source, ...v }));

  const handleDownloadPdf = async () => {
    if (leads.length === 0) return;
    setDownloading(true);
    try {
      const { doc, filename } = await buildPdfReport({
        filename: 'leads-report.pdf',
        title: 'Leads & Marketing Pipeline Report',
        subtitle: rangeLabel,
        summaryBoxes: [
          { label: 'Total Leads', value: total.toString() },
          { label: 'Converted', value: converted.toString(), color: '#15803d' },
          { label: 'Conversion Rate', value: conversionRate },
        ],
        tables: [
          {
            title: 'Leads by Channel',
            head: ['Channel / Source', 'Total Leads', 'Converted', 'Conversion %'],
            body: sourceRows.map((r) => [
              r.source,
              r.total,
              r.converted,
              r.total > 0 ? `${Math.round((r.converted / r.total) * 100)}%` : '0%',
            ]),
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
          },
          {
            title: `All Leads (${leads.length})`,
            head: ['#', 'Name', 'Phone', 'Project Needed', 'Source', 'Status', 'Created'],
            body: leads.map((l, i) => [
              i + 1,
              l.name || '-',
              l.phone || '-',
              l.project_needed || '-',
              l.source || '-',
              l.status || 'New',
              dateLabel(l.created_at),
            ]),
          },
        ],
      });
      await downloadPdfReport({ doc, filename });
    } finally {
      setDownloading(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (leads.length === 0) return;
    setDownloading(true);
    try {
      const pdf = await buildPdfReport({
        filename: 'leads-report.pdf',
        title: 'Leads & Marketing Pipeline Report',
        subtitle: rangeLabel,
        summaryBoxes: [
          { label: 'Total Leads', value: total.toString() },
          { label: 'Converted', value: converted.toString(), color: '#15803d' },
          { label: 'Conversion Rate', value: conversionRate },
        ],
        tables: [
          {
            title: 'Leads by Channel',
            head: ['Channel / Source', 'Total Leads', 'Converted', 'Conversion %'],
            body: sourceRows.map((r) => [
              r.source,
              r.total,
              r.converted,
              r.total > 0 ? `${Math.round((r.converted / r.total) * 100)}%` : '0%',
            ]),
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
          },
        ],
      });
      const text = `Leads Pipeline Report (${rangeLabel})\nTotal Leads: ${total}\nConverted: ${converted}\nConversion Rate: ${conversionRate}`;
      await sharePdfReportOnWhatsApp(pdf, text);
    } finally {
      setDownloading(false);
    }
  };

  const handleExport = () => {
    const header = ['Name', 'Phone', 'Project Needed', 'Source', 'Status', 'Created'];
    const lines = leads.map((l) => [l.name, l.phone, l.project_needed || '', l.source || '', l.status, l.created_at].map(csvCell).join(','));
    exportCsv('leads.csv', [header.join(','), ...lines].join('\n'));
  };

  return (
    <div>
      <h1 className="page-title">Leads Report</h1>
      <p className="page-subtitle">Pipeline by status and channel, with conversion rate.</p>

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

      {loading ? (
        <div className="empty-note">Loading…</div>
      ) : (
        <>
          <div className="summary-row">
            <SummaryCard label="Total Leads" value={total.toString()} />
            <SummaryCard label="Converted" value={converted.toString()} color="#15803d" />
            <SummaryCard label="Conversion Rate" value={conversionRate} />
          </div>

          <div className="toolbar no-print" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={handleDownloadPdf} disabled={downloading || leads.length === 0}>
              <Download size={16} />
              {downloading ? 'Building PDF…' : 'Download PDF'}
            </button>
            <button className="btn whatsapp" onClick={handleShareWhatsApp} disabled={downloading || leads.length === 0}>
              <Share2 size={16} />
              Share on WhatsApp
            </button>
            <button className="btn secondary" onClick={handleExport} disabled={leads.length === 0}>
              <FileSpreadsheet size={16} />
              Download CSV
            </button>
            <PrintButton />
          </div>

          <div className="card">
            <h3 className="section-heading">By Channel</h3>
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
            <h3 className="section-heading">All Leads ({leads.length})</h3>
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
