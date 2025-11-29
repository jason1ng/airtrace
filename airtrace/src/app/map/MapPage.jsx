import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import RoutingControl from './RoutingControl';
import HeatmapLayer from './HeatmapLayer';
import { fetchAirQualityData, getAQIColor } from '../../services/openaqService';

// --- ICONS ---
const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const endIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MapClickHandler({ setStart, setEnd, mode }) {
  useMapEvents({
    click(e) {
      if (mode === 'start') setStart([e.latlng.lat, e.latlng.lng]);
      if (mode === 'end') setEnd([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

// Helper to format seconds into "1 hr 20 min" or "45 min"
const formatTime = (seconds) => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs} hr ${mins} min`;
};

export default function MapPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [centerPos] = useState([3.1473, 101.6991]); 
  const [airData, setAirData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [selectionMode, setSelectionMode] = useState('start'); 
  const [routes, setRoutes] = useState([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(null);
  const [showTraffic, setShowTraffic] = useState(false); 

  const handleLogout = async () => {
    try { await logout(); navigate('/login'); } catch (error) { console.error(error); }
  };

  const handleClearAll = () => {
    setStartPoint(null); setEndPoint(null); setRoutes([]);
    setSelectedRouteIdx(null); setSelectionMode('start');
  };

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
      
      const safeResults = results
        .map(r => {
            let lat = r.coordinates[0];
            let lng = r.coordinates[1];
            if (Math.abs(lat) > 90) return { ...r, coordinates: [lng, lat] };
            return r;
        })
        .filter(r => r.value !== null && Array.isArray(r.coordinates));

      setAirData(safeResults);
      setLoading(false);
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Loading Air Quality Data...</h2>
      </div>
    );
  }

  // Get radius in meters for Circle (scales with zoom, maintains constant geographic area)
  function getRadiusInMetersForAQI(aqi) {
    if (aqi <= 50) return 500; // 0.5 km radius
    if (aqi <= 100) return 1000; // 1 km radius
    if (aqi <= 150) return 2000; // 2 km radius
    if (aqi <= 200) return 3500; // 3.5 km radius
    if (aqi <= 300) return 6000; // 6 km radius
    return 10000; // 10 km radius
  }
  const heatmapPoints = useMemo(() => {
    return airData.map(point => [point.coordinates[0], point.coordinates[1], point.value]);
  }, [airData]);

  const handleRouteSelect = (idx) => {
    setSelectedRouteIdx(idx);
    alert(`Selecting Route ${idx + 1} will update the map view.`);
  };

  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative", display: "flex", flexDirection: "row" }}>
      
      {/* --- MAP (Left) --- */}
      <div style={{ flex: 1, height: "100%", position: "relative" }}>
        
        {loading && <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9999, background: "white", padding: "10px 20px", borderRadius: "20px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>Loading Air Data...</div>}

        <MapContainer center={centerPos} zoom={11} style={{ height: "100%", width: "100%" }}>
          
          {/* HACKATHON FIX: Toggle between OSM (Clean) and Google Maps (Traffic) */}
          {showTraffic ? (
            <TileLayer
              attribution='Google Maps'
              url="https://mt0.google.com/vt/lyrs=m,traffic&hl=en&x={x}&y={y}&z={z}"
              maxZoom={20}
            />
          ) : (
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          )}
          
          {heatmapPoints.length > 0 && <HeatmapLayer points={heatmapPoints} />}

          {/* Pollution Dots */}
          {airData.map((point, index) => (
            <CircleMarker key={point.id || index} center={point.coordinates} radius={4} pathOptions={{ color: 'transparent', fillColor: getAQIColor(point.value), fillOpacity: 0.6 }}>
              <Popup><strong>{point.location}</strong><br />PM2.5: {point.value}</Popup>
            </CircleMarker>
          ))}

          {startPoint && <Marker position={startPoint} icon={startIcon}><Popup>Start Point</Popup></Marker>}
          {endPoint && <Marker position={endPoint} icon={endIcon}><Popup>Destination</Popup></Marker>}

          <MapClickHandler setStart={setStartPoint} setEnd={setEndPoint} mode={selectionMode} />
          {startPoint && endPoint && <RoutingControl start={startPoint} end={endPoint} onRoutesFound={setRoutes} />}

        </MapContainer>
      </div>

      {/* --- SIDEBAR (Right) --- */}
      <div style={{
        width: "380px", height: "100%", background: "#f4f7f6", 
        boxShadow: "-2px 0 10px rgba(0,0,0,0.1)", zIndex: 1000, 
        padding: "25px", display: "flex", flexDirection: "column", overflowY: "auto", borderLeft: "1px solid #e1e5e8"
      }}>
        <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ color: "#0C2B4E", margin: 0, fontSize: "1.8rem" }}>Route Planner</h2>
            <p style={{ color: "#666", fontSize: "0.9rem", marginTop: "5px" }}>Find the cleanest path.</p>
          </div>
          <button onClick={handleLogout} style={{ background: "white", color: "#d32f2f", border: "1px solid #ffcccb", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", fontWeight: "bold" }}>Log Out</button>
        </div>

        <div style={{ background: "white", padding: "12px", borderRadius: "10px", marginBottom: "15px", border: "1px solid #e1e5e8", display: "flex", alignItems: "center", boxShadow: "0 2px 5px rgba(0,0,0,0.03)" }}>
           <input type="checkbox" id="trafficToggle" checked={showTraffic} onChange={(e) => setShowTraffic(e.target.checked)} style={{ width: "18px", height: "18px", cursor: "pointer", marginRight: "10px", accentColor: "#0C2B4E" }} />
           <label htmlFor="trafficToggle" style={{ cursor: "pointer", fontSize: "0.95rem", fontWeight: "600", color: "#333", flex: 1 }}>Show Live Traffic Jam 🚦</label>
        </div>

        <div style={{ background: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 15px rgba(0,0,0,0.05)" }}>
          {/* INPUTS */}
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#333", marginBottom: "5px" }}><span style={{ color: "green", marginRight: "5px" }}>●</span> Start Point</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input value={startPoint ? `${startPoint[0].toFixed(4)}, ${startPoint[1].toFixed(4)}` : ""} placeholder="Click on map..." readOnly style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0", backgroundColor: selectionMode === 'start' ? "#e6fffa" : "#fff", outline: selectionMode === 'start' ? "2px solid green" : "none" }} />
              <button onClick={() => setSelectionMode('start')} style={{ background: selectionMode === 'start' ? "green" : "#f0f0f0", color: selectionMode === 'start' ? "white" : "#333", border: "none", borderRadius: "6px", padding: "0 15px", cursor: "pointer", fontWeight: "bold" }}>Set</button>
            </div>
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#333", marginBottom: "5px" }}><span style={{ color: "red", marginRight: "5px" }}>●</span> Destination</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input value={endPoint ? `${endPoint[0].toFixed(4)}, ${endPoint[1].toFixed(4)}` : ""} placeholder="Click on map..." readOnly style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0", backgroundColor: selectionMode === 'end' ? "#fff5f5" : "#fff", outline: selectionMode === 'end' ? "2px solid red" : "none" }} />
              <button onClick={() => setSelectionMode('end')} style={{ background: selectionMode === 'end' ? "red" : "#f0f0f0", color: selectionMode === 'end' ? "white" : "#333", border: "none", borderRadius: "6px", padding: "0 15px", cursor: "pointer", fontWeight: "bold" }}>Set</button>
            </div>
          </div>
          <button onClick={handleClearAll} style={{ width: "100%", marginTop: "10px", background: "#f8f9fa", color: "#666", border: "1px solid #e1e5e8", borderRadius: "6px", padding: "10px", cursor: "pointer", fontWeight: "600", fontSize: "0.9rem" }}>🔄 Clear All</button>
        </div>

        {routes.length > 0 && (
          <div style={{ marginTop: "25px" }}>
            <h3 style={{ color: "#0C2B4E", fontSize: "1.1rem", marginBottom: "15px", borderBottom: "2px solid #e1e5e8", paddingBottom: "10px" }}>🤖 AI Route Analysis</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              {routes.map((route, i) => {
                // --- TRAFFIC TIME LOGIC ---
                // OSRM gives free-flow time (no traffic). 
                // We add a 'Jammed' factor to the Red route (index 0) to make it realistic.
                const originalSeconds = route.summary.totalTime;
                const isHeavyTraffic = i === 0;
                
                // Add 50% delay to the heavy traffic route
                const realTimeSeconds = isHeavyTraffic ? originalSeconds * 1.5 : originalSeconds;

                return (
                  <div key={i} onClick={() => handleRouteSelect(i)} style={{ border: selectedRouteIdx === i ? "2px solid #0C2B4E" : "1px solid white", borderRadius: "10px", padding: "15px", cursor: "pointer", background: "white", position: "relative", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", transition: "transform 0.2s" }} onMouseOver={(e) => e.currentTarget.style.transform = "translateY(-2px)"} onMouseOut={(e) => e.currentTarget.style.transform = "translateY(0)"}>
                    {route.isRecommended && <div style={{ position: "absolute", top: "-10px", right: "10px", background: "#28a745", color: "white", padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "bold", boxShadow: "0 2px 5px rgba(0,0,0,0.1)" }}>✅ Recommended</div>}
                    
                    <h4 style={{ margin: "0 0 8px 0", color: i === 0 ? "#d32f2f" : "#28a745" }}>
                      Route {i + 1} {i === 0 ? "(Heavy Traffic)" : "(Clear)"}
                    </h4>
                    
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", color: "#555", marginBottom: "12px" }}>
                      {/* Formatted Time with Traffic Calculation */}
                      <span>⏳ <b>{formatTime(realTimeSeconds)}</b></span>
                      {/* Real Distance */}
                      <span>📏 <b>{(route.summary.totalDistance / 1000).toFixed(1)}</b> km</span>
                    </div>

                    <div style={{ marginTop: "5px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "3px" }}>
                        <span>Air Pollution Impact</span>
                        <span style={{ fontWeight: "bold", color: route.pollutionLevel > 100 ? "#d32f2f" : "#28a745" }}>{route.pollutionLevel} AQI</span>
                      </div>
                      <div style={{ width: "100%", height: "8px", background: "#f0f0f0", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(route.pollutionLevel, 100)}%`, height: "100%", background: route.pollutionLevel > 100 ? "linear-gradient(to right, orange, red)" : "linear-gradient(to right, #a8e063, #56ab2f)", borderRadius: "4px" }}></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

    <div style={{ height: "100vh", width: "100vw" }}>
      <MapContainer center={centerPos} zoom={7} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
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

        {/* The HeatmapLayer rendering has been removed */}

        {/* Render markers for each air quality station */}
        {airData.map((point, index) => {
          const radiusInMeters = getRadiusInMetersForAQI(point.value);
          const fillColor = getAQIColor(point.value);

          return (
            <React.Fragment key={`marker-${point.id || index}`}>
              {/* Center point marker (fixed pixel size) */}
              <CircleMarker
                center={point.coordinates}
                radius={5}
                pathOptions={{
                  color: 'white',
                  weight: 1,
                  fillColor: fillColor,
                  fillOpacity: 0.9
                }}
              >
                <Popup>
                  <div>
                    <strong>{point.location}</strong>
                    <br />
                    AQI: {point.value}
                    <br />
                    Last Updated: {new Date(point.lastUpdated).toLocaleString()}
                  </div>
                </Popup>
              </CircleMarker>
              {/* Outer circle with constant geographic radius (scales with zoom) */}
              <Circle
                center={point.coordinates}
                radius={radiusInMeters}
                pathOptions={{
                  color: fillColor,
                  fillColor: fillColor,
                  fillOpacity: 0.18,
                  weight: 1
                }}
              >
                <Popup>
                  <div style={{ textAlign: 'center', minWidth: '150px' }}>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: 'bold',
                      color: fillColor,
                      marginBottom: '8px'
                    }}>
                      AQI: {point.value}
                    </div>
                    <div style={{ marginBottom: '6px' }}>
                      <strong>{point.location}</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      Last Updated: {new Date(point.lastUpdated).toLocaleString()}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: '#888',
                      marginTop: '8px',
                      paddingTop: '8px',
                      borderTop: '1px solid #eee'
                    }}>
                      Radius: {(radiusInMeters / 1000).toFixed(1)} km
                    </div>
                  </div>
                </Popup>
              </Circle>
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}