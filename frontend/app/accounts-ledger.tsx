import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { accountsService } from '../services/api';
import { buildPdfReport, downloadPdfReport, sharePdfReportOnWhatsApp, ReportTable } from '../services/pdfReport';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/Theme';
import DatePickerField from '../components/DatePickerField';

type BookTab = 'DASHBOARD' | 'DAYBOOK' | 'LEDGER' | 'REPORTS';

// Paying these parties is an internal transfer between our own books
const ROLE_PARTIES = ['Owner', 'Admin', 'Supervisors', 'Supervisor'];

const bottomTabs: { id: BookTab; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { id: 'DASHBOARD', label: 'Dashboard', icon: 'dashboard' },
  { id: 'DAYBOOK', label: 'Day Book', icon: 'menu-book' },
  { id: 'LEDGER', label: 'Ledger', icon: 'account-balance' },
  { id: 'REPORTS', label: 'Reports', icon: 'assessment' },
];

const rupees = (value: any) => `Rs ${Number(value || 0).toLocaleString('en-IN')}`;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const monthLabel = (period: string) => {
  const [year, month] = period.split('-');
  if (!month) return period;
  return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
};

const dateLabel = (isoDate: string) => {
  const d = new Date(isoDate);
  return `${d.getDate().toString().padStart(2, '0')} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
};

// How a raw transaction reads in the books. Voucher types follow Tally:
// Receipt = money in (Credit), Payment = money out (Debit), Contra = internal transfer (Debit).
const describeTxn = (t: any) => {
  if (t.flow === 'IN') {
    const from = `${t.category}${t.party_name ? ` • ${t.party_name}` : ''}`;
    return { from, to: `${t.role} A/c`, kind: 'RECEIPT' as const };
  }
  // party_name = the real person behind the category (e.g. which supervisor was paid)
  const to = t.party_name || t.category;
  if (ROLE_PARTIES.includes(t.category)) {
    return { from: `${t.role} A/c`, to, kind: 'TRANSFER' as const };
  }
  return { from: `${t.role} A/c`, to, kind: 'PAYMENT' as const };
};

const KIND_STYLES = {
  RECEIPT: { voucher: 'Receipt', color: COLORS.success, bg: 'rgba(21, 128, 61, 0.1)' },
  TRANSFER: { voucher: 'Contra', color: '#CB202D', bg: 'rgba(29, 78, 216, 0.08)' },
  PAYMENT: { voucher: 'Payment', color: COLORS.primary, bg: 'rgba(226, 26, 18, 0.08)' },
};

const drCr = (net: number) => `${rupees(Math.abs(net))} ${net >= 0 ? 'Cr' : 'Dr'}`;

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AccountsBookScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<BookTab>('DASHBOARD');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const [dashboardSummary, setDashboardSummary] = useState<any>(null);

  const [dayBook, setDayBook] = useState<any[]>([]);
  const [dayFlowFilter, setDayFlowFilter] = useState<'ALL' | 'DEBIT' | 'CREDIT'>('ALL');
  
  const todayStr = getTodayStr();
  const [dbFrom, setDbFrom] = useState(todayStr);
  const [dbRange, setDbRange] = useState<{ from?: string; to?: string }>({ from: todayStr });
  
  // Ledger date filter range states
  const [ldFrom, setLdFrom] = useState(todayStr);
  const [ldRange, setLdRange] = useState<{ from?: string; to?: string }>({ from: todayStr });

  const [ledger, setLedger] = useState<any[]>([]);
  const [periods, setPeriods] = useState<{ months: string[]; years: string[] }>({ months: [], years: [] });
  const [reportType, setReportType] = useState<'monthly' | 'yearly'>('monthly');
  const [reportPeriod, setReportPeriod] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [activeTransaction, setActiveTransaction] = useState<any>(null);

  const loadTab = async (target: BookTab = tab, range?: { from?: string; to?: string }) => {
    setLoading(true);
    try {
      if (target === 'DASHBOARD') {
        setDashboardSummary(await accountsService.getTotalSummary());
      } else if (target === 'DAYBOOK') {
        const activeRange = range !== undefined ? range : dbRange;
        const data = await accountsService.getDayBook(activeRange.from, activeRange.to);
        setDayBook(data);
      } else if (target === 'LEDGER') {
        const activeRange = range !== undefined ? range : ldRange;
        const data = await accountsService.getLedger(activeRange.from, activeRange.to);
        setLedger(data);
      } else {
        const p = await accountsService.getPeriods();
        setPeriods(p);
        const available = reportType === 'monthly' ? p.months : p.years;
        const selected = reportPeriod && available.includes(reportPeriod) ? reportPeriod : available[0] || null;
        setReportPeriod(selected);
        setReport(selected ? await accountsService.getReport(reportType, selected) : null);
      }
    } catch {
      Alert.alert('Data Error', 'Unable to load accounts data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTab(tab);
  }, [tab]);

  const switchReportType = async (type: 'monthly' | 'yearly') => {
    setReportType(type);
    const available = type === 'monthly' ? periods.months : periods.years;
    const selected = available[0] || null;
    setReportPeriod(selected);
    if (!selected) {
      setReport(null);
      return;
    }
    setLoading(true);
    try {
      setReport(await accountsService.getReport(type, selected));
    } catch {
      Alert.alert('Data Error', 'Unable to load the report.');
    } finally {
      setLoading(false);
    }
  };

  const selectPeriod = async (period: string) => {
    setReportPeriod(period);
    setLoading(true);
    try {
      setReport(await accountsService.getReport(reportType, period));
    } catch {
      Alert.alert('Data Error', 'Unable to load the report.');
    } finally {
      setLoading(false);
    }
  };

  const applyDayBookRange = () => {
    const dateOk = (v: string) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v);
    if (!dateOk(dbFrom)) {
      Alert.alert('Invalid Date', 'Use the YYYY-MM-DD format, e.g., 2026-07-01.');
      return;
    }
    const range = { from: dbFrom || undefined };
    setDbRange(range);
    loadTab('DAYBOOK', range);
  };

  const clearDayBookRange = () => {
    setDbFrom('');
    setDbRange({});
    loadTab('DAYBOOK', {});
  };

  // Credit/Debit filter applied on top of the loaded (date-filtered) day book
  const filteredDayBook = useMemo(() => {
    if (dayFlowFilter === 'DEBIT') return dayBook.filter((t) => t.flow === 'OUT');
    if (dayFlowFilter === 'CREDIT') return dayBook.filter((t) => t.flow === 'IN');
    return dayBook;
  }, [dayBook, dayFlowFilter]);

  const dayBookTotals = useMemo(
    () => ({
      debit: dayBook.filter((t) => t.flow === 'OUT').reduce((s, t) => s + Number(t.amount), 0),
      credit: dayBook.filter((t) => t.flow === 'IN').reduce((s, t) => s + Number(t.amount), 0),
    }),
    [dayBook]
  );

  const dayBookSections = useMemo(() => {
    const map = new Map<string, any[]>();
    filteredDayBook.forEach((t) => {
      const day = t.date.toString().split('T')[0];
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(t);
    });
    return Array.from(map.entries());
  }, [filteredDayBook]);

  // ---------- PDF ----------
  const periodTitle = report ? (report.type === 'monthly' ? monthLabel(report.period) : `Year ${report.period}`) : '';

  const buildAccountsReportPdfDoc = () => {
    const txns = report?.transactions || [];
    const totalDebit = txns.filter((t: any) => t.flow === 'OUT').reduce((s: number, t: any) => s + Number(t.amount), 0);
    const totalCredit = txns.filter((t: any) => t.flow === 'IN').reduce((s: number, t: any) => s + Number(t.amount), 0);

    const tables: ReportTable[] = [
      {
        title: `Day Book Vouchers (${txns.length})`,
        head: ['#', 'Date', 'Voucher', 'Particulars', 'Reason / Note', 'Debit (Rs)', 'Credit (Rs)'],
        body: txns.map((t: any, index: number) => {
          const info = describeTxn(t);
          const kind = KIND_STYLES[info.kind];
          return [
            index + 1,
            dateLabel(t.date),
            kind.voucher,
            `${info.from} → ${info.to}`,
            t.description || '-',
            t.flow === 'OUT' ? Number(t.amount).toLocaleString('en-IN') : '',
            t.flow === 'IN' ? Number(t.amount).toLocaleString('en-IN') : '',
          ];
        }),
        foot: ['', '', '', '', 'TOTAL', totalDebit.toLocaleString('en-IN'), totalCredit.toLocaleString('en-IN')],
        columnStyles: { 5: { halign: 'right' }, 6: { halign: 'right' } },
      },
    ];

    if (report?.receivedBreakdown?.length) {
      tables.unshift({
        title: 'Money Received From',
        head: ['Party', 'Amount (Rs)'],
        body: report.receivedBreakdown.map((b: any) => [b.category, Number(b.total).toLocaleString('en-IN')]),
        columnStyles: { 1: { halign: 'right' } },
      });
    }
    if (report?.paidBreakdown?.length) {
      tables.splice(report?.receivedBreakdown?.length ? 1 : 0, 0, {
        title: 'Money Paid To',
        head: ['Party', 'Amount (Rs)'],
        body: report.paidBreakdown.map((b: any) => [b.category, Number(b.total).toLocaleString('en-IN')]),
        columnStyles: { 1: { halign: 'right' } },
      });
    }

    return buildPdfReport({
      filename: `Accounts_Report_${periodTitle.replace(/\s+/g, '_')}.pdf`,
      title: 'Accounts Report',
      subtitle: periodTitle,
      summaryBoxes: [
        { label: 'Revenue', value: rupees(report?.revenue), color: '#8C0F16' },
        { label: 'Expenses', value: rupees(report?.expenses), color: '#E23744' },
        { label: Number(report?.profit || 0) >= 0 ? 'Profit' : 'Loss', value: rupees(Math.abs(Number(report?.profit || 0))) },
        { label: 'Internal Transfers', value: rupees(report?.transfers) },
      ],
      tables,
    });
  };

  const handleDownloadPdf = async () => {
    if (!report || (report.transactions || []).length === 0) {
      Alert.alert('No Data', 'There are no transactions in this period.');
      return;
    }
    setGeneratingPdf(true);
    try {
      await downloadPdfReport(await buildAccountsReportPdfDoc());
    } catch (error: any) {
      Alert.alert('PDF Error', error?.message || 'Unable to generate the report PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (!report || (report.transactions || []).length === 0) {
      Alert.alert('No Data', 'There are no transactions in this period.');
      return;
    }
    setGeneratingPdf(true);
    try {
      const summary =
        `*Ayyanar Construction - Accounts Report*\n` +
        `Period: ${periodTitle}\n` +
        `Revenue: ${rupees(report.revenue)}\n` +
        `Expenses: ${rupees(report.expenses)}\n` +
        `${report.profit >= 0 ? 'Profit' : 'Loss'}: ${rupees(Math.abs(report.profit))}\n` +
        `Transactions: ${report.transactions.length}`;
      await sharePdfReportOnWhatsApp(await buildAccountsReportPdfDoc(), summary);
    } catch (error: any) {
      Alert.alert('Share Error', error?.message || 'Unable to share the report.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // ---------- Day Book PDF report ----------
  const dayBookRangeLabel = () =>
    dbRange.from && dbRange.to
      ? `Period: ${dateLabel(dbRange.from)} to ${dateLabel(dbRange.to)}`
      : dbRange.from
      ? `Date: ${dateLabel(dbRange.from)}`
      : dbRange.to
      ? `Date: ${dateLabel(dbRange.to)}`
      : 'All Time';

  const buildDayBookPdfDoc = () => {
    const txns = filteredDayBook;
    const totalDebit = txns.filter((t: any) => t.flow === 'OUT').reduce((s: number, t: any) => s + Number(t.amount), 0);
    const totalCredit = txns.filter((t: any) => t.flow === 'IN').reduce((s: number, t: any) => s + Number(t.amount), 0);
    const rangeLabel = dbRange.from && dbRange.to ? `${dbRange.from}_to_${dbRange.to}` : dbRange.from || dbRange.to || 'all_time';

    return buildPdfReport({
      filename: `DayBook_Report_${rangeLabel}.pdf`,
      title: 'Accounts Day Book',
      subtitle: dayBookRangeLabel(),
      tables: [
        {
          head: ['#', 'Date', 'Voucher', 'Particulars', 'Reason / Note', 'Debit (Rs)', 'Credit (Rs)'],
          body: txns.map((t: any, index: number) => {
            const info = describeTxn(t);
            const kind = KIND_STYLES[info.kind];
            return [
              index + 1,
              dateLabel(t.date),
              kind.voucher,
              `${info.from} → ${info.to}`,
              t.description || '-',
              t.flow === 'OUT' ? Number(t.amount).toLocaleString('en-IN') : '',
              t.flow === 'IN' ? Number(t.amount).toLocaleString('en-IN') : '',
            ];
          }),
          foot: ['', '', '', '', 'TOTAL', totalDebit.toLocaleString('en-IN'), totalCredit.toLocaleString('en-IN')],
          columnStyles: { 5: { halign: 'right' }, 6: { halign: 'right' } },
        },
      ],
    });
  };

  const handleDownloadDayBook = async () => {
    if (filteredDayBook.length === 0) {
      Alert.alert('No Data', 'There are no transactions in the selected range.');
      return;
    }
    setGeneratingPdf(true);
    try {
      await downloadPdfReport(await buildDayBookPdfDoc());
    } catch (error: any) {
      Alert.alert('PDF Error', error?.message || 'Unable to generate day book PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleShareDayBookWhatsApp = async () => {
    if (filteredDayBook.length === 0) {
      Alert.alert('No Data', 'There are no transactions in the selected range.');
      return;
    }
    setGeneratingPdf(true);
    try {
      const summary =
        `*Ayyanar Construction - Day Book Report*\n` +
        `Period: ${dayBookRangeLabel()}\n` +
        `Total Debit: ${rupees(dayBookTotals.debit)}\n` +
        `Total Credit: ${rupees(dayBookTotals.credit)}\n` +
        `Vouchers: ${filteredDayBook.length}`;
      await sharePdfReportOnWhatsApp(await buildDayBookPdfDoc(), summary);
    } catch (error: any) {
      Alert.alert('Share Error', error?.message || 'Unable to share day book report.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // ---------- Ledger PDF report ----------
  const ledgerRangeLabel = () =>
    ldRange.from && ldRange.to
      ? `Period: ${dateLabel(ldRange.from)} to ${dateLabel(ldRange.to)}`
      : ldRange.from
      ? `Date: ${dateLabel(ldRange.from)}`
      : ldRange.to
      ? `Date: ${dateLabel(ldRange.to)}`
      : 'All Time';

  const buildLedgerPdfDoc = () => {
    const rangeLabel = ldRange.from && ldRange.to ? `${ldRange.from}_to_${ldRange.to}` : ldRange.from || ldRange.to || 'all_time';

    return buildPdfReport({
      filename: `Ledger_Summary_${rangeLabel}.pdf`,
      title: 'Accounts Ledger Summary',
      subtitle: ledgerRangeLabel(),
      tables: [
        {
          head: ['#', 'Party / Account Name', 'Debit (Paid, Rs)', 'Credit (Received, Rs)', 'Net Balance', 'Vouchers', 'Last Transaction'],
          body: ledger.map((item: any, index: number) => [
            index + 1,
            `${item.party}${item.category && item.party !== item.category ? ` (${item.category})` : ''}`,
            Number(item.paidTo).toLocaleString('en-IN'),
            Number(item.receivedFrom).toLocaleString('en-IN'),
            drCr(item.net),
            item.entries,
            item.lastDate ? dateLabel(item.lastDate) : '-',
          ]),
          columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'center' }, 6: { halign: 'center' } },
        },
      ],
    });
  };

  const handleDownloadLedger = async () => {
    if (ledger.length === 0) {
      Alert.alert('No Data', 'There are no ledger entries to export.');
      return;
    }
    setGeneratingPdf(true);
    try {
      await downloadPdfReport(await buildLedgerPdfDoc());
    } catch (error: any) {
      Alert.alert('PDF Error', error?.message || 'Unable to generate ledger PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleShareLedgerWhatsApp = async () => {
    if (ledger.length === 0) {
      Alert.alert('No Data', 'There are no ledger entries to share.');
      return;
    }
    setGeneratingPdf(true);
    try {
      const summary =
        `*Ayyanar Construction - Ledger Summary Report*\n` +
        `Period: ${ledgerRangeLabel()}\n` +
        `Ledger Accounts: ${ledger.length}`;
      await sharePdfReportOnWhatsApp(await buildLedgerPdfDoc(), summary);
    } catch (error: any) {
      Alert.alert('Share Error', error?.message || 'Unable to share ledger report.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // ---------- Renderers ----------
  const renderDashboard = () => {
    const profitPositive = Number(dashboardSummary?.profit || 0) >= 0;
    return (
      <View>
        <Text style={styles.screenTitle}>Dashboard</Text>
        <Text style={styles.screenSubtitle}>Company-wide money picture — Owner, Admin and Supervisor books combined.</Text>

        <View style={styles.statRow}>
          <View style={[styles.statCard, { backgroundColor: 'rgba(21, 128, 61, 0.08)' }]}>
            <Text style={[styles.statValue, { color: COLORS.success }]}>{rupees(dashboardSummary?.revenue)}</Text>
            <Text style={styles.statLabel}>Revenue</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: 'rgba(226, 26, 18, 0.06)' }]}>
            <Text style={[styles.statValue, { color: COLORS.primary }]}>{rupees(dashboardSummary?.expenses)}</Text>
            <Text style={styles.statLabel}>Expenses</Text>
          </View>
        </View>

        <View style={[styles.profitCard, { backgroundColor: profitPositive ? COLORS.success : COLORS.primary }]}>
          <View>
            <Text style={styles.profitLabel}>{profitPositive ? 'Profit' : 'Loss'} — Lifetime</Text>
            <Text style={styles.profitValue}>{rupees(Math.abs(Number(dashboardSummary?.profit || 0)))}</Text>
          </View>
          <MaterialIcons name={profitPositive ? 'savings' : 'warning'} size={30} color={COLORS.white} />
        </View>

        <Text style={styles.sectionTitle}>Cash in Hand (By Role)</Text>
        <View style={styles.card}>
          {(dashboardSummary?.roleBalances || []).map((item: any) => (
            <View key={item.role} style={styles.breakdownRow}>
              <View>
                <Text style={styles.breakdownName}>{item.role}</Text>
                <Text style={styles.bookMeta}>In: {rupees(item.totalIn)} · Out: {rupees(item.totalOut)}</Text>
              </View>
              <Text style={[styles.breakdownAmount, { color: COLORS.text }]}>{rupees(item.balance)}</Text>
            </View>
          ))}
          {(!dashboardSummary?.roleBalances || dashboardSummary.roleBalances.length === 0) && (
            <Text style={styles.emptyText}>No role balances yet.</Text>
          )}
        </View>
      </View>
    );
  };

  const renderDayBook = () => (
    <View>
      <Text style={styles.screenTitle}>Day Book</Text>
      <Text style={styles.screenSubtitle}>All vouchers across Owner, Admin and Supervisor books — recorded automatically as Debit and Credit, day by day.</Text>

      {/* Date picker */}
      <View style={styles.card}>
        <Text style={styles.filterLabel}>SELECT DATE</Text>
        <DatePickerField placeholder="Select date" value={dbFrom} onChange={setDbFrom} />
        <View style={styles.dateActions}>
          <TouchableOpacity style={styles.applyButton} onPress={applyDayBookRange}>
            <MaterialIcons name="filter-alt" size={16} color={COLORS.white} />
            <Text style={styles.applyButtonText}>Apply</Text>
          </TouchableOpacity>
          {dbRange.from && (
            <TouchableOpacity style={styles.clearButton} onPress={clearDayBookRange}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Total Debit / Total Credit for the selected range */}
      <View style={styles.totalsRow}>
        <View style={[styles.totalsCard, { backgroundColor: 'rgba(226, 26, 18, 0.06)' }]}>
          <Text style={[styles.totalsValue, { color: COLORS.primary }]}>{rupees(dayBookTotals.debit)}</Text>
          <Text style={styles.totalsLabel}>Total Debit</Text>
        </View>
        <View style={[styles.totalsCard, { backgroundColor: 'rgba(21, 128, 61, 0.08)' }]}>
          <Text style={[styles.totalsValue, { color: COLORS.success }]}>{rupees(dayBookTotals.credit)}</Text>
          <Text style={styles.totalsLabel}>Total Credit</Text>
        </View>
      </View>

      <View style={styles.pdfActionsRow}>
        <TouchableOpacity style={[styles.pdfButton, generatingPdf && { opacity: 0.6 }]} onPress={handleDownloadDayBook} disabled={generatingPdf}>
          {generatingPdf ? <ActivityIndicator color={COLORS.white} size="small" /> : <MaterialIcons name="picture-as-pdf" size={18} color={COLORS.white} />}
          <Text style={styles.pdfButtonText}>Download Day Book</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pdfButton, styles.whatsappButton, generatingPdf && { opacity: 0.6 }]} onPress={handleShareDayBookWhatsApp} disabled={generatingPdf}>
          <MaterialIcons name="share" size={18} color={COLORS.white} />
          <Text style={styles.pdfButtonText}>Share on WhatsApp</Text>
        </TouchableOpacity>
      </View>

      {/* Credit / Debit separation */}
      <View style={styles.flowFilterRow}>
        {(['ALL', 'DEBIT', 'CREDIT'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.flowFilterButton,
              dayFlowFilter === f && {
                backgroundColor: f === 'DEBIT' ? COLORS.primary : f === 'CREDIT' ? COLORS.success : COLORS.headerBackground,
                borderColor: 'transparent',
              },
            ]}
            onPress={() => setDayFlowFilter(f)}
          >
            <Text style={[styles.flowFilterText, dayFlowFilter === f && { color: COLORS.white }]}>
              {f === 'ALL' ? 'All' : f === 'DEBIT' ? 'Debit' : 'Credit'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {dayBookSections.map(([day, items]) => {
        const dayCredit = items.filter((t) => t.flow === 'IN').reduce((s, t) => s + Number(t.amount), 0);
        const dayDebit = items.filter((t) => t.flow === 'OUT').reduce((s, t) => s + Number(t.amount), 0);
        return (
          <View key={day}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayHeaderDate}>{dateLabel(day)}</Text>
              <Text style={styles.dayHeaderTotals}>
                <Text style={{ color: COLORS.primary }}>Dr {Number(dayDebit).toLocaleString('en-IN')}</Text>
                {'   '}
                <Text style={{ color: COLORS.success }}>Cr {Number(dayCredit).toLocaleString('en-IN')}</Text>
              </Text>
            </View>
            <View style={styles.card}>
              <BookColumnsHeader />
              {items.map((t: any) => <BookRow key={t.id} txn={t} onPress={() => { setActiveTransaction(t); setDetailsVisible(true); }} />)}
            </View>
          </View>
        );
      })}
      {dayBookSections.length === 0 && !loading && (
        <View style={styles.card}><Text style={styles.emptyText}>No {dayFlowFilter === 'ALL' ? '' : dayFlowFilter.toLowerCase() + ' '}vouchers in this range.</Text></View>
      )}
    </View>
  );

  const renderLedger = () => (
    <View>
      <Text style={styles.screenTitle}>Ledger</Text>
      <Text style={styles.screenSubtitle}>Party-wise ledger accounts with Debit, Credit and closing balance.</Text>

      {/* Date picker for Ledger */}
      <View style={styles.card}>
        <Text style={styles.filterLabel}>SELECT DATE</Text>
        <DatePickerField placeholder="Select date" value={ldFrom} onChange={setLdFrom} />
        <View style={styles.dateActions}>
          <TouchableOpacity style={styles.applyButton} onPress={() => {
            const range = { from: ldFrom || undefined };
            setLdRange(range);
            loadTab('LEDGER', range);
          }}>
            <MaterialIcons name="filter-alt" size={16} color={COLORS.white} />
            <Text style={styles.applyButtonText}>Apply</Text>
          </TouchableOpacity>
          {ldRange.from && (
            <TouchableOpacity style={styles.clearButton} onPress={() => {
              setLdFrom('');
              setLdRange({});
              loadTab('LEDGER', {});
            }}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.pdfActionsRow}>
        <TouchableOpacity style={[styles.pdfButton, generatingPdf && { opacity: 0.6 }]} onPress={handleDownloadLedger} disabled={generatingPdf}>
          {generatingPdf ? <ActivityIndicator color={COLORS.white} size="small" /> : <MaterialIcons name="picture-as-pdf" size={18} color={COLORS.white} />}
          <Text style={styles.pdfButtonText}>Download Ledger</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pdfButton, styles.whatsappButton, generatingPdf && { opacity: 0.6 }]} onPress={handleShareLedgerWhatsApp} disabled={generatingPdf}>
          <MaterialIcons name="share" size={18} color={COLORS.white} />
          <Text style={styles.pdfButtonText}>Share on WhatsApp</Text>
        </TouchableOpacity>
      </View>

      {ledger.map((item: any) => (
        <View key={`${item.category}-${item.party}`} style={styles.ledgerCard}>
          <View style={styles.ledgerHeader}>
            <View style={styles.partyAvatar}>
              <Text style={styles.partyAvatarText}>{item.party.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.partyName}>
                {item.party}
                {item.party !== item.category && item.category === 'Supervisors' ? '  (Supervisor)' : ROLE_PARTIES.includes(item.category) && item.party === item.category ? '  (Internal)' : ''}
              </Text>
              <Text style={styles.partyMeta}>{item.entries} voucher{item.entries === 1 ? '' : 's'} • Last on {dateLabel(item.lastDate)}</Text>
            </View>
            <View style={[styles.closingPill, { backgroundColor: item.net >= 0 ? 'rgba(21, 128, 61, 0.1)' : 'rgba(226, 26, 18, 0.08)' }]}>
              <Text style={[styles.closingPillText, { color: item.net >= 0 ? COLORS.success : COLORS.primary }]}>{drCr(item.net)}</Text>
            </View>
          </View>
          <View style={styles.ledgerNumbers}>
            <View style={styles.ledgerNumber}>
              <Text style={styles.ledgerNumberLabel}>Debit (Paid)</Text>
              <Text style={[styles.ledgerNumberValue, { color: COLORS.primary }]}>{rupees(item.paidTo)}</Text>
            </View>
            <View style={styles.ledgerNumber}>
              <Text style={styles.ledgerNumberLabel}>Credit (Received)</Text>
              <Text style={[styles.ledgerNumberValue, { color: COLORS.success }]}>{rupees(item.receivedFrom)}</Text>
            </View>
            <View style={styles.ledgerNumber}>
              <Text style={styles.ledgerNumberLabel}>Closing Balance</Text>
              <Text style={[styles.ledgerNumberValue, { color: item.net >= 0 ? COLORS.success : COLORS.primary }]}>{drCr(item.net)}</Text>
            </View>
          </View>
        </View>
      ))}
      {ledger.length === 0 && !loading && (
        <View style={styles.card}><Text style={styles.emptyText}>No ledger entries yet.</Text></View>
      )}
    </View>
  );

  const renderReports = () => {
    const availablePeriods = reportType === 'monthly' ? periods.months : periods.years;
    return (
      <View>
        <Text style={styles.screenTitle}>Reports</Text>
        <Text style={styles.screenSubtitle}>Monthly and yearly statements with PDF download and sharing.</Text>

        <View style={styles.toggleRow}>
          {(['monthly', 'yearly'] as const).map((type) => (
            <TouchableOpacity key={type} style={[styles.toggleButton, reportType === type && styles.toggleButtonActive]} onPress={() => switchReportType(type)}>
              <Text style={[styles.toggleText, reportType === type && styles.toggleTextActive]}>{type === 'monthly' ? 'Monthly' : 'Yearly'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }}>
          <View style={styles.chipRow}>
            {availablePeriods.map((p) => (
              <TouchableOpacity key={p} style={[styles.chip, reportPeriod === p && styles.chipActive]} onPress={() => selectPeriod(p)}>
                <Text style={[styles.chipText, reportPeriod === p && styles.chipTextActive]}>
                  {reportType === 'monthly' ? monthLabel(p) : p}
                </Text>
              </TouchableOpacity>
            ))}
            {availablePeriods.length === 0 && <Text style={styles.emptyText}>No periods with data yet.</Text>}
          </View>
        </ScrollView>

        {report && (
          <>
            <View style={styles.statRow}>
              <View style={[styles.statCard, { backgroundColor: 'rgba(21, 128, 61, 0.08)' }]}>
                <Text style={[styles.statValue, { color: COLORS.success }]}>{rupees(report.revenue)}</Text>
                <Text style={styles.statLabel}>Revenue</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: 'rgba(226, 26, 18, 0.06)' }]}>
                <Text style={[styles.statValue, { color: COLORS.primary }]}>{rupees(report.expenses)}</Text>
                <Text style={styles.statLabel}>Expenses</Text>
              </View>
            </View>

            <View style={[styles.profitCard, { backgroundColor: report.profit >= 0 ? COLORS.success : COLORS.primary }]}>
              <View>
                <Text style={styles.profitLabel}>{report.profit >= 0 ? 'Profit' : 'Loss'} — {periodTitle}</Text>
                <Text style={styles.profitValue}>{rupees(Math.abs(report.profit))}</Text>
              </View>
              <MaterialIcons name={report.profit >= 0 ? 'savings' : 'warning'} size={30} color={COLORS.white} />
            </View>
            <Text style={styles.transferNote}>Internal transfers this period: {rupees(report.transfers)} (not counted in revenue or expenses)</Text>

            <View style={styles.pdfActionsRow}>
              <TouchableOpacity style={[styles.pdfButton, generatingPdf && { opacity: 0.6 }]} onPress={handleDownloadPdf} disabled={generatingPdf}>
                {generatingPdf ? <ActivityIndicator color={COLORS.white} size="small" /> : <MaterialIcons name="picture-as-pdf" size={18} color={COLORS.white} />}
                <Text style={styles.pdfButtonText}>Download PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pdfButton, styles.whatsappButton, generatingPdf && { opacity: 0.6 }]} onPress={handleShareWhatsApp} disabled={generatingPdf}>
                <MaterialIcons name="share" size={18} color={COLORS.white} />
                <Text style={styles.pdfButtonText}>Share on WhatsApp</Text>
              </TouchableOpacity>
            </View>

            {report.receivedBreakdown.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Money Received From</Text>
                <View style={styles.card}>
                  {report.receivedBreakdown.map((b: any) => (
                    <View key={`rec-${b.category}`} style={styles.breakdownRow}>
                      <Text style={styles.breakdownName}>{b.category}</Text>
                      <Text style={[styles.breakdownAmount, { color: COLORS.success }]}>{rupees(b.total)}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {report.paidBreakdown.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Money Paid To</Text>
                <View style={styles.card}>
                  {report.paidBreakdown.map((b: any) => (
                    <View key={`paid-${b.category}`} style={styles.breakdownRow}>
                      <Text style={styles.breakdownName}>{b.category}{ROLE_PARTIES.includes(b.category) ? '  (Transfer)' : ''}</Text>
                      <Text style={[styles.breakdownAmount, { color: COLORS.primary }]}>{rupees(b.total)}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.sectionTitle}>Vouchers ({report.transactions.length})</Text>
            <View style={styles.card}>
              <BookColumnsHeader />
              {report.transactions.map((t: any) => <BookRow key={t.id} txn={t} showDate onPress={() => { setActiveTransaction(t); setDetailsVisible(true); }} />)}
              {report.transactions.length === 0 && <Text style={styles.emptyText}>No transactions in this period.</Text>}
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.outer}>
      <Stack.Screen options={{ title: 'Accounts' }} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTab(); }} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
      >
        {loading && !refreshing ? <ActivityIndicator color={COLORS.primary} style={{ marginBottom: SPACING.md }} /> : null}
        {tab === 'DASHBOARD' && renderDashboard()}
        {tab === 'DAYBOOK' && renderDayBook()}
        {tab === 'LEDGER' && renderLedger()}
        {tab === 'REPORTS' && renderReports()}
      </ScrollView>

      {/* Bottom menu */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 10 }]}>
        {bottomTabs.map((item) => {
          const active = tab === item.id;
          return (
            <TouchableOpacity key={item.id} style={styles.bottomItem} onPress={() => setTab(item.id)}>
              <MaterialIcons name={item.icon} size={24} color={active ? COLORS.primary : COLORS.textLight} />
              <Text style={[styles.bottomLabel, active && { color: COLORS.primary }]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Transaction Details Modal */}
      <Modal visible={detailsVisible} transparent animationType="fade" onRequestClose={() => setDetailsVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { maxHeight: '85%' }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Transaction Details</Text>
            
            {activeTransaction && (() => {
              const info = describeTxn(activeTransaction);
              return (
                <View style={styles.detailsContainer}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>DATE</Text>
                    <Text style={styles.detailValue}>{dateLabel(activeTransaction.date)}</Text>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>TYPE</Text>
                    <View style={[styles.voucherBadge, { backgroundColor: KIND_STYLES[info.kind].bg, alignSelf: 'flex-start' }]}>
                      <Text style={[styles.voucherBadgeText, { color: KIND_STYLES[info.kind].color }]}>
                        {KIND_STYLES[info.kind].voucher}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>ROLE ACCOUNT</Text>
                    <Text style={styles.detailValue}>{activeTransaction.role}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>FROM</Text>
                    <Text style={styles.detailValue}>{info.from}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>TO</Text>
                    <Text style={styles.detailValue}>{info.to}</Text>
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

                  {activeTransaction.entered_by_name && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>ENTERED BY</Text>
                      <Text style={styles.detailValue}>{activeTransaction.entered_by_name}</Text>
                    </View>
                  )}
                </View>
              );
            })()}

            <TouchableOpacity style={[styles.cancelButton, { marginTop: 20, width: '100%' }]} onPress={() => setDetailsVisible(false)}>
              <Text style={styles.cancelButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Tally-style voucher row: particulars on the left, Debit and Credit columns on the right
function BookRow({ txn, showDate = false, onPress }: { txn: any; showDate?: boolean; onPress?: () => void }) {
  const info = describeTxn(txn);
  const kind = KIND_STYLES[info.kind];
  const isCredit = txn.flow === 'IN';
  return (
    <TouchableOpacity style={styles.bookRow} onPress={onPress} activeOpacity={0.7} disabled={!onPress}>
      <View style={{ flex: 1 }}>
        <View style={styles.voucherLine}>
          <View style={[styles.voucherBadge, { backgroundColor: kind.bg }]}>
            <Text style={[styles.voucherBadgeText, { color: kind.color }]}>{kind.voucher}</Text>
          </View>
          {showDate && <Text style={styles.bookMeta}>{dateLabel(txn.date)}</Text>}
        </View>
        <Text style={styles.bookTitle}>{info.from}  →  {info.to}</Text>
        <Text style={styles.bookMeta}>{txn.payment_method || 'Cash'}{txn.description ? ` / ${txn.description}` : ''}</Text>
        {txn.entered_by_name && <Text style={styles.bookMeta}>Entered by: {txn.entered_by_name}</Text>}
      </View>
      <Text style={[styles.amountCol, { color: isCredit ? COLORS.textLight : COLORS.primary }]}>
        {!isCredit ? Number(txn.amount).toLocaleString('en-IN') : ''}
      </Text>
      <Text style={[styles.amountCol, { color: isCredit ? COLORS.success : COLORS.textLight }]}>
        {isCredit ? Number(txn.amount).toLocaleString('en-IN') : ''}
      </Text>
    </TouchableOpacity>
  );
}

// Column header used above voucher rows (Particulars | Debit | Credit)
function BookColumnsHeader() {
  return (
    <View style={styles.bookColumnsHeader}>
      <Text style={[styles.bookColumnsText, { flex: 1, textAlign: 'left' }]}>Particulars</Text>
      <Text style={styles.bookColumnsText}>Debit</Text>
      <Text style={styles.bookColumnsText}>Credit</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
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
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
    paddingHorizontal: 2,
  },
  dayHeaderDate: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '900',
  },
  dayHeaderTotals: {
    fontSize: 11,
    fontWeight: '800',
  },
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.steel,
  },
  bookTitle: {
    color: COLORS.text,
    fontSize: 13.5,
    fontWeight: '900',
    marginTop: 3,
  },
  bookMeta: {
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 15,
  },
  voucherLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  amountCol: {
    width: 72,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
  bookColumnsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  bookColumnsText: {
    width: 72,
    color: COLORS.textLight,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    textAlign: 'right',
  },
  closingPill: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  closingPillText: {
    fontSize: 11,
    fontWeight: '900',
  },
  ledgerCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  ledgerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  partyAvatar: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: COLORS.headerBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partyAvatarText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '900',
  },
  partyName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
  },
  partyMeta: {
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  ledgerNumbers: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.steel,
    paddingTop: SPACING.sm,
  },
  ledgerNumber: {
    flex: 1,
  },
  ledgerNumberLabel: {
    color: COLORS.textLight,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  ledgerNumberValue: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 3,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.steel,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 4,
    marginBottom: SPACING.sm,
  },
  toggleButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.sm,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.primary,
  },
  toggleText: {
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: '900',
  },
  toggleTextActive: {
    color: COLORS.white,
  },
  chipRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingVertical: 2,
  },
  chip: {
    backgroundColor: COLORS.white,
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
  statRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  statLabel: {
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  profitCard: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profitLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  profitValue: {
    color: COLORS.white,
    fontSize: 25,
    fontWeight: '900',
    marginTop: 4,
  },
  transferNote: {
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: '600',
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
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
  sectionTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
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
    fontSize: 13.5,
    fontWeight: '800',
  },
  breakdownAmount: {
    fontSize: 13.5,
    fontWeight: '900',
  },
  emptyText: {
    color: COLORS.textLight,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
  filterLabel: {
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
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
  totalsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  totalsCard: {
    flex: 1,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: 3,
  },
  totalsValue: {
    fontSize: 17,
    fontWeight: '900',
  },
  totalsLabel: {
    color: COLORS.textLight,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  flowFilterRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  flowFilterButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  flowFilterText: {
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: '900',
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
  },
  bottomItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  bottomLabel: {
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: '800',
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
  cancelButton: {
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
});
