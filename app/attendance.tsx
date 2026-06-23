import React, { useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Alert, Linking, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { fieldService } from '../services/api';
import AppBackground from './components/AppBackground';
import { COLORS, BORDER_RADIUS, SPACING } from '../constants/Theme';

interface Worker {
  id: string;
  name: string;
  role: string;
}

export default function AttendanceScreen() {
  const router = useRouter();
  const { siteId, siteName } = useLocalSearchParams();
  
  const [workerName, setWorkerName] = useState('');
  const [workerRole, setWorkerRole] = useState('');
  const [workersList, setWorkersList] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);

  const addWorker = () => {
    if (!workerName || !workerRole) {
      Alert.alert('Error', 'Please enter both worker name and role.');
      return;
    }

    const newWorker: Worker = {
      id: Date.now().toString(),
      name: workerName,
      role: workerRole,
    };

    setWorkersList([...workersList, newWorker]);
    setWorkerName('');
    setWorkerRole('');
  };

  const removeWorker = (id: string) => {
    setWorkersList(workersList.filter(w => w.id !== id));
  };

  const sendToWhatsApp = (message: string) => {
    const phoneNumber = '919876543210';
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
    if (workersList.length === 0) {
      Alert.alert('Empty List', 'Please add at least one worker before submitting.');
      return;
    }

    setLoading(true);
    try {
      await fieldService.submitAttendance({
        siteId,
        records: workersList.map(w => ({
          workerId: 1,
          status: 'Present',
          date: new Date().toISOString().split('T')[0]
        }))
      });

      const workerLines = workersList.map((w, i) => `${i + 1}. *${w.name}* (${w.role})`).join('\n');
      const message = `👷 *DAILY ATTENDANCE REPORT*\n\n` +
        `📍 *Site:* ${siteName || 'Not Specified'}\n` +
        `📅 *Date:* ${new Date().toLocaleDateString()}\n` +
        `📊 *Total Present:* ${workersList.length}\n\n` +
        `✅ *WORKERS LIST:* \n${workerLines}`;

      setLoading(false);
      Alert.alert(
        "Attendance Submitted", 
        `Successfully logged ${workersList.length} workers to Database.`,
        [
          { text: "Send WhatsApp Report", onPress: () => {
            sendToWhatsApp(message);
            router.back();
          }},
          { text: "Done", onPress: () => router.back() }
        ]
      );
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', 'Failed to save attendance to database.');
    }
  };

  return (
    <View style={styles.outerContainer}>
      <AppBackground />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.addCard}>
          <Text style={styles.sectionTitle}>ADD WORKER TO TODAY'S LIST</Text>
          
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
            <Text style={styles.rosterTitle}>TODAY'S ROSTER ({workersList.length})</Text>
            {workersList.map((worker) => (
              <View key={worker.id} style={styles.rosterCard}>
                <View style={styles.avatarContainer}>
                  <MaterialIcons name="person" size={20} color="#E21A12" />
                </View>
                <View style={styles.workerInfo}>
                  <Text style={styles.workerName}>{worker.name}</Text>
                  <Text style={styles.workerRole}>{worker.role}</Text>
                </View>
                <TouchableOpacity onPress={() => removeWorker(worker.id)} style={styles.removeBtn}>
                  <MaterialIcons name="remove-circle-outline" size={22} color="#E21A12" />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity 
              style={styles.submitBtn} 
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitBtnText}>SUBMIT COMPLETE ATTENDANCE</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
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
  removeBtn: {
    padding: 4,
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
