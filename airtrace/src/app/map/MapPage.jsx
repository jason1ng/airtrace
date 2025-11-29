import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMapEvents, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// COMPONENTS & SERVICES (Ensure these paths are correct in your project)
import RoutingControl from './RoutingControl';
import WindLayer from './WindLayer';
import { fetchAirQualityData, getAQIColor } from '../../services/aqicnService';
import AQINotification from '../../components/AQINotification';

// --- ICONS ---
// Fix for custom marker icons using external URLs
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

// --- HELPER FUNCTIONS ---

/**
 * Converts seconds to a human-readable time string (e.g., "1h 30m").
 */
const formatTime = (seconds) => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

/**
 * Calculates a radius size (in meters) for the AQI Circle.
 * 1km
 */
function getRadiusInMetersForAQI(aqi) {
  if (aqi <= 50) return 500;
  if (aqi <= 100) return 1000;
  if (aqi <= 150) return 2000;
  if (aqi <= 200) return 3500;
  if (aqi <= 300) return 6000;
  return 10000;
}

// --- MAP CLICK HANDLER COMPONENT ---

/**
 * Component to listen for map clicks and set the start/end points.
 */
const MapClickHandler = ({ setStart, setEnd, mode }) => {
  useMapEvents({
    click: (e) => {
      if (mode === 'start') {
        setStart([e.latlng.lat, e.latlng.lng]);
      } else if (mode === 'end') {
        setEnd([e.latlng.lat, e.latlng.lng]);
      }
    },
  });
  return null;
};


// ----------------------------------------------------------------------------------
// --- MAIN COMPONENT ---
// ----------------------------------------------------------------------------------

export default function MapPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [centerPos] = useState([3.1473, 101.6991]);
  const [airData, setAirData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [selectionMode, setSelectionMode] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(null);
  
  // TOGGLES & BASE LAYER STATE
  const [showTraffic, setShowTraffic] = useState(false);
  const [showPollutionMarkers, setShowPollutionMarkers] = useState(true);
  const [showWind, setShowWind] = useState(false); 
  // NEW: State for switching base map style
  const [baseLayerUrl, setBaseLayerUrl] = useState("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");


  const handleLogout = async () => {
    try { await logout(); navigate('/login'); } catch (error) { console.error(error); }
  };

  const handleClearAll = () => {
    setStartPoint(null); setEndPoint(null); setRoutes([]);
    setSelectedRouteIdx(null); setSelectionMode(null);
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const results = await fetchAirQualityData();

      // Basic coordinate validation/fix
      const safeResults = results
        .map(r => {
          let lat = r.coordinates[0];
          let lng = r.coordinates[1];
          // Simple check to swap (lng, lat) to (lat, lng) if the API returns them swapped
          if (Math.abs(lat) > 90) return { ...r, coordinates: [lng, lat] }; 
          return r;
        })
        .filter(r => r.value !== null && Array.isArray(r.coordinates));

      setAirData(safeResults);
      setLoading(false);
    };

    loadData();
  }, []);

  const handleRouteSelect = (idx) => {
    setSelectedRouteIdx(idx);
    alert(`Route ${idx + 1} selected!`); // Simple alert for feedback
  };

  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative", display: "flex", flexDirection: "row" }}>
      
      {/* AQI Notification Component */}
      <AQINotification />

      {/* --- MAP (Left) --- */}
      <div style={{ flex: 1, height: "100%", position: "relative" }}>

        {loading && <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9999, background: "white", padding: "10px 20px", borderRadius: "20px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>Loading Air Data...</div>}

        <MapContainer center={centerPos} zoom={11} style={{ height: "100%", width: "100%" }}>

          {/* Base Layer - NOW DYNAMIC */}
          <TileLayer
            attribution='&copy; OpenStreetMap | CartoDB'
            url={baseLayerUrl}
          />
          
          {/* TRAFFIC LAYER */}
          {showTraffic && (
            <TileLayer
              attribution='Google Maps'
              url="https://mt0.google.com/vt/lyrs=m,traffic&hl=en&x={x}&y={y}&z={z}"
              maxZoom={20}
              zIndex={500}
            />
          )}

          {/* WIND LAYER (New) */}
          <WindLayer show={showWind} />
          
          {/* Pollution Dots & Circles */}
          {showPollutionMarkers && airData.map((point, index) => {
            const radiusInMeters = getRadiusInMetersForAQI(point.value);
            const fillColor = getAQIColor(point.value);

            // Define the popup content once to reuse it
            const PopupContent = (
              <Popup>
                <div style={{ textAlign: 'center', minWidth: '150px' }}>
                  <div
                    style={{
                      fontSize: '18px',
                      fontWeight: 'bold',
                      color: fillColor,
                      marginBottom: '8px',
                      WebkitTextStroke: '0.5px black',   // outline thickness + color
                      textStroke: '0.5px black'          // fallback for some browsers
                    }}
                  >
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
            );

            return (
              <React.Fragment key={`marker-${point.id || index}`}>
                {/* The Center Point - Has Popup */}
                <CircleMarker
                  center={point.coordinates}
                  radius={4}
                  pathOptions={{
                    color: 'white',        // outline color
                    weight: 2,             // outline thickness
                    fillColor: fillColor,  // inside color
                    fillOpacity: 0.9
                  }}
                >
                  {PopupContent}
                </CircleMarker>


                {/* The Large Radius Circle - NOW HAS POPUP TOO */}
                <Circle center={point.coordinates} radius={radiusInMeters} pathOptions={{ color: fillColor, fillColor: fillColor, fillOpacity: 0.25, weight: 1 }}>
                  {PopupContent}
                </Circle>
              </React.Fragment>
            );
          })}

          {startPoint && <Marker position={startPoint} icon={startIcon}><Popup>Start Point</Popup></Marker>}
          {endPoint && <Marker position={endPoint} icon={endIcon}><Popup>Destination</Popup></Marker>}

          {/* Render all 5 routes on the map */}
          {routes.map((route, index) => {
            if (!route.coordinates || route.coordinates.length === 0) return null;

            // Color scheme for the 5 routes
            const routeColors = [
              "#d32f2f", // Red - Route 1
              "#ff9800", // Orange - Route 2
              "#4caf50", // Green - Route 3
              "#2196f3", // Blue - Route 4
              "#9c27b0"  // Purple - Route 5
            ];

            const routeColor = routeColors[index] || "#666";
            const isSelected = selectedRouteIdx === index;

            return (
              <Polyline
                key={`route-${route.id || index}`}
                positions={route.coordinates}
                pathOptions={{
                  color: routeColor,
                  weight: isSelected ? 8 : 6,
                  opacity: isSelected ? 0.9 : 0.7,
                  dashArray: index > 0 ? (index % 2 === 0 ? "10, 5" : "5, 5") : undefined
                }}
                eventHandlers={{
                  click: () => handleRouteSelect(index)
                }}
              >
                <Popup>
                  <div style={{ textAlign: 'center', minWidth: '150px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px', color: routeColor }}>
                      Route {index + 1}
                    </div>
                    <div style={{ fontSize: '14px', marginBottom: '4px' }}>
                      Distance: {(route.summary.totalDistance / 1000).toFixed(1)} km
                    </div>
                    <div style={{ fontSize: '14px', marginBottom: '4px' }}>
                      Time: {formatTime(route.summary.totalTime)}
                    </div>
                    {route.pollutionLevel !== null && (
                      <div style={{ fontSize: '14px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #eee' }}>
                        <div style={{ fontWeight: 'bold', color: route.pollutionLevel > 100 ? "#d32f2f" : "#28a745" }}>
                          AQI: {route.pollutionLevel}
                        </div>
                        {route.minAQI !== null && route.maxAQI !== null && (
                          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                            Range: {route.minAQI.toFixed(1)} - {route.maxAQI.toFixed(1)}
                          </div>
                        )}
                      </div>
                    )}
                    {route.isRecommended && (
                      <div style={{ marginTop: '8px', padding: '4px 8px', background: '#28a745', color: 'white', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                        Recommended
                      </div>
                    )}
                  </div>
                </Popup>
              </Polyline>
            );
          })}

          <MapClickHandler setStart={setStartPoint} setEnd={setEndPoint} mode={selectionMode} />
          {startPoint && endPoint && <RoutingControl start={startPoint} end={endPoint} onRoutesFound={setRoutes} selectedRouteIdx={selectedRouteIdx} airData={airData} />}

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

        {/* CONTROLS SECTION */}
        <div style={{ background: "white", padding: "12px", borderRadius: "10px", marginBottom: "15px", border: "1px solid #e1e5e8", boxShadow: "0 2px 5px rgba(0,0,0,0.03)" }}>
           
          {/* Base Layer Control */}
           <div style={{ background: "white", padding: "0 0 10px 0", borderRadius: "10px", borderBottom: "1px solid #eee", marginBottom: "10px" }}>
               <div style={{ fontWeight: "600", color: "#0C2B4E", marginBottom: "10px" }}>Map Style 🗺️</div>
               <div style={{ display: "flex", gap: "10px" }}>
                   <button 
                       onClick={() => setBaseLayerUrl("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png")} 
                       style={{ flex: 1, padding: "8px", borderRadius: "6px", border: baseLayerUrl.includes("openstreetmap") ? "2px solid #0C2B4E" : "1px solid #ccc", background: "white", cursor: "pointer" }}
                   >
                       Default
                   </button>
                   <button 
                       onClick={() => setBaseLayerUrl("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png")} 
                       style={{ flex: 1, padding: "8px", borderRadius: "6px", border: baseLayerUrl.includes("cartocdn") ? "2px solid #0C2B4E" : "1px solid #ccc", background: "white", cursor: "pointer" }}
                   >
                       Clean/Light
                   </button>
               </div>
           </div>

           {/* Single compact toggles block: Traffic, Wind, and Pollution markers */}
          <div style={{ background: "white", padding: "12px", borderRadius: "10px", marginBottom: "0px", border: "1px solid #e1e5e8", display: "flex", flexDirection: "column", gap: "10px", boxShadow: "0 2px 5px rgba(0,0,0,0.03)" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <input type="checkbox" id="trafficToggle" checked={showTraffic} onChange={(e) => setShowTraffic(e.target.checked)} style={{ width: "18px", height: "18px", cursor: "pointer", marginRight: "10px", accentColor: "#0C2B4E" }} />
              <label htmlFor="trafficToggle" style={{ cursor: "pointer", fontSize: "0.95rem", fontWeight: "600", color: "#333", flex: 1 }}>Show Live Traffic</label>
            </div>

            <div style={{ display: "flex", alignItems: "center" }}>
              <input type="checkbox" id="windToggle" checked={showWind} onChange={(e) => setShowWind(e.target.checked)} style={{ width: "18px", height: "18px", cursor: "pointer", marginRight: "10px", accentColor: "#0C2B4E" }} />
              <label htmlFor="windToggle" style={{ cursor: "pointer", fontSize: "0.95rem", fontWeight: "600", color: "#333", flex: 1 }}>Show Wind Flow</label>
            </div>

            <div style={{ display: "flex", alignItems: "center" }}>
              <input type="checkbox" id="pollutionToggle" checked={showPollutionMarkers} onChange={(e) => setShowPollutionMarkers(e.target.checked)} style={{ width: "18px", height: "18px", cursor: "pointer", marginRight: "10px", accentColor: "#0C2B4E" }} />
              <label htmlFor="pollutionToggle" style={{ cursor: "pointer", fontSize: "0.95rem", fontWeight: "600", color: "#333", flex: 1 }}>Show Air Quality Markers</label>
            </div>
          </div>
        </div>

        {/* POINT SELECTION CONTROLS */}
        <div style={{ background: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 15px rgba(0,0,0,0.05)" }}>
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
          <button onClick={handleClearAll} style={{ width: "100%", marginTop: "10px", background: "#f8f9fa", color: "#666", border: "1px solid #e1e5e8", borderRadius: "6px", padding: "10px", cursor: "pointer", fontWeight: "600", fontSize: "0.9rem" }}>Clear All</button>

          <div style={{ fontSize: "0.85rem", color: "#666", textAlign: "center", fontStyle: "italic", marginTop: "15px" }}>
            {selectionMode === 'start' ? "Click map to set Start Point" :
              selectionMode === 'end' ? "Click map to set Destination" :
                startPoint && endPoint ? "Points Set. Calculating..." :
                  "Click 'Set' to enable map selection"}
          </div>
        </div>

        {/* ROUTES DISPLAY */}
        {routes.length > 0 && (
          <div style={{ marginTop: "25px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <h3 style={{ color: "#0C2B4E", fontSize: "1.1rem", margin: 0, borderBottom: "2px solid #e1e5e8", paddingBottom: "10px", flex: 1 }}>🤖 AI Route Analysis</h3>
              <div style={{ fontSize: "0.75rem", color: "#666", marginLeft: "10px" }}>
                {routes.length} route{routes.length !== 1 ? 's' : ''} found
              </div>
            </div>

            {/* Route Color Legend */}
            <div style={{ background: "white", padding: "10px", borderRadius: "8px", marginBottom: "15px", fontSize: "0.8rem", border: "1px solid #e1e5e8" }}>
              <div style={{ fontWeight: "600", marginBottom: "6px", color: "#333" }}>Route Colors:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {routes.slice(0, 5).map((route, i) => {
                  const routeColors = ["#d32f2f", "#ff9800", "#4caf50", "#2196f3", "#9c27b0"];
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <div style={{ width: "16px", height: "3px", background: routeColors[i], borderRadius: "2px" }}></div>
                      <span style={{ color: "#666" }}>Route {i + 1}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              {routes.map((route, i) => {
                const originalSeconds = route.summary.totalTime;
                const isHeavyTraffic = i === 0;
                const realTimeSeconds = isHeavyTraffic ? originalSeconds * 1.5 : originalSeconds;

                return (
                  <div key={i} onClick={() => handleRouteSelect(i)} style={{ border: selectedRouteIdx === i ? "2px solid #0C2B4E" : "1px solid white", borderRadius: "10px", padding: "15px", cursor: "pointer", background: "white", position: "relative", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", transition: "transform 0.2s" }} onMouseOver={(e) => e.currentTarget.style.transform = "translateY(-2px)"} onMouseOut={(e) => e.currentTarget.style.transform = "translateY(0)"}>
                    {route.isRecommended && <div style={{ position: "absolute", top: "-10px", right: "10px", background: "#28a745", color: "white", padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "bold", boxShadow: "0 2px 5px rgba(0,0,0,0.1)" }}>✅ Recommended</div>}

                    <h4 style={{ margin: "0 0 8px 0", color: i === 0 ? "#d32f2f" : "#28a745" }}>
                      Route {i + 1} {i === 0 ? "(Heavy Traffic)" : "(Clear)"}
                    </h4>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", color: "#555", marginBottom: "12px" }}>
                      <span>⏳ <b>{formatTime(realTimeSeconds)}</b></span>
                      <span>📏 <b>{(route.summary.totalDistance / 1000).toFixed(1)}</b> km</span>
                    </div>

                    <div style={{ marginTop: "5px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "3px" }}>
                        <span>Air Pollution Impact</span>
                        <span style={{ fontWeight: "bold", color: route.pollutionLevel && route.pollutionLevel > 100 ? "#d32f2f" : route.pollutionLevel ? "#28a745" : "#999" }}>
                          {route.pollutionLevel !== null ? `${route.pollutionLevel} AQI` : "Calculating..."}
                        </span>
                      </div>
                      {route.pollutionLevel !== null && (
                        <>
                          <div style={{ width: "100%", height: "8px", background: "#f0f0f0", borderRadius: "4px", overflow: "hidden", marginBottom: "4px" }}>
                            <div style={{ width: `${Math.min((route.pollutionLevel / 300) * 100, 100)}%`, height: "100%", background: route.pollutionLevel > 100 ? "linear-gradient(to right, orange, red)" : "linear-gradient(to right, #a8e063, #56ab2f)", borderRadius: "4px" }}></div>
                          </div>
                          {route.minAQI !== null && route.maxAQI !== null && (
                            <div style={{ fontSize: "0.75rem", color: "#888", textAlign: "center" }}>
                              Range: {route.minAQI.toFixed(1)} - {route.maxAQI.toFixed(1)} AQI
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}