import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, SafeAreaView, Platform, ViewStyle, TextStyle } from 'react-native';
import { Link } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getAllVisitedHexes, UserHex } from '../lib_render/db';

export default function ExploreScreen() {
  const [hexes, setHexes] = useState<UserHex[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await getAllVisitedHexes();
        setHexes(data);
      } catch (err) {
        console.error('Failed to load exploration stats:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Resolution 10 H3 hexes are approximately 15,000 sq ft or ~1,400 sq meters
  const totalHexes = hexes.length;
  const totalAreaSqMeters = totalHexes * 1400;
  const totalAreaSqMiles = (totalAreaSqMeters / 2589988).toFixed(3);

  const mostVisitedCount = hexes.reduce((max, hex) => (hex.visitCount > max ? hex.visitCount : max), 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header Navigation */}
        <View style={styles.header}>
          <Link href="/" asChild>
            <TouchableOpacity style={styles.backButton}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#F8FAFC" />
            </TouchableOpacity>
          </Link>
          <Text style={styles.title}>Exploration Stats</Text>
        </View>

        {/* Primary Stat Card */}
        <View style={styles.card}>
          <MaterialCommunityIcons name="map-marker-path" size={32} color="#38BDF8" />
          <Text style={styles.cardValue}>{totalHexes}</Text>
          <Text style={styles.cardLabel}>Hexagons Unlocked</Text>
        </View>

        {/* Grid Stats */}
        <View style={styles.grid}>
          <View style={[styles.card, styles.gridCard]}>
            <MaterialCommunityIcons name="texture-box" size={28} color="#60A5FA" />
            <Text style={styles.gridValue}>{totalAreaSqMiles} sq mi</Text>
            <Text style={styles.cardLabel}>Area Revealed</Text>
          </View>

          <View style={[styles.card, styles.gridCard]}>
            <MaterialCommunityIcons name="repeat" size={28} color="#34D399" />
            <Text style={styles.gridValue}>{mostVisitedCount}</Text>
            <Text style={styles.cardLabel}>Top Hex Visits</Text>
          </View>
        </View>

        {/* Discovery History */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Recent Discoveries</Text>

          {loading ? (
            <Text style={styles.emptyText}>Loading history...</Text>
          ) : hexes.length === 0 ? (
            <Text style={styles.emptyText}>No hexes unlocked yet. Go take a walk!</Text>
          ) : (
            hexes.slice(-5).reverse().map((item) => {
              const dateObj = new Date(item.firstVisitedAt);
              return (
                <View key={item.h3Index} style={styles.historyRow}>
                  <View>
                    <Text style={styles.hexCode}>{item.h3Index}</Text>
                    <Text style={styles.hexDate}>
                      {dateObj.toLocaleDateString()} at{' '}
                      {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.visitCount} visits</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    ...(Platform.OS === 'web' ? ({ minHeight: '100vh' } as unknown as ViewStyle) : {}),
  } as ViewStyle,
  scrollContent: {
    padding: 20,
  } as ViewStyle,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  } as ViewStyle,
  backButton: {
    padding: 8,
    marginRight: 12,
    backgroundColor: '#1E293B',
    borderRadius: 8,
  } as ViewStyle,
  title: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: 'bold',
  } as TextStyle,
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  } as ViewStyle,
  cardValue: {
    color: '#F8FAFC',
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: 8,
  } as TextStyle,
  cardLabel: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 4,
  } as TextStyle,
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  } as ViewStyle,
  gridCard: {
    flex: 1,
    padding: 16,
  } as ViewStyle,
  gridValue: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  } as TextStyle,
  historySection: {
    marginTop: 12,
  } as ViewStyle,
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  } as TextStyle,
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    fontStyle: 'italic',
  } as TextStyle,
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  } as ViewStyle,
  hexCode: {
    color: '#38BDF8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    fontWeight: '600',
  } as TextStyle,
  hexDate: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  } as TextStyle,
  badge: {
    backgroundColor: '#0369A1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  } as ViewStyle,
  badgeText: {
    color: '#E0F2FE',
    fontSize: 12,
    fontWeight: '500',
  } as TextStyle,
});