import React, { useState, useEffect } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Alert, Linking, Image, ActivityIndicator, StyleSheet, Modal, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';

// Duplicate import removed
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { fieldService } from '../services/api';
import { COLORS, BORDER_RADIUS, SPACING } from '../constants/Theme';

export default function SupervisorAttendanceScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [selectedSiteName, setSelectedSiteName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [location, setLocation] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [fetchingSites, setFetchingSites] = useState(true);

  useEffect(() => {
    const initializeData = async () => {
      try {
        const id = await AsyncStorage.getItem('userId');
        const name = await AsyncStorage.getItem('userName');
        setUserId(id);
        setUserName(name);
        
        if (id) {
          const sitesData = await fieldService.getSupervisorSites(id);
          setSites(sitesData);
          if (sitesData.length > 0) {
            setSelectedSiteId(sitesData[0].id.toString());
            setSelectedSiteName(sitesData[0].name);
          }
        }
      } catch (error) {
        console.error('Failed to initialize supervisor attendance screen:', error);
      } finally {
        setFetchingSites(false);
      }
    };
    initializeData();
  }, []);

  const handleSiteChange = (itemValue: string) => {
    setSelectedSiteId(itemValue);
    const site = sites.find(s => s.id.toString() === itemValue);
    if (site) {
      setSelectedSiteName(site.name);
    }
  };

  const takeSelfie = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to log selfie attendance.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      cameraType: ImagePicker.CameraType.front,
    });

    if (!result.canceled) {
      setSelfieUri(result.assets[0].uri);
      // Get current location
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      if (locStatus === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation(loc.coords);
      }
    }
  };

  const sendWhatsAppNotification = (siteName: string, timeString: string) => {
    const phoneNumber = '919876543210'; // Admin / office phone
    const message = `🤳 *SUPERVISOR ATTENDANCE CLOCK-IN*\n\n` +
      `👤 *Supervisor:* ${userName || 'Supervisor'}\n` +
      `📍 *Site:* ${siteName}\n` +
      `⏰ *Time:* ${timeString}\n` +
      `📅 *Date:* ${new Date().toLocaleDateString()}\n` +
      `🟢 *Status:* Present (Selfie Recorded)`;

    const url = `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert("WhatsApp Report", "Attendance is recorded in DB. Install WhatsApp to send text receipts.");
      }
    });
  };

  const handleSubmit = async () => {
    if (!selectedSiteId) {
      Alert.alert('Error', 'Please select a site.');
      return;
    }
    if (!selfieUri) {
      Alert.alert('Error', 'Please take a clock-in selfie.');
      return;
    }

    setLoading(true);
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const timeStr = new Date().toLocaleTimeString();
      
      await fieldService.submitSupervisorAttendance({
        userId,
        siteId: selectedSiteId,
        date: dateStr,
        status: 'Present',
        selfieUrl: selfieUri,
        latitude: location?.latitude,
        longitude: location?.longitude,
      });

      setLoading(false);
      setModalVisible(true);
    } catch (error) {
      setLoading(false);
      Alert.alert('Attendance Error', 'Failed to register attendance in the database.');
    }
  };

  if (fetchingSites) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ImageBackground source={require('../assets/attendance_bg.png')} style={styles.bg}>
      <View style={styles.header}>
        <MaterialIcons name="camera-front" size={48} color={COLORS.secondary} />
        <Text style={styles.title}>Supervisor Clock-In</Text>
        <Text style={styles.subtitle}>Register your location and attendance with a selfie</Text>
      </View>

      <View style={styles.cardGlass}>
        <Text style={styles.label}>SELECT CURRENT PROJECT SITE</Text>
        {sites.length > 0 ? (
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedSiteId}
              onValueChange={handleSiteChange}
              style={styles.picker}
            >
              {sites.map((site) => (
                <Picker.Item key={site.id} label={site.name} value={site.id.toString()} />
              ))}
            </Picker>
          </View>
        ) : (
          <View style={styles.warningContainer}>
            <MaterialIcons name="warning" size={20} color={COLORS.error} />
            <Text style={styles.warningText}>No sites allocated to your account.</Text>
          </View>
        )}

        <Text style={styles.label}>CLOCK-IN SELFIE</Text>
        {selfieUri ? (
          <View style={styles.selfiePreviewContainer}>
            <Image source={{ uri: selfieUri }} style={styles.selfieImage} resizeMode="cover" />
            <TouchableOpacity style={styles.retakeButton} onPress={takeSelfie}>
              <MaterialIcons name="refresh" size={16} color={COLORS.white} />
              <Text style={styles.retakeButtonText}>Retake Photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.cameraPlaceholder} onPress={takeSelfie}>
            <MaterialIcons name="add-a-photo" size={48} color={COLORS.textLight} />
            <Text style={styles.placeholderText}>Tap to Capture Clock-in Selfie</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={[
            styles.submitButton, 
            (!selectedSiteId || !selfieUri) && styles.submitButtonDisabled
          ]} 
          onPress={handleSubmit}
          disabled={loading || !selectedSiteId || !selfieUri}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <MaterialIcons name="check-circle" size={20} color={COLORS.white} />
              <Text style={styles.submitButtonText}>REGISTER ATTENDANCE</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    <Modal
      animationType="slide"
      transparent={true}
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalCenteredView}>
        <View style={styles.modalView}>
            <Text style={styles.modalText}>Attendance Registered Successfully!</Text>
            {selfieUri && (
              <Image source={{ uri: selfieUri }} style={styles.modalImage} resizeMode="cover" />
            )}
            {location && (
              <Text style={styles.modalText}>Location: {location.latitude?.toFixed(5)}, {location.longitude?.toFixed(5)}</Text>
            )}
          <TouchableOpacity
            style={styles.buttonClose}
            onPress={() => {
              setModalVisible(false);
              router.back();
            }}
          >
            <Text style={styles.textStyle}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  </ImageBackground>
);
}

const styles = StyleSheet.create({
  bg: { flex: 1, padding: SPACING.lg, justifyContent: 'center' },
  modalCenteredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 10,
  },
  buttonClose: {
    backgroundColor: '#2196F3',
    borderRadius: 20,
    padding: 10,
    elevation: 2,
    marginTop: 15,
  },
  textStyle: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalText: {
    marginBottom: 15,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  cardGlass: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  modalGlass: {
    margin: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  // Existing styles continue below
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    marginTop: SPACING.md,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: SPACING.sm,
    letterSpacing: 0.5,
  },
  pickerContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.lg,
    gap: 8,
  },
  warningText: {
    fontSize: 12,
    color: COLORS.error,
    fontWeight: '600',
  },
  cameraPlaceholder: {
    height: 200,
    borderRadius: BORDER_RADIUS.lg,
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    marginBottom: SPACING.xl,
  },
  placeholderText: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 10,
    fontWeight: '500',
  },
  selfiePreviewContainer: {
    height: 240,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.xl,
    position: 'relative',
  },
  selfieImage: {
    width: '100%',
    height: '100%',
  },
  retakeButton: {
    position: 'absolute',
    bottom: SPACING.md,
    right: SPACING.md,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  retakeButtonText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    elevation: 2,
  },
  submitButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  submitButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 15,
  },
});
