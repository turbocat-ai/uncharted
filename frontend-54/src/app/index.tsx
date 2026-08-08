import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  ViewStyle,
  TextStyle,
  TextInput,
} from 'react-native';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link } from 'expo-router';

// 1. Ensure polyfill imports first if needed
import 'text-encoding-polyfill';

import { getH3Index, getHexBoundary, getFogOverlayPolygon, LatLng } from '../lib_render/h3';
import { getAllVisitedHexes, logHexVisit } from '../lib_render/db';
import { performSync } from '../lib_render/sync';
import { useAuth } from '../components/AuthContext';
import MapContainer from '../components/MapContainer';

// Explicit debug mode toggle from .env (defaults to false if not set to 'true')
const IS_DEBUG = process.env.EXPO_PUBLIC_DEBUG_MODE === 'true';

// Default starting point fallback if GPS is unavailable
const DEFAULT_DEBUG_COORDS = { latitude: 40.7128, longitude: -74.0060 };

export default function MapScreen() {
  const { isLoading, user } = useAuth();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [unlockedHexes, setUnlockedHexes] = useState<Map<string, LatLng[]>>(new Map());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Debug inputs
  const [manualLat, setManualLat] = useState<string>('');
  const [manualLng, setManualLng] = useState<string>('');

  // Helper to process coordinate updates & reveal hexes
  const processNewCoordinates = useCallback(async (lat: number, lng: number) => {
    try {
      const h3Index = getH3Index(lat, lng);
      console.log(`[${IS_DEBUG ? 'DEBUG MOCK' : 'GPS Update'}] Unlocking hex:`, h3Index);

      // 1. Save to local SQLite
      await logHexVisit(h3Index);

      // 2. Queue for server sync asynchronously
      performSync().catch((syncErr) => console.error('[Sync Error]:', syncErr));

      // 3. Update active map fog-mask state
      setUnlockedHexes((prev) => {
        if (prev.has(h3Index)) return prev;
        const next = new Map(prev);
        next.set(h3Index, getHexBoundary(h3Index));
        return next;
      });
    } catch (err) {
      console.error('[Process Coords Error]:', err);
    }
  }, []);

  // Load previously saved hexes from SQLite when DB/User is ready
  useEffect(() => {
    if (isLoading || !user) return;

    let isMounted = true;
    (async () => {
      try {
        const savedHexes = await getAllVisitedHexes();
        if (!isMounted) return;

        const hexMap = new Map<string, LatLng[]>();
        savedHexes.forEach((item) => {
          hexMap.set(item.h3Index, getHexBoundary(item.h3Index));
        });
        setUnlockedHexes(hexMap);
      } catch (err) {
        console.error('Error loading hexes from local DB:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isLoading, user]);

  // Initial Location Request (Real GPS vs Debug Mock)
  useEffect(() => {
    (async () => {
      if (IS_DEBUG) {
        const mockLoc = createMockLocationObject(
          DEFAULT_DEBUG_COORDS.latitude,
          DEFAULT_DEBUG_COORDS.longitude
        );
        setLocation(mockLoc);
        return;
      }

      // Request real iOS Location Permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Location permission denied');
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(current);
    })();
  }, []);

  // Real GPS Streaming (Runs when isTracking is true and IS_DEBUG is false)
  useEffect(() => {
    if (IS_DEBUG) return;

    let subscription: Location.LocationSubscription | null = null;
    let isSubscribed = true;

    if (isTracking && !isLoading && user) {
      (async () => {
        try {
          // Immediately unlock current location upon starting exploration
          if (location) {
            await processNewCoordinates(location.coords.latitude, location.coords.longitude);
          }

          const sub = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 3000,
              distanceInterval: 5, // Update every 5 meters moved
            },
            async (newLocation) => {
              if (!isSubscribed) return;
              setLocation(newLocation);
              await processNewCoordinates(
                newLocation.coords.latitude,
                newLocation.coords.longitude
              );
            }
          );

          if (isSubscribed) {
            subscription = sub;
          } else {
            sub.remove();
          }
        } catch (err) {
          console.error('[Location Watcher Error]:', err);
        }
      })();
    }

    return () => {
      isSubscribed = false;
      if (subscription) subscription.remove();
    };
  }, [isTracking, isLoading, user, processNewCoordinates]);

  // Toggle Tracking & unlock current starting hex immediately
  const toggleTracking = async () => {
    const nextState = !isTracking;
    setIsTracking(nextState);

    if (nextState && location) {
      await processNewCoordinates(location.coords.latitude, location.coords.longitude);
    }
  };

  // ---------------------------------------------------------------------------
  // DEBUG MOCK CONTROLLERS
  // ---------------------------------------------------------------------------
  const createMockLocationObject = (lat: number, lng: number): Location.LocationObject => ({
    coords: {
      latitude: lat,
      longitude: lng,
      altitude: 0,
      accuracy: 5,
      altitudeAccuracy: 5,
      heading: 0,
      speed: 1.5,
    },
    timestamp: Date.now(),
  });

  const handleMockMove = async (latOffset: number, lngOffset: number) => {
    const currentLat = location?.coords.latitude ?? DEFAULT_DEBUG_COORDS.latitude;
    const currentLng = location?.coords.longitude ?? DEFAULT_DEBUG_COORDS.longitude;

    const newLat = currentLat + latOffset;
    const newLng = currentLng + lngOffset;

    const newMockLocation = createMockLocationObject(newLat, newLng);
    setLocation(newMockLocation);

    if (isTracking) {
      await processNewCoordinates(newLat, newLng);
    }
  };

  const handleManualCoordinateSubmit = async () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);

    if (isNaN(lat) || isNaN(lng)) {
      console.warn('Invalid coordinates typed into debug panel');
      return;
    }

    const newMockLocation = createMockLocationObject(lat, lng);
    setLocation(newMockLocation);

    if (isTracking) {
      await processNewCoordinates(lat, lng);
    }
  };

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

      {/* Header Bar */}
      <View style={styles.headerContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Fog Explorer {IS_DEBUG && '(DEBUG)'}</Text>
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

      {/* DEBUG TOOL OVERLAY */}
      {IS_DEBUG && (
        <View style={styles.debugPanel}>
          <Text style={styles.debugTitle}>🛠️ Dev Mock Controls</Text>
          <Text style={styles.debugCoordsText}>
            Lat: {location?.coords.latitude.toFixed(5)} | Lng:{' '}
            {location?.coords.longitude.toFixed(5)}
          </Text>

          <View style={styles.debugBtnRow}>
            <TouchableOpacity style={styles.debugBtn} onPress={() => handleMockMove(0.002, 0)}>
              <Text style={styles.debugBtnText}>↑ North</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.debugBtn} onPress={() => handleMockMove(-0.002, 0)}>
              <Text style={styles.debugBtnText}>↓ South</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.debugBtn} onPress={() => handleMockMove(0, 0.002)}>
              <Text style={styles.debugBtnText}>→ East</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.debugBtn} onPress={() => handleMockMove(0, -0.002)}>
              <Text style={styles.debugBtnText}>← West</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.manualInputRow}>
            <TextInput
              style={styles.debugInput}
              placeholder="Lat (e.g. 40.712)"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              value={manualLat}
              onChangeText={setManualLat}
            />
            <TextInput
              style={styles.debugInput}
              placeholder="Lng (e.g. -74.006)"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              value={manualLng}
              onChangeText={setManualLng}
            />
            <TouchableOpacity
              style={styles.debugSetBtn}
              onPress={handleManualCoordinateSubmit}
            >
              <Text style={styles.debugBtnText}>Teleport</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main Control Bar */}
      <View style={styles.controlBar}>
        <TouchableOpacity
          style={[styles.button, isTracking ? styles.buttonStop : styles.buttonStart]}
          onPress={toggleTracking}
        >
          <MaterialCommunityIcons
            name={isTracking ? 'pause' : 'walk'}
            size={24}
            color="#FFFFFF"
          />
          <Text style={styles.buttonText}>
            {isTracking ? 'Pause Walk' : 'Start Exploring'}
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
  debugPanel: {
    position: 'absolute',
    top: 130,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38BDF8',
  } as ViewStyle,
  debugTitle: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 2,
  } as TextStyle,
  debugCoordsText: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 8,
  } as TextStyle,
  debugBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  } as ViewStyle,
  debugBtn: {
    backgroundColor: '#334155',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  } as ViewStyle,
  debugBtnText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  } as TextStyle,
  manualInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  } as ViewStyle,
  debugInput: {
    flex: 1,
    backgroundColor: '#0F172A',
    color: '#FFF',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#475569',
  } as TextStyle,
  debugSetBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
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