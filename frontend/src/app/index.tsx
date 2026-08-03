import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, Platform, ViewStyle, TextStyle } from 'react-native';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link } from 'expo-router';

import { getH3Index, getHexBoundary, getFogOverlayPolygon, LatLng } from '../lib_render/h3';
import { getAllVisitedHexes, logHexVisit } from '../lib_render/db';
import { performSync } from '../lib_render/sync';
import { useAuth } from '../components/AuthContext';
import MapContainer from '../components/MapContainer';

export default function MapScreen() {
  const { isLoading, user } = useAuth();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [unlockedHexes, setUnlockedHexes] = useState<Map<string, LatLng[]>>(new Map());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load saved hexes only after AuthContext finishes loading and DB is ready
  useEffect(() => {
    if (isLoading || !user) return;

    (async () => {
      try {
        const savedHexes = await getAllVisitedHexes();
        const hexMap = new Map<string, LatLng[]>();
        savedHexes.forEach((item) => {
          hexMap.set(item.h3Index, getHexBoundary(item.h3Index));
        });
        setUnlockedHexes(hexMap);
      } catch (err) {
        console.error('Error loading hexes from local DB:', err);
      }
    })();
  }, [isLoading, user]);

  // Request location permissions
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Location permission denied');
        return;
      }
      let current = await Location.getCurrentPositionAsync({});
      setLocation(current);
    })();
  }, []);

  // Location streaming and hex unlocking
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    if (isTracking && !isLoading) {
      (async () => {
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 3000,
            distanceInterval: 5,
          },
          async (newLocation) => {
            setLocation(newLocation);
            const { latitude, longitude } = newLocation.coords;
            const h3Index = getH3Index(latitude, longitude);

            await logHexVisit(h3Index);
            performSync().catch(console.error);

            setUnlockedHexes((prev) => {
              if (prev.has(h3Index)) return prev;
              const next = new Map(prev);
              next.set(h3Index, getHexBoundary(h3Index));
              return next;
            });
          }
        );
      })();
    }

    return () => {
      if (subscription) subscription.remove();
    };
  }, [isTracking, isLoading]);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: '#fff' }}>Loading user database...</Text>
      </SafeAreaView>
    );
  }

  const fogMask = getFogOverlayPolygon(unlockedHexes);

  return (
    <SafeAreaView style={styles.container}>
      <MapContainer
        location={location}
        isTracking={isTracking}
        unlockedHexes={unlockedHexes}
        fogMask={fogMask}
      />

      <View style={styles.headerContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Fog Explorer</Text>
          <Link href="/explore" asChild>
            <TouchableOpacity style={styles.iconButton}>
              <MaterialCommunityIcons name="compass" size={24} color="#38BDF8" />
            </TouchableOpacity>
          </Link>
        </View>
        <Text style={styles.headerSubtitle}>
          {errorMsg ? errorMsg : `Revealed Hexes: ${unlockedHexes.size}`}
        </Text>
      </View>

      <View style={styles.controlBar}>
        <TouchableOpacity
          style={[styles.button, isTracking ? styles.buttonStop : styles.buttonStart]}
          onPress={() => setIsTracking(!isTracking)}
        >
          <MaterialCommunityIcons
            name={isTracking ? "pause" : "walk"}
            size={24}
            color="#FFFFFF"
          />
          <Text style={styles.buttonText}>
            {isTracking ? "Pause Walk" : "Start Exploring"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    ...(Platform.OS === 'web' ? ({ height: '100vh' } as unknown as ViewStyle) : {}),
  } as ViewStyle,
  headerContainer: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  } as ViewStyle,
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as ViewStyle,
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: 'bold',
  } as TextStyle,
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 4,
  } as TextStyle,
  iconButton: {
    padding: 4,
  } as ViewStyle,
  controlBar: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
  } as ViewStyle,
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    elevation: 5,
  } as ViewStyle,
  buttonStart: {
    backgroundColor: '#2563EB',
  } as ViewStyle,
  buttonStop: {
    backgroundColor: '#DC2626',
  } as ViewStyle,
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  } as TextStyle,
});