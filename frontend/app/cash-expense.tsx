import React, { useState, useEffect } from 'react';
import { ScrollView, Text, View, TextInput, TouchableOpacity, Alert, Linking, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fieldService, adminService } from '../services/api';
import DatePickerField from '../components/DatePickerField';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/Theme';

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function CashExpenseScreen() {
  const router = useRouter();
  const { siteId, siteName, userId } = useLocalSearchParams();
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayLocal());
  const [loading, setLoading] = useState(false);

  const [assignedSites, setAssignedSites] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(siteId ? siteId.toString() : null);
  const [selectedSiteName, setSelectedSiteName] = useState<string | null>(siteName ? siteName.toString() : null);

  useEffect(() => {
    const loadSites = async () => {
      try {
        const storedRole = await AsyncStorage.getItem('userRole');
        const storedUserId = await AsyncStorage.getItem('userId');

        let sitesData = [];
        if (storedRole === 'Admin' || storedRole === 'Accounts') {
          sitesData = await adminService.getSites();
        } else if (storedUserId) {
          sitesData = await fieldService.getSupervisorSites(storedUserId);
        }

        setAssignedSites(sitesData);
        if (sitesData.length > 0 && !selectedSiteId) {
          setSelectedSiteId(sitesData[0].id.toString());
          setSelectedSiteName(sitesData[0].name);
        }
      } catch (err) {
        console.error('Error loading sites for petty cash log:', err);
      }
    };
    loadSites();
  }, [userId]);

  const handleSiteChange = (val: string) => {
    setSelectedSiteId(val);
    const siteObj = assignedSites.find(s => s.id.toString() === val);
    if (siteObj) {
      setSelectedSiteName(siteObj.name);
    }
  };

  const sendToWhatsApp = (message: string) => {
    const phoneNumber = '919876543210'; // Replace with actual supervisor/admin number
    const url = `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert("WhatsApp Not Found", "Please install WhatsApp to send reports.");
      }
    });
  };

  const handleSave = async () => {
    if (!selectedSiteId) {
      Alert.alert('Error', 'Please select a project site.');
      return;
    }
    if (!description || !cost) {
      Alert.alert('Incomplete Fields', 'Please add an item description and cost.');
      return;
    }

    setLoading(true);
    try {
      const rawUserId = userId || await AsyncStorage.getItem('userId');
      const storedUserId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
      await fieldService.logExpense({
        siteId: selectedSiteId,
        userId: storedUserId,
        type: 'DEBIT',
        category: 'Petty Cash',
        description: description,
        amount: parseFloat(cost),
        date: expenseDate
      });

      const expenseMessage = `💸 *CASH EXPENSE REPORT*\n\n` +
        `📍 *Site:* ${selectedSiteName || 'Not Specified'}\n` +
        `📝 *Description:* ${description}\n` +
        `💰 *Amount:* ₹${cost}\n` +
        `📅 *Date:* ${new Date(expenseDate).toLocaleDateString('en-IN')}\n` +
        `✅ *Status:* Paid from Petty Cash & Logged to DB`;

      setLoading(false);
      Alert.alert('Expense Recorded', `₹${cost} logged into database and recorded.`, [
        { text: 'Send WhatsApp Report', onPress: () => {
          sendToWhatsApp(expenseMessage);
          router.back();
        }},
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', 'Failed to save expense to database.');
    }
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.body} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconWrap}>
              <MaterialIcons name="payments" size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Daily Cash Expense</Text>
              <Text style={styles.cardSubtitle}>Log a petty-cash spend for a project site</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>PROJECT SITE</Text>
          {assignedSites.length > 0 ? (
            <View style={styles.pickerWrap}>
              <Picker selectedValue={selectedSiteId || ''} onValueChange={handleSiteChange} style={styles.picker}>
                {assignedSites.map((site) => (
                  <Picker.Item key={site.id} label={site.name} value={site.id.toString()} />
                ))}
              </Picker>
            </View>
          ) : (
            <View style={styles.warningBox}>
              <MaterialIcons name="warning" size={16} color={COLORS.primary} />
              <Text style={styles.warningText}>No project sites found</Text>
            </View>
          )}

          <Text style={styles.sectionLabel}>EXPENSE DATE</Text>
          <DatePickerField value={expenseDate} onChange={setExpenseDate} placeholder="Expense date" style={styles.fieldSpacing} />

          <Text style={styles.sectionLabel}>ITEM DESCRIPTION</Text>
          <View style={styles.inputWrap}>
            <MaterialIcons name="edit-note" size={18} color={COLORS.textLight} style={styles.inputIcon} />
            <TextInput
              style={styles.inputField}
              placeholder="e.g. Tea & snacks for laborers, unloading tips"
              value={description}
              onChangeText={setDescription}
              placeholderTextColor={COLORS.textLight}
            />
          </View>

          <Text style={styles.sectionLabel}>AMOUNT PAID (₹)</Text>
          <View style={styles.inputWrap}>
            <MaterialIcons name="currency-rupee" size={18} color={COLORS.textLight} style={styles.inputIcon} />
            <TextInput
              style={styles.inputField}
              placeholder="0.00"
              keyboardType="numeric"
              value={cost}
              onChangeText={setCost}
              placeholderTextColor={COLORS.textLight}
            />
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleSave} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <MaterialIcons name="check-circle" size={19} color={COLORS.white} />
                <Text style={styles.primaryButtonText}>Save Cash Expense</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  body: {
    flex: 1,
  },
  content: {
    padding: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight,
    marginTop: 1,
  },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: COLORS.textLight,
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  fieldSpacing: {
    marginBottom: SPACING.md,
  },
  pickerWrap: {
    backgroundColor: COLORS.steel,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.tint,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  warningText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
  },
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
  inputIcon: {
    marginRight: 6,
  },
  inputField: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 15,
    marginTop: SPACING.xs,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 15,
  },
});
