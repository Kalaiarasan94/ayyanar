import { useEffect, useState } from 'react';
import { Clock, CheckCircle2, Download, FileSpreadsheet, Share2, Wallet } from 'lucide-react';
import { adminApi, fieldApi } from '../api';
import DataTable from '../components/DataTable';
import DateFilterBar, { DateFilterMode } from '../components/DateFilterBar';
import PrintButton from '../components/PrintButton';
import SummaryCard from '../components/SummaryCard';
import { buildPdfReport, downloadPdfReport, sharePdfReportOnWhatsApp } from '../services/pdfReport';
import { csvCell, exportCsv } from '../services/printReport';

const rupees = (v: any) => `Rs ${Number(v || 0).toLocaleString('en-IN')}`;
const dateLabel = (iso: string) => (iso ? new Date(iso).toLocaleDateString('en-IN') : '—');
const todayIso = () => new Date().toISOString().split('T')[0];

type Status = 'Pending' | 'Approved';

export default function IndirectBillsReport() {
  const [status, setStatus] = useState<Status>('Pending');
  const [sites, setSites] = useState<any[]>([]);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [supervisors, setSupervisors] = useState<{ id: any; name: string }[]>([]);
  const [supervisorId, setSupervisorId] = useState<string | null>(null);
  const [mode, setMode] = useState<DateFilterMode>('all');
  const [date, setDate] = useState(todayIso());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const load = (s = status, site = siteId, sup = supervisorId, m = mode, d = date, f = from, t = to) => {
    setLoading(true);
    const [qFrom, qTo] = m === 'single' ? [d, d] : m === 'range' ? [f, t] : [undefined, undefined];
    fieldApi
      .getIndirectBills({ status: s, siteId: site || undefined, userId: sup || undefined, from: qFrom, to: qTo })
      .then((data) => setBills(Array.isArray(data) ? data : []))
      .catch(() => setBills([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    adminApi.getSites().then((s) => setSites(s || [])).catch(() => setSites([]));
    adminApi.getStaff().then((staff) => setSupervisors((staff || []).filter((s: any) => s.role === 'Supervisor').map((s: any) => ({ id: s.id, name: s.name })))).catch(() => setSupervisors([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rangeLabel = mode === 'single' ? dateLabel(date) : mode === 'range' ? `${dateLabel(from)} to ${dateLabel(to)}` : 'All Time';
  const totalAmount = bills.reduce((s, b) => s + Number((status === 'Approved' ? b.approved_amount : b.amount) || 0), 0);

  const handleDownloadPdf = async () => {
    if (bills.length === 0) return;
    setDownloading(true);
    try {
      const { doc, filename } = await buildPdfReport({
        filename: `indirect-bills-${status.toLowerCase()}.pdf`,
        title: `Indirect Bills — ${status}`,
        subtitle: rangeLabel,
        summaryBoxes: [
          { label: `${status} Bills`, value: bills.length.toString() },
          { label: status === 'Approved' ? 'Total Approved' : 'Total Pending', value: rupees(totalAmount), color: status === 'Approved' ? '#15803d' : '#e23744' },
        ],
        tables: [
          status === 'Approved'
            ? {
                title: `Approved Indirect Bills (${bills.length})`,
                head: ['#', 'Supervisor', 'Site', 'Category', 'Logged (Rs)', 'Approved (Rs)', 'Approved Date', 'Approved By', 'Notes'],
                body: bills.map((b, i) => [
                  i + 1,
                  b.supervisor_name || '-',
                  b.site_name || '-',
                  b.category || '-',
                  Number(b.amount || 0).toLocaleString('en-IN'),
                  Number(b.approved_amount || 0).toLocaleString('en-IN'),
                  dateLabel(b.approved_date),
                  b.approved_by_name || '-',
                  b.approval_notes || '-',
                ]),
                foot: ['', '', '', 'TOTAL', '', totalAmount.toLocaleString('en-IN'), '', '', ''],
                columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' } },
              }
            : {
                title: `Pending Indirect Bills (${bills.length})`,
                head: ['#', 'Date', 'Supervisor', 'Site', 'Category', 'Description', 'Amount (Rs)'],
                body: bills.map((b, i) => [i + 1, dateLabel(b.date), b.supervisor_name || '-', b.site_name || '-', b.category || '-', b.description || '-', Number(b.amount || 0).toLocaleString('en-IN')]),
                foot: ['', '', '', '', '', 'TOTAL', totalAmount.toLocaleString('en-IN')],
                columnStyles: { 6: { halign: 'right' } },
              },
        ],
      });
      await downloadPdfReport({ doc, filename });
    } finally {
      setDownloading(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (bills.length === 0) return;
    setDownloading(true);
    try {
      const pdf = await buildPdfReport({
        filename: `indirect-bills-${status.toLowerCase()}.pdf`,
        title: `Indirect Bills — ${status}`,
        subtitle: rangeLabel,
        summaryBoxes: [
          { label: `${status} Bills`, value: bills.length.toString() },
          { label: status === 'Approved' ? 'Total Approved' : 'Total Pending', value: rupees(totalAmount), color: status === 'Approved' ? '#15803d' : '#e23744' },
        ],
        tables: [
          status === 'Approved'
            ? {
                title: `Approved Indirect Bills (${bills.length})`,
                head: ['#', 'Supervisor', 'Site', 'Category', 'Approved (Rs)', 'Approved Date', 'Approved By'],
                body: bills.map((b, i) => [i + 1, b.supervisor_name || '-', b.site_name || '-', b.category || '-', Number(b.approved_amount || 0).toLocaleString('en-IN'), dateLabel(b.approved_date), b.approved_by_name || '-']),
                columnStyles: { 4: { halign: 'right' } },
              }
            : {
                title: `Pending Indirect Bills (${bills.length})`,
                head: ['#', 'Date', 'Supervisor', 'Site', 'Category', 'Amount (Rs)'],
                body: bills.map((b, i) => [i + 1, dateLabel(b.date), b.supervisor_name || '-', b.site_name || '-', b.category || '-', Number(b.amount || 0).toLocaleString('en-IN')]),
                columnStyles: { 5: { halign: 'right' } },
              },
        ],
      });
      const text = `Indirect Bills — ${status} (${rangeLabel})\n${status} Bills: ${bills.length}\nTotal: ${rupees(totalAmount)}`;
      await sharePdfReportOnWhatsApp(pdf, text);
    } finally {
      setDownloading(false);
    }
  };

  const handleExport = () => {
    if (status === 'Approved') {
      const header = ['Supervisor', 'Site', 'Category', 'Logged Amount', 'Approved Amount', 'Approved Date', 'Approved By', 'Notes'];
      const lines = bills.map((b) =>
        [b.supervisor_name || '', b.site_name || '', b.category || '', b.amount, b.approved_amount, b.approved_date, b.approved_by_name || '', b.approval_notes || ''].map(csvCell).join(',')
      );
      exportCsv('indirect-bills-approved.csv', [header.join(','), ...lines].join('\n'));
    } else {
      const header = ['Date', 'Supervisor', 'Site', 'Category', 'Description', 'Amount'];
      const lines = bills.map((b) => [b.date, b.supervisor_name || '', b.site_name || '', b.category || '', b.description || '', b.amount].map(csvCell).join(','));
      exportCsv('indirect-bills-pending.csv', [header.join(','), ...lines].join('\n'));
    }
  };

  return (
    <div>
      <h1 className="page-title">Indirect Bills</h1>
      <p className="page-subtitle">Credit bills stay Pending — no effect on cash balance — until Admin/Owner approves the settlement.</p>

      <div className="chip-row" style={{ marginBottom: 14 }}>
        <button className={`chip${status === 'Pending' ? ' active' : ''}`} onClick={() => { setStatus('Pending'); load('Pending'); }}>
          <Clock size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
          Pending Approvals
        </button>
        <button className={`chip${status === 'Approved' ? ' active' : ''}`} onClick={() => { setStatus('Approved'); load('Approved'); }}>
          <CheckCircle2 size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
          Approvals
        </button>
      </div>

      {sites.length > 0 && (
        <div className="chip-row" style={{ marginBottom: 14 }}>
          <button className={`chip${!siteId ? ' active' : ''}`} onClick={() => { setSiteId(null); load(status, null); }}>
            All Sites
          </button>
          {sites.map((s) => (
            <button key={s.id} className={`chip${siteId === s.id.toString() ? ' active' : ''}`} onClick={() => { setSiteId(s.id.toString()); load(status, s.id.toString()); }}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      {supervisors.length > 0 && (
        <div className="chip-row" style={{ marginBottom: 14 }}>
          <button className={`chip${!supervisorId ? ' active' : ''}`} onClick={() => { setSupervisorId(null); load(status, siteId, null); }}>
            All Supervisors
          </button>
          {supervisors.map((s) => (
            <button key={s.id} className={`chip${supervisorId === s.id.toString() ? ' active' : ''}`} onClick={() => { setSupervisorId(s.id.toString()); load(status, siteId, s.id.toString()); }}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      <DateFilterBar
        mode={mode}
        onModeChange={(m) => { setMode(m); load(status, siteId, supervisorId, m, date, from, to); }}
        date={date}
        onDateChange={(d) => { setDate(d); load(status, siteId, supervisorId, 'single', d, from, to); }}
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onApplyRange={(f = from, t = to) => { setFrom(f); setTo(t); load(status, siteId, supervisorId, 'range', date, f, t); }}
      />

      {!loading && (
        <div className="summary-row">
          <SummaryCard label={`${status} Bills`} value={bills.length.toString()} icon={status === 'Approved' ? CheckCircle2 : Clock} />
          <SummaryCard label={status === 'Approved' ? 'Total Approved' : 'Total Pending'} value={rupees(totalAmount)} color={status === 'Approved' ? '#15803d' : '#e23744'} icon={Wallet} />
        </div>
      )}

      <div className="toolbar no-print" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={handleDownloadPdf} disabled={downloading || bills.length === 0}>
          <Download size={16} />
          {downloading ? 'Building PDF…' : 'Download PDF'}
        </button>
        <button className="btn whatsapp" onClick={handleShareWhatsApp} disabled={downloading || bills.length === 0}>
          <Share2 size={16} />
          Share on WhatsApp
        </button>
        <button className="btn secondary" onClick={handleExport} disabled={bills.length === 0}>
          <FileSpreadsheet size={16} />
          Download CSV
        </button>
        <PrintButton />
      </div>

      <div className="card">
        {loading ? (
          <div className="empty-note">Loading…</div>
        ) : status === 'Approved' ? (
          <DataTable<any>
            rowKey={(b) => b.id}
            rows={bills}
            emptyText="No indirect bills approved for this selection."
            totalRow={bills.length ? ['', '', '', '', rupees(totalAmount), '', '', ''] : undefined}
            columns={[
              { header: 'Supervisor', render: (b: any) => b.supervisor_name || '—' },
              { header: 'Site', render: (b: any) => b.site_name || '—' },
              { header: 'Category', render: (b: any) => b.category || '—' },
              { header: 'Logged', align: 'right', render: (b: any) => rupees(b.amount) },
              { header: 'Approved', align: 'right', render: (b: any) => <span className="text-success">{rupees(b.approved_amount)}</span> },
              { header: 'Approved On', render: (b: any) => dateLabel(b.approved_date) },
              { header: 'Approved By', render: (b: any) => b.approved_by_name || '—' },
              { header: 'Notes', render: (b: any) => b.approval_notes || '—' },
            ]}
          />
        ) : (
          <DataTable<any>
            rowKey={(b) => b.id}
            rows={bills}
            emptyText="No indirect bills pending for this selection."
            totalRow={bills.length ? ['', '', '', '', rupees(totalAmount)] : undefined}
            columns={[
              { header: 'Date', render: (b: any) => dateLabel(b.date) },
              { header: 'Supervisor', render: (b: any) => b.supervisor_name || '—' },
              { header: 'Site', render: (b: any) => b.site_name || '—' },
              { header: 'Category', render: (b: any) => b.category || '—' },
              { header: 'Amount', align: 'right', render: (b: any) => <span className="text-primary">{rupees(b.amount)}</span> },
            ]}
          />
        )}
      </div>
    </div>
  );
}
