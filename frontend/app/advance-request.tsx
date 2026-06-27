import React, { useState } from 'react';
import { ScrollView, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { fieldService } from '../services/api';

export default function AdvanceRequestScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams();
  const [requestAmount, setRequestAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequest = async () => {
    if (!requestAmount || !reason) {
      Alert.alert('Form Incomplete', 'Please provide an advance amount and purpose description.');
      return;
    }

    setLoading(true);
    try {
      await fieldService.requestAdvance({
        userId: userId, 
        amount: parseFloat(requestAmount),
        reason: reason,
        date: new Date().toISOString().split('T')[0]
      });

      setLoading(false);
      Alert.alert('Request Submitted', `Your request for ₹${requestAmount} has entered the Admin Review Queue. Status: PENDING.`, [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', 'Failed to submit advance request.');
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 20 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 8 }}>ADVANCE REQUEST FUNDING AMOUNT (₹)</Text>
      <TextInput style={{ backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', padding: 14, borderRadius: 8, marginBottom: 20 }} placeholder="e.g. 50000" keyboardType="numeric" value={requestAmount} onChangeText={setRequestAmount} />

      <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 8 }}>PURPOSE / REASON</Text>
      <TextInput style={{ backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', padding: 14, borderRadius: 8, marginBottom: 24, height: 80, textAlignVertical: 'top' }} placeholder="Why is this advance funding needed?" multiline={true} value={reason} onChangeText={setReason} />

      <TouchableOpacity 
        style={{ backgroundColor: '#1E293B', padding: 16, borderRadius: 8, alignItems: 'center' }} 
        onPress={handleRequest}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 15, fontWeight: 'bold' }}>Submit Advance Request</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}