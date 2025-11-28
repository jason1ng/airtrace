// src/app/map/MapPage.jsx
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; 
import { fetchAirQualityData, getAQIColor } from '../../services/openaqService';

export default function MapPage() {
  const [centerPos] = useState([3.1473, 101.6991]); 
  const [airData, setAirData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const results = await fetchAirQualityData(centerPos[0], centerPos[1]);
      setAirData(results);
      setLoading(false);
    };
    loadData();
  }, [centerPos]);

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

      <MapContainer center={centerPos} zoom={12} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {airData.map((data, index) => {
          // V3: Top level object has 'value' and 'coordinates' directly
          const val = data.value;
          const lat = data.coordinates.latitude;
          const lng = data.coordinates.longitude;
          
          if (val === null || !lat || !lng) return null;

          return (
            <CircleMarker 
              key={data.sensorsId || index} // V3 uses sensorsId
              center={[lat, lng]}
              pathOptions={{ 
                color: 'white', 
                weight: 1,
                fillColor: getAQIColor(val), 
                fillOpacity: 0.8 
              }}
              radius={12}
            >
              <Popup>
                <div style={{ textAlign: "center" }}>
                  <strong>Sensor ID: {data.sensorsId}</strong>
                  <br />
                  <span style={{ fontSize: "1.2rem", fontWeight: "bold", color: getAQIColor(val) }}>
                    {val} µg/m³
                  </span>
                  <br />
                  <span style={{ fontSize: "0.8rem", color: "#666" }}>
                   PM2.5
                  </span>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}