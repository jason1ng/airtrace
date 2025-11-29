import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMapEvents, Marker, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// COMPONENTS & SERVICES (Ensure these paths are correct in your project)
import RoutingControl from './RoutingControl';
import WindLayer from './WindLayer';
import { fetchAirQualityData, getAQIColor } from '../../services/aqicnService';
import { fetchSealionResponse } from '../../services/sealionService';

import {
  MapPin, Flag, Navigation,
  CornerUpLeft, CornerUpRight, ArrowUp,
  RotateCcw, Circle as CircleIcon
} from 'lucide-react';

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

export default function MapPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [centerPos, setCenterPos] = useState([3.1473, 101.6991]);
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
  // State for switching base map style
  const [baseLayerUrl, setBaseLayerUrl] = useState("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");

  // AI Chatbot State
  const [showChatbox, setShowChatbox] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { type: 'bot', text: 'Hello! I\'m your AI route assistant. I can help you find the cleanest air quality routes, answer questions about pollution levels, and provide navigation tips. How can I help you today?' }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef(null);


  const [expandedRouteId, setExpandedRouteId] = useState(null);

  const handleLogout = async () => {
    try { await logout(); navigate('/login'); } catch (error) { console.error(error); }
  };

  const handleClearAll = () => {
    setStartPoint(null); setEndPoint(null); setRoutes([]);
    setSelectedRouteIdx(null); setSelectionMode(null); setExpandedRouteId(null);
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const results = await fetchAirQualityData();
      // Basic coordinate validation/fix
      const safeResults = results
        .map(r => {
          // Check if coordinates array is defined before accessing elements
          if (!r.coordinates || r.coordinates.length < 2) return r;

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
    if (!inputMessage.trim()) return;

    // Add user message
    const userMsg = { type: 'user', text: inputMessage };
    setChatMessages((prev) => [...prev, userMsg]);
    setInputMessage('');

    // Add typing indicator
    const typingIndicator = { type: 'bot', text: 'Typing...' };
    setChatMessages((prev) => [...prev, typingIndicator]);

    const result = await fetchSealionResponse(userMsg.text);

    // Replace typing indicator with actual response
    setChatMessages((prev) => {
      const updatedMessages = [...prev];
      updatedMessages.pop(); // Remove typing indicator
      return [...updatedMessages, { type: 'bot', text: result.reply }];
    });
  };

  const generateAIResponse = (userMessage) => {
    const lowerMsg = userMessage.toLowerCase();

    if (lowerMsg.includes('route') || lowerMsg.includes('best') || lowerMsg.includes('recommend')) {
      if (routes.length > 0) {
        const bestRoute = routes.find(r => r.isRecommended) || routes[0];
        return `I recommend ${bestRoute.isRecommended ? 'the recommended route' : 'Route 1'} with an average AQI of ${bestRoute.pollutionLevel || 'N/A'}. This route has the cleanest air quality along your path.`;
      }
      return 'Please set your start and end points first, then I can recommend the best route based on air quality.';
    }

    if (lowerMsg.includes('aqi') || lowerMsg.includes('air quality') || lowerMsg.includes('pollution')) {
      if (airData.length > 0) {
        const avgAQI = Math.round(airData.reduce((sum, p) => sum + p.value, 0) / airData.length);
        return `The current average air quality index in this area is ${avgAQI} AQI. ${avgAQI <= 50 ? 'The air quality is good!' : avgAQI <= 100 ? 'The air quality is moderate.' : 'The air quality is unhealthy. Consider wearing a mask.'}`;
      }
      return 'I\'m currently loading air quality data. Please wait a moment.';
    }

    if (lowerMsg.includes('help') || lowerMsg.includes('what can you do')) {
      return 'I can help you with:\n• Finding routes with the best air quality\n• Explaining current AQI levels\n• Providing navigation assistance\n• Answering questions about pollution\n\nJust ask me anything!';
    }

    return 'I understand you\'re asking about "' + userMessage + '". I\'m here to help you find the cleanest routes and answer questions about air quality. Could you rephrase your question?';
  };

  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative", display: "flex", flexDirection: "row" }}>

      {/* Floating AI Agent Button */}
      <button
        onClick={() => setShowChatbox(!showChatbox)}
        style={{
          position: 'fixed',
          bottom: '30px',
          right: showChatbox ? '420px' : '30px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #1D546C 0%, #0C2B4E 100%)',
          border: 'none',
          boxShadow: '0 4px 20px rgba(102, 126, 234, 0)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
          transition: 'all 0.3s ease',
          color: 'white',
          fontSize: '24px'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 25px #1A3D64';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 20px #0C2B4E';
        }}
      >
        🤖
      </button>

      {/* AI Chatbox */}
      {showChatbox && (
        <div
          style={{
            position: 'fixed',
            right: '30px',
            bottom: '110px',
            width: '350px',
            height: '500px',
            background: 'white',
            borderRadius: '20px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
            zIndex: 1002,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid #e1e5e8'
          }}
        >
          {/* Chatbox Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1D546C 0%, #0C2B4E 100%)',
              padding: '15px 20px',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '16px' }}>AI Route Assistant</div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>Always here to help</div>
            </div>
            <button
              onClick={() => setShowChatbox(false)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px'
              }}
            >
              ×
            </button>
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
              gap: '15px'
            }}
          >
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}
              >
                {msg.type === 'bot' && (
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #1D546C 0%, #0C2B4E 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontSize: '18px'
                    }}
                  >
                    🤖
                  </div>
                )}
                <div
                  style={{
                    maxWidth: '75%',
                    padding: '12px 16px',
                    borderRadius: msg.type === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: msg.type === 'user' ? '#667eea' : 'white',
                    color: msg.type === 'user' ? 'white' : '#333',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {msg.text}
                </div>
                {msg.type === 'user' && (
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#e0e0e0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontSize: '18px'
                    }}
                  >
                    👤
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSendMessage} style={{ padding: '15px', background: 'white', borderTop: '1px solid #e1e5e8' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask me anything..."
                style={{
                  flex: 1,
                  padding: '12px 15px',
                  borderRadius: '25px',
                  border: '1px solid #e1e5e8',
                  outline: 'none',
                  fontSize: '14px'
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
                  boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                }}
              >
                ➤
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- MAP (Left) --- */}
      <div style={{ flex: 1, height: "100%", position: "relative" }}>

        {loading && <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9999, background: "white", padding: "10px 20px", borderRadius: "20px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>Loading Air Data...</div>}

        <MapContainer center={centerPos} zoom={11} style={{ height: "100%", width: "100%" }}>

          {/* Base Layer - DYNAMICALLY CONTROLLED BY Map Style BUTTONS */}
          <TileLayer
            attribution='&copy; OpenStreetMap | CartoDB'
            url={baseLayerUrl}
            zIndex={1} // Base layer
          />

          {/* TRAFFIC LAYER FIX: Only render the traffic overlay when showTraffic is TRUE. 
              When FALSE, it renders NULL, preserving the baseLayerUrl map style underneath. */}
          {showTraffic ? (
            <TileLayer
              attribution='Google Maps Traffic Overlay'
              url="https://mt0.google.com/vt/lyrs=m,traffic&hl=en&x={x}&y={y}&z={z}"
              maxZoom={20}
              zIndex={100} // Overlay layer
            />
          ) : null}

          {/* WIND LAYER (New) */}
          <WindLayer show={showWind} />

          {/* Pollution Dots & Circles */}
          {showPollutionMarkers && airData.map((point, index) => {
            const radiusInMeters = getRadiusInMetersForAQI(point.value);
            const fillColor = getAQIColor(point.value);
            const PopupContent = (
              <Popup>
                <div style={{ textAlign: 'center', minWidth: '150px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: fillColor, marginBottom: '8px' }}>AQI: {point.value}</div>
                  <div style={{ marginBottom: '6px' }}><strong>{point.location}</strong></div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Last Updated: {new Date(point.lastUpdated).toLocaleString()}</div>
                  <div style={{ fontSize: '11px', color: '#888', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #eee' }}>Radius: {(radiusInMeters / 1000).toFixed(1)} km</div>
                </div>
              </Popup>
            );
            return (
              <React.Fragment key={`marker-${point.id || index}`}>
                <CircleMarker center={point.coordinates} radius={4} pathOptions={{ color: 'transparent', fillColor: fillColor, fillOpacity: 0.9 }}>{PopupContent}</CircleMarker>
                <Circle center={point.coordinates} radius={radiusInMeters} pathOptions={{ color: fillColor, fillColor: fillColor, fillOpacity: 0.15, weight: 1 }}>{PopupContent}</Circle>
              </React.Fragment>
            );
          })}

          {startPoint && <Marker position={startPoint} icon={startIcon}><Popup>Start Point</Popup></Marker>}
          {endPoint && <Marker position={endPoint} icon={endIcon}><Popup>Destination</Popup></Marker>}

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

          <MapClickHandler setStart={setStartPoint} setEnd={setEndPoint} mode={selectionMode} />
          {startPoint && endPoint && <RoutingControl start={startPoint} end={endPoint} onRoutesFound={setRoutes} selectedRouteIdx={selectedRouteIdx} airData={airData} />}

        </MapContainer>
      </div>

      {/* --- SIDEBAR (Right) --- */}
      <div style={{ width: "380px", height: "100%", background: "#f4f7f6", boxShadow: "-2px 0 10px rgba(0,0,0,0.1)", zIndex: 1000, padding: "25px", display: "flex", flexDirection: "column", overflowY: "auto", borderLeft: "1px solid #e1e5e8" }}>

        <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div><h2 style={{ color: "#0C2B4E", margin: 0, fontSize: "1.8rem" }}>Route Planner</h2><p style={{ color: "#666", fontSize: "0.9rem", marginTop: "5px" }}>Find the cleanest path.</p></div>
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

        {/* ROUTES DISPLAY */}
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
                    // --- UPDATED STYLES FOR SELECTED STATE ---
                    style={{
                      border: isSelected ? "2px solid #0C2B4E" : "1px solid transparent",
                      borderRadius: "10px",
                      padding: "15px",
                      cursor: "pointer",
                      background: isSelected ? "#f0f9ff" : "white", // Light Blue bg when selected
                      position: "relative",
                      boxShadow: isSelected ? "0 4px 12px rgba(12, 43, 78, 0.2)" : "0 2px 8px rgba(0,0,0,0.05)",
                      transition: "all 0.2s ease-in-out",
                      transform: isSelected ? "translateY(-2px)" : "none" // Slight lift effect
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

                    <div style={{ marginTop: "15px", paddingTop: "10px", borderTop: "1px solid #eee" }}>
                      <button
                        onClick={(e) => toggleDirections(e, i)}
                        style={{ width: "100%", background: "none", border: "none", color: "#007bff", cursor: "pointer", fontSize: "0.9rem", fontWeight: "600", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}
                      >
                        <Navigation size={16} /> {isExpanded ? "Hide" : "Show"} Directions {isExpanded ? <ArrowUp size={14} /> : <ArrowUp size={14} style={{ transform: "rotate(180deg)" }} />}
                      </button>

                      {isExpanded && route.instructions && (
                        <div style={{ marginTop: "10px", background: "#f8f9fa", padding: "10px", borderRadius: "8px", maxHeight: "300px", overflowY: "auto" }}>
                          {route.instructions.map((step, stepIdx) => (
                            <div key={stepIdx} style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px", fontSize: "0.9rem", color: "#333", borderBottom: stepIdx < route.instructions.length - 1 ? "1px solid #eee" : "none", paddingBottom: "8px" }}>
                              <div style={{ flexShrink: 0, width: "32px", height: "32px", background: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #ddd" }}>
                                {getDirectionIcon(step.text, step.type)}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 500 }}>{step.text}</div>
                                <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "2px" }}>
                                  {step.distance > 1000 ? `${(step.distance / 1000).toFixed(1)} km` : `${Math.round(step.distance)} m`}
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