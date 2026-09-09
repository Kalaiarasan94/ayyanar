import { useEffect, useState } from 'react';
import { Banknote, CreditCard, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { adminApi, fieldApi } from '../api';
import DataTable from '../components/DataTable';
import SummaryCard from '../components/SummaryCard';
import { buildPdfReport, downloadPdfReport } from '../services/pdfReport';

const rupees = (v: any) => `Rs ${Number(v || 0).toLocaleString('en-IN')}`;
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('en-IN');
const dateInputValue = (iso: string) => (iso ? iso.toString().split('T')[0] : '');

type EditForm = {
  id: string | number;
  category: string;
  description: string;
  amount: string;
  paymentMode: 'Direct' | 'Indirect';
  date: string;
};

export default function SiteReports() {
  const [sites, setSites] = useState<any[]>([]);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [allSitesBreakdown, setAllSitesBreakdown] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const [editingBill, setEditingBill] = useState<EditForm | null>(null);
  const [savingBill, setSavingBill] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  useEffect(() => {
    adminApi.getSites().then((s) => {
      setSites(s);
      if (s.length > 0) setSiteId(s[0].id.toString());
    });
    adminApi.getAnalytics().then((a) => setAllSitesBreakdown(a?.siteWiseExpenseBreakdown || []));
  }, []);

  const loadRows = () => {
    if (!siteId) return;
    setLoading(true);
    fieldApi
      .getLedgerBySite(siteId)
      .then(setRows)
      .finally(() => setLoading(false));
  };

  useEffect(loadRows, [siteId]);

  const site = sites.find((s) => s.id.toString() === siteId);
  const direct = rows.filter((r) => r.payment_mode === 'Direct');
  const indirect = rows.filter((r) => r.payment_mode !== 'Direct');
  const directTotal = direct.reduce((s, r) => s + Number(r.amount), 0);
  const indirectTotal = indirect.reduce((s, r) => s + Number(r.amount), 0);

  const compareChart = allSitesBreakdown
    .filter((s) => Number(s.total_expenses) > 0)
    .map((s) => ({
      name: s.site_name,
      Material: Number(s.material_costs || 0),
      Fuel: Number(s.fuel_costs || 0),
      'Petty Cash': Number(s.petty_cash_costs || 0),
    }));
  const pieData = [
    { name: 'Direct', value: directTotal },
    { name: 'Indirect', value: indirectTotal },
  ].filter((d) => d.value > 0);

  const openEdit = (r: any) => {
    setEditingBill({
      id: r.id,
      category: r.category || '',
      description: r.description || '',
      amount: String(r.amount ?? ''),
      paymentMode: r.payment_mode === 'Direct' ? 'Direct' : 'Indirect',
      date: dateInputValue(r.date),
    });
  };

  const handleSaveEdit = async () => {
    if (!editingBill) return;
    if (!editingBill.category.trim() || !editingBill.amount || !editingBill.date) {
      alert('Category, amount and date are required.');
      return;
    }
    setSavingBill(true);
    try {
      await fieldApi.updateExpense(editingBill.id, {
        category: editingBill.category.trim(),
        description: editingBill.description.trim(),
        amount: Number(editingBill.amount),
        paymentMode: editingBill.paymentMode,
        date: editingBill.date,
      });
      setEditingBill(null);
      loadRows();
    } catch (err: any) {
      alert(err?.message || 'Failed to save changes.');
    } finally {
      setSavingBill(false);
    }
  };

  const handleDelete = async (r: any) => {
    if (!confirm(`Delete this ${r.payment_mode === 'Direct' ? 'direct' : 'indirect'} bill (${rupees(r.amount)})? This cannot be undone.`)) return;
    setDeletingId(r.id);
    try {
      await fieldApi.deleteExpense(r.id);
      loadRows();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete this bill.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { doc, filename } = await buildPdfReport({
        filename: `site-expenses-${site?.name || siteId}.pdf`,
        title: 'Site Expenses Report',
        subtitle: site?.name || 'Site',
        summaryBoxes: [
          { label: 'Direct', value: rupees(directTotal), color: '#e23744' },
          { label: 'Indirect', value: rupees(indirectTotal) },
          { label: 'Grand Total', value: rupees(directTotal + indirectTotal), color: '#15803d' },
        ],
        tables: [
          {
            title: `Direct Bills (${direct.length})`,
            head: ['#', 'Date', 'Supervisor', 'Category', 'Description', 'Amount (Rs)'],
            body: direct.map((r, i) => [i + 1, dateLabel(r.date), r.supervisor_name || '-', r.category || '-', r.description || '-', Number(r.amount).toLocaleString('en-IN')]),
            foot: ['', '', '', '', 'TOTAL', directTotal.toLocaleString('en-IN')],
          },
          {
            title: `Indirect / Credit Bills (${indirect.length})`,
            head: ['#', 'Date', 'Supervisor', 'Category', 'Description', 'Amount (Rs)'],
            body: indirect.map((r, i) => [i + 1, dateLabel(r.date), r.supervisor_name || '-', r.category || '-', r.description || '-', Number(r.amount).toLocaleString('en-IN')]),
            foot: ['', '', '', '', 'TOTAL', indirectTotal.toLocaleString('en-IN')],
          },
        ],
      });
      await downloadPdfReport({ doc, filename });
    } finally {
      setDownloading(false);
    }
  };

  const actionsColumn = {
    header: '',
    align: 'right' as const,
    render: (r: any) => (
      <div className="row-actions">
        <button className="icon-btn" onClick={() => openEdit(r)}>
          Edit
        </button>
        <button className="icon-btn danger" onClick={() => handleDelete(r)} disabled={deletingId === r.id}>
          {deletingId === r.id ? '…' : 'Delete'}
        </button>
      </div>
    ),
  };

  return (
    <div>
      <h1 className="page-title">Site Expense Reports</h1>
      <p className="page-subtitle">Compare every site at a glance, then drill into one for the full breakdown.</p>

      {compareChart.length > 0 && (
        <div className="card">
          <h3 className="section-heading">All Sites — Expense Comparison</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={compareChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1dede" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: any) => rupees(v)} />
              <Legend />
              <Bar dataKey="Material" stackId="a" fill="#8c0f16" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Fuel" stackId="a" fill="#e23744" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Petty Cash" stackId="a" fill="#f2787d" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <h3 className="section-heading" style={{ marginTop: 8 }}>Site Detail</h3>
      <div className="chip-row" style={{ marginBottom: 18 }}>
        {sites.map((s) => (
          <button key={s.id} className={`chip${siteId === s.id.toString() ? ' active' : ''}`} onClick={() => setSiteId(s.id.toString())}>
            {s.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-note">Loading…</div>
      ) : (
        <>
          <div className="summary-row">
            <SummaryCard label="Direct" value={rupees(directTotal)} color="#e23744" icon={Banknote} />
            <SummaryCard label="Indirect" value={rupees(indirectTotal)} color="#8c7576" icon={CreditCard} />
            <SummaryCard label="Grand Total" value={rupees(directTotal + indirectTotal)} color="#15803d" icon={Wallet} />
          </div>

          <div className="toolbar">
            <button className="btn" onClick={handleDownload} disabled={downloading || rows.length === 0}>
              Download PDF
            </button>
          </div>

          {pieData.length > 0 && (
            <div className="card">
              <h3 className="section-heading">Direct vs Indirect — {site?.name}</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label={(d) => `${d.name}: ${rupees(d.value)}`}>
                    <Cell fill="#e23744" />
                    <Cell fill="#8c7576" />
                  </Pie>
                  <Tooltip formatter={(v: any) => rupees(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="card">
            <h3 className="section-heading">Direct Bills ({direct.length})</h3>
            <DataTable<any>
              rowKey={(r) => r.id}
              rows={direct}
              emptyText="No direct bills."
              columns={[
                { header: 'Date', render: (r: any) => dateLabel(r.date) },
                { header: 'Supervisor', render: (r: any) => r.supervisor_name || '—' },
                { header: 'Category', render: (r: any) => r.category || '—' },
                { header: 'Description', render: (r: any) => r.description || '—' },
                { header: 'Amount', align: 'right', render: (r: any) => rupees(r.amount) },
                actionsColumn,
              ]}
            />
          </div>

          <div className="card">
            <h3 className="section-heading">Indirect / Credit Bills ({indirect.length})</h3>
            <DataTable<any>
              rowKey={(r) => r.id}
              rows={indirect}
              emptyText="No indirect bills."
              columns={[
                { header: 'Date', render: (r: any) => dateLabel(r.date) },
                { header: 'Supervisor', render: (r: any) => r.supervisor_name || '—' },
                { header: 'Category', render: (r: any) => r.category || '—' },
                { header: 'Description', render: (r: any) => r.description || '—' },
                { header: 'Amount', align: 'right', render: (r: any) => rupees(r.amount) },
                actionsColumn,
              ]}
            />
          </div>
        </>
      )}

      {editingBill && (
        <div className="modal-backdrop" onClick={() => !savingBill && setEditingBill(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Bill</h3>
            <div className="sub">{site?.name}</div>

            <div className="field-label">Category</div>
            <input
              className="input"
              value={editingBill.category}
              onChange={(e) => setEditingBill({ ...editingBill, category: e.target.value })}
            />

            <div className="field-label">Description</div>
            <input
              className="input"
              value={editingBill.description}
              onChange={(e) => setEditingBill({ ...editingBill, description: e.target.value })}
            />

            <div className="field-label">Amount (Rs)</div>
            <input
              className="input"
              type="number"
              value={editingBill.amount}
              onChange={(e) => setEditingBill({ ...editingBill, amount: e.target.value })}
            />

            <div className="field-label">Payment Mode</div>
            <div className="chip-row">
              {(['Direct', 'Indirect'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`chip${editingBill.paymentMode === mode ? ' active' : ''}`}
                  onClick={() => setEditingBill({ ...editingBill, paymentMode: mode })}
                >
                  {mode === 'Direct' ? 'Direct (Cash)' : 'Indirect (Credit)'}
                </button>
              ))}
            </div>

            <div className="field-label">Date</div>
            <input
              className="input"
              type="date"
              value={editingBill.date}
              onChange={(e) => setEditingBill({ ...editingBill, date: e.target.value })}
            />

            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setEditingBill(null)} disabled={savingBill}>
                Cancel
              </button>
              <button className="btn" onClick={handleSaveEdit} disabled={savingBill}>
                {savingBill ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
