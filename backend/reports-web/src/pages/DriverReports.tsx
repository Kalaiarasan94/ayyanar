import { useEffect, useState } from 'react';
import { fieldApi } from '../api';
import DataTable from '../components/DataTable';
import SummaryCard from '../components/SummaryCard';
import { buildPdfReport, downloadPdfReport } from '../services/pdfReport';

const rupees = (v: any) => `Rs ${Number(v || 0).toLocaleString('en-IN')}`;
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('en-IN');

const summarize = (records: any[], key: 'vehicle_name' | 'driver_name') => {
  const map = new Map<string, { trips: number; total_km: number; diesel_fare: number }>();
  records.forEach((r) => {
    const k = r[key] || 'Unknown';
    const entry = map.get(k) || { trips: 0, total_km: 0, diesel_fare: 0 };
    entry.trips += 1;
    entry.total_km += Number(r.total_km || r.distance || 0);
    entry.diesel_fare += Number(r.diesel_fare || 0);
    map.set(k, entry);
  });
  return Array.from(map.entries()).map(([name, v]) => ({ name, ...v }));
};

export default function DriverReports() {
  const [records, setRecords] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    Promise.all([fieldApi.getDriverRecords(), fieldApi.getDriverBills()])
      .then(([r, b]) => {
        setRecords(r);
        setBills(b);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalKm = records.reduce((s, r) => s + Number(r.total_km || 0), 0);
  const totalDiesel = records.reduce((s, r) => s + Number(r.diesel_fare || 0), 0);
  const byVehicle = summarize(records, 'vehicle_name');
  const byDriver = summarize(records, 'driver_name');

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { doc, filename } = await buildPdfReport({
        filename: 'driver-trip-report.pdf',
        title: 'Driver Trip Report',
        subtitle: 'All recorded trips',
        orientation: 'landscape',
        summaryBoxes: [
          { label: 'Total Trips', value: records.length.toString() },
          { label: 'Total KM', value: totalKm.toLocaleString('en-IN') },
          { label: 'Total Diesel Fare', value: rupees(totalDiesel), color: '#e23744' },
        ],
        tables: [
          {
            title: 'Vehicle-wise Summary',
            head: ['Vehicle', 'Trips', 'Total KM', 'Diesel Fare (Rs)'],
            body: byVehicle.map((v) => [v.name, v.trips, v.total_km.toLocaleString('en-IN'), v.diesel_fare.toLocaleString('en-IN')]),
          },
          {
            title: 'Driver-wise Summary',
            head: ['Driver', 'Trips', 'Total KM', 'Diesel Fare (Rs)'],
            body: byDriver.map((v) => [v.name, v.trips, v.total_km.toLocaleString('en-IN'), v.diesel_fare.toLocaleString('en-IN')]),
          },
          {
            title: `Trip Detail (${records.length})`,
            head: ['#', 'Date', 'Vehicle', 'KM (Start→End)', 'Total KM', 'Diesel (Rs)', 'Load', 'Type/Customer', 'Place'],
            body: records.map((r, i) => [
              i + 1,
              dateLabel(r.date),
              r.vehicle_name,
              `${r.starting_km}→${r.ending_km}`,
              r.total_km,
              Number(r.diesel_fare || 0).toLocaleString('en-IN'),
              r.load_name || '-',
              r.load_type === 'Rent' ? `Rent / ${r.customer_name || '-'}` : 'Own',
              r.place || '-',
            ]),
          },
        ],
      });
      await downloadPdfReport({ doc, filename });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Driver Reports</h1>
      <p className="page-subtitle">Trip records and diesel bills across all drivers.</p>

      {loading ? (
        <div className="empty-note">Loading…</div>
      ) : (
        <>
          <div className="summary-row">
            <SummaryCard label="Total Trips" value={records.length.toString()} />
            <SummaryCard label="Total KM" value={totalKm.toLocaleString('en-IN')} />
            <SummaryCard label="Total Diesel Fare" value={rupees(totalDiesel)} color="#e23744" />
          </div>

          <div className="toolbar">
            <button className="btn" onClick={handleDownload} disabled={downloading || records.length === 0}>
              {downloading ? 'Building PDF…' : 'Download PDF'}
            </button>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Vehicle-wise Summary</h3>
            <DataTable<any>
              rowKey={(r) => r.name}
              rows={byVehicle}
              emptyText="No trips recorded."
              columns={[
                { header: 'Vehicle', render: (r) => r.name },
                { header: 'Trips', align: 'right', render: (r) => r.trips },
                { header: 'Total KM', align: 'right', render: (r) => r.total_km.toLocaleString('en-IN') },
                { header: 'Diesel Fare', align: 'right', render: (r) => rupees(r.diesel_fare) },
              ]}
            />
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Driver-wise Summary</h3>
            <DataTable<any>
              rowKey={(r) => r.name}
              rows={byDriver}
              emptyText="No trips recorded."
              columns={[
                { header: 'Driver', render: (r) => r.name },
                { header: 'Trips', align: 'right', render: (r) => r.trips },
                { header: 'Total KM', align: 'right', render: (r) => r.total_km.toLocaleString('en-IN') },
                { header: 'Diesel Fare', align: 'right', render: (r) => rupees(r.diesel_fare) },
              ]}
            />
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Diesel Bills ({bills.length})</h3>
            <DataTable<any>
              rowKey={(b) => b.id}
              rows={bills}
              emptyText="No diesel bills uploaded."
              columns={[
                {
                  header: 'Photo',
                  render: (b: any) => (b.image_url?.startsWith('http') ? <img className="thumb" src={b.image_url} /> : '—'),
                },
                { header: 'Date', render: (b: any) => dateLabel(b.date) },
                { header: 'Driver', render: (b: any) => b.driver_name },
                { header: 'Vehicle', render: (b: any) => b.vehicle_name || '—' },
                { header: 'Note', render: (b: any) => b.note || '—' },
                { header: 'Amount', align: 'right', render: (b: any) => rupees(b.amount) },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}
