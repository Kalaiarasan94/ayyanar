import { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react';
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

const rupees = (v: any) => `Rs ${Number(v || 0).toLocaleString('en-IN')}`;
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

  useEffect(() => {
    Promise.all([accountsApi.getTotalSummary(), adminApi.getAnalytics()])
      .then(([s, a]) => {
        setSummary(s);
        setAnalytics(a);
      })
      .finally(() => setLoading(false));
  }, []);

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

  return (
    <div>
      <h1 className="page-title">Overview</h1>
      <p className="page-subtitle">Company-wide financial picture — Owner, Admin and Supervisor books combined.</p>

      <div className="summary-row">
        <SummaryCard label="Revenue (Lifetime)" value={rupees(summary?.revenue)} color="#15803d" icon={TrendingUp} />
        <SummaryCard label="Expenses (Lifetime)" value={rupees(summary?.expenses)} color="#e23744" icon={TrendingDown} />
      </div>

      <div className="hero-card" style={{ background: profitPositive ? '#15803d' : '#cb202d' }}>
        <div>
          <div className="hero-label">{profitPositive ? 'Profit' : 'Loss'} — Lifetime</div>
          <div className="hero-value">{rupees(Math.abs(Number(summary?.profit || 0)))}</div>
        </div>
        <Wallet size={34} strokeWidth={1.8} />
      </div>

      {monthlyTrend.length > 0 && (
        <div className="card">
          <h3 className="section-heading">Revenue vs Expenses — Last 6 Months</h3>
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
