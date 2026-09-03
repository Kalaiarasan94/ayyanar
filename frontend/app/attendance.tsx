import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View, TouchableOpacity, Alert, Linking, Platform, TextInput, ActivityIndicator, StyleSheet, Image, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fieldService, adminService, uploadPhoto } from '../services/api';
import AppBackground from './components/AppBackground';
import DatePickerField from '../components/DatePickerField';
import { COLORS, BORDER_RADIUS, SPACING } from '../constants/Theme';
import { Picker } from '@react-native-picker/picker';

interface WorkerCategory {
  id: string;
  category: string;
  presentCount: string;
  absentCount: string;
  workerName: string;
  photoUri: string | null;
}

// Common daily-wage worker categories offered as quick-pick chips (free text also allowed)
const QUICK_CATEGORIES = ['Kothanar', 'Mason', 'Helper', 'Kuli', 'Carpenter', 'Electrician'];

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
  const { siteId: paramSiteId, siteName: paramSiteName, tab: paramTab } = useLocalSearchParams();

  // Screen state: lands on the monthly dashboard first; entering attendance
  // (Worker or Supervisor) switches into that form, picked via the top-right button
  const [activeTab, setActiveTab] = useState<'dashboard' | 'worker' | 'supervisor'>('dashboard');
  const [entryPickerVisible, setEntryPickerVisible] = useState(false);
  const [monthlyStats, setMonthlyStats] = useState({ present: 0, absent: 0, markedDays: 0, percentage: 0 });
  const [loadingMonthlyStats, setLoadingMonthlyStats] = useState(false);

  // Shared state
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>((paramSiteId as string) || '');
  const [selectedSiteName, setSelectedSiteName] = useState<string>((paramSiteName as string) || '');
  const [fetchingSites, setFetchingSites] = useState(true);

  // Worker tab state — worker category + headcount (e.g. "Kothanar" x 5 present),
  // not individual worker names
  const [attendanceDate, setAttendanceDate] = useState(todayLocal());
  const [categoryName, setCategoryName] = useState('');
  const [presentCountInput, setPresentCountInput] = useState('');
  const [absentCountInput, setAbsentCountInput] = useState('');
  const [categoryWorkerName, setCategoryWorkerName] = useState('');
  const [categoryPhotoUri, setCategoryPhotoUri] = useState<string | null>(null);
  const [categoriesList, setCategoriesList] = useState<WorkerCategory[]>([]);
  const [submittedList, setSubmittedList] = useState<any[]>([]);
  const [workerLoading, setWorkerLoading] = useState(false);

  // Supervisor tab state
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [location, setLocation] = useState<any>(null);
  const [locationName, setLocationName] = useState<string>('');
  const [supStatus, setSupStatus] = useState<'Present' | 'Absent'>('Present');
  const [supModalVisible, setSupModalVisible] = useState(false);
  const [supLoading, setSupLoading] = useState(false);
  const [supAttendanceDate, setSupAttendanceDate] = useState(todayLocal());
  const [supSubmittedList, setSupSubmittedList] = useState<any[]>([]);

  // Route tab sync — a direct link (?tab=worker/supervisor) jumps straight into that
  // entry form; otherwise the screen lands on the dashboard.
  useEffect(() => {
    if (paramTab === 'supervisor' || paramTab === 'worker') {
      setActiveTab(paramTab);
    }
  }, [paramTab]);

  // Load initial data
  useEffect(() => {
    const initializeData = async () => {
      try {
        const id = await AsyncStorage.getItem('userId');
        const name = await AsyncStorage.getItem('userName');
        setUserId(id);
        setUserName(name);
        
        if (id) {
          const sitesData = await fieldService.getSupervisorSites(id);
          setSites(sitesData || []);
          if (sitesData && sitesData.length > 0) {
            const defaultSiteId = (paramSiteId as string) || sitesData[0].id.toString();
            setSelectedSiteId(defaultSiteId);
            const site = sitesData.find((s: any) => s.id.toString() === defaultSiteId);
            if (site) {
              setSelectedSiteName(site.name);
            }
          }
        }
      } catch (error) {
        console.error('Failed to initialize attendance screen data:', error);
      } finally {
        setFetchingSites(false);
      }
    };
    initializeData();
  }, []);

  // Sync selected site name when site ID changes
  useEffect(() => {
    if (selectedSiteId && sites.length > 0) {
      const site = sites.find(s => s.id.toString() === selectedSiteId);
      if (site) {
        setSelectedSiteName(site.name);
      }
    }
  }, [selectedSiteId, sites]);

  // Worker: load category-wise attendance already submitted for this site+date
  const loadSubmitted = async (siteId = selectedSiteId, date = attendanceDate) => {
    if (!siteId) return;
    try {
      setSubmittedList(await fieldService.getAttendanceCategoryBySite(siteId, date));
    } catch {
      setSubmittedList([]);
    }
  };

  useEffect(() => {
    loadSubmitted();
  }, [selectedSiteId, attendanceDate]);

  // Supervisor: load submitted history
  const loadSupervisorSubmitted = async (date = supAttendanceDate) => {
    if (!userName) return;
    try {
      const overview = await adminService.getAttendanceOverview(date, userId);
      if (overview && overview.supervisors) {
        // Filter by the logged-in supervisor name
        const filtered = overview.supervisors.filter((item: any) => item.supervisor_name === userName);
        setSupSubmittedList(filtered);
      } else {
        setSupSubmittedList([]);
      }
    } catch {
      setSupSubmittedList([]);
    }
  };

  useEffect(() => {
    loadSupervisorSubmitted();
  }, [supAttendanceDate, userName]);

  // Dashboard: this calendar month's leave count + attendance percentage for the
  // logged-in supervisor, built from one overview call per elapsed day (no range
  // endpoint exists on the backend for this)
  const loadMonthlyStats = async () => {
    if (!userName) return;
    setLoadingMonthlyStats(true);
    try {
      const now = new Date();
      const daysElapsed = now.getDate();
      const dateStrings = Array.from({ length: daysElapsed }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth(), i + 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      });
      const results = await Promise.all(
        dateStrings.map((d) => adminService.getAttendanceOverview(d, userId).catch(() => null))
      );
      let present = 0;
      let absent = 0;
      results.forEach((overview: any) => {
        const mine = overview?.supervisors?.find((item: any) => item.supervisor_name === userName);
        if (mine?.status === 'Present') present += 1;
        else if (mine?.status === 'Absent') absent += 1;
      });
      setMonthlyStats({
        present,
        absent,
        markedDays: present + absent,
        percentage: daysElapsed > 0 ? Math.round((present / daysElapsed) * 100) : 0,
      });
    } finally {
      setLoadingMonthlyStats(false);
    }
  };

  useEffect(() => {
    if (userName && activeTab === 'dashboard') {
      loadMonthlyStats();
    }
  }, [userName, activeTab]);

  const handleSiteChange = (siteId: string) => {
    setSelectedSiteId(siteId);
    const site = sites.find(s => s.id.toString() === siteId);
    if (site) {
      setSelectedSiteName(site.name);
    }
  };

  // Worker category roster actions
  const addCategory = () => {
    if (!categoryName.trim()) {
      notify('Error', 'Please enter or pick a worker category (e.g., Kothanar, Mason).');
      return;
    }
    const present = parseInt(presentCountInput) || 0;
    const absent = parseInt(absentCountInput) || 0;
    if (present <= 0 && absent <= 0) {
      notify('Error', 'Enter how many workers are present or absent for this category.');
      return;
    }
    setCategoriesList([
      ...categoriesList,
      {
        id: Date.now().toString(),
        category: categoryName.trim(),
        presentCount: String(present),
        absentCount: String(absent),
        workerName: categoryWorkerName.trim(),
        photoUri: categoryPhotoUri,
      },
    ]);
    setCategoryName('');
    setPresentCountInput('');
    setAbsentCountInput('');
    setCategoryWorkerName('');
    setCategoryPhotoUri(null);
  };

  const removeCategory = (id: string) => {
    setCategoriesList(categoriesList.filter((c) => c.id !== id));
  };

  // Take (or pick) a crew photo to attach as proof to the category being added
  const captureCategoryPhoto = async (useCamera = true) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      notify('Permission Denied', `Permission to access ${useCamera ? 'camera' : 'gallery'} is required.`);
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { allowsEditing: true, quality: 0.7 };
    const result = useCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets?.[0]) {
      setCategoryPhotoUri(result.assets[0].uri);
    }
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
    if (categoriesList.length === 0) {
      notify('Empty List', 'Please add at least one worker category before submitting.');
      return;
    }

    setWorkerLoading(true);
    try {
      const username = (await AsyncStorage.getItem('userUsername')) || userName || 'unknown';
      const categoriesPayload = await Promise.all(
        categoriesList.map(async (c) => {
          const imageUrl = c.photoUri
            ? await uploadPhoto(c.photoUri, { role: 'worker', username, type: 'attendance' })
            : null;
          return {
            category: c.category,
            presentCount: parseInt(c.presentCount) || 0,
            absentCount: parseInt(c.absentCount) || 0,
            workerName: c.workerName || null,
            imageUrl,
          };
        })
      );

      await fieldService.submitAttendanceCategory({
        siteId: selectedSiteId,
        date: attendanceDate,
        categories: categoriesPayload,
      });

      const totalPresent = categoriesList.reduce((s, c) => s + (parseInt(c.presentCount) || 0), 0);
      const totalAbsent = categoriesList.reduce((s, c) => s + (parseInt(c.absentCount) || 0), 0);
      const categoryLines = categoriesList
        .map((c, i) => `${i + 1}. *${c.category}*${c.workerName ? ` (${c.workerName})` : ''} — Present: ${c.presentCount || 0}, Absent: ${c.absentCount || 0}`)
        .join('\n');
      const message =
        `👷 *DAILY ATTENDANCE REPORT*\n\n` +
        `📍 *Site:* ${selectedSiteName}\n` +
        `📅 *Date:* ${attendanceDate}\n` +
        `🟢 *Total Present:* ${totalPresent}   🔴 *Total Absent:* ${totalAbsent}\n\n` +
        `✅ *WORKER CATEGORIES:*\n${categoryLines}`;

      setWorkerLoading(false);
      const savedCount = categoriesList.length;
      setCategoriesList([]);
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
      setWorkerLoading(false);
      notify('Error', error?.message || 'Failed to save attendance to database.');
    }
  };

  // Supervisor Camera Action
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
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      if (locStatus === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({});
          setLocation(loc.coords);

          const places = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          const place = places[0];
          if (place) {
            const parts = [place.name || place.street, place.district || place.subregion, place.city || place.region].filter(Boolean);
            setLocationName(parts.join(', '));
          }
        } catch (locError) {
          console.log('Location lookup failed (attendance still works):', locError);
        }
      } else {
        Alert.alert('Location Off', 'GPS permission denied — attendance will be saved without location.');
      }
    }
  };

  // Supervisor WhatsApp notification
  const sendSupWhatsAppNotification = (siteName: string, timeString: string) => {
    const phoneNumber = '919876543210';
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

  // Supervisor Submit Attendance
  const handleSupervisorSubmit = async () => {
    if (!selectedSiteId) {
      Alert.alert('Error', 'Please select a site.');
      return;
    }
    if (supStatus === 'Present' && !selfieUri) {
      Alert.alert('Error', 'Please take a clock-in selfie.');
      return;
    }

    setSupLoading(true);
    try {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const timeStr = now.toLocaleTimeString();

      const username = (await AsyncStorage.getItem('userUsername')) || userName || 'unknown';
      const hostedSelfieUrl =
        supStatus === 'Present' && selfieUri
          ? await uploadPhoto(selfieUri, { role: 'supervisor', username, type: 'attendance' })
          : null;

      await fieldService.submitSupervisorAttendance({
        userId,
        siteId: selectedSiteId,
        date: dateStr,
        status: supStatus,
        selfieUrl: hostedSelfieUrl,
        latitude: supStatus === 'Present' ? location?.latitude : null,
        longitude: supStatus === 'Present' ? location?.longitude : null,
        locationName: supStatus === 'Present' ? locationName || null : null,
      });

      setSupLoading(false);
      
      // WhatsApp notification
      if (supStatus === 'Present') {
        if (Platform.OS === 'web') {
          const sendReport = window.confirm(`Attendance registered successfully! Send WhatsApp notification?`);
          if (sendReport) sendSupWhatsAppNotification(selectedSiteName, timeStr);
        } else {
          Alert.alert(
            'Attendance Registered',
            'Your attendance has been registered successfully.',
            [
              { text: 'Send WhatsApp Notification', onPress: () => sendSupWhatsAppNotification(selectedSiteName, timeStr) },
              { text: 'Done' }
            ]
          );
        }
      } else {
        notify('Absent Marked', 'You have been marked ABSENT for today.');
      }
      
      await loadSupervisorSubmitted(dateStr);
      
      setSupModalVisible(true);
    } catch (error: any) {
      setSupLoading(false);
      Alert.alert('Attendance Error', error?.message || 'Failed to register attendance in the database.');
    }
  };

  if (fetchingSites) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const renderDashboard = () => {
    const monthName = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.addCard}>
          <Text style={styles.sectionTitle}>{monthName.toUpperCase()}</Text>
          <View style={styles.dashboardHero}>
            <Text style={styles.dashboardHeroLabel}>ATTENDANCE THIS MONTH</Text>
            {loadingMonthlyStats ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 14 }} />
            ) : (
              <Text style={styles.dashboardHeroValue}>{monthlyStats.percentage}%</Text>
            )}
          </View>
          <View style={styles.dashboardStatRow}>
            <View style={[styles.dashboardStat, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <MaterialIcons name="check-circle" size={22} color="#8C0F16" />
              <Text style={styles.dashboardStatValue}>{monthlyStats.present}</Text>
              <Text style={styles.dashboardStatLabel}>Present Days</Text>
            </View>
            <View style={[styles.dashboardStat, { backgroundColor: 'rgba(226, 26, 18, 0.08)' }]}>
              <MaterialIcons name="event-busy" size={22} color="#E23744" />
              <Text style={styles.dashboardStatValue}>{monthlyStats.absent}</Text>
              <Text style={styles.dashboardStatLabel}>Leaves</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderWorkerTab = () => {
    const totalPresent = categoriesList.reduce((s, c) => s + (parseInt(c.presentCount) || 0), 0);
    const totalAbsent = categoriesList.reduce((s, c) => s + (parseInt(c.absentCount) || 0), 0);
    return (
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
                    onPress={() => handleSiteChange(site.id.toString())}
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

        {/* Add worker category + headcount (e.g. "Kothanar" x 5 present) */}
        <View style={styles.addCard}>
          <Text style={styles.sectionTitle}>ADD WORKER CATEGORY</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <View style={styles.chipRow}>
              {QUICK_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, categoryName === cat && styles.chipActive]}
                  onPress={() => setCategoryName(cat)}
                >
                  <Text style={[styles.chipText, categoryName === cat && styles.chipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <TextInput
            style={styles.textInput}
            placeholder="Category name (e.g., Kothanar, Mason, Helper)"
            value={categoryName}
            onChangeText={setCategoryName}
            placeholderTextColor="#8B7B80"
          />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              placeholder="Present count"
              keyboardType="numeric"
              value={presentCountInput}
              onChangeText={setPresentCountInput}
              placeholderTextColor="#8B7B80"
            />
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              placeholder="Absent count"
              keyboardType="numeric"
              value={absentCountInput}
              onChangeText={setAbsentCountInput}
              placeholderTextColor="#8B7B80"
            />
          </View>

          <TextInput
            style={styles.textInput}
            placeholder="Worker / team lead name (optional)"
            value={categoryWorkerName}
            onChangeText={setCategoryWorkerName}
            placeholderTextColor="#8B7B80"
          />

          {categoryPhotoUri ? (
            <View style={styles.categoryPhotoPreview}>
              <Image source={{ uri: categoryPhotoUri }} style={styles.categoryPhotoImage} resizeMode="cover" />
              <TouchableOpacity style={styles.categoryPhotoRemove} onPress={() => setCategoryPhotoUri(null)}>
                <MaterialIcons name="close" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <TouchableOpacity style={styles.photoPickBtn} onPress={() => captureCategoryPhoto(true)}>
                <MaterialIcons name="camera-alt" size={16} color={COLORS.primary} />
                <Text style={styles.photoPickBtnText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoPickBtn} onPress={() => captureCategoryPhoto(false)}>
                <MaterialIcons name="photo-library" size={16} color={COLORS.primary} />
                <Text style={styles.photoPickBtnText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.addBtn} onPress={addCategory}>
            <Text style={styles.addBtnText}>+ ADD CATEGORY</Text>
          </TouchableOpacity>
        </View>

        {categoriesList.length > 0 && (
          <View style={styles.rosterSection}>
            <Text style={styles.rosterTitle}>
              CATEGORIES ({categoriesList.length}) — {totalPresent} PRESENT / {totalAbsent} ABSENT
            </Text>
            {categoriesList.map((cat) => (
              <View key={cat.id} style={styles.rosterCard}>
                {cat.photoUri ? (
                  <Image source={{ uri: cat.photoUri }} style={styles.rosterThumb} resizeMode="cover" />
                ) : (
                  <View style={styles.avatarContainer}>
                    <MaterialIcons name="groups" size={20} color="#E23744" />
                  </View>
                )}
                <View style={styles.workerInfo}>
                  <Text style={styles.workerName}>{cat.category}{cat.workerName ? ` — ${cat.workerName}` : ''}</Text>
                  <Text style={styles.workerRole}>Present: {cat.presentCount || 0} • Absent: {cat.absentCount || 0}</Text>
                </View>

                <TouchableOpacity onPress={() => removeCategory(cat.id)} style={styles.removeBtn}>
                  <MaterialIcons name="remove-circle-outline" size={22} color="#E23744" />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.submitBtn} onPress={handleSave} disabled={workerLoading}>
              {workerLoading ? (
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
              {item.image_url?.startsWith('http') ? (
                <Image source={{ uri: item.image_url }} style={styles.rosterThumb} resizeMode="cover" />
              ) : (
                <View style={[styles.avatarContainer, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                  <MaterialIcons name="groups" size={20} color="#8C0F16" />
                </View>
              )}
              <View style={styles.workerInfo}>
                <Text style={styles.workerName}>{item.category}{item.worker_name ? ` — ${item.worker_name}` : ''}</Text>
                <Text style={styles.workerRole}>{item.site_name ? `${item.site_name} • ` : ''}Present: {item.present_count || 0} • Absent: {item.absent_count || 0}</Text>
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
    );
  };

  const renderSupervisorTab = () => {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
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

          <Text style={styles.label}>TODAY'S STATUS</Text>
          <View style={styles.statusRow}>
            <TouchableOpacity
              style={[styles.statusOption, supStatus === 'Present' && styles.statusOptionPresent]}
              onPress={() => setSupStatus('Present')}
            >
              <MaterialIcons name="check-circle" size={18} color={supStatus === 'Present' ? COLORS.white : COLORS.textLight} />
              <Text style={[styles.statusOptionText, supStatus === 'Present' && { color: COLORS.white }]}>Present</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.statusOption, supStatus === 'Absent' && styles.statusOptionAbsent]}
              onPress={() => setSupStatus('Absent')}
            >
              <MaterialIcons name="cancel" size={18} color={supStatus === 'Absent' ? COLORS.white : COLORS.textLight} />
              <Text style={[styles.statusOptionText, supStatus === 'Absent' && { color: COLORS.white }]}>Absent</Text>
            </TouchableOpacity>
          </View>

          {supStatus === 'Present' ? (
            <>
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

              {selfieUri && (
                <>
                  <Text style={styles.label}>CURRENT LOCATION {location ? '(AUTO-DETECTED — CONFIRM OR EDIT)' : ''}</Text>
                  <TextInput
                    style={styles.locationInput}
                    placeholder="Type your current location"
                    value={locationName}
                    onChangeText={setLocationName}
                    placeholderTextColor="#8B7B80"
                  />
                  {location && (
                    <Text style={styles.gpsCoordsText}>
                      📍 GPS: {location.latitude?.toFixed(5)}, {location.longitude?.toFixed(5)}
                    </Text>
                  )}
                </>
              )}
            </>
          ) : (
            <View style={styles.absentNote}>
              <MaterialIcons name="info-outline" size={18} color={COLORS.textLight} />
              <Text style={styles.absentNoteText}>Marking ABSENT — no selfie or GPS needed. Just press the button below.</Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.submitButton,
              supStatus === 'Absent' && { backgroundColor: COLORS.accent },
              (!selectedSiteId || (supStatus === 'Present' && !selfieUri)) && styles.submitButtonDisabled
            ]}
            onPress={handleSupervisorSubmit}
            disabled={supLoading || !selectedSiteId || (supStatus === 'Present' && !selfieUri)}
          >
            {supLoading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <MaterialIcons name={supStatus === 'Present' ? 'check-circle' : 'event-busy'} size={20} color={COLORS.white} />
                <Text style={styles.submitButtonText}>{supStatus === 'Present' ? 'REGISTER ATTENDANCE' : 'MARK ABSENT'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Supervisor Attendance already registered for the selected date */}
        <View style={[styles.rosterSection, { marginTop: 15 }]}>
          <Text style={styles.rosterTitle}>SELECT DATE TO VIEW CLOCK-IN HISTORY</Text>
          <View style={[styles.cardGlass, { marginTop: 0, marginBottom: 15, padding: SPACING.md }]}>
            <DatePickerField value={supAttendanceDate} onChange={setSupAttendanceDate} placeholder="Select date" />
          </View>

          <Text style={styles.rosterTitle}>
            SUBMITTED FOR {supAttendanceDate} ({supSubmittedList.length})
          </Text>
          
          {supSubmittedList.map((item: any) => (
            <View key={item.id} style={styles.rosterCard}>
              <View style={[styles.avatarContainer, { backgroundColor: item.status === 'Present' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(226, 26, 18, 0.08)' }]}>
                <MaterialIcons name={item.status === 'Present' ? 'check' : 'close'} size={20} color={item.status === 'Present' ? '#8C0F16' : '#E23744'} />
              </View>
              
              <View style={styles.workerInfo}>
                <Text style={styles.workerName}>{item.supervisor_name || 'Supervisor'}</Text>
                <Text style={styles.workerRole}>Site: {item.site_name || 'N/A'}</Text>
                {item.status === 'Present' && item.location_name && (
                  <Text style={styles.locationText} numberOfLines={1}>
                    📍 {item.location_name}
                  </Text>
                )}
              </View>

              {item.status === 'Present' && item.selfie_url ? (
                <Image source={{ uri: item.selfie_url }} style={styles.selfieThumbnail} resizeMode="cover" />
              ) : null}

              <View style={[styles.submittedPill, { backgroundColor: item.status === 'Present' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(226, 26, 18, 0.08)' }]}>
                <Text style={[styles.submittedPillText, { color: item.status === 'Present' ? '#8C0F16' : '#CB202D' }]}>{item.status}</Text>
              </View>
            </View>
          ))}
          
          {supSubmittedList.length === 0 && (
            <View style={styles.rosterCard}>
              <MaterialIcons name="event-note" size={20} color={COLORS.textLight} />
              <Text style={[styles.workerRole, { marginLeft: 10 }]}>No supervisor clock-in records for this date.</Text>
            </View>
          )}
        </View>

        <Modal
          animationType="slide"
          transparent={true}
          visible={supModalVisible}
          onRequestClose={() => setSupModalVisible(false)}
        >
          <View style={styles.modalCenteredView}>
            <View style={styles.modalView}>
              <Text style={styles.modalText}>{supStatus === 'Present' ? 'Attendance Registered Successfully!' : 'Marked ABSENT for today.'}</Text>
              {supStatus === 'Present' && selfieUri && (
                <Image source={{ uri: selfieUri }} style={styles.modalImage} resizeMode="cover" />
              )}
              {location && (
                <Text style={styles.modalText}>
                  📍 {locationName ? `${locationName}\n` : ''}GPS: {location.latitude?.toFixed(5)}, {location.longitude?.toFixed(5)}
                </Text>
              )}
              <TouchableOpacity
                style={styles.buttonClose}
                onPress={() => {
                  setSupModalVisible(false);
                }}
              >
                <Text style={styles.textStyle}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  };

  return (
    <View style={styles.outerContainer}>
      <AppBackground />

      <View style={styles.headerSpacer} />

      <View style={styles.pageHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageHeaderTitle}>
            {activeTab === 'dashboard' ? 'Attendance' : activeTab === 'supervisor' ? 'Supervisor Attendance' : 'Worker Attendance'}
          </Text>
          <Text style={styles.pageHeaderSubtitle}>
            {activeTab === 'dashboard' ? 'Monthly overview' : "Log today's attendance"}
          </Text>
        </View>
        {activeTab === 'dashboard' ? (
          <TouchableOpacity style={styles.pageHeaderAction} onPress={() => setEntryPickerVisible(true)}>
            <MaterialIcons name="add" size={17} color={COLORS.white} />
            <Text style={styles.pageHeaderActionText}>Enter</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.pageHeaderBack} onPress={() => setActiveTab('dashboard')}>
            <MaterialIcons name="arrow-back" size={16} color={COLORS.primary} />
            <Text style={styles.pageHeaderBackText}>Dashboard</Text>
          </TouchableOpacity>
        )}
      </View>

      {activeTab === 'dashboard' ? renderDashboard() : activeTab === 'supervisor' ? renderSupervisorTab() : renderWorkerTab()}

      {/* Choose which attendance to log */}
      <Modal visible={entryPickerVisible} transparent animationType="fade" onRequestClose={() => setEntryPickerVisible(false)}>
        <View style={styles.modalCenteredView}>
          <View style={[styles.modalView, { width: '85%' }]}>
            <Text style={[styles.modalText, { fontSize: 18, marginBottom: 2 }]}>Enter Attendance</Text>
            <Text style={[styles.workerRole, { marginBottom: 16, textAlign: 'center' }]}>Who is this attendance for?</Text>

            <TouchableOpacity
              style={styles.entryPickerOption}
              onPress={() => { setEntryPickerVisible(false); setActiveTab('supervisor'); }}
            >
              <MaterialIcons name="camera-front" size={22} color={COLORS.primary} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.entryPickerOptionTitle}>Supervisor</Text>
                <Text style={styles.entryPickerOptionSubtitle}>Your own clock-in selfie</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={COLORS.textLight} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.entryPickerOption}
              onPress={() => { setEntryPickerVisible(false); setActiveTab('worker'); }}
            >
              <MaterialIcons name="engineering" size={22} color={COLORS.primary} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.entryPickerOptionTitle}>Worker</Text>
                <Text style={styles.entryPickerOptionSubtitle}>Category-wise headcount</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={COLORS.textLight} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.buttonClose} onPress={() => setEntryPickerVisible(false)}>
              <Text style={styles.textStyle}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  headerSpacer: {
    height: 15,
  },
  pageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  pageHeaderTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
  },
  pageHeaderSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight,
    marginTop: 2,
  },
  pageHeaderAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E23744',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.lg,
    elevation: 4,
    shadowColor: '#CB202D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  pageHeaderActionText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 13,
  },
  pageHeaderBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(226, 26, 18, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.lg,
  },
  pageHeaderBackText: {
    color: COLORS.primary,
    fontWeight: '900',
    fontSize: 13,
  },
  entryPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.steel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    width: '100%',
  },
  entryPickerOptionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  entryPickerOptionSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textLight,
    marginTop: 1,
  },
  dashboardHero: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 26, 18, 0.1)',
    marginBottom: SPACING.md,
  },
  dashboardHeroLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textLight,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  dashboardHeroValue: {
    fontSize: 40,
    fontWeight: '900',
    color: '#E23744',
  },
  dashboardStatRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dashboardStat: {
    flex: 1,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    gap: 4,
  },
  dashboardStatValue: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
  },
  dashboardStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textLight,
  },
  addCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 24,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    elevation: 4,
    shadowColor: '#E23744',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    marginBottom: 20,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#E23744',
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
    backgroundColor: '#E23744',
    borderColor: '#E23744',
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
    backgroundColor: '#E23744',
    padding: 15,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#CB202D',
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
    shadowColor: '#E23744',
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
  rosterThumb: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  photoPickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(226, 26, 18, 0.12)',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 12,
  },
  photoPickBtnText: {
    color: COLORS.primary,
    fontSize: 12.5,
    fontWeight: '800',
  },
  categoryPhotoPreview: {
    position: 'relative',
    height: 140,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: 12,
  },
  categoryPhotoImage: {
    width: '100%',
    height: '100%',
  },
  categoryPhotoRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: '#8C0F16',
    borderColor: '#8C0F16',
  },
  statusBtnAbsent: {
    backgroundColor: '#E23744',
    borderColor: '#E23744',
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
    backgroundColor: '#8C0F16',
    padding: 16,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: 10,
    elevation: 6,
    shadowColor: '#8C0F16',
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
  // Supervisor Clock-in specific styles
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: SPACING.sm,
    letterSpacing: 0.5,
  },
  pickerContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(226, 26, 18, 0.12)',
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  picker: {
    height: 50,
    width: '100%',
    color: COLORS.text,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: SPACING.lg,
  },
  statusOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(226, 26, 18, 0.12)',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 13,
  },
  statusOptionPresent: {
    backgroundColor: '#8C0F16',
    borderColor: '#8C0F16',
  },
  statusOptionAbsent: {
    backgroundColor: '#E23744',
    borderColor: '#E23744',
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textLight,
  },
  locationInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    padding: 14,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(226, 26, 18, 0.12)',
    color: COLORS.text,
  },
  gpsCoordsText: {
    fontSize: 11,
    color: COLORS.textLight,
    fontWeight: '600',
    marginBottom: SPACING.lg,
  },
  absentNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(226, 26, 18, 0.12)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.xl,
  },
  absentNoteText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '600',
    lineHeight: 17,
  },
  cameraPlaceholder: {
    height: 200,
    borderRadius: BORDER_RADIUS.lg,
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: 'rgba(226, 26, 18, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
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
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
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
    backgroundColor: '#8C0F16',
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
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.lg,
    gap: 8,
  },
  cardGlass: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 24,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    elevation: 4,
    shadowColor: '#E23744',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    marginBottom: 20,
    marginTop: 10,
  },
  modalCenteredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    width: '85%',
  },
  modalImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 15,
  },
  buttonClose: {
    backgroundColor: '#E23744',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
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
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  selfieThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  locationText: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 2,
    fontWeight: '500',
  },
});
