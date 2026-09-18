import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Alert,
  Modal,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fieldService } from '../services/api';
import { COLORS, BORDER_RADIUS, SPACING } from '../constants/Theme';
import AppBackground from './components/AppBackground';
import DatePickerField from '../components/DatePickerField';

// Local calendar date (not UTC) so a late-night open still lands on today
const todayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const prettyDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function SubmittedBills() {
  const { siteId, siteName, userId } = useLocalSearchParams();
  const paramSiteId = Array.isArray(siteId) ? siteId[0] : siteId;
  const paramSiteName = Array.isArray(siteName) ? siteName[0] : siteName;

  const TODAY = todayYMD();

  const [assignedSites, setAssignedSites] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(paramSiteId ? paramSiteId.toString() : null);
  const [selectedSiteName, setSelectedSiteName] = useState<string | null>(paramSiteName ? paramSiteName.toString() : null);
  // Page opens on today's date; the supervisor can change it with the filter
  const [filterDate, setFilterDate] = useState(TODAY);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Edit / delete a submitted bill
  const [editVisible, setEditVisible] = useState(false);
  const [editingBillId, setEditingBillId] = useState<string | number | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editPaymentMode, setEditPaymentMode] = useState<'Direct' | 'Indirect'>('Direct');
  const [editDate, setEditDate] = useState(TODAY);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  const isToday = filterDate === TODAY;

  useEffect(() => {
    const loadSites = async () => {
      try {
        const rawUserId = userId || (await AsyncStorage.getItem('userId'));
        const storedUserId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
        if (!storedUserId) return;
        const sitesData = await fieldService.getSupervisorSites(storedUserId);
        setAssignedSites(sitesData || []);
        if ((sitesData || []).length > 0 && !selectedSiteId) {
          setSelectedSiteId(sitesData[0].id.toString());
          setSelectedSiteName(sitesData[0].name);
        }
      } catch (err) {
        console.error('Error loading supervisor sites for submitted bills:', err);
      }
    };
    loadSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadBills = useCallback(async (site: string | null, date: string) => {
    if (!site) {
      setBills([]);
      return;
    }
    setLoading(true);
    try {
      const data = await fieldService.getLedgerBySite(site, date);
      setBills(Array.isArray(data) ? data : []);
    } catch {
      setBills([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBills(selectedSiteId, filterDate);
  }, [selectedSiteId, filterDate, loadBills]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBills(selectedSiteId, filterDate);
    setRefreshing(false);
  };

  const handleSiteChange = (val: string) => {
    setSelectedSiteId(val);
    const siteObj = assignedSites.find((s) => s.id.toString() === val);
    if (siteObj) setSelectedSiteName(siteObj.name);
  };

  const handleStartEdit = (bill: any) => {
    setEditingBillId(bill.id);
    setEditCategory(bill.category || '');
    setEditDescription(bill.description || '');
    setEditAmount(bill.amount?.toString() || '');
    setEditPaymentMode(bill.payment_mode === 'Indirect' ? 'Indirect' : 'Direct');
    setEditDate((bill.date || TODAY).toString().split('T')[0]);
    setEditVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingBillId || !editCategory || !editAmount) {
      Alert.alert('Missing Details', 'Category and amount are required.');
      return;
    }
    setSavingEdit(true);
    try {
      await fieldService.updateExpense(editingBillId, {
        category: editCategory,
        description: editDescription,
        amount: parseFloat(editAmount),
        paymentMode: editPaymentMode,
        date: editDate,
      });
      setEditVisible(false);
      setEditingBillId(null);
      await loadBills(selectedSiteId, filterDate);
      Alert.alert('Success', 'Bill updated.');
    } catch {
      Alert.alert('Update Error', 'Unable to update this bill.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteBill = (id: string | number) => {
    const confirmDelete = async () => {
      setDeletingId(id);
      try {
        await fieldService.deleteExpense(id);
        await loadBills(selectedSiteId, filterDate);
      } catch {
        Alert.alert('Delete Error', 'Unable to delete this bill.');
      } finally {
        setDeletingId(null);
      }
    };
    const message = 'Delete this bill? This cannot be undone.';
    if (Platform.OS === 'web') {
      if (window.confirm(message)) confirmDelete();
    } else {
      Alert.alert('Delete Bill', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirmDelete },
      ]);
    }
  };

  const directTotal = bills
    .filter((b) => b.payment_mode === 'Direct')
    .reduce((s: number, b: any) => s + Number(b.amount || 0), 0);
  const indirectTotal = bills
    .filter((b) => b.payment_mode !== 'Direct')
    .reduce((s: number, b: any) => s + Number(b.amount || 0), 0);

  return (
    <View style={styles.outerContainer}>
      <AppBackground />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E23744" />}
      >
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <MaterialIcons name="receipt-long" size={20} color="#E23744" />
            <Text style={styles.sectionTitle}>SUBMITTED BILLS</Text>
          </View>

          {assignedSites.length > 1 && (
            <>
              <Text style={styles.formLabel}>CONSTRUCTION SITE</Text>
              <View style={styles.pickerContainer}>
                <Picker selectedValue={selectedSiteId || ''} onValueChange={handleSiteChange} style={styles.picker}>
                  {assignedSites.map((site) => (
                    <Picker.Item key={site.id} label={site.name} value={site.id.toString()} />
                  ))}
                </Picker>
              </View>
            </>
          )}
          {assignedSites.length <= 1 && selectedSiteName ? (
            <Text style={styles.siteName}>{selectedSiteName}</Text>
          ) : null}

          <Text style={styles.formLabel}>DATE FILTER</Text>
          <DatePickerField value={filterDate} onChange={setFilterDate} placeholder="Select date to view bills" />

          <View style={styles.dateStatusRow}>
            <Text style={styles.dateStatusText}>
              Showing {prettyDate(filterDate)}{isToday ? ' (Today)' : ''}
            </Text>
            {!isToday && (
              <TouchableOpacity style={styles.todayBtn} onPress={() => setFilterDate(TODAY)}>
                <MaterialIcons name="today" size={14} color="#E23744" />
                <Text style={styles.todayBtnText}>Today</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.card}>
          {loading ? (
            <ActivityIndicator color="#E23744" style={{ marginVertical: 24 }} />
          ) : !selectedSiteId ? (
            <View style={styles.empty}>
              <MaterialIcons name="location-off" size={32} color="#C4A8AE" />
              <Text style={styles.emptyText}>No site assigned to this account.</Text>
            </View>
          ) : bills.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="inbox" size={32} color="#C4A8AE" />
              <Text style={styles.emptyText}>No bills submitted on {prettyDate(filterDate)}</Text>
            </View>
          ) : (
            <>
              <View style={styles.summaryRow}>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLabelDirect}>DIRECT (CASH)</Text>
                  <Text style={styles.summaryValueDirect}>₹{directTotal.toLocaleString()}</Text>
                </View>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLabelIndirect}>INDIRECT (CREDIT)</Text>
                  <Text style={styles.summaryValueIndirect}>₹{indirectTotal.toLocaleString()}</Text>
                </View>
              </View>
              <Text style={styles.countText}>{bills.length} bill(s)</Text>

              {bills.map((bill: any) => {
                const isDirect = bill.payment_mode === 'Direct';
                const imageUris: string[] = bill.image_url ? bill.image_url.split('||').filter(Boolean) : [];
                return (
                  <View key={bill.id} style={styles.billCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                      {imageUris.length > 0 && <Image source={{ uri: imageUris[0] }} style={styles.thumb} />}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <View style={styles.badge}>
                            <Text style={[styles.badgeText, { color: isDirect ? '#8C0F16' : '#CB202D' }]}>
                              {isDirect ? '💵 Direct' : '💳 Indirect'}
                            </Text>
                          </View>
                          {bill.is_gst ? (
                            <View style={styles.badge}>
                              <Text style={[styles.badgeText, { color: '#CB202D' }]}>GST</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.billCategory}>{bill.category || 'Expense'}</Text>
                        <Text style={styles.billDesc} numberOfLines={2}>
                          {bill.description || '-'}
                        </Text>
                        <Text style={styles.billDate}>
                          {new Date(bill.date).toLocaleDateString('en-IN')}
                          {bill.supervisor_name ? ` · ${bill.supervisor_name}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.billAmount}>₹{Number(bill.amount || 0).toLocaleString()}</Text>
                    </View>
                    {imageUris.length > 1 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                        {imageUris.slice(1).map((uri: string) => (
                          <Image key={uri} source={{ uri }} style={[styles.thumb, { marginRight: 6 }]} />
                        ))}
                      </ScrollView>
                    )}
                    <View style={styles.billActionsRow}>
                      <TouchableOpacity style={styles.iconBtn} onPress={() => handleStartEdit(bill)} disabled={deletingId === bill.id}>
                        <MaterialIcons name="edit" size={17} color="#8C0F16" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.iconBtn} onPress={() => handleDeleteBill(bill.id)} disabled={deletingId === bill.id}>
                        {deletingId === bill.id ? (
                          <ActivityIndicator color="#CB202D" size="small" />
                        ) : (
                          <MaterialIcons name="delete-outline" size={17} color="#CB202D" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>

      {/* Edit a submitted bill */}
      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Edit Bill</Text>

            <Text style={styles.modalFieldLabel}>Category</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Category"
              value={editCategory}
              onChangeText={setEditCategory}
              placeholderTextColor={COLORS.textLight}
            />

            <Text style={styles.modalFieldLabel}>Description</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Description"
              value={editDescription}
              onChangeText={setEditDescription}
              placeholderTextColor={COLORS.textLight}
            />

            <Text style={styles.modalFieldLabel}>Amount (₹)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Amount"
              keyboardType="numeric"
              value={editAmount}
              onChangeText={setEditAmount}
              placeholderTextColor={COLORS.textLight}
            />

            <Text style={styles.modalFieldLabel}>Bill Type</Text>
            <View style={styles.modalToggleRow}>
              <TouchableOpacity
                style={[styles.modalToggleBtn, editPaymentMode === 'Direct' && styles.modalToggleBtnActive]}
                onPress={() => setEditPaymentMode('Direct')}
              >
                <Text style={[styles.modalToggleText, editPaymentMode === 'Direct' && styles.modalToggleTextActive]}>Direct (Cash)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalToggleBtn, editPaymentMode === 'Indirect' && styles.modalToggleBtnActive]}
                onPress={() => setEditPaymentMode('Indirect')}
              >
                <Text style={[styles.modalToggleText, editPaymentMode === 'Indirect' && styles.modalToggleTextActive]}>Indirect (Credit)</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalFieldLabel}>Bill Date</Text>
            <DatePickerField value={editDate} onChange={setEditDate} placeholder="Bill date" style={{ marginBottom: 14 }} />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditVisible(false)} disabled={savingEdit}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, savingEdit && { opacity: 0.6 }]}
                onPress={handleSaveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalSaveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#E23744',
    letterSpacing: 0.5,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#E23744',
    marginBottom: 8,
    marginTop: 10,
    letterSpacing: 0.5,
  },
  siteName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  pickerContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(226, 26, 18, 0.15)',
    overflow: 'hidden',
    marginBottom: 6,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  dateStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  dateStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textLight,
    flex: 1,
  },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(226, 26, 18, 0.25)',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  todayBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#E23744',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: '#FCE9E9',
    borderRadius: 10,
    padding: 10,
  },
  summaryLabelDirect: {
    fontSize: 9,
    fontWeight: '800',
    color: '#8C0F16',
  },
  summaryValueDirect: {
    fontSize: 14,
    fontWeight: '800',
    color: '#8C0F16',
    marginTop: 2,
  },
  summaryLabelIndirect: {
    fontSize: 9,
    fontWeight: '800',
    color: '#CB202D',
  },
  summaryValueIndirect: {
    fontSize: 14,
    fontWeight: '800',
    color: '#CB202D',
    marginTop: 2,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 10,
  },
  billCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#FCE9E9',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  billCategory: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  billDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  billDate: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '600',
  },
  billAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#E23744',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    textAlign: 'center',
  },
  billActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(226, 26, 18, 0.15)',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 13, 16, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    maxHeight: '92%',
  },
  modalHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: SPACING.md,
  },
  modalFieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#E23744',
    marginBottom: 6,
    marginTop: 8,
    letterSpacing: 0.5,
  },
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
  modalToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalToggleBtn: {
    flex: 1,
    padding: 12,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.steel,
    alignItems: 'center',
  },
  modalToggleBtnActive: {
    borderColor: '#E23744',
    backgroundColor: 'rgba(226, 26, 18, 0.1)',
  },
  modalToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textLight,
  },
  modalToggleTextActive: {
    color: COLORS.text,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  modalCancelBtn: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: COLORS.steel,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCancelBtnText: {
    color: COLORS.text,
    fontWeight: '900',
    fontSize: 14,
  },
  modalSaveBtn: {
    flex: 2,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E23744',
  },
  modalSaveBtnText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 14,
  },
});
