import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { fieldService } from '../services/api';
import LogoutButton from '../components/LogoutButton';

// ==========================================
// 2. DRIVER MODULE USER INTERFACE
// ==========================================
export default function DriverLogScreen() {
  const { name: paramName, userId } = useLocalSearchParams();
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
        date: new Date().toISOString().split('T')[0],
      });

      Alert.alert('Success', `Trip record saved. Total KM: ${totalKm || 0}`);
      clearTripForm();
    } catch (error: any) {
      Alert.alert('Connection Failure', error.message || 'Could not dispatch data to backend server.');
    } finally {
      setIsSubmitting(false);
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
  };

  const fieldLabel = { fontSize: 11, fontWeight: 'bold' as const, color: '#64748B', marginBottom: 6 };
  const fieldInput = { borderWidth: 1, borderColor: '#CBD5E1', padding: 12, borderRadius: 6, marginBottom: 14, backgroundColor: '#FFF' };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0F172A' }}>Driver Trip Record</Text>
        <LogoutButton variant="solid" />
      </View>
      <Text style={{ fontSize: 14, color: '#64748B', marginBottom: 20 }}>Submit your daily trip details directly into the database system</Text>

      <View style={{ backgroundColor: '#FFF', padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 30 }}>
        <Text style={fieldLabel}>VEHICLE NAME *</Text>
        <TextInput style={fieldInput} placeholder="e.g., Tata Tipper, Eicher 407" value={vehicleName} onChangeText={setVehicleName} />

        <Text style={fieldLabel}>DRIVER NAME *</Text>
        <TextInput style={fieldInput} placeholder="Enter driver fullname" value={driverName} onChangeText={setDriverName} />

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={fieldLabel}>STARTING KM *</Text>
            <TextInput style={fieldInput} keyboardType="numeric" placeholder="0" value={startingKm} onChangeText={setStartingKm} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={fieldLabel}>ENDING KM *</Text>
            <TextInput style={fieldInput} keyboardType="numeric" placeholder="0" value={endingKm} onChangeText={setEndingKm} />
          </View>
        </View>

        <Text style={fieldLabel}>TOTAL KM (AUTO-CALCULATED)</Text>
        <View style={[fieldInput, { backgroundColor: '#F1F5F9' }]}>
          <Text style={{ color: totalKm ? '#0F172A' : '#94A3B8', fontWeight: 'bold' }}>
            {totalKm || 'Enter starting & ending KM'}
          </Text>
        </View>

        <Text style={fieldLabel}>DISTANCE</Text>
        <TextInput style={fieldInput} placeholder="e.g., 45 km" value={distance} onChangeText={setDistance} />

        <Text style={fieldLabel}>DIESEL FARE (₹)</Text>
        <TextInput style={fieldInput} keyboardType="numeric" placeholder="0.00" value={dieselFare} onChangeText={setDieselFare} />

        <Text style={fieldLabel}>LOAD NAME</Text>
        <TextInput style={fieldInput} placeholder="e.g., M-Sand, Blue Metal, Bricks" value={loadName} onChangeText={setLoadName} />

        <Text style={fieldLabel}>LOAD TYPE (RENT / OWN)</Text>
        <View style={{ flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 8, padding: 4, marginBottom: 14 }}>
          {(['Own', 'Rent'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: loadType === type ? '#FFF' : 'transparent', borderRadius: 6 }}
              onPress={() => setLoadType(type)}
            >
              <Text style={{ fontWeight: 'bold', color: loadType === type ? '#0F172A' : '#64748B' }}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loadType === 'Rent' && (
          <>
            <Text style={fieldLabel}>CUSTOMER NAME *</Text>
            <TextInput style={fieldInput} placeholder="Enter customer name" value={customerName} onChangeText={setCustomerName} />
          </>
        )}

        <Text style={fieldLabel}>PLACE</Text>
        <TextInput style={fieldInput} placeholder="e.g., Madurai, Sivagangai" value={place} onChangeText={setPlace} />

        <Text style={fieldLabel}>LOAD WEIGHT</Text>
        <TextInput style={fieldInput} placeholder="e.g., 5 Tons, 3 Units" value={loadWeight} onChangeText={setLoadWeight} />

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={fieldLabel}>STARTING TIME</Text>
            <TextInput style={fieldInput} placeholder="e.g., 09:30 AM" value={startingTime} onChangeText={setStartingTime} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={fieldLabel}>ENDING TIME</Text>
            <TextInput style={fieldInput} placeholder="e.g., 05:45 PM" value={endingTime} onChangeText={setEndingTime} />
          </View>
        </View>

        <TouchableOpacity style={{ backgroundColor: '#15803D', padding: 16, borderRadius: 6, alignItems: 'center', marginTop: 6 }} onPress={handleSaveTripRecord} disabled={isSubmitting}>
          {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Save Trip Record</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
