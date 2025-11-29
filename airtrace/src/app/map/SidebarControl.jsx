import React from 'react';
import { 
  Navigation, CornerUpLeft, CornerUpRight, ArrowUp, RotateCcw, 
  MapPin, Flag 
} from 'lucide-react';

// --- HELPERS (Moved here since they are for UI display) ---

const formatTime = (seconds) => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs} hr ${mins} min`;
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

export default function SidebarControl({
  startPoint, endPoint, selectionMode, setSelectionMode, handleClearAll, handleLogout,
  showTraffic, setShowTraffic, showPollutionMarkers, setShowPollutionMarkers,
  routes, selectedRouteIdx, handleRouteSelect, expandedRouteId, toggleDirections, selectedDay
}) {
  
  return (
    <div style={{ 
      width: "380px", height: "100%", background: "#f4f7f6", 
      boxShadow: "-2px 0 10px rgba(0,0,0,0.1)", zIndex: 1000, 
      padding: "25px", display: "flex", flexDirection: "column", 
      overflowY: "auto", borderLeft: "1px solid #e1e5e8" 
    }}>
      
      {/* HEADER */}
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

      {/* TOGGLES */}
      <div style={{ background: "white", padding: "12px", borderRadius: "10px", marginBottom: "15px", border: "1px solid #e1e5e8", display: "flex", flexDirection: "column", gap: "10px", boxShadow: "0 2px 5px rgba(0,0,0,0.03)" }}>
         <div style={{ display: "flex", alignItems: "center" }}>
           <input type="checkbox" id="trafficToggle" checked={showTraffic} onChange={(e) => setShowTraffic(e.target.checked)} style={{ width: "18px", height: "18px", cursor: "pointer", marginRight: "10px", accentColor: "#0C2B4E" }} />
           <label htmlFor="trafficToggle" style={{ cursor: "pointer", fontSize: "0.95rem", fontWeight: "600", color: "#333", flex: 1, marginLeft: "8px" }}>Show Live Traffic Jam</label>
         </div>
         <div style={{ display: "flex", alignItems: "center" }}>
           <input type="checkbox" id="pollutionToggle" checked={showPollutionMarkers} onChange={(e) => setShowPollutionMarkers(e.target.checked)} style={{ width: "18px", height: "18px", cursor: "pointer", marginRight: "10px", accentColor: "#0C2B4E" }} />
           <label htmlFor="pollutionToggle" style={{ cursor: "pointer", fontSize: "0.95rem", fontWeight: "600", color: "#333", flex: 1, marginLeft: "8px" }}>Show Air Quality Markers</label>
         </div>
      </div>

      {/* INPUTS */}
      <div style={{ background: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 15px rgba(0,0,0,0.05)" }}>
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#333", marginBottom: "5px" }}><span style={{ color: "green", marginRight: "5px" }}>●</span> Start Point</label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input value={startPoint ? `${startPoint[0].toFixed(4)}, ${startPoint[1].toFixed(4)}` : ""} placeholder="Click 'Set' then Map..." readOnly style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0", backgroundColor: selectionMode === 'start' ? "#e6fffa" : "#fff", outline: selectionMode === 'start' ? "2px solid green" : "none" }} />
            <button onClick={() => setSelectionMode('start')} style={{ background: selectionMode === 'start' ? "green" : "#f0f0f0", color: selectionMode === 'start' ? "white" : "#333", border: "none", borderRadius: "6px", padding: "0 15px", cursor: "pointer", fontWeight: "bold" }}>Set</button>
          </div>
        </div>
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#333", marginBottom: "5px" }}><span style={{ color: "red", marginRight: "5px" }}>●</span> Destination</label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input value={endPoint ? `${endPoint[0].toFixed(4)}, ${endPoint[1].toFixed(4)}` : ""} placeholder="Click 'Set' then Map..." readOnly style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0", backgroundColor: selectionMode === 'end' ? "#fff5f5" : "#fff", outline: selectionMode === 'end' ? "2px solid red" : "none" }} />
            <button onClick={() => setSelectionMode('end')} style={{ background: selectionMode === 'end' ? "red" : "#f0f0f0", color: selectionMode === 'end' ? "white" : "#333", border: "none", borderRadius: "6px", padding: "0 15px", cursor: "pointer", fontWeight: "bold" }}>Set</button>
          </div>
        </div>
        <button onClick={handleClearAll} style={{ width: "100%", marginTop: "10px", background: "#f8f9fa", color: "#666", border: "1px solid #e1e5e8", borderRadius: "6px", padding: "10px", cursor: "pointer", fontWeight: "600", fontSize: "0.9rem" }}>🔄 Clear All</button>

        <div style={{ fontSize: "0.85rem", color: "#666", textAlign: "center", fontStyle: "italic", marginTop: "15px" }}>
          {selectionMode === 'start' ? "📍 Click map to set Start Point" : 
           selectionMode === 'end' ? "🏁 Click map to set Destination" : 
           startPoint && endPoint ? "✅ Points Set. Calculating..." :
           "👆 Click 'Set' to enable map selection"}
        </div>
      </div>

      {/* AI ANALYSIS CARDS */}
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

                  {/* TOGGLE DIRECTIONS */}
                  <div style={{ marginTop: "15px", paddingTop: "10px", borderTop: "1px solid #eee" }}>
                    <button 
                      onClick={(e) => toggleDirections(e, i)}
                      style={{ width: "100%", background: "none", border: "none", color: "#007bff", cursor: "pointer", fontSize: "0.9rem", fontWeight: "600", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}
                    >
                      <Navigation size={16} /> {isExpanded ? "Hide" : "Show"} Directions {isExpanded ? <ArrowUp size={14}/> : <ArrowUp size={14} style={{transform: "rotate(180deg)"}}/>}
                    </button>
                    
                    {isExpanded && (
                      <div style={{ marginTop: "10px", background: "#f8f9fa", padding: "10px", borderRadius: "8px", maxHeight: "300px", overflowY: "auto" }}>
                        {route.instructions && route.instructions.length > 0 ? (
                          route.instructions.map((step, stepIdx) => (
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
                          ))
                        ) : (
                          <div style={{ fontSize: "0.85rem", color: "#666", textAlign: "center", padding: "10px" }}>
                            No step-by-step directions available.
                          </div>
                        )}
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
  );
}