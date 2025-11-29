import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../contexts/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { fetchAirQualityData } from '../services/aqicnService';
import { calculateEstimatedAQI } from '../utils/aqiCalculator';
import { getAQIColor } from '../services/aqicnService';

/**
 * AQI Notification Component
 * Checks user's location AQI and displays notification if it's above threshold
 */
export default function AQINotification() {
  const { currentUser } = useAuth();
  const [notification, setNotification] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [currentAQI, setCurrentAQI] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isSensitiveGroup, setIsSensitiveGroup] = useState(false);

  // AQI threshold levels (based on US EPA standards)
  const AQI_THRESHOLDS = {
    GOOD: 50,
    MODERATE: 100,
    UNHEALTHY_SENSITIVE: 150,
    UNHEALTHY: 200,
    VERY_UNHEALTHY: 300,
    HAZARDOUS: 300
  };

  // Get AQI level description
  const getAQILevel = (aqi) => {
    if (!aqi) return null;
    if (aqi <= AQI_THRESHOLDS.GOOD) return { level: 'Good', color: '#00e400' };
    if (aqi <= AQI_THRESHOLDS.MODERATE) return { level: 'Moderate', color: '#ffff00' };
    if (aqi <= AQI_THRESHOLDS.UNHEALTHY_SENSITIVE) return { level: 'Unhealthy for Sensitive Groups', color: '#ff7e00' };
    if (aqi <= AQI_THRESHOLDS.UNHEALTHY) return { level: 'Unhealthy', color: '#ff0000' };
    if (aqi <= AQI_THRESHOLDS.VERY_UNHEALTHY) return { level: 'Very Unhealthy', color: '#99004c' };
    return { level: 'Hazardous', color: '#7e0023' };
  };

  // Check if AQI is at "worse level" (Unhealthy or above)
  const isWorseLevel = (aqi) => {
    return aqi && aqi >= AQI_THRESHOLDS.UNHEALTHY;
  };

  // Fetch user location and health condition from Firebase
  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Set user location
          if (userData.latitude && userData.longitude) {
            setUserLocation({
              lat: userData.latitude,
              lon: userData.longitude,
              address: userData.home_address || 'Your location'
            });
          }
          
          // Check if user is in sensitive group
          // Sensitive groups: asthma, copd, heart_disease, elderly, pregnant, other
          // Not sensitive: none
          const healthCondition = userData.disease || 'none';
          const sensitiveConditions = ['asthma', 'copd', 'heart_disease', 'elderly', 'pregnant', 'other'];
          setIsSensitiveGroup(sensitiveConditions.includes(healthCondition.toLowerCase()));
          
          console.log('User health condition:', healthCondition, 'Is sensitive group:', sensitiveConditions.includes(healthCondition.toLowerCase()));
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, [currentUser]);

  // Check AQI when user location is available or refresh is triggered
  useEffect(() => {
    if (!userLocation) return;

    const checkAQI = async () => {
      setIsChecking(true);
      try {
        // Fetch air quality station data
        const stations = await fetchAirQualityData();
        
        if (stations.length === 0) {
          console.warn('No air quality stations available');
          setIsChecking(false);
          return;
        }

        // Calculate estimated AQI for user's location
        const result = calculateEstimatedAQI(
          userLocation.lat,
          userLocation.lon,
          stations,
          {
            maxStations: 3,
            maxDistance: 50000, // 50km
            minStations: 1
          }
        );

        if (result.estimatedAQI !== null) {
          setCurrentAQI(result.estimatedAQI);
          
          const aqiInfo = getAQILevel(result.estimatedAQI);
          
          // Determine notification thresholds based on user's sensitive group status
          if (isSensitiveGroup) {
            // Sensitive groups get notifications at lower thresholds
            if (isWorseLevel(result.estimatedAQI)) {
              // AQI >= 200 (Unhealthy or worse)
              setNotification({
                type: 'warning',
                title: '⚠️ High Air Quality Alert - Sensitive Group',
                message: `Air Quality Index at your location is ${result.estimatedAQI.toFixed(1)} (${aqiInfo.level}). As someone in a sensitive group, you should avoid outdoor activities and consider wearing a mask.`,
                aqi: result.estimatedAQI,
                level: aqiInfo.level,
                color: aqiInfo.color
              });
            } else if (result.estimatedAQI >= AQI_THRESHOLDS.UNHEALTHY_SENSITIVE) {
              // AQI >= 150 (Unhealthy for Sensitive Groups)
              setNotification({
                type: 'warning',
                title: '🌤️ Air Quality Alert - Sensitive Group',
                message: `Air Quality Index at your location is ${result.estimatedAQI.toFixed(1)} (${aqiInfo.level}). As someone in a sensitive group, you should limit outdoor activities and take precautions.`,
                aqi: result.estimatedAQI,
                level: aqiInfo.level,
                color: aqiInfo.color
              });
            } else if (result.estimatedAQI >= AQI_THRESHOLDS.MODERATE) {
              // AQI >= 100 (Moderate) - Sensitive groups should be aware
              setNotification({
                type: 'info',
                title: '💡 Air Quality Notice - Sensitive Group',
                message: `Air Quality Index at your location is ${result.estimatedAQI.toFixed(1)} (${aqiInfo.level}). As someone in a sensitive group, you may want to reduce prolonged outdoor activities.`,
                aqi: result.estimatedAQI,
                level: aqiInfo.level,
                color: aqiInfo.color
              });
            }
          } else {
            // Non-sensitive users only get notifications at higher thresholds
            if (isWorseLevel(result.estimatedAQI)) {
              // AQI >= 200 (Unhealthy or worse)
              setNotification({
                type: 'warning',
                title: '⚠️ High Air Quality Alert',
                message: `Air Quality Index at your location is ${result.estimatedAQI.toFixed(1)} (${aqiInfo.level}). Consider limiting outdoor activities.`,
                aqi: result.estimatedAQI,
                level: aqiInfo.level,
                color: aqiInfo.color
              });
            } else if (result.estimatedAQI >= AQI_THRESHOLDS.UNHEALTHY_SENSITIVE) {
              // AQI >= 150 (Unhealthy for Sensitive Groups) - Informational for non-sensitive
              setNotification({
                type: 'info',
                title: '🌤️ Air Quality Notice',
                message: `Air Quality Index at your location is ${result.estimatedAQI.toFixed(1)} (${aqiInfo.level}). Sensitive groups should take precautions.`,
                aqi: result.estimatedAQI,
                level: aqiInfo.level,
                color: aqiInfo.color
              });
            }
          }
        }
      } catch (error) {
        console.error('Error checking AQI:', error);
      } finally {
        setIsChecking(false);
      }
    };

    // Initial check
    checkAQI();
    
    // Check AQI every 5 minutes
    const interval = setInterval(checkAQI, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userLocation, refreshTrigger, isSensitiveGroup]);

  // Auto-dismiss notification after 10 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  if (!notification || !currentUser) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 10000,
        minWidth: '350px',
        maxWidth: '450px',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        border: `3px solid ${notification.color}`,
        animation: 'slideIn 0.3s ease-out',
        overflow: 'hidden'
      }}
    >
      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(400px);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}
      </style>
      
      {/* Header */}
      <div
        style={{
          background: notification.color,
          color: 'white',
          padding: '15px 20px',
          fontWeight: 'bold',
          fontSize: '1.1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span>{notification.title}</span>
        <button
          onClick={() => setNotification(null)}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: 'white',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            cursor: 'pointer',
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold'
          }}
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '20px' }}>
        <div style={{ marginBottom: '15px' }}>
          <div style={{ 
            fontSize: '2rem', 
            fontWeight: 'bold', 
            color: notification.color,
            marginBottom: '5px'
          }}>
            {notification.aqi.toFixed(1)} AQI
          </div>
          <div style={{ 
            fontSize: '0.9rem', 
            color: '#666',
            marginBottom: '10px'
          }}>
            Level: {notification.level}
          </div>
          <div style={{ 
            fontSize: '0.95rem', 
            color: '#333',
            lineHeight: '1.5'
          }}>
            {notification.message}
          </div>
        </div>

        {/* Location info */}
        {userLocation && (
          <div style={{
            padding: '10px',
            background: '#f5f5f5',
            borderRadius: '6px',
            fontSize: '0.85rem',
            color: '#666',
            marginTop: '10px'
          }}>
            📍 {userLocation.address}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          marginTop: '15px' 
        }}>
          <button
            onClick={() => {
              setNotification(null);
              // Trigger AQI check by incrementing refresh trigger
              setRefreshTrigger(prev => prev + 1);
            }}
            style={{
              flex: 1,
              padding: '10px',
              background: notification.color,
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.9rem'
            }}
          >
            Refresh
          </button>
          <button
            onClick={() => setNotification(null)}
            style={{
              flex: 1,
              padding: '10px',
              background: '#f0f0f0',
              color: '#333',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.9rem'
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

