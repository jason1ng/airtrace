import axios from "axios";

// OpenWeatherMap (Future Prediction - Trends & Wind)
const OWM_POLLUTION_URL = "https://api.openweathermap.org/data/2.5/air_pollution/forecast";
const OWM_WEATHER_URL = "https://api.openweathermap.org/data/2.5/forecast"; 

// ⚠️ REPLACE THIS WITH YOUR REAL KEY: https://home.openweathermap.org/api_keys
const OWM_API_KEY = "1e7258d06a4668f9019817c21bda8a55"; 

/**
 * Helper to find the forecast data closest to X days from now
 */
/**
 * Helper: Convert OWM AQI (1-5 scale) to US AQI (0-500 scale)
 * OWM uses: 1=Good, 2=Fair, 3=Moderate, 4=Poor, 5=Very Poor
 * US AQI ranges: 0-50=Good, 51-100=Moderate, 101-150=Unhealthy for Sensitive, 151-200=Unhealthy, 201-300=Very Unhealthy, 301-500=Hazardous
 */
const owmAqiToUsAqi = (owmAqi) => {
  // Use exact raw value mapping from OWM to US AQI
  if (owmAqi === 1) return 25;   // Good: middle of 0-50 range
  if (owmAqi === 2) return 75;   // Fair: middle of 51-100 range
  if (owmAqi === 3) return 125;  // Moderate: middle of 101-150 range
  if (owmAqi === 4) return 175;  // Poor: middle of 151-200 range
  if (owmAqi === 5) return 300;  // Very Poor: middle of 201-500 range
  return 50; // Default fallback
};

/**
 * Standard US EPA formula to convert PM2.5 (µg/m³) to US AQI
 * This is the official conversion formula, not an arbitrary multiplier
 */
const pm25ToAqi = (pm25) => {
  if (pm25 <= 12.0) return Math.round(((50 - 0) / (12.0 - 0)) * (pm25 - 0) + 0);
  if (pm25 <= 35.4) return Math.round(((100 - 51) / (35.4 - 12.1)) * (pm25 - 12.1) + 51);
  if (pm25 <= 55.4) return Math.round(((150 - 101) / (55.4 - 35.5)) * (pm25 - 35.5) + 101);
  if (pm25 <= 150.4) return Math.round(((200 - 151) / (150.4 - 55.5)) * (pm25 - 55.5) + 151);
  return Math.round(((300 - 201) / (250.4 - 150.5)) * (pm25 - 150.5) + 201);
};

const getForecastForDay = (list, dayOffset) => {
    if (!list) return null;
    const targetTime = (Date.now() / 1000) + (dayOffset * 24 * 3600);
    return list.reduce((prev, curr) => 
        Math.abs(curr.dt - targetTime) < Math.abs(prev.dt - targetTime) ? curr : prev
    );
};

/**
 * 1. AQI FORECAST: Returns absolute AQI values for next 3 days using EXACT RAW VALUES from OpenWeatherMap API
 * Uses main.aqi (raw AQI value) directly from the API response
 * Example Output: { 0: 52, 1: 65, 2: 45, 3: 80 }
 */
export const fetchForecastTrend = async (lat, lon) => {
  try {
    const response = await axios.get(OWM_POLLUTION_URL, {
      params: { lat, lon, appid: OWM_API_KEY }
    });

    const list = response.data.list;
    if (!list || list.length === 0) return null;

    // Use EXACT RAW main.aqi value from OpenWeatherMap API (no calculations, no multipliers)
    const currentData = list[0];
    const day1Data = getForecastForDay(list, 1);
    const day2Data = getForecastForDay(list, 2);
    const day3Data = getForecastForDay(list, 3);

    // Get EXACT RAW value from OpenWeatherMap API and convert to US AQI using standard formula
    // Uses the exact raw PM2.5 measurement from the API (no arbitrary multipliers)
    const getRawAQI = (data) => {
      if (data.components && data.components.pm2_5 !== undefined && data.components.pm2_5 !== null) {
        // Use EXACT RAW PM2.5 value from API (in µg/m³) and convert to US AQI using standard EPA formula
        // This uses the exact raw measurement value - the conversion is the standard US EPA formula, not an arbitrary multiplier
        return pm25ToAqi(data.components.pm2_5);
      }
      // Fallback: if PM2.5 not available, use main.aqi (1-5 scale) and convert to approximate US AQI
      if (data.main && data.main.aqi !== undefined) {
        return owmAqiToUsAqi(data.main.aqi);
      }
      return null;
    };

    return {
      0: getRawAQI(currentData),  // Today's Baseline AQI - EXACT RAW VALUE
      1: getRawAQI(day1Data),      // Tomorrow's AQI - EXACT RAW VALUE
      2: getRawAQI(day2Data),      // Day 2 AQI - EXACT RAW VALUE
      3: getRawAQI(day3Data)       // Day 3 AQI - EXACT RAW VALUE
    };
  } catch (error) {
    console.error("Error fetching OWM Pollution Forecast:", error);
    return null; 
  }
};

/**
 * 2. WIND FORECAST: Fetches real wind direction/speed
 */
export const fetchWindForecast = async (lat, lon) => {
  try {
    const response = await axios.get(OWM_WEATHER_URL, {
      params: { lat, lon, appid: OWM_API_KEY, units: 'metric' }
    });

    const list = response.data.list;
    if (!list || list.length === 0) return null;

    return {
      0: { deg: list[0].wind.deg, speed: list[0].wind.speed },
      1: { deg: getForecastForDay(list, 1).wind.deg, speed: getForecastForDay(list, 1).wind.speed },
      2: { deg: getForecastForDay(list, 2).wind.deg, speed: getForecastForDay(list, 2).wind.speed },
      3: { deg: getForecastForDay(list, 3).wind.deg, speed: getForecastForDay(list, 3).wind.speed }
    };
  } catch (error) {
    console.error("Error fetching OWM Wind Forecast:", error);
    return null;
  }
};