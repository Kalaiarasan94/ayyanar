import React, { useState } from 'react';
import { ScrollView, Text, View, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

export default function FuelLogScreen() {
  const router = useRouter();
  const [odometer, setOdometer] = useState('');
  const [fuelCost, setFuelCost] = useState('');
  const [hasReceipt, setHasReceipt] = useState(false);

  const handleSaveFuel = () => {
    if (!odometer || !fuelCost || !hasReceipt) {
      Alert.alert('Incomplete Documentation', 'Please record your Odometer value, Fuel total cost, and capture a photo of the receipt slip.');
      return;
    }
    Alert.alert('Log Completed', 'Odometer tracking and fuel costs logged into business analytics.', [
      { text: 'OK', onPress: () => router.back() }
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 20 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 8 }}>CURRENT ODOMETER READING (KM)</Text>
      <TextInput style={{ backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', padding: 14, borderRadius: 8, marginBottom: 20 }} placeholder="e.g. 45280" keyboardType="numeric" value={odometer} onChangeText={setOdometer} />

      <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 8 }}>FUEL FILL TOTAL COST (₹)</Text>
      <TextInput style={{ backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', padding: 14, borderRadius: 8, marginBottom: 20 }} placeholder="0.00" keyboardType="numeric" value={fuelCost} onChangeText={setFuelCost} />

      <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 8 }}>RECEIPT SLIP UPLOAD</Text>
      <TouchableOpacity 
        style={{ height: 130, backgroundColor: '#FFF', borderStyle: 'dashed', borderWidth: 2, borderColor: hasReceipt ? '#10B981' : '#94A3B8', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 26 }}
        onPress={() => { setHasReceipt(true); Alert.alert("Receipt Captured", "Slip processed successfully."); }}
      >
        <MaterialIcons name={hasReceipt ? "receipt" : "add-a-photo"} size={32} color={hasReceipt ? "#10B981" : "#64748B"} />
        <Text style={{ color: '#475569', fontSize: 13, fontWeight: '600', marginTop: 8 }}>
          {hasReceipt ? "Receipt Attached" : "Capture Petrol Station Receipt"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={{ backgroundColor: '#1E293B', padding: 16, borderRadius: 8, alignItems: 'center' }} onPress={handleSaveFuel}>
        <Text style={{ color: '#FFF', fontSize: 15, fontWeight: 'bold' }}>Submit Fuel Log</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}