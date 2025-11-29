import React, { useState, useEffect } from 'react';
import { OWM_API_KEY } from '../services/windyService';
import axios from 'axios';

const OWM_BASE_URL = "https://api.openweathermap.org/data/2.5";

/**
 * Wind Compass Component
 * Displays wind direction and speed in knots at the top right of the map
 */
export default function WindCompass({ centerPosition }) {
  const [windData, setWindData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Convert m/s to knots (1 m/s = 1.944 knots)
  const msToKnots = (ms) => {
    return (ms * 1.944).toFixed(1);
  };

  // Get wind direction name
  const getWindDirection = (degrees) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  };

  // Fetch wind data for the center position
  useEffect(() => {
    if (!centerPosition || centerPosition.length !== 2) return;

    const fetchWindData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const [lat, lon] = centerPosition;
        const response = await axios.get(`${OWM_BASE_URL}/weather`, {
          params: {
            lat,
            lon,
            appid: OWM_API_KEY,
            units: 'metric'
          }
        });

        if (response.data && response.data.wind) {
          setWindData({
            speed: response.data.wind.speed || 0, // m/s
            deg: response.data.wind.deg || 0,     // degrees
            gust: response.data.wind.gust || null // gust speed (optional)
          });
        } else {
          setError('No wind data available');
        }
      } catch (err) {
        console.error('Error fetching wind data:', err);
        setError('Failed to load wind data');
      } finally {
        setLoading(false);
      }
    };

    fetchWindData();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchWindData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [centerPosition]);

  if (loading && !windData) {
    return (
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        background: 'white',
        borderRadius: '12px',
        padding: '15px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        minWidth: '140px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '12px', color: '#666' }}>Loading wind...</div>
      </div>
    );
  }

  if (error && !windData) {
    return null; // Don't show error state, just hide compass
  }

  if (!windData) return null;

  const windSpeedKnots = msToKnots(windData.speed);
  const windDirection = getWindDirection(windData.deg);
  // Wind direction from API is "from" direction (meteorological convention)
  // To show where wind is blowing TO, we add 180 degrees
  // Also adjust for compass display (0° = North, clockwise)
  const windBlowingTo = (windData.deg + 180) % 360;
  const rotation = windBlowingTo; // Rotate compass needle to show wind direction (where it's blowing TO)

  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      right: '20px',
      zIndex: 1000,
      background: 'white',
      borderRadius: '12px',
      padding: '15px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      minWidth: '140px',
      border: '2px solid #0C2B4E'
    }}>
      {/* Header */}
      <div style={{
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#0C2B4E',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '10px',
        textAlign: 'center'
      }}>
        Wind Compass
      </div>

      {/* Compass Circle */}
      <div style={{
        position: 'relative',
        width: '110px',
        height: '110px',
        margin: '0 auto 10px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        border: '3px solid #0C2B4E',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {/* Compass Rose - Fixed */}
        <div style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          borderRadius: '50%'
        }}>
          {/* N, E, S, W markers */}
          {['N', 'E', 'S', 'W'].map((dir, idx) => {
            const angle = idx * 90;
            const rad = (angle - 90) * Math.PI / 180;
            const x = 50 + 40 * Math.cos(rad);
            const y = 50 + 40 * Math.sin(rad);
            
            return (
              <div
                key={dir}
                style={{
                  position: 'absolute',
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%, -50%)',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: dir === 'N' ? '#d32f2f' : '#0C2B4E'
                }}
              >
                {dir}
              </div>
            );
          })}
          
          {/* Minor direction markers */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, idx) => {
            const rad = (angle - 90) * Math.PI / 180;
            const x1 = 50 + 35 * Math.cos(rad);
            const y1 = 50 + 35 * Math.sin(rad);
            const x2 = 50 + 42 * Math.cos(rad);
            const y2 = 50 + 42 * Math.sin(rad);
            
            return (
              <div
                key={idx}
                style={{
                  position: 'absolute',
                  left: `${x1}%`,
                  top: `${y1}%`,
                  width: `${Math.abs(x2 - x1)}%`,
                  height: '2px',
                  background: '#666',
                  transformOrigin: 'left center',
                  transform: `translate(-50%, -50%) rotate(${angle}deg)`
                }}
              />
            );
          })}
        </div>

        {/* Wind Direction Needle - Rotates to show where wind is blowing TO */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '4px',
          height: '40px',
          background: 'linear-gradient(to bottom, #d32f2f 0%, #ff6b6b 100%)',
          borderRadius: '2px',
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          transformOrigin: 'center center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          zIndex: 10
        }}>
          {/* Arrow head pointing in wind direction (at top of needle) */}
          <div style={{
            position: 'absolute',
            top: '-12px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderBottom: '16px solid #d32f2f',
            filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))'
          }} />
        </div>

        {/* Center dot */}
        <div style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          background: '#0C2B4E',
          border: '2px solid white',
          zIndex: 11,
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }} />
      </div>

      {/* Wind Info */}
      <div style={{
        textAlign: 'center',
        fontSize: '13px',
        color: '#333'
      }}>
        <div style={{
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#0C2B4E',
          marginBottom: '4px'
        }}>
          {windSpeedKnots} kt
        </div>
        <div style={{
          fontSize: '11px',
          color: '#666',
          marginBottom: '2px'
        }}>
          {windDirection} (from {windData.deg}°)
        </div>
        <div style={{
          fontSize: '10px',
          color: '#999',
          fontStyle: 'italic',
          marginTop: '2px'
        }}>
          Blowing to {windBlowingTo.toFixed(0)}°
        </div>
        <div style={{
          fontSize: '10px',
          color: '#999',
          marginTop: '4px'
        }}>
          {windData.speed.toFixed(1)} m/s
        </div>
        {windData.gust && (
          <div style={{
            fontSize: '10px',
            color: '#ff9800',
            marginTop: '4px',
            fontWeight: 'bold'
          }}>
            Gusts: {msToKnots(windData.gust)} kt
          </div>
        )}
      </div>
    </div>
  );
}

