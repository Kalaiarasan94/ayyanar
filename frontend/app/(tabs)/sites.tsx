import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { adminService } from '../../services/api';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/Theme';
import AppBackground from '../components/AppBackground';

export default function SitesScreen() {
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSites = async () => {
    try {
      const data = await adminService.getSites();
      setSites(data);
    } catch (error) {
      console.error('Error fetching sites:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSites();
  };

  const renderSite = ({ item }: { item: any }) => (
    <View style={styles.siteCard}>
      <View style={styles.siteIcon}>
        <MaterialIcons name="location-city" size={24} color="#E21A12" />
      </View>
      <View style={styles.siteInfo}>
        <Text style={styles.siteName}>{item.name}</Text>
        <Text style={styles.siteLocation}>{item.location}</Text>
        <View style={styles.supervisorRow}>
          <MaterialIcons name="person" size={14} color={COLORS.textLight} />
          <Text style={styles.supervisorName}>
            {item.supervisor_name || 'No supervisor assigned'}
          </Text>
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={24} color="#E21A12" />
    </View>
  );

  if (loading && !sites.length) {
    return (
      <View style={styles.center}>
        <AppBackground />
        <ActivityIndicator size="large" color="#E21A12" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppBackground />
      <FlatList
        data={sites}
        renderItem={renderSite}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E21A12" colors={["#E21A12"]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="location-off" size={48} color="rgba(226, 26, 18, 0.3)" />
            <Text style={styles.emptyText}>No sites found</Text>
          </View>
        }
      />
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
  listContent: {
    padding: SPACING.md,
  },
  siteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    padding: SPACING.md,
    borderRadius: 24,
    marginBottom: SPACING.md,
    elevation: 4,
    shadowColor: '#E21A12',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
  },
  siteIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(226, 26, 18, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  siteInfo: {
    flex: 1,
  },
  siteName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  siteLocation: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  supervisorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  supervisorName: {
    fontSize: 12,
    color: COLORS.textLight,
    marginLeft: 4,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    marginTop: 10,
    color: COLORS.textLight,
    fontSize: 16,
    fontWeight: '600',
  },
});
