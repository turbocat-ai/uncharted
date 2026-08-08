import { useEffect } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { LatLng } from '../lib_render/h3';

interface MapContainerProps {
  location: { coords: { latitude: number; longitude: number } } | null;
  isTracking: boolean;
  unlockedHexes: Map<string, LatLng[]>;
  fogMask: { coordinates: LatLng[]; holes: LatLng[][] };
}

// -----------------------------------------------------------------------------
// MOBILE NATIVE MAP COMPONENT (Lazy / Platform Isolated)
// -----------------------------------------------------------------------------
const NativeMap = (props: MapContainerProps) => {
  // Only evaluate react-native-maps require on native devices
  const maps = require('react-native-maps');
  const MapView = maps.default;
  const Polygon = maps.Polygon;
  const PROVIDER_DEFAULT = maps.PROVIDER_DEFAULT;

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
      />
    </MapView>
  );
};

// -----------------------------------------------------------------------------
// MAIN CROSS-PLATFORM CONTAINER
// -----------------------------------------------------------------------------
export default function MapContainer(props: MapContainerProps) {
  // Inject Leaflet CSS for Web dynamically
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

  // WEB RENDER PATH
  if (Platform.OS === 'web') {
    const {
      MapContainer: LeafletMap,
      TileLayer,
      Polygon: LeafletPolygon,
      CircleMarker,
      useMap,
    } = require('react-leaflet');

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

  // MOBILE NATIVE RENDER PATH
  return <NativeMap {...props} />;
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