import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import DataTable from '../components/DataTable';
import SummaryCard from '../components/SummaryCard';
import { downloadImage } from '../services/printReport';

const todayIso = () => new Date().toISOString().split('T')[0];

export default function AttendanceReport() {
  const [date, setDate] = useState(todayIso());
  const [data, setData] = useState<any>({ supervisors: [], categories: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminApi
      .getAttendanceOverview(date)
      .then(setData)
      .finally(() => setLoading(false));
  }, [date]);

  const supervisors = data.supervisors || [];
  const categories = data.categories || [];
  const present = supervisors.filter((s: any) => s.status === 'Present').length;
  const absent = supervisors.filter((s: any) => s.status === 'Absent').length;
  const workerPresent = categories.reduce((s: number, c: any) => s + Number(c.present_count || 0), 0);
  const workerAbsent = categories.reduce((s: number, c: any) => s + Number(c.absent_count || 0), 0);

  const grouped = new Map<string, any[]>();
  categories.forEach((c: any) => {
    const key = c.site_supervisor_name || 'Unassigned Supervisor';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(c);
  });

  return (
    <div>
      <h1 className="page-title">Attendance Reports</h1>
      <p className="page-subtitle">Supervisor check-ins and worker headcounts for a chosen date.</p>

      <div className="toolbar">
        <button className="btn secondary" onClick={() => setDate(todayIso())}>
          Today
        </button>
        <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="summary-row">
        <SummaryCard label="Supervisors Present" value={present.toString()} color="#15803d" />
        <SummaryCard label="Supervisors Absent" value={absent.toString()} color="#e23744" />
        <SummaryCard label="Workers Present" value={workerPresent.toString()} color="#15803d" />
        <SummaryCard label="Workers Absent" value={workerAbsent.toString()} color="#e23744" />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Supervisor Attendance</h3>
        {loading ? (
          <div className="empty-note">Loading…</div>
        ) : (
          <DataTable<any>
            rowKey={(s) => s.id}
            rows={supervisors}
            emptyText="No supervisor attendance for this date."
            columns={[
              {
                header: 'Photo',
                render: (s: any) => (s.selfie_url?.startsWith('http') ? <img className="thumb" src={s.selfie_url} /> : '—'),
              },
              { header: 'Supervisor', render: (s: any) => s.supervisor_name || 'Supervisor' },
              { header: 'Site', render: (s: any) => s.site_name || '—' },
              { header: 'Status', render: (s: any) => (s.status === 'Present' ? <span className="text-success">Present</span> : <span className="text-primary">Absent</span>) },
              { header: 'Time', render: (s: any) => (s.created_at ? new Date(s.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—') },
              { header: 'Location', render: (s: any) => s.location_name || '—' },
              {
                header: '',
                render: (s: any) =>
                  s.selfie_url?.startsWith('http') ? (
                    <button className="btn secondary" onClick={() => downloadImage(s.selfie_url, `${s.supervisor_name}-${s.date}.jpg`)}>
                      Download
                    </button>
                  ) : null,
              },
            ]}
          />
        )}
      </div>

      {Array.from(grouped.entries()).map(([supervisorName, items]) => (
        <div className="card" key={supervisorName}>
          <h3 style={{ marginTop: 0 }}>{supervisorName}'s Workers</h3>
          <DataTable<any>
            rowKey={(c) => c.id}
            rows={items}
            columns={[
              {
                header: 'Photo',
                render: (c: any) => (c.image_url?.startsWith('http') ? <img className="thumb" src={c.image_url} /> : '—'),
              },
              { header: 'Category', render: (c: any) => c.category },
              { header: 'Reported By', render: (c: any) => c.worker_name || '—' },
              { header: 'Site', render: (c: any) => c.site_name || '—' },
              { header: 'Present', align: 'right', render: (c: any) => <span className="text-success">{c.present_count || 0}</span> },
              { header: 'Absent', align: 'right', render: (c: any) => <span className="text-primary">{c.absent_count || 0}</span> },
            ]}
          />
        </div>
      ))}
      {!loading && categories.length === 0 && (
        <div className="card">
          <div className="empty-note">No worker attendance for this date.</div>
        </div>
      )}
    </div>
  );
}
