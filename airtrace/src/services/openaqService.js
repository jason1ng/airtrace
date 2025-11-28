// src/services/openaqService.js
import axios from "axios";

// Using the proxy path we set up earlier
const BASE_URL = "/openaq/v3"; 
const API_KEY = "9ecb224692af514d0cfbe86b6241a5ab4b9c7013c36fce1fbdebb2547ec37353"; // <--- PASTE YOUR KEY HERE

export const fetchAirQualityData = async (lat, lng, radius = 10000) => {
  try {
    // V3: We fetch the latest PM2.5 measurements (Parameter ID = 2)
    const response = await axios.get(`${BASE_URL}/parameters/2/latest`, {
      headers: {
        'X-API-Key': API_KEY // Required for V3
      },
      params: {
        coordinates: `${lat},${lng}`,
        radius: radius, 
        limit: 100,
        order_by: 'lastUpdated',
        sort: 'desc'
      }
    });
    return response.data.results;
  } catch (error) {
    console.error("Error fetching OpenAQ V3 data:", error);
    return [];
  }
};

export const getAQIColor = (pm25) => {
  if (pm25 == null) return "gray";
  if (pm25 <= 12) return "#00e400"; // Good
  if (pm25 <= 35.4) return "#ffff00"; // Moderate
  if (pm25 <= 55.4) return "#ff7e00"; // Unhealthy for Sensitive
  if (pm25 <= 150.4) return "#ff0000"; // Unhealthy
  return "#8f3f97"; // Very Unhealthy
};