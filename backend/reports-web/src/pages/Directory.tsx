import { useEffect, useState } from 'react';
import { Download, Plus, Share2, Trash2 } from 'lucide-react';
import { adminApi } from '../api';
import DataTable from '../components/DataTable';
import PrintButton from '../components/PrintButton';
import { buildPdfReport, downloadPdfReport, sharePdfReportOnWhatsApp } from '../services/pdfReport';

export default function Directory() {
  const [staff, setStaff] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Site modal state
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [editingSite, setEditingSite] = useState<any | null>(null);
  const [siteName, setSiteName] = useState('');
  const [siteLocation, setSiteLocation] = useState('');
  const [savingSite, setSavingSite] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([adminApi.getStaff(), adminApi.getSites()])
      .then(([s, si]) => {
        setStaff(s);
        setSites(si);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAddSite = () => {
    setEditingSite(null);
    setSiteName('');
    setSiteLocation('');
    setShowSiteModal(true);
  };

  const handleOpenEditSite = (site: any) => {
    setEditingSite(site);
    setSiteName(site.name || '');
    setSiteLocation(site.location || '');
    setShowSiteModal(true);
  };

  const handleSaveSite = async () => {
    if (!siteName.trim()) {
      alert('Please enter a site name.');
      return;
    }
    setSavingSite(true);
    try {
      if (editingSite) {
        await adminApi.updateSite(editingSite.id, { name: siteName.trim(), location: siteLocation.trim() });
      } else {
        await adminApi.createSite({ name: siteName.trim(), location: siteLocation.trim() });
      }
      setShowSiteModal(false);
      const updated = await adminApi.getSites();
      setSites(updated);
    } catch (err: any) {
      alert(err?.message || 'Failed to save project site.');
    } finally {
      setSavingSite(false);
    }
  };

  const handleDeleteSite = async (site: any) => {
    if (!window.confirm(`Are you sure you want to delete project site "${site.name}"?`)) return;
    try {
      await adminApi.deleteSite(site.id);
      setSites((prev) => prev.filter((s) => s.id !== site.id));
    } catch (err: any) {
      alert(err?.message || 'Failed to delete project site.');
    }
  };

  const handleDeleteStaff = async (member: any) => {
    if (!window.confirm(`Are you sure you want to delete staff account "${member.name}"?`)) return;
    try {
      await adminApi.deleteStaff(member.id);
      setStaff((prev) => prev.filter((s) => s.id !== member.id));
    } catch (err: any) {
      alert(err?.message || 'Failed to delete staff account.');
    }
  };

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
      <p className="page-subtitle">Manage company projects, site locations, and team member accounts.</p>

      {loading ? (
        <div className="empty-note">Loading…</div>
      ) : (
        <>
          <div className="toolbar" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
            <button className="btn no-print" onClick={handleOpenAddSite}>
              <Plus size={16} /> New Project Site
            </button>
            <div className="no-print" style={{ display: 'flex', gap: 8 }}>
              <button className="btn secondary" onClick={handleDownloadPdf} disabled={downloading}>
                <Download size={16} />
                {downloading ? 'Building PDF…' : 'Download PDF'}
              </button>
              <button className="btn whatsapp" onClick={handleShareWhatsApp} disabled={downloading}>
                <Share2 size={16} />
                WhatsApp
              </button>
              <PrintButton />
            </div>
          </div>

          <div className="card">
            <h3 className="section-heading">Project Sites ({sites.length})</h3>
            <DataTable<any>
              rowKey={(s) => s.id}
              rows={sites}
              emptyText="No sites created yet."
              columns={[
                { header: 'Name', render: (s: any) => <b>{s.name}</b> },
                { header: 'Location', render: (s: any) => s.location || '—' },
                { header: 'Supervisor', render: (s: any) => s.supervisor_name || 'Unassigned' },
                { header: 'Status', render: (s: any) => <span className="text-success">{s.status || 'Active'}</span> },
                {
                  header: 'Actions',
                  align: 'right',
                  render: (s: any) => (
                    <div className="row-actions">
                      <button className="icon-btn" onClick={() => handleOpenEditSite(s)}>
                        Edit
                      </button>
                      <button className="icon-btn danger" onClick={() => handleDeleteSite(s)}>
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          </div>

          <div className="card">
            <h3 className="section-heading">Staff & Team ({staff.length})</h3>
            <DataTable<any>
              rowKey={(s) => s.id}
              rows={staff}
              emptyText="No staff added yet."
              columns={[
                { header: 'Name', render: (s: any) => <b>{s.name}</b> },
                { header: 'Username', render: (s: any) => s.username },
                { header: 'Role', render: (s: any) => s.role },
                { header: 'Phone', render: (s: any) => s.phone || '—' },
                {
                  header: 'Actions',
                  align: 'right',
                  render: (s: any) => (
                    <div className="row-actions">
                      <button className="icon-btn danger" onClick={() => handleDeleteStaff(s)}>
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </>
      )}

      {showSiteModal && (
        <div className="modal-backdrop" onClick={() => setShowSiteModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{editingSite ? 'Edit Project Site' : 'New Project Site'}</h3>
            <div className="sub">Enter project details below.</div>

            <div className="field-label">Project Site Name</div>
            <input
              type="text"
              className="input"
              placeholder="e.g. Maskam Thatha House"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
            />

            <div className="field-label">Location / Address</div>
            <input
              type="text"
              className="input"
              placeholder="e.g. Madurai Main Road"
              value={siteLocation}
              onChange={(e) => setSiteLocation(e.target.value)}
            />

            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setShowSiteModal(false)}>
                Cancel
              </button>
              <button className="btn" onClick={handleSaveSite} disabled={savingSite}>
                {savingSite ? 'Saving…' : editingSite ? 'Save Changes' : 'Create Site'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
