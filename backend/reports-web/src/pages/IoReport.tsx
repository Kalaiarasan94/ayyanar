import { useEffect, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Download, Share2, Wallet } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { accountsApi, adminApi } from '../api';
import DataTable from '../components/DataTable';
import DateFilterBar, { DateFilterMode } from '../components/DateFilterBar';
import PrintButton from '../components/PrintButton';
import SummaryCard from '../components/SummaryCard';
import { buildPdfReport, downloadPdfReport, sharePdfReportOnWhatsApp } from '../services/pdfReport';

const rupees = (v: any) => `Rs ${Number(v || 0).toLocaleString('en-IN')}`;
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('en-IN');
const todayIso = () => new Date().toISOString().split('T')[0];

const ROLES = ['Admin', 'Supervisor', 'Owner'];

export default function IoReport() {
  const [role, setRole] = useState('Admin');
  // Only meaningful when role === 'Supervisor': narrows the statement to one
  // specific supervisor instead of the whole team's combined book
  const [supervisors, setSupervisors] = useState<{ id: any; name: string }[]>([]);
  const [supervisorId, setSupervisorId] = useState<string | null>(null);
  const [mode, setMode] = useState<DateFilterMode>('all');
  const [date, setDate] = useState(todayIso());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const load = (r = role, m = mode, d = date, f = from, t = to, userId = supervisorId) => {
    setLoading(true);
    const [qFrom, qTo] = m === 'single' ? [d, d] : m === 'range' ? [f, t] : [undefined, undefined];
    accountsApi
      .getIoReport(r, qFrom, qTo, r === 'Supervisor' ? userId || undefined : undefined)
      .then(setReport)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    adminApi.getStaff().then((staff) => setSupervisors((staff || []).filter((s: any) => s.role === 'Supervisor').map((s: any) => ({ id: s.id, name: s.name }))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectRole = (r: string) => {
    setRole(r);
    setSupervisorId(null);
    load(r, mode, date, from, to, null);
  };

  const selectSupervisor = (id: string | null) => {
    setSupervisorId(id);
    load(role, mode, date, from, to, id);
  };

  const supervisorName = supervisorId ? supervisors.find((s) => s.id.toString() === supervisorId)?.name : null;
  const rangeTitle = mode === 'single' ? dateLabel(date) : mode === 'range' ? `${dateLabel(from)} to ${dateLabel(to)}` : 'All Time';

  const handleDownload = async () => {
    if (!report) return;
    setDownloading(true);
    try {
      const { doc, filename } = await buildPdfReport({
        filename: `${role}${supervisorName ? `-${supervisorName}` : ''}-io-report.pdf`,
        title: `${supervisorName || role} I/O Report`,
        subtitle: supervisorName ? `${role}: ${supervisorName} — ${rangeTitle}` : rangeTitle,
        summaryBoxes: [
          { label: 'Total Input', value: rupees(report.totals.input), color: '#15803d' },
          { label: 'Total Output', value: rupees(report.totals.output), color: '#e23744' },
          { label: 'Closing Balance', value: rupees(report.totals.closing) },
        ],
        tables: [
          {
            title: 'Date-wise Statement',
            head: ['Date', 'Input (Rs)', 'Output (Rs)', 'Balance (Rs)'],
            body: [
              ...(mode !== 'all' ? [['Opening Balance', '', '', Number(report.opening).toLocaleString('en-IN')]] : []),
              ...report.rows.map((r: any) => [
                dateLabel(r.date),
                Number(r.input).toLocaleString('en-IN'),
                Number(r.output).toLocaleString('en-IN'),
                Number(r.balance).toLocaleString('en-IN'),
              ]),
            ],
            foot: ['TOTAL', Number(report.totals.input).toLocaleString('en-IN'), Number(report.totals.output).toLocaleString('en-IN'), Number(report.totals.closing).toLocaleString('en-IN')],
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
          },
          ...(role === 'Supervisor' && (report.indirect?.rows || []).length > 0
            ? [
                {
                  title: `Indirect Bills Output (${report.indirect.rows.length}) — part of Output above`,
                  head: ['Date', 'Site', 'Notes', 'Amount (Rs)'],
                  body: report.indirect.rows.map((r: any) => [dateLabel(r.date), r.site || '-', r.description || '-', Number(r.amount).toLocaleString('en-IN')]),
                  foot: ['', '', 'TOTAL', Number(report.indirect.total).toLocaleString('en-IN')],
                  columnStyles: { 3: { halign: 'right' as const } },
                },
              ]
            : []),
        ],
      });
      await downloadPdfReport({ doc, filename });
    } finally {
      setDownloading(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (!report) return;
    setDownloading(true);
    try {
      const pdf = await buildPdfReport({
        filename: `${role}${supervisorName ? `-${supervisorName}` : ''}-io-report.pdf`,
        title: `${supervisorName || role} I/O Report`,
        subtitle: supervisorName ? `${role}: ${supervisorName} — ${rangeTitle}` : rangeTitle,
        summaryBoxes: [
          { label: 'Total Input', value: rupees(report.totals.input), color: '#15803d' },
          { label: 'Total Output', value: rupees(report.totals.output), color: '#e23744' },
          { label: 'Closing Balance', value: rupees(report.totals.closing) },
        ],
        tables: [
          {
            title: 'Date-wise Statement',
            head: ['Date', 'Input (Rs)', 'Output (Rs)', 'Balance (Rs)'],
            body: [
              ...(mode !== 'all' ? [['Opening Balance', '', '', Number(report.opening).toLocaleString('en-IN')]] : []),
              ...report.rows.map((r: any) => [
                dateLabel(r.date),
                Number(r.input).toLocaleString('en-IN'),
                Number(r.output).toLocaleString('en-IN'),
                Number(r.balance).toLocaleString('en-IN'),
              ]),
            ],
            foot: ['TOTAL', Number(report.totals.input).toLocaleString('en-IN'), Number(report.totals.output).toLocaleString('en-IN'), Number(report.totals.closing).toLocaleString('en-IN')],
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
          },
          ...(role === 'Supervisor' && (report.indirect?.rows || []).length > 0
            ? [
                {
                  title: `Indirect Bills Output (${report.indirect.rows.length}) — part of Output above`,
                  head: ['Date', 'Site', 'Notes', 'Amount (Rs)'],
                  body: report.indirect.rows.map((r: any) => [dateLabel(r.date), r.site || '-', r.description || '-', Number(r.amount).toLocaleString('en-IN')]),
                  foot: ['', '', 'TOTAL', Number(report.indirect.total).toLocaleString('en-IN')],
                  columnStyles: { 3: { halign: 'right' as const } },
                },
              ]
            : []),
        ],
      });
      const text = `${supervisorName || role} I/O Report (${rangeTitle})\nInput: ${rupees(report.totals.input)}\nOutput: ${rupees(report.totals.output)}\nClosing Balance: ${rupees(report.totals.closing)}`;
      await sharePdfReportOnWhatsApp(pdf, text);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Role I/O Statement</h1>
      <p className="page-subtitle">Opening → closing balance statement for one role's book.</p>

      <div className="chip-row" style={{ marginBottom: 14 }}>
        {ROLES.map((r) => (
          <button key={r} className={`chip${role === r ? ' active' : ''}`} onClick={() => selectRole(r)}>
            {r}
          </button>
        ))}
      </div>

      {role === 'Supervisor' && supervisors.length > 0 && (
        <div className="chip-row" style={{ marginBottom: 14 }}>
          <button className={`chip${!supervisorId ? ' active' : ''}`} onClick={() => selectSupervisor(null)}>
            All Supervisors (Combined)
          </button>
          {supervisors.map((s) => (
            <button key={s.id} className={`chip${supervisorId === s.id.toString() ? ' active' : ''}`} onClick={() => selectSupervisor(s.id.toString())}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      <DateFilterBar
        mode={mode}
        onModeChange={(m) => { setMode(m); load(role, m, date, from, to); }}
        date={date}
        onDateChange={(d) => { setDate(d); load(role, 'single', d, from, to); }}
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onApplyRange={(f = from, t = to) => { setFrom(f); setTo(t); load(role, 'range', date, f, t); }}
      />

      {loading ? (
        <div className="empty-note">Loading…</div>
      ) : report ? (
        <>
          <div className="summary-row">
            <SummaryCard label="Total Input" value={rupees(report.totals.input)} color="#15803d" icon={ArrowDownCircle} />
            <SummaryCard label="Total Output" value={rupees(report.totals.output)} color="#e23744" icon={ArrowUpCircle} />
            <SummaryCard label="Closing Balance" value={rupees(report.totals.closing)} icon={Wallet} />
          </div>

          <div className="toolbar no-print" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={handleDownload} disabled={downloading}>
              <Download size={16} />
              {downloading ? 'Building PDF…' : 'Download PDF'}
            </button>
            <button className="btn whatsapp" onClick={handleShareWhatsApp} disabled={downloading}>
              <Share2 size={16} />
              Share on WhatsApp
            </button>
            <PrintButton />
          </div>

          {report.rows.length > 1 && (
            <div className="card">
              <h3 className="section-heading">Balance Trend</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={report.rows.map((r: any) => ({ name: dateLabel(r.date), Balance: Number(r.balance) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1dede" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => rupees(v)} />
                  <Line type="monotone" dataKey="Balance" stroke="#e23744" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="card">
            <DataTable<any>
              rowKey={(r, i) => `${r.date}-${i}`}
              rows={report.rows}
              emptyText="No activity in this range."
              totalRow={['TOTAL', rupees(report.totals.input), rupees(report.totals.output), rupees(report.totals.closing)]}
              columns={[
                { header: 'Date', render: (r: any) => dateLabel(r.date) },
                { header: 'Input', align: 'right', render: (r: any) => <span className="text-success">{rupees(r.input)}</span> },
                { header: 'Output', align: 'right', render: (r: any) => <span className="text-primary">{rupees(r.output)}</span> },
                { header: 'Balance', align: 'right', render: (r: any) => rupees(r.balance) },
              ]}
            />
          </div>

          {role === 'Supervisor' && (
            <div className="card">
              <h3 className="section-heading">Indirect Bills Output ({(report.indirect?.rows || []).length})</h3>
              <p className="text-muted" style={{ fontSize: 12.5, marginTop: -8, marginBottom: 12 }}>
                Approved indirect-bill settlements only — already counted inside Output above, broken out here.
              </p>
              <DataTable<any>
                rowKey={(r: any) => r.id}
                rows={report.indirect?.rows || []}
                emptyText="No indirect bills settled in this range."
                totalRow={report.indirect?.rows?.length ? ['', '', 'TOTAL', rupees(report.indirect.total)] : undefined}
                columns={[
                  { header: 'Date', render: (r: any) => dateLabel(r.date) },
                  { header: 'Site', render: (r: any) => r.site || '—' },
                  { header: 'Notes', render: (r: any) => r.description || '—' },
                  { header: 'Amount', align: 'right', render: (r: any) => <span className="text-primary">{rupees(r.amount)}</span> },
                ]}
              />
            </div>
          )}
        </>
      ) : (
        <div className="empty-note">No data.</div>
      )}
    </div>
  );
}
