import React, { useState, useEffect } from 'react';
import { ScrollView, Text, View, TextInput, TouchableOpacity, Alert, Linking, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fieldService, adminService } from '../services/api';

export default function CashExpenseScreen() {
  const router = useRouter();
  const { siteId, siteName, userId } = useLocalSearchParams();
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
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
        date: new Date().toISOString().split('T')[0]
      });

      const expenseMessage = `💸 *CASH EXPENSE REPORT*\n\n` +
        `📍 *Site:* ${selectedSiteName || 'Not Specified'}\n` +
        `📝 *Description:* ${description}\n` +
        `💰 *Amount:* ₹${cost}\n` +
        `📅 *Date:* ${new Date().toLocaleDateString()}\n` +
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
    <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 20 }}>
      
      <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 8 }}>SELECT CONSTRUCTION SITE</Text>
      {assignedSites.length > 0 ? (
        <View style={{ backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', marginBottom: 20 }}>
          <Picker
            selectedValue={selectedSiteId || ''}
            onValueChange={handleSiteChange}
            style={{ height: 50, width: '100%' }}
          >
            {assignedSites.map((site) => (
              <Picker.Item key={site.id} label={site.name} value={site.id.toString()} />
            ))}
          </Picker>
        </View>
      ) : (
        <View style={{ backgroundColor: '#FEF2F2', padding: 12, borderRadius: 8, marginBottom: 20 }}>
          <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: 'bold' }}>No project sites found</Text>
        </View>
      )}
      
      <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 8 }}>EXPENSE ITEM DESCRIPTION</Text>
      <TextInput style={{ backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', padding: 14, borderRadius: 8, marginBottom: 20 }} placeholder="e.g. Tea & Snacks for laborers, Unloading tips" value={description} onChangeText={setDescription} />

      <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 8 }}>AMOUNT PAID (₹)</Text>
      <TextInput style={{ backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', padding: 14, borderRadius: 8, marginBottom: 24 }} placeholder="0.00" keyboardType="numeric" value={cost} onChangeText={setCost} />

      <TouchableOpacity 
        style={{ backgroundColor: '#1E293B', padding: 16, borderRadius: 8, alignItems: 'center' }} 
        onPress={handleSave}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 15, fontWeight: 'bold' }}>Save Cash Expense</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}