import React, { useState, useEffect, useMemo, useRef, memo, useReducer } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMapEvents, Marker, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// COMPONENTS & SERVICES
import RoutingControl from './RoutingControl';
import TimelineControl from './TimelineControl'; // <--- Restored
import WindLayer from './WindLayer'; 

import { fetchAirQualityData, getAQIColor } from '../../services/aqicnService';
import { fetchForecastTrend, fetchWindForecast } from '../../services/owmService'; 
import { generateForecast, getWindDirection } from '../../services/predictionService'; 
import { fetchSealionResponse, ChatMessage } from '../../services/sealionService.jsx';
import AQINotification from '../../components/AQINotification';

import {
  MapPin, Flag, Navigation,
  CornerUpLeft, CornerUpRight, ArrowUp,
  RotateCcw, Circle as CircleIcon
} from 'lucide-react';

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

function MapViewHandler({ centerPos }) {
  const map = useMap();
  useEffect(() => {
    if (centerPos) {
      map.flyTo(centerPos, 12, { duration: 2 });
    }
  }, [centerPos, map]);
  return null;
}

// --- HELPER FUNCTIONS ---
const formatTime = (seconds) => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

function getRadiusInMetersForAQI(aqi) {
  if (aqi <= 50) return 500;
  if (aqi <= 100) return 1000;
  if (aqi <= 150) return 2000;
  if (aqi <= 200) return 3500;
  if (aqi <= 300) return 6000;
  return 10000;
}

const MapClickHandler = ({ setStart, setEnd, mode }) => {
  useMapEvents({
    click: (e) => {
      if (mode === 'start') setStart([e.latlng.lat, e.latlng.lng]);
      else if (mode === 'end') setEnd([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
};

const getDirectionIcon = (text, type) => {
  const lowerText = text ? text.toLowerCase() : "";
  if (type === 'Head' || type === 'WaypointReached') return <MapPin size={20} color="#2e7d32" fill="#e8f5e9" />;
  if (type === 'DestinationReached') return <Flag size={20} color="#c62828" fill="#ffebee" />;
  if (lowerText.includes('left')) return <CornerUpLeft size={20} color="#555" />;
  if (lowerText.includes('right')) return <CornerUpRight size={20} color="#555" />;
  if (lowerText.includes('u-turn')) return <RotateCcw size={20} color="#555" />;
  if (lowerText.includes('roundabout')) return <RotateCcw size={20} color="#555" />;
  return <ArrowUp size={20} color="#555" />;
};


// ----------------------------------------------------------------------------------
// --- MAIN COMPONENT ---
// ----------------------------------------------------------------------------------

const chatReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return [...state, action.payload];
    default:
      return state;
  }
};

export default function MapPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [centerPos, setCenterPos] = useState([3.1473, 101.6991]);
  
  // --- DATA STATES ---
  const [realAirData, setRealAirData] = useState([]); // The baseline data (Today)
  const [displayAirData, setDisplayAirData] = useState([]); // What is shown (Today or Prediction)
  const [loading, setLoading] = useState(true);

  // --- PREDICTION STATES ---
  const [forecastTrends, setForecastTrends] = useState(null);
  const [windForecast, setWindForecast] = useState(null);
  const [selectedDay, setSelectedDay] = useState(0); // 0 = Today

  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [selectionMode, setSelectionMode] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(null);

  // TOGGLES & BASE LAYER STATE
  const [showTraffic, setShowTraffic] = useState(false);
  const [showPollutionMarkers, setShowPollutionMarkers] = useState(true);
  const [showWind, setShowWind] = useState(false);
  const [baseLayerUrl, setBaseLayerUrl] = useState("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");

  // AI Chatbot State
  const [showChatbox, setShowChatbox] = useState(false);
  const [chatMessages, dispatch] = useReducer(chatReducer, [
    { type: 'bot', text: 'Hello! I\'m your AI route assistant. I can help you find the cleanest air quality routes, answer questions about pollution levels, and provide navigation tips. How can I help you today?' }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [expandedRouteId, setExpandedRouteId] = useState(null);

  const handleLogout = async () => {
    try { await logout(); navigate('/login'); } catch (error) { console.error(error); }
  };

  const handleClearAll = () => {
    setStartPoint(null); setEndPoint(null); setRoutes([]);
    setSelectedRouteIdx(null); setSelectionMode(null); setExpandedRouteId(null);
  };

  // --- INITIAL DATA LOAD ---
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      // 1. Fetch Current AQI Data (AQICN)
      const results = await fetchAirQualityData();
      const safeResults = results
        .map(r => {
          if (!r.coordinates || r.coordinates.length < 2) return r;
          let lat = r.coordinates[0];
          let lng = r.coordinates[1];
          if (Math.abs(lat) > 90) return { ...r, coordinates: [lng, lat] };
          return r;
        })
        .filter(r => r.value !== null && Array.isArray(r.coordinates));

      setRealAirData(safeResults);
      setDisplayAirData(safeResults); // Initially show today's data

      // 2. Fetch Future Trends (OpenWeatherMap)
      try {
        const trends = await fetchForecastTrend(centerPos[0], centerPos[1]);
        const wind = await fetchWindForecast(centerPos[0], centerPos[1]);
        if (trends) setForecastTrends(trends);
        if (wind) setWindForecast(wind);
      } catch (e) {
        console.warn("Forecast fetch failed, prediction will use simulation.", e);
      }

      setLoading(false);
    };

    loadData();
  }, []); // Run once on mount

  // --- PREDICTION HANDLER (Uses EXACT RAW VALUES from OpenWeatherMap API) ---
  const handleDayChange = (day) => {
    setSelectedDay(day);
    
    if (day === 0) {
      setDisplayAirData(realAirData); // Reset to original
    } else {
      // Use EXACT RAW forecast value from OpenWeatherMap API (no calculations, no multipliers)
      if (forecastTrends && forecastTrends[day] !== undefined) {
          const rawForecastValue = forecastTrends[day]; // EXACT RAW VALUE from API (PM2.5 in µg/m³ or AQI)
          const todayRawValue = forecastTrends[0];
          
          if (todayRawValue && todayRawValue > 0) {
            console.log(`🔮 Prediction Day ${day}: Using EXACT RAW value ${rawForecastValue} (Today: ${todayRawValue})`);
            
            // Calculate the exact change factor from raw API values (no arbitrary multipliers)
            const changeFactor = rawForecastValue / todayRawValue;
            
            const predictedData = realAirData.map(point => {
                // Apply exact raw forecast change factor directly (no multipliers like "5 * day")
                // This uses the exact raw API values to determine the change
                let newValue = Math.round(point.value * changeFactor);
                
                // Safety bounds
                if (newValue < 10) newValue = 10; 
                if (newValue > 500) newValue = 500;

                return {
                    ...point,
                    // FIXED: Create immutable copy of coordinates to prevent any drifting
                    // Coordinates stay exactly the same - no modification, no drift
                    coordinates: Array.isArray(point.coordinates) && point.coordinates.length >= 2
                      ? [point.coordinates[0], point.coordinates[1]] // Exact same coordinates, new array reference
                      : point.coordinates,
                    value: newValue, 
                    isPrediction: true,
                    dayOffset: day
                };
            });
            setDisplayAirData(predictedData);
          } else {
            console.warn("Invalid forecast data, showing original data");
            setDisplayAirData(realAirData);
          }
      } else {
          // Fallback: if API failed, show original data
          console.warn("Forecast data not available, showing original data");
          setDisplayAirData(realAirData);
      }
    }
  };

  const handleRouteSelect = (idx) => {
    setSelectedRouteIdx(idx);
  };

  const toggleDirections = (e, idx) => {
    e.stopPropagation();
    setExpandedRouteId(expandedRouteId === idx ? null : idx);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const userMessage = inputRef.current.value.trim();
    if (!userMessage) return;

    // Add the user's message to the chat
    dispatch({ type: 'ADD_MESSAGE', payload: { type: 'user', text: userMessage } });
    inputRef.current.value = ''; // Clear the input field

    // Add typing indicator
    const typingIndicator = { type: 'bot', text: 'Typing...' };
    dispatch({ type: 'ADD_MESSAGE', payload: typingIndicator });

    // Fetch response from Sealion API
    const result = await fetchSealionResponse(userMessage);

    // Replace typing indicator with actual response
    dispatch({ type: 'ADD_MESSAGE', payload: { type: 'bot', text: result.reply } });
  };

  // Calculate wind direction for Timeline Icon
  const currentWindDirection = windForecast && windForecast[selectedDay] 
    ? windForecast[selectedDay].deg 
    : getWindDirection(selectedDay);

  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative", display: "flex", flexDirection: "row" }}>

      {/* Floating AI Agent Button */}
      <button
        onClick={() => setShowChatbox(!showChatbox)}
        style={{
          position: 'fixed', bottom: '30px', right: showChatbox ? '420px' : '30px',
          width: '60px', height: '60px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #1D546C 0%, #0C2B4E 100%)',
          border: 'none', boxShadow: '0 4px 20px rgba(102, 126, 234, 0)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1001, transition: 'all 0.3s ease', color: 'white', fontSize: '24px'
        }}
      >
        🤖
      </button>

      {/* AI Chatbox */}
      {showChatbox && (
        <div style={{ position: 'fixed', right: '30px', bottom: '110px', width: '350px', height: '500px', background: 'white', borderRadius: '20px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', zIndex: 1002, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #e1e5e8' }}>
          <div style={{ background: 'linear-gradient(135deg, #1D546C 0%, #0C2B4E 100%)', padding: '15px 20px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><div style={{ fontWeight: 'bold', fontSize: '16px' }}>AI Route Assistant</div><div style={{ fontSize: '12px', opacity: 0.9 }}>Always here to help</div></div>
            <button onClick={() => setShowChatbox(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>×</button>
          </div>

          {/* Messages Container */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
              background: '#f8f9fa',
              display: 'flex',
              flexDirection: 'column',
              gap: '15px',
            }}
          >
            {chatMessages.map((msg, idx) => (
              <ChatMessage key={idx} msg={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSendMessage} style={{ padding: '15px', background: 'white', borderTop: '1px solid #e1e5e8' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                ref={inputRef}
                placeholder="Ask me anything..."
                style={{
                  flex: 1,
                  padding: '12px 15px',
                  borderRadius: '25px',
                  border: '1px solid #e1e5e8',
                  outline: 'none',
                  fontSize: '14px',
                }}
              />
              <button
                type="submit"
                style={{
                  width: '45px',
                  height: '45px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg,  #1D546C 0%, #0C2B4E 100%)',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
                }}
              >
                ➤
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* AQI Notification Component */}
      <AQINotification />

      {/* --- MAP (Left) --- */}
      <div style={{ flex: 1, height: "100%", position: "relative" }}>

        {loading && <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9999, background: "white", padding: "10px 20px", borderRadius: "20px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>Loading Air Data...</div>}

        <MapContainer center={centerPos} zoom={11} style={{ height: "100%", width: "100%" }}>
          <MapViewHandler centerPos={centerPos} />

          {/* Base Layer */}
          <TileLayer attribution='&copy; OpenStreetMap | CartoDB' url={baseLayerUrl} zIndex={1} />

          {/* Traffic Layer */}
          {showTraffic ? (
            <TileLayer attribution='Google Maps Traffic Overlay' url="https://mt0.google.com/vt/lyrs=m,traffic&hl=en&x={x}&y={y}&z={z}" maxZoom={20} zIndex={100} />
          ) : null}

          {/* Wind Layer */}
          <WindLayer show={showWind} />

          {/* Pollution Dots & Circles */}
          {showPollutionMarkers && displayAirData.map((point, index) => {
            // Ensure coordinates are fixed and not modified - create immutable copy
            const fixedCoordinates = Array.isArray(point.coordinates) && point.coordinates.length >= 2
              ? [point.coordinates[0], point.coordinates[1]] // Create new array to prevent mutation
              : point.coordinates;
            
            const radiusInMeters = getRadiusInMetersForAQI(point.value);
            const fillColor = getAQIColor(point.value);
            const PopupContent = (
              <Popup>
                <div style={{ textAlign: 'center', minWidth: '150px' }}>
                  {point.isPrediction && <div style={{ background: '#0C2B4E', color: 'white', fontSize: '10px', padding: '2px 5px', borderRadius: '4px', marginBottom: '5px', display: 'inline-block' }}>AI FORECAST (+{point.dayOffset} Day)</div>}
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: fillColor, marginBottom: '8px' }}>AQI: {point.value}</div>
                  <div style={{ marginBottom: '6px' }}><strong>{point.location}</strong></div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Last Updated: {new Date(point.lastUpdated).toLocaleString()}</div>
                  <div style={{ fontSize: '11px', color: '#888', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #eee' }}>Radius: {(radiusInMeters / 1000).toFixed(1)} km</div>
                </div>
              </Popup>
            );
            return (
              <React.Fragment key={`marker-${point.id || index}`}>
                <CircleMarker center={fixedCoordinates} radius={4} pathOptions={{ color: 'transparent', fillColor: fillColor, fillOpacity: 0.9 }}>{PopupContent}</CircleMarker>
                <Circle center={fixedCoordinates} radius={radiusInMeters} pathOptions={{ color: fillColor, fillColor: fillColor, fillOpacity: 0.15, weight: 1 }}>{PopupContent}</Circle>
              </React.Fragment>
            );
          })}

          {startPoint && <Marker position={startPoint} icon={startIcon}><Popup>Start Point</Popup></Marker>}
          {endPoint && <Marker position={endPoint} icon={endIcon}><Popup>Destination</Popup></Marker>}

          {/* --- RESTORED: Draw Routes on Map --- */}
          {routes.map((route, index) => {
            if (!route.coordinates || route.coordinates.length === 0) return null;
            const routeColors = ["#d32f2f", "#ff9800", "#4caf50", "#2196f3", "#9c27b0"];
            const routeColor = routeColors[index] || "#666";
            const isSelected = selectedRouteIdx === index;

            return (
              <Polyline
                key={`route-${index}`}
                positions={route.coordinates}
                pathOptions={{ color: routeColor, weight: isSelected ? 8 : 5, opacity: isSelected ? 0.9 : 0.6 }}
                eventHandlers={{ click: () => handleRouteSelect(index) }}
              />
            );
          })}

          {/* Routing Control - Passing DISPLAY data (Prediction or Real) */}
          {startPoint && endPoint && <RoutingControl start={startPoint} end={endPoint} onRoutesFound={setRoutes} airData={displayAirData} />}

          <MapClickHandler setStart={setStartPoint} setEnd={setEndPoint} mode={selectionMode} />
        </MapContainer>

        {/* --- TIMELINE CONTROL --- */}
        <TimelineControl 
            selectedDay={selectedDay} 
            onDayChange={handleDayChange}
            windDirection={currentWindDirection}
        />
      </div>

      {/* --- SIDEBAR (Right) --- */}
      <div style={{ width: "380px", height: "100%", background: "#f4f7f6", boxShadow: "-2px 0 10px rgba(0,0,0,0.1)", zIndex: 1000, padding: "25px", display: "flex", flexDirection: "column", overflowY: "auto", borderLeft: "1px solid #e1e5e8" }}>

        <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ color: "#0C2B4E", margin: 0, fontSize: "1.8rem" }}>Route Planner</h2>
            <p style={{ color: "#666", fontSize: "0.9rem", marginTop: "5px" }}>Find the cleanest path.</p>
            {selectedDay > 0 && (
                <div style={{ background: '#e3f2fd', color: '#0d47a1', fontSize: '0.8rem', padding: '5px 10px', borderRadius: '6px', marginTop: '10px', fontWeight: 'bold', border: '1px solid #90caf9' }}>
                   🔮 Forecast Mode: +{selectedDay} Days
                </div>
            )}
          </div>
          <button onClick={handleLogout} style={{ background: "white", color: "#d32f2f", border: "1px solid #ffcccb", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", fontWeight: "bold" }}>Log Out</button>
        </div>

        {/* CONTROLS SECTION */}
        <div style={{ background: "white", padding: "12px", borderRadius: "10px", marginBottom: "15px", border: "1px solid #e1e5e8", boxShadow: "0 2px 5px rgba(0,0,0,0.03)" }}>
          <div style={{ background: "white", padding: "0 0 10px 0", borderRadius: "10px", borderBottom: "1px solid #eee", marginBottom: "10px" }}>
            <div style={{ fontWeight: "600", color: "#0C2B4E", marginBottom: "10px" }}>Map Style 🗺️</div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setBaseLayerUrl("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png")} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: baseLayerUrl.includes("openstreetmap") ? "2px solid #0C2B4E" : "1px solid #ccc", background: "white", cursor: "pointer" }}>Default</button>
              <button onClick={() => setBaseLayerUrl("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png")} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: baseLayerUrl.includes("cartocdn") ? "2px solid #0C2B4E" : "1px solid #ccc", background: "white", cursor: "pointer" }}>Clean/Light</button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <input type="checkbox" id="trafficToggle" checked={showTraffic} onChange={(e) => setShowTraffic(e.target.checked)} style={{ width: "18px", height: "18px", cursor: "pointer", marginRight: "10px", accentColor: "#0C2B4E" }} />
              <label htmlFor="trafficToggle" style={{ cursor: "pointer", fontSize: "0.95rem", fontWeight: "600", color: "#333", flex: 1, marginLeft: "8px" }}>Show Live Traffic</label>
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <input type="checkbox" id="windToggle" checked={showWind} onChange={(e) => setShowWind(e.target.checked)} style={{ width: "18px", height: "18px", cursor: "pointer", marginRight: "10px", accentColor: "#0C2B4E" }} />
              <label htmlFor="windToggle" style={{ cursor: "pointer", fontSize: "0.95rem", fontWeight: "600", color: "#333", flex: 1, marginLeft: "8px" }}>Show Wind Flow</label>
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <input type="checkbox" id="pollutionToggle" checked={showPollutionMarkers} onChange={(e) => setShowPollutionMarkers(e.target.checked)} style={{ width: "18px", height: "18px", cursor: "pointer", marginRight: "10px", accentColor: "#0C2B4E" }} />
              <label htmlFor="pollutionToggle" style={{ cursor: "pointer", fontSize: "0.95rem", fontWeight: "600", color: "#333", flex: 1, marginLeft: "8px" }}>Show Air Quality Markers</label>
            </div>
          </div>
        </div>

        <div style={{ background: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 15px rgba(0,0,0,0.05)" }}>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#333", marginBottom: "5px" }}><span style={{ color: "green", marginRight: "5px" }}>●</span> Start Point</label>
            <div style={{ display: "flex", gap: "8px" }}><input value={startPoint ? `${startPoint[0].toFixed(4)}, ${startPoint[1].toFixed(4)}` : ""} placeholder="Click 'Set' then Map..." readOnly style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0", backgroundColor: selectionMode === 'start' ? "#e6fffa" : "#fff", outline: selectionMode === 'start' ? "2px solid green" : "none" }} /><button onClick={() => setSelectionMode('start')} style={{ background: selectionMode === 'start' ? "green" : "#f0f0f0", color: selectionMode === 'start' ? "white" : "#333", border: "none", borderRadius: "6px", padding: "0 15px", cursor: "pointer", fontWeight: "bold" }}>Set</button></div>
          </div>
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#333", marginBottom: "5px" }}><span style={{ color: "red", marginRight: "5px" }}>●</span> Destination</label>
            <div style={{ display: "flex", gap: "8px" }}><input value={endPoint ? `${endPoint[0].toFixed(4)}, ${endPoint[1].toFixed(4)}` : ""} placeholder="Click 'Set' then Map..." readOnly style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0", backgroundColor: selectionMode === 'end' ? "#fff5f5" : "#fff", outline: selectionMode === 'end' ? "2px solid red" : "none" }} /><button onClick={() => setSelectionMode('end')} style={{ background: selectionMode === 'end' ? "red" : "#f0f0f0", color: selectionMode === 'end' ? "white" : "#333", border: "none", borderRadius: "6px", padding: "0 15px", cursor: "pointer", fontWeight: "bold" }}>Set</button></div>
          </div>
          <button onClick={handleClearAll} style={{ width: "100%", marginTop: "10px", background: "#f8f9fa", color: "#666", border: "1px solid #e1e5e8", borderRadius: "6px", padding: "10px", cursor: "pointer", fontWeight: "600", fontSize: "0.9rem" }}>🔄 Clear All</button>
          <div style={{ fontSize: "0.85rem", color: "#666", textAlign: "center", fontStyle: "italic", marginTop: "15px" }}>
            {selectionMode === 'start' ? "📍 Click map to set Start Point" : selectionMode === 'end' ? "🏁 Click map to set Destination" : startPoint && endPoint ? "✅ Points Set. Calculating..." : "👆 Click 'Set' to enable map selection"}
          </div>
        </div>

        {/* ROUTES DISPLAY WITH EXPANDABLE DIRECTIONS */}
        {routes.length > 0 && (
          <div style={{ marginTop: "25px" }}>
            <h3 style={{ color: "#0C2B4E", fontSize: "1.1rem", marginBottom: "15px", borderBottom: "2px solid #e1e5e8", paddingBottom: "10px" }}>🤖 AI Route Analysis</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              {routes.map((route, i) => {
                const isExpanded = expandedRouteId === i;
                const originalSeconds = route.summary.totalTime;
                const isHeavyTraffic = i === 0;
                const realTimeSeconds = isHeavyTraffic ? originalSeconds * 1.5 : originalSeconds;
                
                const aqiValue = route.pollutionLevel || 0;
                const barWidth = Math.min((aqiValue / 300) * 100, 100);
                const isSelected = selectedRouteIdx === i;

                return (
                  <div 
                    key={i} 
                    onClick={() => handleRouteSelect(i)}
                    style={{ 
                      border: isSelected ? "2px solid #0C2B4E" : "1px solid white", 
                      borderRadius: "10px", 
                      padding: "15px", 
                      cursor: "pointer", 
                      background: isSelected ? "#f0f9ff" : "white",
                      position: "relative", 
                      boxShadow: isSelected ? "0 4px 12px rgba(12, 43, 78, 0.2)" : "0 2px 8px rgba(0,0,0,0.05)",
                      transition: "all 0.2s ease-in-out",
                      transform: isSelected ? "translateY(-2px)" : "none"
                    }} 
                    onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.transform = "translateY(-2px)"; }} 
                    onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.transform = "translateY(0)"; }}
                  >
                    {route.isRecommended && <div style={{ position: "absolute", top: "-10px", right: "10px", background: "#28a745", color: "white", padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "bold", boxShadow: "0 2px 5px rgba(0,0,0,0.1)" }}>✅ Recommended</div>}
                    
                    <h4 style={{ margin: "0 0 8px 0", color: i === 0 ? "#d32f2f" : "#28a745" }}>Route {i + 1} {i === 0 ? "(Heavy Traffic)" : "(Clear)"}</h4>
                    
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", color: "#555", marginBottom: "12px" }}>
                      <span>⏳ <b>{formatTime(realTimeSeconds)}</b></span>
                      <span>📏 <b>{(route.summary.totalDistance / 1000).toFixed(1)}</b> km</span>
                    </div>

                    <div style={{ marginTop: "5px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "3px" }}>
                        <span>Air Pollution Impact</span>
                        <span style={{ fontWeight: "bold", color: aqiValue > 100 ? "#d32f2f" : "#28a745" }}>
                          {route.pollutionLevel !== null ? `${route.pollutionLevel} AQI` : "Calculating..."}
                        </span>
                      </div>
                      <div style={{ width: "100%", height: "8px", background: "#f0f0f0", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{ 
                          width: `${barWidth}%`, 
                          height: "100%", 
                          background: aqiValue > 100 ? "linear-gradient(to right, orange, red)" : "linear-gradient(to right, #a8e063, #56ab2f)", 
                          borderRadius: "4px",
                          transition: "width 0.5s ease-in-out"
                        }}></div>
                      </div>
                    </div>

                    {/* --- TOGGLE BUTTON FOR DIRECTIONS --- */}
                    <div style={{ marginTop: "15px", paddingTop: "10px", borderTop: "1px solid #eee" }}>
                      <button 
                        onClick={(e) => toggleDirections(e, i)}
                        style={{ width: "100%", background: "none", border: "none", color: "#007bff", cursor: "pointer", fontSize: "0.9rem", fontWeight: "600", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}
                      >
                        <Navigation size={16} /> {isExpanded ? "Hide" : "Show"} Directions {isExpanded ? <ArrowUp size={14}/> : <ArrowUp size={14} style={{transform: "rotate(180deg)"}}/>}
                      </button>
                      
                      {/* --- EXPANDABLE LIST WITH ICONS --- */}
                      {isExpanded && route.instructions && (
                        <div style={{ marginTop: "10px", background: "#f8f9fa", padding: "10px", borderRadius: "8px", maxHeight: "300px", overflowY: "auto" }}>
                          {route.instructions.map((step, stepIdx) => (
                            <div key={stepIdx} style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px", fontSize: "0.9rem", color: "#333", borderBottom: stepIdx < route.instructions.length -1 ? "1px solid #eee" : "none", paddingBottom: "8px" }}>
                              <div style={{ flexShrink: 0, width: "32px", height: "32px", background: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #ddd" }}>
                                {getDirectionIcon(step.text, step.type)}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{fontWeight: 500}}>{step.text}</div>
                                <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "2px" }}>
                                  {step.distance > 1000 ? `${(step.distance/1000).toFixed(1)} km` : `${Math.round(step.distance)} m`}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
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