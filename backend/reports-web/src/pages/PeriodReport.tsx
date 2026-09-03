import { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { accountsApi } from '../api';
import DataTable from '../components/DataTable';
import SummaryCard from '../components/SummaryCard';
import { buildPdfReport, downloadPdfReport } from '../services/pdfReport';

const rupees = (v: any) => `Rs ${Number(v || 0).toLocaleString('en-IN')}`;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (period: string) => {
  const [year, month] = period.split('-');
  if (!month) return period;
  return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
};
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('en-IN');

export default function PeriodReport() {
  const [type, setType] = useState<'monthly' | 'yearly'>('monthly');
  const [periods, setPeriods] = useState<{ months: string[]; years: string[] }>({ months: [], years: [] });
  const [period, setPeriod] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    accountsApi.getPeriods().then((p) => {
      setPeriods(p);
      const first = (type === 'monthly' ? p.months : p.years)[0] || null;
      setPeriod(first);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!period) {
      setReport(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    accountsApi
      .getReport(type, period)
      .then(setReport)
      .finally(() => setLoading(false));
  }, [type, period]);

  const switchType = (t: 'monthly' | 'yearly') => {
    setType(t);
    setPeriod((t === 'monthly' ? periods.months : periods.years)[0] || null);
  };

  const handleDownload = async () => {
    if (!report) return;
    setDownloading(true);
    try {
      const periodTitle = type === 'monthly' ? monthLabel(report.period) : report.period;
      const { doc, filename } = await buildPdfReport({
        filename: `${type}-report-${report.period}.pdf`,
        title: `${type === 'monthly' ? 'Monthly' : 'Yearly'} Report`,
        subtitle: periodTitle,
        summaryBoxes: [
          { label: 'Revenue', value: rupees(report.revenue), color: '#15803d' },
          { label: 'Expenses', value: rupees(report.expenses), color: '#e23744' },
          { label: report.profit >= 0 ? 'Profit' : 'Loss', value: rupees(Math.abs(report.profit)) },
        ],
        tables: [
          {
            title: 'Received From',
            head: ['Category', 'Amount (Rs)'],
            body: report.receivedBreakdown.map((b: any) => [b.category, Number(b.total).toLocaleString('en-IN')]),
          },
          {
            title: 'Paid To',
            head: ['Category', 'Amount (Rs)'],
            body: report.paidBreakdown.map((b: any) => [b.category, Number(b.total).toLocaleString('en-IN')]),
          },
          {
            title: `Vouchers (${report.transactions.length})`,
            head: ['Date', 'Role', 'Flow', 'Category', 'Party', 'Amount (Rs)'],
            body: report.transactions.map((t: any) => [
              dateLabel(t.date),
              t.role,
              t.flow,
              t.category,
              t.party_name || '-',
              Number(t.amount).toLocaleString('en-IN'),
            ]),
          },
        ],
      });
      await downloadPdfReport({ doc, filename });
    } finally {
      setDownloading(false);
    }
  };

  const availablePeriods = type === 'monthly' ? periods.months : periods.years;

  return (
    <div>
      <h1 className="page-title">Monthly / Yearly Report</h1>
      <p className="page-subtitle">Full statement for one period — revenue, expenses, breakdowns and every voucher.</p>

      <div className="chip-row" style={{ marginBottom: 14 }}>
        {(['monthly', 'yearly'] as const).map((t) => (
          <button key={t} className={`chip${type === t ? ' active' : ''}`} onClick={() => switchType(t)}>
            {t === 'monthly' ? 'Monthly' : 'Yearly'}
          </button>
        ))}
      </div>

      <div className="chip-row" style={{ marginBottom: 18 }}>
        {availablePeriods.map((p) => (
          <button key={p} className={`chip${period === p ? ' active' : ''}`} onClick={() => setPeriod(p)}>
            {type === 'monthly' ? monthLabel(p) : p}
          </button>
        ))}
        {availablePeriods.length === 0 && <span className="text-muted">No periods with data yet.</span>}
      </div>

      {loading ? (
        <div className="empty-note">Loading…</div>
      ) : report ? (
        <>
          <div className="summary-row">
            <SummaryCard label="Revenue" value={rupees(report.revenue)} color="#15803d" icon={TrendingUp} />
            <SummaryCard label="Expenses" value={rupees(report.expenses)} color="#e23744" icon={TrendingDown} />
            <SummaryCard label={report.profit >= 0 ? 'Profit' : 'Loss'} value={rupees(Math.abs(report.profit))} icon={Wallet} />
          </div>
          <p className="text-muted" style={{ fontSize: 12.5, marginTop: -8 }}>
            Internal transfers this period: {rupees(report.transfers)} (not counted in revenue or expenses)
          </p>

          <div className="toolbar">
            <button className="btn" onClick={handleDownload} disabled={downloading}>
              {downloading ? 'Building PDF…' : 'Download PDF'}
            </button>
          </div>

          {(report.receivedBreakdown.length > 0 || report.paidBreakdown.length > 0) && (
            <div className="card">
              <h3 className="section-heading">Received vs Paid — By Category</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={[
                    ...report.receivedBreakdown.map((b: any) => ({ name: b.category, Received: Number(b.total), Paid: 0 })),
                    ...report.paidBreakdown.map((b: any) => ({ name: b.category, Received: 0, Paid: Number(b.total) })),
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1dede" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => rupees(v)} />
                  <Bar dataKey="Received" fill="#15803d" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Paid" fill="#e23744" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="card">
            <h3 className="section-heading">Received From</h3>
            <DataTable<any>
              rowKey={(b) => b.category}
              rows={report.receivedBreakdown}
              emptyText="No receipts this period."
              columns={[
                { header: 'Category', render: (b: any) => b.category },
                { header: 'Amount', align: 'right', render: (b: any) => <span className="text-success">{rupees(b.total)}</span> },
              ]}
            />
          </div>

          <div className="card">
            <h3 className="section-heading">Paid To</h3>
            <DataTable<any>
              rowKey={(b) => b.category}
              rows={report.paidBreakdown}
              emptyText="No payments this period."
              columns={[
                { header: 'Category', render: (b: any) => b.category },
                { header: 'Amount', align: 'right', render: (b: any) => <span className="text-primary">{rupees(b.total)}</span> },
              ]}
            />
          </div>

          <div className="card">
            <h3 className="section-heading">Vouchers ({report.transactions.length})</h3>
            <DataTable<any>
              rowKey={(t) => t.id}
              rows={report.transactions}
              emptyText="No transactions this period."
              columns={[
                { header: 'Date', render: (t: any) => dateLabel(t.date) },
                { header: 'Role', render: (t: any) => t.role },
                { header: 'Flow', render: (t: any) => (t.flow === 'IN' ? <span className="text-success">IN</span> : <span className="text-primary">OUT</span>) },
                { header: 'Category', render: (t: any) => t.category },
                { header: 'Party', render: (t: any) => t.party_name || '—' },
                { header: 'Amount', align: 'right', render: (t: any) => rupees(t.amount) },
              ]}
            />
          </div>
        </>
      ) : (
        <div className="empty-note">Pick a period to see its report.</div>
      )}
    </div>
  );
}
