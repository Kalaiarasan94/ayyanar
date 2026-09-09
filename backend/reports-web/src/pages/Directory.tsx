import { useEffect, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { adminApi } from '../api';
import DataTable from '../components/DataTable';
import { buildPdfReport, downloadPdfReport, sharePdfReportOnWhatsApp } from '../services/pdfReport';

export default function Directory() {
  const [staff, setStaff] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    Promise.all([adminApi.getStaff(), adminApi.getSites()])
      .then(([s, si]) => {
        setStaff(s);
        setSites(si);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const { doc, filename } = await buildPdfReport({
        filename: 'staff-and-sites-directory.pdf',
        title: 'Staff & Sites Directory',
        subtitle: `Active company registry — ${sites.length} Sites, ${staff.length} Team Members`,
        tables: [
          {
            title: `Construction Sites (${sites.length})`,
            head: ['#', 'Site Name', 'Location', 'Supervisor', 'Status'],
            body: sites.map((s, i) => [i + 1, s.name, s.location || '-', s.supervisor_name || 'Unassigned', s.status || 'Active']),
          },
          {
            title: `Staff & Team (${staff.length})`,
            head: ['#', 'Name', 'Username', 'Role', 'Phone'],
            body: staff.map((s, i) => [i + 1, s.name, s.username, s.role, s.phone || '-']),
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
        filename: 'staff-and-sites-directory.pdf',
        title: 'Staff & Sites Directory',
        subtitle: `Active company registry — ${sites.length} Sites, ${staff.length} Team Members`,
        tables: [
          {
            title: `Construction Sites (${sites.length})`,
            head: ['#', 'Site Name', 'Location', 'Supervisor', 'Status'],
            body: sites.map((s, i) => [i + 1, s.name, s.location || '-', s.supervisor_name || 'Unassigned', s.status || 'Active']),
          },
          {
            title: `Staff & Team (${staff.length})`,
            head: ['#', 'Name', 'Username', 'Role', 'Phone'],
            body: staff.map((s, i) => [i + 1, s.name, s.username, s.role, s.phone || '-']),
          },
        ],
      });
      const text = `Staff & Sites Directory\nActive Sites: ${sites.length}\nTeam Members: ${staff.length}`;
      await sharePdfReportOnWhatsApp(pdf, text);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Staff & Sites Directory</h1>
      <p className="page-subtitle">Reference lists — who's on the team, and who's assigned where.</p>

      {loading ? (
        <div className="empty-note">Loading…</div>
      ) : (
        <>
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
            <h3 className="section-heading">Sites ({sites.length})</h3>
            <DataTable<any>
              rowKey={(s) => s.id}
              rows={sites}
              emptyText="No sites created yet."
              columns={[
                { header: 'Name', render: (s: any) => s.name },
                { header: 'Location', render: (s: any) => s.location || '—' },
                { header: 'Supervisor', render: (s: any) => s.supervisor_name || 'Unassigned' },
                { header: 'Status', render: (s: any) => s.status || 'Active' },
              ]}
            />
          </div>

          <div className="card">
            <h3 className="section-heading">Staff ({staff.length})</h3>
            <DataTable<any>
              rowKey={(s) => s.id}
              rows={staff}
              emptyText="No staff added yet."
              columns={[
                { header: 'Name', render: (s: any) => s.name },
                { header: 'Username', render: (s: any) => s.username },
                { header: 'Role', render: (s: any) => s.role },
                { header: 'Phone', render: (s: any) => s.phone || '—' },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}
