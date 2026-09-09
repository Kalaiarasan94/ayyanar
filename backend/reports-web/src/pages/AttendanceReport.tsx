import { useEffect, useState } from 'react';
import { Download, Share2, UserCheck, UserMinus, UserX, Users } from 'lucide-react';
import { adminApi } from '../api';
import DataTable from '../components/DataTable';
import SummaryCard from '../components/SummaryCard';
import { buildPdfReport, downloadPdfReport, sharePdfReportOnWhatsApp } from '../services/pdfReport';
import { downloadImage } from '../services/printReport';

const todayIso = () => new Date().toISOString().split('T')[0];
const dateLabel = (iso: string) => (iso ? new Date(iso).toLocaleDateString('en-IN') : '—');

export default function AttendanceReport() {
  const [date, setDate] = useState(todayIso());
  const [data, setData] = useState<any>({ supervisors: [], categories: [] });
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

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

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const { doc, filename } = await buildPdfReport({
        filename: `attendance-report-${date}.pdf`,
        title: 'Attendance Overview Report',
        subtitle: `Date: ${dateLabel(date)}`,
        summaryBoxes: [
          { label: 'Supervisors Present', value: present.toString(), color: '#15803d' },
          { label: 'Supervisors Absent', value: absent.toString(), color: '#e23744' },
          { label: 'Workers Present', value: workerPresent.toString(), color: '#15803d' },
          { label: 'Workers Absent', value: workerAbsent.toString(), color: '#e23744' },
        ],
        tables: [
          {
            title: `Supervisor Attendance (${supervisors.length})`,
            head: ['#', 'Supervisor', 'Site', 'Status', 'Time', 'Location'],
            body: supervisors.map((s: any, i: number) => [
              i + 1,
              s.supervisor_name || 'Supervisor',
              s.site_name || '-',
              s.status || 'Absent',
              s.created_at ? new Date(s.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-',
              s.location_name || '-',
            ]),
          },
          {
            title: `Worker Categories (${categories.length})`,
            head: ['Category', 'Supervisor', 'Site', 'Present Count', 'Absent Count'],
            body: categories.map((c: any) => [
              c.category,
              c.site_supervisor_name || '-',
              c.site_name || '-',
              c.present_count || 0,
              c.absent_count || 0,
            ]),
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
        filename: `attendance-report-${date}.pdf`,
        title: 'Attendance Overview Report',
        subtitle: `Date: ${dateLabel(date)}`,
        summaryBoxes: [
          { label: 'Supervisors Present', value: present.toString(), color: '#15803d' },
          { label: 'Supervisors Absent', value: absent.toString(), color: '#e23744' },
          { label: 'Workers Present', value: workerPresent.toString(), color: '#15803d' },
          { label: 'Workers Absent', value: workerAbsent.toString(), color: '#e23744' },
        ],
        tables: [
          {
            title: `Supervisor Attendance (${supervisors.length})`,
            head: ['#', 'Supervisor', 'Site', 'Status', 'Time', 'Location'],
            body: supervisors.map((s: any, i: number) => [
              i + 1,
              s.supervisor_name || 'Supervisor',
              s.site_name || '-',
              s.status || 'Absent',
              s.created_at ? new Date(s.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-',
              s.location_name || '-',
            ]),
          },
        ],
      });
      const text = `Attendance Report (${dateLabel(date)})\nSupervisors Present: ${present} / ${supervisors.length}\nWorkers Logged: ${workerPresent} present, ${workerAbsent} absent`;
      await sharePdfReportOnWhatsApp(pdf, text);
    } finally {
      setDownloading(false);
    }
  };

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
        <SummaryCard label="Supervisors Present" value={present.toString()} color="#15803d" icon={UserCheck} />
        <SummaryCard label="Supervisors Absent" value={absent.toString()} color="#e23744" icon={UserX} />
        <SummaryCard label="Workers Present" value={workerPresent.toString()} color="#15803d" icon={Users} />
        <SummaryCard label="Workers Absent" value={workerAbsent.toString()} color="#e23744" icon={UserMinus} />
      </div>

      <div className="toolbar" style={{ justifyContent: 'flex-end', marginBottom: 14 }}>
        <button className="btn" onClick={handleDownloadPdf} disabled={downloading}>
          <Download size={16} />
          {downloading ? 'Building PDF…' : 'Download PDF'}
        </button>
        <button className="btn whatsapp" onClick={handleShareWhatsApp} disabled={downloading}>
          <Share2 size={16} />
          Share on WhatsApp
        </button>
      </div>

      <div className="card">
        <h3 className="section-heading">Supervisor Attendance</h3>
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
                render: (s: any) => {
                  if (!s.selfie_url) return '—';
                  const src = s.selfie_url.startsWith('http') || s.selfie_url.startsWith('/') ? s.selfie_url : `/${s.selfie_url}`;
                  return (
                    <img
                      className="thumb"
                      src={src}
                      alt="Selfie"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  );
                },
              },
              { header: 'Supervisor', render: (s: any) => s.supervisor_name || 'Supervisor' },
              { header: 'Site', render: (s: any) => s.site_name || '—' },
              { header: 'Status', render: (s: any) => (s.status === 'Present' ? <span className="text-success">Present</span> : <span className="text-primary">Absent</span>) },
              { header: 'Time', render: (s: any) => (s.created_at ? new Date(s.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—') },
              { header: 'Location', render: (s: any) => s.location_name || '—' },
              {
                header: '',
                render: (s: any) => {
                  if (!s.selfie_url) return null;
                  const src = s.selfie_url.startsWith('http') || s.selfie_url.startsWith('/') ? s.selfie_url : `/${s.selfie_url}`;
                  return (
                    <button className="btn secondary" onClick={() => downloadImage(src, `${s.supervisor_name}-${date}.jpg`)}>
                      Download
                    </button>
                  );
                },
              },
            ]}
          />
        )}
      </div>

      {Array.from(grouped.entries()).map(([supervisorName, items]) => (
        <div className="card" key={supervisorName}>
          <h3 className="section-heading">{supervisorName}'s Workers</h3>
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
