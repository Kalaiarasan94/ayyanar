import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fieldService, adminService } from '../services/api';
import DatePickerField from '../components/DatePickerField';
import { buildDailySheetPdfDoc, downloadPdfReport, sharePdfReportOnWhatsApp } from '../services/pdfReport';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/Theme';

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const rupees = (v: any) => `Rs ${Number(v || 0).toLocaleString('en-IN')}`;
const dateLabel = (iso: string) => {
  const parts = (iso || '').toString().split('T')[0].split('-');
  if (parts.length < 3) return iso || '-';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${parts[2]} ${MONTHS[parseInt(parts[1]) - 1] || ''} ${parts[0]}`;
};


type AttendanceRow = { id: string; name: string; category: string; count: string };
type SalaryRow = { id: string; name: string; amount: string };

export default function DailySheetScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('Supervisor');

  const [sites, setSites] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedSiteName, setSelectedSiteName] = useState<string | null>(null);

  const [date, setDate] = useState(todayLocal());
  const [workDescription, setWorkDescription] = useState('');

  // Attendance line items
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [attName, setAttName] = useState('');
  const [attCategory, setAttCategory] = useState('');
  const [attCount, setAttCount] = useState('');

  const [amountReceived, setAmountReceived] = useState('');
  const [billsNormal, setBillsNormal] = useState('');
  const [billsGst, setBillsGst] = useState('');
  const [billsCredit, setBillsCredit] = useState('');
  const [vehicleRental, setVehicleRental] = useState('');

  // Labour salary line items
  const [salary, setSalary] = useState<SalaryRow[]>([]);
  const [salaryName, setSalaryName] = useState('');
  const [salaryAmount, setSalaryAmount] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submittedList, setSubmittedList] = useState<any[]>([]);
  const [loadingSubmitted, setLoadingSubmitted] = useState(false);
  const [view, setView] = useState<'entry' | 'submitted'>('entry');
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    const init = async () => {
      const id = await AsyncStorage.getItem('userId');
      const role = await AsyncStorage.getItem('userRole');
      const name = await AsyncStorage.getItem('userName');
      setUserId(id);
      if (name) setUserName(name);
      try {
        let sitesData: any[] = [];
        if (role === 'Admin' || role === 'Accounts') {
          sitesData = await adminService.getSites();
        } else if (id) {
          sitesData = await fieldService.getSupervisorSites(id);
        }
        setSites(sitesData || []);
        if (sitesData?.length > 0) {
          setSelectedSiteId(sitesData[0].id.toString());
          setSelectedSiteName(sitesData[0].name);
        }
      } catch (err) {
        console.error('Failed to load sites for Daily Sheet:', err);
      }
    };
    init();
  }, []);

  const loadSubmitted = async (siteId = selectedSiteId, forDate = date) => {
    if (!siteId) return;
    setLoadingSubmitted(true);
    try {
      setSubmittedList(await fieldService.getDailySheetsBySite(siteId, forDate));
    } catch {
      setSubmittedList([]);
    } finally {
      setLoadingSubmitted(false);
    }
  };

  useEffect(() => {
    loadSubmitted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSiteId, date]);

  const handleSiteChange = (siteId: string) => {
    setSelectedSiteId(siteId);
    const site = sites.find((s) => s.id.toString() === siteId);
    if (site) setSelectedSiteName(site.name);
  };

  const addAttendanceRow = () => {
    if (!attCategory.trim()) {
      Alert.alert('Missing Info', 'Enter a worker category (e.g., Mason, Helper).');
      return;
    }
    const count = parseInt(attCount) || 0;
    if (count <= 0) {
      Alert.alert('Missing Info', 'Enter how many workers under this category.');
      return;
    }
    setAttendance([...attendance, { id: Date.now().toString(), name: attName.trim(), category: attCategory.trim(), count: String(count) }]);
    setAttName('');
    setAttCategory('');
    setAttCount('');
  };

  const removeAttendanceRow = (id: string) => setAttendance(attendance.filter((a) => a.id !== id));

  const addSalaryRow = () => {
    const amount = parseFloat(salaryAmount);
    if (!salaryName.trim() || isNaN(amount) || amount <= 0) {
      Alert.alert('Missing Info', 'Enter the worker name and a valid salary amount.');
      return;
    }
    setSalary([...salary, { id: Date.now().toString(), name: salaryName.trim(), amount: String(amount) }]);
    setSalaryName('');
    setSalaryAmount('');
  };

  const removeSalaryRow = (id: string) => setSalary(salary.filter((s) => s.id !== id));

  const salaryTotal = salary.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  const totalAmount =
    (parseFloat(billsNormal) || 0) +
    (parseFloat(billsGst) || 0) +
    (parseFloat(billsCredit) || 0) +
    (parseFloat(vehicleRental) || 0) +
    salaryTotal;

  const resetForm = () => {
    setWorkDescription('');
    setAttendance([]);
    setAmountReceived('');
    setBillsNormal('');
    setBillsGst('');
    setBillsCredit('');
    setVehicleRental('');
    setSalary([]);
  };

  // Normalizes a backend daily_sheets row into buildDailySheetPdfDoc's input shape
  const toSheetInput = (row: any) => ({
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

  const handleDownloadSheet = async (sheetInput: ReturnType<typeof toSheetInput>) => {
    setGeneratingPdf(true);
    try {
      await downloadPdfReport(await buildDailySheetPdfDoc(sheetInput));
    } catch (error: any) {
      Alert.alert('PDF Error', error?.message || 'Unable to generate the report.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleShareSheet = async (sheetInput: ReturnType<typeof toSheetInput>) => {
    setGeneratingPdf(true);
    try {
      const summary =
        `*Ayyanar Construction - Daily Sheet*\n` +
        `Site: ${sheetInput.siteName}\nDate: ${dateLabel(sheetInput.date)}\nSupervisor: ${sheetInput.supervisorName}\n` +
        `Amount Received: ${rupees(sheetInput.amountReceived)}\nTotal Amount: ${rupees(sheetInput.totalAmount)}`;
      await sharePdfReportOnWhatsApp(await buildDailySheetPdfDoc(sheetInput), summary);
    } catch (error: any) {
      Alert.alert('Share Error', error?.message || 'Unable to share the report.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedSiteId) {
      Alert.alert('Select Site', 'Please select a project site first.');
      return;
    }
    setSubmitting(true);
    try {
      await fieldService.submitDailySheet({
        siteId: selectedSiteId,
        userId,
        date,
        workDescription: workDescription.trim(),
        attendance: attendance.map((a) => ({ name: a.name, category: a.category, count: parseInt(a.count) || 0 })),
        amountReceived: parseFloat(amountReceived) || 0,
        billsNormal: parseFloat(billsNormal) || 0,
        billsGst: parseFloat(billsGst) || 0,
        billsCredit: parseFloat(billsCredit) || 0,
        vehicleRental: parseFloat(vehicleRental) || 0,
        labourSalary: salary.map((s) => ({ name: s.name, amount: parseFloat(s.amount) || 0 })),
      });

      const savedSnapshot = {
        siteName: selectedSiteName || 'Site',
        supervisorName: userName,
        date,
        workDescription: workDescription.trim(),
        attendance: attendance.map((a) => ({ name: a.name, category: a.category, count: parseInt(a.count) || 0 })),
        amountReceived: parseFloat(amountReceived) || 0,
        billsNormal: parseFloat(billsNormal) || 0,
        billsGst: parseFloat(billsGst) || 0,
        billsCredit: parseFloat(billsCredit) || 0,
        vehicleRental: parseFloat(vehicleRental) || 0,
        labourSalary: salary.map((s) => ({ name: s.name, amount: parseFloat(s.amount) || 0 })),
        totalAmount,
      };

      resetForm();
      loadSubmitted();

      Alert.alert(
        'Saved',
        `Daily sheet for ${savedSnapshot.siteName} on ${date} has been recorded.`,
        [
          { text: 'Download PDF', onPress: () => handleDownloadSheet(savedSnapshot) },
          { text: 'Share on WhatsApp', onPress: () => handleShareSheet(savedSnapshot) },
          { text: 'OK' },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to save the daily sheet.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderEntry = () => (
    <>
      {/* SITE & DATE */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIconWrap}>
            <MaterialIcons name="fact-check" size={20} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Daily Sheet</Text>
            <Text style={styles.cardSubtitle}>One combined report for today's site work</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>SITE</Text>
            {sites.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }}>
                <View style={styles.chipRow}>
                  {sites.map((site) => (
                    <TouchableOpacity
                      key={site.id}
                      style={[styles.chip, selectedSiteId === site.id.toString() && styles.chipActive]}
                      onPress={() => handleSiteChange(site.id.toString())}
                    >
                      <Text style={[styles.chipText, selectedSiteId === site.id.toString() && styles.chipTextActive]}>{site.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.warningBox}>
                <MaterialIcons name="warning" size={16} color={COLORS.primary} />
                <Text style={styles.warningText}>No project sites found</Text>
              </View>
            )}

            <Text style={styles.sectionLabel}>DATE</Text>
            <DatePickerField value={date} onChange={setDate} placeholder="Sheet date" style={styles.fieldSpacing} />

            <Text style={styles.sectionLabel}>WORK DONE TODAY</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="construction" size={18} color={COLORS.textLight} style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="e.g., Plastering Work"
                value={workDescription}
                onChangeText={setWorkDescription}
                placeholderTextColor={COLORS.textLight}
              />
            </View>
          </View>

          {/* ATTENDANCE */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrap}>
                <MaterialIcons name="groups" size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Attendance</Text>
                <Text style={styles.cardSubtitle}>Who worked today</Text>
              </View>
            </View>

            <View style={styles.inputWrap}>
              <MaterialIcons name="person" size={18} color={COLORS.textLight} style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="Name (optional)"
                value={attName}
                onChangeText={setAttName}
                placeholderTextColor={COLORS.textLight}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: SPACING.md }}>
              <View style={[styles.inputWrap, { flex: 1.4, marginBottom: 0 }]}>
                <TextInput
                  style={styles.inputField}
                  placeholder="Category (e.g., Mason)"
                  value={attCategory}
                  onChangeText={setAttCategory}
                  placeholderTextColor={COLORS.textLight}
                />
              </View>
              <View style={[styles.inputWrap, { flex: 1, marginBottom: 0 }]}>
                <TextInput
                  style={styles.inputField}
                  placeholder="Count"
                  keyboardType="numeric"
                  value={attCount}
                  onChangeText={setAttCount}
                  placeholderTextColor={COLORS.textLight}
                />
              </View>
            </View>
            <TouchableOpacity style={styles.secondaryButton} onPress={addAttendanceRow}>
              <MaterialIcons name="add" size={18} color={COLORS.primary} />
              <Text style={styles.secondaryButtonText}>Add to Attendance</Text>
            </TouchableOpacity>

            {attendance.length > 0 && (
              <View style={{ marginTop: SPACING.md }}>
                {attendance.map((a) => (
                  <View key={a.id} style={styles.rowItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowItemTitle}>{a.category}{a.name ? ` — ${a.name}` : ''}</Text>
                      <Text style={styles.rowItemMeta}>{a.count} present</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeAttendanceRow(a.id)}>
                      <MaterialIcons name="remove-circle-outline" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* MONEY */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrap}>
                <MaterialIcons name="payments" size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Amount Received</Text>
                <Text style={styles.cardSubtitle}>Cash given to you for today</Text>
              </View>
            </View>
            <View style={styles.inputWrap}>
              <MaterialIcons name="currency-rupee" size={18} color={COLORS.textLight} style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="0.00"
                keyboardType="numeric"
                value={amountReceived}
                onChangeText={setAmountReceived}
                placeholderTextColor={COLORS.textLight}
              />
            </View>
          </View>

          {/* BILLS */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrap}>
                <MaterialIcons name="receipt-long" size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Bills & Expenses</Text>
                <Text style={styles.cardSubtitle}>Today's site spending, by type</Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>BILLS SPENT — NORMAL</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="currency-rupee" size={18} color={COLORS.textLight} style={styles.inputIcon} />
              <TextInput style={styles.inputField} placeholder="0.00" keyboardType="numeric" value={billsNormal} onChangeText={setBillsNormal} placeholderTextColor={COLORS.textLight} />
            </View>

            <Text style={styles.sectionLabel}>BILLS SPENT — GST</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="currency-rupee" size={18} color={COLORS.textLight} style={styles.inputIcon} />
              <TextInput style={styles.inputField} placeholder="0.00" keyboardType="numeric" value={billsGst} onChangeText={setBillsGst} placeholderTextColor={COLORS.textLight} />
            </View>

            <Text style={styles.sectionLabel}>BILLS UNDER GST / NO GST — IN CREDIT</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="currency-rupee" size={18} color={COLORS.textLight} style={styles.inputIcon} />
              <TextInput style={styles.inputField} placeholder="0.00" keyboardType="numeric" value={billsCredit} onChangeText={setBillsCredit} placeholderTextColor={COLORS.textLight} />
            </View>

            <Text style={styles.sectionLabel}>VEHICLE & RENTAL USE</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="currency-rupee" size={18} color={COLORS.textLight} style={styles.inputIcon} />
              <TextInput style={styles.inputField} placeholder="0.00" keyboardType="numeric" value={vehicleRental} onChangeText={setVehicleRental} placeholderTextColor={COLORS.textLight} />
            </View>
          </View>

          {/* LABOUR SALARY */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconWrap}>
                <MaterialIcons name="badge" size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Labour Salary</Text>
                <Text style={styles.cardSubtitle}>Wages paid to each worker today</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={[styles.inputWrap, { flex: 1.4 }]}>
                <TextInput style={styles.inputField} placeholder="Worker name" value={salaryName} onChangeText={setSalaryName} placeholderTextColor={COLORS.textLight} />
              </View>
              <View style={[styles.inputWrap, { flex: 1 }]}>
                <TextInput style={styles.inputField} placeholder="Amount" keyboardType="numeric" value={salaryAmount} onChangeText={setSalaryAmount} placeholderTextColor={COLORS.textLight} />
              </View>
            </View>
            <TouchableOpacity style={styles.secondaryButton} onPress={addSalaryRow}>
              <MaterialIcons name="add" size={18} color={COLORS.primary} />
              <Text style={styles.secondaryButtonText}>Add to Labour Salary</Text>
            </TouchableOpacity>

            {salary.length > 0 && (
              <View style={{ marginTop: SPACING.md }}>
                {salary.map((s) => (
                  <View key={s.id} style={styles.rowItem}>
                    <Text style={styles.rowItemTitle}>{s.name}</Text>
                    <Text style={[styles.rowItemMeta, { marginRight: SPACING.sm }]}>{rupees(s.amount)}</Text>
                    <TouchableOpacity onPress={() => removeSalaryRow(s.id)}>
                      <MaterialIcons name="remove-circle-outline" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* TOTAL + SUBMIT */}
          <View style={styles.card}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL AMOUNT</Text>
              <Text style={styles.totalValue}>{rupees(totalAmount)}</Text>
            </View>
            <Text style={styles.totalNote}>Bills (Normal + GST + Credit) + Vehicle/Rental + Labour Salary</Text>

            <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <MaterialIcons name="check-circle" size={19} color={COLORS.white} />
                  <Text style={styles.primaryButtonText}>Submit Daily Sheet</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
    </>
  );

  const renderSubmitted = () => (
    <>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIconWrap}>
            <MaterialIcons name="history" size={20} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Submitted Daily Sheets</Text>
            <Text style={styles.cardSubtitle}>Everything sent in for the selected site & date</Text>
          </View>
        </View>

        {sites.length > 1 && (
          <>
            <Text style={styles.sectionLabel}>SITE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }}>
              <View style={styles.chipRow}>
                {sites.map((site) => (
                  <TouchableOpacity
                    key={site.id}
                    style={[styles.chip, selectedSiteId === site.id.toString() && styles.chipActive]}
                    onPress={() => handleSiteChange(site.id.toString())}
                  >
                    <Text style={[styles.chipText, selectedSiteId === site.id.toString() && styles.chipTextActive]}>{site.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </>
        )}

        <Text style={styles.sectionLabel}>DATE</Text>
        <TouchableOpacity style={{ marginBottom: 10 }} onPress={() => setDate(todayLocal())}>
          <Text style={{ color: COLORS.primary, fontWeight: '800', fontSize: 12 }}>TODAY</Text>
        </TouchableOpacity>
        <DatePickerField value={date} onChange={setDate} placeholder="Select date" style={styles.fieldSpacing} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Submitted for {date} ({submittedList.length})</Text>
        {loadingSubmitted ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.md }} />
        ) : submittedList.length === 0 ? (
          <Text style={styles.emptyText}>No daily sheet submitted for this date yet.</Text>
        ) : (
          submittedList.map((s: any) => (
            <View key={s.id} style={styles.submittedRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowItemTitle}>{s.work_description || 'Daily Sheet'}</Text>
                <Text style={styles.rowItemMeta}>
                  {s.supervisor_name} • Received {rupees(s.amount_received)} • Total {rupees(s.total_amount)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.pdfIconButton}
                onPress={() => handleDownloadSheet(toSheetInput(s))}
                disabled={generatingPdf}
              >
                {generatingPdf ? <ActivityIndicator color={COLORS.primary} size="small" /> : <MaterialIcons name="picture-as-pdf" size={18} color={COLORS.primary} />}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pdfIconButton}
                onPress={() => handleShareSheet(toSheetInput(s))}
                disabled={generatingPdf}
              >
                <MaterialIcons name="share" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{view === 'entry' ? 'Daily Sheet' : 'Submitted Sheets'}</Text>
          <Text style={styles.headerSubtitle}>{view === 'entry' ? "Today's combined site report" : 'Review what has been sent in'}</Text>
        </View>
        {view === 'entry' ? (
          <TouchableOpacity style={styles.headerButton} onPress={() => setView('submitted')}>
            <MaterialIcons name="history" size={17} color={COLORS.white} />
            <Text style={styles.headerButtonText}>Submitted</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.headerButtonOutline} onPress={() => setView('entry')}>
            <MaterialIcons name="arrow-back" size={16} color={COLORS.primary} />
            <Text style={styles.headerButtonOutlineText}>Entry</Text>
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.body} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {view === 'entry' ? renderEntry() : renderSubmitted()}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  headerTitle: { fontSize: 19, fontWeight: '900', color: COLORS.text },
  headerSubtitle: { fontSize: 12, fontWeight: '600', color: COLORS.textLight, marginTop: 2 },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.lg,
    elevation: 3,
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  headerButtonText: { color: COLORS.white, fontWeight: '900', fontSize: 13 },
  headerButtonOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.tint,
    borderWidth: 1,
    borderColor: COLORS.tintBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.lg,
  },
  headerButtonOutlineText: { color: COLORS.primary, fontWeight: '900', fontSize: 13 },
  body: { flex: 1 },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '900', color: COLORS.text },
  cardSubtitle: { fontSize: 12, fontWeight: '600', color: COLORS.textLight, marginTop: 1 },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: COLORS.textLight,
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  fieldSpacing: { marginBottom: SPACING.md },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    backgroundColor: COLORS.steel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  chipTextActive: { color: COLORS.white },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.tint,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  warningText: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.steel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.md,
  },
  inputIcon: { marginRight: 6 },
  inputField: { flex: 1, paddingVertical: 13, fontSize: 14, color: COLORS.text, fontWeight: '600' },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.tint,
    borderWidth: 1,
    borderColor: COLORS.tintBorder,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 12,
  },
  secondaryButtonText: { color: COLORS.primary, fontWeight: '900', fontSize: 13 },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.steel,
  },
  rowItemTitle: { fontSize: 13.5, fontWeight: '800', color: COLORS.text },
  rowItemMeta: { fontSize: 12, fontWeight: '700', color: COLORS.textLight, marginTop: 2 },
  submittedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.steel,
  },
  pdfIconButton: {
    width: 34,
    height: 34,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.tint,
    borderWidth: 1,
    borderColor: COLORS.tintBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  totalLabel: { fontSize: 11, fontWeight: '800', color: COLORS.textLight, letterSpacing: 0.5 },
  totalValue: { fontSize: 22, fontWeight: '900', color: COLORS.primary },
  totalNote: { fontSize: 11, fontWeight: '600', color: COLORS.textLight, marginTop: 4, marginBottom: SPACING.md },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 15,
  },
  primaryButtonText: { color: COLORS.white, fontWeight: '900', fontSize: 15 },
  emptyText: { color: COLORS.textLight, fontSize: 12.5, fontWeight: '600', textAlign: 'center', paddingVertical: SPACING.md },
});
