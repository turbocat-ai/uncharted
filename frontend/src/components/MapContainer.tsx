import React from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { LatLng } from '../lib_render/h3';

interface MapContainerProps {
  location: { coords: { latitude: number; longitude: number } } | null;
  isTracking: boolean;
  unlockedHexes: Map<string, LatLng[]>;
  fogMask: { coordinates: LatLng[]; holes: LatLng[][] };
}

export default function MapContainer(props: MapContainerProps) {
  if (Platform.OS === 'web') {
    // Web Fallback: Prevents native module crashes on web browsers
    return (
      <View style={styles.webFallbackContainer}>
        <Text style={styles.webFallbackText}>
          🗺️ Web Map View
        </Text>
        <Text style={styles.webSubText}>
          {props.location
            ? `Lat: ${props.location.coords.latitude.toFixed(4)}, Lng: ${props.location.coords.longitude.toFixed(4)}`
            : 'Acquiring GPS location...'}
        </Text>
        <Text style={styles.webSubText}>
          Revealed Hexes: {props.unlockedHexes.size}
        </Text>
      </View>
    );
  }

  // Native Target (iOS/Android): Load native maps
  const MapView = require('react-native-maps').default;
  const { Polygon, PROVIDER_DEFAULT } = require('react-native-maps');

  return (
    <MapView
      style={styles.map}
      provider={PROVIDER_DEFAULT}
      initialRegion={{
        latitude: props.location ? props.location.coords.latitude : 40.7128,
        longitude: props.location ? props.location.coords.longitude : -74.0060,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }}
      showsUserLocation={true}
      followsUserLocation={props.isTracking}
    >
      <Polygon
        coordinates={props.fogMask.coordinates}
        holes={props.fogMask.holes}
        fillColor="rgba(15, 23, 42, 0.88)"
        strokeColor="rgba(15, 23, 42, 0.95)"
        strokeWidth={1}
      />
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: '100%',
  },
  webFallbackContainer: {
    flex: 1,
    backgroundColor: '#020617',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  webFallbackText: {
    color: '#38BDF8',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  webSubText: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 4,
  },
});