import React, { useState } from 'react';
import { ScrollView, Text, View, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';

export default function LogTripScreen() {
  const router = useRouter();
  const [vehicleNo, setVehicleNo] = useState('');
  const [vehicleType, setVehicleType] = useState<'Owned' | 'Rented'>('Owned');
  const [materialLoad, setMaterialLoad] = useState('');
  const [tollFee, setTollFee] = useState('');

  const handleSaveTrip = () => {
    if (!vehicleNo || !materialLoad) {
      Alert.alert('Incomplete Log', 'Please complete the Vehicle Number and Material Load information.');
      return;
    }
    Alert.alert(
      'Trip Logged', 
      `Transit recorded successfully under [${vehicleType} Fleet]. Toll records added.`,
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 20 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 8, textTransform: 'uppercase' }}>Fleet Sourcing</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
        {['Owned', 'Rented'].map((type) => (
          <TouchableOpacity 
            key={type}
            style={{ width: '48%', padding: 14, borderRadius: 8, alignItems: 'center', backgroundColor: vehicleType === type ? '#9333EA' : '#E2E8F0' }}
            onPress={() => setVehicleType(type as 'Owned' | 'Rented')}
          >
            <Text style={{ fontWeight: 'bold', color: vehicleType === type ? '#FFF' : '#475569' }}>{type} Fleet</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 8 }}>VEHICLE REGISTERED NUMBER</Text>
      <TextInput style={{ backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', padding: 14, borderRadius: 8, marginBottom: 20, textTransform: 'uppercase' }} placeholder="e.g. TN-58-BY-1234" value={vehicleNo} onChangeText={setVehicleNo} />

      <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 8 }}>MATERIAL LOAD DETAILS</Text>
      <TextInput style={{ backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', padding: 14, borderRadius: 8, marginBottom: 20 }} placeholder="e.g. 10 Tons of River Sand, Steel Rods" value={materialLoad} onChangeText={setMaterialLoad} />

      <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 8 }}>HIGHWAY TOLL CHARGES paid (₹) - IF ANY</Text>
      <TextInput style={{ backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', padding: 14, borderRadius: 8, marginBottom: 24 }} placeholder="0.00" keyboardType="numeric" value={tollFee} onChangeText={setTollFee} />

      <TouchableOpacity style={{ backgroundColor: '#1E293B', padding: 16, borderRadius: 8, alignItems: 'center' }} onPress={handleSaveTrip}>
        <Text style={{ color: '#FFF', fontSize: 15, fontWeight: 'bold' }}>Save Trip Entry</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}