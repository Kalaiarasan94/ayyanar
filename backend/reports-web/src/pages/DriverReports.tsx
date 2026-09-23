import { useEffect, useState } from 'react';
import { Download, Fuel, Route, Share2, Truck } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fieldApi } from '../api';
import DataTable from '../components/DataTable';
import DateFilterBar, { DateFilterMode } from '../components/DateFilterBar';
import PrintButton from '../components/PrintButton';
import SelectField from '../components/SelectField';
import SummaryCard from '../components/SummaryCard';
import { buildPdfReport, buildSingleDriverTripPdfDoc, downloadPdfReport, sharePdfReportOnWhatsApp } from '../services/pdfReport';

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
  // Narrows every section on this page to one driver's own trips and bills —
  // pick a name, then Download PDF / Share produce that driver's own report.
  const [driverFilter, setDriverFilter] = useState<string | null>(null);

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

  const driverNames = Array.from(new Set(records.map((r) => r.driver_name))).filter(Boolean).sort();
  const filteredRecords = driverFilter ? records.filter((r) => r.driver_name === driverFilter) : records;
  const filteredBills = driverFilter ? bills.filter((b) => b.driver_name === driverFilter) : bills;

  const totalKm = filteredRecords.reduce((s, r) => s + Number(r.total_km || 0), 0);
  const totalDiesel = filteredRecords.reduce((s, r) => s + Number(r.diesel_fare || 0), 0);
  const byVehicle = summarize(filteredRecords, 'vehicle_name');
  const byDriver = summarize(filteredRecords, 'driver_name');
  const reportTitle = driverFilter ? `${driverFilter} — Driver Trip Report` : 'Driver Trip Report';

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { doc, filename } = await buildPdfReport({
        filename: `${driverFilter ? driverFilter.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'driver'}-trip-report.pdf`,
        title: reportTitle,
        subtitle: rangeLabel,
        orientation: 'landscape',
        summaryBoxes: [
          { label: 'Total Trips', value: filteredRecords.length.toString() },
          { label: 'Total KM', value: totalKm.toLocaleString('en-IN') },
          { label: 'Total Diesel Fare', value: rupees(totalDiesel), color: '#e23744' },
        ],
        tables: [
          ...(driverFilter
            ? []
            : [
                {
                  title: 'Vehicle-wise Summary',
                  head: ['Vehicle', 'Trips', 'Total KM', 'Diesel Fare (Rs)'],
                  body: byVehicle.map((v) => [v.name, v.trips, v.total_km.toLocaleString('en-IN'), v.diesel_fare.toLocaleString('en-IN')]),
                  columnStyles: { 1: { halign: 'right' as const }, 2: { halign: 'right' as const }, 3: { halign: 'right' as const } },
                },
                {
                  title: 'Driver-wise Summary',
                  head: ['Driver', 'Trips', 'Total KM', 'Diesel Fare (Rs)'],
                  body: byDriver.map((v) => [v.name, v.trips, v.total_km.toLocaleString('en-IN'), v.diesel_fare.toLocaleString('en-IN')]),
                  columnStyles: { 1: { halign: 'right' as const }, 2: { halign: 'right' as const }, 3: { halign: 'right' as const } },
                },
              ]),
          {
            title: `Trip Detail (${filteredRecords.length})`,
            head: ['#', 'Date', 'Vehicle', 'KM (Start -> End)', 'Total KM', 'Diesel (Rs)', 'Load', 'Type/Customer', 'Place'],
            body: filteredRecords.map((r, i) => [
              i + 1,
              dateLabel(r.date),
              r.vehicle_name,
              `${r.starting_km} -> ${r.ending_km}`,
              r.total_km,
              Number(r.diesel_fare || 0).toLocaleString('en-IN'),
              r.load_name || '-',
              r.load_type === 'Rent' ? `Rent / ${r.customer_name || '-'}` : 'Own',
              r.place || '-',
            ]),
            columnStyles: { 4: { halign: 'right' as const }, 5: { halign: 'right' as const } },
          },
          ...(filteredBills.length > 0
            ? [
                {
                  title: `Diesel Bills (${filteredBills.length})`,
                  head: ['Date', 'Driver', 'Vehicle', 'Note', 'Amount (Rs)'],
                  body: filteredBills.map((b: any) => [dateLabel(b.date), b.driver_name, b.vehicle_name || '-', b.note || '-', Number(b.amount || 0).toLocaleString('en-IN')]),
                  columnStyles: { 4: { halign: 'right' as const } },
                },
              ]
            : []),
        ],
      });
      await downloadPdfReport({ doc, filename });
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadSingleTrip = async (r: any) => {
    setDownloading(true);
    try {
      const pdf = await buildSingleDriverTripPdfDoc({
        driverName: r.driver_name,
        vehicleName: r.vehicle_name,
        date: r.date,
        startingKm: r.starting_km,
        endingKm: r.ending_km,
        totalKm: r.total_km,
        distance: r.distance,
        loadName: r.load_name,
        loadType: r.load_type,
        customerName: r.customer_name,
        place: r.place,
        loadWeight: r.load_weight,
        startingTime: r.starting_time,
        endingTime: r.ending_time,
        dieselFare: r.diesel_fare,
      });
      await downloadPdfReport(pdf);
    } finally {
      setDownloading(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (filteredRecords.length === 0) return;
    setDownloading(true);
    try {
      const pdf = await buildPdfReport({
        filename: `${driverFilter ? driverFilter.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'driver'}-trip-report.pdf`,
        title: reportTitle,
        subtitle: rangeLabel,
        orientation: 'landscape',
        summaryBoxes: [
          { label: 'Total Trips', value: filteredRecords.length.toString() },
          { label: 'Total KM', value: totalKm.toLocaleString('en-IN') },
          { label: 'Total Diesel Fare', value: rupees(totalDiesel), color: '#e23744' },
        ],
        tables: [
          ...(driverFilter
            ? []
            : [
                {
                  title: 'Vehicle-wise Summary',
                  head: ['Vehicle', 'Trips', 'Total KM', 'Diesel Fare (Rs)'],
                  body: byVehicle.map((v) => [v.name, v.trips, v.total_km.toLocaleString('en-IN'), v.diesel_fare.toLocaleString('en-IN')]),
                  columnStyles: { 1: { halign: 'right' as const }, 2: { halign: 'right' as const }, 3: { halign: 'right' as const } },
                },
                {
                  title: 'Driver-wise Summary',
                  head: ['Driver', 'Trips', 'Total KM', 'Diesel Fare (Rs)'],
                  body: byDriver.map((v) => [v.name, v.trips, v.total_km.toLocaleString('en-IN'), v.diesel_fare.toLocaleString('en-IN')]),
                  columnStyles: { 1: { halign: 'right' as const }, 2: { halign: 'right' as const }, 3: { halign: 'right' as const } },
                },
              ]),
        ],
      });
      const text = `${reportTitle} (${rangeLabel})\nTotal Trips: ${filteredRecords.length}\nTotal KM: ${totalKm.toLocaleString('en-IN')}\nTotal Diesel Fare: ${rupees(totalDiesel)}`;
      await sharePdfReportOnWhatsApp(pdf, text);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Driver Reports</h1>
      <p className="page-subtitle">
        {driverFilter ? `Trip records and diesel bills for ${driverFilter}.` : 'Trip records and diesel bills across all drivers.'}
      </p>

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

      {driverNames.length > 0 && (
        <div className="filter-row">
          <SelectField
            label="DRIVER"
            value={driverFilter || ''}
            placeholder={`All Drivers (${driverNames.length})`}
            onChange={(v) => setDriverFilter(v || null)}
            options={driverNames.map((name) => ({ value: name, label: name }))}
          />
        </div>
      )}

      {loading ? (
        <div className="empty-note">Loading…</div>
      ) : (
        <>
          <div className="summary-row">
            <SummaryCard label="Total Trips" value={filteredRecords.length.toString()} icon={Truck} />
            <SummaryCard label="Total KM" value={totalKm.toLocaleString('en-IN')} icon={Route} />
            <SummaryCard label="Total Diesel Fare" value={rupees(totalDiesel)} color="#e23744" icon={Fuel} />
          </div>

          <div className="toolbar no-print" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={handleDownload} disabled={downloading || filteredRecords.length === 0}>
              <Download size={16} />
              {downloading ? 'Building PDF…' : driverFilter ? `Download ${driverFilter}'s PDF` : 'Download PDF'}
            </button>
            <button className="btn whatsapp" onClick={handleShareWhatsApp} disabled={downloading || filteredRecords.length === 0}>
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

          {!driverFilter && (
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
          )}

          <div className="card">
            <h3 className="section-heading">Trip Detail ({filteredRecords.length})</h3>
            <DataTable<any>
              rowKey={(r) => r.id}
              rows={filteredRecords}
              emptyText="No trips recorded for this selection."
              columns={[
                { header: 'Date', render: (r: any) => dateLabel(r.date) },
                ...(driverFilter ? [] : [{ header: 'Driver', render: (r: any) => r.driver_name || '—' }]),
                { header: 'Vehicle', render: (r: any) => r.vehicle_name || '—' },
                { header: 'KM (Start→End)', render: (r: any) => `${r.starting_km}→${r.ending_km}` },
                { header: 'Total KM', align: 'right', render: (r: any) => Number(r.total_km || 0).toLocaleString('en-IN') },
                { header: 'Diesel', align: 'right', render: (r: any) => rupees(r.diesel_fare) },
                { header: 'Load / Place', render: (r: any) => `${r.load_name || '-'} • ${r.place || '-'}` },
                {
                  header: 'Actions',
                  align: 'right',
                  render: (r: any) => (
                    <button className="icon-btn" onClick={() => handleDownloadSingleTrip(r)} disabled={downloading} title="Download this trip as a PDF">
                      <Download size={13} /> PDF
                    </button>
                  ),
                },
              ]}
            />
          </div>

          <div className="card">
            <h3 className="section-heading">Diesel Bills ({filteredBills.length})</h3>
            <DataTable<any>
              rowKey={(b) => b.id}
              rows={filteredBills}
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
