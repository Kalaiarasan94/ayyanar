import { useEffect, useState } from 'react';
import { Download, Fuel, Route, Share2, Truck } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fieldApi } from '../api';
import DataTable from '../components/DataTable';
import DateFilterBar, { DateFilterMode } from '../components/DateFilterBar';
import PrintButton from '../components/PrintButton';
import SummaryCard from '../components/SummaryCard';
import { buildPdfReport, downloadPdfReport, sharePdfReportOnWhatsApp } from '../services/pdfReport';

const rupees = (v: any) => `Rs ${Number(v || 0).toLocaleString('en-IN')}`;
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('en-IN');
const todayIso = () => new Date().toISOString().split('T')[0];

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
  const [mode, setMode] = useState<DateFilterMode>('all');
  const [date, setDate] = useState(todayIso());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = (m = mode, d = date, f = from, t = to) => {
    setLoading(true);
    const [qFrom, qTo] = m === 'single' ? [d, d] : m === 'range' ? [f, t] : [undefined, undefined];
    Promise.all([fieldApi.getDriverRecords(qFrom, qTo), fieldApi.getDriverBills(qFrom, qTo)])
      .then(([r, b]) => {
        setRecords(r);
        setBills(b);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rangeLabel = mode === 'single' ? dateLabel(date) : mode === 'range' ? `${dateLabel(from)} to ${dateLabel(to)}` : 'All Time';

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
        subtitle: rangeLabel,
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
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
          },
          {
            title: 'Driver-wise Summary',
            head: ['Driver', 'Trips', 'Total KM', 'Diesel Fare (Rs)'],
            body: byDriver.map((v) => [v.name, v.trips, v.total_km.toLocaleString('en-IN'), v.diesel_fare.toLocaleString('en-IN')]),
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
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
    if (records.length === 0) return;
    setDownloading(true);
    try {
      const pdf = await buildPdfReport({
        filename: 'driver-trip-report.pdf',
        title: 'Driver Trip Report',
        subtitle: rangeLabel,
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
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
          },
          {
            title: 'Driver-wise Summary',
            head: ['Driver', 'Trips', 'Total KM', 'Diesel Fare (Rs)'],
            body: byDriver.map((v) => [v.name, v.trips, v.total_km.toLocaleString('en-IN'), v.diesel_fare.toLocaleString('en-IN')]),
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
          },
        ],
      });
      const text = `Driver Trip Report (${rangeLabel})\nTotal Trips: ${records.length}\nTotal KM: ${totalKm.toLocaleString('en-IN')}\nTotal Diesel Fare: ${rupees(totalDiesel)}`;
      await sharePdfReportOnWhatsApp(pdf, text);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Driver Reports</h1>
      <p className="page-subtitle">Trip records and diesel bills across all drivers.</p>

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

      {loading ? (
        <div className="empty-note">Loading…</div>
      ) : (
        <>
          <div className="summary-row">
            <SummaryCard label="Total Trips" value={records.length.toString()} icon={Truck} />
            <SummaryCard label="Total KM" value={totalKm.toLocaleString('en-IN')} icon={Route} />
            <SummaryCard label="Total Diesel Fare" value={rupees(totalDiesel)} color="#e23744" icon={Fuel} />
          </div>

          <div className="toolbar no-print" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={handleDownload} disabled={downloading || records.length === 0}>
              <Download size={16} />
              {downloading ? 'Building PDF…' : 'Download PDF'}
            </button>
            <button className="btn whatsapp" onClick={handleShareWhatsApp} disabled={downloading || records.length === 0}>
              <Share2 size={16} />
              Share on WhatsApp
            </button>
            <PrintButton />
          </div>

          {byVehicle.length > 0 && (
            <div className="card">
              <h3 className="section-heading">KM by Vehicle</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byVehicle.map((v) => ({ name: v.name, 'Total KM': v.total_km }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1dede" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="Total KM" fill="#e23744" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="card">
            <h3 className="section-heading">Vehicle-wise Summary</h3>
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
            <h3 className="section-heading">Driver-wise Summary</h3>
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
            <h3 className="section-heading">Diesel Bills ({bills.length})</h3>
            <DataTable<any>
              rowKey={(b) => b.id}
              rows={bills}
              emptyText="No diesel bills uploaded."
              columns={[
                {
                  header: 'Photo',
                  render: (b: any) => {
                    if (!b.image_url) return '—';
                    const src = b.image_url.startsWith('http') || b.image_url.startsWith('/') ? b.image_url : `/${b.image_url}`;
                    return (
                      <img
                        className="thumb"
                        src={src}
                        alt="Diesel Bill"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    );
                  },
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
