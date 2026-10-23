import { useEffect, useState } from 'react';
import { ArrowUpRight, Banknote, Building2, CreditCard, Download, FileSpreadsheet, Share2, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { adminApi, fieldApi } from '../api';
import DataTable from '../components/DataTable';
import DateFilterBar, { DateFilterMode } from '../components/DateFilterBar';
import PrintButton from '../components/PrintButton';
import SelectField from '../components/SelectField';
import SummaryCard from '../components/SummaryCard';
import { buildPdfReport, downloadPdfReport, sharePdfReportOnWhatsApp } from '../services/pdfReport';

const rupees = (v: any) => `Rs ${Number(v || 0).toLocaleString('en-IN')}`;
const dateLabel = (iso: string) => (iso ? new Date(iso).toLocaleDateString('en-IN') : '—');
const dateInputValue = (iso: string) => (iso ? iso.toString().split('T')[0] : '');
const todayIso = () => new Date().toISOString().split('T')[0];

const PIE_COLORS = ['#e23744', '#8c7576', '#d97706', '#2563eb'];

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
  const [siteId, setSiteId] = useState<string>('all');
  const [reportData, setReportData] = useState<{
    site: any;
    isAllSites: boolean;
    summary: {
      directTotal: number;
      indirectTotal: number;
      dailySheetTotal: number;
      outputTotal: number;
      grandTotal: number;
    };
    directBills: any[];
    indirectBills: any[];
    dailySheets: any[];
    outputTransactions: any[];
    allSitesBreakdown: any[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Date filter — starts on "All Time"
  const [mode, setMode] = useState<DateFilterMode>('all');
  const [date, setDate] = useState(todayIso());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [editingBill, setEditingBill] = useState<EditForm | null>(null);
  const [savingBill, setSavingBill] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  useEffect(() => {
    adminApi.getSites().then((s) => {
      setSites(s);
    });
  }, []);

  const loadData = (m = mode, d = date, f = from, t = to, curSiteId = siteId) => {
    setLoading(true);
    const [qFrom, qTo] = m === 'single' ? [d, d] : m === 'range' ? [f, t] : [undefined, undefined];
    fieldApi
      .getSiteExpensesReport(curSiteId, undefined, qFrom, qTo)
      .then((data) => setReportData(data))
      .catch((err) => {
        console.error('Failed to load site report:', err);
      })
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadData(mode, date, from, to, siteId);
  }, [siteId]);

  const rangeLabel = mode === 'single' ? dateLabel(date) : mode === 'range' ? `${dateLabel(from)} to ${dateLabel(to)}` : 'All Time';

  const isAllSites = siteId === 'all';
  const currentSite = sites.find((s) => s.id.toString() === siteId);
  const siteDisplayName = isAllSites ? 'All Sites (Combined)' : currentSite?.name || 'Site';

  const summary = reportData?.summary || {
    directTotal: 0,
    indirectTotal: 0,
    dailySheetTotal: 0,
    outputTotal: 0,
    grandTotal: 0,
  };

  const directBills = reportData?.directBills || [];
  const indirectBills = reportData?.indirectBills || [];
  const dailySheets = reportData?.dailySheets || [];
  const outputTransactions = reportData?.outputTransactions || [];
  const allSitesBreakdown = reportData?.allSitesBreakdown || [];

  const compareChart = allSitesBreakdown
    .filter((s) => Number(s.total_expenses) > 0)
    .map((s) => ({
      name: s.site_name,
      'Direct Bills': Number(s.direct_bills || 0),
      'Indirect Bills': Number(s.indirect_bills || 0),
      'Output': Number(s.output_amount || 0),
      'Daily Sheet': Number(s.daily_sheet_amount || 0),
    }));

  const pieData = [
    { name: 'Direct Bills', value: summary.directTotal },
    { name: 'Indirect Bills', value: summary.indirectTotal },
    { name: 'Output', value: summary.outputTotal },
    { name: 'Daily Sheet', value: summary.dailySheetTotal },
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
      loadData();
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
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete this bill.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const summaryBoxes = [
        { label: 'Direct Bills', value: rupees(summary.directTotal), color: '#e23744' },
        { label: 'Indirect Bills', value: rupees(summary.indirectTotal), color: '#8c7576' },
        { label: 'Output (Account)', value: rupees(summary.outputTotal), color: '#d97706' },
        { label: 'Daily Sheet', value: rupees(summary.dailySheetTotal), color: '#2563eb' },
        { label: 'Grand Total', value: rupees(summary.grandTotal), color: '#15803d' },
      ];

      const tables: any[] = [];

      // If All Sites is chosen, include the All Sites Overview Table first
      if (isAllSites && allSitesBreakdown.length > 0) {
        tables.push({
          title: `All Sites Overview Breakdown (${allSitesBreakdown.length} sites)`,
          head: ['#', 'Site Name', 'Direct Bills (Rs)', 'Indirect Bills (Rs)', 'Output (Rs)', 'Daily Sheet (Rs)', 'Total Expenses (Rs)'],
          body: allSitesBreakdown.map((s, i) => [
            i + 1,
            s.site_name,
            Number(s.direct_bills || 0).toLocaleString('en-IN'),
            Number(s.indirect_bills || 0).toLocaleString('en-IN'),
            Number(s.output_amount || 0).toLocaleString('en-IN'),
            Number(s.daily_sheet_amount || 0).toLocaleString('en-IN'),
            Number(s.total_expenses || 0).toLocaleString('en-IN'),
          ]),
          foot: [
            '',
            'TOTAL',
            summary.directTotal.toLocaleString('en-IN'),
            summary.indirectTotal.toLocaleString('en-IN'),
            summary.outputTotal.toLocaleString('en-IN'),
            summary.dailySheetTotal.toLocaleString('en-IN'),
            summary.grandTotal.toLocaleString('en-IN'),
          ],
          columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
        });
      }

      // 1. Direct Bills Table
      tables.push({
        title: `Direct Cash Bills (${directBills.length})`,
        head: ['#', 'Date', ...(isAllSites ? ['Site'] : []), 'Supervisor', 'Category', 'Description', 'Amount (Rs)'],
        body: directBills.map((r, i) => [
          i + 1,
          dateLabel(r.date),
          ...(isAllSites ? [r.site_name || '-'] : []),
          r.supervisor_name || '-',
          r.category || '-',
          r.description || '-',
          Number(r.amount).toLocaleString('en-IN'),
        ]),
        foot: ['', ...(isAllSites ? [''] : []), '', '', '', 'TOTAL', summary.directTotal.toLocaleString('en-IN')],
        columnStyles: { [isAllSites ? 6 : 5]: { halign: 'right' } },
      });

      // 2. Indirect Bills Table
      tables.push({
        title: `Indirect / Credit Bills (${indirectBills.length})`,
        head: ['#', 'Date', ...(isAllSites ? ['Site'] : []), 'Supervisor', 'Category', 'Description', 'Amount (Rs)'],
        body: indirectBills.map((r, i) => [
          i + 1,
          dateLabel(r.date),
          ...(isAllSites ? [r.site_name || '-'] : []),
          r.supervisor_name || '-',
          r.category || '-',
          r.description || '-',
          Number(r.amount).toLocaleString('en-IN'),
        ]),
        foot: ['', ...(isAllSites ? [''] : []), '', '', '', 'TOTAL', summary.indirectTotal.toLocaleString('en-IN')],
        columnStyles: { [isAllSites ? 6 : 5]: { halign: 'right' } },
      });

      // 3. Output Table
      tables.push({
        title: `Output Expenses — Account Out (${outputTransactions.length})`,
        head: ['#', 'Date', ...(isAllSites ? ['Site'] : []), 'Entered By', 'Category', 'Payment Mode', 'Description / Party', 'Amount (Rs)'],
        body: outputTransactions.map((r, i) => [
          i + 1,
          dateLabel(r.date),
          ...(isAllSites ? [r.site_name || r.party_name || '-'] : []),
          r.entered_by_name || r.role || '-',
          r.category || '-',
          r.payment_method || 'Cash',
          r.description || r.party_name || '-',
          Number(r.amount).toLocaleString('en-IN'),
        ]),
        foot: ['', ...(isAllSites ? [''] : []), '', '', '', '', 'TOTAL', summary.outputTotal.toLocaleString('en-IN')],
        columnStyles: { [isAllSites ? 7 : 6]: { halign: 'right' } },
      });

      // 4. Daily Sheets Table
      tables.push({
        title: `Daily Sheet Expenses (${dailySheets.length})`,
        head: ['#', 'Date', ...(isAllSites ? ['Site'] : []), 'Supervisor', 'Work Description', 'Labour Salary (Rs)', 'Vehicle (Rs)', 'Total Amount (Rs)'],
        body: dailySheets.map((r, i) => [
          i + 1,
          dateLabel(r.date),
          ...(isAllSites ? [r.site_name || '-'] : []),
          r.supervisor_name || '-',
          r.work_description || '-',
          Number(r.labour_salary_total || 0).toLocaleString('en-IN'),
          Number(r.vehicle_rental || 0).toLocaleString('en-IN'),
          Number(r.total_amount || 0).toLocaleString('en-IN'),
        ]),
        foot: ['', ...(isAllSites ? [''] : []), '', '', '', '', 'TOTAL', summary.dailySheetTotal.toLocaleString('en-IN')],
        columnStyles: { [isAllSites ? 7 : 6]: { halign: 'right' } },
      });

      const { doc, filename } = await buildPdfReport({
        filename: `site-expenses-${isAllSites ? 'all-sites' : currentSite?.name || siteId}.pdf`,
        title: 'Site Expenses Report',
        subtitle: `${siteDisplayName} — ${rangeLabel}`,
        summaryBoxes,
        tables,
      });
      await downloadPdfReport({ doc, filename });
    } finally {
      setDownloading(false);
    }
  };

  const handleShareWhatsApp = async () => {
    setDownloading(true);
    try {
      const summaryBoxes = [
        { label: 'Direct Bills', value: rupees(summary.directTotal), color: '#e23744' },
        { label: 'Indirect Bills', value: rupees(summary.indirectTotal), color: '#8c7576' },
        { label: 'Output (Account)', value: rupees(summary.outputTotal), color: '#d97706' },
        { label: 'Daily Sheet', value: rupees(summary.dailySheetTotal), color: '#2563eb' },
        { label: 'Grand Total', value: rupees(summary.grandTotal), color: '#15803d' },
      ];

      const tables: any[] = [];
      if (isAllSites && allSitesBreakdown.length > 0) {
        tables.push({
          title: `All Sites Overview Breakdown (${allSitesBreakdown.length} sites)`,
          head: ['#', 'Site Name', 'Direct Bills (Rs)', 'Indirect Bills (Rs)', 'Output (Rs)', 'Daily Sheet (Rs)', 'Total Expenses (Rs)'],
          body: allSitesBreakdown.map((s, i) => [
            i + 1,
            s.site_name,
            Number(s.direct_bills || 0).toLocaleString('en-IN'),
            Number(s.indirect_bills || 0).toLocaleString('en-IN'),
            Number(s.output_amount || 0).toLocaleString('en-IN'),
            Number(s.daily_sheet_amount || 0).toLocaleString('en-IN'),
            Number(s.total_expenses || 0).toLocaleString('en-IN'),
          ]),
          foot: [
            '',
            'TOTAL',
            summary.directTotal.toLocaleString('en-IN'),
            summary.indirectTotal.toLocaleString('en-IN'),
            summary.outputTotal.toLocaleString('en-IN'),
            summary.dailySheetTotal.toLocaleString('en-IN'),
            summary.grandTotal.toLocaleString('en-IN'),
          ],
          columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
        });
      }

      tables.push({
        title: `Direct Bills (${directBills.length})`,
        head: ['#', 'Date', ...(isAllSites ? ['Site'] : []), 'Supervisor', 'Category', 'Description', 'Amount (Rs)'],
        body: directBills.map((r, i) => [
          i + 1,
          dateLabel(r.date),
          ...(isAllSites ? [r.site_name || '-'] : []),
          r.supervisor_name || '-',
          r.category || '-',
          r.description || '-',
          Number(r.amount).toLocaleString('en-IN'),
        ]),
        foot: ['', ...(isAllSites ? [''] : []), '', '', '', 'TOTAL', summary.directTotal.toLocaleString('en-IN')],
        columnStyles: { [isAllSites ? 6 : 5]: { halign: 'right' } },
      });

      tables.push({
        title: `Indirect / Credit Bills (${indirectBills.length})`,
        head: ['#', 'Date', ...(isAllSites ? ['Site'] : []), 'Supervisor', 'Category', 'Description', 'Amount (Rs)'],
        body: indirectBills.map((r, i) => [
          i + 1,
          dateLabel(r.date),
          ...(isAllSites ? [r.site_name || '-'] : []),
          r.supervisor_name || '-',
          r.category || '-',
          r.description || '-',
          Number(r.amount).toLocaleString('en-IN'),
        ]),
        foot: ['', ...(isAllSites ? [''] : []), '', '', '', 'TOTAL', summary.indirectTotal.toLocaleString('en-IN')],
        columnStyles: { [isAllSites ? 6 : 5]: { halign: 'right' } },
      });

      tables.push({
        title: `Output Expenses — Account Out (${outputTransactions.length})`,
        head: ['#', 'Date', ...(isAllSites ? ['Site'] : []), 'Entered By', 'Category', 'Payment Mode', 'Description / Party', 'Amount (Rs)'],
        body: outputTransactions.map((r, i) => [
          i + 1,
          dateLabel(r.date),
          ...(isAllSites ? [r.site_name || r.party_name || '-'] : []),
          r.entered_by_name || r.role || '-',
          r.category || '-',
          r.payment_method || 'Cash',
          r.description || r.party_name || '-',
          Number(r.amount).toLocaleString('en-IN'),
        ]),
        foot: ['', ...(isAllSites ? [''] : []), '', '', '', '', 'TOTAL', summary.outputTotal.toLocaleString('en-IN')],
        columnStyles: { [isAllSites ? 7 : 6]: { halign: 'right' } },
      });

      tables.push({
        title: `Daily Sheet Expenses (${dailySheets.length})`,
        head: ['#', 'Date', ...(isAllSites ? ['Site'] : []), 'Supervisor', 'Work Description', 'Labour Salary (Rs)', 'Vehicle (Rs)', 'Total Amount (Rs)'],
        body: dailySheets.map((r, i) => [
          i + 1,
          dateLabel(r.date),
          ...(isAllSites ? [r.site_name || '-'] : []),
          r.supervisor_name || '-',
          r.work_description || '-',
          Number(r.labour_salary_total || 0).toLocaleString('en-IN'),
          Number(r.vehicle_rental || 0).toLocaleString('en-IN'),
          Number(r.total_amount || 0).toLocaleString('en-IN'),
        ]),
        foot: ['', ...(isAllSites ? [''] : []), '', '', '', '', 'TOTAL', summary.dailySheetTotal.toLocaleString('en-IN')],
        columnStyles: { [isAllSites ? 7 : 6]: { halign: 'right' } },
      });

      const pdf = await buildPdfReport({
        filename: `site-expenses-${isAllSites ? 'all-sites' : currentSite?.name || siteId}.pdf`,
        title: 'Site Expenses Report',
        subtitle: `${siteDisplayName} — ${rangeLabel}`,
        summaryBoxes,
        tables,
      });

      const summaryText =
        `*Site Expenses Report: ${siteDisplayName}*\n` +
        `Period: ${rangeLabel}\n` +
        `Direct Bills: ${rupees(summary.directTotal)}\n` +
        `Indirect Bills: ${rupees(summary.indirectTotal)}\n` +
        `Output (Account): ${rupees(summary.outputTotal)}\n` +
        `Daily Sheet: ${rupees(summary.dailySheetTotal)}\n` +
        `*Grand Total: ${rupees(summary.grandTotal)}*`;

      await sharePdfReportOnWhatsApp(pdf, summaryText);
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

  const siteOptions = [
    { value: 'all', label: 'All Sites (Combined)' },
    ...sites.map((s) => ({ value: s.id.toString(), label: s.name })),
  ];

  return (
    <div>
      <h1 className="page-title">Site Expense Reports</h1>
      <p className="page-subtitle">
        Comprehensive site-wise report covering Direct Bills, Indirect Bills, Output (Account Out), and Daily Sheets.
      </p>

      {compareChart.length > 0 && (
        <div className="card">
          <h3 className="section-heading">All Sites — Expense Comparison (Direct, Indirect, Output, Daily Sheet)</h3>
          <ResponsiveContainer width="100%" height={290}>
            <BarChart data={compareChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1dede" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: any) => rupees(v)} />
              <Legend />
              <Bar dataKey="Direct Bills" stackId="a" fill="#e23744" />
              <Bar dataKey="Indirect Bills" stackId="a" fill="#8c7576" />
              <Bar dataKey="Output" stackId="a" fill="#d97706" />
              <Bar dataKey="Daily Sheet" stackId="a" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <h3 className="section-heading" style={{ marginTop: 12 }}>Filter & Site Selection</h3>
      <div className="filter-row">
        <SelectField
          label="SITE"
          value={siteId}
          onChange={(v) => {
            setSiteId(v);
            loadData(mode, date, from, to, v);
          }}
          options={siteOptions}
        />
      </div>

      <DateFilterBar
        mode={mode}
        onModeChange={(m) => {
          setMode(m);
          loadData(m, date, from, to, siteId);
        }}
        date={date}
        onDateChange={(d) => {
          setDate(d);
          loadData('single', d, from, to, siteId);
        }}
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onApplyRange={(f = from, t = to) => {
          setFrom(f);
          setTo(t);
          loadData('range', date, f, t, siteId);
        }}
      />
      <p className="text-muted" style={{ fontSize: 12.5, margin: '-6px 0 18px' }}>
        Showing: <b>{siteDisplayName}</b> — {rangeLabel}
      </p>

      {loading ? (
        <div className="empty-note">Loading site expenses…</div>
      ) : (
        <>
          <div className="summary-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <SummaryCard label="Direct Bills" value={rupees(summary.directTotal)} color="#e23744" icon={Banknote} />
            <SummaryCard label="Indirect Bills" value={rupees(summary.indirectTotal)} color="#8c7576" icon={CreditCard} />
            <SummaryCard label="Output (Account)" value={rupees(summary.outputTotal)} color="#d97706" icon={ArrowUpRight} />
            <SummaryCard label="Daily Sheet" value={rupees(summary.dailySheetTotal)} color="#2563eb" icon={FileSpreadsheet} />
            <SummaryCard label="Grand Total" value={rupees(summary.grandTotal)} color="#15803d" icon={Wallet} />
          </div>

          <div className="toolbar no-print" style={{ justifyContent: 'flex-end', marginTop: 12, marginBottom: 16 }}>
            <button
              className="btn"
              onClick={handleDownload}
              disabled={downloading || summary.grandTotal === 0}
            >
              <Download size={16} />
              {downloading ? 'Building PDF…' : isAllSites ? 'Download All Sites PDF' : 'Download Site PDF'}
            </button>
            <button
              className="btn whatsapp"
              onClick={handleShareWhatsApp}
              disabled={downloading || summary.grandTotal === 0}
            >
              <Share2 size={16} />
              Share on WhatsApp
            </button>
            <PrintButton />
          </div>

          {pieData.length > 0 && (
            <div className="card">
              <h3 className="section-heading">Expense Breakdown by Category — {siteDisplayName}</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label={(d) => `${d.name}: ${rupees(d.value)}`}>
                    {pieData.map((entry, index) => {
                      const colMap: Record<string, string> = {
                        'Direct Bills': '#e23744',
                        'Indirect Bills': '#8c7576',
                        'Output': '#d97706',
                        'Daily Sheet': '#2563eb',
                      };
                      return <Cell key={`cell-${index}`} fill={colMap[entry.name] || PIE_COLORS[index % PIE_COLORS.length]} />;
                    })}
                  </Pie>
                  <Tooltip formatter={(v: any) => rupees(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* If All Sites is selected, show the All Sites Matrix Table */}
          {isAllSites && allSitesBreakdown.length > 0 && (
            <div className="card">
              <h3 className="section-heading">
                <Building2 size={18} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 6 }} />
                All Sites — Expenses Summary Matrix ({allSitesBreakdown.length} sites)
              </h3>
              <DataTable<any>
                rowKey={(r) => r.site_id}
                rows={allSitesBreakdown}
                emptyText="No sites found."
                totalRow={[
                  'TOTAL',
                  summary.directTotal ? rupees(summary.directTotal) : '—',
                  summary.indirectTotal ? rupees(summary.indirectTotal) : '—',
                  summary.outputTotal ? rupees(summary.outputTotal) : '—',
                  summary.dailySheetTotal ? rupees(summary.dailySheetTotal) : '—',
                  rupees(summary.grandTotal),
                ]}
                columns={[
                  {
                    header: 'Site Name',
                    render: (r: any) => (
                      <div>
                        <b>{r.site_name}</b>
                        {r.location && <div style={{ fontSize: 11, color: '#888' }}>{r.location}</div>}
                      </div>
                    ),
                  },
                  { header: 'Direct Bills', align: 'right', render: (r: any) => (r.direct_bills ? rupees(r.direct_bills) : '—') },
                  { header: 'Indirect Bills', align: 'right', render: (r: any) => (r.indirect_bills ? rupees(r.indirect_bills) : '—') },
                  { header: 'Output (Account)', align: 'right', render: (r: any) => (r.output_amount ? rupees(r.output_amount) : '—') },
                  { header: 'Daily Sheet', align: 'right', render: (r: any) => (r.daily_sheet_amount ? rupees(r.daily_sheet_amount) : '—') },
                  {
                    header: 'Total Expenses',
                    align: 'right',
                    render: (r: any) => <b style={{ color: '#15803d' }}>{rupees(r.total_expenses)}</b>,
                  },
                ]}
              />
            </div>
          )}

          {/* Section 1: Direct Bills */}
          <div className="card">
            <h3 className="section-heading">
              <Banknote size={18} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 6 }} />
              Direct Cash Bills ({directBills.length}) — Total: {rupees(summary.directTotal)}
            </h3>
            <DataTable<any>
              rowKey={(r) => r.id}
              rows={directBills}
              emptyText="No direct bills found for this selection."
              totalRow={[
                'TOTAL',
                ...(isAllSites ? [''] : []),
                '',
                '',
                '',
                rupees(summary.directTotal),
                '',
              ]}
              columns={[
                { header: 'Date', render: (r: any) => dateLabel(r.date) },
                ...(isAllSites ? [{ header: 'Site', render: (r: any) => r.site_name || '—' }] : []),
                { header: 'Supervisor', render: (r: any) => r.supervisor_name || '—' },
                { header: 'Category', render: (r: any) => r.category || '—' },
                { header: 'Description', render: (r: any) => r.description || '—' },
                { header: 'Amount', align: 'right', render: (r: any) => rupees(r.amount) },
                actionsColumn,
              ]}
            />
          </div>

          {/* Section 2: Indirect Bills */}
          <div className="card">
            <h3 className="section-heading">
              <CreditCard size={18} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 6 }} />
              Indirect / Credit Bills ({indirectBills.length}) — Total: {rupees(summary.indirectTotal)}
            </h3>
            <DataTable<any>
              rowKey={(r) => r.id}
              rows={indirectBills}
              emptyText="No indirect credit bills found for this selection."
              totalRow={[
                'TOTAL',
                ...(isAllSites ? [''] : []),
                '',
                '',
                '',
                rupees(summary.indirectTotal),
                '',
              ]}
              columns={[
                { header: 'Date', render: (r: any) => dateLabel(r.date) },
                ...(isAllSites ? [{ header: 'Site', render: (r: any) => r.site_name || '—' }] : []),
                { header: 'Supervisor', render: (r: any) => r.supervisor_name || '—' },
                { header: 'Category', render: (r: any) => r.category || '—' },
                { header: 'Description', render: (r: any) => r.description || '—' },
                { header: 'Amount', align: 'right', render: (r: any) => rupees(r.amount) },
                actionsColumn,
              ]}
            />
          </div>

          {/* Section 3: Output Transactions (Accounts Module Out) */}
          <div className="card">
            <h3 className="section-heading">
              <ArrowUpRight size={18} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 6 }} />
              Output Expenses — Account Out ({outputTransactions.length}) — Total: {rupees(summary.outputTotal)}
            </h3>
            <p className="text-muted" style={{ fontSize: 12.5, marginTop: -6, marginBottom: 12 }}>
              Money paid out through accounts for this site (materials, advances, site expense outputs).
            </p>
            <DataTable<any>
              rowKey={(r) => r.id}
              rows={outputTransactions}
              emptyText="No output transactions found for this selection."
              totalRow={[
                'TOTAL',
                ...(isAllSites ? [''] : []),
                '',
                '',
                '',
                '',
                rupees(summary.outputTotal),
              ]}
              columns={[
                { header: 'Date', render: (r: any) => dateLabel(r.date) },
                ...(isAllSites ? [{ header: 'Site', render: (r: any) => r.site_name || r.party_name || '—' }] : []),
                { header: 'Entered By', render: (r: any) => r.entered_by_name || r.role || '—' },
                { header: 'Category', render: (r: any) => r.category || '—' },
                { header: 'Mode', render: (r: any) => r.payment_method || 'Cash' },
                { header: 'Description / Party', render: (r: any) => r.description || r.party_name || '—' },
                { header: 'Amount', align: 'right', render: (r: any) => <span className="text-primary">{rupees(r.amount)}</span> },
              ]}
            />
          </div>

          {/* Section 4: Daily Sheet Expenses */}
          <div className="card">
            <h3 className="section-heading">
              <FileSpreadsheet size={18} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 6 }} />
              Daily Sheet Expenses ({dailySheets.length}) — Total: {rupees(summary.dailySheetTotal)}
            </h3>
            <p className="text-muted" style={{ fontSize: 12.5, marginTop: -6, marginBottom: 12 }}>
              Expenses submitted via supervisor daily site sheets (salary, bills, vehicle rentals).
            </p>
            <DataTable<any>
              rowKey={(r) => r.id}
              rows={dailySheets}
              emptyText="No daily sheets found for this selection."
              totalRow={[
                'TOTAL',
                ...(isAllSites ? [''] : []),
                '',
                '',
                '',
                '',
                rupees(summary.dailySheetTotal),
              ]}
              columns={[
                { header: 'Date', render: (r: any) => dateLabel(r.date) },
                ...(isAllSites ? [{ header: 'Site', render: (r: any) => r.site_name || '—' }] : []),
                { header: 'Supervisor', render: (r: any) => r.supervisor_name || '—' },
                { header: 'Work Description', render: (r: any) => r.work_description || '—' },
                { header: 'Labour Salary', align: 'right', render: (r: any) => rupees(r.labour_salary_total) },
                { header: 'Vehicle Rental', align: 'right', render: (r: any) => rupees(r.vehicle_rental) },
                { header: 'Total Amount', align: 'right', render: (r: any) => <b style={{ color: '#2563eb' }}>{rupees(r.total_amount)}</b> },
              ]}
            />
          </div>
        </>
      )}

      {editingBill && (
        <div className="modal-backdrop" onClick={() => !savingBill && setEditingBill(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Bill</h3>
            <div className="sub">{siteDisplayName}</div>

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
              {(['Direct', 'Indirect'] as const).map((paymentModeOption) => (
                <button
                  key={paymentModeOption}
                  type="button"
                  className={`chip${editingBill.paymentMode === paymentModeOption ? ' active' : ''}`}
                  onClick={() => setEditingBill({ ...editingBill, paymentMode: paymentModeOption })}
                >
                  {paymentModeOption === 'Direct' ? 'Direct (Cash)' : 'Indirect (Credit)'}
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
