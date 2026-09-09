import { useEffect, useState } from 'react';
import { Banknote, FileText, Users, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { adminApi } from '../api';
import DataTable from '../components/DataTable';
import SummaryCard from '../components/SummaryCard';

const rupees = (v: any) => `Rs ${Number(v || 0).toLocaleString('en-IN')}`;
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('en-IN');
const todayIso = () => new Date().toISOString().split('T')[0];

export default function DailySheetReport() {
  const [date, setDate] = useState(todayIso());
  const [sheets, setSheets] = useState<any[]>([]);
  const [supervisor, setSupervisor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    adminApi
      .getAllDailySheets(date)
      .then(setSheets)
      .finally(() => setLoading(false));
  }, [date]);

  const supervisors = Array.from(new Set(sheets.map((s) => s.supervisor_name))).sort();
  const filtered = supervisor ? sheets.filter((s) => s.supervisor_name === supervisor) : sheets;

  const totalReceived = filtered.reduce((s, r) => s + Number(r.amount_received || 0), 0);
  const totalSpent = filtered.reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const totalWorkers = filtered.reduce((s, r) => s + (r.attendance || []).reduce((a: number, w: any) => a + Number(w.count || 0), 0), 0);

  const bySupervisor = supervisors
    .map((name) => ({
      name,
      Spent: sheets.filter((s) => s.supervisor_name === name).reduce((a, s) => a + Number(s.total_amount || 0), 0),
    }))
    .filter((row) => row.Spent > 0);

  return (
    <div>
      <h1 className="page-title">Daily Sheet Reports</h1>
      <p className="page-subtitle">Every supervisor's combined daily report — attendance, money received, bills and labour salary.</p>

      <div className="toolbar">
        <button className="btn secondary" onClick={() => setDate(todayIso())}>
          Today
        </button>
        <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {supervisors.length > 0 && (
        <div className="chip-row" style={{ marginBottom: 18 }}>
          <button className={`chip${!supervisor ? ' active' : ''}`} onClick={() => setSupervisor(null)}>
            All ({sheets.length})
          </button>
          {supervisors.map((name) => (
            <button key={name} className={`chip${supervisor === name ? ' active' : ''}`} onClick={() => setSupervisor(name)}>
              {name} ({sheets.filter((s) => s.supervisor_name === name).length})
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="empty-note">Loading…</div>
      ) : (
        <>
          <div className="summary-row">
            <SummaryCard label="Sheets Submitted" value={filtered.length.toString()} icon={FileText} />
            <SummaryCard label="Amount Received" value={rupees(totalReceived)} color="#15803d" icon={Banknote} />
            <SummaryCard label="Total Spent" value={rupees(totalSpent)} color="#e23744" icon={Wallet} />
            <SummaryCard label="Workers Logged" value={totalWorkers.toString()} icon={Users} />
          </div>

          {bySupervisor.length > 0 && (
            <div className="card">
              <h3 className="section-heading">Total Spent — By Supervisor</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={bySupervisor}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1dede" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => rupees(v)} />
                  <Bar dataKey="Spent" fill="#e23744" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="card">
            <h3 className="section-heading">Submitted for {dateLabel(date)} ({filtered.length})</h3>
            <DataTable<any>
              rowKey={(r) => r.id}
              rows={filtered}
              emptyText="No daily sheets submitted for this date."
              columns={[
                { header: 'Supervisor', render: (r) => r.supervisor_name },
                { header: 'Site', render: (r) => r.site_name },
                { header: 'Work', render: (r) => r.work_description || '—' },
                { header: 'Received', align: 'right', render: (r) => <span className="text-success">{rupees(r.amount_received)}</span> },
                { header: 'Total', align: 'right', render: (r) => <b>{rupees(r.total_amount)}</b> },
                {
                  header: '',
                  align: 'right',
                  render: (r) => (
                    <button className="icon-btn" onClick={() => setDetail(r)}>
                      View
                    </button>
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
            <div className="sub">{detail.site_name} • {dateLabel(detail.date)}</div>
            {detail.work_description && <div className="sub" style={{ marginBottom: 12 }}>Work: {detail.work_description}</div>}

            <div className="field-label">Attendance</div>
            {(detail.attendance || []).length > 0 ? (
              (detail.attendance || []).map((a: any, i: number) => (
                <div key={i} style={{ fontSize: 13, fontWeight: 700, padding: '4px 0' }}>
                  {a.category}{a.name ? ` — ${a.name}` : ''}: {a.count} present
                </div>
              ))
            ) : (
              <div className="empty-note">No attendance recorded.</div>
            )}

            <div className="field-label">Money</div>
            <div style={{ fontSize: 13, fontWeight: 700, padding: '4px 0' }}>Amount Received: {rupees(detail.amount_received)}</div>
            <div style={{ fontSize: 13, fontWeight: 700, padding: '4px 0' }}>Bills — Normal: {rupees(detail.bills_normal)}</div>
            <div style={{ fontSize: 13, fontWeight: 700, padding: '4px 0' }}>Bills — GST: {rupees(detail.bills_gst)}</div>
            <div style={{ fontSize: 13, fontWeight: 700, padding: '4px 0' }}>Bills — Under GST / Credit: {rupees(detail.bills_credit)}</div>
            <div style={{ fontSize: 13, fontWeight: 700, padding: '4px 0' }}>Vehicle & Rental: {rupees(detail.vehicle_rental)}</div>

            <div className="field-label">Labour Salary</div>
            {(detail.labourSalary || []).length > 0 ? (
              (detail.labourSalary || []).map((l: any, i: number) => (
                <div key={i} style={{ fontSize: 13, fontWeight: 700, padding: '4px 0' }}>
                  {l.name}: {rupees(l.amount)}
                </div>
              ))
            ) : (
              <div className="empty-note">No labour salary recorded.</div>
            )}

            <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--primary)', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              TOTAL AMOUNT: {rupees(detail.total_amount)}
            </div>

            <div className="modal-actions">
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
