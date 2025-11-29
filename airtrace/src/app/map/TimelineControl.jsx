import React from 'react';
import { Clock, Wind } from 'lucide-react';

const TimelineControl = ({ selectedDay, onDayChange, windDirection }) => {
  const days = ["Today", "Tomorrow", "+2 Days", "+3 Days"];

  return (
    <div style={{
      position: 'absolute',
      bottom: '30px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      background: 'rgba(255, 255, 255, 0.95)',
      padding: '15px 25px',
      borderRadius: '20px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '300px', // Fixed width for mobile responsiveness
      backdropFilter: 'blur(5px)'
    }}>
      
      {/* Header with Wind Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '10px', fontSize: '0.85rem', color: '#555', fontWeight: '600' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Clock size={16} color="#0C2B4E" />
          <span>AI Forecast</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span>AQI</span>
        </div>
      </div>

      {/* Slider */}
      <input
        type="range"
        min="0"
        max="3"
        step="1"
        value={selectedDay}
        onChange={(e) => onDayChange(parseInt(e.target.value))}
        style={{
          width: '100%',
          cursor: 'pointer',
          accentColor: '#0C2B4E',
          marginBottom: '10px'
        }}
      />

      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '0.75rem', color: '#333' }}>
        {days.map((day, index) => (
          <span 
            key={index} 
            style={{ 
              fontWeight: selectedDay === index ? 'bold' : 'normal',
              color: selectedDay === index ? '#0C2B4E' : '#999',
              transition: 'all 0.2s'
            }}
          >
            {day}
          </span>
        ))}
      </div>
    </div>
  );
};

export default TimelineControl;