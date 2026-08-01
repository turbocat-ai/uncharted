import React, { useEffect } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { LatLng } from '../lib_render/h3';

interface MapContainerProps {
  location: { coords: { latitude: number; longitude: number } } | null;
  isTracking: boolean;
  unlockedHexes: Map<string, LatLng[]>;
  fogMask: { coordinates: LatLng[]; holes: LatLng[][] };
}

export default function MapContainer(props: MapContainerProps) {
  // Inject Leaflet CSS for Web
  useEffect(() => {
    if (Platform.OS === 'web') {
      const linkId = 'leaflet-css';
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
    }
  }, []);

  if (Platform.OS === 'web') {
    // Dynamic import to prevent SSR/Native bundling issues
    const {
      MapContainer: LeafletMap,
      TileLayer,
      Polygon: LeafletPolygon,
      CircleMarker,
      useMap,
    } = require('react-leaflet');

    // Helper component: Re-centers map automatically when GPS location arrives
    function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
      const map = useMap();
      useEffect(() => {
        map.setView([lat, lng], map.getZoom());
      }, [lat, lng, map]);
      return null;
    }

    const centerLat = props.location?.coords.latitude;
    const centerLng = props.location?.coords.longitude;

    // Format boundaries for Leaflet [lat, lng]
    const outerBounds: [number, number][] = props.fogMask.coordinates.map((p) => [
      p.latitude,
      p.longitude,
    ]);
    const holes: [number, number][][] = props.fogMask.holes.map((hex) =>
      hex.map((p) => [p.latitude, p.longitude])
    );

    // Leaflet Polygon hole structure: [outerPolygon, hole1, hole2, ...]
    const polygonPositions: any = [outerBounds, ...holes];

    return (
      <View style={styles.webMapWrapper}>
        <LeafletMap
          center={[centerLat ?? 40.7128, centerLng ?? -74.0060]}
          zoom={17}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
        >
          {/* Automatically pan map from NYC default to real GPS location */}
          {centerLat && centerLng && <RecenterMap lat={centerLat} lng={centerLng} />}

          {/* Base Map Tiles */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />

          {/* Dark Fog Mask with Hexagon Cutouts */}
          <LeafletPolygon
            positions={polygonPositions}
            pathOptions={{
              color: '#0f172a',
              fillColor: '#0f172a',
              fillOpacity: 0.9,
              weight: 1,
            }}
          />

          {/* User Location Blue Dot */}
          {centerLat && centerLng && (
            <CircleMarker
              center={[centerLat, centerLng]}
              radius={7}
              pathOptions={{
                fillColor: '#2563EB',
                fillOpacity: 1,
                color: '#FFFFFF',
                weight: 2,
              }}
            />
          )}
        </LeafletMap>
      </View>
    );
  }

  // Mobile Native Target (iOS/Android)
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
  webMapWrapper: {
    width: '100%',
    height: '100%',
  },
});