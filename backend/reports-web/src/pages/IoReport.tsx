import { useEffect, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Download, Share2, Wallet } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { accountsApi } from '../api';
import DataTable from '../components/DataTable';
import DateRangePicker from '../components/DateRangePicker';
import SummaryCard from '../components/SummaryCard';
import { buildPdfReport, downloadPdfReport, sharePdfReportOnWhatsApp } from '../services/pdfReport';

const rupees = (v: any) => `Rs ${Number(v || 0).toLocaleString('en-IN')}`;
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('en-IN');

const ROLES = ['Admin', 'Supervisor', 'Owner'];

export default function IoReport() {
  const [role, setRole] = useState('Admin');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const load = (r = role, f = from, t = to) => {
    setLoading(true);
    accountsApi
      .getIoReport(r, f || undefined, t || undefined)
      .then(setReport)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownload = async () => {
    if (!report) return;
    setDownloading(true);
    try {
      const rangeTitle = from && to ? `${dateLabel(from)} to ${dateLabel(to)}` : from ? `From ${dateLabel(from)}` : 'All Time';
      const { doc, filename } = await buildPdfReport({
        filename: `${role}-io-report.pdf`,
        title: `${role} I/O Report`,
        subtitle: rangeTitle,
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
              ...(from ? [['Opening Balance', '', '', Number(report.opening).toLocaleString('en-IN')]] : []),
              ...report.rows.map((r: any) => [
                dateLabel(r.date),
                Number(r.input).toLocaleString('en-IN'),
                Number(r.output).toLocaleString('en-IN'),
                Number(r.balance).toLocaleString('en-IN'),
              ]),
            ],
            foot: ['TOTAL', Number(report.totals.input).toLocaleString('en-IN'), Number(report.totals.output).toLocaleString('en-IN'), Number(report.totals.closing).toLocaleString('en-IN')],
          },
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
      const rangeTitle = from && to ? `${dateLabel(from)} to ${dateLabel(to)}` : from ? `From ${dateLabel(from)}` : 'All Time';
      const pdf = await buildPdfReport({
        filename: `${role}-io-report.pdf`,
        title: `${role} I/O Report`,
        subtitle: rangeTitle,
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
              ...(from ? [['Opening Balance', '', '', Number(report.opening).toLocaleString('en-IN')]] : []),
              ...report.rows.map((r: any) => [
                dateLabel(r.date),
                Number(r.input).toLocaleString('en-IN'),
                Number(r.output).toLocaleString('en-IN'),
                Number(r.balance).toLocaleString('en-IN'),
              ]),
            ],
            foot: ['TOTAL', Number(report.totals.input).toLocaleString('en-IN'), Number(report.totals.output).toLocaleString('en-IN'), Number(report.totals.closing).toLocaleString('en-IN')],
          },
        ],
      });
      const text = `${role} I/O Report (${rangeTitle})\nInput: ${rupees(report.totals.input)}\nOutput: ${rupees(report.totals.output)}\nClosing Balance: ${rupees(report.totals.closing)}`;
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
          <button
            key={r}
            className={`chip${role === r ? ' active' : ''}`}
            onClick={() => {
              setRole(r);
              load(r, from, to);
            }}
          >
            {r}
          </button>
        ))}
      </div>

      <DateRangePicker
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onApply={() => load(role, from, to)}
        onClear={() => {
          setFrom('');
          setTo('');
          load(role, '', '');
        }}
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

          <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={handleDownload} disabled={downloading}>
              <Download size={16} />
              {downloading ? 'Building PDF…' : 'Download PDF'}
            </button>
            <button className="btn whatsapp" onClick={handleShareWhatsApp} disabled={downloading}>
              <Share2 size={16} />
              Share on WhatsApp
            </button>
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
        </>
      ) : (
        <div className="empty-note">No data.</div>
      )}
    </div>
  );
}
