import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
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
import { MaterialIcons } from '@expo/vector-icons';
import AppBackground from './components/AppBackground';
import LogoutButton from '../components/LogoutButton';
import DatePickerField from '../components/DatePickerField';
import { accountsService, adminService, fieldService } from '../services/api';
import { csvCell, downloadImage, exportCsv, shareImageOnWhatsApp } from '../services/printReport';
import { buildDailySheetPdfDoc, buildPdfReport, downloadPdfReport, sharePdfReportOnWhatsApp } from '../services/pdfReport';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/Theme';

type AdminTab = 'DASHBOARD' | 'ATTENDANCE' | 'DAILY_SHEET' | 'PROJECTS' | 'TEAM' | 'LEADS' | 'REPORTS';
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
  { id: 'DAILY_SHEET', label: 'Daily Sheet', icon: 'description' },
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
const rupeesText = (value: any) => `Rs ${Number(value || 0).toLocaleString('en-IN')}`;

export default function AdminPanelScreen() {
  const [activeTab, setActiveTab] = useState<AdminTab>('DASHBOARD');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [analytics, setAnalytics] = useState<any>(null);
  const [attendance, setAttendance] = useState<any>({ workers: [], supervisors: [] });
  // Dashboard always reflects today, independent of whatever date the Supervisor/Worker
  // drill-down views below are currently filtered to.
  const [todayOverview, setTodayOverview] = useState<any>({ workers: [], categories: [], supervisors: [] });
  const [attendanceView, setAttendanceView] = useState<'DASHBOARD' | 'SUPERVISOR' | 'WORKER'>('DASHBOARD');
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

  // Daily Sheet — supervisor-submitted daily reports, reviewed here supervisor-wise
  const [dailySheets, setDailySheets] = useState<any[]>([]);
  const [dailySheetDate, setDailySheetDate] = useState(todayIso());
  const [dailySheetSupervisor, setDailySheetSupervisor] = useState<string | null>(null);
  const [dailySheetDetail, setDailySheetDetail] = useState<any>(null);
  const [generatingDailySheetPdf, setGeneratingDailySheetPdf] = useState(false);

  // Bill (ledger entry) edit modal
  const [billEditVisible, setBillEditVisible] = useState(false);
  const [editingBillId, setEditingBillId] = useState<string | number | null>(null);
  const [billCategory, setBillCategory] = useState('');
  const [billDescription, setBillDescription] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billPaymentMode, setBillPaymentMode] = useState<'Direct' | 'Indirect'>('Direct');
  const [billDate, setBillDate] = useState(todayIso());

  // Driver bills (diesel bills uploaded by drivers)
  const [driverBills, setDriverBills] = useState<any[]>([]);
  const [driverBillDetail, setDriverBillDetail] = useState<any>(null);
  const [processingBillAction, setProcessingBillAction] = useState(false);

  // Driver trip record edit modal
  const [driverRecordEditVisible, setDriverRecordEditVisible] = useState(false);
  const [editingDriverRecord, setEditingDriverRecord] = useState<any>(null);

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
  const [editingSiteId, setEditingSiteId] = useState<string | number | null>(null);
  const [selectedSiteForAllocation, setSelectedSiteForAllocation] = useState<string | null>(null);
  const [selectedSupervisorForAllocation, setSelectedSupervisorForAllocation] = useState<string | null>(null);

  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadProject, setLeadProject] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [leadStatus, setLeadStatus] = useState<Lead['status']>('Hot Lead');
  const [leadReportMode, setLeadReportMode] = useState<'DAY' | 'MONTH'>('DAY');
  const [leadReportDate, setLeadReportDate] = useState(todayIso());
  const [editingLeadId, setEditingLeadId] = useState<string | number | null>(null);

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
    const isToday = attendanceDate === todayIso();
    const [selectedData, todayData] = await Promise.all([
      adminService.getAttendanceOverview(attendanceDate),
      isToday ? Promise.resolve(null) : adminService.getAttendanceOverview(todayIso()),
    ]);
    setAttendance(selectedData || { workers: [], supervisors: [] });
    setTodayOverview(isToday ? (selectedData || { workers: [], categories: [], supervisors: [] }) : (todayData || { workers: [], categories: [], supervisors: [] }));
  };

  const fetchDailySheets = async (date = dailySheetDate) => {
    setDailySheets(await adminService.getAllDailySheets(date));
  };

  const toDailySheetPdfInput = (row: any) => ({
    siteName: row.site_name,
    supervisorName: row.supervisor_name,
    date: row.date,
    workDescription: row.work_description || '',
    attendance: (row.attendance || []).map((a: any) => ({ name: a.name, category: a.category, count: Number(a.count) || 0 })),
    amountReceived: Number(row.amount_received) || 0,
    billsNormal: Number(row.bills_normal) || 0,
    billsGst: Number(row.bills_gst) || 0,
    billsCredit: Number(row.bills_credit) || 0,
    vehicleRental: Number(row.vehicle_rental) || 0,
    labourSalary: (row.labourSalary || []).map((l: any) => ({ name: l.name, amount: Number(l.amount) || 0 })),
    totalAmount: Number(row.total_amount) || 0,
  });

  const handleDownloadDailySheet = async (row: any) => {
    setGeneratingDailySheetPdf(true);
    try {
      await downloadPdfReport(await buildDailySheetPdfDoc(toDailySheetPdfInput(row)));
    } catch (error: any) {
      Alert.alert('PDF Error', error?.message || 'Unable to generate the report.');
    } finally {
      setGeneratingDailySheetPdf(false);
    }
  };

  const handleShareDailySheet = async (row: any) => {
    setGeneratingDailySheetPdf(true);
    try {
      const input = toDailySheetPdfInput(row);
      const summary =
        `*Ayyanar Construction - Daily Sheet*\n` +
        `Site: ${input.siteName}\nSupervisor: ${input.supervisorName}\nDate: ${new Date(input.date).toLocaleDateString('en-IN')}\n` +
        `Amount Received: ${rupeesText(input.amountReceived)}\nTotal Amount: ${rupeesText(input.totalAmount)}`;
      await sharePdfReportOnWhatsApp(await buildDailySheetPdfDoc(input), summary);
    } catch (error: any) {
      Alert.alert('Share Error', error?.message || 'Unable to share the report.');
    } finally {
      setGeneratingDailySheetPdf(false);
    }
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
      if (tab === 'DAILY_SHEET') await fetchDailySheets();
      if (tab === 'PROJECTS') await fetchSitesAndStaff();
      if (tab === 'TEAM') setStaffList(await adminService.getStaff());
      if (tab === 'LEADS') setLeadsList(await adminService.getLeads());
      if (tab === 'REPORTS') {
        const [sites, drivers, bills] = await Promise.all([
          adminService.getSites(),
          fieldService.getDriverRecords(),
          fieldService.getDriverBills(),
        ]);
        setSitesList(sites);
        setDriverRecords(drivers);
        setDriverBills(bills);
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

  const handleStartEditSite = (site: Site) => {
    setEditingSiteId(site.id);
    setNewSiteName(site.name);
    setNewSiteLocation(site.location);
  };

  const handleCancelEditSite = () => {
    setEditingSiteId(null);
    setNewSiteName('');
    setNewSiteLocation('');
  };

  const handleSaveSiteChanges = async () => {
    if (!editingSiteId || !newSiteName || !newSiteLocation) {
      Alert.alert('Missing Details', 'Enter project site name and location.');
      return;
    }
    setLoading(true);
    try {
      await adminService.updateSite(editingSiteId, { name: newSiteName, location: newSiteLocation });
      handleCancelEditSite();
      await loadTab('PROJECTS');
      Alert.alert('Success', 'Project site updated.');
    } catch {
      Alert.alert('Project Error', 'Unable to update project site.');
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
      if (editingLeadId) {
        await adminService.updateLead(editingLeadId, { name: leadName.trim(), phone: leadPhone.trim(), projectNeeded: leadProject, source: leadSource });
        Alert.alert('Success', 'Lead updated.');
      } else {
        await adminService.createLead({ name: leadName.trim(), phone: leadPhone.trim(), projectNeeded: leadProject, source: leadSource, status: leadStatus });
      }
      handleCancelEditLead();
      await loadTab('LEADS');
    } catch {
      Alert.alert('Lead Error', editingLeadId ? 'Unable to update lead.' : 'Unable to create lead.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEditLead = (lead: any) => {
    setEditingLeadId(lead.id);
    setLeadName(lead.name);
    setLeadPhone(lead.phone || '');
    setLeadProject(lead.project_needed || '');
    setLeadSource(lead.source || '');
  };

  const handleCancelEditLead = () => {
    setEditingLeadId(null);
    setLeadName('');
    setLeadPhone('');
    setLeadProject('');
    setLeadSource('');
    setLeadStatus('Hot Lead');
  };

  const handleDeleteLead = (id: string) => {
    const confirmDelete = async () => {
      await adminService.deleteLead(id);
      loadTab('LEADS');
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this lead?')) confirmDelete();
    } else {
      Alert.alert('Delete Lead', 'Remove this lead?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirmDelete },
      ]);
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

  const buildLeadsPdfDoc = (leads: any[]) => {
    const count = (status: string) => leads.filter((l: any) => l.status === status).length;
    return buildPdfReport({
      filename: `Leads_Report_${leadReportPeriodLabel}.pdf`,
      title: 'Leads Report',
      subtitle: `${leadReportMode === 'DAY' ? 'Date' : 'Month'}: ${leadReportPeriodLabel}`,
      summaryBoxes: [
        { label: 'Total Leads', value: leads.length.toString() },
        { label: 'Hot Leads', value: count('Hot Lead').toString(), color: '#E23744' },
        { label: 'In Discussion', value: count('In Discussion').toString(), color: '#CB202D' },
        { label: 'Converted', value: count('Converted Client').toString(), color: '#8C0F16' },
      ],
      tables: [
        {
          head: ['#', 'Date', 'Lead Name', 'Phone', 'Requirement', 'Source', 'Status'],
          body: leads.map((l: any, i: number) => [
            i + 1,
            new Date(l.created_at).toLocaleDateString('en-IN'),
            l.name,
            l.phone || '-',
            l.project_needed || '-',
            l.source || '-',
            l.status,
          ]),
        },
      ],
    });
  };

  const handleLeadsPdf = async () => {
    const leads = filteredLeadsForReport();
    if (leads.length === 0) {
      Alert.alert('No Data', `No leads registered in ${leadReportPeriodLabel}.`);
      return;
    }
    setGeneratingPdf(true);
    try {
      await downloadPdfReport(await buildLeadsPdfDoc(leads));
    } catch (error: any) {
      Alert.alert('PDF Error', error?.message || 'Unable to generate the leads report.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleLeadsWhatsApp = async () => {
    const leads = filteredLeadsForReport();
    if (leads.length === 0) {
      Alert.alert('No Data', `No leads registered in ${leadReportPeriodLabel}.`);
      return;
    }
    setGeneratingPdf(true);
    try {
      const count = (status: string) => leads.filter((l: any) => l.status === status).length;
      const summary =
        `*Ayyanar Construction - Leads Report*\n` +
        `Period: ${leadReportPeriodLabel}\n` +
        `Total: ${leads.length} • Hot: ${count('Hot Lead')} • In Discussion: ${count('In Discussion')} • Converted: ${count('Converted Client')}`;
      await sharePdfReportOnWhatsApp(await buildLeadsPdfDoc(leads), summary);
    } catch (error: any) {
      Alert.alert('Share Error', error?.message || 'Unable to share the leads report.');
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

  // ---------- Bill (ledger entry) edit / delete ----------
  const handleStartEditBill = (item: any) => {
    setEditingBillId(item.id);
    setBillCategory(item.category || '');
    setBillDescription(item.description || '');
    setBillAmount(item.amount?.toString() || '');
    setBillPaymentMode(item.payment_mode === 'Indirect' ? 'Indirect' : 'Direct');
    setBillDate((item.date || todayIso()).toString().split('T')[0]);
    setBillEditVisible(true);
  };

  const handleSaveBillChanges = async () => {
    if (!editingBillId || !billCategory || !billAmount) {
      Alert.alert('Missing Details', 'Fill category and amount.');
      return;
    }
    setLoading(true);
    try {
      await fieldService.updateExpense(editingBillId, {
        category: billCategory,
        description: billDescription,
        amount: parseFloat(billAmount),
        paymentMode: billPaymentMode,
        date: billDate,
      });
      setBillEditVisible(false);
      setEditingBillId(null);
      await fetchReportData(reportSiteId);
      Alert.alert('Success', 'Bill updated.');
    } catch {
      Alert.alert('Bill Error', 'Unable to update this bill.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBill = (id: string | number) => {
    const confirmDelete = async () => {
      await fieldService.deleteExpense(id);
      await fetchReportData(reportSiteId);
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this bill entry?')) confirmDelete();
    } else {
      Alert.alert('Delete Bill', 'Remove this bill entry?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirmDelete },
      ]);
    }
  };

  // ---------- Driver diesel bills: download / share / delete ----------
  const handleDownloadDriverBill = async (bill: any) => {
    setProcessingBillAction(true);
    try {
      await downloadImage(bill.image_url, `diesel-bill-${bill.id}.jpg`);
    } catch (error: any) {
      Alert.alert('Download Error', error?.message || 'Unable to download the bill photo.');
    } finally {
      setProcessingBillAction(false);
    }
  };

  const handleShareDriverBillWhatsApp = async (bill: any) => {
    setProcessingBillAction(true);
    try {
      const caption = `Diesel Bill — ${bill.driver_name}${bill.vehicle_name ? ` (${bill.vehicle_name})` : ''}${bill.note ? `: ${bill.note}` : ''}`;
      await shareImageOnWhatsApp(bill.image_url, `diesel-bill-${bill.id}.jpg`, caption);
    } catch (error: any) {
      Alert.alert('Share Error', error?.message || 'Unable to share the bill photo.');
    } finally {
      setProcessingBillAction(false);
    }
  };

  const handleDeleteDriverBill = (id: string | number) => {
    const confirmDelete = async () => {
      await fieldService.deleteDriverBill(id);
      setDriverBillDetail(null);
      setDriverBills(await fieldService.getDriverBills());
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this diesel bill?')) confirmDelete();
    } else {
      Alert.alert('Delete Bill', 'Remove this diesel bill?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirmDelete },
      ]);
    }
  };

  // ---------- Driver trip record edit / delete ----------
  const handleStartEditDriverRecord = (rec: any) => {
    setEditingDriverRecord({
      id: rec.id,
      vehicleName: rec.vehicle_name || '',
      driverName: rec.driver_name || '',
      startingKm: rec.starting_km?.toString() || '',
      endingKm: rec.ending_km?.toString() || '',
      distance: rec.distance || '',
      dieselFare: rec.diesel_fare?.toString() || '',
      loadName: rec.load_name || '',
      loadType: rec.load_type === 'Rent' ? 'Rent' : 'Own',
      customerName: rec.customer_name || '',
      place: rec.place || '',
      loadWeight: rec.load_weight || '',
      startingTime: rec.starting_time || '',
      endingTime: rec.ending_time || '',
      date: (rec.date || todayIso()).toString().split('T')[0],
    });
    setDriverRecordEditVisible(true);
  };

  const handleSaveDriverRecordChanges = async () => {
    if (!editingDriverRecord) return;
    const r = editingDriverRecord;
    if (!r.vehicleName || !r.driverName || !r.startingKm || !r.endingKm) {
      Alert.alert('Missing Details', 'Fill vehicle name, driver name, starting KM, and ending KM.');
      return;
    }
    setLoading(true);
    try {
      await fieldService.updateDriverRecord(r.id, r);
      setDriverRecordEditVisible(false);
      setEditingDriverRecord(null);
      setDriverRecords(await fieldService.getDriverRecords());
      Alert.alert('Success', 'Driver trip record updated.');
    } catch {
      Alert.alert('Record Error', 'Unable to update this trip record.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDriverRecord = (id: string | number) => {
    const confirmDelete = async () => {
      await fieldService.deleteDriverRecord(id);
      setDriverRecords(await fieldService.getDriverRecords());
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this trip record?')) confirmDelete();
    } else {
      Alert.alert('Delete Record', 'Remove this trip record?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirmDelete },
      ]);
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

  const buildIoPdfDoc = () => {
    const rows = (ioReport?.rows || []).map((r: any) => [
      new Date(r.date).toLocaleDateString('en-IN'),
      r.input ? Number(r.input).toLocaleString('en-IN') : '-',
      r.output ? Number(r.output).toLocaleString('en-IN') : '-',
      Number(r.balance).toLocaleString('en-IN'),
    ]);
    if (ioFrom) {
      rows.unshift(['Opening Balance', '', '', Number(ioReport?.opening || 0).toLocaleString('en-IN')]);
    }
    return buildPdfReport({
      filename: `${ioRole}_IO_Report.pdf`,
      title: `${ioRole} I/O Report`,
      subtitle: `Date-wise Input / Output / Balance • ${ioRangeTitle}`,
      summaryBoxes: [
        { label: 'Total Input', value: rupeesText(ioReport?.totals?.input), color: '#8C0F16' },
        { label: 'Total Output', value: rupeesText(ioReport?.totals?.output), color: '#E23744' },
        { label: 'Closing Balance', value: rupeesText(ioReport?.totals?.closing) },
      ],
      tables: [
        {
          head: ['Date', 'Input (Rs)', 'Output (Rs)', 'Balance (Rs)'],
          body: rows,
          foot: [
            'TOTAL',
            Number(ioReport?.totals?.input || 0).toLocaleString('en-IN'),
            Number(ioReport?.totals?.output || 0).toLocaleString('en-IN'),
            Number(ioReport?.totals?.closing || 0).toLocaleString('en-IN'),
          ],
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
        },
      ],
    });
  };

  const handleIoPdf = async (viaWhatsApp: boolean) => {
    if (!ioReport || (ioReport.rows || []).length === 0) {
      Alert.alert('No Data', 'There are no transactions for this account in the selected range.');
      return;
    }
    setGeneratingPdf(true);
    try {
      if (viaWhatsApp) {
        const summary =
          `*Ayyanar Construction - ${ioRole} I/O Report*\n` +
          `Period: ${ioRangeTitle}\n` +
          `Total Input: ${rupeesText(ioReport.totals.input)}\n` +
          `Total Output: ${rupeesText(ioReport.totals.output)}\n` +
          `Closing Balance: ${rupeesText(ioReport.totals.closing)}`;
        await sharePdfReportOnWhatsApp(await buildIoPdfDoc(), summary);
      } else {
        await downloadPdfReport(await buildIoPdfDoc());
      }
    } catch (error: any) {
      Alert.alert('PDF Error', error?.message || 'Unable to generate the I/O report.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // ---------- Site Expenses report (bills entered by supervisors) ----------
  const buildSitePdfDoc = () => {
    const site = sitesList.find((s) => s.id === reportSiteId);
    const direct = reportData.filter((item) => item.payment_mode === 'Direct');
    const credit = reportData.filter((item) => item.payment_mode !== 'Direct');
    const sum = (rows: any[]) => rows.reduce((s, r) => s + Number(r.amount || 0), 0);

    const billRows = (rows: any[]) =>
      rows.map((r: any, i: number) => [
        i + 1,
        new Date(r.date).toLocaleDateString('en-IN'),
        r.supervisor_name || 'System',
        r.category || '-',
        r.description || '-',
        Number(r.amount || 0).toLocaleString('en-IN'),
      ]);

    return buildPdfReport({
      filename: `Site_Expenses_${site?.name || 'Report'}.pdf`,
      title: 'Site Expenses Report',
      subtitle: `Site: ${site?.name || '-'} (${site?.location || ''}) • Bills entered by supervisors`,
      summaryBoxes: [
        { label: 'Direct Bills', value: rupeesText(sum(direct)) },
        { label: 'Indirect / Credit', value: rupeesText(sum(credit)) },
        { label: 'Total Site Expense', value: rupeesText(sum(direct) + sum(credit)), color: '#E23744' },
      ],
      tables: [
        {
          title: `DIRECT BILLS (Cash) — ${direct.length} bill(s)`,
          head: ['#', 'Date', 'Supervisor', 'Category', 'Description', 'Amount (Rs)'],
          body: billRows(direct),
          foot: ['', '', '', '', 'TOTAL', sum(direct).toLocaleString('en-IN')],
          columnStyles: { 5: { halign: 'right' } },
        },
        {
          title: `INDIRECT / CREDIT BILLS (Vendor) — ${credit.length} bill(s)`,
          head: ['#', 'Date', 'Supervisor', 'Category', 'Description', 'Amount (Rs)'],
          body: billRows(credit),
          foot: ['', '', '', '', 'TOTAL', sum(credit).toLocaleString('en-IN')],
          columnStyles: { 5: { halign: 'right' } },
        },
      ],
    });
  };

  const handleSitePdf = async (viaWhatsApp: boolean) => {
    if (reportData.length === 0) {
      Alert.alert('No Data', 'There are no expense bills for this site yet.');
      return;
    }
    setGeneratingPdf(true);
    try {
      if (viaWhatsApp) {
        const site = sitesList.find((s) => s.id === reportSiteId);
        const total = reportData.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
        const directBills = reportData.filter((r: any) => r.payment_mode === 'Direct');
        const creditBills = reportData.filter((r: any) => r.payment_mode !== 'Direct');
        const directSum = directBills.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
        const creditSum = creditBills.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
        const summary =
          `*Ayyanar Construction - Site Expenses Report*\n` +
          `Site: ${site?.name || '-'}\n` +
          `Total Bills: ${reportData.length}\n` +
          `Direct (Cash): ${rupeesText(directSum)} (${directBills.length} bills)\n` +
          `Indirect (Credit): ${rupeesText(creditSum)} (${creditBills.length} bills)\n` +
          `Grand Total: ${rupeesText(total)}`;
        await sharePdfReportOnWhatsApp(await buildSitePdfDoc(), summary);
      } else {
        await downloadPdfReport(await buildSitePdfDoc());
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

  const buildDriverPdfDoc = () => {
    const totalKmSum = driverRecords.reduce((sum: number, rec: any) => sum + Number(rec.total_km || 0), 0);
    const dieselSum = driverRecords.reduce((sum: number, rec: any) => sum + Number(rec.diesel_fare || 0), 0);
    const drivers = summarizeDriverRecords('driver_name');
    const vehicles = summarizeDriverRecords('vehicle_name');

    const summaryRows = (entries: [string, { trips: number; km: number; diesel: number }][]) =>
      entries.map(([name, s]) => [name, s.trips, s.km.toLocaleString('en-IN'), s.diesel.toLocaleString('en-IN')]);

    const tripTable = (driverName: string, s: { trips: number; km: number; diesel: number }) => {
      const trips = driverRecords.filter((r: any) => (r.driver_name || 'Unknown') === driverName);
      return {
        title: `${driverName} — ${s.trips} trip(s) • ${s.km.toLocaleString('en-IN')} km • Diesel Rs ${s.diesel.toLocaleString('en-IN')}`,
        head: ['#', 'Date', 'Vehicle', 'KM (Start→End)', 'Total KM', 'Distance', 'Diesel (Rs)', 'Load (Weight)', 'Type/Customer', 'Place', 'Time'],
        body: trips.map((rec: any, i: number) => [
          i + 1,
          new Date(rec.date).toLocaleDateString('en-IN'),
          rec.vehicle_name || '-',
          `${Number(rec.starting_km || 0)} → ${Number(rec.ending_km || 0)}`,
          Number(rec.total_km || 0),
          rec.distance || '-',
          Number(rec.diesel_fare || 0).toLocaleString('en-IN'),
          `${rec.load_name || '-'}${rec.load_weight ? ` (${rec.load_weight})` : ''}`,
          `${rec.load_type || '-'}${rec.customer_name ? ` — ${rec.customer_name}` : ''}`,
          rec.place || '-',
          `${rec.starting_time || '-'} → ${rec.ending_time || '-'}`,
        ]),
      };
    };

    return buildPdfReport({
      filename: 'Driver_Trip_Report.pdf',
      title: 'Driver Trip Report',
      subtitle: `${driverRecords.length} trip record(s)`,
      orientation: 'landscape',
      summaryBoxes: [
        { label: 'Total Trips', value: driverRecords.length.toString() },
        { label: 'Total KM Travelled', value: `${totalKmSum.toLocaleString('en-IN')} km` },
        { label: 'Total Diesel Fare', value: rupeesText(dieselSum), color: '#E23744' },
      ],
      tables: [
        { title: 'Vehicle-wise Summary', head: ['Vehicle', 'Trips', 'Total KM', 'Diesel (Rs)'], body: summaryRows(vehicles) },
        { title: 'Driver-wise Summary', head: ['Driver', 'Trips', 'Total KM', 'Diesel (Rs)'], body: summaryRows(drivers) },
        ...drivers.map(([driverName, s]) => tripTable(driverName, s)),
      ],
    });
  };

  const handleDownloadDriverPdf = async () => {
    if (driverRecords.length === 0) {
      Alert.alert('No Data', 'There are no driver records to export yet.');
      return;
    }
    setGeneratingPdf(true);
    try {
      await downloadPdfReport(await buildDriverPdfDoc());
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
      const totalKmSum = driverRecords.reduce((sum: number, rec: any) => sum + Number(rec.total_km || 0), 0);
      const dieselSum = driverRecords.reduce((sum: number, rec: any) => sum + Number(rec.diesel_fare || 0), 0);
      const summary =
        `*Ayyanar Construction - Driver Trip Report*\n` +
        `Records: ${driverRecords.length}\n` +
        `Total KM: ${totalKmSum.toLocaleString('en-IN')} km\n` +
        `Total Diesel Fare: ${rupeesText(dieselSum)}`;
      await sharePdfReportOnWhatsApp(await buildDriverPdfDoc(), summary);
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

  const renderAttendanceDashboard = () => {
    const todaySupervisors = todayOverview?.supervisors || [];
    const presentToday = todaySupervisors.filter((s: any) => s.status === 'Present');
    const absentToday = todaySupervisors.filter((s: any) => s.status === 'Absent');
    const todayCategories = todayOverview?.categories || [];
    const workerPresentToday = todayCategories.reduce((s: number, c: any) => s + Number(c.present_count || 0), 0);
    const workerAbsentToday = todayCategories.reduce((s: number, c: any) => s + Number(c.absent_count || 0), 0);

    return (
      <View>
        <Text style={styles.screenTitle}>Attendance</Text>
        <Text style={styles.screenSubtitle}>
          Today — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>

        <SectionTitle title="Supervisors Today" />
        <View style={styles.metricsGrid}>
          <MetricCard icon="check-circle" label="Present" value={presentToday.length.toString()} />
          <MetricCard icon="cancel" label="Absent" value={absentToday.length.toString()} />
        </View>
        <View style={styles.card}>
          {presentToday.map((item: any) => (
            <View key={`today-sup-${item.id}`} style={styles.attendanceRow}>
              {item.selfie_url?.startsWith('http') ? (
                <Image source={{ uri: item.selfie_url }} style={styles.attendanceImage} />
              ) : (
                <View style={styles.listIcon}><MaterialIcons name="person-pin-circle" size={22} color={COLORS.primary} /></View>
              )}
              <View style={styles.listContent}>
                <Text style={styles.rowTitle}>{item.supervisor_name || 'Supervisor'}</Text>
                <Text style={styles.rowMeta}>{item.site_name || 'Unassigned Site'}</Text>
              </View>
              {item.created_at && (
                <Text style={{ color: COLORS.success, fontWeight: '900', fontSize: 12 }}>
                  {new Date(item.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}
            </View>
          ))}
          {absentToday.length > 0 && (
            <View style={{ paddingTop: presentToday.length > 0 ? SPACING.sm : 0 }}>
              {absentToday.map((item: any) => (
                <View key={`today-abs-${item.id}`} style={styles.attendanceRow}>
                  <View style={[styles.listIcon, { backgroundColor: 'rgba(226, 26, 18, 0.08)' }]}>
                    <MaterialIcons name="person-off" size={22} color={COLORS.primary} />
                  </View>
                  <View style={styles.listContent}>
                    <Text style={styles.rowTitle}>{item.supervisor_name || 'Supervisor'}</Text>
                    <Text style={styles.rowMeta}>{item.site_name || 'Unassigned Site'}</Text>
                  </View>
                  <StatusPill status="Absent" />
                </View>
              ))}
            </View>
          )}
          {todaySupervisors.length === 0 && <EmptyState text="No supervisor attendance recorded yet today." />}
        </View>

        <SectionTitle title="Workers Today" />
        <View style={styles.metricsGrid}>
          <MetricCard icon="engineering" label="Present" value={workerPresentToday.toString()} />
          <MetricCard icon="event-busy" label="Absent" value={workerAbsentToday.toString()} />
        </View>

        <SectionTitle title="View Details" />
        <TouchableOpacity style={styles.attendanceRow} onPress={() => setAttendanceView('SUPERVISOR')} activeOpacity={0.7}>
          <View style={styles.listIcon}><MaterialIcons name="camera-front" size={22} color={COLORS.primary} /></View>
          <View style={styles.listContent}>
            <Text style={styles.rowTitle}>Supervisor Attendance</Text>
            <Text style={styles.rowMeta}>Check-in photos, any date — downloadable</Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={COLORS.textLight} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.attendanceRow, { marginTop: SPACING.sm }]} onPress={() => setAttendanceView('WORKER')} activeOpacity={0.7}>
          <View style={styles.listIcon}><MaterialIcons name="groups" size={22} color={COLORS.primary} /></View>
          <View style={styles.listContent}>
            <Text style={styles.rowTitle}>Worker Attendance</Text>
            <Text style={styles.rowMeta}>Grouped by supervisor's site, any date</Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={COLORS.textLight} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderSupervisorAttendanceView = () => {
    const supervisorCount = attendance?.supervisors?.length || 0;
    return (
      <View>
        <TouchableOpacity style={styles.backLink} onPress={() => setAttendanceView('DASHBOARD')}>
          <MaterialIcons name="arrow-back" size={16} color={COLORS.primary} />
          <Text style={styles.backLinkText}>Attendance Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Supervisor Attendance</Text>
        <Text style={styles.screenSubtitle}>Check-ins with photo — tap a row to view and download.</Text>

        <View style={styles.dateRow}>
          <TouchableOpacity style={styles.dateButton} onPress={() => setAttendanceDate(todayIso())}>
            <MaterialIcons name="today" size={18} color={COLORS.primary} />
            <Text style={styles.dateButtonText}>Today</Text>
          </TouchableOpacity>
          <DatePickerField style={{ flex: 1 }} value={attendanceDate} onChange={setAttendanceDate} placeholder="Pick a date" />
        </View>

        <View style={styles.card}>
          {(attendance?.supervisors || []).map((item: any) => (
            <AttendanceRow
              key={`supervisor-${item.id}`}
              icon="person-pin-circle"
              title={item.supervisor_name || 'Supervisor'}
              subtitle={`${item.site_name || 'Unassigned Site'} / ${item.location_name || item.site_location || 'Location not recorded'}${item.created_at ? ` / ${new Date(item.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}`}
              status={item.status}
              imageUrl={item.selfie_url?.startsWith('http') ? item.selfie_url : undefined}
              latitude={item.latitude}
              longitude={item.longitude}
              onPress={() => setAttendanceDetail(item)}
            />
          ))}
          {supervisorCount === 0 && <EmptyState text="No supervisor attendance for this date." />}
        </View>
      </View>
    );
  };

  const renderWorkerAttendanceView = () => {
    const categoryList = attendance?.categories || [];
    const grouped = new Map<string, any[]>();
    categoryList.forEach((item: any) => {
      const key = item.site_supervisor_name || 'Unassigned Supervisor';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    });

    return (
      <View>
        <TouchableOpacity style={styles.backLink} onPress={() => setAttendanceView('DASHBOARD')}>
          <MaterialIcons name="arrow-back" size={16} color={COLORS.primary} />
          <Text style={styles.backLinkText}>Attendance Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Worker Attendance</Text>
        <Text style={styles.screenSubtitle}>Category headcounts grouped by the site's supervisor.</Text>

        <View style={styles.dateRow}>
          <TouchableOpacity style={styles.dateButton} onPress={() => setAttendanceDate(todayIso())}>
            <MaterialIcons name="today" size={18} color={COLORS.primary} />
            <Text style={styles.dateButtonText}>Today</Text>
          </TouchableOpacity>
          <DatePickerField style={{ flex: 1 }} value={attendanceDate} onChange={setAttendanceDate} placeholder="Pick a date" />
        </View>

        {Array.from(grouped.entries()).map(([supervisorName, items]) => (
          <View key={supervisorName}>
            <SectionTitle title={`${supervisorName}'s Workers`} />
            <View style={styles.card}>
              {items.map((item: any) => (
                <TouchableOpacity key={`category-${item.id}`} style={styles.attendanceRow} onPress={() => setAttendanceDetail(item)} activeOpacity={0.7}>
                  {item.image_url?.startsWith('http') ? (
                    <Image source={{ uri: item.image_url }} style={styles.attendanceImage} />
                  ) : (
                    <View style={styles.listIcon}><MaterialIcons name="groups" size={22} color={COLORS.primary} /></View>
                  )}
                  <View style={styles.listContent}>
                    <Text style={styles.rowTitle}>{item.category}{item.worker_name ? ` — ${item.worker_name}` : ''}</Text>
                    <Text style={styles.rowMeta}>{item.site_name || 'Site not recorded'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: COLORS.success, fontWeight: '900', fontSize: 13 }}>{item.present_count || 0} Present</Text>
                    {Number(item.absent_count || 0) > 0 && (
                      <Text style={{ color: COLORS.primary, fontWeight: '900', fontSize: 11, marginTop: 2 }}>{item.absent_count} Absent</Text>
                    )}
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={COLORS.textLight} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
        {categoryList.length === 0 && (
          <View style={styles.card}>
            <EmptyState text="No worker attendance for this date." />
          </View>
        )}
      </View>
    );
  };

  const renderAttendance = () => {
    if (attendanceView === 'SUPERVISOR') return renderSupervisorAttendanceView();
    if (attendanceView === 'WORKER') return renderWorkerAttendanceView();
    return renderAttendanceDashboard();
  };

  const renderDailySheet = () => {
    const supervisorNames = Array.from(new Set(dailySheets.map((s: any) => s.supervisor_name))).sort();
    const filtered = dailySheetSupervisor ? dailySheets.filter((s: any) => s.supervisor_name === dailySheetSupervisor) : dailySheets;
    const grandTotal = filtered.reduce((sum: number, s: any) => sum + Number(s.total_amount || 0), 0);

    return (
      <View>
        <Text style={styles.screenTitle}>Daily Sheet</Text>
        <Text style={styles.screenSubtitle}>Supervisor-submitted daily reports — filter by date and supervisor.</Text>

        <View style={styles.card}>
          <Text style={styles.formTitle}>Date</Text>
          <DatePickerField
            value={dailySheetDate}
            onChange={(v) => { setDailySheetDate(v); fetchDailySheets(v); }}
            placeholder="Select date"
          />
        </View>

        {supervisorNames.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.formTitle}>Supervisor</Text>
            <View style={styles.chipRow}>
              <TouchableOpacity style={[styles.chip, !dailySheetSupervisor && styles.chipActive]} onPress={() => setDailySheetSupervisor(null)}>
                <Text style={[styles.chipText, !dailySheetSupervisor && styles.chipTextActive]}>All ({dailySheets.length})</Text>
              </TouchableOpacity>
              {supervisorNames.map((name) => (
                <TouchableOpacity
                  key={name}
                  style={[styles.chip, dailySheetSupervisor === name && styles.chipActive]}
                  onPress={() => setDailySheetSupervisor(name)}
                >
                  <Text style={[styles.chipText, dailySheetSupervisor === name && styles.chipTextActive]}>
                    {name} ({dailySheets.filter((s: any) => s.supervisor_name === name).length})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <SectionTitle title={`Submitted for ${dailySheetDate} (${filtered.length})`} />

        {filtered.length > 0 && (
          <View style={[styles.card, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
            <Text style={styles.rowMeta}>Grand Total{dailySheetSupervisor ? ` — ${dailySheetSupervisor}` : ''}</Text>
            <Text style={{ fontWeight: '900', fontSize: 16, color: COLORS.primary }}>{rupeesText(grandTotal)}</Text>
          </View>
        )}

        {filtered.map((sheet: any) => (
          <TouchableOpacity key={sheet.id} style={styles.listCard} onPress={() => setDailySheetDetail(sheet)}>
            <View style={styles.listIcon}>
              <MaterialIcons name="description" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.listContent}>
              <Text style={styles.rowTitle}>{sheet.supervisor_name} — {sheet.site_name}</Text>
              <Text style={styles.rowMeta}>{sheet.work_description || 'No work description'}</Text>
              <Text style={styles.assignmentText}>Received {rupeesText(sheet.amount_received)} • Total {rupeesText(sheet.total_amount)}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={COLORS.textLight} />
          </TouchableOpacity>
        ))}
        {filtered.length === 0 && <EmptyState text="No daily sheets submitted for this date." />}
      </View>
    );
  };

  const renderProjects = () => (
    <View>
      <Text style={styles.screenTitle}>Projects</Text>
      <Text style={styles.screenSubtitle}>Create sites and assign supervisors without leaving admin.</Text>

      <View style={styles.card}>
        <Text style={styles.formTitle}>{editingSiteId ? 'Edit Project Site' : 'New Project Site'}</Text>
        <TextInput style={styles.input} placeholder="Project site name" value={newSiteName} onChangeText={setNewSiteName} placeholderTextColor={COLORS.textLight} />
        <TextInput style={styles.input} placeholder="Location / address" value={newSiteLocation} onChangeText={setNewSiteLocation} placeholderTextColor={COLORS.textLight} />
        {editingSiteId ? (
          <View style={{ flexDirection: 'row', gap: SPACING.md }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Save Changes" icon="check" onPress={handleSaveSiteChanges} />
            </View>
            <TouchableOpacity
              style={{ backgroundColor: COLORS.textLight, borderRadius: BORDER_RADIUS.md, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flex: 1 }}
              onPress={handleCancelEditSite}
            >
              <Text style={{ color: COLORS.white, fontWeight: '800' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <PrimaryButton label="Create Project" icon="add-business" onPress={handleAddSite} />
        )}
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
          <TouchableOpacity style={[styles.iconButton, { marginRight: 8 }]} onPress={() => handleStartEditSite(site)}>
            <MaterialIcons name="edit" size={22} color={COLORS.success} />
          </TouchableOpacity>
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
        <Text style={styles.formTitle}>{editingLeadId ? 'Edit Lead' : 'Register Lead'}</Text>
        <TextInput style={styles.input} placeholder="Client / lead name" value={leadName} onChangeText={setLeadName} placeholderTextColor={COLORS.textLight} />
        <TextInput style={styles.input} placeholder="Phone number" value={leadPhone} onChangeText={setLeadPhone} placeholderTextColor={COLORS.textLight} keyboardType="phone-pad" />
        <Text style={styles.fieldCaption}>PROJECT REQUIREMENT</Text>
        <ChipSelect
          items={['Construction', 'Aggregate'].map((option) => ({ id: option, label: option }))}
          value={leadProject || null}
          onChange={setLeadProject}
        />
        <TextInput style={styles.input} placeholder="Lead source" value={leadSource} onChangeText={setLeadSource} placeholderTextColor={COLORS.textLight} />
        {!editingLeadId && (
          <ChipSelect
            items={(['Hot Lead', 'In Discussion', 'Converted Client'] as Lead['status'][]).map((status) => ({ id: status, label: status }))}
            value={leadStatus}
            onChange={(status) => setLeadStatus(status as Lead['status'])}
          />
        )}
        {editingLeadId ? (
          <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xs }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Save Changes" icon="check" onPress={handleAddLead} />
            </View>
            <TouchableOpacity
              style={{ backgroundColor: COLORS.textLight, borderRadius: BORDER_RADIUS.md, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flex: 1 }}
              onPress={handleCancelEditLead}
            >
              <Text style={{ color: COLORS.white, fontWeight: '800' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <PrimaryButton label="Register Lead" icon="add" onPress={handleAddLead} />
        )}
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
          <TouchableOpacity style={[styles.pdfButton, styles.whatsappButton, generatingPdf && { opacity: 0.6 }]} onPress={handleLeadsWhatsApp} disabled={generatingPdf}>
            <MaterialIcons name="share" size={18} color={COLORS.white} />
            <Text style={styles.pdfButtonText}>Share on WhatsApp</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.pdfActionsRow, { marginTop: SPACING.sm }]}>
          <TouchableOpacity style={[styles.pdfButton, { backgroundColor: '#8C0F16' }, generatingPdf && { opacity: 0.6 }]} onPress={handleLeadsExcel} disabled={generatingPdf}>
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
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {lead.phone ? (
                      <TouchableOpacity style={styles.callButton} onPress={() => Linking.openURL(`tel:${lead.phone}`)}>
                        <MaterialIcons name="call" size={20} color={COLORS.white} />
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity style={styles.iconButton} onPress={() => handleStartEditLead(lead)}>
                      <MaterialIcons name="edit" size={20} color={COLORS.success} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton} onPress={() => handleDeleteLead(lead.id)}>
                      <MaterialIcons name="delete-outline" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
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
            <View style={{ flex: 1, backgroundColor: '#FCE9E9', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#F4C6C8' }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#8C0F16', letterSpacing: 0.5 }}>DIRECT (CASH)</Text>
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#8C0F16', marginTop: 4 }}>
                ₹{directTotal.toLocaleString()}
              </Text>
              <Text style={{ fontSize: 10, color: '#8C0F16', marginTop: 2 }}>{direct.length} bill(s)</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#FCE9E9', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#F4C6C8' }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#CB202D', letterSpacing: 0.5 }}>INDIRECT (CREDIT)</Text>
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#CB202D', marginTop: 4 }}>
                ₹{creditTotal.toLocaleString()}
              </Text>
              <Text style={{ fontSize: 10, color: '#CB202D', marginTop: 2 }}>{credit.length} bill(s)</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#FCE9E9', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#F4C6C8' }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#CB202D', letterSpacing: 0.5 }}>GRAND TOTAL</Text>
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#CB202D', marginTop: 4 }}>
                ₹{grandTotal.toLocaleString()}
              </Text>
              <Text style={{ fontSize: 10, color: '#CB202D', marginTop: 2 }}>{reportData.length} bill(s)</Text>
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
        <LedgerList data={direct} empty="No direct cash bills recorded for this site." onEdit={handleStartEditBill} onDelete={handleDeleteBill} />

        <SectionTitle title={`💳 Indirect / Credit Bills (${credit.length})`} />
        <LedgerList data={credit} empty="No indirect credit bills recorded for this site." onEdit={handleStartEditBill} onDelete={handleDeleteBill} />
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
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
              <TouchableOpacity style={styles.iconButtonSmall} onPress={() => handleStartEditDriverRecord(rec)}>
                <MaterialIcons name="edit" size={18} color={COLORS.success} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButtonSmall} onPress={() => handleDeleteDriverRecord(rec.id)}>
                <MaterialIcons name="delete-outline" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {driverRecords.length === 0 && <EmptyState text="No driver trip records yet." />}
      </View>

      <SectionTitle title={`Diesel Bills Uploaded by Drivers (${driverBills.length})`} />
      <View style={styles.card}>
        {driverBills.map((bill: any) => (
          <TouchableOpacity key={bill.id} style={styles.ledgerCard} onPress={() => setDriverBillDetail(bill)} activeOpacity={0.7}>
            <View style={styles.pipelineHeader}>
              {bill.image_url?.startsWith('http') && (
                <Image source={{ uri: bill.image_url }} style={styles.thumb} />
              )}
              <View style={{ flex: 1, marginLeft: bill.image_url?.startsWith('http') ? 10 : 0 }}>
                <Text style={styles.rowTitle}>{bill.driver_name}{bill.vehicle_name ? ` — ${bill.vehicle_name}` : ''}</Text>
                <Text style={styles.rowMeta}>{bill.note || 'No note'}</Text>
                <Text style={styles.assignmentText}>{new Date(bill.date).toLocaleDateString('en-IN')}</Text>
              </View>
              {bill.amount ? <Text style={styles.rowAmount}>Rs {Number(bill.amount).toLocaleString()}</Text> : null}
            </View>
          </TouchableOpacity>
        ))}
        {driverBills.length === 0 && <EmptyState text="No diesel bills uploaded by drivers yet." />}
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
    if (activeTab === 'DAILY_SHEET') return renderDailySheet();
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

      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
      >
        {loading && !refreshing ? <ActivityIndicator color={COLORS.primary} style={styles.loader} /> : null}
        {renderActiveTab()}
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Supervisor attendance detail: full selfie photo + location + map */}
      <Modal visible={!!attendanceDetail} transparent animationType="slide" onRequestClose={() => setAttendanceDetail(null)}>
        <View style={styles.detailBackdrop}>
          <View style={styles.detailSheet}>
            <View style={styles.detailHandle} />
            {attendanceDetail && attendanceDetail.category !== undefined ? (
              <>
                <View style={styles.detailHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailName}>{attendanceDetail.category}{attendanceDetail.worker_name ? ` — ${attendanceDetail.worker_name}` : ''}</Text>
                    <Text style={styles.detailMeta}>
                      {attendanceDetail.site_name || 'Site not recorded'} • {new Date(attendanceDetail.date).toLocaleDateString('en-IN')}
                    </Text>
                  </View>
                </View>

                {attendanceDetail.image_url?.startsWith('http') ? (
                  <>
                    <Image source={{ uri: attendanceDetail.image_url }} style={styles.detailPhoto} resizeMode="cover" />
                    <TouchableOpacity
                      style={styles.detailDownloadButton}
                      onPress={() => downloadImage(attendanceDetail.image_url, `${attendanceDetail.category}-${attendanceDetail.date}.jpg`)}
                    >
                      <MaterialIcons name="download" size={18} color={COLORS.white} />
                      <Text style={styles.detailMapButtonText}>Download Photo</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.detailNoPhoto}>
                    <MaterialIcons name="no-photography" size={40} color={COLORS.textLight} />
                    <Text style={styles.detailNoPhotoText}>No crew photo uploaded.</Text>
                  </View>
                )}

                <View style={styles.detailLocationRow}>
                  <MaterialIcons name="groups" size={18} color={COLORS.success} />
                  <Text style={styles.detailLocationText}>
                    {attendanceDetail.present_count || 0} present{Number(attendanceDetail.absent_count || 0) > 0 ? ` • ${attendanceDetail.absent_count} absent` : ''}
                  </Text>
                </View>

                <TouchableOpacity style={styles.detailCloseButton} onPress={() => setAttendanceDetail(null)}>
                  <Text style={styles.detailCloseButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            ) : attendanceDetail && (
              <>
                <View style={styles.detailHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailName}>{attendanceDetail.supervisor_name || 'Supervisor'}</Text>
                    <Text style={styles.detailMeta}>
                      {attendanceDetail.site_name || 'Site'} • {new Date(attendanceDetail.date).toLocaleDateString('en-IN')}
                      {attendanceDetail.created_at ? ` • ${new Date(attendanceDetail.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </Text>
                  </View>
                  <StatusPill status={attendanceDetail.status || 'Present'} />
                </View>

                {attendanceDetail.selfie_url?.startsWith('http') ? (
                  <>
                    <Image source={{ uri: attendanceDetail.selfie_url }} style={styles.detailPhoto} resizeMode="cover" />
                    <TouchableOpacity
                      style={styles.detailDownloadButton}
                      onPress={() => downloadImage(attendanceDetail.selfie_url, `${attendanceDetail.supervisor_name || 'supervisor'}-${attendanceDetail.date}.jpg`)}
                    >
                      <MaterialIcons name="download" size={18} color={COLORS.white} />
                      <Text style={styles.detailMapButtonText}>Download Photo</Text>
                    </TouchableOpacity>
                  </>
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

      {/* Daily Sheet detail — full breakdown of one supervisor's submitted daily report */}
      <Modal visible={!!dailySheetDetail} transparent animationType="slide" onRequestClose={() => setDailySheetDetail(null)}>
        <View style={styles.detailBackdrop}>
          <ScrollView style={[styles.detailSheet, { maxHeight: '88%' }]}>
            <View style={styles.detailHandle} />
            {dailySheetDetail && (
              <>
                <View style={styles.detailHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailName}>{dailySheetDetail.supervisor_name}</Text>
                    <Text style={styles.detailMeta}>
                      {dailySheetDetail.site_name} • {new Date(dailySheetDetail.date).toLocaleDateString('en-IN')}
                    </Text>
                  </View>
                </View>

                {dailySheetDetail.work_description ? (
                  <Text style={[styles.detailMeta, { marginBottom: SPACING.md }]}>Work: {dailySheetDetail.work_description}</Text>
                ) : null}

                <Text style={styles.formTitle}>Attendance</Text>
                {(dailySheetDetail.attendance || []).length > 0 ? (
                  (dailySheetDetail.attendance || []).map((a: any, i: number) => (
                    <View key={i} style={styles.detailLocationRow}>
                      <MaterialIcons name="groups" size={18} color={COLORS.success} />
                      <Text style={styles.detailLocationText}>{a.category}{a.name ? ` — ${a.name}` : ''}: {a.count} present</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.detailMeta}>No attendance recorded.</Text>
                )}

                <Text style={[styles.formTitle, { marginTop: SPACING.md }]}>Money</Text>
                <View style={styles.detailLocationRow}>
                  <MaterialIcons name="south-west" size={18} color={COLORS.success} />
                  <Text style={styles.detailLocationText}>Amount Received: {rupeesText(dailySheetDetail.amount_received)}</Text>
                </View>
                <View style={styles.detailLocationRow}>
                  <MaterialIcons name="receipt" size={18} color={COLORS.primary} />
                  <Text style={styles.detailLocationText}>Bills — Normal: {rupeesText(dailySheetDetail.bills_normal)}</Text>
                </View>
                <View style={styles.detailLocationRow}>
                  <MaterialIcons name="receipt-long" size={18} color={COLORS.primary} />
                  <Text style={styles.detailLocationText}>Bills — GST: {rupeesText(dailySheetDetail.bills_gst)}</Text>
                </View>
                <View style={styles.detailLocationRow}>
                  <MaterialIcons name="credit-card" size={18} color={COLORS.primary} />
                  <Text style={styles.detailLocationText}>Bills — Under GST / Credit: {rupeesText(dailySheetDetail.bills_credit)}</Text>
                </View>
                <View style={styles.detailLocationRow}>
                  <MaterialIcons name="local-shipping" size={18} color={COLORS.primary} />
                  <Text style={styles.detailLocationText}>Vehicle & Rental: {rupeesText(dailySheetDetail.vehicle_rental)}</Text>
                </View>

                <Text style={[styles.formTitle, { marginTop: SPACING.md }]}>Labour Salary</Text>
                {(dailySheetDetail.labourSalary || []).length > 0 ? (
                  (dailySheetDetail.labourSalary || []).map((l: any, i: number) => (
                    <View key={i} style={styles.detailLocationRow}>
                      <MaterialIcons name="badge" size={18} color={COLORS.success} />
                      <Text style={styles.detailLocationText}>{l.name}: {rupeesText(l.amount)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.detailMeta}>No labour salary recorded.</Text>
                )}

                <View style={[styles.detailLocationRow, { marginTop: SPACING.md }]}>
                  <MaterialIcons name="account-balance-wallet" size={20} color={COLORS.primary} />
                  <Text style={[styles.detailLocationText, { fontWeight: '900', fontSize: 15 }]}>
                    TOTAL AMOUNT: {rupeesText(dailySheetDetail.total_amount)}
                  </Text>
                </View>

                <View style={styles.pdfActionsRow}>
                  <TouchableOpacity
                    style={[styles.pdfButton, generatingDailySheetPdf && { opacity: 0.6 }]}
                    onPress={() => handleDownloadDailySheet(dailySheetDetail)}
                    disabled={generatingDailySheetPdf}
                  >
                    {generatingDailySheetPdf ? <ActivityIndicator color={COLORS.white} size="small" /> : <MaterialIcons name="picture-as-pdf" size={18} color={COLORS.white} />}
                    <Text style={styles.pdfButtonText}>Download PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pdfButton, styles.whatsappButton, generatingDailySheetPdf && { opacity: 0.6 }]}
                    onPress={() => handleShareDailySheet(dailySheetDetail)}
                    disabled={generatingDailySheetPdf}
                  >
                    <MaterialIcons name="share" size={18} color={COLORS.white} />
                    <Text style={styles.pdfButtonText}>Share on WhatsApp</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.detailCloseButton} onPress={() => setDailySheetDetail(null)}>
                  <Text style={styles.detailCloseButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Edit a material/petty-cash bill */}
      <Modal visible={billEditVisible} transparent animationType="slide" onRequestClose={() => setBillEditVisible(false)}>
        <KeyboardAvoidingView style={styles.detailBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={styles.detailSheet} keyboardShouldPersistTaps="handled">
            <View style={styles.detailHandle} />
            <Text style={styles.detailName}>Edit Bill</Text>
            <TextInput style={[styles.input, { marginTop: SPACING.md }]} placeholder="Category" value={billCategory} onChangeText={setBillCategory} placeholderTextColor={COLORS.textLight} />
            <TextInput style={styles.input} placeholder="Description" value={billDescription} onChangeText={setBillDescription} placeholderTextColor={COLORS.textLight} />
            <TextInput style={styles.input} placeholder="Amount" keyboardType="numeric" value={billAmount} onChangeText={setBillAmount} placeholderTextColor={COLORS.textLight} />
            <ChipSelect
              items={[{ id: 'Direct', label: 'Direct (Cash)' }, { id: 'Indirect', label: 'Indirect (Credit)' }]}
              value={billPaymentMode}
              onChange={(v) => setBillPaymentMode(v as 'Direct' | 'Indirect')}
            />
            <DatePickerField value={billDate} onChange={setBillDate} placeholder="Bill date" />
            <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md, marginBottom: SPACING.lg }}>
              <TouchableOpacity style={[styles.detailCloseButton, { flex: 1 }]} onPress={() => setBillEditVisible(false)}>
                <Text style={styles.detailCloseButtonText}>Cancel</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <PrimaryButton label="Save Changes" icon="check" onPress={handleSaveBillChanges} />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Driver diesel bill detail: full photo + download / WhatsApp / delete */}
      <Modal visible={!!driverBillDetail} transparent animationType="slide" onRequestClose={() => setDriverBillDetail(null)}>
        <View style={styles.detailBackdrop}>
          <View style={styles.detailSheet}>
            <View style={styles.detailHandle} />
            {driverBillDetail && (
              <>
                <Text style={styles.detailName}>{driverBillDetail.driver_name}{driverBillDetail.vehicle_name ? ` — ${driverBillDetail.vehicle_name}` : ''}</Text>
                <Text style={styles.detailMeta}>{new Date(driverBillDetail.date).toLocaleDateString('en-IN')}{driverBillDetail.amount ? ` • Rs ${Number(driverBillDetail.amount).toLocaleString()}` : ''}</Text>
                {driverBillDetail.note ? <Text style={[styles.detailMeta, { marginTop: 4 }]}>{driverBillDetail.note}</Text> : null}

                {driverBillDetail.image_url?.startsWith('http') && (
                  <Image source={{ uri: driverBillDetail.image_url }} style={[styles.detailPhoto, { marginTop: SPACING.md }]} resizeMode="cover" />
                )}

                <View style={styles.pdfActionsRow}>
                  <TouchableOpacity style={[styles.pdfButton, processingBillAction && { opacity: 0.6 }]} onPress={() => handleDownloadDriverBill(driverBillDetail)} disabled={processingBillAction}>
                    {processingBillAction ? <ActivityIndicator color={COLORS.white} size="small" /> : <MaterialIcons name="download" size={18} color={COLORS.white} />}
                    <Text style={styles.pdfButtonText}>Download</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.pdfButton, styles.whatsappButton, processingBillAction && { opacity: 0.6 }]} onPress={() => handleShareDriverBillWhatsApp(driverBillDetail)} disabled={processingBillAction}>
                    <MaterialIcons name="share" size={18} color={COLORS.white} />
                    <Text style={styles.pdfButtonText}>Share on WhatsApp</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm }}>
                  <TouchableOpacity style={[styles.detailCloseButton, { flex: 1 }]} onPress={() => setDriverBillDetail(null)}>
                    <Text style={styles.detailCloseButtonText}>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ flex: 1, backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center' }} onPress={() => handleDeleteDriverBill(driverBillDetail.id)}>
                    <Text style={{ color: COLORS.white, fontWeight: '900' }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit a driver trip record */}
      <Modal visible={driverRecordEditVisible} transparent animationType="slide" onRequestClose={() => setDriverRecordEditVisible(false)}>
        <KeyboardAvoidingView style={styles.detailBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={styles.detailSheet} keyboardShouldPersistTaps="handled">
            <View style={styles.detailHandle} />
            <Text style={styles.detailName}>Edit Trip Record</Text>
            {editingDriverRecord && (
              <>
                <TextInput style={[styles.input, { marginTop: SPACING.md }]} placeholder="Vehicle name" value={editingDriverRecord.vehicleName} onChangeText={(v) => setEditingDriverRecord({ ...editingDriverRecord, vehicleName: v })} placeholderTextColor={COLORS.textLight} />
                <TextInput style={styles.input} placeholder="Driver name" value={editingDriverRecord.driverName} onChangeText={(v) => setEditingDriverRecord({ ...editingDriverRecord, driverName: v })} placeholderTextColor={COLORS.textLight} />
                <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="Starting KM" keyboardType="numeric" value={editingDriverRecord.startingKm} onChangeText={(v) => setEditingDriverRecord({ ...editingDriverRecord, startingKm: v })} placeholderTextColor={COLORS.textLight} />
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="Ending KM" keyboardType="numeric" value={editingDriverRecord.endingKm} onChangeText={(v) => setEditingDriverRecord({ ...editingDriverRecord, endingKm: v })} placeholderTextColor={COLORS.textLight} />
                </View>
                <TextInput style={styles.input} placeholder="Distance" value={editingDriverRecord.distance} onChangeText={(v) => setEditingDriverRecord({ ...editingDriverRecord, distance: v })} placeholderTextColor={COLORS.textLight} />
                <TextInput style={styles.input} placeholder="Diesel fare" keyboardType="numeric" value={editingDriverRecord.dieselFare} onChangeText={(v) => setEditingDriverRecord({ ...editingDriverRecord, dieselFare: v })} placeholderTextColor={COLORS.textLight} />
                <TextInput style={styles.input} placeholder="Load name" value={editingDriverRecord.loadName} onChangeText={(v) => setEditingDriverRecord({ ...editingDriverRecord, loadName: v })} placeholderTextColor={COLORS.textLight} />
                <ChipSelect
                  items={[{ id: 'Own', label: 'Own' }, { id: 'Rent', label: 'Rent' }]}
                  value={editingDriverRecord.loadType}
                  onChange={(v) => setEditingDriverRecord({ ...editingDriverRecord, loadType: v })}
                />
                {editingDriverRecord.loadType === 'Rent' && (
                  <TextInput style={styles.input} placeholder="Customer name" value={editingDriverRecord.customerName} onChangeText={(v) => setEditingDriverRecord({ ...editingDriverRecord, customerName: v })} placeholderTextColor={COLORS.textLight} />
                )}
                <TextInput style={styles.input} placeholder="Place" value={editingDriverRecord.place} onChangeText={(v) => setEditingDriverRecord({ ...editingDriverRecord, place: v })} placeholderTextColor={COLORS.textLight} />
                <TextInput style={styles.input} placeholder="Load weight" value={editingDriverRecord.loadWeight} onChangeText={(v) => setEditingDriverRecord({ ...editingDriverRecord, loadWeight: v })} placeholderTextColor={COLORS.textLight} />
                <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="Starting time" value={editingDriverRecord.startingTime} onChangeText={(v) => setEditingDriverRecord({ ...editingDriverRecord, startingTime: v })} placeholderTextColor={COLORS.textLight} />
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="Ending time" value={editingDriverRecord.endingTime} onChangeText={(v) => setEditingDriverRecord({ ...editingDriverRecord, endingTime: v })} placeholderTextColor={COLORS.textLight} />
                </View>
                <DatePickerField value={editingDriverRecord.date} onChange={(v) => setEditingDriverRecord({ ...editingDriverRecord, date: v })} placeholder="Trip date" />

                <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md, marginBottom: SPACING.lg }}>
                  <TouchableOpacity style={[styles.detailCloseButton, { flex: 1 }]} onPress={() => setDriverRecordEditVisible(false)}>
                    <Text style={styles.detailCloseButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton label="Save Changes" icon="check" onPress={handleSaveDriverRecordChanges} />
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
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

function LedgerList({ data, empty, onEdit, onDelete }: { data: any[]; empty: string; onEdit: (item: any) => void; onDelete: (id: any) => void }) {
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
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
              <TouchableOpacity style={styles.iconButtonSmall} onPress={() => onEdit(item)}>
                <MaterialIcons name="edit" size={18} color={COLORS.success} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButtonSmall} onPress={() => onDelete(item.id)}>
                <MaterialIcons name="delete-outline" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
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
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginBottom: SPACING.sm,
  },
  backLinkText: {
    color: COLORS.primary,
    fontWeight: '800',
    fontSize: 13,
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
  iconButtonSmall: {
    width: 30,
    height: 30,
    borderRadius: 7,
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
    backgroundColor: '#E23744',
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
    maxHeight: '90%',
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
  detailDownloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 13,
    marginTop: SPACING.sm,
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
