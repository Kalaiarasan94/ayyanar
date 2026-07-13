import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { MaterialIcons } from '@expo/vector-icons';
import { accountsService, adminService } from '../services/api';
import { printHtmlOnWeb } from '../services/printReport';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/Theme';
import DatePickerField from './DatePickerField';

type AccountsRole = 'Admin' | 'Supervisor' | 'Owner';
type FlowTab = 'INPUT' | 'OUTPUT';
type ViewTab = 'ANALYTICS' | 'TRANSACTIONS';

type AccountsModuleProps = {
  role: AccountsRole;
  heading: string;
  inputSources: string[]; // who gives money to this role
  outputTargets: string[]; // where this role's money goes
};

// Paying these parties auto-credits the receiving role's account on the server
const ROLE_TARGETS = ['Admin', 'Supervisors', 'Owner'];

const rupees = (value: any) => `Rs ${Number(value || 0).toLocaleString('en-IN')}`;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const dateLabel = (isoDate: string) => {
  const d = new Date(isoDate);
  return `${d.getDate().toString().padStart(2, '0')} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
};

const isValidDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

export default function AccountsModule({ role, heading, inputSources, outputTargets }: AccountsModuleProps) {
  const [flowTab, setFlowTab] = useState<FlowTab>('INPUT');
  const [viewTab, setViewTab] = useState<ViewTab>('ANALYTICS');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const [summary, setSummary] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Date range filter (applies to the Transactions sub-menu and the PDF report)
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [appliedRange, setAppliedRange] = useState<{ from?: string; to?: string }>({});

  // Entry modal
  const [entryVisible, setEntryVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [activeTransaction, setActiveTransaction] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  // The specific person behind the category (e.g. which real supervisor gets paid)
  const [party, setParty] = useState<{ name: string; userId: any } | null>(null);
  const [supervisors, setSupervisors] = useState<{ id: any; name: string }[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank'>('Cash');
  // Free-text name on every entry (who gave / person / site / shop) — editable
  const [entryName, setEntryName] = useState('');
  const [sites, setSites] = useState<{ id: any; name: string }[]>([]);

  const isInput = flowTab === 'INPUT';
  // Only the Owner records money-in by hand; other inputs arrive automatically
  const canAddEntry = !isInput || role === 'Owner';
  const flow = isInput ? 'IN' : 'OUT';
  const accent = isInput ? COLORS.success : COLORS.primary;

  const getTransactionsWithBalance = async (range = appliedRange) => {
    // Fetch all transactions (both IN and OUT) up to `to` date
    const allTxns = await accountsService.getTransactions(role, undefined, undefined, range.to);
    
    // Sort chronologically (ascending) to compute running balance correctly
    const sorted = [...allTxns].sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.id - b.id;
    });

    let balance = 0;
    const txnsWithBalance = sorted.map((t) => {
      if (t.flow === 'IN') {
        balance += Number(t.amount);
      } else {
        balance -= Number(t.amount);
      }
      return { ...t, runningBalance: balance };
    });

    // Return reversed (descending) so latest shows first in lists
    return txnsWithBalance.reverse();
  };

  const loadData = async (tab: FlowTab = flowTab, range = appliedRange) => {
    setLoading(true);
    try {
      const [summaryData, allTxnsWithBalance] = await Promise.all([
        accountsService.getSummary(role),
        getTransactionsWithBalance(range),
      ]);
      setSummary(summaryData);
      
      const filteredTxns = allTxnsWithBalance.filter(t => 
        t.flow === (tab === 'INPUT' ? 'IN' : 'OUT') && 
        (!range.from || t.date >= range.from)
      );
      setTransactions(filteredTxns);
    } catch (err) {
      console.error(err);
      Alert.alert('Data Error', 'Unable to load account data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(flowTab);
  }, [flowTab]);

  // Load the real supervisors created by the admin so payments go to actual people
  useEffect(() => {
    if (!outputTargets.includes('Supervisors')) return;
    adminService
      .getStaff()
      .then((staff) => setSupervisors((staff || []).filter((s: any) => s.role === 'Supervisor').map((s: any) => ({ id: s.id, name: s.name }))))
      .catch(() => setSupervisors([]));
  }, []);

  // Load the created sites so Site Expenses can be tagged to a real site
  useEffect(() => {
    if (!outputTargets.includes('Site Expenses')) return;
    adminService
      .getSites()
      .then((data) => setSites((data || []).map((s: any) => ({ id: s.id, name: s.name }))))
      .catch(() => setSites([]));
  }, []);

  const applyDateRange = () => {
    if ((fromDate && !isValidDate(fromDate)) || (toDate && !isValidDate(toDate))) {
      Alert.alert('Invalid Date', 'Use the YYYY-MM-DD format, e.g., 2026-07-01.');
      return;
    }
    const range = { from: fromDate || undefined, to: toDate || undefined };
    setAppliedRange(range);
    loadData(flowTab, range);
  };

  const clearDateRange = () => {
    setFromDate('');
    setToDate('');
    setAppliedRange({});
    loadData(flowTab, {});
  };

  const openEntry = () => {
    setAmount('');
    setCategory(null);
    setParty(null);
    setEntryName('');
    setPaymentMethod('Cash');
    setDescription('');
    setEntryVisible(true);
  };

  const handleSave = async () => {
    if (!amount || !category) {
      Alert.alert('Missing Info', `Please enter the amount and select ${isInput ? 'who gave the money' : 'where the money went'}.`);
      return;
    }
    const cleanAmount = parseFloat(amount);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      Alert.alert('Invalid Amount', 'Amount must be a positive number.');
      return;
    }

    setSubmitting(true);
    try {
      const userId = await AsyncStorage.getItem('userId');
      const response = await accountsService.addTransaction({
        role,
        userId,
        flow,
        category,
        partyName: entryName.trim() || party?.name || null,
        recipientUserId: party?.userId || null,
        paymentMethod,
        description,
        amount: cleanAmount,
        date: new Date().toISOString().split('T')[0],
      });
      setEntryVisible(false);
      Alert.alert('Success', response?.message || 'Entry saved.');
      await loadData(flowTab);
    } catch (error: any) {
      Alert.alert('Save Error', error?.message || 'Unable to save the entry.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Transactions PDF report ----------
  const rangeTitle = appliedRange.from || appliedRange.to
    ? `${appliedRange.from ? dateLabel(appliedRange.from) : 'Beginning'} to ${appliedRange.to ? dateLabel(appliedRange.to) : 'Today'}`
    : 'All Time';

  // Full account report: Input | Output | Balance summary, then detailed
  // Input section (who gave, method, reason) and Output section (paid to whom, method, reason)
  const buildAccountReportHtml = (inTxns: any[], outTxns: any[]) => {
    const totalIn = inTxns.reduce((s, t) => s + Number(t.amount), 0);
    const totalOut = outTxns.reduce((s, t) => s + Number(t.amount), 0);
    const balance = totalIn - totalOut;

    const detailTableIn = (title: string, txns: any[], total: number) => `
      <h3 style="color:#15803D;">${title} (${txns.length} entries)</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Date</th>
            <th>From Whom</th>
            <th>Name</th>
            <th>Mode of Transfer</th>
            <th>Note / Description</th>
            <th class="r">Amount (Rs)</th>
          </tr>
        </thead>
        <tbody>
          ${txns.length ? txns.map((t: any, index: number) => `
            <tr style="background:${index % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
              <td>${index + 1}</td>
              <td>${dateLabel(t.date)}</td>
              <td>${t.category}</td>
              <td><b>${t.party_name || '-'}</b></td>
              <td>${t.payment_method || 'Cash'}</td>
              <td>${t.description || '-'}</td>
              <td style="text-align:right; color:#15803D; font-weight:bold;">${Number(t.amount).toLocaleString('en-IN')}</td>
            </tr>
          `).join('') : '<tr><td colspan="7" style="text-align:center; color:#64748B;">No entries in this period</td></tr>'}
          <tr style="background:#0F172A; color:#FFF; font-weight:bold;">
            <td colspan="6">TOTAL INPUT</td>
            <td style="text-align:right;">${total.toLocaleString('en-IN')}</td>
          </tr>
        </tbody>
      </table>`;

    const detailTableOut = (title: string, txns: any[], total: number) => `
      <h3 style="color:#E21A12;">${title} (${txns.length} entries)</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Date</th>
            <th>To Whom</th>
            <th>Name</th>
            <th>Mode of Payment</th>
            <th>Notes</th>
            <th class="r">Amount (Rs)</th>
            <th class="r">Balance (Rs)</th>
          </tr>
        </thead>
        <tbody>
          ${txns.length ? txns.map((t: any, index: number) => `
            <tr style="background:${index % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
              <td>${index + 1}</td>
              <td>${dateLabel(t.date)}</td>
              <td>${t.category}</td>
              <td><b>${t.party_name || '-'}</b></td>
              <td>${t.payment_method || 'Cash'}</td>
              <td>${t.description || '-'}</td>
              <td style="text-align:right; color:#E21A12; font-weight:bold;">${Number(t.amount).toLocaleString('en-IN')}</td>
              <td style="text-align:right; font-weight:bold;">${Number(t.runningBalance).toLocaleString('en-IN')}</td>
            </tr>
          `).join('') : '<tr><td colspan="8" style="text-align:center; color:#64748B;">No entries in this period</td></tr>'}
          <tr style="background:#0F172A; color:#FFF; font-weight:bold;">
            <td colspan="6">TOTAL OUTPUT</td>
            <td style="text-align:right;">${total.toLocaleString('en-IN')}</td>
            <td></td>
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
            .box .value { font-size: 18px; font-weight: bold; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
            th { background: #0F172A; color: #FFF; padding: 7px 6px; text-align: left; }
            th.r { text-align: right; }
            td { padding: 6px; border-bottom: 1px solid #E2E8F0; }
          </style>
        </head>
        <body>
          <h1>Ayyanar Construction — ${heading}</h1>
          <div class="sub">${rangeTitle} &bull; Generated on ${new Date().toLocaleString('en-IN')}</div>

          <div class="boxes">
            <div class="box"><div class="label">Input (Received)</div><div class="value" style="color:#15803D;">${rupees(totalIn)}</div></div>
            <div class="box"><div class="label">Output (Paid)</div><div class="value" style="color:#E21A12;">${rupees(totalOut)}</div></div>
            <div class="box"><div class="label">Balance</div><div class="value">${rupees(balance)}</div></div>
          </div>

          ${detailTableIn('INPUT — Money Received', inTxns, totalIn)}
          ${detailTableOut('OUTPUT — Money Paid', outTxns, totalOut)}
        </body>
      </html>`;
  };

  const handleDownloadReport = async () => {
    setGeneratingPdf(true);
    try {
      const allTxnsWithBalance = await getTransactionsWithBalance(appliedRange);
      
      const inTxns = allTxnsWithBalance.filter(t => t.flow === 'IN' && (!appliedRange.from || t.date >= appliedRange.from)).reverse();
      const outTxns = allTxnsWithBalance.filter(t => t.flow === 'OUT' && (!appliedRange.from || t.date >= appliedRange.from)).reverse();
      
      if (inTxns.length === 0 && outTxns.length === 0) {
        Alert.alert('No Data', 'There are no transactions in the selected date range.');
        return;
      }
      
      if (Platform.OS === 'web') {
        await printHtmlOnWeb(buildAccountReportHtml(inTxns, outTxns), `${heading.replace(/\s+/g, '_')}_Report.pdf`);
        return;
      }
      const { uri } = await Print.printToFileAsync({ html: buildAccountReportHtml(inTxns, outTxns) });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: `${heading} — Report`,
        });
      } else {
        Alert.alert('Saved', `PDF generated at:\n${uri}`);
      }
    } catch (error: any) {
      Alert.alert('PDF Error', error?.message || 'Unable to generate the report.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleShareWhatsApp = async () => {
    setGeneratingPdf(true);
    try {
      const allTxnsWithBalance = await getTransactionsWithBalance(appliedRange);
      
      const inTxns = allTxnsWithBalance.filter(t => t.flow === 'IN' && (!appliedRange.from || t.date >= appliedRange.from)).reverse();
      const outTxns = allTxnsWithBalance.filter(t => t.flow === 'OUT' && (!appliedRange.from || t.date >= appliedRange.from)).reverse();
      
      if (inTxns.length === 0 && outTxns.length === 0) {
        Alert.alert('No Data', 'There are no transactions in the selected date range.');
        return;
      }
      
      const htmlContent = buildAccountReportHtml(inTxns, outTxns);
      
      if (Platform.OS === 'web') {
        const totalIn = inTxns.reduce((s, t) => s + Number(t.amount), 0);
        const totalOut = outTxns.reduce((s, t) => s + Number(t.amount), 0);
        const balance = totalIn - totalOut;
        const text =
          `*Ayyanar Construction - ${heading}*\n` +
          `Period: ${rangeTitle}\n` +
          `Total Input: ${rupees(totalIn)}\n` +
          `Total Output: ${rupees(totalOut)}\n` +
          `Balance: ${rupees(balance)}`;
        await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
        return;
      }
      
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: `Share ${heading} PDF`,
        });
      } else {
        Alert.alert('Sharing Unavailable', 'Sharing is not available on this device.');
      }
    } catch (error: any) {
      Alert.alert('Share Error', error?.message || 'Unable to share the report.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // ---------- Sub views ----------
  const renderAnalytics = () => {
    const breakdown = isInput ? summary?.inBreakdown : summary?.outBreakdown;
    return (
      <View>
        <View style={styles.statRow}>
          <View style={[styles.statCard, { backgroundColor: 'rgba(21, 128, 61, 0.08)' }]}>
            <Text style={[styles.statValue, { color: COLORS.success }]}>{rupees(summary?.totalIn)}</Text>
            <Text style={styles.statLabel}>Total Received</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: 'rgba(226, 26, 18, 0.06)' }]}>
            <Text style={[styles.statValue, { color: COLORS.primary }]}>{rupees(summary?.totalOut)}</Text>
            <Text style={styles.statLabel}>Total Paid</Text>
          </View>
        </View>
        <View style={styles.balanceCard}>
          <View>
            <Text style={styles.balanceLabel}>Cash in Hand</Text>
            <Text style={styles.balanceValue}>{rupees(summary?.balance)}</Text>
          </View>
          <MaterialIcons name="account-balance-wallet" size={30} color={COLORS.white} />
        </View>

        {(breakdown || []).length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{isInput ? 'Received From' : 'Paid To'}</Text>
            <View style={styles.card}>
              {(breakdown || []).map((item: any) => (
                <View key={`${flowTab}-${item.category}-${item.party_name || ''}`} style={styles.breakdownRow}>
                  <Text style={styles.breakdownName}>
                    {isInput
                      ? `${item.category}${item.party_name ? ` • ${item.party_name}` : ''}`
                      : item.party_name || item.category}
                  </Text>
                  <Text style={[styles.breakdownAmount, { color: accent }]}>{rupees(item.total)}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    );
  };

  const renderTransactions = () => (
    <View>
      {/* Date range picker */}
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>PICK DATE RANGE</Text>
        <View style={styles.dateRow}>
          <DatePickerField style={{ flex: 1 }} placeholder="From date" value={fromDate} onChange={setFromDate} />
          <DatePickerField style={{ flex: 1 }} placeholder="To date" value={toDate} onChange={setToDate} />
        </View>
        <View style={styles.dateActions}>
          <TouchableOpacity style={styles.applyButton} onPress={applyDateRange}>
            <MaterialIcons name="filter-alt" size={16} color={COLORS.white} />
            <Text style={styles.applyButtonText}>Apply</Text>
          </TouchableOpacity>
          {(appliedRange.from || appliedRange.to) && (
            <TouchableOpacity style={styles.clearButton} onPress={clearDateRange}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.pdfActionsRow}>
        <TouchableOpacity style={[styles.pdfButton, generatingPdf && { opacity: 0.6 }]} onPress={handleDownloadReport} disabled={generatingPdf}>
          {generatingPdf ? <ActivityIndicator color={COLORS.white} size="small" /> : <MaterialIcons name="picture-as-pdf" size={18} color={COLORS.white} />}
          <Text style={styles.pdfButtonText}>Download PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pdfButton, styles.whatsappButton, generatingPdf && { opacity: 0.6 }]} onPress={handleShareWhatsApp} disabled={generatingPdf}>
          <MaterialIcons name="share" size={18} color={COLORS.white} />
          <Text style={styles.pdfButtonText}>Share on WhatsApp</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>
        Transactions ({transactions.length}) — {rupees(transactions.reduce((s, t) => s + Number(t.amount), 0))}
      </Text>
      <View style={styles.card}>
        {transactions.map((item: any) => (
          <TouchableOpacity 
            key={item.id} 
            style={styles.txnRow}
            onPress={() => {
              setActiveTransaction(item);
              setDetailsVisible(true);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.txnIcon, { backgroundColor: isInput ? 'rgba(21, 128, 61, 0.1)' : 'rgba(226, 26, 18, 0.08)' }]}>
              <MaterialIcons name={isInput ? 'south-west' : 'north-east'} size={18} color={accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.txnTitle}>
                {isInput
                  ? `From ${item.category}${item.party_name ? ` • ${item.party_name}` : ''}`
                  : `To ${item.party_name || item.category}`}
              </Text>
              <Text style={styles.txnMeta}>
                {dateLabel(item.date)} / {item.payment_method || 'Cash'}{item.description ? ` / ${item.description}` : ''}
              </Text>
              {!isInput && item.runningBalance !== undefined && (
                <Text style={styles.runningBalanceMeta}>Balance: {rupees(item.runningBalance)}</Text>
              )}
            </View>
            <Text style={[styles.txnAmount, { color: accent }]}>
              {isInput ? '+' : '-'} {rupees(item.amount)}
            </Text>
          </TouchableOpacity>
        ))}
        {transactions.length === 0 && !loading && (
          <Text style={styles.emptyText}>{isInput ? 'No money received in this range.' : 'No payments in this range.'}</Text>
        )}
      </View>
    </View>
  );

  return (
    <View>
      <Text style={styles.heading}>{heading}</Text>
      <Text style={styles.subheading}>Cash in hand: <Text style={{ color: COLORS.text, fontWeight: '900' }}>{rupees(summary?.balance)}</Text></Text>

      {/* Input / Output submenu */}
      <View style={styles.flowTabRow}>
        <TouchableOpacity
          style={[styles.flowTabButton, isInput && { backgroundColor: COLORS.success }]}
          onPress={() => { setFlowTab('INPUT'); setViewTab('ANALYTICS'); }}
        >
          <MaterialIcons name="south-west" size={17} color={isInput ? COLORS.white : COLORS.textLight} />
          <Text style={[styles.flowTabText, isInput && styles.flowTabTextActive]}>Input</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.flowTabButton, !isInput && { backgroundColor: COLORS.primary }]}
          onPress={() => { setFlowTab('OUTPUT'); setViewTab('ANALYTICS'); }}
        >
          <MaterialIcons name="north-east" size={17} color={!isInput ? COLORS.white : COLORS.textLight} />
          <Text style={[styles.flowTabText, !isInput && styles.flowTabTextActive]}>Output</Text>
        </TouchableOpacity>
      </View>

      {/* Received/Paid vs Transactions sub-menu */}
      <View style={styles.viewTabRow}>
        <TouchableOpacity
          style={[styles.viewTabButton, viewTab === 'ANALYTICS' && styles.viewTabButtonActive]}
          onPress={() => setViewTab('ANALYTICS')}
        >
          <Text style={[styles.viewTabText, viewTab === 'ANALYTICS' && styles.viewTabTextActive]}>
            {isInput ? 'Received' : 'Paid'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewTabButton, viewTab === 'TRANSACTIONS' && styles.viewTabButtonActive]}
          onPress={() => setViewTab('TRANSACTIONS')}
        >
          <Text style={[styles.viewTabText, viewTab === 'TRANSACTIONS' && styles.viewTabTextActive]}>Transactions</Text>
        </TouchableOpacity>
      </View>

      {/* Entry */}
      {canAddEntry ? (
        <TouchableOpacity style={[styles.addButton, { backgroundColor: accent }]} onPress={openEntry}>
          <MaterialIcons name="add-circle-outline" size={20} color={COLORS.white} />
          <Text style={styles.addButtonText}>{isInput ? 'New Receipt Entry' : 'New Payment Entry'}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.infoCard}>
          <MaterialIcons name="info-outline" size={20} color={COLORS.textLight} />
          <Text style={styles.infoText}>
            Money-in entries are logged automatically when {role === 'Admin' ? 'the Owner sends' : 'the Owner or Admin sends'} you money.
          </Text>
        </View>
      )}

      {loading ? <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SPACING.md }} /> : null}

      {viewTab === 'ANALYTICS' ? renderAnalytics() : renderTransactions()}

      {/* Entry modal */}
      <Modal visible={entryVisible} transparent animationType="slide" onRequestClose={() => setEntryVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{isInput ? 'New Receipt Entry' : 'New Payment Entry'}</Text>
            <Text style={styles.modalSubtitle}>{heading} — {isInput ? 'money received' : 'money paid'}</Text>

            <Text style={styles.fieldLabel}>{isInput ? 'RECEIVED FROM' : 'GIVEN TO / SPENT ON'}</Text>
            <View style={styles.chipRow}>
              {(isInput ? inputSources : outputTargets).map((option) => {
                // "Supervisors" expands into the real supervisors created by the admin
                if (!isInput && option === 'Supervisors' && supervisors.length > 0) {
                  return supervisors.map((sup) => {
                    const selected = category === 'Supervisors' && party?.userId === sup.id;
                    return (
                      <TouchableOpacity
                        key={`sup-${sup.id}`}
                        style={[styles.chip, selected && { backgroundColor: accent, borderColor: accent }]}
                        onPress={() => {
                          setCategory('Supervisors');
                          setParty({ name: sup.name, userId: sup.id });
                          setEntryName(sup.name);
                        }}
                      >
                        <MaterialIcons name="person" size={13} color={selected ? COLORS.white : COLORS.textLight} />
                        <Text style={[styles.chipText, selected && styles.chipTextActive]}>{sup.name}</Text>
                      </TouchableOpacity>
                    );
                  });
                }
                const selected = category === option && !party;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.chip, selected && { backgroundColor: accent, borderColor: accent }]}
                    onPress={() => {
                      setCategory(option);
                      setParty(null);
                      setEntryName('');
                    }}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Site Expenses: pick which created site the money was spent on */}
            {!isInput && category === 'Site Expenses' && sites.length > 0 && (
              <>
                <Text style={styles.fieldLabel}>SELECT SITE</Text>
                <View style={styles.chipRow}>
                  {sites.map((site) => {
                    const selected = entryName === site.name;
                    return (
                      <TouchableOpacity
                        key={`site-${site.id}`}
                        style={[styles.chip, selected && { backgroundColor: COLORS.headerBackground, borderColor: COLORS.headerBackground }]}
                        onPress={() => setEntryName(site.name)}
                      >
                        <MaterialIcons name="location-city" size={13} color={selected ? COLORS.white : COLORS.textLight} />
                        <Text style={[styles.chipText, selected && styles.chipTextActive]}>{site.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* Name on every entry — auto-filled by supervisor/site picks, always editable */}
            <Text style={styles.fieldLabel}>NAME ({isInput ? 'WHO GAVE' : 'PERSON / SITE / SHOP'})</Text>
            <TextInput
              style={styles.input}
              placeholder={isInput ? 'e.g., Rajan (Client side)' : 'e.g., Kumar Hardware, Alpha Site'}
              placeholderTextColor={COLORS.textLight}
              value={entryName}
              onChangeText={setEntryName}
            />

            {!isInput && category && ROLE_TARGETS.includes(category) && (
              <View style={styles.infoCard}>
                <MaterialIcons name="sync-alt" size={18} color={COLORS.textLight} />
                <Text style={styles.infoText}>
                  This amount will automatically appear as money-in on {party ? `${party.name}'s Supervisor account` : `the ${category === 'Supervisors' ? 'Supervisor' : category} account`}.
                </Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>PAYMENT METHOD</Text>
            <View style={styles.chipRow}>
              {(['Cash', 'Bank'] as const).map((method) => (
                <TouchableOpacity
                  key={method}
                  style={[styles.chip, paymentMethod === method && { backgroundColor: COLORS.headerBackground, borderColor: COLORS.headerBackground }]}
                  onPress={() => setPaymentMethod(method)}
                >
                  <MaterialIcons name={method === 'Cash' ? 'payments' : 'account-balance'} size={13} color={paymentMethod === method ? COLORS.white : COLORS.textLight} />
                  <Text style={[styles.chipText, paymentMethod === method && styles.chipTextActive]}>{method}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>AMOUNT (₹)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={COLORS.textLight}
              value={amount}
              onChangeText={setAmount}
            />

            <Text style={styles.fieldLabel}>REASON / NOTE (OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Advance for Alpha site work"
              placeholderTextColor={COLORS.textLight}
              value={description}
              onChangeText={setDescription}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setEntryVisible(false)} disabled={submitting}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: accent }, submitting && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveButtonText}>Save Entry</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Transaction Details Modal */}
      <Modal visible={detailsVisible} transparent animationType="fade" onRequestClose={() => setDetailsVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { maxHeight: '85%' }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Transaction Details</Text>
            
            {activeTransaction && (
              <View style={styles.detailsContainer}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>DATE</Text>
                  <Text style={styles.detailValue}>{dateLabel(activeTransaction.date)}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>TYPE</Text>
                  <View style={[styles.voucherBadge, { backgroundColor: activeTransaction.flow === 'IN' ? 'rgba(21, 128, 61, 0.1)' : 'rgba(226, 26, 18, 0.08)', alignSelf: 'flex-start' }]}>
                    <Text style={[styles.voucherBadgeText, { color: activeTransaction.flow === 'IN' ? COLORS.success : COLORS.primary }]}>
                      {activeTransaction.flow === 'IN' ? 'RECEIPT (IN)' : 'PAYMENT (OUT)'}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{activeTransaction.flow === 'IN' ? 'FROM CATEGORY' : 'TO CATEGORY'}</Text>
                  <Text style={styles.detailValue}>{activeTransaction.category}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{activeTransaction.flow === 'IN' ? 'FROM PERSON / SENDER' : 'RECIPIENT / NAME'}</Text>
                  <Text style={styles.detailValue}>{activeTransaction.party_name || '-'}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>MODE OF PAYMENT</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialIcons name={activeTransaction.payment_method === 'Bank' ? 'account-balance' : 'payments'} size={16} color={COLORS.text} />
                    <Text style={styles.detailValue}>{activeTransaction.payment_method || 'Cash'}</Text>
                  </View>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>AMOUNT</Text>
                  <Text style={[styles.detailValue, { fontSize: 18, fontWeight: '900', color: activeTransaction.flow === 'IN' ? COLORS.success : COLORS.primary }]}>
                    {rupees(activeTransaction.amount)}
                  </Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>NOTES / REASON</Text>
                  <Text style={styles.detailValue}>{activeTransaction.description || '-'}</Text>
                </View>
                
                {activeTransaction.runningBalance !== undefined && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>RUNNING BALANCE</Text>
                    <Text style={styles.detailValue}>{rupees(activeTransaction.runningBalance)}</Text>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity style={[styles.cancelButton, { marginTop: 20, width: '100%' }]} onPress={() => setDetailsVisible(false)}>
              <Text style={styles.cancelButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '900',
  },
  subheading: {
    color: COLORS.textLight,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: SPACING.md,
  },
  flowTabRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.steel,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 4,
    marginBottom: SPACING.sm,
  },
  flowTabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.sm,
  },
  flowTabText: {
    color: COLORS.textLight,
    fontSize: 13,
    fontWeight: '900',
  },
  flowTabTextActive: {
    color: COLORS.white,
  },
  viewTabRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  viewTabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  viewTabButtonActive: {
    backgroundColor: COLORS.headerBackground,
    borderColor: COLORS.headerBackground,
  },
  viewTabText: {
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: '900',
  },
  viewTabTextActive: {
    color: COLORS.white,
  },
  statRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: 3,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '900',
  },
  statLabel: {
    color: COLORS.textLight,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  balanceCard: {
    backgroundColor: COLORS.headerBackground,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceLabel: {
    color: '#BFC5CC',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  balanceValue: {
    color: COLORS.white,
    fontSize: 24,
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
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.steel,
  },
  breakdownName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  breakdownAmount: {
    fontSize: 14,
    fontWeight: '900',
  },
  dateRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  dateInput: {
    flex: 1,
    backgroundColor: COLORS.steel,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    padding: 11,
  },
  dateActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  applyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.headerBackground,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 11,
  },
  applyButtonText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 13,
  },
  clearButton: {
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.steel,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  clearButtonText: {
    color: COLORS.text,
    fontWeight: '900',
    fontSize: 13,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 13,
    marginTop: SPACING.sm,
  },
  reportButtonText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 13,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 14,
    marginBottom: SPACING.sm,
  },
  addButtonText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 14,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.steel,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  infoText: {
    flex: 1,
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.steel,
  },
  txnIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
  },
  txnMeta: {
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  txnAmount: {
    fontSize: 13,
    fontWeight: '900',
  },
  emptyText: {
    color: COLORS.textLight,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: SPACING.lg,
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
    fontSize: 19,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.steel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  chipText: {
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: '900',
  },
  chipTextActive: {
    color: COLORS.white,
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
    marginBottom: SPACING.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  cancelButton: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: COLORS.steel,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    color: COLORS.text,
    fontWeight: '900',
    fontSize: 14,
  },
  saveButton: {
    flex: 2,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 14,
  },
  runningBalanceMeta: {
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  detailsContainer: {
    width: '100%',
    marginTop: SPACING.md,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.steel,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.text,
  },
  voucherBadge: {
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  voucherBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    textTransform: 'uppercase',
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
});
