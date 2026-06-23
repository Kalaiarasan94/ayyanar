import React, { useState, useEffect } from 'react';
import { ScrollView, Text, View, TouchableOpacity, FlatList, ActivityIndicator, Alert, TextInput, StyleSheet } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { fieldService, adminService } from '../services/api';
import LogoutButton from '../components/LogoutButton';
import AppBackground from './components/AppBackground';
import GlassCard from './components/GlassCard';
import { COLORS, BORDER_RADIUS, SPACING } from '../constants/Theme';

interface LedgerItem {
  id: string;
  site_id: number;
  type: 'CREDIT' | 'DEBIT';
  category: string;
  description: string;
  amount: number;
  date: string;
  is_gst?: number;
}

interface Site {
  id: string;
  name: string;
}

export default function AccountsLedgerScreen() {
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState<'STATEMENT' | 'PAYOUTS' | 'ADD_CASH'>('STATEMENT');
  const [sitesList, setSitesList] = useState<Site[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [activeSite, setActiveSite] = useState<Site | null>(null);
  const [selectedSupervisor, setSelectedSupervisor] = useState<any | null>(null);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [advanceRequests, setAdvanceRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Add Cash State
  const [cashAmount, setCashAmount] = useState('');
  const [cashDescription, setCashDescription] = useState('Direct Cash Transfer');

  useEffect(() => {
    fetchSites();
    fetchStaff();
    fetchApprovedAdvances();
  }, []);

  useEffect(() => {
    if (activeSite) {
      fetchLedger();
    }
  }, [activeSite, currentTab]);

  const fetchStaff = async () => {
    try {
      const staff = await adminService.getStaff();
      setSupervisors(staff.filter((s: any) => s.role === 'Supervisor' || s.role === 'Site Engineer'));
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const fetchSites = async () => {
    setLoading(true);
    try {
      const sites = await adminService.getSites();
      setSitesList(sites);
      if (sites.length > 0) {
        setActiveSite(sites[0]);
      }
    } catch (error) {
      console.error('Error fetching sites:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchApprovedAdvances = async () => {
    try {
      const data = await adminService.getAdvanceRequests();
      setAdvanceRequests(data.filter((r: any) => r.status === 'APPROVED'));
    } catch (error) {
      console.error('Error fetching approved advances:', error);
    }
  };

  const fetchLedger = async () => {
    if (!activeSite) return;
    setLoading(true);
    try {
      const data = await fieldService.getLedgerBySite(activeSite.id);
      setLedger(data);
    } catch (error) {
      console.error('Error fetching ledger:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDirectAddCash = async () => {
    if (!activeSite || !selectedSupervisor || !cashAmount) {
      Alert.alert('Missing Info', 'Please select a site, supervisor and enter amount.');
      return;
    }

    setLoading(true);
    try {
      await fieldService.logExpense({
        siteId: activeSite.id,
        userId: selectedSupervisor.id,
        type: 'CREDIT',
        category: 'Cash Load',
        description: cashDescription,
        amount: parseFloat(cashAmount),
        date: new Date().toISOString().split('T')[0],
        paymentMode: 'Cash'
      });
      
      Alert.alert('Success', `₹${cashAmount} added to ${selectedSupervisor.name}'s wallet for ${activeSite.name}`);
      setCashAmount('');
      setCashDescription('Direct Cash Transfer');
      setSelectedSupervisor(null);
      if (currentTab === 'STATEMENT') fetchLedger();
    } catch (error) {
      Alert.alert('Error', 'Failed to add cash.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisburse = async (req: any, siteId: string) => {
    if (!siteId) {
      Alert.alert('Select Site', 'Please select a site to allocate this advance to.');
      return;
    }

    setLoading(true);
    try {
      await fieldService.payAdvance({
        requestId: req.id,
        userId: req.user_id, // Passing the supervisor's userId
        siteId: siteId,
        amount: req.amount,
        date: new Date().toISOString().split('T')[0]
      });
      Alert.alert('Success', 'Amount disbursed and logged to site ledger.');
      fetchApprovedAdvances();
      if (currentTab === 'STATEMENT') fetchLedger();
    } catch (error) {
      Alert.alert('Error', 'Failed to disburse amount.');
    } finally {
      setLoading(false);
    }
  };


  // Math engines processing active site values independently
  const totalAdvances = ledger.filter(i => i.type === 'CREDIT').reduce((a, c) => a + Number(c.amount), 0);
  const totalDebits = ledger.filter(i => i.type === 'DEBIT').reduce((a, c) => a + Number(c.amount), 0);
  const netBalance = totalAdvances - totalDebits;

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <AppBackground />
      <Stack.Screen 
        options={{
          headerTitle: "Accounts Summary",
          headerRight: () => <LogoutButton />,
        }} 
      />

      {/* Top Site Workspace Selector for Accounting Audits */}
      <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.12)', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.25)' }}>
        <Text style={{ color: COLORS.text, fontSize: 11, fontWeight: 'bold', marginBottom: 8, letterSpacing: 0.5 }}>ACCOUNTING WORKSPACE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={() => setCurrentTab('STATEMENT')} style={[styles.tabButton, currentTab === 'STATEMENT' && styles.activeTab]}>
              <MaterialIcons name="assessment" size={16} color={currentTab === 'STATEMENT' ? '#FFFFFF' : COLORS.textLight} />
              <Text style={[styles.tabText, currentTab === 'STATEMENT' && styles.activeTabText]}>STATEMENTS</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => setCurrentTab('PAYOUTS')} style={[styles.tabButton, currentTab === 'PAYOUTS' && styles.activeTab]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <MaterialIcons name="pending-actions" size={16} color={currentTab === 'PAYOUTS' ? '#FFFFFF' : COLORS.textLight} />
                <Text style={[styles.tabText, currentTab === 'PAYOUTS' && styles.activeTabText]}>PAYOUTS</Text>
                {advanceRequests.length > 0 && (
                  <View style={styles.badge}><Text style={styles.badgeText}>{advanceRequests.length}</Text></View>
                )}
              </View>
            </TouchableOpacity>
 
            <TouchableOpacity onPress={() => setCurrentTab('ADD_CASH')} style={[styles.tabButton, currentTab === 'ADD_CASH' && styles.activeTab]}>
              <MaterialIcons name="add-circle" size={16} color={currentTab === 'ADD_CASH' ? '#FFFFFF' : COLORS.textLight} />
              <Text style={[styles.tabText, currentTab === 'ADD_CASH' && styles.activeTabText]}>ADD CASH</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
 
      {currentTab === 'STATEMENT' && (
        <>
          <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.12)', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.25)' }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {sitesList.map((site) => (
                  <TouchableOpacity 
                    key={site.id} 
                    style={[styles.siteChip, activeSite?.id === site.id && styles.activeSiteChip]}
                    onPress={() => setActiveSite(site)}
                  >
                    <Text style={[styles.siteChipText, activeSite?.id === site.id && styles.activeSiteChipText]}>{site.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
 
          <View style={styles.summaryCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <FontAwesome5 name="wallet" size={14} color={COLORS.textLight} />
              <Text style={{ color: COLORS.textLight, fontSize: 12 }}>{activeSite?.name.toUpperCase() || 'LOADING...'}</Text>
            </View>
            <Text style={{ color: COLORS.primary, fontSize: 32, fontWeight: 'bold' }}>₹{netBalance.toLocaleString()}</Text>
            
            <View style={styles.summaryFooter}>
              <View>
                <Text style={styles.summaryLabel}>Total Credits</Text>
                <Text style={[styles.summaryValue, { color: '#10B981' }]}>₹{totalAdvances.toLocaleString()}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.summaryLabel}>Total Debits</Text>
                <Text style={[styles.summaryValue, { color: '#EF4444' }]}>₹{totalDebits.toLocaleString()}</Text>
              </View>
            </View>
          </View>
 
          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={ledger}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <View style={[styles.ledgerItem, { borderLeftColor: item.type === 'CREDIT' ? '#10B981' : '#EF4444' }]}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <Text style={styles.categoryBadge}>{item.category.toUpperCase()}</Text>
                      {item.is_gst === 1 && <Text style={styles.gstBadge}>GST</Text>}
                      <Text style={{ fontSize: 11, color: COLORS.textLight }}>{new Date(item.date).toLocaleDateString()}</Text>
                    </View>
                    <Text style={styles.ledgerDescription}>{item.description}</Text>
                  </View>
                  <Text style={[styles.ledgerAmount, { color: item.type === 'CREDIT' ? '#10B981' : COLORS.text }]}>
                    {item.type === 'CREDIT' ? '+' : '-'} ₹{Number(item.amount).toLocaleString()}
                  </Text>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No transactions found for this site.</Text>}
            />
          )}
        </>
      )}

      {currentTab === 'PAYOUTS' && (
        <View style={{ flex: 1, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <MaterialIcons name="notification-important" size={20} color={COLORS.primary} />
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: COLORS.text }}>Approved Requests</Text>
          </View>
          <FlatList
            data={advanceRequests}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View style={styles.payoutCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: COLORS.text }}>{item.user_name}</Text>
                    <Text style={{ fontSize: 11, color: COLORS.textLight }}>{item.user_role} • Requested: {new Date(item.date).toLocaleDateString()}</Text>
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.primary }}>₹{Number(item.amount).toLocaleString()}</Text>
                </View>
                <View style={styles.reasonBox}>
                  <Text style={{ fontSize: 12, color: COLORS.text }}>Reason: {item.reason}</Text>
                </View>
                
                <View style={styles.allocationSection}>
                  <Text style={styles.allocationLabel}>SELECT SITE TO DISBURSE FROM:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {sitesList.map(site => (
                        <TouchableOpacity 
                          key={site.id} 
                          onPress={() => handleDisburse(item, site.id)}
                          style={styles.siteAllocationChip}
                        >
                          <Text style={styles.siteAllocationChipText}>{site.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No approved advances pending payout.</Text>}
          />
        </View>
      )}

      {currentTab === 'ADD_CASH' && (
        <ScrollView style={{ flex: 1, padding: 16 }}>
          <View style={styles.addCashCard}>
            <Text style={styles.cardTitle}>Direct Wallet Loading</Text>
            <Text style={styles.cardSubtitle}>Manually add cash credit to a supervisor's site wallet.</Text>

            <Text style={styles.inputLabel}>SELECT SUPERVISOR</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {supervisors.map((s) => (
                  <TouchableOpacity 
                    key={s.id} 
                    style={[styles.siteChipOutline, selectedSupervisor?.id === s.id && styles.activeSiteChipOutline, { borderColor: COLORS.primary }]}
                    onPress={() => setSelectedSupervisor(s)}
                  >
                    <Text style={[styles.siteChipOutlineText, selectedSupervisor?.id === s.id && styles.activeSiteChipOutlineText]}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.inputLabel}>SELECT SITE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {sitesList.map((site) => (
                  <TouchableOpacity 
                    key={site.id} 
                    style={[styles.siteChipOutline, activeSite?.id === site.id && styles.activeSiteChipOutline]}
                    onPress={() => setActiveSite(site)}
                  >
                    <Text style={[styles.siteChipOutlineText, activeSite?.id === site.id && styles.activeSiteChipOutlineText]}>{site.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.inputLabel}>AMOUNT TO ADD (₹)</Text>
            <TextInput 
              style={styles.textInput}
              placeholder="0.00"
              placeholderTextColor={COLORS.textLight}
              keyboardType="numeric"
              value={cashAmount}
              onChangeText={setCashAmount}
            />

            <Text style={styles.inputLabel}>TRANSACTION DESCRIPTION</Text>
            <TextInput 
              style={styles.textInput}
              placeholder="e.g. Cash handed over at office"
              placeholderTextColor={COLORS.textLight}
              value={cashDescription}
              onChangeText={setCashDescription}
            />

            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={handleDirectAddCash}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>CONFIRM CASH DISBURSEMENT</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1E293B' },
  activeTab: { backgroundColor: '#38BDF8' },
  tabText: { color: '#94A3B8', fontSize: 12, fontWeight: 'bold' },
  activeTabText: { color: '#0F172A' },
  badge: { backgroundColor: '#EF4444', minWidth: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: 'bold' },
  siteChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#334155' },
  activeSiteChip: { backgroundColor: '#6366F1' },
  siteChipText: { color: '#94A3B8', fontSize: 12, fontWeight: 'bold' },
  activeSiteChipText: { color: '#FFFFFF' },
  summaryCard: { backgroundColor: '#1E293B', padding: 20, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, elevation: 4 },
  summaryFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#334155' },
  summaryLabel: { color: '#94A3B8', fontSize: 11, marginBottom: 4 },
  summaryValue: { fontSize: 16, fontWeight: 'bold' },
  ledgerItem: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 4, elevation: 1 },
  categoryBadge: { fontSize: 10, fontWeight: 'bold', color: '#6366F1', backgroundColor: '#EEF2FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  gstBadge: { fontSize: 9, fontWeight: 'bold', color: '#10B981', borderColor: '#10B981', borderWidth: 1, paddingHorizontal: 4, borderRadius: 4, marginLeft: 4 },
  ledgerDescription: { fontSize: 14, fontWeight: 'bold', color: '#0F172A', marginTop: 6 },
  ledgerAmount: { fontSize: 15, fontWeight: 'bold' },
  payoutCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 12, elevation: 2 },
  reasonBox: { backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8, marginTop: 12, borderWidth: 1, borderColor: '#F1F5F9' },
  allocationSection: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12 },
  allocationLabel: { fontSize: 11, fontWeight: 'bold', color: '#64748B', marginBottom: 10 },
  siteAllocationChip: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', marginRight: 8 },
  siteAllocationChipText: { fontSize: 11, fontWeight: 'bold', color: '#475569' },
  addCashCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 16, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#0F172A', marginBottom: 6 },
  cardSubtitle: { fontSize: 13, color: '#64748B', marginBottom: 20 },
  inputLabel: { fontSize: 11, fontWeight: 'bold', color: '#64748B', marginBottom: 8 },
  textInput: { backgroundColor: '#F1F5F9', padding: 14, borderRadius: 8, marginBottom: 16, fontSize: 15, borderWidth: 1, borderColor: '#E2E8F0' },
  primaryButton: { backgroundColor: '#0F172A', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  siteChipOutline: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  activeSiteChipOutline: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  siteChipOutlineText: { fontSize: 11, fontWeight: 'bold', color: '#475569' },
  activeSiteChipOutlineText: { color: '#FFF' },
  emptyText: { textAlign: 'center', color: '#64748B', marginTop: 40 }
});
