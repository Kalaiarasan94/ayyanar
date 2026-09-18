import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { adminService, fieldService } from '../services/api';
import { COLORS, BORDER_RADIUS, SPACING } from '../constants/Theme';
import AppBackground from './components/AppBackground';
import DatePickerField from '../components/DatePickerField';

const rupees = (v: any) => `Rs ${Number(v || 0).toLocaleString('en-IN')}`;

const todayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getBillImageUris = (imageUrl?: string | null) => {
  if (!imageUrl) return [];
  return imageUrl.split('||').map((uri) => uri.trim()).filter((uri) => uri.startsWith('http'));
};

// Shared by both Admin (from Admin Panel) and Owner (from Owner Accounts) —
// lists Indirect (credit) bills and lets either role approve a settlement.
// A Pending bill has no effect on the supervisor's cash balance yet; approving
// it registers the actual output (see backend fieldController.approveIndirectBill).
export default function IndirectBillsScreen() {
  const [statusFilter, setStatusFilter] = useState<'Pending' | 'Approved'>('Pending');
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [supervisors, setSupervisors] = useState<{ id: any; name: string }[]>([]);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string | null>(null);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [approveVisible, setApproveVisible] = useState(false);
  const [approvingBill, setApprovingBill] = useState<any>(null);
  const [approveAmount, setApproveAmount] = useState('');
  const [approveDate, setApproveDate] = useState(todayYMD());
  const [approveNotes, setApproveNotes] = useState('');
  const [submittingApproval, setSubmittingApproval] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('userId').then(setCurrentUserId);
    adminService.getSites().then((data) => setSites(data || [])).catch(() => setSites([]));
    adminService
      .getStaff()
      .then((staff) => setSupervisors((staff || []).filter((s: any) => s.role === 'Supervisor').map((s: any) => ({ id: s.id, name: s.name }))))
      .catch(() => setSupervisors([]));
  }, []);

  const loadBills = useCallback(() => {
    setLoading(true);
    fieldService
      .getIndirectBills({
        status: statusFilter,
        siteId: selectedSiteId || undefined,
        userId: selectedSupervisorId || undefined,
      })
      .then((data) => setBills(Array.isArray(data) ? data : []))
      .catch(() => setBills([]))
      .finally(() => setLoading(false));
  }, [statusFilter, selectedSiteId, selectedSupervisorId]);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  const totalAmount = bills.reduce((s, b) => s + Number((statusFilter === 'Approved' ? b.approved_amount : b.amount) || 0), 0);

  const openApprove = (bill: any) => {
    setApprovingBill(bill);
    setApproveAmount(bill.amount?.toString() || '');
    setApproveDate(todayYMD());
    setApproveNotes('');
    setApproveVisible(true);
  };

  const handleSubmitApproval = async () => {
    if (!approvingBill) return;
    const cleanAmount = parseFloat(approveAmount);
    if (!approveAmount || isNaN(cleanAmount) || cleanAmount <= 0) {
      Alert.alert('Invalid Amount', 'Enter an amount greater than zero.');
      return;
    }
    setSubmittingApproval(true);
    try {
      await fieldService.approveIndirectBill(approvingBill.id, {
        amount: cleanAmount,
        date: approveDate,
        notes: approveNotes,
        approvedBy: currentUserId,
      });
      setApproveVisible(false);
      setApprovingBill(null);
      Alert.alert('Approved', 'The indirect bill is approved and registered as an output.');
      loadBills();
    } catch (error: any) {
      Alert.alert('Approval Error', error?.message || 'Unable to approve this bill.');
    } finally {
      setSubmittingApproval(false);
    }
  };

  return (
    <View style={styles.outerContainer}>
      <AppBackground />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <MaterialIcons name="receipt-long" size={20} color="#E23744" />
            <Text style={styles.sectionTitle}>INDIRECT BILLS</Text>
          </View>
          <Text style={styles.hint}>
            Credit bills stay Pending — with no effect on the supervisor's cash balance — until approved here.
          </Text>

          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, statusFilter === 'Pending' && styles.toggleBtnActivePending]}
              onPress={() => setStatusFilter('Pending')}
            >
              <Text style={[styles.toggleText, statusFilter === 'Pending' && styles.toggleTextActive]}>Pending</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, statusFilter === 'Approved' && styles.toggleBtnActiveApproved]}
              onPress={() => setStatusFilter('Approved')}
            >
              <Text style={[styles.toggleText, statusFilter === 'Approved' && styles.toggleTextActive]}>Approved</Text>
            </TouchableOpacity>
          </View>

          {sites.length > 0 && (
            <>
              <Text style={styles.filterLabel}>SITE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  <TouchableOpacity style={[styles.chip, !selectedSiteId && styles.chipActive]} onPress={() => setSelectedSiteId(null)}>
                    <Text style={[styles.chipText, !selectedSiteId && styles.chipTextActive]}>All Sites</Text>
                  </TouchableOpacity>
                  {sites.map((s) => (
                    <TouchableOpacity key={s.id} style={[styles.chip, selectedSiteId === s.id.toString() && styles.chipActive]} onPress={() => setSelectedSiteId(s.id.toString())}>
                      <Text style={[styles.chipText, selectedSiteId === s.id.toString() && styles.chipTextActive]}>{s.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </>
          )}

          {supervisors.length > 0 && (
            <>
              <Text style={styles.filterLabel}>SUPERVISOR</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  <TouchableOpacity style={[styles.chip, !selectedSupervisorId && styles.chipActive]} onPress={() => setSelectedSupervisorId(null)}>
                    <Text style={[styles.chipText, !selectedSupervisorId && styles.chipTextActive]}>All Supervisors</Text>
                  </TouchableOpacity>
                  {supervisors.map((s) => (
                    <TouchableOpacity key={s.id} style={[styles.chip, selectedSupervisorId === s.id.toString() && styles.chipActive]} onPress={() => setSelectedSupervisorId(s.id.toString())}>
                      <Text style={[styles.chipText, selectedSupervisorId === s.id.toString() && styles.chipTextActive]}>{s.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </>
          )}
        </View>

        <View style={styles.card}>
          {loading ? (
            <ActivityIndicator color="#E23744" style={{ marginVertical: 20 }} />
          ) : bills.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="inbox" size={32} color="#C4A8AE" />
              <Text style={styles.emptyText}>No {statusFilter.toLowerCase()} indirect bills.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.countText}>
                {bills.length} bill(s) · {rupees(totalAmount)}
              </Text>
              {bills.map((bill: any) => {
                const imageUris = getBillImageUris(bill.image_url);
                return (
                  <View key={bill.id} style={styles.billCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                      {imageUris.length > 0 && <Image source={{ uri: imageUris[0] }} style={styles.thumb} />}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.billSupervisor}>{bill.supervisor_name || 'Supervisor'} · {bill.site_name || 'Site'}</Text>
                        <Text style={styles.billCategory}>{bill.category || 'Expense'}</Text>
                        <Text style={styles.billDesc} numberOfLines={2}>{bill.description || '-'}</Text>
                        <Text style={styles.billDate}>Logged {new Date(bill.date).toLocaleDateString('en-IN')}</Text>
                        {statusFilter === 'Approved' && (
                          <>
                            <Text style={styles.approvedText}>
                              Approved {rupees(bill.approved_amount)} on {bill.approved_date ? new Date(bill.approved_date).toLocaleDateString('en-IN') : '-'}
                            </Text>
                            {bill.approval_notes ? <Text style={styles.approvedNotes}>{bill.approval_notes}</Text> : null}
                          </>
                        )}
                      </View>
                      <Text style={styles.billAmount}>{rupees(bill.amount)}</Text>
                    </View>
                    {statusFilter === 'Pending' && (
                      <TouchableOpacity style={styles.approveBtn} onPress={() => openApprove(bill)}>
                        <MaterialIcons name="check-circle-outline" size={16} color="#FFF" />
                        <Text style={styles.approveBtnText}>Approve</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>

      {/* Approve settlement modal */}
      <Modal visible={approveVisible} transparent animationType="slide" onRequestClose={() => setApproveVisible(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Approve Indirect Bill</Text>
            {approvingBill && (
              <Text style={styles.modalSubtitle}>
                {approvingBill.supervisor_name} · {approvingBill.site_name} · Logged {rupees(approvingBill.amount)}
              </Text>
            )}

            <Text style={styles.modalFieldLabel}>Amount (₹)</Text>
            <TextInput style={styles.modalInput} keyboardType="numeric" value={approveAmount} onChangeText={setApproveAmount} placeholder="Amount" placeholderTextColor={COLORS.textLight} />

            <Text style={styles.modalFieldLabel}>Settlement Date</Text>
            <DatePickerField value={approveDate} onChange={setApproveDate} placeholder="Settlement date" style={{ marginBottom: 14 }} />

            <Text style={styles.modalFieldLabel}>Notes (optional)</Text>
            <TextInput style={styles.modalInput} value={approveNotes} onChangeText={setApproveNotes} placeholder="e.g. Paid by bank transfer" placeholderTextColor={COLORS.textLight} />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setApproveVisible(false)} disabled={submittingApproval}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSaveBtn, submittingApproval && { opacity: 0.6 }]} onPress={handleSubmitApproval} disabled={submittingApproval}>
                {submittingApproval ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalSaveBtnText}>Approve & Register Output</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: 'transparent' },
  container: { flex: 1 },
  scrollContent: { padding: SPACING.md, paddingBottom: 40 },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 24,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    elevation: 4,
    shadowColor: '#E23744',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    marginBottom: 16,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#E23744', letterSpacing: 0.5 },
  hint: { fontSize: 12, color: COLORS.textLight, fontWeight: '600', marginBottom: 14, lineHeight: 17 },
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  toggleBtn: {
    flex: 1,
    padding: 12,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(226, 26, 18, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    alignItems: 'center',
  },
  toggleBtnActivePending: { borderColor: '#F2545B', backgroundColor: 'rgba(242, 84, 91, 0.15)' },
  toggleBtnActiveApproved: { borderColor: '#8C0F16', backgroundColor: 'rgba(16, 185, 129, 0.12)' },
  toggleText: { fontSize: 12, fontWeight: '700', color: COLORS.textLight },
  toggleTextActive: { color: COLORS.text },
  filterLabel: { fontSize: 11, fontWeight: '800', color: '#E23744', marginBottom: 8, marginTop: 6, letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(226, 26, 18, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  chipActive: { borderColor: '#E23744', backgroundColor: '#E23744' },
  chipText: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: '#FFF' },
  countText: { fontSize: 11, fontWeight: '700', color: COLORS.textLight, marginBottom: 10 },
  billCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  thumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: '#F1F5F9' },
  billSupervisor: { fontSize: 12, fontWeight: '800', color: '#8C0F16' },
  billCategory: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginTop: 2 },
  billDesc: { fontSize: 11, color: '#64748B', marginTop: 2 },
  billDate: { fontSize: 10, color: '#94A3B8', marginTop: 4, fontWeight: '600' },
  approvedText: { fontSize: 11, color: '#15803D', marginTop: 4, fontWeight: '700' },
  approvedNotes: { fontSize: 11, color: '#64748B', marginTop: 2, fontStyle: 'italic' },
  billAmount: { fontSize: 15, fontWeight: '800', color: '#E23744' },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: '#8C0F16',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 10,
  },
  approveBtnText: { color: '#FFF', fontWeight: '800', fontSize: 12.5 },
  empty: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 12, color: '#94A3B8', fontWeight: '600', textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(11, 13, 16, 0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    maxHeight: '92%',
  },
  modalHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: SPACING.md },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: '900' },
  modalSubtitle: { color: COLORS.textLight, fontSize: 12, fontWeight: '600', marginTop: 4, marginBottom: SPACING.md },
  modalFieldLabel: { fontSize: 11, fontWeight: '800', color: '#E23744', marginBottom: 6, marginTop: 8, letterSpacing: 0.5 },
  modalInput: {
    backgroundColor: COLORS.steel,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    padding: 12,
  },
  modalActionsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  modalCancelBtn: { flex: 1, borderRadius: BORDER_RADIUS.md, paddingVertical: 14, alignItems: 'center', backgroundColor: COLORS.steel, borderWidth: 1, borderColor: COLORS.border },
  modalCancelBtnText: { color: COLORS.text, fontWeight: '900', fontSize: 14 },
  modalSaveBtn: { flex: 2, borderRadius: BORDER_RADIUS.md, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E23744' },
  modalSaveBtnText: { color: '#FFF', fontWeight: '900', fontSize: 13 },
});
