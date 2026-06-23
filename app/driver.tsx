import React, { useState } from 'react';
import { ScrollView, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { fieldService } from '../services/api';
import LogoutButton from '../components/LogoutButton';

// ==========================================
// 2. DRIVER MODULE USER INTERFACE
// ==========================================
export default function DriverLogScreen() {
  const { name: paramName, userId } = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState<'material' | 'fuel'>('material');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Shared Core Identities
  const [driverName, setDriverName] = useState((paramName as string) || '');
  const [vehicleNumber, setVehicleNumber] = useState('');

  // Material Flow Sub-States
  const [materialType, setMaterialType] = useState('');
  const [quantity, setQuantity] = useState('');
  const [supplierName, setSupplierName] = useState('');

  // Fuel Flow Sub-States
  const [fuelLiters, setFuelLiters] = useState('');
  const [amountPaid, setAmountPaid] = useState('');

  const handleLogMaterial = async () => {
    if (!driverName || !vehicleNumber || !materialType || !quantity) {
      Alert.alert('Missing Info', 'Please fill in your name, vehicle number, material type, and quantity.');
      return;
    }

    try {
      setIsSubmitting(true);
      await fieldService.logExpense({
        siteId: 1, // Defaulting to 1 as per original logic, or you could pass siteId via params
        userId: userId,
        type: 'DEBIT',
        category: 'Material',
        description: `Delivery: ${quantity} of ${materialType} via ${vehicleNumber} (${supplierName || 'Direct Cash Procurement'})`,
        amount: 0, 
        date: new Date().toISOString().split('T')[0]
      });

      Alert.alert('Success', 'Material delivery entry successfully synced with Database.');
      clearForm();
    } catch (error: any) {
      Alert.alert('Connection Failure', error.message || 'Could not dispatch data to backend server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogFuel = async () => {
    if (!driverName || !vehicleNumber || !fuelLiters || !amountPaid) {
      Alert.alert('Missing Info', 'Please complete all fields to process fuel logs.');
      return;
    }

    try {
      setIsSubmitting(true);
      await fieldService.logExpense({
        siteId: 1,
        userId: userId,
        type: 'DEBIT',
        category: 'Fuel',
        description: `Fuel Refill: ${fuelLiters}L for ${vehicleNumber}`,
        amount: parseFloat(amountPaid),
        date: new Date().toISOString().split('T')[0]
      });

      Alert.alert('Success', 'Fuel voucher debit logged into Database.');
      clearForm();
    } catch (error: any) {
      Alert.alert('Connection Failure', error.message || 'Could not dispatch data to backend server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearForm = () => {
    setMaterialType('');
    setQuantity('');
    setSupplierName('');
    setFuelLiters('');
    setAmountPaid('');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#0F172A' }}>Logistics & Driver Desk</Text>
        <LogoutButton variant="solid" />
      </View>
      <Text style={{ fontSize: 14, color: '#64748B', marginBottom: 20 }}>Submit raw transit data directly into the database system</Text>

      {/* Driver & Truck Verification Card */}
      <View style={{ backgroundColor: '#FFF', padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20 }}>
        <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#475569', marginBottom: 6 }}>DRIVER / OPERATOR NAME</Text>
        <TextInput 
          style={{ backgroundColor: '#F1F5F9', padding: 12, borderRadius: 6, marginBottom: 12 }}
          placeholder="Enter driver fullname" 
          value={driverName}
          onChangeText={setDriverName}
        />
        <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#475569', marginBottom: 6 }}>VEHICLE NUMBER</Text>
        <TextInput 
          style={{ backgroundColor: '#F1F5F9', padding: 12, borderRadius: 6 }}
          placeholder="e.g., TN-58-AA-1111" 
          value={vehicleNumber}
          onChangeText={setVehicleNumber}
        />
      </View>

      {/* Toggle View Tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 8, padding: 4, marginBottom: 20 }}>
        <TouchableOpacity 
          style={{ flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: activeTab === 'material' ? '#FFF' : 'transparent', borderRadius: 6 }}
          onPress={() => setActiveTab('material')}
        >
          <Text style={{ fontWeight: 'bold', color: activeTab === 'material' ? '#0F172A' : '#64748B' }}>Material Supply</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={{ flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: activeTab === 'fuel' ? '#FFF' : 'transparent', borderRadius: 6 }}
          onPress={() => setActiveTab('fuel')}
        >
          <Text style={{ fontWeight: 'bold', color: activeTab === 'fuel' ? '#0F172A' : '#64748B' }}>Fuel Refill</Text>
        </TouchableOpacity>
      </View>

      {/* Dynamic Content Switching */}
      {activeTab === 'material' ? (
        <View style={{ backgroundColor: '#FFF', padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 30 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#64748B', marginBottom: 6 }}>MATERIAL CLASSIFICATION</Text>
          <TextInput style={{ borderWidth: 1, borderColor: '#CBD5E1', padding: 12, borderRadius: 6, marginBottom: 14 }} placeholder="e.g., Cement Bags, Aggregate, Brick" value={materialType} onChangeText={setMaterialType} />
          
          <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#64748B', marginBottom: 6 }}>QUANTITY MEASURE</Text>
          <TextInput style={{ borderWidth: 1, borderColor: '#CBD5E1', padding: 12, borderRadius: 6, marginBottom: 14 }} placeholder="e.g., 100 Bags, 3 Units" value={quantity} onChangeText={setQuantity} />
          
          <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#64748B', marginBottom: 6 }}>SUPPLIER YARD / SOURCE</Text>
          <TextInput style={{ borderWidth: 1, borderColor: '#CBD5E1', padding: 12, borderRadius: 6, marginBottom: 20 }} placeholder="e.g., Siva Blue Metals" value={supplierName} onChangeText={setSupplierName} />

          <TouchableOpacity style={{ backgroundColor: '#0284C7', padding: 16, borderRadius: 6, alignItems: 'center' }} onPress={handleLogMaterial} disabled={isSubmitting}>
            {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Submit Material Manifest</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ backgroundColor: '#FFF', padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 30 }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#64748B', marginBottom: 6 }}>VOLUME (Liters)</Text>
          <TextInput style={{ borderWidth: 1, borderColor: '#CBD5E1', padding: 12, borderRadius: 6, marginBottom: 14 }} keyboardType="numeric" placeholder="0" value={fuelLiters} onChangeText={setFuelLiters} />
          
          <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#64748B', marginBottom: 6 }}>CASH/CREDIT OUTLAY VALUE (₹)</Text>
          <TextInput style={{ borderWidth: 1, borderColor: '#CBD5E1', padding: 12, borderRadius: 6, marginBottom: 20 }} keyboardType="numeric" placeholder="0.00" value={amountPaid} onChangeText={setAmountPaid} />

          <TouchableOpacity style={{ backgroundColor: '#D97706', padding: 16, borderRadius: 6, alignItems: 'center' }} onPress={handleLogFuel} disabled={isSubmitting}>
            {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>Discharge Fuel Payment</Text>}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}
