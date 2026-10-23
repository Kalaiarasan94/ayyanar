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
  Image,
  Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { fieldService, adminService, uploadPhoto } from '../services/api';
import DatePickerField from '../components/DatePickerField';
import { buildDailySheetPdfDoc, downloadPdfReport, sharePdfReportOnWhatsApp, DailySheetInput } from '../services/pdfReport';
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

type DailyBillRow = {
  id: string;
  amount: string;
  reason: string;
  imageUri?: string | null;
  imageUrl?: string | null;
};

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

  // Normal Bills (Multiple support with reason & optional image)
  const [normalBills, setNormalBills] = useState<DailyBillRow[]>([]);
  const [normalAmount, setNormalAmount] = useState('');
  const [normalReason, setNormalReason] = useState('');
  const [normalImageUri, setNormalImageUri] = useState<string | null>(null);

  // GST Bills (Multiple support with reason & optional image)
  const [gstBills, setGstBills] = useState<DailyBillRow[]>([]);
  const [gstAmount, setGstAmount] = useState('');
  const [gstReason, setGstReason] = useState('');
  const [gstImageUri, setGstImageUri] = useState<string | null>(null);

  // Credit bills & Vehicle rental
  const [billsCredit, setBillsCredit] = useState('');
  const [vehicleRental, setVehicleRental] = useState('');

  // Labour salary line items
  const [salary, setSalary] = useState<SalaryRow[]>([]);
  const [salaryName, setSalaryName] = useState('');
  const [salaryAmount, setSalaryAmount] = useState('');

  // Full-size image preview modal
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);

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

  // Image picker for bill photo (Camera or Device Gallery)
  const pickBillImage = async (target: 'normal' | 'gst', useCamera: boolean) => {
    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera permission is required to take a bill photo.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 0.7,
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
          if (target === 'normal') setNormalImageUri(result.assets[0].uri);
          else setGstImageUri(result.assets[0].uri);
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Gallery permission is required to choose a bill photo.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          allowsEditing: false,
          quality: 0.7,
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
          if (target === 'normal') setNormalImageUri(result.assets[0].uri);
          else setGstImageUri(result.assets[0].uri);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not select photo.');
    }
  };

  // Add Normal Bill to list
  const addNormalBill = () => {
    const amt = parseFloat(normalAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Missing Info', 'Please enter a valid bill amount.');
      return;
    }
    setNormalBills([
      ...normalBills,
      {
        id: Date.now().toString(),
        amount: String(amt),
        reason: normalReason.trim(),
        imageUri: normalImageUri,
      },
    ]);
    setNormalAmount('');
    setNormalReason('');
    setNormalImageUri(null);
  };

  const removeNormalBill = (id: string) => {
    setNormalBills(normalBills.filter((b) => b.id !== id));
  };

  // Add GST Bill to list
  const addGstBill = () => {
    const amt = parseFloat(gstAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Missing Info', 'Please enter a valid bill amount.');
      return;
    }
    setGstBills([
      ...gstBills,
      {
        id: Date.now().toString(),
        amount: String(amt),
        reason: gstReason.trim(),
        imageUri: gstImageUri,
      },
    ]);
    setGstAmount('');
    setGstReason('');
    setGstImageUri(null);
  };

  const removeGstBill = (id: string) => {
    setGstBills(gstBills.filter((b) => b.id !== id));
  };

  // Dynamically compute totals including typed amount in the input
  const normalBillsTotal = normalBills.reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);
  const gstBillsTotal = gstBills.reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);

  const effectiveNormalTotal = normalBillsTotal + (parseFloat(normalAmount) || 0);
  const effectiveGstTotal = gstBillsTotal + (parseFloat(gstAmount) || 0);

  const salaryTotal = salary.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  const totalAmount =
    effectiveNormalTotal +
    effectiveGstTotal +
    (parseFloat(billsCredit) || 0) +
    (parseFloat(vehicleRental) || 0) +
    salaryTotal;

  const resetForm = () => {
    setWorkDescription('');
    setAttendance([]);
    setAmountReceived('');
    setNormalBills([]);
    setNormalAmount('');
    setNormalReason('');
    setNormalImageUri(null);
    setGstBills([]);
    setGstAmount('');
    setGstReason('');
    setGstImageUri(null);
    setBillsCredit('');
    setVehicleRental('');
    setSalary([]);
  };

  // Normalizes a backend daily_sheets row into buildDailySheetPdfDoc's input shape
  const toSheetInput = (row: any): DailySheetInput => ({
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
    billsNormalList: row.billsNormalList || [],
    billsGstList: row.billsGstList || [],
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
      const username = (await AsyncStorage.getItem('userUsername')) || userName || 'supervisor';

      // Auto-include pending bill if typed into input but not clicked Add Bill
      const pendingNormal = parseFloat(normalAmount);
      const allNormalBills = [...normalBills];
      if (!isNaN(pendingNormal) && pendingNormal > 0) {
        allNormalBills.push({
          id: Date.now().toString(),
          amount: String(pendingNormal),
          reason: normalReason.trim(),
          imageUri: normalImageUri,
        });
      }

      const pendingGst = parseFloat(gstAmount);
      const allGstBills = [...gstBills];
      if (!isNaN(pendingGst) && pendingGst > 0) {
        allGstBills.push({
          id: (Date.now() + 1).toString(),
          amount: String(pendingGst),
          reason: gstReason.trim(),
          imageUri: gstImageUri,
        });
      }

      // Upload photos for normal bills (optional)
      const uploadedNormalBills: { amount: number; reason: string; imageUrl?: string | null }[] = [];
      for (const b of allNormalBills) {
        let hostedUrl = b.imageUrl || null;
        if (b.imageUri && !hostedUrl) {
          try {
            hostedUrl = await uploadPhoto(b.imageUri, { role: 'supervisor', username, type: 'daily-sheet-normal-bill' });
          } catch (e) {
            console.warn('Photo upload skipped/failed for normal bill:', e);
          }
        }
        uploadedNormalBills.push({
          amount: parseFloat(b.amount) || 0,
          reason: b.reason || '',
          imageUrl: hostedUrl,
        });
      }

      // Upload photos for GST bills (optional)
      const uploadedGstBills: { amount: number; reason: string; imageUrl?: string | null }[] = [];
      for (const b of allGstBills) {
        let hostedUrl = b.imageUrl || null;
        if (b.imageUri && !hostedUrl) {
          try {
            hostedUrl = await uploadPhoto(b.imageUri, { role: 'supervisor', username, type: 'daily-sheet-gst-bill' });
          } catch (e) {
            console.warn('Photo upload skipped/failed for GST bill:', e);
          }
        }
        uploadedGstBills.push({
          amount: parseFloat(b.amount) || 0,
          reason: b.reason || '',
          imageUrl: hostedUrl,
        });
      }

      const finalNormalTotal = uploadedNormalBills.reduce((s, b) => s + b.amount, 0);
      const finalGstTotal = uploadedGstBills.reduce((s, b) => s + b.amount, 0);

      await fieldService.submitDailySheet({
        siteId: selectedSiteId,
        userId,
        date,
        workDescription: workDescription.trim(),
        attendance: attendance.map((a) => ({ name: a.name, category: a.category, count: parseInt(a.count) || 0 })),
        amountReceived: parseFloat(amountReceived) || 0,
        billsNormal: finalNormalTotal,
        billsGst: finalGstTotal,
        billsCredit: parseFloat(billsCredit) || 0,
        vehicleRental: parseFloat(vehicleRental) || 0,
        labourSalary: salary.map((s) => ({ name: s.name, amount: parseFloat(s.amount) || 0 })),
        billsNormalList: uploadedNormalBills,
        billsGstList: uploadedGstBills,
      });

      const savedSnapshot = {
        siteName: selectedSiteName || 'Site',
        supervisorName: userName,
        date,
        workDescription: workDescription.trim(),
        attendance: attendance.map((a) => ({ name: a.name, category: a.category, count: parseInt(a.count) || 0 })),
        amountReceived: parseFloat(amountReceived) || 0,
        billsNormal: finalNormalTotal,
        billsGst: finalGstTotal,
        billsCredit: parseFloat(billsCredit) || 0,
        vehicleRental: parseFloat(vehicleRental) || 0,
        labourSalary: salary.map((s) => ({ name: s.name, amount: parseFloat(s.amount) || 0 })),
        totalAmount,
        billsNormalList: uploadedNormalBills,
        billsGstList: uploadedGstBills,
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

            {/* BILLS SPENT — NORMAL */}
            <View style={styles.billCategoryBlock}>
              <View style={styles.billCategoryHeader}>
                <Text style={styles.billCategoryTitle}>BILLS SPENT — NORMAL</Text>
                {effectiveNormalTotal > 0 && (
                  <Text style={styles.billCategoryTotalText}>Total: {rupees(effectiveNormalTotal)}</Text>
                )}
              </View>

              {normalBills.length > 0 && (
                <View style={styles.billItemsList}>
                  {normalBills.map((b, idx) => (
                    <View key={b.id} style={styles.billItemCard}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.billItemNumber}>Bill #{idx + 1}</Text>
                          <Text style={styles.billItemAmount}>{rupees(b.amount)}</Text>
                        </View>
                        {b.reason ? <Text style={styles.billItemReason}>{b.reason}</Text> : null}
                      </View>
                      {b.imageUri ? (
                        <TouchableOpacity onPress={() => setPreviewImageUri(b.imageUri || null)}>
                          <Image source={{ uri: b.imageUri }} style={styles.billThumb} />
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity onPress={() => removeNormalBill(b.id)} style={{ padding: 4 }}>
                        <MaterialIcons name="remove-circle-outline" size={20} color={COLORS.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <Text style={styles.subSectionLabel}>
                {normalBills.length > 0 ? `Bill #${normalBills.length + 1} Details` : 'Bill Amount & Reason'}
              </Text>

              <View style={styles.inputWrap}>
                <MaterialIcons name="currency-rupee" size={18} color={COLORS.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.inputField}
                  placeholder="Bill Amount (e.g., 500)"
                  keyboardType="numeric"
                  value={normalAmount}
                  onChangeText={setNormalAmount}
                  placeholderTextColor={COLORS.textLight}
                />
              </View>

              <View style={styles.inputWrap}>
                <MaterialIcons name="description" size={18} color={COLORS.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.inputField}
                  placeholder="Reason / Notes (e.g., PVC pipes & elbow)"
                  value={normalReason}
                  onChangeText={setNormalReason}
                  placeholderTextColor={COLORS.textLight}
                />
              </View>

              <View style={styles.imageActionRow}>
                <TouchableOpacity
                  style={styles.imagePickerBtn}
                  onPress={() => pickBillImage('normal', true)}
                >
                  <MaterialIcons name="photo-camera" size={18} color={COLORS.primary} />
                  <Text style={styles.imagePickerBtnText}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.imagePickerBtn}
                  onPress={() => pickBillImage('normal', false)}
                >
                  <MaterialIcons name="photo-library" size={18} color={COLORS.primary} />
                  <Text style={styles.imagePickerBtnText}>Upload from Device</Text>
                </TouchableOpacity>
              </View>

              {normalImageUri ? (
                <View style={styles.selectedImageBadge}>
                  <TouchableOpacity onPress={() => setPreviewImageUri(normalImageUri)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Image source={{ uri: normalImageUri }} style={styles.previewThumbMini} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.imageAttachedText}>Photo attached</Text>
                      <Text style={styles.imageTapViewText}>Tap to preview</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setNormalImageUri(null)} style={styles.removeThumbBtn}>
                    <MaterialIcons name="close" size={15} color={COLORS.white} />
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.imageOptionalHint}>* Photo is optional (camera or device)</Text>
              )}

              <TouchableOpacity style={styles.secondaryButton} onPress={addNormalBill}>
                <MaterialIcons name="add" size={18} color={COLORS.primary} />
                <Text style={styles.secondaryButtonText}>
                  {normalBills.length > 0 ? 'Add Another Normal Bill' : 'Add Bill'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* BILLS SPENT — GST */}
            <View style={styles.billCategoryBlock}>
              <View style={styles.billCategoryHeader}>
                <Text style={styles.billCategoryTitle}>BILLS SPENT — GST</Text>
                {effectiveGstTotal > 0 && (
                  <Text style={styles.billCategoryTotalText}>Total: {rupees(effectiveGstTotal)}</Text>
                )}
              </View>

              {gstBills.length > 0 && (
                <View style={styles.billItemsList}>
                  {gstBills.map((b, idx) => (
                    <View key={b.id} style={styles.billItemCard}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.billItemNumber}>GST Bill #{idx + 1}</Text>
                          <Text style={styles.billItemAmount}>{rupees(b.amount)}</Text>
                        </View>
                        {b.reason ? <Text style={styles.billItemReason}>{b.reason}</Text> : null}
                      </View>
                      {b.imageUri ? (
                        <TouchableOpacity onPress={() => setPreviewImageUri(b.imageUri || null)}>
                          <Image source={{ uri: b.imageUri }} style={styles.billThumb} />
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity onPress={() => removeGstBill(b.id)} style={{ padding: 4 }}>
                        <MaterialIcons name="remove-circle-outline" size={20} color={COLORS.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <Text style={styles.subSectionLabel}>
                {gstBills.length > 0 ? `GST Bill #${gstBills.length + 1} Details` : 'GST Bill Amount & Reason'}
              </Text>

              <View style={styles.inputWrap}>
                <MaterialIcons name="currency-rupee" size={18} color={COLORS.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.inputField}
                  placeholder="GST Bill Amount (e.g., 1200)"
                  keyboardType="numeric"
                  value={gstAmount}
                  onChangeText={setGstAmount}
                  placeholderTextColor={COLORS.textLight}
                />
              </View>

              <View style={styles.inputWrap}>
                <MaterialIcons name="description" size={18} color={COLORS.textLight} style={styles.inputIcon} />
                <TextInput
                  style={styles.inputField}
                  placeholder="Reason / Invoice Details"
                  value={gstReason}
                  onChangeText={setGstReason}
                  placeholderTextColor={COLORS.textLight}
                />
              </View>

              <View style={styles.imageActionRow}>
                <TouchableOpacity
                  style={styles.imagePickerBtn}
                  onPress={() => pickBillImage('gst', true)}
                >
                  <MaterialIcons name="photo-camera" size={18} color={COLORS.primary} />
                  <Text style={styles.imagePickerBtnText}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.imagePickerBtn}
                  onPress={() => pickBillImage('gst', false)}
                >
                  <MaterialIcons name="photo-library" size={18} color={COLORS.primary} />
                  <Text style={styles.imagePickerBtnText}>Upload from Device</Text>
                </TouchableOpacity>
              </View>

              {gstImageUri ? (
                <View style={styles.selectedImageBadge}>
                  <TouchableOpacity onPress={() => setPreviewImageUri(gstImageUri)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Image source={{ uri: gstImageUri }} style={styles.previewThumbMini} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.imageAttachedText}>GST Bill Photo attached</Text>
                      <Text style={styles.imageTapViewText}>Tap to preview</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setGstImageUri(null)} style={styles.removeThumbBtn}>
                    <MaterialIcons name="close" size={15} color={COLORS.white} />
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.imageOptionalHint}>* Photo is optional (camera or device)</Text>
              )}

              <TouchableOpacity style={styles.secondaryButton} onPress={addGstBill}>
                <MaterialIcons name="add" size={18} color={COLORS.primary} />
                <Text style={styles.secondaryButtonText}>
                  {gstBills.length > 0 ? 'Add Another GST Bill' : 'Add GST Bill'}
                </Text>
              </TouchableOpacity>
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
          submittedList.map((s: any) => {
            const nList: any[] = s.billsNormalList || [];
            const gList: any[] = s.billsGstList || [];
            return (
              <View key={s.id} style={styles.submittedCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowItemTitle}>{s.work_description || 'Daily Sheet'}</Text>
                  <Text style={styles.rowItemMeta}>
                    {s.supervisor_name} • Received {rupees(s.amount_received)} • Total {rupees(s.total_amount)}
                  </Text>

                  {/* Summary of Normal & GST Bills if recorded */}
                  {(Number(s.bills_normal) > 0 || Number(s.bills_gst) > 0) && (
                    <View style={styles.submittedBillsMetaRow}>
                      {Number(s.bills_normal) > 0 && (
                        <Text style={styles.submittedBillBadge}>
                          Normal: {rupees(s.bills_normal)} ({nList.length || 1} bill{nList.length === 1 ? '' : 's'})
                        </Text>
                      )}
                      {Number(s.bills_gst) > 0 && (
                        <Text style={styles.submittedBillBadge}>
                          GST: {rupees(s.bills_gst)} ({gList.length || 1} bill{gList.length === 1 ? '' : 's'})
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Bill Photo thumbnails if present */}
                  {([...nList, ...gList].some((b: any) => b.imageUrl)) && (
                    <View style={styles.submittedPhotosRow}>
                      {[...nList, ...gList].filter((b: any) => b.imageUrl).map((b: any, bIdx: number) => (
                        <TouchableOpacity key={bIdx} onPress={() => setPreviewImageUri(b.imageUrl)}>
                          <Image source={{ uri: b.imageUrl }} style={styles.submittedThumbMini} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
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
              </View>
            );
          })
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

      {/* Full-size Photo Preview Modal */}
      <Modal visible={!!previewImageUri} transparent animationType="fade" onRequestClose={() => setPreviewImageUri(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setPreviewImageUri(null)}>
            <MaterialIcons name="close" size={24} color={COLORS.white} />
          </TouchableOpacity>
          {previewImageUri && (
            <Image source={{ uri: previewImageUri }} style={styles.fullModalImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
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
  subSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 6,
  },
  billCategoryBlock: {
    backgroundColor: COLORS.steel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  billCategoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  billCategoryTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  billCategoryTotalText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.success,
  },
  billItemsList: {
    marginBottom: SPACING.sm,
  },
  billItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  billItemNumber: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textLight,
  },
  billItemAmount: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.text,
  },
  billItemReason: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight,
    marginTop: 2,
  },
  billThumb: {
    width: 38,
    height: 38,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.border,
  },
  imageActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  imagePickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 9,
  },
  imagePickerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  selectedImageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.tint,
    borderWidth: 1,
    borderColor: COLORS.tintBorder,
    borderRadius: BORDER_RADIUS.md,
    padding: 6,
    paddingHorizontal: 8,
    marginBottom: SPACING.sm,
  },
  previewThumbMini: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  imageAttachedText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  imageTapViewText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  removeThumbBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageOptionalHint: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textLight,
    fontStyle: 'italic',
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
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  inputIcon: { marginRight: 6 },
  inputField: { flex: 1, paddingVertical: 12, fontSize: 13.5, color: COLORS.text, fontWeight: '600' },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.tintBorder,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 10,
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
  submittedCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.steel,
  },
  submittedBillsMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  submittedBillBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    backgroundColor: COLORS.tint,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  submittedPhotosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  submittedThumbMini: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: COLORS.border,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  fullModalImage: {
    width: '100%',
    height: '80%',
  },
});
