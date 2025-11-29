import axios from "axios";

// AQICN API Base URL
const BASE_URL = "https://api.waqi.info"; 
// >>> IMPORTANT: REPLACE THIS with the token you acquired <<<
const API_TOKEN = "85c000be83b20ff3e5b80d4f4e82afc3b1615bb2"; 

// Approximate map bounds for a box covering Malaysia (minLat, minLng, maxLat, maxLng)
//const MALAYSIA_BOUNDS = "-2,99,8,119"; 

/**
 * Fetches air quality data from the AQICN Map Bounds API.
 */
export const fetchAirQualityData = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/map/bounds/`, {
      params: {
        latlng: "-90,-180,90,180",
        token: API_TOKEN
      }
    });

    // Handle non-'ok' status, which might include error messages from the API
    if (response.data.status !== "ok") {
        console.error("AQICN API Error:", response.data.data);
        return [];
    }

    console.log("Raw AQICN data fetched:", response.data.data);

    // Process the array of station data returned under 'data'
    return response.data.data.map(item => {
        // 1. Filter out items with missing AQI value, coordinates, or station name
        if (item.aqi === null || item.aqi === undefined || item.aqi === '-' || 
            !item.lat || !item.lon || !item.station?.name) {
            return null;
        }

        return {
          id: item.uid, 
          value: item.aqi, 
          coordinates: [item.lat, item.lon], 
          location: item.station.name, 
          // FIX: Use optional chaining (?.) to safely access nested time property
          lastUpdated: item.time?.v || new Date().toISOString() // Fallback time if missing
        };
    })
    .filter(item => item !== null); // Remove any null items
    
  } catch (error) {
    // This will catch the 400 Bad Request error if it's thrown by Axios/the browser
    console.error("Error fetching AQICN data:", error);
    return [];
  }
};

/**
 * Air Quality Index (AQI) to Color mapping.
 */
export const getAQIColor = (aqi) => {
  if (aqi <= 50) return '#00e400'; // Green: Good
  if (aqi <= 100) return '#ffff00'; // Yellow: Moderate
  if (aqi <= 150) return '#ff7e00'; // Orange: Unhealthy for Sensitive Groups
  if (aqi <= 200) return '#ff0000'; // Red: Unhealthy
  if (aqi <= 300) return '#99004c'; // Purple: Very Unhealthy
  return '#7e0023'; // Maroon: Hazardous
};