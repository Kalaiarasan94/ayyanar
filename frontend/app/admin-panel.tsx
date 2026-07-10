import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { MaterialIcons } from '@expo/vector-icons';
import AppBackground from './components/AppBackground';
import LogoutButton from '../components/LogoutButton';
import { accountsService, adminService, fieldService } from '../services/api';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/Theme';

type AdminTab = 'DASHBOARD' | 'ATTENDANCE' | 'PROJECTS' | 'TEAM' | 'LEADS' | 'REPORTS';
type StaffRole = 'Supervisor' | 'Driver' | 'Site Engineer';

interface Staff {
  id: string;
  name: string;
  role: StaffRole | 'Admin' | 'Accounts';
  phone: string;
  username?: string;
}

interface Site {
  id: string;
  name: string;
  location: string;
  supervisor_id?: string;
  supervisor_name?: string;
}

interface Lead {
  id: string;
  name: string;
  project_needed: string;
  source: string;
  status: 'Hot Lead' | 'In Discussion' | 'Converted Client';
}

const adminTabs: { id: AdminTab; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { id: 'DASHBOARD', label: 'Overview', icon: 'space-dashboard' },
  { id: 'ATTENDANCE', label: 'Attendance', icon: 'fact-check' },
  { id: 'PROJECTS', label: 'Projects', icon: 'business' },
  { id: 'TEAM', label: 'Team', icon: 'badge' },
  { id: 'LEADS', label: 'Leads', icon: 'groups' },
  { id: 'REPORTS', label: 'Reports', icon: 'summarize' },
];

const getBillImageUris = (imageUrl?: string | null) => {
  if (!imageUrl) return [];
  return imageUrl.split('||').map((uri) => uri.trim()).filter(Boolean);
};

const todayIso = () => new Date().toISOString().split('T')[0];

export default function AdminPanelScreen() {
  const [activeTab, setActiveTab] = useState<AdminTab>('DASHBOARD');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [analytics, setAnalytics] = useState<any>(null);
  const [attendance, setAttendance] = useState<any>({ workers: [], supervisors: [] });
  const [attendanceDate, setAttendanceDate] = useState(todayIso());
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [sitesList, setSitesList] = useState<Site[]>([]);
  const [leadsList, setLeadsList] = useState<Lead[]>([]);
  const [reportSiteId, setReportSiteId] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any[]>([]);
  const [reportType, setReportType] = useState<'SITE' | 'DRIVER' | 'IO'>('SITE');
  const [driverRecords, setDriverRecords] = useState<any[]>([]);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [ioRole, setIoRole] = useState<'Admin' | 'Supervisor' | 'Owner'>('Admin');
  const [ioFrom, setIoFrom] = useState('');
  const [ioTo, setIoTo] = useState('');
  const [ioReport, setIoReport] = useState<any>(null);

  const [staffName, setStaffName] = useState('');
  const [staffUsername, setStaffUsername] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRole, setStaffRole] = useState<StaffRole>('Supervisor');
  const [staffPhone, setStaffPhone] = useState('');

  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteLocation, setNewSiteLocation] = useState('');
  const [selectedSiteForAllocation, setSelectedSiteForAllocation] = useState<string | null>(null);
  const [selectedSupervisorForAllocation, setSelectedSupervisorForAllocation] = useState<string | null>(null);

  const [leadName, setLeadName] = useState('');
  const [leadProject, setLeadProject] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [leadStatus, setLeadStatus] = useState<Lead['status']>('Hot Lead');

  const supervisors = useMemo(() => staffList.filter((staff) => staff.role === 'Supervisor'), [staffList]);
  const dashboardStats = useMemo(() => {
    const siteExpenses = analytics?.siteWiseExpenseBreakdown || [];
    const leadMetrics = analytics?.leadsChannelPerformance || [];
    return {
      activeSites: sitesList.length,
      staff: staffList.length,
      leads: leadMetrics.reduce((sum: number, item: any) => sum + Number(item.total_leads || 0), 0),
      conversions: leadMetrics.reduce((sum: number, item: any) => sum + Number(item.converted_leads || 0), 0),
      spend: siteExpenses.reduce((sum: number, item: any) => sum + Number(item.total_expenses || 0), 0),
    };
  }, [analytics, sitesList.length, staffList.length]);

  const fetchDashboard = async () => {
    const [analyticsData, sitesData, staffData, leadsData] = await Promise.all([
      adminService.getAnalytics(),
      adminService.getSites(),
      adminService.getStaff(),
      adminService.getLeads(),
    ]);
    setAnalytics(analyticsData);
    setSitesList(sitesData);
    setStaffList(staffData);
    setLeadsList(leadsData);
  };

  const fetchAttendance = async () => {
    const data = await adminService.getAttendanceOverview(attendanceDate);
    setAttendance(data || { workers: [], supervisors: [] });
  };

  const fetchSitesAndStaff = async () => {
    const [sitesData, staffData] = await Promise.all([adminService.getSites(), adminService.getStaff()]);
    setSitesList(sitesData);
    setStaffList(staffData);
  };

  const fetchReportData = async (siteId = reportSiteId) => {
    if (!siteId) return;
    const data = await fieldService.getLedgerBySite(siteId);
    setReportData(data);
  };

  const loadTab = async (tab = activeTab) => {
    setLoading(true);
    try {
      if (tab === 'DASHBOARD') await fetchDashboard();
      if (tab === 'ATTENDANCE') await fetchAttendance();
      if (tab === 'PROJECTS') await fetchSitesAndStaff();
      if (tab === 'TEAM') setStaffList(await adminService.getStaff());
      if (tab === 'LEADS') setLeadsList(await adminService.getLeads());
      if (tab === 'REPORTS') {
        const [sites, drivers] = await Promise.all([
          adminService.getSites(),
          fieldService.getDriverRecords(),
        ]);
        setSitesList(sites);
        setDriverRecords(drivers);
        const selectedSite = reportSiteId || sites[0]?.id || null;
        setReportSiteId(selectedSite);
        if (selectedSite) await fetchReportData(selectedSite);
      }
    } catch (error) {
      Alert.alert('Data Error', 'Unable to load this admin workspace.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTab();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'ATTENDANCE') {
      loadTab('ATTENDANCE');
    }
  }, [attendanceDate]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTab();
  };

  const handleAddStaff = async () => {
    if (!staffName || !staffPhone || !staffUsername || !staffPassword) {
      Alert.alert('Missing Details', 'Fill staff name, phone, username, and password.');
      return;
    }
    setLoading(true);
    try {
      // Trim so the saved username/password match exactly what the staff member will type at login
      await adminService.addStaff({
        name: staffName.trim(),
        username: staffUsername.trim().toLowerCase(),
        role: staffRole,
        phone: staffPhone.trim(),
        password: staffPassword.trim(),
      });
      setStaffName('');
      setStaffUsername('');
      setStaffPassword('');
      setStaffPhone('');
      await loadTab('TEAM');
    } catch {
      Alert.alert('Staff Error', 'Unable to create staff account.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStaff = (id: string) => {
    Alert.alert('Remove Staff', 'Delete this staff account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await adminService.deleteStaff(id);
          loadTab('TEAM');
        },
      },
    ]);
  };

  const handleAddSite = async () => {
    if (!newSiteName || !newSiteLocation) {
      Alert.alert('Missing Details', 'Enter project site name and location.');
      return;
    }
    setLoading(true);
    try {
      await adminService.createSite({ name: newSiteName, location: newSiteLocation });
      setNewSiteName('');
      setNewSiteLocation('');
      await loadTab('PROJECTS');
    } catch {
      Alert.alert('Project Error', 'Unable to create project site.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSite = (id: string) => {
    Alert.alert('Delete Project', 'Remove this project site?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await adminService.deleteSite(id);
          loadTab('PROJECTS');
        },
      },
    ]);
  };

  const handleAllocateSupervisor = async () => {
    if (!selectedSiteForAllocation || !selectedSupervisorForAllocation) {
      Alert.alert('Select Details', 'Choose a project and supervisor.');
      return;
    }
    setLoading(true);
    try {
      await adminService.allocateSupervisor(selectedSupervisorForAllocation, selectedSiteForAllocation);
      setSelectedSiteForAllocation(null);
      setSelectedSupervisorForAllocation(null);
      await loadTab('PROJECTS');
    } catch {
      Alert.alert('Allocation Error', 'Unable to update supervisor allocation.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLead = async () => {
    if (!leadName || !leadProject || !leadSource) {
      Alert.alert('Missing Details', 'Fill lead name, requirement, and source.');
      return;
    }
    setLoading(true);
    try {
      await adminService.createLead({ name: leadName, projectNeeded: leadProject, source: leadSource, status: leadStatus });
      setLeadName('');
      setLeadProject('');
      setLeadSource('');
      setLeadStatus('Hot Lead');
      await loadTab('LEADS');
    } catch {
      Alert.alert('Lead Error', 'Unable to create lead.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLeadStatus = async (id: string, status: Lead['status']) => {
    await adminService.updateLeadStatus(id, status);
    loadTab('LEADS');
  };

  const selectReportSite = async (siteId: string) => {
    setReportSiteId(siteId);
    setLoading(true);
    try {
      await fetchReportData(siteId);
    } finally {
      setLoading(false);
    }
  };

  const fetchIoReport = async (role = ioRole, from = ioFrom, to = ioTo) => {
    const dateOk = (v: string) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v);
    if (!dateOk(from) || !dateOk(to)) {
      Alert.alert('Invalid Date', 'Use the YYYY-MM-DD format, e.g., 2026-07-01.');
      return;
    }
    setLoading(true);
    try {
      setIoReport(await accountsService.getIOReport(role, from || undefined, to || undefined));
    } catch {
      Alert.alert('Data Error', 'Unable to load the I/O report.');
    } finally {
      setLoading(false);
    }
  };

  const ioRangeTitle = ioFrom || ioTo ? `${ioFrom || 'Beginning'} to ${ioTo || 'Today'}` : 'All Time';

  const buildIoReportHtml = () => {
    const rows = (ioReport?.rows || [])
      .map(
        (r: any, index: number) => `
        <tr style="background:${index % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
          <td>${new Date(r.date).toLocaleDateString('en-IN')}</td>
          <td style="text-align:right; color:#15803D;">${r.input ? Number(r.input).toLocaleString('en-IN') : '-'}</td>
          <td style="text-align:right; color:#E21A12;">${r.output ? Number(r.output).toLocaleString('en-IN') : '-'}</td>
          <td style="text-align:right; font-weight:bold;">${Number(r.balance).toLocaleString('en-IN')}</td>
        </tr>`
      )
      .join('');

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Helvetica, Arial, sans-serif; padding: 28px; color: #0F172A; }
            h1 { color: #E21A12; font-size: 20px; margin-bottom: 2px; }
            .sub { color: #64748B; font-size: 11px; margin-bottom: 18px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { background: #0F172A; color: #FFF; padding: 8px 6px; text-align: left; }
            th.r { text-align: right; }
            td { padding: 7px 6px; border-bottom: 1px solid #E2E8F0; }
          </style>
        </head>
        <body>
          <h1>Ayyanar Construction — ${ioRole} I/O Report</h1>
          <div class="sub">Date-wise Input / Output / Balance &bull; ${ioRangeTitle} &bull; Generated on ${new Date().toLocaleString('en-IN')}</div>
          <table>
            <thead>
              <tr><th>Date</th><th class="r">Input (Rs)</th><th class="r">Output (Rs)</th><th class="r">Balance (Rs)</th></tr>
            </thead>
            <tbody>
              ${ioFrom ? `<tr><td><i>Opening Balance</i></td><td></td><td></td><td style="text-align:right; font-weight:bold;">${Number(ioReport?.opening || 0).toLocaleString('en-IN')}</td></tr>` : ''}
              ${rows}
              <tr style="background:#0F172A; color:#FFF; font-weight:bold;">
                <td>TOTAL</td>
                <td style="text-align:right;">${Number(ioReport?.totals?.input || 0).toLocaleString('en-IN')}</td>
                <td style="text-align:right;">${Number(ioReport?.totals?.output || 0).toLocaleString('en-IN')}</td>
                <td style="text-align:right;">${Number(ioReport?.totals?.closing || 0).toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>`;
  };

  const handleIoPdf = async (viaWhatsApp: boolean) => {
    if (!ioReport || (ioReport.rows || []).length === 0) {
      Alert.alert('No Data', 'There are no transactions for this account in the selected range.');
      return;
    }
    setGeneratingPdf(true);
    try {
      if (Platform.OS === 'web') {
        if (viaWhatsApp) {
          const text =
            `*Ayyanar Construction - ${ioRole} I/O Report*\n` +
            `Period: ${ioRangeTitle}\n` +
            `Total Input: Rs ${Number(ioReport.totals.input).toLocaleString('en-IN')}\n` +
            `Total Output: Rs ${Number(ioReport.totals.output).toLocaleString('en-IN')}\n` +
            `Closing Balance: Rs ${Number(ioReport.totals.closing).toLocaleString('en-IN')}`;
          await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
        } else {
          await Print.printAsync({ html: buildIoReportHtml() });
        }
        return;
      }
      const { uri } = await Print.printToFileAsync({ html: buildIoReportHtml() });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: viaWhatsApp ? 'Share I/O Report on WhatsApp' : `${ioRole} I/O Report`,
        });
      } else {
        Alert.alert('Saved', `PDF generated at:\n${uri}`);
      }
    } catch (error: any) {
      Alert.alert('PDF Error', error?.message || 'Unable to generate the I/O report.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const buildDriverReportHtml = () => {
    const rows = driverRecords
      .map(
        (rec: any, index: number) => `
        <tr style="background:${index % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
          <td>${index + 1}</td>
          <td>${new Date(rec.date).toLocaleDateString('en-IN')}</td>
          <td>${rec.vehicle_name || '-'}</td>
          <td>${rec.driver_name || '-'}</td>
          <td>${Number(rec.starting_km || 0)}</td>
          <td>${Number(rec.ending_km || 0)}</td>
          <td><b>${Number(rec.total_km || 0)}</b></td>
          <td>${rec.distance || '-'}</td>
          <td>Rs ${Number(rec.diesel_fare || 0).toLocaleString('en-IN')}</td>
          <td>${rec.load_name || '-'}</td>
          <td>${rec.load_type || '-'}</td>
          <td>${rec.customer_name || '-'}</td>
          <td>${rec.place || '-'}</td>
          <td>${rec.load_weight || '-'}</td>
          <td>${rec.starting_time || '-'}</td>
          <td>${rec.ending_time || '-'}</td>
        </tr>`
      )
      .join('');

    const totalKmSum = driverRecords.reduce((sum: number, rec: any) => sum + Number(rec.total_km || 0), 0);
    const dieselSum = driverRecords.reduce((sum: number, rec: any) => sum + Number(rec.diesel_fare || 0), 0);

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Helvetica, Arial, sans-serif; padding: 24px; color: #0F172A; }
            h1 { color: #E21A12; font-size: 20px; margin-bottom: 2px; }
            .sub { color: #64748B; font-size: 11px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 9px; }
            th { background: #0F172A; color: #FFFFFF; padding: 6px 4px; text-align: left; }
            td { padding: 5px 4px; border-bottom: 1px solid #E2E8F0; }
            .summary { margin-top: 14px; font-size: 12px; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Ayyanar Construction - Driver Trip Report</h1>
          <div class="sub">Generated on ${new Date().toLocaleString('en-IN')} &bull; ${driverRecords.length} record(s)</div>
          <table>
            <thead>
              <tr>
                <th>#</th><th>Date</th><th>Vehicle</th><th>Driver</th>
                <th>Start KM</th><th>End KM</th><th>Total KM</th><th>Distance</th>
                <th>Diesel Fare</th><th>Load</th><th>Type</th><th>Customer</th>
                <th>Place</th><th>Weight</th><th>Start Time</th><th>End Time</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="summary">
            Total KM Travelled: ${totalKmSum.toLocaleString('en-IN')} km &nbsp;&bull;&nbsp;
            Total Diesel Fare: Rs ${dieselSum.toLocaleString('en-IN')}
          </div>
        </body>
      </html>`;
  };

  const generateDriverPdf = async () => {
    const html = buildDriverReportHtml();
    const { uri } = await Print.printToFileAsync({ html });
    return uri;
  };

  const handleDownloadDriverPdf = async () => {
    if (driverRecords.length === 0) {
      Alert.alert('No Data', 'There are no driver records to export yet.');
      return;
    }
    setGeneratingPdf(true);
    try {
      if (Platform.OS === 'web') {
        // On web expo-print opens the browser print dialog; user picks "Save as PDF"
        await Print.printAsync({ html: buildDriverReportHtml() });
        return;
      }
      const uri = await generateDriverPdf();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: 'Download Driver Report PDF',
        });
      } else {
        Alert.alert('Saved', `PDF generated at:\n${uri}`);
      }
    } catch (error: any) {
      Alert.alert('PDF Error', error?.message || 'Unable to generate the driver report PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleShareDriverWhatsApp = async () => {
    if (driverRecords.length === 0) {
      Alert.alert('No Data', 'There are no driver records to share yet.');
      return;
    }
    setGeneratingPdf(true);
    try {
      if (Platform.OS === 'web') {
        // Browsers cannot attach a local file to WhatsApp; share a text summary instead
        const totalKmSum = driverRecords.reduce((sum: number, rec: any) => sum + Number(rec.total_km || 0), 0);
        const dieselSum = driverRecords.reduce((sum: number, rec: any) => sum + Number(rec.diesel_fare || 0), 0);
        const latest = driverRecords[0];
        const text =
          `*Ayyanar Construction - Driver Trip Report*\n` +
          `Records: ${driverRecords.length}\n` +
          `Total KM: ${totalKmSum.toLocaleString('en-IN')} km\n` +
          `Total Diesel Fare: Rs ${dieselSum.toLocaleString('en-IN')}\n` +
          (latest ? `Latest Trip: ${latest.vehicle_name} by ${latest.driver_name} (${Number(latest.total_km || 0)} km)` : '');
        await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
        return;
      }
      // On native, generate the PDF and open the share sheet — pick WhatsApp there
      const uri = await generateDriverPdf();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: 'Share Driver Report on WhatsApp',
        });
      } else {
        Alert.alert('Sharing Unavailable', 'Sharing is not available on this device.');
      }
    } catch (error: any) {
      Alert.alert('Share Error', error?.message || 'Unable to share the driver report.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const renderDashboard = () => (
    <View>
      <Text style={styles.screenTitle}>Admin Overview</Text>
      <Text style={styles.screenSubtitle}>Operations, projects, team, and sales pipeline in one place.</Text>

      <View style={styles.metricsGrid}>
        <MetricCard icon="business" label="Projects" value={dashboardStats.activeSites.toString()} />
        <MetricCard icon="badge" label="Staff" value={dashboardStats.staff.toString()} />
        <MetricCard icon="groups" label="Leads" value={dashboardStats.leads.toString()} />
        <MetricCard icon="trending-up" label="Converted" value={dashboardStats.conversions.toString()} />
      </View>

      <View style={styles.heroPanel}>
        <View>
          <Text style={styles.heroLabel}>Total Site Spend</Text>
          <Text style={styles.heroValue}>Rs {dashboardStats.spend.toLocaleString()}</Text>
        </View>
        <MaterialIcons name="query-stats" size={34} color={COLORS.white} />
      </View>

      <SectionTitle title="Project Cost Snapshot" />
      <View style={styles.card}>
        {(analytics?.siteWiseExpenseBreakdown || []).slice(0, 5).map((site: any) => (
          <View key={site.id} style={styles.costRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{site.site_name}</Text>
              <Text style={styles.rowMeta}>Direct Rs {Number(site.direct_expenses || 0).toLocaleString()} / Credit Rs {Number(site.indirect_expenses || 0).toLocaleString()}</Text>
            </View>
            <Text style={styles.rowAmount}>Rs {Number(site.total_expenses || 0).toLocaleString()}</Text>
          </View>
        ))}
        {(!analytics?.siteWiseExpenseBreakdown || analytics.siteWiseExpenseBreakdown.length === 0) && <EmptyState text="No project cost data yet." />}
      </View>
    </View>
  );

  const renderAttendance = () => {
    const workerCount = attendance?.workers?.length || 0;
    const supervisorCount = attendance?.supervisors?.length || 0;
    return (
      <View>
        <Text style={styles.screenTitle}>Daily Attendance</Text>
        <Text style={styles.screenSubtitle}>Review supervisor check-ins and worker headcount by date.</Text>

        <View style={styles.dateRow}>
          <TouchableOpacity style={styles.dateButton} onPress={() => setAttendanceDate(todayIso())}>
            <MaterialIcons name="today" size={18} color={COLORS.primary} />
            <Text style={styles.dateButtonText}>Today</Text>
          </TouchableOpacity>
          <TextInput style={styles.dateInput} value={attendanceDate} onChangeText={setAttendanceDate} placeholder="YYYY-MM-DD" />
        </View>

        <View style={styles.metricsGrid}>
          <MetricCard icon="engineering" label="Workers" value={workerCount.toString()} />
          <MetricCard icon="verified-user" label="Supervisors" value={supervisorCount.toString()} />
        </View>

        <SectionTitle title="Supervisor Attendance" />
        <View style={styles.card}>
          {(attendance?.supervisors || []).map((item: any) => (
            <AttendanceRow
              key={`supervisor-${item.id}`}
              icon="person-pin-circle"
              title={item.supervisor_name || 'Supervisor'}
              subtitle={`${item.site_name || 'Unassigned Site'} / ${item.location_name || item.site_location || 'Location not recorded'}`}
              status={item.status}
              imageUrl={item.selfie_url}
              latitude={item.latitude}
              longitude={item.longitude}
            />
          ))}
          {supervisorCount === 0 && <EmptyState text="No supervisor attendance for this date." />}
        </View>

        <SectionTitle title="Worker Attendance" />
        <View style={styles.card}>
          {(attendance?.workers || []).map((item: any) => (
            <AttendanceRow
              key={`worker-${item.id}`}
              icon="engineering"
              title={item.worker_name || 'Worker'}
              subtitle={`${item.worker_role || 'Worker'} / ${item.site_name || 'Site not recorded'}`}
              status={item.status}
            />
          ))}
          {workerCount === 0 && <EmptyState text="No worker attendance for this date." />}
        </View>
      </View>
    );
  };

  const renderProjects = () => (
    <View>
      <Text style={styles.screenTitle}>Projects</Text>
      <Text style={styles.screenSubtitle}>Create sites and assign supervisors without leaving admin.</Text>

      <View style={styles.card}>
        <Text style={styles.formTitle}>New Project Site</Text>
        <TextInput style={styles.input} placeholder="Project site name" value={newSiteName} onChangeText={setNewSiteName} placeholderTextColor={COLORS.textLight} />
        <TextInput style={styles.input} placeholder="Location / address" value={newSiteLocation} onChangeText={setNewSiteLocation} placeholderTextColor={COLORS.textLight} />
        <PrimaryButton label="Create Project" icon="add-business" onPress={handleAddSite} />
      </View>

      <View style={styles.card}>
        <Text style={styles.formTitle}>Supervisor Allocation</Text>
        <ChipSelect items={sitesList.map((site) => ({ id: site.id, label: site.name }))} value={selectedSiteForAllocation} onChange={setSelectedSiteForAllocation} />
        <ChipSelect items={supervisors.map((staff) => ({ id: staff.id, label: staff.name }))} value={selectedSupervisorForAllocation} onChange={setSelectedSupervisorForAllocation} />
        <PrimaryButton label="Update Allocation" icon="sync-alt" onPress={handleAllocateSupervisor} />
      </View>

      <SectionTitle title="Active Projects" />
      {sitesList.map((site) => (
        <View key={site.id} style={styles.listCard}>
          <View style={styles.listIcon}><MaterialIcons name="business" size={22} color={COLORS.primary} /></View>
          <View style={styles.listContent}>
            <Text style={styles.rowTitle}>{site.name}</Text>
            <Text style={styles.rowMeta}>{site.location}</Text>
            <Text style={styles.assignmentText}>{site.supervisor_name ? `Supervisor: ${site.supervisor_name}` : 'Supervisor not assigned'}</Text>
          </View>
          <TouchableOpacity style={styles.iconButton} onPress={() => handleDeleteSite(site.id)}>
            <MaterialIcons name="delete-outline" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );

  const renderTeam = () => (
    <View>
      <Text style={styles.screenTitle}>Team</Text>
      <Text style={styles.screenSubtitle}>Manage supervisors, site engineers, and drivers.</Text>

      <View style={styles.card}>
        <Text style={styles.formTitle}>Create Staff Login</Text>
        <TextInput style={styles.input} placeholder="Full name" value={staffName} onChangeText={setStaffName} placeholderTextColor={COLORS.textLight} />
        <TextInput style={styles.input} placeholder="Phone number" value={staffPhone} onChangeText={setStaffPhone} placeholderTextColor={COLORS.textLight} keyboardType="phone-pad" />
        <TextInput style={styles.input} placeholder="Username" value={staffUsername} onChangeText={setStaffUsername} placeholderTextColor={COLORS.textLight} autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="Password" value={staffPassword} onChangeText={setStaffPassword} placeholderTextColor={COLORS.textLight} secureTextEntry />
        <ChipSelect
          items={(['Supervisor', 'Site Engineer', 'Driver'] as StaffRole[]).map((role) => ({ id: role, label: role }))}
          value={staffRole}
          onChange={(role) => setStaffRole(role as StaffRole)}
        />
        <PrimaryButton label="Create Staff Account" icon="person-add" onPress={handleAddStaff} />
      </View>

      <SectionTitle title="Staff Directory" />
      {staffList.map((staff) => (
        <View key={staff.id} style={styles.listCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{staff.name?.charAt(0)?.toUpperCase() || 'S'}</Text></View>
          <View style={styles.listContent}>
            <Text style={styles.rowTitle}>{staff.name}</Text>
            <Text style={styles.rowMeta}>{staff.role} / {staff.phone}</Text>
          </View>
          <TouchableOpacity style={styles.iconButton} onPress={() => handleDeleteStaff(staff.id)}>
            <MaterialIcons name="delete-outline" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );

  const renderLeads = () => (
    <View>
      <Text style={styles.screenTitle}>CRM Leads</Text>
      <Text style={styles.screenSubtitle}>Track enquiry flow from lead to converted client.</Text>

      <View style={styles.card}>
        <Text style={styles.formTitle}>Register Lead</Text>
        <TextInput style={styles.input} placeholder="Client / lead name" value={leadName} onChangeText={setLeadName} placeholderTextColor={COLORS.textLight} />
        <Text style={styles.fieldCaption}>PROJECT REQUIREMENT</Text>
        <ChipSelect
          items={['Construction', 'Aggregate'].map((option) => ({ id: option, label: option }))}
          value={leadProject || null}
          onChange={setLeadProject}
        />
        <TextInput style={styles.input} placeholder="Lead source" value={leadSource} onChangeText={setLeadSource} placeholderTextColor={COLORS.textLight} />
        <ChipSelect
          items={(['Hot Lead', 'In Discussion', 'Converted Client'] as Lead['status'][]).map((status) => ({ id: status, label: status }))}
          value={leadStatus}
          onChange={(status) => setLeadStatus(status as Lead['status'])}
        />
        <PrimaryButton label="Register Lead" icon="add" onPress={handleAddLead} />
      </View>

      <SectionTitle title="Lead Pipeline" />
      {leadsList.map((lead) => (
        <View key={lead.id} style={styles.card}>
          <View style={styles.pipelineHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{lead.name}</Text>
              <Text style={styles.rowMeta}>{lead.project_needed}</Text>
              <Text style={styles.assignmentText}>Source: {lead.source}</Text>
            </View>
            <StatusPill status={lead.status} />
          </View>
          <ChipSelect
            items={(['Hot Lead', 'In Discussion', 'Converted Client'] as Lead['status'][]).map((status) => ({ id: status, label: status }))}
            value={lead.status}
            onChange={(status) => handleUpdateLeadStatus(lead.id, status as Lead['status'])}
          />
        </View>
      ))}
    </View>
  );

  const renderSiteReports = () => {
    const direct = reportData.filter((item) => item.payment_mode === 'Direct');
    const credit = reportData.filter((item) => item.payment_mode !== 'Direct');
    return (
      <View>
        <ChipSelect items={sitesList.map((site) => ({ id: site.id, label: site.name }))} value={reportSiteId} onChange={selectReportSite} />

        <SectionTitle title="Direct Cash" />
        <LedgerList data={direct} empty="No direct cash records." />

        <SectionTitle title="Credit / Vendor Bills" />
        <LedgerList data={credit} empty="No credit bill records." />
      </View>
    );
  };

  const renderDriverReports = () => (
    <View>
      <View style={styles.pdfActionsRow}>
        <TouchableOpacity style={[styles.pdfButton, generatingPdf && { opacity: 0.6 }]} onPress={handleDownloadDriverPdf} disabled={generatingPdf}>
          {generatingPdf ? <ActivityIndicator color={COLORS.white} size="small" /> : <MaterialIcons name="picture-as-pdf" size={18} color={COLORS.white} />}
          <Text style={styles.pdfButtonText}>Download PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pdfButton, styles.whatsappButton, generatingPdf && { opacity: 0.6 }]} onPress={handleShareDriverWhatsApp} disabled={generatingPdf}>
          <MaterialIcons name="share" size={18} color={COLORS.white} />
          <Text style={styles.pdfButtonText}>Share on WhatsApp</Text>
        </TouchableOpacity>
      </View>

      <SectionTitle title={`Driver Trip Records (${driverRecords.length})`} />
      <View style={styles.card}>
        {driverRecords.map((rec: any) => (
          <View key={rec.id} style={styles.ledgerCard}>
            <View style={styles.pipelineHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{rec.vehicle_name} — {rec.driver_name}</Text>
                <Text style={styles.rowMeta}>
                  {new Date(rec.date).toLocaleDateString('en-IN')} / {rec.starting_time || '--'} to {rec.ending_time || '--'}
                </Text>
                <Text style={styles.rowMeta}>
                  KM: {Number(rec.starting_km)} → {Number(rec.ending_km)} (Total {Number(rec.total_km)} km)
                  {rec.distance ? ` / Distance: ${rec.distance}` : ''}
                </Text>
                <Text style={styles.rowMeta}>
                  Load: {rec.load_name || '-'} ({rec.load_type}){rec.load_weight ? ` / ${rec.load_weight}` : ''}
                  {rec.customer_name ? ` / Customer: ${rec.customer_name}` : ''}
                  {rec.place ? ` / ${rec.place}` : ''}
                </Text>
              </View>
              <Text style={styles.rowAmount}>Rs {Number(rec.diesel_fare || 0).toLocaleString()}</Text>
            </View>
          </View>
        ))}
        {driverRecords.length === 0 && <EmptyState text="No driver trip records yet." />}
      </View>
    </View>
  );

  const renderIoReports = () => (
    <View>
      <Text style={styles.formTitle}>Account</Text>
      <ChipSelect
        items={(['Admin', 'Supervisor', 'Owner'] as const).map((r) => ({ id: r, label: r }))}
        value={ioRole}
        onChange={(r) => {
          setIoRole(r as 'Admin' | 'Supervisor' | 'Owner');
          fetchIoReport(r as 'Admin' | 'Supervisor' | 'Owner');
        }}
      />

      <View style={styles.card}>
        <Text style={styles.formTitle}>Pick Date Range (YYYY-MM-DD)</Text>
        <View style={styles.dateRow}>
          <TextInput style={styles.dateInput} placeholder="From: 2026-07-01" placeholderTextColor={COLORS.textLight} value={ioFrom} onChangeText={setIoFrom} />
          <TextInput style={styles.dateInput} placeholder="To: 2026-07-31" placeholderTextColor={COLORS.textLight} value={ioTo} onChangeText={setIoTo} />
        </View>
        <PrimaryButton label="Apply Date Range" icon="filter-alt" onPress={() => fetchIoReport()} />
      </View>

      <View style={styles.pdfActionsRow}>
        <TouchableOpacity style={[styles.pdfButton, generatingPdf && { opacity: 0.6 }]} onPress={() => handleIoPdf(false)} disabled={generatingPdf}>
          {generatingPdf ? <ActivityIndicator color={COLORS.white} size="small" /> : <MaterialIcons name="picture-as-pdf" size={18} color={COLORS.white} />}
          <Text style={styles.pdfButtonText}>Download PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pdfButton, styles.whatsappButton, generatingPdf && { opacity: 0.6 }]} onPress={() => handleIoPdf(true)} disabled={generatingPdf}>
          <MaterialIcons name="share" size={18} color={COLORS.white} />
          <Text style={styles.pdfButtonText}>Share on WhatsApp</Text>
        </TouchableOpacity>
      </View>

      <SectionTitle title={`${ioRole} Statement — ${ioRangeTitle}`} />
      <View style={styles.card}>
        <View style={styles.ioHeaderRow}>
          <Text style={[styles.ioHeaderText, { flex: 1.2, textAlign: 'left' }]}>Date</Text>
          <Text style={styles.ioHeaderText}>Input</Text>
          <Text style={styles.ioHeaderText}>Output</Text>
          <Text style={styles.ioHeaderText}>Balance</Text>
        </View>
        {ioFrom ? (
          <View style={styles.ioRow}>
            <Text style={[styles.ioDateCell, { fontStyle: 'italic' }]}>Opening</Text>
            <Text style={styles.ioCell}> </Text>
            <Text style={styles.ioCell}> </Text>
            <Text style={[styles.ioCell, { fontWeight: '900', color: COLORS.text }]}>{Number(ioReport?.opening || 0).toLocaleString('en-IN')}</Text>
          </View>
        ) : null}
        {(ioReport?.rows || []).map((r: any) => (
          <View key={r.date} style={styles.ioRow}>
            <Text style={styles.ioDateCell}>{new Date(r.date).toLocaleDateString('en-IN')}</Text>
            <Text style={[styles.ioCell, { color: COLORS.success }]}>{r.input ? Number(r.input).toLocaleString('en-IN') : '-'}</Text>
            <Text style={[styles.ioCell, { color: COLORS.primary }]}>{r.output ? Number(r.output).toLocaleString('en-IN') : '-'}</Text>
            <Text style={[styles.ioCell, { fontWeight: '900', color: COLORS.text }]}>{Number(r.balance).toLocaleString('en-IN')}</Text>
          </View>
        ))}
        {ioReport && (ioReport.rows || []).length > 0 && (
          <View style={[styles.ioRow, styles.ioTotalRow]}>
            <Text style={[styles.ioDateCell, { fontWeight: '900' }]}>TOTAL</Text>
            <Text style={[styles.ioCell, { color: COLORS.success, fontWeight: '900' }]}>{Number(ioReport.totals.input).toLocaleString('en-IN')}</Text>
            <Text style={[styles.ioCell, { color: COLORS.primary, fontWeight: '900' }]}>{Number(ioReport.totals.output).toLocaleString('en-IN')}</Text>
            <Text style={[styles.ioCell, { fontWeight: '900', color: COLORS.text }]}>{Number(ioReport.totals.closing).toLocaleString('en-IN')}</Text>
          </View>
        )}
        {(!ioReport || (ioReport.rows || []).length === 0) && <EmptyState text="No transactions for this account in the selected range." />}
      </View>
    </View>
  );

  const renderReports = () => (
    <View>
      <Text style={styles.screenTitle}>Reports</Text>
      <Text style={styles.screenSubtitle}>Site ledgers, driver trips, and account I/O statements with PDF export.</Text>

      <ChipSelect
        items={[
          { id: 'SITE', label: 'Site Reports' },
          { id: 'DRIVER', label: 'Driver Reports' },
          { id: 'IO', label: 'I/O Reports' },
        ]}
        value={reportType}
        onChange={(id) => {
          setReportType(id as 'SITE' | 'DRIVER' | 'IO');
          if (id === 'IO') fetchIoReport();
        }}
      />

      {reportType === 'SITE' && renderSiteReports()}
      {reportType === 'DRIVER' && renderDriverReports()}
      {reportType === 'IO' && renderIoReports()}
    </View>
  );

  const renderActiveTab = () => {
    if (activeTab === 'DASHBOARD') return renderDashboard();
    if (activeTab === 'ATTENDANCE') return renderAttendance();
    if (activeTab === 'PROJECTS') return renderProjects();
    if (activeTab === 'TEAM') return renderTeam();
    if (activeTab === 'LEADS') return renderLeads();
    return renderReports();
  };

  return (
    <View style={styles.outerContainer}>
      <AppBackground />
      <Stack.Screen options={{ headerTitle: 'Admin Workspace', headerRight: () => <LogoutButton /> }} />

      <View style={styles.brandHeader}>
        <Image source={require('../assets/ayyanar-logo.jpg')} style={styles.brandLogo} resizeMode="contain" />
        <Text style={styles.brandCaption}>Operations Control</Text>
      </View>

      <View style={styles.tabShell}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.tabRow}>
            {adminTabs.map((tab) => (
              <TouchableOpacity key={tab.id} style={[styles.tabButton, activeTab === tab.id && styles.tabButtonActive]} onPress={() => setActiveTab(tab.id)}>
                <MaterialIcons name={tab.icon} size={18} color={activeTab === tab.id ? COLORS.white : COLORS.textLight} />
                <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
      >
        {loading && !refreshing ? <ActivityIndicator color={COLORS.primary} style={styles.loader} /> : null}
        {renderActiveTab()}
      </ScrollView>
    </View>
  );
}

function MetricCard({ icon, label, value }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIcon}><MaterialIcons name={icon} size={20} color={COLORS.primary} /></View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function PrimaryButton({ label, icon, onPress }: { label: string; icon: keyof typeof MaterialIcons.glyphMap; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.primaryButton} onPress={onPress}>
      <MaterialIcons name={icon} size={18} color={COLORS.white} />
      <Text style={styles.primaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function ChipSelect({ items, value, onChange }: { items: { id: string; label: string }[]; value: string | null; onChange: (id: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
      <View style={styles.chipRow}>
        {items.map((item) => (
          <TouchableOpacity key={item.id} style={[styles.chip, value === item.id && styles.chipActive]} onPress={() => onChange(item.id)}>
            <Text style={[styles.chipText, value === item.id && styles.chipTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

function StatusPill({ status }: { status: string }) {
  const isConverted = status === 'Converted Client';
  return (
    <View style={[styles.statusPill, isConverted && styles.statusPillGood]}>
      <Text style={[styles.statusPillText, isConverted && styles.statusPillTextGood]}>{status}</Text>
    </View>
  );
}

function AttendanceRow({ icon, title, subtitle, status, imageUrl, latitude, longitude }: { icon: keyof typeof MaterialIcons.glyphMap; title: string; subtitle: string; status: string; imageUrl?: string; latitude?: number | string | null; longitude?: number | string | null }) {
  const hasGps = latitude !== undefined && latitude !== null && longitude !== undefined && longitude !== null;
  const openInMaps = () => {
    if (hasGps) Linking.openURL(`https://www.google.com/maps?q=${latitude},${longitude}`);
  };
  return (
    <View style={styles.attendanceRow}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.attendanceImage} /> : <View style={styles.listIcon}><MaterialIcons name={icon} size={22} color={COLORS.primary} /></View>}
      <View style={styles.listContent}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowMeta}>{subtitle}</Text>
        {hasGps && (
          <TouchableOpacity style={styles.gpsLink} onPress={openInMaps}>
            <MaterialIcons name="location-on" size={13} color={COLORS.success} />
            <Text style={styles.gpsLinkText}>
              GPS {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)} — Open in Maps
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <StatusPill status={status || 'Present'} />
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return <Text style={styles.emptyText}>{text}</Text>;
}

function LedgerList({ data, empty }: { data: any[]; empty: string }) {
  return (
    <View style={styles.card}>
      {data.map((item) => {
        const images = getBillImageUris(item.image_url);
        return (
          <View key={item.id} style={styles.ledgerCard}>
            <View style={styles.pipelineHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.category || 'Ledger Entry'}</Text>
                <Text style={styles.rowMeta}>{item.description || 'No description'}</Text>
                <Text style={styles.assignmentText}>{new Date(item.date).toLocaleDateString()}</Text>
              </View>
              <Text style={styles.rowAmount}>Rs {Number(item.amount || 0).toLocaleString()}</Text>
            </View>
            {images.length > 0 && (
              <View style={styles.imageStrip}>
                {images.map((uri) => <Image key={uri} source={{ uri }} style={styles.thumb} />)}
              </View>
            )}
          </View>
        );
      })}
      {data.length === 0 && <EmptyState text={empty} />}
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: 96,
  },
  brandHeader: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  brandLogo: {
    width: 210,
    height: 44,
  },
  brandCaption: {
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  tabShell: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: SPACING.sm,
  },
  tabRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  tabButton: {
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.steel,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabText: {
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: '800',
  },
  tabTextActive: {
    color: COLORS.white,
  },
  loader: {
    marginBottom: SPACING.md,
  },
  screenTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '900',
  },
  screenSubtitle: {
    color: COLORS.textLight,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: 4,
    marginBottom: SPACING.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  metricCard: {
    width: '48.7%',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(226, 26, 18, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  metricValue: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '900',
  },
  metricLabel: {
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  heroPanel: {
    backgroundColor: COLORS.headerBackground,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  heroLabel: {
    color: '#BFC5CC',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  heroValue: {
    color: COLORS.white,
    fontSize: 26,
    fontWeight: '900',
    marginTop: 4,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.steel,
  },
  rowTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
  },
  rowMeta: {
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 2,
  },
  rowAmount: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  dateRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  dateButtonText: {
    color: COLORS.primary,
    fontWeight: '900',
  },
  dateInput: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: 12,
    color: COLORS.text,
    fontWeight: '700',
  },
  attendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.steel,
  },
  attendanceImage: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: COLORS.steel,
  },
  listIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(226, 26, 18, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  listContent: {
    flex: 1,
  },
  assignmentText: {
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 5,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.steel,
  },
  formTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: SPACING.sm,
  },
  fieldCaption: {
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.steel,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    padding: 13,
    marginBottom: SPACING.sm,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: SPACING.xs,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 14,
  },
  chipScroll: {
    marginBottom: SPACING.sm,
  },
  chipRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingVertical: 2,
  },
  chip: {
    backgroundColor: COLORS.steel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: '900',
  },
  chipTextActive: {
    color: COLORS.white,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: COLORS.headerBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '900',
  },
  pipelineHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  statusPill: {
    backgroundColor: 'rgba(226, 26, 18, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusPillGood: {
    backgroundColor: 'rgba(21, 128, 61, 0.1)',
  },
  statusPillText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '900',
  },
  statusPillTextGood: {
    color: COLORS.success,
  },
  ledgerCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.steel,
  },
  imageStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  thumb: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: COLORS.steel,
  },
  emptyText: {
    color: COLORS.textLight,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
  pdfActionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  pdfButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 13,
  },
  whatsappButton: {
    backgroundColor: '#25D366',
  },
  pdfButtonText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 13,
  },
  ioHeaderRow: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  ioHeaderText: {
    flex: 1,
    color: COLORS.textLight,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    textAlign: 'right',
  },
  ioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.steel,
  },
  ioTotalRow: {
    borderBottomWidth: 0,
    borderTopWidth: 1.5,
    borderTopColor: COLORS.border,
  },
  ioDateCell: {
    flex: 1.2,
    color: COLORS.text,
    fontSize: 12.5,
    fontWeight: '700',
  },
  ioCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  gpsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  gpsLinkText: {
    color: COLORS.success,
    fontSize: 11,
    fontWeight: '800',
  },
});
