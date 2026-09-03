import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import DataTable from '../components/DataTable';

export default function Directory() {
  const [staff, setStaff] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([adminApi.getStaff(), adminApi.getSites()])
      .then(([s, si]) => {
        setStaff(s);
        setSites(si);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="page-title">Staff & Sites Directory</h1>
      <p className="page-subtitle">Reference lists — who's on the team, and who's assigned where.</p>

      {loading ? (
        <div className="empty-note">Loading…</div>
      ) : (
        <>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Sites ({sites.length})</h3>
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
            <h3 style={{ marginTop: 0 }}>Staff ({staff.length})</h3>
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
