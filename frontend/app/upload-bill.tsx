import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, Text, View, TextInput, TouchableOpacity, Alert, Linking, Image, Platform, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fieldService, uploadPhoto } from '../services/api';
import { COLORS, BORDER_RADIUS, SPACING } from '../constants/Theme';
import AppBackground from './components/AppBackground';
import DatePickerField from '../components/DatePickerField';

interface BillItem {
  id: string;
  vendorName: string;
  amount: string;
  categories: string[];
  paymentMode: 'Direct' | 'Indirect';
  isGst: boolean;
  imageUris: string[];
}

export default function UploadBill() {
  const router = useRouter();
  const { siteId, siteName, userId } = useLocalSearchParams();
  
  const [assignedSites, setAssignedSites] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(siteId ? siteId.toString() : null);
  const [selectedSiteName, setSelectedSiteName] = useState<string | null>(siteName ? siteName.toString() : null);
  
  const [vendorName, setVendorName] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['Cement']);
  const [paymentMode, setPaymentMode] = useState<'Direct' | 'Indirect'>('Direct');
  const [isGst, setIsGst] = useState(false);
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [billsList, setBillsList] = useState<BillItem[]>([]);

  // Submitted bills history
  const todayStr = new Date().toISOString().split('T')[0];
  const [historyDate, setHistoryDate] = useState(todayStr);
  const [submittedBills, setSubmittedBills] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const loadSites = async () => {
      try {
        const rawUserId = userId || await AsyncStorage.getItem('userId');
        const storedUserId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
        if (storedUserId) {
          const sitesData = await fieldService.getSupervisorSites(storedUserId);
          setAssignedSites(sitesData);
          if (sitesData.length > 0 && !selectedSiteId) {
            setSelectedSiteId(sitesData[0].id.toString());
            setSelectedSiteName(sitesData[0].name);
          }
        }
      } catch (err) {
        console.error('Error loading supervisor sites for billing:', err);
      }
    };
    loadSites();
  }, [userId]);

  const loadSubmittedBills = useCallback(async (siteId: string | null, date: string) => {
    if (!siteId) return;
    setLoadingHistory(true);
    try {
      const data = await fieldService.getLedgerBySite(siteId, date);
      setSubmittedBills(data || []);
    } catch {
      setSubmittedBills([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadSubmittedBills(selectedSiteId, historyDate);
  }, [selectedSiteId, historyDate, loadSubmittedBills]);

  const handleSiteChange = (val: string) => {
    setSelectedSiteId(val);
    const siteObj = assignedSites.find(s => s.id.toString() === val);
    if (siteObj) {
      setSelectedSiteName(siteObj.name);
    }
  };

  const categories = ['Cement', 'Steel', 'Sand', 'Bricks', 'Fuel', 'Others'];

  const toggleCategory = (cat: string) => {
    setSelectedCategories((current) => {
      if (current.includes(cat)) {
        const next = current.filter((item) => item !== cat);
        return next.length > 0 ? next : current;
      }
      return [...current, cat];
    });
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

  const pickImage = async (useCamera: boolean) => {
    let result;
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.7,
      });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Gallery permission is required.');
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        allowsMultipleSelection: true,
        orderedSelection: true,
        selectionLimit: 0,
        quality: 0.7,
      });
    }

    if (!result.canceled) {
      const pickedUris = result.assets.map((asset) => asset.uri);
      setImageUris((current) => Array.from(new Set([...current, ...pickedUris])));
    }
  };

  const addBillToList = () => {
    if (!vendorName || !amount || selectedCategories.length === 0 || imageUris.length === 0) {
      Alert.alert('Incomplete Bill', 'Please provide Vendor, Amount, Category and Bill Photos.');
      return;
    }

    const newBill: BillItem = {
      id: Date.now().toString(),
      vendorName,
      amount,
      categories: selectedCategories,
      paymentMode,
      isGst,
      imageUris,
    };

    setBillsList([...billsList, newBill]);
    
    // Reset fields
    setVendorName('');
    setAmount('');
    setSelectedCategories(['Cement']);
    setIsGst(false);
    setImageUris([]);
    Alert.alert("Success", "Bill added to list.");
  };

  const removeBill = (id: string) => {
    setBillsList(billsList.filter(b => b.id !== id));
  };

  const handleSubmitAll = async () => {
    if (billsList.length === 0) {
      Alert.alert('Empty List', 'Please add at least one bill to the list before submitting.');
      return;
    }

    if (!selectedSiteId) {
      Alert.alert('Error', 'Please select a project site first.');
      return;
    }

    setLoading(true);

    try {
      const rawUserId = userId || await AsyncStorage.getItem('userId');
      const storedUserId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
      const username = (await AsyncStorage.getItem('userUsername')) || 'unknown';

      for (const bill of billsList) {
        // Upload every bill photo to the server (images/supervisor/<username>/bill-...)
        // so the admin report can display them from any device
        const hostedUris: string[] = [];
        for (const localUri of bill.imageUris) {
          hostedUris.push(await uploadPhoto(localUri, { role: 'supervisor', username, type: 'bill' }));
        }

        await fieldService.logExpense({
          siteId: selectedSiteId,
          userId: storedUserId,
          type: 'DEBIT',
          category: bill.categories.join(', '),
          description: `Vendor: ${bill.vendorName} (${bill.paymentMode})${bill.isGst ? ' [GST]' : ''}`,
          amount: parseFloat(bill.amount),
          paymentMode: bill.paymentMode,
          isGst: bill.isGst,
          imageUrl: hostedUris.join('||'),
          date: new Date().toISOString().split('T')[0]
        });
      }

      const totalAmount = billsList.reduce((sum, bill) => sum + parseFloat(bill.amount || '0'), 0);
      const directTotal = billsList.filter(b => b.paymentMode === 'Direct').reduce((sum, b) => sum + parseFloat(b.amount), 0);
      const indirectTotal = totalAmount - directTotal;

      let reportMessage = `🧾 *BATCH MATERIAL BILL REPORT*\n\n`;
      reportMessage += `📍 *Site:* ${selectedSiteName || 'Not Specified'}\n`;
      reportMessage += `📊 *Total Bills:* ${billsList.length}\n`;
      reportMessage += `💰 *Batch Total:* ₹${totalAmount.toLocaleString()}\n`;
      if (directTotal > 0) reportMessage += `💵 *Direct (Cash):* ₹${directTotal.toLocaleString()}\n`;
      if (indirectTotal > 0) reportMessage += `💳 *Indirect (Credit):* ₹${indirectTotal.toLocaleString()}\n`;
      reportMessage += `\n`;
      
      billsList.forEach((bill, index) => {
        reportMessage += `${index + 1}. *${bill.vendorName}*\n`;
        reportMessage += `   📦 ${bill.categories.join(', ')} | ₹${bill.amount}\n`;
        reportMessage += `   Images: ${bill.imageUris.length}\n`;
        reportMessage += `   💳 ${bill.paymentMode} Bill\n\n`;
      });

      // Clear list so screen resets and same bills can't be re-submitted
      setBillsList([]);
      // Refresh history to include the just-submitted bills
      loadSubmittedBills(selectedSiteId, historyDate);
      setLoading(false);
      Alert.alert('Batch Submitted', `Logged ${billsList.length} bills totaling ₹${totalAmount.toLocaleString()} to Database.`, [
        { text: 'Send WhatsApp Report', onPress: () => {
          sendToWhatsApp(reportMessage);
          router.replace('/(tabs)/home');
        }},
        { text: 'OK', onPress: () => {
          router.replace('/(tabs)/home');
        }}
      ]);
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', 'Failed to save bills to database.');
    }
  };

  return (
    <View style={styles.outerContainer}>
      <AppBackground />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.addCard}>
          <Text style={styles.sectionTitle}>ADD NEW BILL</Text>

          <Text style={styles.formLabel}>SELECT CONSTRUCTION SITE</Text>
          {assignedSites.length > 0 ? (
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedSiteId || ''}
                onValueChange={handleSiteChange}
                style={styles.picker}
              >
                {assignedSites.map((site) => (
                  <Picker.Item key={site.id} label={site.name} value={site.id.toString()} />
                ))}
              </Picker>
            </View>
          ) : (
            <View style={styles.warningContainer}>
              <Text style={styles.warningText}>No allocated sites found</Text>
            </View>
          )}

          <Text style={styles.formLabel}>BILL TYPE</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity 
              style={[styles.toggleBtn, paymentMode === 'Direct' && styles.toggleBtnActiveDirect]}
              onPress={() => setPaymentMode('Direct')}
            >
              <Text style={[styles.toggleBtnText, paymentMode === 'Direct' && styles.toggleTextActive]}>Direct (Cash)</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toggleBtn, paymentMode === 'Indirect' && styles.toggleBtnActiveIndirect]}
              onPress={() => setPaymentMode('Indirect')}
            >
              <Text style={[styles.toggleBtnText, paymentMode === 'Indirect' && styles.toggleTextActive]}>Indirect (Credit)</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.gstRow}>
            <Text style={styles.gstLabel}>GST BILL (Includes Tax)</Text>
            <TouchableOpacity 
              onPress={() => setIsGst(!isGst)}
              style={[styles.switchTrack, isGst && styles.switchTrackActive]}
            >
              <View style={[styles.switchThumb, isGst && styles.switchThumbActive]} />
            </TouchableOpacity>
          </View>

          <Text style={styles.formLabel}>CATEGORIES</Text>
          <View style={styles.chipRow}>
            {categories.map((cat) => {
              const isSelected = selectedCategories.includes(cat);
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => toggleCategory(cat)}
                  style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                >
                  <MaterialIcons 
                    name={isSelected ? 'check-box' : 'check-box-outline-blank'} 
                    size={16} 
                    color={isSelected ? '#FFF' : '#E21A12'} 
                  />
                  <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput 
            style={styles.textInput} 
            placeholder="Vendor Name" 
            value={vendorName} 
            onChangeText={setVendorName} 
            placeholderTextColor="#8B7B80"
          />
          
          <TextInput 
            style={styles.textInput} 
            placeholder="Amount (₹)" 
            keyboardType="numeric" 
            value={amount} 
            onChangeText={setAmount} 
            placeholderTextColor="#8B7B80"
          />

          <Text style={styles.formLabel}>BILL PHOTOS</Text>
          <View style={styles.photoActionRow}>
            <TouchableOpacity style={styles.photoBtn} onPress={() => pickImage(true)}>
              <MaterialIcons name="photo-camera" size={20} color="#E21A12" />
              <Text style={styles.photoBtnText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoBtn} onPress={() => pickImage(false)}>
              <MaterialIcons name="photo-library" size={20} color="#E21A12" />
              <Text style={styles.photoBtnText}>Gallery</Text>
            </TouchableOpacity>
          </View>

          {imageUris.length > 0 && (
            <View style={styles.previewContainer}>
              <View style={styles.previewRow}>
                {imageUris.map((uri, index) => (
                  <View key={uri} style={styles.previewImageWrapper}>
                    <Image source={{ uri }} style={styles.previewImage} resizeMode="cover" />
                    <TouchableOpacity
                      onPress={() => setImageUris((current) => current.filter((item) => item !== uri))}
                      style={styles.removePreviewBtn}
                    >
                      <MaterialIcons name="close" size={14} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.previewLabel}>Bill {index + 1}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity onPress={() => setImageUris([])} style={styles.clearPhotosBtn}>
                <Text style={styles.clearPhotosText}>Remove All Photos</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.addToListBtn} onPress={addBillToList}>
            <Text style={styles.addToListBtnText}>+ ADD TO SUBMISSION LIST</Text>
          </TouchableOpacity>
        </View>

        {billsList.length > 0 && (
          <View style={styles.batchContainer}>
            <Text style={styles.batchTitle}>BILLS IN THIS BATCH ({billsList.length})</Text>
            {billsList.map((bill) => (
              <View key={bill.id} style={styles.batchBillCard}>
                <Image source={{ uri: bill.imageUris[0] }} style={styles.batchBillImage} />
                <View style={styles.batchBillInfo}>
                  <Text style={styles.batchBillVendor} numberOfLines={1}>{bill.vendorName}</Text>
                  <Text style={styles.batchBillDetails}>{bill.categories.join(', ')} | ₹{bill.amount}</Text>
                  <Text style={styles.batchBillMode}>{bill.paymentMode} Bill • {bill.imageUris.length} Image(s)</Text>
                </View>
                <TouchableOpacity onPress={() => removeBill(bill.id)} style={styles.deleteBillBtn}>
                  <MaterialIcons name="delete-outline" size={24} color="#E21A12" />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity 
              style={styles.submitAllBtn} 
              onPress={handleSubmitAll}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitAllBtnText}>SUBMIT ALL BILLS ({billsList.length})</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ─── SUBMITTED BILLS HISTORY ─── */}
        <View style={styles.historyCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
            <MaterialIcons name="receipt-long" size={20} color="#E21A12" />
            <Text style={styles.sectionTitle}>SUBMITTED BILLS</Text>
          </View>

          <DatePickerField
            value={historyDate}
            onChange={setHistoryDate}
            placeholder="Select date to view bills"
          />

          {loadingHistory ? (
            <ActivityIndicator color="#E21A12" style={{ marginTop: 16 }} />
          ) : submittedBills.length === 0 ? (
            <View style={styles.emptyHistory}>
              <MaterialIcons name="inbox" size={32} color="#C4A8AE" />
              <Text style={styles.emptyHistoryText}>No bills submitted on {historyDate}</Text>
            </View>
          ) : (
            <View>
              {/* Summary row */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, marginTop: 8 }}>
                <View style={{ flex: 1, backgroundColor: '#EBF8EE', borderRadius: 10, padding: 10 }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#1A7A35' }}>DIRECT (CASH)</Text>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#1A7A35', marginTop: 2 }}>
                    ₹{submittedBills.filter(b => b.payment_mode === 'Direct').reduce((s: number, b: any) => s + Number(b.amount || 0), 0).toLocaleString()}
                  </Text>
                </View>
                <View style={{ flex: 1, backgroundColor: '#FFF3E0', borderRadius: 10, padding: 10 }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#D56B00' }}>INDIRECT (CREDIT)</Text>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#D56B00', marginTop: 2 }}>
                    ₹{submittedBills.filter(b => b.payment_mode !== 'Direct').reduce((s: number, b: any) => s + Number(b.amount || 0), 0).toLocaleString()}
                  </Text>
                </View>
              </View>

              {submittedBills.map((bill: any) => {
                const isDirect = bill.payment_mode === 'Direct';
                const imageUris: string[] = bill.image_url ? bill.image_url.split('||').filter(Boolean) : [];
                return (
                  <View key={bill.id} style={styles.historyBillCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                      {imageUris.length > 0 && (
                        <Image source={{ uri: imageUris[0] }} style={styles.historyThumb} />
                      )}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <View style={[styles.modeBadge, { backgroundColor: isDirect ? '#EBF8EE' : '#FFF3E0' }]}>
                            <Text style={[styles.modeBadgeText, { color: isDirect ? '#1A7A35' : '#D56B00' }]}>
                              {isDirect ? '💵 Direct' : '💳 Indirect'}
                            </Text>
                          </View>
                          {bill.is_gst ? (
                            <View style={[styles.modeBadge, { backgroundColor: '#EDE9FE' }]}>
                              <Text style={[styles.modeBadgeText, { color: '#5B21B6' }]}>GST</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.historyCategory}>{bill.category || 'Expense'}</Text>
                        <Text style={styles.historyDesc} numberOfLines={2}>{bill.description || '-'}</Text>
                        <Text style={styles.historyDate}>{new Date(bill.date).toLocaleDateString('en-IN')}</Text>
                      </View>
                      <Text style={styles.historyAmount}>₹{Number(bill.amount || 0).toLocaleString()}</Text>
                    </View>
                    {imageUris.length > 1 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                        {imageUris.slice(1).map((uri: string) => (
                          <Image key={uri} source={{ uri }} style={[styles.historyThumb, { marginRight: 6 }]} />
                        ))}
                      </ScrollView>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

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
    fontSize: 16,
    fontWeight: '800',
    color: '#E21A12',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#E21A12',
    marginBottom: 8,
    marginTop: 10,
    letterSpacing: 0.5,
  },
  pickerContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(226, 26, 18, 0.15)',
    overflow: 'hidden',
    marginBottom: 16,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  warningContainer: {
    backgroundColor: 'rgba(226, 26, 18, 0.08)',
    padding: 12,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(226, 26, 18, 0.15)',
    marginBottom: 16,
  },
  warningText: {
    color: '#B5120D',
    fontSize: 12,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    padding: 12,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(226, 26, 18, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    alignItems: 'center',
  },
  toggleBtnActiveDirect: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  toggleBtnActiveIndirect: {
    borderColor: '#E21A12',
    backgroundColor: 'rgba(226, 26, 18, 0.12)',
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textLight,
  },
  toggleTextActive: {
    color: COLORS.text,
  },
  gstRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    padding: 12,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(226, 26, 18, 0.08)',
  },
  gstLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  switchTrack: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: '#10B981',
  },
  switchThumb: {
    backgroundColor: '#FFF',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(226, 26, 18, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  categoryChipActive: {
    borderColor: '#E21A12',
    backgroundColor: '#E21A12',
  },
  categoryChipText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  categoryChipTextActive: {
    color: '#FFF',
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    padding: 14,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: 14,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(226, 26, 18, 0.12)',
    color: COLORS.text,
  },
  photoActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  photoBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(226, 26, 18, 0.15)',
    padding: 12,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  photoBtnText: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 12,
  },
  previewContainer: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  previewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  previewImageWrapper: {
    width: '30%',
    minWidth: 84,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 84,
    borderRadius: 12,
  },
  removePreviewBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(213, 0, 0, 0.85)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLabel: {
    fontSize: 10,
    color: COLORS.textLight,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
  },
  clearPhotosBtn: {
    marginTop: 12,
    alignSelf: 'center',
  },
  clearPhotosText: {
    color: '#B5120D',
    fontSize: 12,
    fontWeight: '700',
  },
  addToListBtn: {
    backgroundColor: '#E21A12',
    padding: 16,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#B5120D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  addToListBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  batchContainer: {
    marginBottom: 40,
  },
  batchTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textLight,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  batchBillCard: {
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
  batchBillImage: {
    width: 50,
    height: 50,
    borderRadius: 10,
  },
  batchBillInfo: {
    flex: 1,
    marginLeft: 12,
  },
  batchBillVendor: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  batchBillDetails: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 2,
    fontWeight: '600',
  },
  batchBillMode: {
    fontSize: 10,
    color: '#E21A12',
    marginTop: 2,
    fontWeight: '700',
  },
  deleteBillBtn: {
    padding: 4,
  },
  submitAllBtn: {
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
  submitAllBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  historyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 24,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    elevation: 4,
    shadowColor: '#E21A12',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    marginBottom: 40,
  },
  historyBillCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  historyThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  modeBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  historyCategory: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  historyDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  historyDate: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '600',
  },
  historyAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#E21A12',
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyHistoryText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
});

