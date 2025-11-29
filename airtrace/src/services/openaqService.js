import axios from "axios";

// Using the proxy path
const BASE_URL = "/openaq/v3"; 
const API_KEY = "9ecb224692af514d0cfbe86b6241a5ab4b9c7013c36fce1fbdebb2547ec37353"; // <--- PASTE YOUR KEY HERE

export const fetchAirQualityData = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/parameters/2/latest`, {
      headers: {
        'X-API-Key': API_KEY
      },
      params: {
        countries_id: 2,        // Malaysia
        limit: 1000,
        order_by: 'datetime',
        sort: 'desc'
      }
    });

    return response.data.results
      .map(item => {
        // 1. Check if value exists
        if (item.value === null || item.value === undefined) return null;

        // 2. SAFETY CHECK: Extract coordinates safely
        const lat = item.coordinates?.latitude;
        const lng = item.coordinates?.longitude;

        // 3. STRICT FILTER: If lat or lng are NOT numbers, throw this item away.
        // This prevents the "Cannot read properties of null" error.
        if (typeof lat !== 'number' || typeof lng !== 'number') return null;

        return {
          id: item.locationsId, // Unique ID for React Keys
          value: item.value,
          coordinates: [lat, lng], // Guaranteed to be [Number, Number]
          location: `Station ${item.locationsId}`,
          lastUpdated: item.datetime?.utc
        };
      })
      .filter(item => item !== null); // Remove the nulls (bad data)

  } catch (error) {
    console.error("Error fetching Malaysia OpenAQ V3 data:", error);
    return [];
  }
};

export const getAQIColor = (pm25) => {
  if (pm25 == null) return "gray";
  if (pm25 <= 12) return "#00e400"; 
  if (pm25 <= 35.4) return "#ffff00"; 
  if (pm25 <= 55.4) return "#ff7e00"; 
  if (pm25 <= 150.4) return "#ff0000"; 
  return "#8f3f97"; 
};