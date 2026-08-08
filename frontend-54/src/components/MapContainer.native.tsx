// src/components/MapContainer.native.tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Polygon, PROVIDER_DEFAULT } from 'react-native-maps';
import { LatLng } from '../lib_render/h3';

interface MapContainerProps {
  location: { coords: { latitude: number; longitude: number } } | null;
  isTracking: boolean;
  unlockedHexes: Map<string, LatLng[]>;
  fogMask: { coordinates: LatLng[]; holes: LatLng[][] };
}

export default function MapContainer(props: MapContainerProps) {
  return (
    <MapView
      style={styles.map}
      provider={PROVIDER_DEFAULT}
      initialRegion={{
        latitude: props.location?.coords.latitude ?? 40.7128,
        longitude: props.location?.coords.longitude ?? -74.0060,
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
        zIndex={100}
      />
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: '100%',
  },
});