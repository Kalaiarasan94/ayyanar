import { useEffect, useState } from 'react';
import { Download, Share2, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { accountsApi, adminApi } from '../api';
import SummaryCard from '../components/SummaryCard';
import DataTable from '../components/DataTable';
import DateFilterBar, { DateFilterMode } from '../components/DateFilterBar';
import PrintButton from '../components/PrintButton';
import { buildPdfReport, downloadPdfReport, sharePdfReportOnWhatsApp } from '../services/pdfReport';

const rupees = (v: any) => `Rs ${Number(v || 0).toLocaleString('en-IN')}`;
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('en-IN');
const todayIso = () => new Date().toISOString().split('T')[0];
const monthLabel = (period: string) => {
  const [year, month] = period.split('-');
  if (!month) return period;
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[parseInt(month) - 1]} ${year}`;
};

const PIE_COLORS = ['#8c0f16', '#cb202d', '#e23744', '#f2787d', '#f8b9bb', '#8c7576'];

export default function Overview() {
  const [summary, setSummary] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [mode, setMode] = useState<DateFilterMode>('all');
  const [date, setDate] = useState(todayIso());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = (m = mode, d = date, f = from, t = to) => {
    setLoading(true);
    const [qFrom, qTo] = m === 'single' ? [d, d] : m === 'range' || m === 'month' ? [f, t] : [undefined, undefined];
    Promise.all([accountsApi.getTotalSummary(qFrom, qTo), adminApi.getAnalytics(qFrom, qTo)])
      .then(([s, a]) => {
        setSummary(s);
        setAnalytics(a);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rangeTitle =
    mode === 'single' ? dateLabel(date) : mode === 'month' ? monthLabel(date.slice(0, 7)) : mode === 'range' ? `${dateLabel(from)} to ${dateLabel(to)}` : 'Lifetime';

  if (loading) return <div className="empty-note">Loading overview…</div>;

  const profitPositive = Number(summary?.profit || 0) >= 0;
  const monthlyTrend = (summary?.monthly || []).slice(-6).map((m: any) => ({
    name: monthLabel(m.period),
    Revenue: Number(m.revenue),
    Expenses: Number(m.expenses),
  }));
  const siteExpenses = (analytics?.siteWiseExpenseBreakdown || [])
    .filter((s: any) => Number(s.total_expenses) > 0)
    .map((s: any) => ({ name: s.site_name, value: Number(s.total_expenses) }));
  const leadsChannel = analytics?.leadsChannelPerformance || [];

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const { doc, filename } = await buildPdfReport({
        filename: `company-overview-${mode === 'all' ? 'lifetime' : `${from}-to-${to}`}.pdf`,
        title: 'Company Financial Overview',
        subtitle: `Company-wide financial picture — Owner, Admin and Supervisor books combined • ${rangeTitle}`,
        summaryBoxes: [
          { label: 'Revenue', value: rupees(summary?.revenue), color: '#15803d' },
          { label: 'Expenses', value: rupees(summary?.expenses), color: '#e23744' },
          { label: profitPositive ? 'Profit' : 'Loss', value: rupees(Math.abs(Number(summary?.profit || 0))) },
        ],
        tables: [
          {
            title: 'Cash in Hand (By Role)',
            head: ['Role', 'Received (Rs)', 'Paid (Rs)', 'Balance (Rs)'],
            body: (summary?.roleBalances || []).map((r: any) => [
              r.role,
              Number(r.totalIn).toLocaleString('en-IN'),
              Number(r.totalOut).toLocaleString('en-IN'),
              Number(r.balance).toLocaleString('en-IN'),
            ]),
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
          },
          {
            title: 'Site-wise Expenses Breakdown',
            head: ['Site', 'Material', 'Fuel', 'Petty Cash', 'Total Expenses (Rs)'],
            body: (analytics?.siteWiseExpenseBreakdown || []).map((s: any) => [
              s.site_name,
              Number(s.material_costs || 0).toLocaleString('en-IN'),
              Number(s.fuel_costs || 0).toLocaleString('en-IN'),
              Number(s.petty_cash_costs || 0).toLocaleString('en-IN'),
              Number(s.total_expenses || 0).toLocaleString('en-IN'),
            ]),
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
          },
        ],
      });
      await downloadPdfReport({ doc, filename });
    } finally {
      setDownloading(false);
    }
  };

  const handleShareWhatsApp = async () => {
    setDownloading(true);
    try {
      const pdf = await buildPdfReport({
        filename: `company-overview-${mode === 'all' ? 'lifetime' : `${from}-to-${to}`}.pdf`,
        title: 'Company Financial Overview',
        subtitle: `Company-wide financial picture — Owner, Admin and Supervisor books combined • ${rangeTitle}`,
        summaryBoxes: [
          { label: 'Revenue', value: rupees(summary?.revenue), color: '#15803d' },
          { label: 'Expenses', value: rupees(summary?.expenses), color: '#e23744' },
          { label: profitPositive ? 'Profit' : 'Loss', value: rupees(Math.abs(Number(summary?.profit || 0))) },
        ],
        tables: [
          {
            title: 'Cash in Hand (By Role)',
            head: ['Role', 'Received (Rs)', 'Paid (Rs)', 'Balance (Rs)'],
            body: (summary?.roleBalances || []).map((r: any) => [
              r.role,
              Number(r.totalIn).toLocaleString('en-IN'),
              Number(r.totalOut).toLocaleString('en-IN'),
              Number(r.balance).toLocaleString('en-IN'),
            ]),
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
          },
          {
            title: 'Site-wise Expenses Breakdown',
            head: ['Site', 'Material', 'Fuel', 'Petty Cash', 'Total Expenses (Rs)'],
            body: (analytics?.siteWiseExpenseBreakdown || []).map((s: any) => [
              s.site_name,
              Number(s.material_costs || 0).toLocaleString('en-IN'),
              Number(s.fuel_costs || 0).toLocaleString('en-IN'),
              Number(s.petty_cash_costs || 0).toLocaleString('en-IN'),
              Number(s.total_expenses || 0).toLocaleString('en-IN'),
            ]),
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
          },
        ],
      });
      const text = `Ayyanar Construction — Overview Report (${rangeTitle})\nRevenue: ${rupees(summary?.revenue)}\nExpenses: ${rupees(summary?.expenses)}\n${profitPositive ? 'Profit' : 'Loss'}: ${rupees(Math.abs(Number(summary?.profit || 0)))}`;
      await sharePdfReportOnWhatsApp(pdf, text);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Overview</h1>
      <p className="page-subtitle">Company-wide financial picture — Owner, Admin and Supervisor books combined.</p>

      <DateFilterBar
        enableMonth
        mode={mode}
        onModeChange={(m) => { setMode(m); load(m, date, from, to); }}
        date={date}
        onDateChange={(d) => { setDate(d); if (mode !== 'month') load('single', d, from, to); }}
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onApplyRange={(f = from, t = to) => { setFrom(f); setTo(t); load(mode === 'month' ? 'month' : 'range', date, f, t); }}
      />

      <div className="toolbar no-print" style={{ justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn" onClick={handleDownloadPdf} disabled={downloading}>
          <Download size={16} />
          {downloading ? 'Building PDF…' : 'Download PDF'}
        </button>
        <button className="btn whatsapp" onClick={handleShareWhatsApp} disabled={downloading}>
          <Share2 size={16} />
          Share on WhatsApp
        </button>
        <PrintButton />
      </div>

      <div className="summary-row">
        <SummaryCard label={`Revenue (${rangeTitle})`} value={rupees(summary?.revenue)} color="#15803d" icon={TrendingUp} />
        <SummaryCard label={`Expenses (${rangeTitle})`} value={rupees(summary?.expenses)} color="#e23744" icon={TrendingDown} />
      </div>

      <div className="hero-card" style={{ background: profitPositive ? '#15803d' : '#cb202d' }}>
        <div>
          <div className="hero-label">{profitPositive ? 'Profit' : 'Loss'} — {rangeTitle}</div>
          <div className="hero-value">{rupees(Math.abs(Number(summary?.profit || 0)))}</div>
        </div>
        <Wallet size={34} strokeWidth={1.8} />
      </div>

      {monthlyTrend.length > 0 && (
        <div className="card">
          <h3 className="section-heading">Revenue vs Expenses — Last 6 Months{mode !== 'all' ? ' (Lifetime Trend)' : ''}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1dede" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: any) => rupees(v)} />
              <Legend />
              <Bar dataKey="Revenue" fill="#15803d" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expenses" fill="#e23744" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card">
        <h3 className="section-heading">Cash in Hand (By Role)</h3>
        <DataTable<any>
          rowKey={(r) => r.role}
          rows={summary?.roleBalances || []}
          emptyText="No role balances yet."
          columns={[
            { header: 'Role', render: (r) => r.role },
            { header: 'Received', align: 'right', render: (r) => <span className="text-success">{rupees(r.totalIn)}</span> },
            { header: 'Paid', align: 'right', render: (r) => <span className="text-primary">{rupees(r.totalOut)}</span> },
            { header: 'Balance', align: 'right', render: (r) => <b>{rupees(r.balance)}</b> },
          ]}
        />
      </div>

      {siteExpenses.length > 0 && (
        <div className="card">
          <h3 className="section-heading">Site-wise Expense Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={siteExpenses} dataKey="value" nameKey="name" outerRadius={100} label={(d) => d.name}>
                {siteExpenses.map((_: any, i: number) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => rupees(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {leadsChannel.length > 0 && (
        <div className="card">
          <h3 className="section-heading">Leads Channel Performance</h3>
          <DataTable<any>
            rowKey={(r, i) => `${r.source}-${i}`}
            rows={leadsChannel}
            columns={[
              { header: 'Source', render: (r: any) => r.source || 'Unknown' },
              { header: 'Total Leads', align: 'right', render: (r: any) => r.total_leads },
              { header: 'Converted', align: 'right', render: (r: any) => r.converted_leads },
              {
                header: 'Conversion %',
                align: 'right',
                render: (r: any) => (r.total_leads > 0 ? `${Math.round((r.converted_leads / r.total_leads) * 100)}%` : '0%'),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
