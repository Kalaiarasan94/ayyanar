import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { MaterialIcons } from '@expo/vector-icons';
import AppBackground from './components/AppBackground';
import LogoutButton from '../components/LogoutButton';
import DatePickerField from '../components/DatePickerField';
import { accountsService, adminService, fieldService } from '../services/api';
import { csvCell, exportCsv, printHtmlOnWeb } from '../services/printReport';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/Theme';

type AdminTab = 'DASHBOARD' | 'ATTENDANCE' | 'PROJECTS' | 'TEAM' | 'LEADS' | 'REPORTS';
type StaffRole = 'Owner' | 'Supervisor' | 'Driver' | 'Accounts' | 'TotalAccounts';

interface Staff {
  id: string;
  name: string;
  role: StaffRole | 'Admin';
  phone: string;
  username?: string;
  password?: string;
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
  // Only server-hosted photos can display on other devices; old local paths are skipped
  return imageUrl.split('||').map((uri) => uri.trim()).filter((uri) => uri.startsWith('http'));
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
  const [attendanceDetail, setAttendanceDetail] = useState<any>(null);

  const [staffName, setStaffName] = useState('');
  const [staffUsername, setStaffUsername] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [staffRole, setStaffRole] = useState<StaffRole>('Supervisor');
  const [staffPhone, setStaffPhone] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string | number, boolean>>({});
  const [editingStaffId, setEditingStaffId] = useState<string | number | null>(null);

  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteLocation, setNewSiteLocation] = useState('');
  const [selectedSiteForAllocation, setSelectedSiteForAllocation] = useState<string | null>(null);
  const [selectedSupervisorForAllocation, setSelectedSupervisorForAllocation] = useState<string | null>(null);

  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadProject, setLeadProject] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [leadStatus, setLeadStatus] = useState<Lead['status']>('Hot Lead');
  const [leadReportMode, setLeadReportMode] = useState<'DAY' | 'MONTH'>('DAY');
  const [leadReportDate, setLeadReportDate] = useState(todayIso());

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

  const handleStartEdit = (staff: Staff) => {
    setEditingStaffId(staff.id);
    setStaffName(staff.name);
    setStaffPhone(staff.phone);
    setStaffUsername(staff.username || '');
    setStaffPassword(staff.password || '');
    setStaffRole(staff.role as StaffRole);
  };

  const handleCancelEdit = () => {
    setEditingStaffId(null);
    setStaffName('');
    setStaffPhone('');
    setStaffUsername('');
    setStaffPassword('');
    setStaffRole('Supervisor');
  };

  const handleSaveStaffChanges = async () => {
    if (!editingStaffId) return;
    if (!staffName || !staffPhone || !staffUsername || !staffPassword) {
      Alert.alert('Missing Details', 'Fill staff name, phone, username, and password.');
      return;
    }
    setLoading(true);
    try {
      await adminService.updateStaff(editingStaffId, {
        name: staffName.trim(),
        username: staffUsername.trim().toLowerCase(),
        role: staffRole,
        phone: staffPhone.trim(),
        password: staffPassword.trim(),
      });
      handleCancelEdit();
      await loadTab('TEAM');
      Alert.alert('Success', 'Staff account updated successfully.');
    } catch {
      Alert.alert('Staff Error', 'Unable to update staff account.');
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
    if (!leadName || !leadPhone || !leadProject || !leadSource) {
      Alert.alert('Missing Details', 'Fill lead name, phone number, requirement, and source.');
      return;
    }
    setLoading(true);
    try {
      await adminService.createLead({ name: leadName.trim(), phone: leadPhone.trim(), projectNeeded: leadProject, source: leadSource, status: leadStatus });
      setLeadName('');
      setLeadPhone('');
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

  // ---------- Leads report (by day or month, PDF + Excel) ----------
  const leadReportPeriodLabel = leadReportMode === 'DAY' ? leadReportDate : leadReportDate.slice(0, 7);

  const filteredLeadsForReport = () =>
    leadsList.filter((lead: any) => {
      if (!lead.created_at) return false;
      const d = new Date(lead.created_at);
      const localYmd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return leadReportMode === 'DAY' ? localYmd === leadReportDate : localYmd.slice(0, 7) === leadReportDate.slice(0, 7);
    });

  const buildLeadsReportHtml = (leads: any[]) => {
    const count = (status: string) => leads.filter((l: any) => l.status === status).length;
    const rows = leads
      .map(
        (l: any, i: number) => `
        <tr style="background:${i % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
          <td>${i + 1}</td>
          <td>${new Date(l.created_at).toLocaleDateString('en-IN')}</td>
          <td><b>${l.name}</b></td>
          <td>${l.phone || '-'}</td>
          <td>${l.project_needed || '-'}</td>
          <td>${l.source || '-'}</td>
          <td>${l.status}</td>
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
            .boxes { display: flex; gap: 10px; margin-bottom: 18px; }
            .box { flex: 1; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; }
            .box .label { font-size: 10px; color: #64748B; text-transform: uppercase; font-weight: bold; }
            .box .value { font-size: 18px; font-weight: bold; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { background: #0F172A; color: #FFF; padding: 7px 6px; text-align: left; }
            td { padding: 7px 6px; border-bottom: 1px solid #E2E8F0; }
          </style>
        </head>
        <body>
          <h1>Ayyanar Construction — Leads Report</h1>
          <div class="sub">${leadReportMode === 'DAY' ? 'Date' : 'Month'}: <b>${leadReportPeriodLabel}</b> &bull; Generated on ${new Date().toLocaleString('en-IN')}</div>

          <div class="boxes">
            <div class="box"><div class="label">Total Leads</div><div class="value">${leads.length}</div></div>
            <div class="box"><div class="label">Hot Leads</div><div class="value" style="color:#E21A12;">${count('Hot Lead')}</div></div>
            <div class="box"><div class="label">In Discussion</div><div class="value" style="color:#B45309;">${count('In Discussion')}</div></div>
            <div class="box"><div class="label">Converted</div><div class="value" style="color:#15803D;">${count('Converted Client')}</div></div>
          </div>

          <table>
            <thead>
              <tr><th>#</th><th>Date</th><th>Lead Name</th><th>Phone</th><th>Requirement</th><th>Source</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="7" style="text-align:center; color:#64748B;">No leads in this period</td></tr>'}
            </tbody>
          </table>
        </body>
      </html>`;
  };

  const handleLeadsPdf = async () => {
    const leads = filteredLeadsForReport();
    if (leads.length === 0) {
      Alert.alert('No Data', `No leads registered in ${leadReportPeriodLabel}.`);
      return;
    }
    setGeneratingPdf(true);
    try {
      if (Platform.OS === 'web') {
        await printHtmlOnWeb(buildLeadsReportHtml(leads));
        return;
      }
      const { uri } = await Print.printToFileAsync({ html: buildLeadsReportHtml(leads) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `Leads Report ${leadReportPeriodLabel}` });
      }
    } catch (error: any) {
      Alert.alert('PDF Error', error?.message || 'Unable to generate the leads report.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleLeadsExcel = async () => {
    const leads = filteredLeadsForReport();
    if (leads.length === 0) {
      Alert.alert('No Data', `No leads registered in ${leadReportPeriodLabel}.`);
      return;
    }
    setGeneratingPdf(true);
    try {
      const header = ['#', 'Date', 'Lead Name', 'Phone', 'Requirement', 'Source', 'Status'];
      const lines = [
        header.join(','),
        ...leads.map((l: any, i: number) =>
          [
            i + 1,
            new Date(l.created_at).toLocaleDateString('en-IN'),
            csvCell(l.name),
            csvCell(l.phone || ''),
            csvCell(l.project_needed || ''),
            csvCell(l.source || ''),
            csvCell(l.status),
          ].join(',')
        ),
      ];
      await exportCsv(`leads-report-${leadReportPeriodLabel}.csv`, lines.join('\n'));
    } catch (error: any) {
      Alert.alert('Excel Error', error?.message || 'Unable to generate the Excel file.');
    } finally {
      setGeneratingPdf(false);
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
          await printHtmlOnWeb(buildIoReportHtml());
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

  // ---------- Site Expenses report (bills entered by supervisors) ----------
  const buildSiteReportHtml = () => {
    const site = sitesList.find((s) => s.id === reportSiteId);
    const direct = reportData.filter((item) => item.payment_mode === 'Direct');
    const credit = reportData.filter((item) => item.payment_mode !== 'Direct');
    const sum = (rows: any[]) => rows.reduce((s, r) => s + Number(r.amount || 0), 0);

    const billTable = (title: string, color: string, rows: any[]) => `
      <h3 style="color:${color};">${title} (${rows.length} bills)</h3>
      <table>
        <thead><tr><th>#</th><th>Date</th><th>Supervisor</th><th>Category</th><th>Description</th><th class="r">Amount (Rs)</th></tr></thead>
        <tbody>
          ${rows.length
            ? rows
                .map(
                  (r: any, i: number) => `
              <tr style="background:${i % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
                <td>${i + 1}</td>
                <td>${new Date(r.date).toLocaleDateString('en-IN')}</td>
                <td>${r.supervisor_name || 'System'}</td>
                <td>${r.category || '-'}</td>
                <td>${r.description || '-'}</td>
                <td style="text-align:right;">${Number(r.amount || 0).toLocaleString('en-IN')}</td>
              </tr>`
                )
                .join('')
            : '<tr><td colspan="6" style="text-align:center; color:#64748B;">No bills recorded</td></tr>'}
          <tr style="background:#0F172A; color:#FFF; font-weight:bold;">
            <td colspan="5">TOTAL</td>
            <td style="text-align:right;">${sum(rows).toLocaleString('en-IN')}</td>
          </tr>
        </tbody>
      </table>`;

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Helvetica, Arial, sans-serif; padding: 28px; color: #0F172A; }
            h1 { color: #E21A12; font-size: 20px; margin-bottom: 2px; }
            h3 { font-size: 13px; margin: 20px 0 8px; }
            .sub { color: #64748B; font-size: 11px; margin-bottom: 18px; }
            .boxes { display: flex; gap: 10px; margin-bottom: 6px; }
            .box { flex: 1; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; }
            .box .label { font-size: 10px; color: #64748B; text-transform: uppercase; font-weight: bold; }
            .box .value { font-size: 17px; font-weight: bold; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
            th { background: #0F172A; color: #FFF; padding: 7px 6px; text-align: left; }
            th.r { text-align: right; }
            td { padding: 6px; border-bottom: 1px solid #E2E8F0; }
          </style>
        </head>
        <body>
          <h1>Ayyanar Construction — Site Expenses Report</h1>
          <div class="sub">Site: <b>${site?.name || '-'}</b> (${site?.location || ''}) &bull; Bills entered by supervisors &bull; Generated on ${new Date().toLocaleString('en-IN')}</div>

          <div class="boxes">
            <div class="box"><div class="label">Direct Bills</div><div class="value">${`Rs ${sum(direct).toLocaleString('en-IN')}`}</div></div>
            <div class="box"><div class="label">Indirect / Credit Bills</div><div class="value">${`Rs ${sum(credit).toLocaleString('en-IN')}`}</div></div>
            <div class="box"><div class="label">Total Site Expense</div><div class="value" style="color:#E21A12;">${`Rs ${(sum(direct) + sum(credit)).toLocaleString('en-IN')}`}</div></div>
          </div>

          ${billTable('DIRECT BILLS (Cash)', '#15803D', direct)}
          ${billTable('INDIRECT / CREDIT BILLS (Vendor)', '#B45309', credit)}
        </body>
      </html>`;
  };

  const handleSitePdf = async (viaWhatsApp: boolean) => {
    if (reportData.length === 0) {
      Alert.alert('No Data', 'There are no expense bills for this site yet.');
      return;
    }
    setGeneratingPdf(true);
    try {
      if (Platform.OS === 'web') {
        if (viaWhatsApp) {
          const site = sitesList.find((s) => s.id === reportSiteId);
          const total = reportData.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
          const directBills = reportData.filter((r: any) => r.payment_mode === 'Direct');
          const creditBills = reportData.filter((r: any) => r.payment_mode !== 'Direct');
          const directSum = directBills.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
          const creditSum = creditBills.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
          const text =
            `*Ayyanar Construction - Site Expenses Report*\n` +
            `Site: ${site?.name || '-'}\n` +
            `Total Bills: ${reportData.length}\n` +
            `💵 Direct (Cash): Rs ${directSum.toLocaleString('en-IN')} (${directBills.length} bills)\n` +
            `💳 Indirect (Credit): Rs ${creditSum.toLocaleString('en-IN')} (${creditBills.length} bills)\n` +
            `💰 Grand Total: Rs ${total.toLocaleString('en-IN')}`;
          await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
        } else {
          await printHtmlOnWeb(buildSiteReportHtml());
        }
        return;
      }
      const { uri } = await Print.printToFileAsync({ html: buildSiteReportHtml() });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: viaWhatsApp ? 'Share Site Expenses Report on WhatsApp' : 'Site Expenses Report',
        });
      } else {
        Alert.alert('Saved', `PDF generated at:\n${uri}`);
      }
    } catch (error: any) {
      Alert.alert('PDF Error', error?.message || 'Unable to generate the site report.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Vehicle-wise / driver-wise rollups for the driver trip records
  const summarizeDriverRecords = (key: 'vehicle_name' | 'driver_name') => {
    const map: Record<string, { trips: number; km: number; diesel: number }> = {};
    driverRecords.forEach((r: any) => {
      const k = (r[key] || 'Unknown').toString();
      if (!map[k]) map[k] = { trips: 0, km: 0, diesel: 0 };
      map[k].trips += 1;
      map[k].km += Number(r.total_km || 0);
      map[k].diesel += Number(r.diesel_fare || 0);
    });
    return Object.entries(map).sort((a, b) => b[1].km - a[1].km);
  };

  const buildDriverReportHtml = () => {
    const totalKmSum = driverRecords.reduce((sum: number, rec: any) => sum + Number(rec.total_km || 0), 0);
    const dieselSum = driverRecords.reduce((sum: number, rec: any) => sum + Number(rec.diesel_fare || 0), 0);

    const summaryTable = (title: string, entries: [string, { trips: number; km: number; diesel: number }][]) => `
      <h3>${title}</h3>
      <table style="max-width:460px;">
        <thead><tr><th>Name</th><th class="r">Trips</th><th class="r">Total KM</th><th class="r">Diesel (Rs)</th></tr></thead>
        <tbody>
          ${entries
            .map(
              ([name, s]) => `
            <tr>
              <td>${name}</td>
              <td class="r">${s.trips}</td>
              <td class="r">${s.km.toLocaleString('en-IN')}</td>
              <td class="r">${s.diesel.toLocaleString('en-IN')}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>`;

    // Trips grouped by driver — every field the driver registered, in a readable table
    const drivers = summarizeDriverRecords('driver_name');
    const driverSections = drivers
      .map(([driverName, s]) => {
        const trips = driverRecords.filter((r: any) => (r.driver_name || 'Unknown') === driverName);
        const tripRows = trips
          .map(
            (rec: any, i: number) => `
            <tr style="background:${i % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
              <td>${i + 1}</td>
              <td>${new Date(rec.date).toLocaleDateString('en-IN')}</td>
              <td>${rec.vehicle_name || '-'}</td>
              <td class="r">${Number(rec.starting_km || 0)} &rarr; ${Number(rec.ending_km || 0)}</td>
              <td class="r"><b>${Number(rec.total_km || 0)}</b></td>
              <td>${rec.distance || '-'}</td>
              <td class="r">${Number(rec.diesel_fare || 0).toLocaleString('en-IN')}</td>
              <td>${rec.load_name || '-'}${rec.load_weight ? ` (${rec.load_weight})` : ''}</td>
              <td>${rec.load_type || '-'}${rec.customer_name ? ` — ${rec.customer_name}` : ''}</td>
              <td>${rec.place || '-'}</td>
              <td>${rec.starting_time || '-'} &rarr; ${rec.ending_time || '-'}</td>
            </tr>`
          )
          .join('');

        return `
        <div class="driver-block">
          <div class="driver-head">
            <span class="driver-name">👤 ${driverName}</span>
            <span class="driver-stats">${s.trips} trip(s) &bull; ${s.km.toLocaleString('en-IN')} km &bull; Diesel Rs ${s.diesel.toLocaleString('en-IN')}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th><th>Date</th><th>Vehicle</th><th class="r">KM (Start &rarr; End)</th><th class="r">Total KM</th>
                <th>Distance</th><th class="r">Diesel (Rs)</th><th>Load (Weight)</th><th>Type / Customer</th><th>Place</th><th>Time</th>
              </tr>
            </thead>
            <tbody>${tripRows}</tbody>
          </table>
        </div>`;
      })
      .join('');

    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            @page { size: A4 landscape; margin: 14mm; }
            body { font-family: Helvetica, Arial, sans-serif; padding: 24px; color: #0F172A; }
            h1 { color: #E21A12; font-size: 20px; margin-bottom: 2px; }
            h3 { font-size: 13px; margin: 20px 0 8px; }
            .sub { color: #64748B; font-size: 11px; margin-bottom: 18px; }
            .boxes { display: flex; gap: 10px; margin-bottom: 18px; }
            .box { flex: 1; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; }
            .box .label { font-size: 10px; color: #64748B; text-transform: uppercase; font-weight: bold; }
            .box .value { font-size: 18px; font-weight: bold; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th { background: #0F172A; color: #FFFFFF; padding: 7px 5px; text-align: left; }
            th.r, td.r { text-align: right; }
            td { padding: 6px 5px; border-bottom: 1px solid #E2E8F0; }
            .driver-block { margin-top: 18px; page-break-inside: avoid; }
            .driver-head { display: flex; justify-content: space-between; align-items: center; background: #F1F5F9; border: 1px solid #E2E8F0; border-radius: 8px 8px 0 0; padding: 8px 10px; }
            .driver-name { font-size: 13px; font-weight: bold; }
            .driver-stats { font-size: 11px; color: #64748B; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Ayyanar Construction — Driver Trip Report</h1>
          <div class="sub">Generated on ${new Date().toLocaleString('en-IN')} &bull; ${driverRecords.length} trip record(s)</div>

          <div class="boxes">
            <div class="box"><div class="label">Total Trips</div><div class="value">${driverRecords.length}</div></div>
            <div class="box"><div class="label">Total KM Travelled</div><div class="value">${totalKmSum.toLocaleString('en-IN')} km</div></div>
            <div class="box"><div class="label">Total Diesel Fare</div><div class="value" style="color:#E21A12;">Rs ${dieselSum.toLocaleString('en-IN')}</div></div>
          </div>

          ${summaryTable('Vehicle-wise Summary', summarizeDriverRecords('vehicle_name'))}
          ${summaryTable('Driver-wise Summary', drivers)}

          <h3>Trip Details — Driver-wise (all fields registered by the driver)</h3>
          ${driverSections}
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
        await printHtmlOnWeb(buildDriverReportHtml());
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
          <DatePickerField style={{ flex: 1 }} value={attendanceDate} onChange={setAttendanceDate} placeholder="Pick a date" />
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
              imageUrl={item.selfie_url?.startsWith('http') ? item.selfie_url : undefined}
              latitude={item.latitude}
              longitude={item.longitude}
              onPress={() => setAttendanceDetail(item)}
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
        <Text style={styles.formTitle}>{editingStaffId ? 'Edit Staff Account' : 'Create Staff Login'}</Text>
        <TextInput style={styles.input} placeholder="Full name" value={staffName} onChangeText={setStaffName} placeholderTextColor={COLORS.textLight} />
        <TextInput style={styles.input} placeholder="Phone number" value={staffPhone} onChangeText={setStaffPhone} placeholderTextColor={COLORS.textLight} keyboardType="phone-pad" />
        <TextInput style={styles.input} placeholder="Username" value={staffUsername} onChangeText={setStaffUsername} placeholderTextColor={COLORS.textLight} autoCapitalize="none" />
        <View style={styles.passwordInputContainer}>
          <TextInput 
            style={styles.passwordTextInput} 
            placeholder="Password" 
            value={staffPassword} 
            onChangeText={setStaffPassword} 
            placeholderTextColor={COLORS.textLight} 
            secureTextEntry={!showStaffPassword} 
          />
          <TouchableOpacity onPress={() => setShowStaffPassword(prev => !prev)} style={{ padding: 4 }}>
            <MaterialIcons name={showStaffPassword ? "visibility" : "visibility-off"} size={20} color={COLORS.textLight} />
          </TouchableOpacity>
        </View>
        <ChipSelect
          items={([
            'Owner',
            'Supervisor',
            'Driver',
            'Accounts',
            'TotalAccounts',
          ] as StaffRole[]).map((role) => ({ id: role, label: role }))}
          value={staffRole}
          onChange={(role) => setStaffRole(role as StaffRole)}
        />
        {editingStaffId ? (
          <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xs }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Save Changes" icon="check" onPress={handleSaveStaffChanges} />
            </View>
            <TouchableOpacity 
              style={{
                backgroundColor: COLORS.textLight,
                borderRadius: BORDER_RADIUS.md,
                paddingVertical: 14,
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1
              }} 
              onPress={handleCancelEdit}
            >
              <Text style={{ color: COLORS.white, fontWeight: '800' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <PrimaryButton label="Create Staff Account" icon="person-add" onPress={handleAddStaff} />
        )}
      </View>

      <SectionTitle title="Staff Directory" />
      {staffList.map((staff) => (
        <View key={staff.id} style={styles.listCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{staff.name?.charAt(0)?.toUpperCase() || 'S'}</Text></View>
          <View style={styles.listContent}>
            <Text style={styles.rowTitle}>{staff.name}</Text>
            <Text style={styles.rowMeta}>{staff.role} • {staff.phone}</Text>
            {staff.username && (
              <Text style={[styles.rowMeta, { marginTop: 4, color: COLORS.text }]}>
                User: <Text style={{ fontWeight: 'bold' }}>{staff.username}</Text>
              </Text>
            )}
            {staff.password && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <Text style={[styles.rowMeta, { color: COLORS.text }]}>Pass: </Text>
                <Text style={[styles.rowMeta, { fontWeight: 'bold', color: COLORS.text }]}>
                  {visiblePasswords[staff.id] ? staff.password : '••••••••'}
                </Text>
                <TouchableOpacity 
                  onPress={() => setVisiblePasswords(prev => ({ ...prev, [staff.id]: !prev[staff.id] }))}
                  style={{ marginLeft: 8, padding: 2 }}
                >
                  <MaterialIcons 
                    name={visiblePasswords[staff.id] ? "visibility" : "visibility-off"} 
                    size={16} 
                    color={COLORS.textLight} 
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity style={[styles.iconButton, { marginRight: 8 }]} onPress={() => handleStartEdit(staff)}>
              <MaterialIcons name="edit" size={22} color={COLORS.success} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => handleDeleteStaff(staff.id)}>
              <MaterialIcons name="delete-outline" size={22} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
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
        <TextInput style={styles.input} placeholder="Phone number" value={leadPhone} onChangeText={setLeadPhone} placeholderTextColor={COLORS.textLight} keyboardType="phone-pad" />
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

      {/* Leads report: pick a day or a month, download as PDF or Excel */}
      <View style={styles.card}>
        <Text style={styles.formTitle}>Leads Report</Text>
        <ChipSelect
          items={[
            { id: 'DAY', label: 'By Date' },
            { id: 'MONTH', label: 'By Month' },
          ]}
          value={leadReportMode}
          onChange={(mode) => setLeadReportMode(mode as 'DAY' | 'MONTH')}
        />
        <Text style={styles.fieldCaption}>{leadReportMode === 'DAY' ? 'PICK THE DATE' : 'PICK ANY DATE IN THE MONTH'}</Text>
        <DatePickerField value={leadReportDate} onChange={setLeadReportDate} placeholder="Pick a date" />
        <View style={[styles.pdfActionsRow, { marginTop: SPACING.sm }]}>
          <TouchableOpacity style={[styles.pdfButton, generatingPdf && { opacity: 0.6 }]} onPress={handleLeadsPdf} disabled={generatingPdf}>
            {generatingPdf ? <ActivityIndicator color={COLORS.white} size="small" /> : <MaterialIcons name="picture-as-pdf" size={18} color={COLORS.white} />}
            <Text style={styles.pdfButtonText}>Download PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.pdfButton, { backgroundColor: '#15803D' }, generatingPdf && { opacity: 0.6 }]} onPress={handleLeadsExcel} disabled={generatingPdf}>
            <MaterialIcons name="grid-on" size={18} color={COLORS.white} />
            <Text style={styles.pdfButtonText}>Download Excel</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Pipeline split into separate stages */}
      {(
        [
          { status: 'Hot Lead', title: 'Leads', icon: 'local-fire-department' as const, color: COLORS.primary },
          { status: 'In Discussion', title: 'In Discussion', icon: 'forum' as const, color: COLORS.warning },
          { status: 'Converted Client', title: 'Converted Clients', icon: 'verified' as const, color: COLORS.success },
        ] as { status: Lead['status']; title: string; icon: keyof typeof MaterialIcons.glyphMap; color: string }[]
      ).map((stage) => {
        const stageLeads = (leadsList as any[]).filter((lead) => lead.status === stage.status);
        return (
          <View key={stage.status}>
            <View style={styles.stageHeader}>
              <MaterialIcons name={stage.icon} size={18} color={stage.color} />
              <Text style={styles.sectionTitle}>{stage.title} ({stageLeads.length})</Text>
            </View>
            {stageLeads.map((lead: any) => (
              <View key={lead.id} style={styles.card}>
                <View style={styles.pipelineHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{lead.name}</Text>
                    <Text style={styles.rowMeta}>{lead.project_needed}</Text>
                    <Text style={styles.assignmentText}>
                      {lead.phone ? `📞 ${lead.phone} • ` : ''}Source: {lead.source}{lead.created_at ? ` • ${new Date(lead.created_at).toLocaleDateString('en-IN')}` : ''}
                    </Text>
                  </View>
                  {lead.phone ? (
                    <TouchableOpacity style={styles.callButton} onPress={() => Linking.openURL(`tel:${lead.phone}`)}>
                      <MaterialIcons name="call" size={20} color={COLORS.white} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <ChipSelect
                  items={(['Hot Lead', 'In Discussion', 'Converted Client'] as Lead['status'][]).map((status) => ({ id: status, label: status }))}
                  value={lead.status}
                  onChange={(status) => handleUpdateLeadStatus(lead.id, status as Lead['status'])}
                />
              </View>
            ))}
            {stageLeads.length === 0 && (
              <View style={styles.card}>
                <EmptyState text={`No ${stage.title.toLowerCase()} yet.`} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );

  const renderSiteReports = () => {
    const direct = reportData.filter((item) => item.payment_mode === 'Direct');
    const credit = reportData.filter((item) => item.payment_mode !== 'Direct');
    const directTotal = direct.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const creditTotal = credit.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const grandTotal = directTotal + creditTotal;
    return (
      <View>
        <ChipSelect items={sitesList.map((site) => ({ id: site.id, label: site.name }))} value={reportSiteId} onChange={selectReportSite} />

        {/* Summary totals */}
        {reportData.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            <View style={{ flex: 1, backgroundColor: '#EBF8EE', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#A3D9B1' }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#1A7A35', letterSpacing: 0.5 }}>DIRECT (CASH)</Text>
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#1A7A35', marginTop: 4 }}>
                ₹{directTotal.toLocaleString()}
              </Text>
              <Text style={{ fontSize: 10, color: '#1A7A35', marginTop: 2 }}>{direct.length} bill(s)</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#FFF3E0', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FFCC80' }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#D56B00', letterSpacing: 0.5 }}>INDIRECT (CREDIT)</Text>
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#D56B00', marginTop: 4 }}>
                ₹{creditTotal.toLocaleString()}
              </Text>
              <Text style={{ fontSize: 10, color: '#D56B00', marginTop: 2 }}>{credit.length} bill(s)</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#EDE9FE', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#C4B5FD' }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#5B21B6', letterSpacing: 0.5 }}>GRAND TOTAL</Text>
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#5B21B6', marginTop: 4 }}>
                ₹{grandTotal.toLocaleString()}
              </Text>
              <Text style={{ fontSize: 10, color: '#5B21B6', marginTop: 2 }}>{reportData.length} bill(s)</Text>
            </View>
          </View>
        )}

        <View style={styles.pdfActionsRow}>
          <TouchableOpacity style={[styles.pdfButton, generatingPdf && { opacity: 0.6 }]} onPress={() => handleSitePdf(false)} disabled={generatingPdf}>
            {generatingPdf ? <ActivityIndicator color={COLORS.white} size="small" /> : <MaterialIcons name="picture-as-pdf" size={18} color={COLORS.white} />}
            <Text style={styles.pdfButtonText}>Download PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.pdfButton, styles.whatsappButton, generatingPdf && { opacity: 0.6 }]} onPress={() => handleSitePdf(true)} disabled={generatingPdf}>
            <MaterialIcons name="share" size={18} color={COLORS.white} />
            <Text style={styles.pdfButtonText}>Share on WhatsApp</Text>
          </TouchableOpacity>
        </View>

        <SectionTitle title={`💵 Direct Cash Bills (${direct.length})`} />
        <LedgerList data={direct} empty="No direct cash bills recorded for this site." />

        <SectionTitle title={`💳 Indirect / Credit Bills (${credit.length})`} />
        <LedgerList data={credit} empty="No indirect credit bills recorded for this site." />
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

      <SectionTitle title="Vehicle-wise Summary" />
      <View style={styles.card}>
        <View style={styles.ioHeaderRow}>
          <Text style={[styles.ioHeaderText, { flex: 1.4, textAlign: 'left' }]}>Vehicle</Text>
          <Text style={styles.ioHeaderText}>Trips</Text>
          <Text style={styles.ioHeaderText}>Total KM</Text>
          <Text style={styles.ioHeaderText}>Diesel (Rs)</Text>
        </View>
        {summarizeDriverRecords('vehicle_name').map(([name, s]) => (
          <View key={`veh-${name}`} style={styles.ioRow}>
            <Text style={[styles.ioDateCell, { flex: 1.4 }]}>{name}</Text>
            <Text style={styles.ioCell}>{s.trips}</Text>
            <Text style={styles.ioCell}>{s.km.toLocaleString('en-IN')}</Text>
            <Text style={[styles.ioCell, { color: COLORS.primary }]}>{s.diesel.toLocaleString('en-IN')}</Text>
          </View>
        ))}
        {driverRecords.length === 0 && <EmptyState text="No trips yet." />}
      </View>

      <SectionTitle title="Driver-wise Summary" />
      <View style={styles.card}>
        <View style={styles.ioHeaderRow}>
          <Text style={[styles.ioHeaderText, { flex: 1.4, textAlign: 'left' }]}>Driver</Text>
          <Text style={styles.ioHeaderText}>Trips</Text>
          <Text style={styles.ioHeaderText}>Total KM</Text>
          <Text style={styles.ioHeaderText}>Diesel (Rs)</Text>
        </View>
        {summarizeDriverRecords('driver_name').map(([name, s]) => (
          <View key={`drv-${name}`} style={styles.ioRow}>
            <Text style={[styles.ioDateCell, { flex: 1.4 }]}>{name}</Text>
            <Text style={styles.ioCell}>{s.trips}</Text>
            <Text style={styles.ioCell}>{s.km.toLocaleString('en-IN')}</Text>
            <Text style={[styles.ioCell, { color: COLORS.primary }]}>{s.diesel.toLocaleString('en-IN')}</Text>
          </View>
        ))}
        {driverRecords.length === 0 && <EmptyState text="No trips yet." />}
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
        <Text style={styles.formTitle}>Pick Date Range</Text>
        <View style={styles.dateRow}>
          <DatePickerField style={{ flex: 1 }} placeholder="From date" value={ioFrom} onChange={setIoFrom} />
          <DatePickerField style={{ flex: 1 }} placeholder="To date" value={ioTo} onChange={setIoTo} />
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

      {/* Supervisor attendance detail: full selfie photo + location + map */}
      <Modal visible={!!attendanceDetail} transparent animationType="slide" onRequestClose={() => setAttendanceDetail(null)}>
        <View style={styles.detailBackdrop}>
          <View style={styles.detailSheet}>
            <View style={styles.detailHandle} />
            {attendanceDetail && (
              <>
                <View style={styles.detailHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailName}>{attendanceDetail.supervisor_name || 'Supervisor'}</Text>
                    <Text style={styles.detailMeta}>
                      {attendanceDetail.site_name || 'Site'} • {new Date(attendanceDetail.date).toLocaleDateString('en-IN')}
                    </Text>
                  </View>
                  <StatusPill status={attendanceDetail.status || 'Present'} />
                </View>

                {attendanceDetail.selfie_url?.startsWith('http') ? (
                  <Image source={{ uri: attendanceDetail.selfie_url }} style={styles.detailPhoto} resizeMode="cover" />
                ) : (
                  <View style={styles.detailNoPhoto}>
                    <MaterialIcons name="no-photography" size={40} color={COLORS.textLight} />
                    <Text style={styles.detailNoPhotoText}>
                      {attendanceDetail.status === 'Absent' ? 'Marked absent — no selfie taken.' : 'No selfie uploaded.'}
                    </Text>
                  </View>
                )}

                {attendanceDetail.location_name ? (
                  <View style={styles.detailLocationRow}>
                    <MaterialIcons name="place" size={18} color={COLORS.success} />
                    <Text style={styles.detailLocationText}>{attendanceDetail.location_name}</Text>
                  </View>
                ) : null}

                {attendanceDetail.latitude && attendanceDetail.longitude ? (
                  <TouchableOpacity
                    style={styles.detailMapButton}
                    onPress={() => Linking.openURL(`https://www.google.com/maps?q=${attendanceDetail.latitude},${attendanceDetail.longitude}`)}
                  >
                    <MaterialIcons name="map" size={18} color={COLORS.white} />
                    <Text style={styles.detailMapButtonText}>
                      Open Location in Maps ({Number(attendanceDetail.latitude).toFixed(5)}, {Number(attendanceDetail.longitude).toFixed(5)})
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.detailMeta}>No GPS recorded for this check-in.</Text>
                )}

                <TouchableOpacity style={styles.detailCloseButton} onPress={() => setAttendanceDetail(null)}>
                  <Text style={styles.detailCloseButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MetricCard({ icon, label, value }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string }) {
  // 2 cards per row on phones, 4 across on desktop/laptop web
  const { width } = useWindowDimensions();
  return (
    <View style={[styles.metricCard, width >= 900 && { width: '23.8%' }]}>
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

function AttendanceRow({ icon, title, subtitle, status, imageUrl, latitude, longitude, onPress }: { icon: keyof typeof MaterialIcons.glyphMap; title: string; subtitle: string; status: string; imageUrl?: string; latitude?: number | string | null; longitude?: number | string | null; onPress?: () => void }) {
  const hasGps = latitude !== undefined && latitude !== null && longitude !== undefined && longitude !== null;
  const openInMaps = () => {
    if (hasGps) Linking.openURL(`https://www.google.com/maps?q=${latitude},${longitude}`);
  };
  return (
    <TouchableOpacity style={styles.attendanceRow} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
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
      {onPress && <MaterialIcons name="chevron-right" size={20} color={COLORS.textLight} />}
    </TouchableOpacity>
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
                <Text style={styles.assignmentText}>
                  {new Date(item.date).toLocaleDateString()}
                  {item.supervisor_name ? ` • Recorded by: ${item.supervisor_name}` : ''}
                </Text>
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
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.steel,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
    paddingRight: 13,
  },
  passwordTextInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    padding: 13,
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
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  callButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 13, 16, 0.55)',
    justifyContent: 'flex-end',
  },
  detailSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  detailHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  detailName: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: '900',
  },
  detailMeta: {
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  detailPhoto: {
    width: '100%',
    height: 300,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.steel,
    marginBottom: SPACING.md,
  },
  detailNoPhoto: {
    height: 140,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.steel,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: SPACING.md,
  },
  detailNoPhotoText: {
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: '700',
  },
  detailLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  detailLocationText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  detailMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.success,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 13,
    marginTop: SPACING.xs,
  },
  detailMapButtonText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 13,
  },
  detailCloseButton: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.steel,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.sm,
  },
  detailCloseButtonText: {
    color: COLORS.text,
    fontWeight: '900',
    fontSize: 14,
  },
});
