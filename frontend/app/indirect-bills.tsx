import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
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

const AMBER = '#B45309';
const AMBER_BG = 'rgba(217, 119, 6, 0.12)';
const AMBER_BORDER = 'rgba(217, 119, 6, 0.3)';
const GREEN = '#15803D';
const GREEN_BG = 'rgba(21, 128, 61, 0.1)';
const GREEN_BORDER = 'rgba(21, 128, 61, 0.28)';

const rupees = (v: any) => `Rs ${Number(v || 0).toLocaleString('en-IN')}`;
const dateFmt = (v: any) => (v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

const todayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getBillImageUris = (imageUrl?: string | null) => {
  if (!imageUrl) return [];
  return imageUrl.split('||').map((uri) => uri.trim()).filter((uri) => uri.startsWith('http'));
};

const initial = (name?: string) => (name || '?').trim().charAt(0).toUpperCase();

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
  const [allBills, setAllBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [detailBill, setDetailBill] = useState<any>(null);

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

  // One fetch covers both tabs — switching Pending/Approved is then an
  // instant client-side filter instead of a round trip, and the tab chips
  // can always show accurate counts for both statuses at once.
  const loadBills = useCallback(() => {
    setLoading(true);
    fieldService
      .getIndirectBills({ siteId: selectedSiteId || undefined, userId: selectedSupervisorId || undefined })
      .then((data) => setAllBills(Array.isArray(data) ? data : []))
      .catch(() => setAllBills([]))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [selectedSiteId, selectedSupervisorId]);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  const onRefresh = () => {
    setRefreshing(true);
    loadBills();
  };

  const pendingBills = allBills.filter((b) => b.approval_status !== 'Approved');
  const approvedBills = allBills.filter((b) => b.approval_status === 'Approved');
  const bills = statusFilter === 'Pending' ? pendingBills : approvedBills;
  const totalAmount = bills.reduce((s, b) => s + Number((statusFilter === 'Approved' ? b.approved_amount : b.amount) || 0), 0);
  const hasFilters = !!selectedSiteId || !!selectedSupervisorId;

  const openApprove = (bill: any) => {
    setDetailBill(null);
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
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E23744" />}
      >
        {/* ─── Header ─── */}
        <View style={styles.headerCard}>
          <View style={styles.titleRow}>
            <View style={styles.titleIconWrap}>
              <MaterialIcons name="fact-check" size={22} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.screenTitle}>Indirect Bills</Text>
              <Text style={styles.screenHint}>Credit bills wait here until you approve the settlement</Text>
            </View>
          </View>

          {/* Segmented status control with live counts */}
          <View style={styles.segmentRow}>
            <TouchableOpacity
              style={[styles.segmentBtn, statusFilter === 'Pending' && styles.segmentBtnPendingActive]}
              onPress={() => setStatusFilter('Pending')}
              activeOpacity={0.8}
            >
              <MaterialIcons name="hourglass-empty" size={16} color={statusFilter === 'Pending' ? '#FFF' : AMBER} />
              <Text style={[styles.segmentText, { color: statusFilter === 'Pending' ? '#FFF' : AMBER }]}>Pending</Text>
              <View style={[styles.countPill, statusFilter === 'Pending' ? styles.countPillOnActive : { backgroundColor: AMBER_BG }]}>
                <Text style={[styles.countPillText, { color: statusFilter === 'Pending' ? '#FFF' : AMBER }]}>{pendingBills.length}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentBtn, statusFilter === 'Approved' && styles.segmentBtnApprovedActive]}
              onPress={() => setStatusFilter('Approved')}
              activeOpacity={0.8}
            >
              <MaterialIcons name="verified" size={16} color={statusFilter === 'Approved' ? '#FFF' : GREEN} />
              <Text style={[styles.segmentText, { color: statusFilter === 'Approved' ? '#FFF' : GREEN }]}>Approved</Text>
              <View style={[styles.countPill, statusFilter === 'Approved' ? styles.countPillOnActive : { backgroundColor: GREEN_BG }]}>
                <Text style={[styles.countPillText, { color: statusFilter === 'Approved' ? '#FFF' : GREEN }]}>{approvedBills.length}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Totals for the active tab */}
          <View
            style={[
              styles.totalsStrip,
              { backgroundColor: statusFilter === 'Pending' ? AMBER_BG : GREEN_BG, borderColor: statusFilter === 'Pending' ? AMBER_BORDER : GREEN_BORDER },
            ]}
          >
            <View>
              <Text style={[styles.totalsLabel, { color: statusFilter === 'Pending' ? AMBER : GREEN }]}>
                {statusFilter === 'Pending' ? 'AWAITING APPROVAL' : 'APPROVED TOTAL'}
              </Text>
              <Text style={[styles.totalsValue, { color: statusFilter === 'Pending' ? AMBER : GREEN }]}>{rupees(totalAmount)}</Text>
            </View>
            <Text style={[styles.totalsCount, { color: statusFilter === 'Pending' ? AMBER : GREEN }]}>{bills.length} bill{bills.length === 1 ? '' : 's'}</Text>
          </View>
        </View>

        {/* ─── Filters ─── */}
        {(sites.length > 0 || supervisors.length > 0) && (
          <View style={styles.card}>
            <View style={styles.filtersHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="filter-alt" size={15} color="#E23744" />
                <Text style={styles.filtersHeaderText}>FILTERS</Text>
              </View>
              {hasFilters && (
                <TouchableOpacity onPress={() => { setSelectedSiteId(null); setSelectedSupervisorId(null); }}>
                  <Text style={styles.clearFiltersText}>Clear</Text>
                </TouchableOpacity>
              )}
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
        )}

        {/* ─── List ─── */}
        <View style={styles.card}>
          {loading ? (
            <ActivityIndicator color="#E23744" style={{ marginVertical: 20 }} />
          ) : bills.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name={statusFilter === 'Pending' ? 'inbox' : 'verified'} size={32} color="#C4A8AE" />
              <Text style={styles.emptyText}>
                {statusFilter === 'Pending' ? 'Nothing waiting for approval.' : 'No indirect bills approved yet.'}
              </Text>
            </View>
          ) : (
            bills.map((bill: any) => {
              const isApproved = bill.approval_status === 'Approved';
              return (
                <TouchableOpacity key={bill.id} style={styles.billRow} onPress={() => setDetailBill(bill)} activeOpacity={0.7}>
                  <View style={[styles.avatar, { backgroundColor: isApproved ? GREEN_BG : AMBER_BG, borderColor: isApproved ? GREEN_BORDER : AMBER_BORDER }]}>
                    <Text style={[styles.avatarText, { color: isApproved ? GREEN : AMBER }]}>{initial(bill.supervisor_name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{bill.supervisor_name || 'Supervisor'}</Text>
                    <Text style={styles.rowSubtitle} numberOfLines={1}>{bill.category || 'Expense'} · {bill.site_name || 'Site'}</Text>
                    <Text style={styles.rowMeta}>
                      {isApproved ? `Approved ${dateFmt(bill.approved_date)}` : `Logged ${dateFmt(bill.date)}`}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={styles.rowAmount}>{rupees(isApproved ? bill.approved_amount : bill.amount)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: isApproved ? GREEN_BG : AMBER_BG }]}>
                      <Text style={[styles.statusBadgeText, { color: isApproved ? GREEN : AMBER }]}>{isApproved ? 'APPROVED' : 'PENDING'}</Text>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#C4A8AE" />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ─── Bill detail ─── */}
      <Modal visible={!!detailBill} transparent animationType="slide" onRequestClose={() => setDetailBill(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { maxHeight: '88%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHandle} />
              {detailBill && (() => {
                const isApproved = detailBill.approval_status === 'Approved';
                const imageUris = getBillImageUris(detailBill.image_url);
                return (
                  <>
                    <View style={styles.detailHeaderRow}>
                      <View style={[styles.avatar, { width: 46, height: 46, borderRadius: 23, backgroundColor: isApproved ? GREEN_BG : AMBER_BG, borderColor: isApproved ? GREEN_BORDER : AMBER_BORDER }]}>
                        <Text style={[styles.avatarText, { fontSize: 18, color: isApproved ? GREEN : AMBER }]}>{initial(detailBill.supervisor_name)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalTitle}>{detailBill.supervisor_name || 'Supervisor'}</Text>
                        <Text style={styles.modalSubtitle}>{detailBill.site_name || 'Site'}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: isApproved ? GREEN_BG : AMBER_BG }]}>
                        <Text style={[styles.statusBadgeText, { color: isApproved ? GREEN : AMBER }]}>{isApproved ? 'APPROVED' : 'PENDING'}</Text>
                      </View>
                    </View>

                    {imageUris.length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {imageUris.map((uri) => (
                            <Image key={uri} source={{ uri }} style={styles.detailImage} resizeMode="cover" />
                          ))}
                        </View>
                      </ScrollView>
                    )}

                    <View style={styles.detailsContainer}>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>CATEGORY</Text>
                        <Text style={styles.detailValue}>{detailBill.category || 'Expense'}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>DESCRIPTION</Text>
                        <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]}>{detailBill.description || '-'}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>LOGGED ON</Text>
                        <Text style={styles.detailValue}>{dateFmt(detailBill.date)}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>BILL AMOUNT</Text>
                        <Text style={[styles.detailValue, { fontSize: 17, fontWeight: '900', color: '#E23744' }]}>{rupees(detailBill.amount)}</Text>
                      </View>
                    </View>

                    {isApproved ? (
                      <View style={[styles.approvalPanel, { backgroundColor: GREEN_BG, borderColor: GREEN_BORDER }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <MaterialIcons name="verified" size={16} color={GREEN} />
                          <Text style={[styles.approvalPanelTitle, { color: GREEN }]}>Settlement Registered</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>APPROVED AMOUNT</Text>
                          <Text style={[styles.detailValue, { color: GREEN, fontWeight: '900' }]}>{rupees(detailBill.approved_amount)}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>SETTLEMENT DATE</Text>
                          <Text style={styles.detailValue}>{dateFmt(detailBill.approved_date)}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>APPROVED BY</Text>
                          <Text style={styles.detailValue}>{detailBill.approved_by_name || '-'}</Text>
                        </View>
                        {detailBill.approval_notes ? (
                          <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                            <Text style={styles.detailLabel}>NOTES</Text>
                            <Text style={[styles.detailValue, { flex: 1, textAlign: 'right', fontStyle: 'italic' }]}>{detailBill.approval_notes}</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : (
                      <View style={[styles.approvalPanel, { backgroundColor: AMBER_BG, borderColor: AMBER_BORDER }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <MaterialIcons name="info-outline" size={16} color={AMBER} />
                          <Text style={[styles.approvalPanelTitle, { color: AMBER, flex: 1 }]}>
                            Not yet counted as an output — approving registers it against {detailBill.supervisor_name || 'the supervisor'}'s account.
                          </Text>
                        </View>
                      </View>
                    )}

                    <View style={styles.modalActionsRow}>
                      <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setDetailBill(null)}>
                        <Text style={styles.modalCancelBtnText}>Close</Text>
                      </TouchableOpacity>
                      {!isApproved && (
                        <TouchableOpacity style={styles.modalSaveBtn} onPress={() => openApprove(detailBill)}>
                          <MaterialIcons name="check-circle-outline" size={16} color="#FFF" />
                          <Text style={styles.modalSaveBtnText}>Approve</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── Approve settlement ─── */}
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
  headerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 24,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    elevation: 4,
    shadowColor: '#E23744',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    marginBottom: 16,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  titleIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#E23744',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#E23744',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  screenTitle: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  screenHint: { fontSize: 11.5, color: COLORS.textLight, fontWeight: '600', marginTop: 2 },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
  },
  segmentBtnPendingActive: { backgroundColor: AMBER, elevation: 2 },
  segmentBtnApprovedActive: { backgroundColor: GREEN, elevation: 2 },
  segmentText: { fontSize: 12.5, fontWeight: '800' },
  countPill: { borderRadius: 10, minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, alignItems: 'center' },
  countPillOnActive: { backgroundColor: 'rgba(255, 255, 255, 0.3)' },
  countPillText: { fontSize: 11, fontWeight: '900' },
  totalsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  totalsLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  totalsValue: { fontSize: 20, fontWeight: '900', marginTop: 3 },
  totalsCount: { fontSize: 12, fontWeight: '700' },
  filtersHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  filtersHeaderText: { fontSize: 11, fontWeight: '800', color: '#E23744', letterSpacing: 0.6 },
  clearFiltersText: { fontSize: 11.5, fontWeight: '800', color: COLORS.textLight, textDecorationLine: 'underline' },
  filterLabel: { fontSize: 10.5, fontWeight: '800', color: COLORS.textLight, marginBottom: 8, marginTop: 8, letterSpacing: 0.5 },
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
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  avatarText: { fontSize: 15, fontWeight: '900' },
  rowTitle: { fontSize: 13.5, fontWeight: '800', color: COLORS.text },
  rowSubtitle: { fontSize: 11.5, color: COLORS.textLight, fontWeight: '600', marginTop: 1 },
  rowMeta: { fontSize: 10, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  rowAmount: { fontSize: 14, fontWeight: '900', color: COLORS.text },
  statusBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  statusBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.3 },
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
  detailHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  detailImage: { width: 90, height: 90, borderRadius: 12, backgroundColor: '#F1F5F9' },
  detailsContainer: { gap: 2, marginBottom: 14 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.steel,
  },
  detailLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 0.4 },
  detailValue: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  approvalPanel: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 6 },
  approvalPanelTitle: { fontSize: 12.5, fontWeight: '800' },
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
  modalSaveBtn: {
    flex: 2,
    flexDirection: 'row',
    gap: 6,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E23744',
  },
  modalSaveBtnText: { color: '#FFF', fontWeight: '900', fontSize: 13 },
});
