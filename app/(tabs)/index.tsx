import React, { useState, useEffect } from 'react';
import { ScrollView, Text, View, ActivityIndicator, Dimensions, StyleSheet, TouchableOpacity, RefreshControl, Image, Alert, Linking, Platform } from 'react-native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Svg, Circle, G } from 'react-native-svg';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { adminService, fieldService } from '../../services/api';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/Theme';
import AppBackground from '../components/AppBackground';

const { width } = Dimensions.get('window');

// Simple Pie Chart Component
const SimplePieChart = ({ data }: { data: { label: string, value: number, color: string }[] }) => {
  const total = data.reduce((acc, curr) => acc + curr.value, 0);
  if (total === 0) return (
    <View style={styles.chartContainer}>
      <Text style={styles.emptyChartText}>No data available</Text>
    </View>
  );

  const size = 180;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentPercentageSum = 0;

  return (
    <View style={styles.chartContainer}>
      <View style={{ position: 'relative', width: size, height: size, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md }}>
        <Svg width={size} height={size}>
          <G transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {/* Background track circle */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke={COLORS.steel}
              strokeWidth={strokeWidth}
            />
            
            {data.map((item, index) => {
              const pct = (item.value / total) * 100;
              if (pct === 0) return null;
              
              const strokeLength = (pct / 100) * circumference;
              const strokeOffset = circumference - strokeLength;
              const rotation = (currentPercentageSum / 100) * 360;
              
              currentPercentageSum += pct;

              return (
                <Circle
                  key={index}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={item.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={strokeOffset}
                  transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
                  strokeLinecap="round"
                />
              );
            })}
          </G>
        </Svg>
        
        {/* Center label with total amount */}
        <View style={{ position: 'absolute', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 9, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Vol</Text>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: COLORS.text, marginTop: 2 }}>₹{Math.round(total).toLocaleString()}</Text>
        </View>
      </View>

      <View style={styles.legendContainer}>
        {data.map((item, index) => {
          const pct = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <View key={index} style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: item.color }]} />
              <View>
                <Text style={styles.legendLabelText}>{item.label}</Text>
                <Text style={styles.legendSubtext}>₹{Math.round(item.value).toLocaleString()} ({Math.round(pct)}%)</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default function DashboardScreen() {
  const [role, setRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [sites, setSites] = useState<any[]>([]);

  const [recentPhotos, setRecentPhotos] = useState<any[]>([]);
  const [selectedUploadSiteId, setSelectedUploadSiteId] = useState<string | null>(null);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [locationData, setLocationData] = useState<{ latitude: number, longitude: number, locationName: string } | null>(null);
  const [locating, setLocating] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const fetchData = async () => {
    try {
      const storedRole = await AsyncStorage.getItem('userRole');
      const storedUserId = await AsyncStorage.getItem('userId');
      setRole(storedRole);
      setUserId(storedUserId);

      if (storedRole === 'Admin') {
        const [analytics, photosData] = await Promise.all([
          adminService.getAnalytics(),
          fieldService.getRecentSitePhotos()
        ]);
        setData(analytics);
        setRecentPhotos(photosData || []);
      } else if (storedRole === 'Supervisor' || storedRole === 'Site Engineer') {
        if (storedUserId) {
          const [walletData, sitesData] = await Promise.all([
            fieldService.getSupervisorWallet(storedUserId),
            fieldService.getSupervisorSites(storedUserId)
          ]);
          setWallet(walletData);
          setSites(sitesData);
          if (sitesData.length > 0 && !selectedUploadSiteId) {
            const activeSites = sitesData.filter((s: any) => s.status !== 'Completed');
            const defaultSite = activeSites.length > 0 ? activeSites[0] : sitesData[0];
            setSelectedUploadSiteId(defaultSite.id.toString());
          }
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to fetch site check-in details.');
        setLocating(false);
        return null;
      }
      
      const currentLoc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      
      const { latitude, longitude } = currentLoc.coords;
      let locationName = '';
      
      try {
        const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geocode && geocode.length > 0) {
          const address = geocode[0];
          const parts = [
            address.name,
            address.street,
            address.district,
            address.city,
            address.region
          ].filter(Boolean);
          
          locationName = parts.length > 0 ? parts.join(', ') : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        } else {
          locationName = `Site GPS: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        }
      } catch (geoErr) {
        console.log('Reverse geocoding error:', geoErr);
        locationName = `Site GPS: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      }
      
      const locData = { latitude, longitude, locationName };
      setLocationData(locData);
      setLocating(false);
      return locData;
    } catch (err) {
      console.error('Error getting location:', err);
      Alert.alert('Location Error', 'Could not retrieve location. Please check if Location/GPS services are enabled on your device.');
      setLocating(false);
      return null;
    }
  };

  const capturePhoto = async (useCamera = true) => {
    try {
      let permissionResult;
      if (useCamera) {
        permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      } else {
        permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      }
      
      if (permissionResult.status !== 'granted') {
        Alert.alert('Permission Denied', `Permission to access ${useCamera ? 'camera' : 'gallery'} is required.`);
        return;
      }
      
      const options: ImagePicker.ImagePickerOptions = {
        allowsEditing: true,
        quality: 0.8,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      };
      
      const result = useCamera 
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
        
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setCapturedImageUri(uri);
        
        // Fetch location details right away
        await fetchLocation();
      }
    } catch (err) {
      console.error('Image capture error:', err);
      Alert.alert('Error', 'Failed to capture or select photo.');
    }
  };

  const handleUploadPhoto = async () => {
    if (!selectedUploadSiteId) {
      Alert.alert('Error', 'Please select a project site.');
      return;
    }
    if (!capturedImageUri) {
      Alert.alert('Error', 'Please capture or select a photo.');
      return;
    }
    if (locating) {
      Alert.alert('Wait', 'Acquiring GPS location... Please wait.');
      return;
    }
    
    setUploadingPhoto(true);
    try {
      let activeLocation = locationData;
      if (!activeLocation) {
        activeLocation = await fetchLocation();
      }
      
      const cleanUserId = userId ? parseInt(userId.toString()) : null;
      const cleanSiteId = selectedUploadSiteId ? parseInt(selectedUploadSiteId.toString()) : null;
      
      const resolvedLocationName = activeLocation ? activeLocation.locationName : 'Location Unspecified';

      const response = await fieldService.uploadSitePhoto({
        siteId: cleanSiteId,
        userId: cleanUserId,
        imageUrl: capturedImageUri,
        latitude: activeLocation ? activeLocation.latitude : null,
        longitude: activeLocation ? activeLocation.longitude : null,
        locationName: resolvedLocationName
      });
      
      if (response.success) {
        Alert.alert('Photo Saved', 'Site progress check-in registered successfully.');
        setCapturedImageUri(null);
        setLocationData(null);
        fetchData();
      } else {
        Alert.alert('Upload Failed', response.message || 'Error uploading photo.');
      }
    } catch (err: any) {
      console.error('Photo upload error:', err);
      Alert.alert('Upload Error', 'Failed to connect to backend server.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading && !data && !wallet) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const renderAdminDashboard = () => {
    const expenseChartData = data?.siteWiseExpenseBreakdown?.slice(0, 5).map((exp: any, idx: number) => ({
      label: exp.site_name,
      value: Number(exp.total_expenses),
      color: [COLORS.primary, COLORS.accent, COLORS.warning, COLORS.success, COLORS.secondary][idx % 5]
    })) || [];

    return (
      <>
        <View style={styles.header}>
          <Text style={styles.title}>Business Overview</Text>
          <Text style={styles.subtitle}>Real-time performance metrics</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(226, 26, 18, 0.1)' }]}>
              <MaterialIcons name="people" size={24} color={COLORS.primary} />
            </View>
            <Text style={styles.statLabel}>Total Leads</Text>
            <Text style={styles.statValue}>
              {data?.leadsChannelPerformance?.reduce((acc: number, curr: any) => acc + curr.total_leads, 0) || 0}
            </Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(21, 128, 61, 0.12)' }]}>
              <MaterialIcons name="trending-up" size={24} color={COLORS.success} />
            </View>
            <Text style={styles.statLabel}>Conversions</Text>
            <Text style={styles.statValue}>
              {data?.leadsChannelPerformance?.reduce((acc: number, curr: any) => acc + curr.converted_leads, 0) || 0}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expense Distribution</Text>
          <View style={styles.card}>
            <SimplePieChart data={expenseChartData} />
          </View>
        </View>

        {/* Recent Site Photo Submissions Feed */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Site Photo Submissions</Text>
          {recentPhotos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalFeedContainer}>
              {recentPhotos.map((photo: any) => (
                <View key={photo.id} style={styles.adminFeedCard}>
                  <View style={styles.adminCardHeader}>
                    <View style={styles.avatarContainer}>
                      <Text style={styles.avatarText}>{photo.supervisor_name ? photo.supervisor_name.charAt(0).toUpperCase() : 'S'}</Text>
                    </View>
                    <View style={{ marginLeft: 8, flex: 1 }}>
                      <Text style={styles.adminSupervisorName} numberOfLines={1}>{photo.supervisor_name}</Text>
                      <Text style={styles.adminSiteName} numberOfLines={1}>{photo.site_name}</Text>
                    </View>
                  </View>

                  <Image source={{ uri: photo.image_url }} style={styles.adminFeedImage} resizeMode="cover" />

                  <View style={styles.adminFeedDetails}>
                    <Text style={styles.adminFeedTime}>{new Date(photo.created_at).toLocaleDateString()} at {new Date(photo.created_at).toLocaleTimeString()}</Text>
                    <View style={styles.adminLocationRow}>
                      <MaterialIcons name="location-on" size={14} color={COLORS.success} />
                      <Text style={styles.adminLocationName} numberOfLines={2}>{photo.location_name}</Text>
                    </View>
                    
                    {photo.latitude && photo.longitude ? (
                      <TouchableOpacity 
                        style={styles.mapButton} 
                        onPress={() => {
                          const url = Platform.select({
                            ios: `maps:0,0?q=${photo.latitude},${photo.longitude}`,
                            android: `geo:0,0?q=${photo.latitude},${photo.longitude}`
                          }) || `https://www.google.com/maps/search/?api=1&query=${photo.latitude},${photo.longitude}`;
                          Linking.openURL(url);
                        }}
                      >
                        <MaterialIcons name="map" size={14} color="#0284C7" />
                        <Text style={styles.mapButtonText}>View on Maps</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyCard}>
              <MaterialIcons name="photo-library" size={32} color={COLORS.textLight} />
              <Text style={styles.emptyCardText}>No supervisor site updates uploaded yet.</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Site-wise Expenses</Text>
          <View style={styles.card}>
            {data?.siteWiseExpenseBreakdown?.map((exp: any, idx: number) => (
              <View key={idx} style={styles.expenseItem}>
                <View style={styles.expenseInfo}>
                  <Text style={styles.siteName}>{exp.site_name}</Text>
                  <Text style={styles.amount}>₹{Number(exp.total_expenses).toLocaleString()}</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View 
                    style={[
                      styles.progressBarFill, 
                      { 
                        backgroundColor: [COLORS.primary, COLORS.accent, COLORS.warning][idx % 3],
                        width: `${Math.min((exp.total_expenses / 100000) * 100, 100)}%` 
                      }
                    ]} 
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      </>
    );
  };

  const renderSupervisorDashboard = () => {
    const activeSites = sites.filter(s => s.status !== 'Completed');

    const walletChartData = [
      { label: 'Cash in Hand', value: Number(wallet?.cashInHand || 0), color: '#10B981' },
      { label: 'Total Spent', value: Number(wallet?.totalDebits || 0), color: '#EF4444' }
    ];

    return (
      <>
        <View style={styles.header}>
          <Text style={styles.title}>Supervisor Console</Text>
          <Text style={styles.subtitle}>Manage your assigned project sites</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.iconContainer, { backgroundColor: '#DCFCE7' }]}>
              <MaterialIcons name="account-balance-wallet" size={24} color="#15803D" />
            </View>
            <Text style={styles.statLabel}>Cash in Hand</Text>
            <Text style={[styles.statValue, { color: '#10B981' }]}>
              ₹{Number(wallet?.cashInHand || 0).toLocaleString()}
            </Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.iconContainer, { backgroundColor: '#FEE2E2' }]}>
              <MaterialIcons name="payments" size={24} color="#B91C1C" />
            </View>
            <Text style={styles.statLabel}>Total Spent</Text>
            <Text style={[styles.statValue, { color: '#EF4444' }]}>
              ₹{Number(wallet?.totalDebits || 0).toLocaleString()}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Financial Summary</Text>
          <View style={styles.card}>
            <SimplePieChart data={walletChartData} />
          </View>
        </View>

        {/* Quick Site Progress Photo Upload Widget */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Site Progress Upload</Text>
          <View style={styles.card}>
            <Text style={styles.formLabel}>SELECT ACTIVE PROJECT SITE</Text>
            {activeSites.length > 0 ? (
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedUploadSiteId || ''}
                  onValueChange={(val) => setSelectedUploadSiteId(val)}
                  style={styles.picker}
                >
                  {activeSites.map((site: any) => (
                    <Picker.Item key={site.id} label={site.name} value={site.id.toString()} />
                  ))}
                </Picker>
              </View>
            ) : (
              <View style={styles.warningContainer}>
                <MaterialIcons name="warning" size={20} color={COLORS.error} />
                <Text style={styles.warningText}>No active sites assigned to you.</Text>
              </View>
            )}

            <Text style={styles.formLabel}>SITE PICTURE WITH GPS</Text>
            <View style={styles.photoUploadRow}>
              <TouchableOpacity style={styles.photoUploadButton} onPress={() => capturePhoto(true)}>
                <MaterialIcons name="photo-camera" size={22} color={COLORS.primary} />
                <Text style={styles.photoUploadButtonText}>Use Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoUploadButton} onPress={() => capturePhoto(false)}>
                <MaterialIcons name="photo-library" size={22} color={COLORS.primary} />
                <Text style={styles.photoUploadButtonText}>From Gallery</Text>
              </TouchableOpacity>
            </View>

            {capturedImageUri && (
              <View style={styles.previewBox}>
                <Image source={{ uri: capturedImageUri }} style={styles.previewImage} resizeMode="cover" />
                
                {locating ? (
                  <View style={styles.locationBanner}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.locationBannerText}>Acquiring GPS location...</Text>
                  </View>
                ) : locationData ? (
                  <View style={[styles.locationBanner, { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' }]}>
                    <MaterialIcons name="location-on" size={16} color={COLORS.success} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.locationNameText} numberOfLines={2}>{locationData.locationName}</Text>
                      <Text style={styles.coordsText}>Lat: {locationData.latitude.toFixed(6)}, Lng: {locationData.longitude.toFixed(6)}</Text>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={[styles.locationBanner, { backgroundColor: '#FFFBEB', borderColor: '#FEF3C7' }]} onPress={fetchLocation}>
                    <MaterialIcons name="gps-fixed" size={16} color={COLORS.accent} />
                    <Text style={[styles.locationBannerText, { color: '#B45309' }]}>No GPS data. Tap to retry location.</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.removeImageBtn} onPress={() => { setCapturedImageUri(null); setLocationData(null); }}>
                  <MaterialIcons name="close" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity 
              style={[
                styles.submitProgressBtn,
                (!capturedImageUri || uploadingPhoto || locating) && styles.submitProgressBtnDisabled
              ]} 
              onPress={handleUploadPhoto}
              disabled={!capturedImageUri || uploadingPhoto || locating}
            >
              {uploadingPhoto ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <MaterialIcons name="cloud-upload" size={20} color={COLORS.white} />
                  <Text style={styles.submitProgressBtnText}>UPLOAD SITE PROGRESS</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Sites</Text>
          <View style={styles.activeSitesContainer}>
            {activeSites.map((site) => (
              <View key={site.id} style={styles.activeSiteCard}>
                <View style={styles.siteHeader}>
                  <MaterialIcons name="location-city" size={18} color={COLORS.primary} />
                  <View style={{ marginLeft: 6, flex: 1 }}>
                    <Text style={styles.siteItemName} numberOfLines={1}>{site.name}</Text>
                    <Text style={styles.siteItemLocation} numberOfLines={1}>{site.location}</Text>
                  </View>
                </View>
                <View style={styles.badgeRow}>
                  <View style={styles.activeBadge}>
                    <Text style={styles.badgeText}>Active</Text>
                  </View>
                </View>
              </View>
            ))}
            {activeSites.length === 0 && (
              <View style={styles.emptyColumnState}>
                <MaterialIcons name="info-outline" size={20} color={COLORS.textLight} />
                <Text style={styles.emptyColumnText}>No active sites</Text>
              </View>
            )}
          </View>
        </View>
      </>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <AppBackground />
      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />
        }
      >
        {role === 'Admin' ? renderAdminDashboard() : renderSupervisorDashboard()}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: SPACING.lg,
    paddingBottom: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 4,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    padding: SPACING.lg,
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: COLORS.glassBg,
    width: (width - SPACING.lg * 3) / 2,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    elevation: 4,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.glassBg,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    elevation: 4,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
  expenseItem: {
    marginBottom: SPACING.lg,
  },
  expenseInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  siteName: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
  amount: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: COLORS.steel,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  siteItemCard: {
    backgroundColor: COLORS.glassBg,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    elevation: 4,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
  siteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  siteItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  siteItemLocation: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.glassBorder,
    paddingTop: SPACING.sm,
  },
  activeBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#047857',
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: COLORS.glassBorder,
  },
  emptyCardText: {
    color: COLORS.textLight,
    marginTop: 12,
    fontSize: 14,
  },
  chartContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  pieContainer: {
    height: 20,
    width: '100%',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  chartBar: {
    height: '100%',
  },
  legendContainer: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  emptyChartText: {
    color: COLORS.textLight,
    fontSize: 14,
    fontStyle: 'italic',
  },
  legendLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  legendSubtext: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 2,
  },
  activeSitesContainer: {
    backgroundColor: COLORS.glassBg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    padding: SPACING.md,
    elevation: 2,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  activeSiteCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    marginBottom: SPACING.sm,
  },
  emptyColumnState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyColumnText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 6,
    fontStyle: 'italic',
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    letterSpacing: 0,
  },
  pickerContainer: {
    backgroundColor: COLORS.steel,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: SPACING.xs,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(226, 26, 18, 0.08)',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    gap: 8,
  },
  warningText: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '700',
  },
  photoUploadRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: SPACING.md,
  },
  photoUploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.md,
    gap: 8,
  },
  photoUploadButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  previewBox: {
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    marginBottom: SPACING.md,
  },
  previewImage: {
    width: '100%',
    height: 180,
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.glassBorder,
    padding: SPACING.md,
    gap: 8,
  },
  locationBannerText: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '600',
  },
  locationNameText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '700',
  },
  coordsText: {
    fontSize: 10,
    color: COLORS.textLight,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  removeImageBtn: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: 'rgba(181, 18, 13, 0.9)',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitProgressBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    elevation: 4,
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    marginTop: SPACING.xs,
  },
  submitProgressBtnDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  submitProgressBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  horizontalFeedContainer: {
    gap: 16,
    paddingRight: SPACING.lg,
  },
  adminFeedCard: {
    backgroundColor: COLORS.glassBg,
    width: 260,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
  adminCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.glassBorder,
    backgroundColor: COLORS.white,
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  adminSupervisorName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  adminSiteName: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 1,
  },
  adminFeedImage: {
    width: '100%',
    height: 140,
  },
  adminFeedDetails: {
    padding: SPACING.md,
  },
  adminFeedTime: {
    fontSize: 10,
    color: COLORS.textLight,
    marginBottom: SPACING.xs,
  },
  adminLocationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginBottom: SPACING.sm,
  },
  adminLocationName: {
    fontSize: 11,
    color: COLORS.text,
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 6,
    gap: 6,
    backgroundColor: 'rgba(226, 26, 18, 0.06)',
  },
  mapButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
