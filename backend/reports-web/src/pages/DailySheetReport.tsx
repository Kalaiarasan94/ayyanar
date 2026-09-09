import { useEffect, useState } from 'react';
import { Banknote, Download, FileSpreadsheet, FileText, Share2, Users, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { adminApi } from '../api';
import DataTable from '../components/DataTable';
import SummaryCard from '../components/SummaryCard';
import { buildPdfReport, buildSingleDailySheetPdfDoc, downloadPdfReport, sharePdfReportOnWhatsApp } from '../services/pdfReport';
import { csvCell, exportCsv } from '../services/printReport';

const rupees = (v: any) => `Rs ${Number(v || 0).toLocaleString('en-IN')}`;
const dateLabel = (iso: string) => (iso ? new Date(iso).toLocaleDateString('en-IN') : '—');
const todayIso = () => new Date().toISOString().split('T')[0];

const getYesterdayIso = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
};

const get7DaysAgoIso = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
};

const getFirstDayOfMonthIso = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
};

const PIE_COLORS = ['#e23744', '#cb202d', '#8c0f16', '#15803d', '#8c7576'];

export default function DailySheetReport() {
  const [filterMode, setFilterMode] = useState<'single' | 'range' | 'all'>('single');
  const [date, setDate] = useState(todayIso());
  const [from, setFrom] = useState(get7DaysAgoIso());
  const [to, setTo] = useState(todayIso());
  const [sheets, setSheets] = useState<any[]>([]);
  const [supervisor, setSupervisor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  const fetchSheets = () => {
    setLoading(true);
    let params: any = undefined;
    if (filterMode === 'single') {
      params = { date };
    } else if (filterMode === 'range') {
      params = { from, to };
    } else {
      params = {};
    }

    adminApi
      .getAllDailySheets(params)
      .then(setSheets)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSheets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMode, date]);

  const supervisors = Array.from(new Set(sheets.map((s) => s.supervisor_name))).filter(Boolean).sort();
  const filtered = supervisor ? sheets.filter((s) => s.supervisor_name === supervisor) : sheets;

  const totalReceived = filtered.reduce((s, r) => s + Number(r.amount_received || 0), 0);
  const totalSpent = filtered.reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const totalWorkers = filtered.reduce(
    (s, r) => s + (r.attendance || []).reduce((a: number, w: any) => a + Number(w.count || 0), 0),
    0
  );

  const bySupervisor = supervisors
    .map((name) => ({
      name,
      Spent: sheets.filter((s) => s.supervisor_name === name).reduce((a, s) => a + Number(s.total_amount || 0), 0),
      Received: sheets.filter((s) => s.supervisor_name === name).reduce((a, s) => a + Number(s.amount_received || 0), 0),
    }))
    .filter((row) => row.Spent > 0 || row.Received > 0);

  // Category breakdown for pie chart
  const normalBillsTotal = filtered.reduce((s, r) => s + Number(r.bills_normal || 0), 0);
  const gstBillsTotal = filtered.reduce((s, r) => s + Number(r.bills_gst || 0), 0);
  const creditBillsTotal = filtered.reduce((s, r) => s + Number(r.bills_credit || 0), 0);
  const vehicleRentalTotal = filtered.reduce((s, r) => s + Number(r.vehicle_rental || 0), 0);
  const labourSalaryTotal = filtered.reduce(
    (s, r) => s + (r.labourSalary || []).reduce((la: number, l: any) => la + Number(l.amount || 0), 0),
    0
  );

  const expenseBreakdownData = [
    { name: 'Normal Bills', value: normalBillsTotal },
    { name: 'GST Bills', value: gstBillsTotal },
    { name: 'Credit / Under GST', value: creditBillsTotal },
    { name: 'Labour Salary', value: labourSalaryTotal },
    { name: 'Vehicle & Rental', value: vehicleRentalTotal },
  ].filter((d) => d.value > 0);

  const setPresetToday = () => {
    setFilterMode('single');
    setDate(todayIso());
  };

  const setPresetYesterday = () => {
    setFilterMode('single');
    setDate(getYesterdayIso());
  };

  const setPreset7Days = () => {
    setFrom(get7DaysAgoIso());
    setTo(todayIso());
    setFilterMode('range');
  };

  const setPresetThisMonth = () => {
    setFrom(getFirstDayOfMonthIso());
    setTo(todayIso());
    setFilterMode('range');
  };

  const handleDownloadPdf = async () => {
    if (filtered.length === 0) return;
    setDownloading(true);
    try {
      let rangeSubtitle = 'All Submitted Daily Sheets';
      if (filterMode === 'single') rangeSubtitle = `Date: ${dateLabel(date)}`;
      else if (filterMode === 'range') rangeSubtitle = `Range: ${dateLabel(from)} to ${dateLabel(to)}`;

      const { doc, filename } = await buildPdfReport({
        filename: `daily-sheets-${filterMode === 'single' ? date : 'report'}.pdf`,
        title: 'Daily Sheet Reports',
        subtitle: rangeSubtitle,
        orientation: 'landscape',
        summaryBoxes: [
          { label: 'Sheets Submitted', value: filtered.length.toString() },
          { label: 'Amount Received', value: rupees(totalReceived), color: '#15803d' },
          { label: 'Total Spent', value: rupees(totalSpent), color: '#e23744' },
          { label: 'Workers Logged', value: totalWorkers.toString() },
        ],
        tables: [
          {
            title: `Submitted Daily Sheets (${filtered.length})`,
            head: ['#', 'Date', 'Supervisor', 'Site', 'Work Description', 'Received (Rs)', 'Total Spent (Rs)'],
            body: filtered.map((r, i) => [
              i + 1,
              dateLabel(r.date),
              r.supervisor_name || '-',
              r.site_name || '-',
              r.work_description || '-',
              Number(r.amount_received || 0).toLocaleString('en-IN'),
              Number(r.total_amount || 0).toLocaleString('en-IN'),
            ]),
            foot: [
              'TOTAL',
              '',
              '',
              '',
              '',
              totalReceived.toLocaleString('en-IN'),
              totalSpent.toLocaleString('en-IN'),
            ],
          },
        ],
      });
      await downloadPdfReport({ doc, filename });
    } finally {
      setDownloading(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (filtered.length === 0) return;
    setDownloading(true);
    try {
      let rangeSubtitle = 'All Submitted Daily Sheets';
      if (filterMode === 'single') rangeSubtitle = `Date: ${dateLabel(date)}`;
      else if (filterMode === 'range') rangeSubtitle = `Range: ${dateLabel(from)} to ${dateLabel(to)}`;

      const pdf = await buildPdfReport({
        filename: `daily-sheets-${filterMode === 'single' ? date : 'report'}.pdf`,
        title: 'Daily Sheet Reports',
        subtitle: rangeSubtitle,
        orientation: 'landscape',
        summaryBoxes: [
          { label: 'Sheets Submitted', value: filtered.length.toString() },
          { label: 'Amount Received', value: rupees(totalReceived), color: '#15803d' },
          { label: 'Total Spent', value: rupees(totalSpent), color: '#e23744' },
          { label: 'Workers Logged', value: totalWorkers.toString() },
        ],
        tables: [
          {
            title: `Submitted Daily Sheets (${filtered.length})`,
            head: ['#', 'Date', 'Supervisor', 'Site', 'Work Description', 'Received (Rs)', 'Total Spent (Rs)'],
            body: filtered.map((r, i) => [
              i + 1,
              dateLabel(r.date),
              r.supervisor_name || '-',
              r.site_name || '-',
              r.work_description || '-',
              Number(r.amount_received || 0).toLocaleString('en-IN'),
              Number(r.total_amount || 0).toLocaleString('en-IN'),
            ]),
            foot: [
              'TOTAL',
              '',
              '',
              '',
              '',
              totalReceived.toLocaleString('en-IN'),
              totalSpent.toLocaleString('en-IN'),
            ],
          },
        ],
      });
      const text = `Daily Sheet Report (${rangeSubtitle})\nSubmitted Sheets: ${filtered.length}\nReceived: ${rupees(totalReceived)}\nTotal Spent: ${rupees(totalSpent)}`;
      await sharePdfReportOnWhatsApp(pdf, text);
    } finally {
      setDownloading(false);
    }
  };

  const handleExportCsv = () => {
    if (filtered.length === 0) return;
    const header = [
      'Date',
      'Supervisor',
      'Site',
      'Work Description',
      'Amount Received',
      'Bills Normal',
      'Bills GST',
      'Bills Credit',
      'Vehicle Rental',
      'Labour Salary Total',
      'Total Spent',
    ];
    const lines = filtered.map((r) => {
      const labourTotal = (r.labourSalary || []).reduce((s: number, l: any) => s + Number(l.amount || 0), 0);
      return [
        r.date,
        r.supervisor_name || '',
        r.site_name || '',
        r.work_description || '',
        r.amount_received || 0,
        r.bills_normal || 0,
        r.bills_gst || 0,
        r.bills_credit || 0,
        r.vehicle_rental || 0,
        labourTotal,
        r.total_amount || 0,
      ]
        .map(csvCell)
        .join(',');
    });
    exportCsv(`daily-sheets-${date || 'report'}.csv`, [header.join(','), ...lines].join('\n'));
  };

  const handleDownloadSinglePdf = async (sheet: any) => {
    setDownloading(true);
    try {
      const pdf = await buildSingleDailySheetPdfDoc({
        supervisorName: sheet.supervisor_name,
        siteName: sheet.site_name,
        date: sheet.date,
        workDescription: sheet.work_description,
        attendance: sheet.attendance || [],
        amountReceived: sheet.amount_received,
        billsNormal: sheet.bills_normal,
        billsGst: sheet.bills_gst,
        billsCredit: sheet.bills_credit,
        vehicleRental: sheet.vehicle_rental,
        labourSalary: sheet.labourSalary || [],
        totalAmount: sheet.total_amount,
      });
      await downloadPdfReport(pdf);
    } finally {
      setDownloading(false);
    }
  };

  const handleShareSingleWhatsApp = async (sheet: any) => {
    setDownloading(true);
    try {
      const pdf = await buildSingleDailySheetPdfDoc({
        supervisorName: sheet.supervisor_name,
        siteName: sheet.site_name,
        date: sheet.date,
        workDescription: sheet.work_description,
        attendance: sheet.attendance || [],
        amountReceived: sheet.amount_received,
        billsNormal: sheet.bills_normal,
        billsGst: sheet.bills_gst,
        billsCredit: sheet.bills_credit,
        vehicleRental: sheet.vehicle_rental,
        labourSalary: sheet.labourSalary || [],
        totalAmount: sheet.total_amount,
      });
      const text = `*Ayyanar Builders — Daily Sheet Report*\nSupervisor: ${sheet.supervisor_name}\nSite: ${sheet.site_name}\nDate: ${dateLabel(sheet.date)}\nReceived: ${rupees(sheet.amount_received)}\nTotal Spent: ${rupees(sheet.total_amount)}`;
      await sharePdfReportOnWhatsApp(pdf, text);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Daily Sheet Reports</h1>
      <p className="page-subtitle">Supervisor daily submissions — work details, attendance, cash received, bills, and labour salary.</p>

      {/* Date Filter Modes & Presets */}
      <div className="chip-row" style={{ marginBottom: 12 }}>
        <button className={`chip${filterMode === 'single' ? ' active' : ''}`} onClick={() => setFilterMode('single')}>
          Single Date
        </button>
        <button className={`chip${filterMode === 'range' ? ' active' : ''}`} onClick={() => setFilterMode('range')}>
          Date Range
        </button>
        <button className={`chip${filterMode === 'all' ? ' active' : ''}`} onClick={() => setFilterMode('all')}>
          All Time
        </button>
      </div>

      <div className="toolbar">
        {filterMode === 'single' && (
          <div className="date-input-group">
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            <button className="btn secondary" onClick={setPresetToday}>
              Today
            </button>
            <button className="btn secondary" onClick={setPresetYesterday}>
              Yesterday
            </button>
          </div>
        )}

        {filterMode === 'range' && (
          <div className="date-range-picker">
            <div className="date-input-group">
              <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From Date" />
              <span className="text-muted">to</span>
              <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To Date" />
            </div>
            <div className="date-action-group">
              <button className="btn" onClick={fetchSheets}>
                Apply
              </button>
              <button className="btn secondary" onClick={setPreset7Days}>
                Last 7 Days
              </button>
              <button className="btn secondary" onClick={setPresetThisMonth}>
                This Month
              </button>
            </div>
          </div>
        )}
      </div>

      {supervisors.length > 0 && (
        <div className="chip-row" style={{ marginBottom: 18 }}>
          <button className={`chip${!supervisor ? ' active' : ''}`} onClick={() => setSupervisor(null)}>
            All Supervisors ({sheets.length})
          </button>
          {supervisors.map((name) => (
            <button key={name} className={`chip${supervisor === name ? ' active' : ''}`} onClick={() => setSupervisor(name)}>
              {name} ({sheets.filter((s) => s.supervisor_name === name).length})
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="empty-note">Loading daily sheet reports…</div>
      ) : (
        <>
          <div className="summary-row">
            <SummaryCard label="Sheets Submitted" value={filtered.length.toString()} icon={FileText} />
            <SummaryCard label="Amount Received" value={rupees(totalReceived)} color="#15803d" icon={Banknote} />
            <SummaryCard label="Total Spent" value={rupees(totalSpent)} color="#e23744" icon={Wallet} />
            <SummaryCard label="Workers Logged" value={totalWorkers.toString()} icon={Users} />
          </div>

          <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={handleDownloadPdf} disabled={downloading || filtered.length === 0}>
              <Download size={16} />
              {downloading ? 'Generating PDF…' : 'Download PDF'}
            </button>
            <button className="btn whatsapp" onClick={handleShareWhatsApp} disabled={downloading || filtered.length === 0}>
              <Share2 size={16} />
              Share on WhatsApp
            </button>
            <button className="btn secondary" onClick={handleExportCsv} disabled={filtered.length === 0}>
              <FileSpreadsheet size={16} />
              Export CSV
            </button>
          </div>

          {bySupervisor.length > 0 && (
            <div className="card">
              <h3 className="section-heading">Received vs Spent — By Supervisor</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={bySupervisor}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1dede" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => rupees(v)} />
                  <Legend />
                  <Bar dataKey="Received" fill="#15803d" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Spent" fill="#e23744" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {expenseBreakdownData.length > 0 && (
            <div className="card">
              <h3 className="section-heading">Expense Category Breakdown</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={expenseBreakdownData} dataKey="value" nameKey="name" outerRadius={90} label={(d) => `${d.name}: ${rupees(d.value)}`}>
                    {expenseBreakdownData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => rupees(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="card">
            <h3 className="section-heading">
              Submitted Sheets ({filtered.length})
            </h3>
            <DataTable<any>
              rowKey={(r) => r.id}
              rows={filtered}
              emptyText="No daily sheets found for this selection."
              columns={[
                { header: 'Date', render: (r) => dateLabel(r.date) },
                { header: 'Supervisor', render: (r) => r.supervisor_name },
                { header: 'Site', render: (r) => r.site_name },
                { header: 'Work Description', render: (r) => r.work_description || '—' },
                { header: 'Received', align: 'right', render: (r) => <span className="text-success">{rupees(r.amount_received)}</span> },
                { header: 'Total Spent', align: 'right', render: (r) => <b>{rupees(r.total_amount)}</b> },
                {
                  header: 'Actions',
                  align: 'right',
                  render: (r) => (
                    <div className="row-actions">
                      <button className="icon-btn" onClick={() => setDetail(r)} title="View Detail">
                        View
                      </button>
                      <button className="icon-btn" onClick={() => handleDownloadSinglePdf(r)} disabled={downloading} title="Download Single Daily Sheet PDF">
                        <Download size={13} /> Single PDF
                      </button>
                      <button className="icon-btn" onClick={() => handleShareSingleWhatsApp(r)} disabled={downloading} title="Share Single Sheet on WhatsApp" style={{ color: '#25D366' }}>
                        <Share2 size={13} /> WhatsApp
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </>
      )}

      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{detail.supervisor_name}</h3>
            <div className="sub">
              {detail.site_name} • {dateLabel(detail.date)}
            </div>
            {detail.work_description && <div className="sub" style={{ marginBottom: 12 }}>Work: {detail.work_description}</div>}

            <div className="field-label">Worker Attendance</div>
            {(detail.attendance || []).length > 0 ? (
              (detail.attendance || []).map((a: any, i: number) => (
                <div key={i} style={{ fontSize: 13, fontWeight: 700, padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{a.category}{a.name ? ` — ${a.name}` : ''}</span>
                  <span className="text-success">{a.count} Present</span>
                </div>
              ))
            ) : (
              <div className="empty-note">No attendance recorded.</div>
            )}

            <div className="field-label">Money & Bills Summary</div>
            <div style={{ fontSize: 13, fontWeight: 700, padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
              <span>Amount Received:</span>
              <span className="text-success">{rupees(detail.amount_received)}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
              <span>Bills — Normal:</span>
              <span>{rupees(detail.bills_normal)}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
              <span>Bills — GST:</span>
              <span>{rupees(detail.bills_gst)}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
              <span>Bills — Credit / Under GST:</span>
              <span>{rupees(detail.bills_credit)}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
              <span>Vehicle & Rental:</span>
              <span>{rupees(detail.vehicle_rental)}</span>
            </div>

            <div className="field-label">Labour Salary Paid</div>
            {(detail.labourSalary || []).length > 0 ? (
              (detail.labourSalary || []).map((l: any, i: number) => (
                <div key={i} style={{ fontSize: 13, fontWeight: 700, padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{l.name}</span>
                  <span className="text-primary">{rupees(l.amount)}</span>
                </div>
              ))
            ) : (
              <div className="empty-note">No labour salary recorded.</div>
            )}

            <div
              style={{
                fontSize: 15,
                fontWeight: 900,
                color: 'var(--primary)',
                marginTop: 14,
                paddingTop: 14,
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>TOTAL SPENT:</span>
              <span>{rupees(detail.total_amount)}</span>
            </div>

            <div className="modal-actions" style={{ flexDirection: 'column', gap: 8, marginTop: 18 }}>
              <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                <button className="btn" onClick={() => handleDownloadSinglePdf(detail)} disabled={downloading}>
                  <Download size={15} /> Download Single Sheet PDF
                </button>
                <button className="btn whatsapp" onClick={() => handleShareSingleWhatsApp(detail)} disabled={downloading}>
                  <Share2 size={15} /> WhatsApp
                </button>
              </div>
              <button className="btn secondary" onClick={() => setDetail(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

