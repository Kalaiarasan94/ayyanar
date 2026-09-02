import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fieldService, uploadPhoto } from '../services/api';
import LogoutButton from '../components/LogoutButton';
import DatePickerField from '../components/DatePickerField';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/Theme';

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ==========================================
// 2. DRIVER MODULE USER INTERFACE
// ==========================================
export default function DriverLogScreen() {
  const { name: paramName, userId } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Trip Record (driver_records) States
  const [driverName, setDriverName] = useState((paramName as string) || '');
  const [vehicleName, setVehicleName] = useState('');
  const [startingKm, setStartingKm] = useState('');
  const [endingKm, setEndingKm] = useState('');
  const [distance, setDistance] = useState('');
  const [dieselFare, setDieselFare] = useState('');
  const [loadName, setLoadName] = useState('');
  const [loadType, setLoadType] = useState<'Rent' | 'Own'>('Own');
  const [customerName, setCustomerName] = useState('');
  const [place, setPlace] = useState('');
  const [loadWeight, setLoadWeight] = useState('');
  const [startingTime, setStartingTime] = useState('');
  const [endingTime, setEndingTime] = useState('');
  const [tripDate, setTripDate] = useState(todayLocal());

  // Diesel Bill Upload states
  const [billVehicleName, setBillVehicleName] = useState('');
  const [billNote, setBillNote] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billImageUri, setBillImageUri] = useState<string | null>(null);
  const [billDate, setBillDate] = useState(todayLocal());
  const [isBillSubmitting, setIsBillSubmitting] = useState(false);

  // Total KM is auto-calculated from starting & ending km
  const totalKm = useMemo(() => {
    const start = parseFloat(startingKm);
    const end = parseFloat(endingKm);
    if (isNaN(start) || isNaN(end)) return '';
    return Math.abs(end - start).toString();
  }, [startingKm, endingKm]);

  const handleSaveTripRecord = async () => {
    if (!vehicleName || !driverName || !startingKm || !endingKm) {
      Alert.alert('Missing Info', 'Please fill in vehicle name, driver name, starting KM and ending KM.');
      return;
    }
    if (isNaN(parseFloat(startingKm)) || isNaN(parseFloat(endingKm))) {
      Alert.alert('Invalid Input', 'Starting KM and Ending KM must be numbers.');
      return;
    }
    if (loadType === 'Rent' && !customerName) {
      Alert.alert('Missing Info', 'Customer name is required for Rent loads.');
      return;
    }

    try {
      setIsSubmitting(true);
      await fieldService.saveDriverRecord({
        userId: userId,
        vehicleName,
        driverName,
        startingKm: parseFloat(startingKm),
        endingKm: parseFloat(endingKm),
        distance,
        dieselFare: dieselFare ? parseFloat(dieselFare) : null,
        loadName,
        loadType,
        customerName: loadType === 'Rent' ? customerName : null,
        place,
        loadWeight,
        startingTime,
        endingTime,
        date: tripDate,
      });

      Alert.alert('Success', `Trip record saved. Total KM: ${totalKm || 0}`);
      clearTripForm();
    } catch (error: any) {
      Alert.alert('Connection Failure', error.message || 'Could not dispatch data to backend server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const captureBillPhoto = async (useCamera: boolean) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission Denied', `Permission to access ${useCamera ? 'camera' : 'gallery'} is required.`);
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { allowsEditing: true, quality: 0.7 };
    const result = useCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets?.[0]) {
      setBillImageUri(result.assets[0].uri);
    }
  };

  const handleUploadDieselBill = async () => {
    if (!driverName) {
      Alert.alert('Missing Info', 'Please enter the driver name.');
      return;
    }
    if (!billImageUri) {
      Alert.alert('Missing Photo', 'Please capture or select the diesel bill photo.');
      return;
    }

    try {
      setIsBillSubmitting(true);
      const username = (await AsyncStorage.getItem('userUsername')) || driverName;
      const hostedImageUrl = await uploadPhoto(billImageUri, { role: 'driver', username, type: 'diesel-bill' });

      await fieldService.saveDriverBill({
        userId,
        driverName,
        vehicleName: billVehicleName || vehicleName || null,
        note: billNote,
        amount: billAmount ? parseFloat(billAmount) : null,
        imageUrl: hostedImageUrl,
        date: billDate,
      });

      Alert.alert('Success', 'Diesel bill uploaded. The admin can see it in Driver Reports.');
      setBillVehicleName('');
      setBillNote('');
      setBillAmount('');
      setBillImageUri(null);
      setBillDate(todayLocal());
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message || 'Could not upload the diesel bill.');
    } finally {
      setIsBillSubmitting(false);
    }
  };

  const clearTripForm = () => {
    setVehicleName('');
    setStartingKm('');
    setEndingKm('');
    setDistance('');
    setDieselFare('');
    setLoadName('');
    setLoadType('Own');
    setCustomerName('');
    setPlace('');
    setLoadWeight('');
    setStartingTime('');
    setEndingTime('');
    setTripDate(todayLocal());
  };

  return (
    <View style={styles.screen}>
      {/* App-style header bar instead of plain floating text — padded for the notch/status bar */}
      <View style={[styles.headerBar, { paddingTop: insets.top + SPACING.sm }]}>
        <View style={styles.headerIconWrap}>
          <MaterialIcons name="local-shipping" size={22} color={COLORS.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Driver Console</Text>
          <Text style={styles.headerSubtitle}>Trips & diesel bills</Text>
        </View>
        <LogoutButton variant="solid" />
      </View>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 60}
      >
      <ScrollView style={styles.body} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* TRIP RECORD CARD */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconWrap}>
              <MaterialIcons name="route" size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Trip Record</Text>
              <Text style={styles.cardSubtitle}>Log today's vehicle trip details</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>DATE</Text>
          <DatePickerField value={tripDate} onChange={setTripDate} placeholder="Trip date" style={styles.fieldSpacing} />

          <Text style={styles.sectionLabel}>VEHICLE & DRIVER</Text>
          <View style={styles.inputWrap}>
            <MaterialIcons name="local-shipping" size={18} color={COLORS.textLight} style={styles.inputIcon} />
            <TextInput style={styles.inputField} placeholder="Vehicle name — e.g., Tata Tipper" value={vehicleName} onChangeText={setVehicleName} placeholderTextColor={COLORS.textLight} />
          </View>
          <View style={styles.inputWrap}>
            <MaterialIcons name="person" size={18} color={COLORS.textLight} style={styles.inputIcon} />
            <TextInput style={styles.inputField} placeholder="Driver full name" value={driverName} onChangeText={setDriverName} placeholderTextColor={COLORS.textLight} />
          </View>

          <Text style={styles.sectionLabel}>ODOMETER READING (KM)</Text>
          <View style={styles.row}>
            <View style={[styles.inputWrap, styles.rowItem]}>
              <TextInput style={styles.inputFieldNoIcon} keyboardType="numeric" placeholder="Starting KM" value={startingKm} onChangeText={setStartingKm} placeholderTextColor={COLORS.textLight} />
            </View>
            <View style={[styles.inputWrap, styles.rowItem]}>
              <TextInput style={styles.inputFieldNoIcon} keyboardType="numeric" placeholder="Ending KM" value={endingKm} onChangeText={setEndingKm} placeholderTextColor={COLORS.textLight} />
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIconWrap}>
              <MaterialIcons name="speed" size={20} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.statLabel}>TOTAL DISTANCE TRAVELLED</Text>
              <Text style={styles.statValue}>{totalKm ? `${totalKm} km` : 'Enter both readings above'}</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>TRIP DETAILS</Text>
          <View style={styles.inputWrap}>
            <MaterialIcons name="signpost" size={18} color={COLORS.textLight} style={styles.inputIcon} />
            <TextInput style={styles.inputField} placeholder="Distance — e.g., 45 km" value={distance} onChangeText={setDistance} placeholderTextColor={COLORS.textLight} />
          </View>
          <View style={styles.inputWrap}>
            <MaterialIcons name="local-gas-station" size={18} color={COLORS.textLight} style={styles.inputIcon} />
            <TextInput style={styles.inputField} keyboardType="numeric" placeholder="Diesel fare (₹)" value={dieselFare} onChangeText={setDieselFare} placeholderTextColor={COLORS.textLight} />
          </View>
          <View style={styles.inputWrap}>
            <MaterialIcons name="inventory-2" size={18} color={COLORS.textLight} style={styles.inputIcon} />
            <TextInput style={styles.inputField} placeholder="Load name — e.g., M-Sand, Blue Metal" value={loadName} onChangeText={setLoadName} placeholderTextColor={COLORS.textLight} />
          </View>

          <Text style={styles.sectionLabel}>LOAD TYPE</Text>
          <View style={styles.segmentRow}>
            {(['Own', 'Rent'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.segmentButton, loadType === type && styles.segmentButtonActive]}
                onPress={() => setLoadType(type)}
              >
                <Text style={[styles.segmentText, loadType === type && styles.segmentTextActive]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {loadType === 'Rent' && (
            <View style={styles.inputWrap}>
              <MaterialIcons name="badge" size={18} color={COLORS.textLight} style={styles.inputIcon} />
              <TextInput style={styles.inputField} placeholder="Customer name *" value={customerName} onChangeText={setCustomerName} placeholderTextColor={COLORS.textLight} />
            </View>
          )}

          <View style={styles.inputWrap}>
            <MaterialIcons name="place" size={18} color={COLORS.textLight} style={styles.inputIcon} />
            <TextInput style={styles.inputField} placeholder="Place — e.g., Madurai, Sivagangai" value={place} onChangeText={setPlace} placeholderTextColor={COLORS.textLight} />
          </View>
          <View style={styles.inputWrap}>
            <MaterialIcons name="scale" size={18} color={COLORS.textLight} style={styles.inputIcon} />
            <TextInput style={styles.inputField} placeholder="Load weight — e.g., 5 Tons" value={loadWeight} onChangeText={setLoadWeight} placeholderTextColor={COLORS.textLight} />
          </View>

          <Text style={styles.sectionLabel}>TIMING</Text>
          <View style={styles.row}>
            <View style={[styles.inputWrap, styles.rowItem]}>
              <MaterialIcons name="schedule" size={17} color={COLORS.textLight} style={styles.inputIcon} />
              <TextInput style={styles.inputField} placeholder="Start time" value={startingTime} onChangeText={setStartingTime} placeholderTextColor={COLORS.textLight} />
            </View>
            <View style={[styles.inputWrap, styles.rowItem]}>
              <MaterialIcons name="schedule" size={17} color={COLORS.textLight} style={styles.inputIcon} />
              <TextInput style={styles.inputField} placeholder="End time" value={endingTime} onChangeText={setEndingTime} placeholderTextColor={COLORS.textLight} />
            </View>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleSaveTripRecord} disabled={isSubmitting}>
            {isSubmitting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <MaterialIcons name="check-circle" size={19} color={COLORS.white} />
                <Text style={styles.primaryButtonText}>Save Trip Record</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* DIESEL BILL CARD — separate from the trip record, shows up for admin in Driver Reports */}
        <View style={[styles.card, styles.cardLast]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconWrap}>
              <MaterialIcons name="receipt-long" size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Diesel Bill Upload</Text>
              <Text style={styles.cardSubtitle}>Upload the fuel bill photo with a note</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>DATE</Text>
          <DatePickerField value={billDate} onChange={setBillDate} placeholder="Bill date" style={styles.fieldSpacing} />

          <Text style={styles.sectionLabel}>BILL DETAILS</Text>
          <View style={styles.inputWrap}>
            <MaterialIcons name="local-shipping" size={18} color={COLORS.textLight} style={styles.inputIcon} />
            <TextInput style={styles.inputField} placeholder="Vehicle (defaults to trip vehicle)" value={billVehicleName} onChangeText={setBillVehicleName} placeholderTextColor={COLORS.textLight} />
          </View>
          <View style={[styles.inputWrap, styles.inputWrapMultiline]}>
            <TextInput
              style={[styles.inputFieldNoIcon, styles.multilineField]}
              placeholder="Note — which bill is this? e.g., Diesel refill at Indian Oil, Madurai bypass *"
              value={billNote}
              onChangeText={setBillNote}
              placeholderTextColor={COLORS.textLight}
              multiline
            />
          </View>
          <View style={styles.inputWrap}>
            <MaterialIcons name="currency-rupee" size={18} color={COLORS.textLight} style={styles.inputIcon} />
            <TextInput style={styles.inputField} keyboardType="numeric" placeholder="Bill amount (optional)" value={billAmount} onChangeText={setBillAmount} placeholderTextColor={COLORS.textLight} />
          </View>

          <Text style={styles.sectionLabel}>BILL PHOTO *</Text>
          {billImageUri ? (
            <View style={styles.photoPreviewWrap}>
              <Image source={{ uri: billImageUri }} style={styles.photoPreview} resizeMode="cover" />
              <TouchableOpacity style={styles.removePhotoButton} onPress={() => setBillImageUri(null)}>
                <MaterialIcons name="close" size={14} color={COLORS.white} />
                <Text style={styles.removePhotoText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.row}>
              <TouchableOpacity style={styles.photoButton} onPress={() => captureBillPhoto(true)}>
                <MaterialIcons name="photo-camera" size={22} color={COLORS.primary} />
                <Text style={styles.photoButtonText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoButton} onPress={() => captureBillPhoto(false)}>
                <MaterialIcons name="photo-library" size={22} color={COLORS.primary} />
                <Text style={styles.photoButtonText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.secondaryButton} onPress={handleUploadDieselBill} disabled={isBillSubmitting}>
            {isBillSubmitting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <MaterialIcons name="cloud-upload" size={19} color={COLORS.white} />
                <Text style={styles.primaryButtonText}>Upload Diesel Bill</Text>
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.headerBackground,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 1,
  },
  body: {
    flex: 1,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 2,
  },
  cardLast: {
    marginBottom: 0,
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
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  fieldSpacing: {
    marginBottom: SPACING.md,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.steel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  inputWrapMultiline: {
    alignItems: 'flex-start',
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
  inputFieldNoIcon: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: SPACING.xs,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
  multilineField: {
    height: 78,
    textAlignVertical: 'top',
    paddingTop: 13,
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  rowItem: {
    flex: 1,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.tint,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: COLORS.textLight,
    letterSpacing: 0.4,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.text,
    marginTop: 1,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.steel,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 4,
    marginBottom: SPACING.sm,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.sm,
  },
  segmentButtonActive: {
    backgroundColor: COLORS.primary,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textLight,
  },
  segmentTextActive: {
    color: COLORS.white,
  },
  photoPreviewWrap: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  photoPreview: {
    width: '100%',
    height: 190,
    backgroundColor: COLORS.steel,
  },
  removePhotoButton: {
    position: 'absolute',
    bottom: SPACING.sm,
    right: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(38, 25, 26, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.lg,
  },
  removePhotoText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.tint,
    borderWidth: 1,
    borderColor: COLORS.tintBorder,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 14,
    marginBottom: SPACING.md,
  },
  photoButtonText: {
    fontWeight: '800',
    color: COLORS.text,
    fontSize: 13.5,
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
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.secondary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 15,
  },
});
