// src/services/windyService.js
import axios from 'axios';

// Keep your existing key
export const OWM_API_KEY = "a4636529f089cf54f303c99e6bc73455";

// OpenWeatherMap API Base URL
const OWM_BASE_URL = "https://api.openweathermap.org/data/2.5";

/**
 * Predefined regions for Southeast Asia optimized for OWM Free Tier
 * 
 * Free Tier Limits:
 * - 60 calls per minute
 * - 1,000,000 calls per month
 * 
 * API Call Estimates:
 * - MALAYSIA: ~52 points = 52 API calls (fits in 1 batch, ~1 second)
 * - SOUTHEAST_ASIA: ~120 points = 120 API calls (2 batches, ~2-3 seconds)
 * - MALAYSIA_DETAILED: ~127 points = 127 API calls (3 batches, ~3-4 seconds)
 * 
 * All regions are well within free tier limits!
 */
export const REGIONS = {
  MALAYSIA: {
    name: 'Malaysia',
    bounds: { minLat: 0.85, maxLat: 7.36, minLon: 99.64, maxLon: 119.27 },
    optimalStep: 1.5 // ~52 points, fits in one batch (recommended)
  },
  SOUTHEAST_ASIA: {
    name: 'Southeast Asia',
    bounds: { minLat: -10, maxLat: 20, minLon: 95, maxLon: 140 },
    optimalStep: 2.5 // ~120 points, needs 2 batches but manageable
  },
  MALAYSIA_DETAILED: {
    name: 'Malaysia (Detailed)',
    bounds: { minLat: 0.85, maxLat: 7.36, minLon: 99.64, maxLon: 119.27 },
    optimalStep: 1.0 // ~127 points, needs 2-3 batches (higher resolution)
  }
};

export const windyLayers = {
  // Nitrogen Dioxide (Pollution)
  no2: `https://tile.openweathermap.org/map/no2/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`,
  
  // PM 2.5 (Haze)
  pm25: `https://tile.openweathermap.org/map/pm2_5/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`,
  
  // NEW: Wind Speed & Direction Layer
  wind: `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`,
  
  // NEW: Precipitation (Rain) - useful for "washing away" pollution context
  rain: `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`,
};

/**
 * Fetches current wind data from OpenWeatherMap API for a single location
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<{speed: number, deg: number}>} Wind speed (m/s) and direction (degrees)
 */
const fetchWindDataForPoint = async (lat, lon) => {
  try {
    const response = await axios.get(`${OWM_BASE_URL}/weather`, {
      params: {
        lat,
        lon,
        appid: OWM_API_KEY,
        units: 'metric' // Returns wind speed in m/s
      }
    });

    if (response.data && response.data.wind) {
      return {
        speed: response.data.wind.speed || 0, // m/s
        deg: response.data.wind.deg || 0      // degrees (0-360, 0 = North)
      };
    }
    return { speed: 0, deg: 0 };
  } catch (error) {
    console.error(`Error fetching OWM wind data for (${lat}, ${lon}):`, error);
    return { speed: 0, deg: 0 };
  }
};

/**
 * Fetches wind data for multiple grid points with rate limiting
 * Free tier: 60 calls/minute, so we batch requests with delays
 * @param {Array<{lat: number, lon: number}>} gridPoints - Array of lat/lon points
 * @returns {Promise<Array<{speed: number, deg: number}>>} Array of wind data
 */
const fetchWindDataForGrid = async (gridPoints) => {
  const results = [];
  const BATCH_SIZE = 50; // Stay under 60/min limit
  const DELAY_MS = 1000; // 1 second delay between batches

  for (let i = 0; i < gridPoints.length; i += BATCH_SIZE) {
    const batch = gridPoints.slice(i, i + BATCH_SIZE);
    
    // Fetch all points in batch concurrently
    const batchPromises = batch.map(point => fetchWindDataForPoint(point.lat, point.lon));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Add delay between batches to respect rate limits (except for last batch)
    if (i + BATCH_SIZE < gridPoints.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  return results;
};

/**
 * Converts wind speed and direction to U (zonal) and V (meridional) components
 * @param {number} speed - Wind speed in m/s
 * @param {number} deg - Wind direction in degrees (0 = North, clockwise)
 * @returns {{u: number, v: number}} U and V components in m/s
 */
const windToUV = (speed, deg) => {
  // Convert degrees to radians
  const angleRad = (deg * Math.PI) / 180;
  
  // OWM wind direction is "from" (meteorological convention)
  // U = -speed * sin(angle) (West-East, positive = East)
  // V = -speed * cos(angle) (South-North, positive = North)
  const u = -speed * Math.sin(angleRad);
  const v = -speed * Math.cos(angleRad);
  
  return { u, v };
};

/**
 * Calculates optimal step size to stay within free tier limits (60 calls/min)
 * @param {number} minLat - Minimum latitude
 * @param {number} maxLat - Maximum latitude
 * @param {number} minLon - Minimum longitude
 * @param {number} maxLon - Maximum longitude
 * @param {number} maxPoints - Maximum number of points (default: 50 for one batch)
 * @returns {number} Optimal step size in degrees
 */
const calculateOptimalStep = (minLat, maxLat, minLon, maxLon, maxPoints = 50) => {
  const latRange = maxLat - minLat;
  const lonRange = maxLon - minLon;
  
  // Calculate points for different step sizes
  for (let step = 0.5; step <= 5; step += 0.5) {
    const latPoints = Math.ceil(latRange / step) + 1;
    const lonPoints = Math.ceil(lonRange / step) + 1;
    const totalPoints = latPoints * lonPoints;
    
    if (totalPoints <= maxPoints) {
      return step;
    }
  }
  
  // If no step fits, return a larger step that will need batching
  return Math.max(2.0, Math.sqrt((latRange * lonRange) / maxPoints));
};

/**
 * Fetches gridded wind data from OpenWeatherMap and formats it for leaflet-velocity
 * @param {number} minLat - Minimum latitude
 * @param {number} maxLat - Maximum latitude
 * @param {number} minLon - Minimum longitude
 * @param {number} maxLon - Maximum longitude
 * @param {number} step - Grid step in degrees (auto-calculated if not provided)
 * @returns {Promise<Array>} Formatted data for leaflet-velocity
 */
export const fetchOWMWindGrid = async (minLat, maxLat, minLon, maxLon, step = null) => {
  // Auto-calculate optimal step if not provided
  if (step === null) {
    step = calculateOptimalStep(minLat, maxLat, minLon, maxLon);
    console.log(`Auto-calculated optimal step size: ${step}°`);
  }
  // Generate grid points
  const gridPoints = [];
  const uniqueLats = [];
  const uniqueLons = [];
  
  // North to south, west to east (standard GRIB order)
  for (let lat = maxLat; lat >= minLat; lat -= step) {
    if (!uniqueLats.includes(lat)) uniqueLats.push(lat);
    for (let lon = minLon; lon <= maxLon; lon += step) {
      if (!uniqueLons.includes(lon)) uniqueLons.push(lon);
      gridPoints.push({ lat, lon });
    }
  }

  console.log(`Fetching OWM wind data for ${gridPoints.length} grid points...`);
  
  // Fetch wind data for all grid points
  const windData = await fetchWindDataForGrid(gridPoints);
  
  // Convert to U and V components
  const uComponentData = [];
  const vComponentData = [];
  
  windData.forEach(({ speed, deg }) => {
    const { u, v } = windToUV(speed, deg);
    uComponentData.push(u);
    vComponentData.push(v);
  });

  // Format for leaflet-velocity (GRIB-like format)
  const refTime = new Date().toISOString();
  
  return [{
    header: {
      parameterCategory: 2, // Wind/Velocity
      parameterNumber: 2,   // U-component
      parameterUnit: 'm/s',
      nx: uniqueLons.length, // Number of longitude points (columns)
      ny: uniqueLats.length, // Number of latitude points (rows)
      lo1: minLon,          // Starting longitude (West)
      la1: maxLat,          // Starting latitude (North)
      dx: step,             // Longitude step
      dy: step,             // Latitude step
      refTime: refTime,     // Forecast time
    },
    data: uComponentData
  }, {
    header: {
      parameterCategory: 2, // Wind/Velocity
      parameterNumber: 3,   // V-component
      parameterUnit: 'm/s',
      nx: uniqueLons.length,
      ny: uniqueLats.length,
      lo1: minLon,
      la1: maxLat,
      dx: step,
      dy: step,
      refTime: refTime,
    },
    data: vComponentData
  }];
};

/**
 * Fetches wind data for a predefined region (Malaysia or Southeast Asia)
 * @param {string} regionName - Name of the region ('MALAYSIA', 'SOUTHEAST_ASIA', or 'MALAYSIA_DETAILED')
 * @returns {Promise<Array>} Formatted data for leaflet-velocity
 */
export const fetchOWMWindForRegion = async (regionName = 'SOUTHEAST_ASIA') => {
  const region = REGIONS[regionName];
  
  if (!region) {
    console.warn(`Unknown region: ${regionName}. Using SOUTHEAST_ASIA instead.`);
    return fetchOWMWindForRegion('SOUTHEAST_ASIA');
  }
  
  console.log(`Fetching wind data for ${region.name}...`);
  const { minLat, maxLat, minLon, maxLon } = region.bounds;
  
  return fetchOWMWindGrid(minLat, maxLat, minLon, maxLon, region.optimalStep);
};