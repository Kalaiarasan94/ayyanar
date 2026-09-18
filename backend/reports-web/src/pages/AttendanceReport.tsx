import { useEffect, useState } from 'react';
import { Download, Share2, UserCheck, UserMinus, UserX, Users } from 'lucide-react';
import { adminApi } from '../api';
import DataTable from '../components/DataTable';
import DateFilterBar, { DateFilterMode } from '../components/DateFilterBar';
import PrintButton from '../components/PrintButton';
import SummaryCard from '../components/SummaryCard';
import { buildPdfReport, downloadPdfReport, sharePdfReportOnWhatsApp } from '../services/pdfReport';
import { downloadImage } from '../services/printReport';

const todayIso = () => new Date().toISOString().split('T')[0];
const dateLabel = (iso: string) => (iso ? new Date(iso).toLocaleDateString('en-IN') : '—');

export default function AttendanceReport() {
  const [mode, setMode] = useState<DateFilterMode>('single');
  const [date, setDate] = useState(todayIso());
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [data, setData] = useState<any>({ supervisors: [], categories: [] });
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const load = (m = mode, d = date, f = from, t = to) => {
    setLoading(true);
    const params = m === 'single' ? { date: d } : m === 'range' ? { from: f, to: t } : { all: true };
    adminApi
      .getAttendanceOverview(params)
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rangeLabel = mode === 'single' ? dateLabel(date) : mode === 'range' ? `${dateLabel(from)} to ${dateLabel(to)}` : 'All Time';

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
        filename: `attendance-report-${mode === 'single' ? date : mode === 'range' ? `${from}-to-${to}` : 'all'}.pdf`,
        title: 'Attendance Overview Report',
        subtitle: rangeLabel,
        summaryBoxes: [
          { label: 'Supervisors Present', value: present.toString(), color: '#15803d' },
          { label: 'Supervisors Absent', value: absent.toString(), color: '#e23744' },
          { label: 'Workers Present', value: workerPresent.toString(), color: '#15803d' },
          { label: 'Workers Absent', value: workerAbsent.toString(), color: '#e23744' },
        ],
        tables: [
          {
            title: `Supervisor Attendance (${supervisors.length})`,
            head: ['#', 'Date', 'Supervisor', 'Site', 'Status', 'Time', 'Location'],
            body: supervisors.map((s: any, i: number) => [
              i + 1,
              dateLabel(s.date),
              s.supervisor_name || 'Supervisor',
              s.site_name || '-',
              s.status || 'Absent',
              s.created_at ? new Date(s.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-',
              s.location_name || '-',
            ]),
          },
          {
            title: `Worker Categories (${categories.length})`,
            head: ['Date', 'Category', 'Supervisor', 'Site', 'Present Count', 'Absent Count'],
            body: categories.map((c: any) => [
              dateLabel(c.date),
              c.category,
              c.site_supervisor_name || '-',
              c.site_name || '-',
              c.present_count || 0,
              c.absent_count || 0,
            ]),
            columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' } },
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
        filename: `attendance-report-${mode === 'single' ? date : mode === 'range' ? `${from}-to-${to}` : 'all'}.pdf`,
        title: 'Attendance Overview Report',
        subtitle: rangeLabel,
        summaryBoxes: [
          { label: 'Supervisors Present', value: present.toString(), color: '#15803d' },
          { label: 'Supervisors Absent', value: absent.toString(), color: '#e23744' },
          { label: 'Workers Present', value: workerPresent.toString(), color: '#15803d' },
          { label: 'Workers Absent', value: workerAbsent.toString(), color: '#e23744' },
        ],
        tables: [
          {
            title: `Supervisor Attendance (${supervisors.length})`,
            head: ['#', 'Date', 'Supervisor', 'Site', 'Status', 'Time', 'Location'],
            body: supervisors.map((s: any, i: number) => [
              i + 1,
              dateLabel(s.date),
              s.supervisor_name || 'Supervisor',
              s.site_name || '-',
              s.status || 'Absent',
              s.created_at ? new Date(s.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-',
              s.location_name || '-',
            ]),
          },
        ],
      });
      const text = `Attendance Report (${rangeLabel})\nSupervisors Present: ${present} / ${supervisors.length}\nWorkers Logged: ${workerPresent} present, ${workerAbsent} absent`;
      await sharePdfReportOnWhatsApp(pdf, text);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Attendance Reports</h1>
      <p className="page-subtitle">Supervisor check-ins and worker headcounts.</p>

      <DateFilterBar
        mode={mode}
        onModeChange={(m) => { setMode(m); load(m, date, from, to); }}
        date={date}
        onDateChange={(d) => { setDate(d); load('single', d, from, to); }}
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onApplyRange={(f = from, t = to) => { setFrom(f); setTo(t); load('range', date, f, t); }}
      />

      <div className="summary-row">
        <SummaryCard label="Supervisors Present" value={present.toString()} color="#15803d" icon={UserCheck} />
        <SummaryCard label="Supervisors Absent" value={absent.toString()} color="#e23744" icon={UserX} />
        <SummaryCard label="Workers Present" value={workerPresent.toString()} color="#15803d" icon={Users} />
        <SummaryCard label="Workers Absent" value={workerAbsent.toString()} color="#e23744" icon={UserMinus} />
      </div>

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

      <div className="card">
        <h3 className="section-heading">Supervisor Attendance</h3>
        {loading ? (
          <div className="empty-note">Loading…</div>
        ) : (
          <DataTable<any>
            rowKey={(s) => s.id}
            rows={supervisors}
            emptyText="No supervisor attendance for this selection."
            columns={[
              { header: 'Date', render: (s: any) => dateLabel(s.date) },
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
                    <button className="btn secondary no-print" onClick={() => downloadImage(src, `${s.supervisor_name}-${s.date}.jpg`)}>
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
              { header: 'Date', render: (c: any) => dateLabel(c.date) },
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
          <div className="empty-note">No worker attendance for this selection.</div>
        </div>
      )}
    </div>
  );
}
