import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchAirQualityData, getAQIColor } from '../../services/openaqService';
import HeatmapLayer from './HeatmapLayer';

export default function MapPage() {
  const [centerPos] = useState([4.2105, 101.9758]); // Center of Malaysia
  const [airData, setAirData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const results = await fetchAirQualityData();
      
      // Strict safety filter to prevent Map crashes
      const safeResults = results.filter(r => 
        r.value !== null &&
        Array.isArray(r.coordinates) && 
        r.coordinates.length === 2 &&
        typeof r.coordinates[0] === 'number' && !isNaN(r.coordinates[0]) &&
        typeof r.coordinates[1] === 'number' && !isNaN(r.coordinates[1])
      );

      console.log(`Map loaded with ${safeResults.length} valid points.`);
      setAirData(safeResults);
      setLoading(false);
    };
    loadData();
  }, []);

  // --- FIX 1: useMemo ---
  // This prevents the heatmap data from being "new" on every render.
  // This stops the map from destroying/re-creating the layer 60 times a second.
  const heatmapPoints = useMemo(() => {
    return airData.map(point => [
      point.coordinates[0], // lat
      point.coordinates[1], // lng
      point.value           // intensity
    ]);
  }, [airData]);

  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative" }}>

      {loading && (
        <div style={{
          position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, background: "white", padding: "10px 20px", borderRadius: "20px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.2)", fontWeight: "bold"
        }}>
          Loading Live Air Data...
        </div>
      )}

      <MapContainer center={centerPos} zoom={6} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <TileLayer
          attribution='TomTom Traffic'
          url="https://api.tomtom.com/traffic/map/4/tile/flow/absolute/{z}/{x}/{y}.png?key=a6d3383c-e57d-461d-886b-c95a5f4c53a1"
          maxZoom={18}
          minZoom={0}
          zIndex={1000}
        />

        {/* Render Heatmap only if we have data */}
        {heatmapPoints.length > 0 && <HeatmapLayer points={heatmapPoints} />}

        {/* --- FIX 2: Unique Keys --- */}
        {airData.map((point, index) => (
          <CircleMarker 
            // Use point.id if available, otherwise fallback to index.
            // This fixes the "Each child in a list should have a unique key" warning.
            key={point.id || index} 
            center={point.coordinates} 
            radius={5} 
            pathOptions={{ 
              color: 'white', 
              weight: 1,
              fillColor: getAQIColor(point.value), 
              fillOpacity: 0.9 
            }}
          >
            <Popup>
              <div style={{ textAlign: 'center' }}>
                <strong>{point.location}</strong>
                <br />
                PM2.5: <b>{point.value}</b> µg/m³
              </div>
            </Popup>
          </CircleMarker>
        ))}

      </MapContainer>
    </div>
  );
}