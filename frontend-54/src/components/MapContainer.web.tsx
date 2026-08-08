// src/components/MapContainer.web.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { LatLng } from '../lib_render/h3';

interface MapContainerProps {
  location: { coords: { latitude: number; longitude: number } } | null;
  isTracking: boolean;
  unlockedHexes: Map<string, LatLng[]>;
  fogMask: { coordinates: LatLng[]; holes: LatLng[][] };
}

export default function MapContainer(props: MapContainerProps) {
  const [LeafletComponents, setLeafletComponents] = useState<any>(null);

  // 1. Dynamic client-side import to bypass Node SSR
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Inject Leaflet CSS
      const linkId = 'leaflet-css';
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Dynamically load react-leaflet strictly in the browser
      import('react-leaflet').then((mod) => {
        setLeafletComponents({
          LeafletMap: mod.MapContainer,
          TileLayer: mod.TileLayer,
          LeafletPolygon: mod.Polygon,
          CircleMarker: mod.CircleMarker,
          useMap: mod.useMap,
        });
      });
    }
  }, []);

  // SSR / Loading fallback
  if (!LeafletComponents) {
    return (
      <View style={styles.webMapWrapper}>
        <Text style={{ color: '#94a3b8', textAlign: 'center', marginTop: 40 }}>
          Loading Web Map...
        </Text>
      </View>
    );
  }

  const { LeafletMap, TileLayer, LeafletPolygon, CircleMarker, useMap } = LeafletComponents;

  function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
    const map = useMap();
    useEffect(() => {
      map.setView([lat, lng], map.getZoom());
    }, [lat, lng, map]);
    return null;
  }

  const centerLat = props.location?.coords.latitude;
  const centerLng = props.location?.coords.longitude;

  const outerBounds: [number, number][] = props.fogMask.coordinates.map((p) => [
    p.latitude,
    p.longitude,
  ]);
  const holes: [number, number][][] = props.fogMask.holes.map((hex) =>
    hex.map((p) => [p.latitude, p.longitude])
  );

  const polygonPositions: any = [outerBounds, ...holes];

  return (
    <View style={styles.webMapWrapper}>
      <LeafletMap
        center={[centerLat ?? 40.7128, centerLng ?? -74.0060]}
        zoom={17}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        {centerLat && centerLng && <RecenterMap lat={centerLat} lng={centerLng} />}

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        <LeafletPolygon
          positions={polygonPositions}
          pathOptions={{
            color: '#0f172a',
            fillColor: '#0f172a',
            fillOpacity: 0.9,
            weight: 1,
          }}
        />

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

const styles = StyleSheet.create({
  webMapWrapper: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0f172a',
  },
});