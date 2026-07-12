import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Alert, Linking, Platform, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fieldService } from '../services/api';
import AppBackground from './components/AppBackground';
import DatePickerField from '../components/DatePickerField';
import { COLORS, BORDER_RADIUS, SPACING } from '../constants/Theme';

interface Worker {
  id: string;
  name: string;
  role: string;
  status: 'Present' | 'Absent';
}

// Local calendar date (Indian day, not UTC)
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Alert.alert does nothing in web browsers — use window.alert there
const notify = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export default function AttendanceScreen() {
  const router = useRouter();
  const { siteId: paramSiteId, siteName: paramSiteName } = useLocalSearchParams();

  const [sites, setSites] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>((paramSiteId as string) || '');
  const [attendanceDate, setAttendanceDate] = useState(todayLocal());
  const [workerName, setWorkerName] = useState('');
  const [workerRole, setWorkerRole] = useState('');
  const [workersList, setWorkersList] = useState<Worker[]>([]);
  const [submittedList, setSubmittedList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Show what was already submitted for the selected site + date
  const loadSubmitted = async (siteId = selectedSiteId, date = attendanceDate) => {
    if (!siteId) return;
    try {
      setSubmittedList(await fieldService.getAttendanceBySite(siteId, date));
    } catch {
      setSubmittedList([]);
    }
  };

  useEffect(() => {
    loadSubmitted();
  }, [selectedSiteId, attendanceDate]);

  useEffect(() => {
    const loadSites = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (!userId) return;
        const sitesData = await fieldService.getSupervisorSites(userId);
        setSites(sitesData || []);
        if (!paramSiteId && sitesData?.length > 0) {
          setSelectedSiteId(sitesData[0].id.toString());
        }
      } catch (error) {
        console.log('Failed to load sites:', error);
      }
    };
    loadSites();
  }, []);

  const selectedSiteName =
    (paramSiteName as string) ||
    sites.find((s) => s.id.toString() === selectedSiteId)?.name ||
    'Site';

  const addWorker = () => {
    if (!workerName.trim() || !workerRole.trim()) {
      notify('Error', 'Please enter both worker name and role.');
      return;
    }
    setWorkersList([
      ...workersList,
      { id: Date.now().toString(), name: workerName.trim(), role: workerRole.trim(), status: 'Present' },
    ]);
    setWorkerName('');
    setWorkerRole('');
  };

  const removeWorker = (id: string) => {
    setWorkersList(workersList.filter((w) => w.id !== id));
  };

  const toggleStatus = (id: string, status: 'Present' | 'Absent') => {
    setWorkersList(workersList.map((w) => (w.id === id ? { ...w, status } : w)));
  };

  const sendToWhatsApp = (message: string) => {
    const phoneNumber = '919876543210';
    if (Platform.OS === 'web') {
      Linking.openURL(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`);
      return;
    }
    const url = `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        notify('WhatsApp Not Found', 'Please install WhatsApp to send reports.');
      }
    });
  };

  const handleSave = async () => {
    if (!selectedSiteId) {
      notify('Select Site', 'Please select a project site first.');
      return;
    }
    if (workersList.length === 0) {
      notify('Empty List', 'Please add at least one worker before submitting.');
      return;
    }

    setLoading(true);
    try {
      // Real names, roles, statuses and the picked date go to the database,
      // so this list appears in the Admin -> Attendance report immediately
      await fieldService.submitAttendance({
        siteId: selectedSiteId,
        date: attendanceDate,
        workers: workersList.map((w) => ({ name: w.name, role: w.role, status: w.status })),
      });

      const presentCount = workersList.filter((w) => w.status === 'Present').length;
      const absentCount = workersList.length - presentCount;
      const workerLines = workersList
        .map((w, i) => `${i + 1}. *${w.name}* (${w.role}) — ${w.status}`)
        .join('\n');
      const message =
        `👷 *DAILY ATTENDANCE REPORT*\n\n` +
        `📍 *Site:* ${selectedSiteName}\n` +
        `📅 *Date:* ${attendanceDate}\n` +
        `🟢 *Present:* ${presentCount}   🔴 *Absent:* ${absentCount}\n\n` +
        `✅ *WORKERS LIST:*\n${workerLines}`;

      setLoading(false);
      const savedCount = workersList.length;
      // Clear the roster and show what is now stored for this date
      setWorkersList([]);
      await loadSubmitted();

      if (Platform.OS === 'web') {
        const sendReport = window.confirm(
          `Attendance Submitted ✔\n\n${savedCount} worker(s) saved for ${attendanceDate}. The admin can now see this in Attendance.\n\nSend the WhatsApp report too?`
        );
        if (sendReport) sendToWhatsApp(message);
      } else {
        Alert.alert(
          'Attendance Submitted',
          `${savedCount} worker(s) saved for ${attendanceDate}. The admin can now see this in Attendance.`,
          [
            { text: 'Send WhatsApp Report', onPress: () => sendToWhatsApp(message) },
            { text: 'Done' },
          ]
        );
      }
    } catch (error: any) {
      setLoading(false);
      notify('Error', error?.message || 'Failed to save attendance to database.');
    }
  };

  const presentCount = workersList.filter((w) => w.status === 'Present').length;

  return (
    <View style={styles.outerContainer}>
      <AppBackground />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Site & date */}
        <View style={styles.addCard}>
          <Text style={styles.sectionTitle}>SITE & DATE</Text>

          {sites.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={styles.chipRow}>
                {sites.map((site) => (
                  <TouchableOpacity
                    key={site.id}
                    style={[styles.chip, selectedSiteId === site.id.toString() && styles.chipActive]}
                    onPress={() => setSelectedSiteId(site.id.toString())}
                  >
                    <Text style={[styles.chipText, selectedSiteId === site.id.toString() && styles.chipTextActive]}>
                      {site.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          ) : (
            <View style={styles.warningBox}>
              <MaterialIcons name="warning" size={16} color={COLORS.primary} />
              <Text style={styles.warningText}>No sites allocated to your account.</Text>
            </View>
          )}

          <DatePickerField value={attendanceDate} onChange={setAttendanceDate} placeholder="Attendance date" />
        </View>

        {/* Add worker */}
        <View style={styles.addCard}>
          <Text style={styles.sectionTitle}>ADD WORKER TO THE LIST</Text>

          <TextInput
            style={styles.textInput}
            placeholder="Worker Full Name"
            value={workerName}
            onChangeText={setWorkerName}
            placeholderTextColor="#8B7B80"
          />

          <TextInput
            style={styles.textInput}
            placeholder="Role (e.g. Mason, Helper)"
            value={workerRole}
            onChangeText={setWorkerRole}
            placeholderTextColor="#8B7B80"
          />

          <TouchableOpacity style={styles.addBtn} onPress={addWorker}>
            <Text style={styles.addBtnText}>+ ADD WORKER</Text>
          </TouchableOpacity>
        </View>

        {workersList.length > 0 && (
          <View style={styles.rosterSection}>
            <Text style={styles.rosterTitle}>
              ROSTER ({workersList.length}) — {presentCount} PRESENT / {workersList.length - presentCount} ABSENT
            </Text>
            {workersList.map((worker) => (
              <View key={worker.id} style={styles.rosterCard}>
                <View style={styles.avatarContainer}>
                  <MaterialIcons name="person" size={20} color="#E21A12" />
                </View>
                <View style={styles.workerInfo}>
                  <Text style={styles.workerName}>{worker.name}</Text>
                  <Text style={styles.workerRole}>{worker.role}</Text>
                </View>

                {/* Present / Absent toggle */}
                <View style={styles.statusToggle}>
                  <TouchableOpacity
                    style={[styles.statusBtn, worker.status === 'Present' && styles.statusBtnPresent]}
                    onPress={() => toggleStatus(worker.id, 'Present')}
                  >
                    <Text style={[styles.statusBtnText, worker.status === 'Present' && { color: '#FFF' }]}>P</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.statusBtn, worker.status === 'Absent' && styles.statusBtnAbsent]}
                    onPress={() => toggleStatus(worker.id, 'Absent')}
                  >
                    <Text style={[styles.statusBtnText, worker.status === 'Absent' && { color: '#FFF' }]}>A</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={() => removeWorker(worker.id)} style={styles.removeBtn}>
                  <MaterialIcons name="remove-circle-outline" size={22} color="#E21A12" />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitBtnText}>SUBMIT ATTENDANCE — {attendanceDate}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Attendance already stored for the selected date — date-wise view */}
        <View style={styles.rosterSection}>
          <Text style={styles.rosterTitle}>
            SUBMITTED FOR {attendanceDate} ({submittedList.length})
          </Text>
          {submittedList.map((item: any) => (
            <View key={item.id} style={styles.rosterCard}>
              <View style={[styles.avatarContainer, { backgroundColor: item.status === 'Present' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(226, 26, 18, 0.08)' }]}>
                <MaterialIcons name={item.status === 'Present' ? 'check' : 'close'} size={20} color={item.status === 'Present' ? '#10B981' : '#E21A12'} />
              </View>
              <View style={styles.workerInfo}>
                <Text style={styles.workerName}>{item.worker_name}</Text>
                <Text style={styles.workerRole}>{item.worker_role}</Text>
              </View>
              <View style={[styles.submittedPill, { backgroundColor: item.status === 'Present' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(226, 26, 18, 0.08)' }]}>
                <Text style={[styles.submittedPillText, { color: item.status === 'Present' ? '#047857' : '#B5120D' }]}>{item.status}</Text>
              </View>
            </View>
          ))}
          {submittedList.length === 0 && (
            <View style={styles.rosterCard}>
              <MaterialIcons name="event-note" size={20} color={COLORS.textLight} />
              <Text style={[styles.workerRole, { marginLeft: 10 }]}>No attendance submitted for this date yet.</Text>
            </View>
          )}
        </View>
      </ScrollView>
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
  addCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 24,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    elevation: 4,
    shadowColor: '#E21A12',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#E21A12',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(226, 26, 18, 0.12)',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipActive: {
    backgroundColor: '#E21A12',
    borderColor: '#E21A12',
  },
  chipText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
  },
  chipTextActive: {
    color: '#FFF',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(226, 26, 18, 0.08)',
    padding: 12,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: 12,
  },
  warningText: {
    color: COLORS.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    padding: 14,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(226, 26, 18, 0.12)',
    color: COLORS.text,
  },
  addBtn: {
    backgroundColor: '#E21A12',
    padding: 15,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#B5120D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  addBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rosterSection: {
    marginBottom: 40,
  },
  rosterTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textLight,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  rosterCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    padding: 12,
    borderRadius: 20,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    elevation: 4,
    shadowColor: '#E21A12',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  avatarContainer: {
    backgroundColor: 'rgba(226, 26, 18, 0.08)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  workerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  workerName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  workerRole: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '600',
  },
  statusToggle: {
    flexDirection: 'row',
    gap: 6,
    marginRight: 8,
  },
  statusBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBtnPresent: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  statusBtnAbsent: {
    backgroundColor: '#E21A12',
    borderColor: '#E21A12',
  },
  statusBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.textLight,
  },
  removeBtn: {
    padding: 4,
  },
  submittedPill: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  submittedPillText: {
    fontSize: 11,
    fontWeight: '900',
  },
  submitBtn: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: 10,
    elevation: 6,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
