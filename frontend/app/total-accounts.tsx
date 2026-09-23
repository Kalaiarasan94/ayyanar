import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { accountsService } from '../services/api';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/Theme';
import DatePickerField from '../components/DatePickerField';
import { buildPdfReport, downloadPdfReport, sharePdfReportOnWhatsApp } from '../services/pdfReport';

const rupees = (value: any) => `Rs ${Number(value || 0).toLocaleString('en-IN')}`;
const todayIso = () => new Date().toISOString().split('T')[0];

const monthLabel = (period: string) => {
  // '2026-07' -> 'Jul 2026'; plain years pass through
  const [year, month] = period.split('-');
  if (!month) return period;
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[parseInt(month) - 1]} ${year}`;
};

// Returns [firstDay, lastDay] (YYYY-MM-DD) of the calendar month containing dateStr.
const monthBounds = (dateStr: string): [string, string] => {
  const d = new Date(dateStr || todayIso());
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const toYMD = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  return [toYMD(first), toYMD(last)];
};

export default function TotalAccountsScreen() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [period, setPeriod] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [filterMode, setFilterMode] = useState<'ALL' | 'MONTH' | 'DURATION'>('ALL');
  const [monthPick, setMonthPick] = useState(todayIso());
  const [durFrom, setDurFrom] = useState('');
  const [durTo, setDurTo] = useState('');

  const loadSummary = async (from?: string, to?: string) => {
    setLoading(true);
    try {
      setSummary(await accountsService.getTotalSummary(from, to));
    } catch {
      Alert.alert('Data Error', 'Unable to load total accounts summary.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const applyFilter = (mode: 'ALL' | 'MONTH' | 'DURATION', mPick = monthPick, f = durFrom, t = durTo) => {
    setFilterMode(mode);
    if (mode === 'ALL') loadSummary();
    else if (mode === 'MONTH') loadSummary(...monthBounds(mPick));
    else if (f && t) loadSummary(f, t);
  };

  const rangeTitle =
    filterMode === 'MONTH'
      ? monthLabel(monthPick.slice(0, 7))
      : filterMode === 'DURATION' && durFrom && durTo
      ? `${new Date(durFrom).toLocaleDateString('en-IN')} to ${new Date(durTo).toLocaleDateString('en-IN')}`
      : 'Lifetime';

  const rows = (period === 'MONTHLY' ? summary?.monthly : summary?.yearly) || [];
  const profitPositive = Number(summary?.profit || 0) >= 0;

  const buildOverviewPdfDoc = () =>
    buildPdfReport({
      filename: `company-overview-${filterMode === 'ALL' ? 'lifetime' : rangeTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`,
      title: 'Company Financial Overview',
      subtitle: `Company-wide money picture — Owner, Admin and Supervisor books combined • ${rangeTitle}`,
      summaryBoxes: [
        { label: 'Revenue', value: rupees(summary?.revenue), color: '#15803d' },
        { label: 'Expenses', value: rupees(summary?.expenses), color: '#E23744' },
        { label: profitPositive ? 'Profit' : 'Loss', value: rupees(Math.abs(Number(summary?.profit || 0))) },
      ],
      tables: [
        {
          title: 'Cash in Hand (By Role)',
          head: ['Role', 'Received (Rs)', 'Paid (Rs)', 'Balance (Rs)'],
          body: (summary?.roleBalances || []).map((r: any) => [
            r.role,
            Number(r.totalIn).toLocaleString('en-IN'),
            Number(r.totalOut).toLocaleString('en-IN'),
            Number(r.balance).toLocaleString('en-IN'),
          ]),
          columnStyles: { 1: { halign: 'right' as const }, 2: { halign: 'right' as const }, 3: { halign: 'right' as const } },
        },
      ],
    });

  const handleDownloadPdf = async (viaWhatsApp: boolean) => {
    setGeneratingPdf(true);
    try {
      if (viaWhatsApp) {
        const summaryText =
          `*Ayyanar Construction - Company Overview*\n` +
          `Period: ${rangeTitle}\n` +
          `Revenue: ${rupees(summary?.revenue)}\n` +
          `Expenses: ${rupees(summary?.expenses)}\n` +
          `${profitPositive ? 'Profit' : 'Loss'}: ${rupees(Math.abs(Number(summary?.profit || 0)))}`;
        await sharePdfReportOnWhatsApp(await buildOverviewPdfDoc(), summaryText);
      } else {
        await downloadPdfReport(await buildOverviewPdfDoc());
      }
    } catch (error: any) {
      Alert.alert('PDF Error', error?.message || 'Unable to generate the overview report.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadSummary(); }} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
    >
      <Text style={styles.heading}>Total Accounts</Text>
      <Text style={styles.subheading}>Company-wide money picture — Owner, Admin and Supervisor books combined.</Text>

      <View style={styles.periodRow}>
        {(['ALL', 'MONTH', 'DURATION'] as const).map((m) => (
          <TouchableOpacity key={m} style={[styles.periodButton, filterMode === m && styles.periodButtonActive]} onPress={() => applyFilter(m)}>
            <Text style={[styles.periodText, filterMode === m && styles.periodTextActive]}>
              {m === 'ALL' ? 'All Time' : m === 'MONTH' ? 'Month' : 'Duration'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filterMode === 'MONTH' && (
        <View style={styles.dateRow}>
          <DatePickerField style={{ flex: 1 }} placeholder="Pick any date in the month" value={monthPick} onChange={(d) => { setMonthPick(d); applyFilter('MONTH', d); }} />
        </View>
      )}

      {filterMode === 'DURATION' && (
        <View style={styles.dateRow}>
          <DatePickerField style={{ flex: 1 }} placeholder="From date" value={durFrom} onChange={setDurFrom} />
          <DatePickerField style={{ flex: 1 }} placeholder="To date" value={durTo} onChange={setDurTo} />
          <TouchableOpacity style={styles.applyButton} onPress={() => applyFilter('DURATION')} disabled={!durFrom || !durTo}>
            <Text style={styles.applyButtonText}>Apply</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && !refreshing ? <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SPACING.lg }} /> : null}

      <View style={styles.pdfActionsRow}>
        <TouchableOpacity style={[styles.pdfButton, generatingPdf && { opacity: 0.6 }]} onPress={() => handleDownloadPdf(false)} disabled={generatingPdf || !summary}>
          {generatingPdf ? <ActivityIndicator color={COLORS.white} size="small" /> : <MaterialIcons name="picture-as-pdf" size={18} color={COLORS.white} />}
          <Text style={styles.pdfButtonText}>Download PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pdfButton, styles.whatsappButton, generatingPdf && { opacity: 0.6 }]} onPress={() => handleDownloadPdf(true)} disabled={generatingPdf || !summary}>
          <MaterialIcons name="share" size={18} color={COLORS.white} />
          <Text style={styles.pdfButtonText}>Share on WhatsApp</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statRow}>
        <View style={[styles.statCard, { backgroundColor: 'rgba(21, 128, 61, 0.08)' }]}>
          <MaterialIcons name="trending-up" size={20} color={COLORS.success} />
          <Text style={[styles.statValue, { color: COLORS.success }]}>{rupees(summary?.revenue)}</Text>
          <Text style={styles.statLabel}>Revenue ({rangeTitle})</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: 'rgba(226, 26, 18, 0.06)' }]}>
          <MaterialIcons name="trending-down" size={20} color={COLORS.primary} />
          <Text style={[styles.statValue, { color: COLORS.primary }]}>{rupees(summary?.expenses)}</Text>
          <Text style={styles.statLabel}>Expenses ({rangeTitle})</Text>
        </View>
      </View>

      <View style={[styles.profitCard, { backgroundColor: profitPositive ? COLORS.success : COLORS.primary }]}>
        <View>
          <Text style={styles.profitLabel}>{profitPositive ? 'Profit' : 'Loss'} — {rangeTitle}</Text>
          <Text style={styles.profitValue}>{rupees(Math.abs(Number(summary?.profit || 0)))}</Text>
        </View>
        <MaterialIcons name={profitPositive ? 'savings' : 'warning'} size={32} color={COLORS.white} />
      </View>

      <Text style={styles.note}>
        Revenue = money from Client, Govt & Loan. Expenses = site, petrol, company & personal spends.
        Money moved between Owner, Admin & Supervisors is not counted twice.
      </Text>

      <View style={styles.periodRow}>
        {(['MONTHLY', 'YEARLY'] as const).map((p) => (
          <TouchableOpacity key={p} style={[styles.periodButton, period === p && styles.periodButtonActive]} onPress={() => setPeriod(p)}>
            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{p === 'MONTHLY' ? 'Monthly' : 'Yearly'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 1.2, textAlign: 'left' }]}>{period === 'MONTHLY' ? 'Month' : 'Year'}</Text>
          <Text style={styles.tableHeaderText}>Revenue</Text>
          <Text style={styles.tableHeaderText}>Expenses</Text>
          <Text style={styles.tableHeaderText}>Profit</Text>
        </View>
        {rows.map((row: any) => (
          <View key={row.period} style={styles.tableRow}>
            <Text style={[styles.periodCell, { flex: 1.2 }]}>{monthLabel(row.period)}</Text>
            <Text style={[styles.amountCell, { color: COLORS.success }]}>{Number(row.revenue).toLocaleString('en-IN')}</Text>
            <Text style={[styles.amountCell, { color: COLORS.primary }]}>{Number(row.expenses).toLocaleString('en-IN')}</Text>
            <Text style={[styles.amountCell, { color: row.profit >= 0 ? COLORS.success : COLORS.primary, fontWeight: '900' }]}>
              {Number(row.profit).toLocaleString('en-IN')}
            </Text>
          </View>
        ))}
        {rows.length === 0 && <Text style={styles.emptyText}>No transactions recorded yet.</Text>}
      </View>

      <Text style={styles.sectionTitle}>Cash in Hand (By Role)</Text>
      <View style={styles.card}>
        {(summary?.roleBalances || []).map((item: any) => (
          <View key={item.role} style={styles.tableRow}>
            <Text style={[styles.periodCell, { flex: 1.2 }]}>{item.role}</Text>
            <Text style={[styles.amountCell, { color: COLORS.success }]}>{Number(item.totalIn).toLocaleString('en-IN')}</Text>
            <Text style={[styles.amountCell, { color: COLORS.primary }]}>{Number(item.totalOut).toLocaleString('en-IN')}</Text>
            <Text style={[styles.amountCell, { fontWeight: '900', color: COLORS.text }]}>{Number(item.balance).toLocaleString('en-IN')}</Text>
          </View>
        ))}
        {(!summary?.roleBalances || summary.roleBalances.length === 0) && <Text style={styles.emptyText}>No role balances yet.</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: 96,
  },
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
    fontSize: 19,
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
    marginBottom: SPACING.sm,
  },
  profitLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  profitValue: {
    color: COLORS.white,
    fontSize: 26,
    fontWeight: '900',
    marginTop: 4,
  },
  note: {
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    marginBottom: SPACING.md,
  },
  periodRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.steel,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 4,
    marginBottom: SPACING.sm,
  },
  periodButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.sm,
  },
  periodButtonActive: {
    backgroundColor: COLORS.primary,
  },
  periodText: {
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: '900',
  },
  periodTextActive: {
    color: COLORS.white,
  },
  dateRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    alignItems: 'center',
  },
  applyButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  applyButtonText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 13,
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
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableHeaderText: {
    flex: 1,
    color: COLORS.textLight,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.steel,
  },
  periodCell: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
  },
  amountCell: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    color: COLORS.textLight,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
});
