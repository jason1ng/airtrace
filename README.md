# AirTrace

A modern, real-time environmental and air quality monitoring application **specifically designed for Southeast Asia (SEA)**. Built with React, Leaflet, and Firebase, AirTrace allows users to visualize pollution, forecast future conditions, and optimize their travel based on air quality across the region.

## Key Features

The application combines multiple data sources to provide a comprehensive air quality experience:

### Core Mapping & Data Visualization
* **Real-Time AQI Map:** Visualizes current Air Quality Index (AQI) data using Leaflet markers and colors, sourced from the **AQICN API**.
* **Dynamic Wind Layer:** A high-fidelity, animated wind velocity overlay using `leaflet-velocity`, providing a "Windy-like" view of current and forecasted wind patterns (via **OpenWeatherMap**).
* **Time-Series Forecasting:** A **Timeline Control** allows users to switch between **Today, Tomorrow, +2 Days, and +3 Days** to view predicted AQI and wind conditions. (The wind service is optimized for SEA regions like Malaysia)

### Smart Routing & Navigation
* **AQI-Optimized Routing:** Integration with `leaflet-routing-machine` to calculate multiple travel routes.
* **"Cleanest Route" Recommendation:** Each route alternative is analyzed using a custom algorithm (Inverse Distance Weighting via `aqiCalculator.js`) to estimate the average AQI along the path. The route with the lowest overall pollution level is marked as **Recommended**.
* **Turn-by-Turn Directions:** Provides detailed route summaries, step-by-step instructions, distance, and estimated travel time.

### Personalized Experience & Security
* **Firebase Authentication:** Secure user sign-up (`Signup.jsx`) and log-in (`Login.jsx`) functionality.
* **Health Profile Storage:** During sign-up, users can select a **Health Condition/Vulnerability** (e.g., Asthma, COPD). This information is securely stored in **Firestore** (`firebase.js`) to potentially provide personalized warnings and advisories.
* **Address Selection Tool:** An interactive map component (`AddressMapSelector.jsx`) used during sign-up for users to precisely pin their home location.
* **AI Environmental Assistant:** An integrated chat interface powered by **Sea-Lion AI** to answer user queries about air quality, health advice, and local environmental conditions.

---

## Tech Stack

**Frontend:**
* **React 19** & **Vite** (Build Tool)
* **Leaflet** & **React-Leaflet** (Mapping Library)
* **Leaflet Plugins:** `leaflet-routing-machine`, `leaflet-velocity`, `leaflet.heat`
* **`axios`** (HTTP Requests)
* **`lucide-react`** (Iconography)
* **`react-router-dom`** (Routing)

**Backend & Services:**
* **Firebase** (Authentication & Firestore Database)
* **AQICN API** (Real-Time Air Quality Data)
* **OpenWeatherMap API** (Wind and Forecast Data)
* **Sea-Lion AI** (Integrated Chatbot Service)
* **OpenStreetMap & Google Maps** (Map Tiles & Traffic Layer)

---

## Attribution and Credits

This project is built upon the work of several excellent open-source libraries and utilizes data from external API providers. We extend our gratitude to them:

### Data & Services
* **Base Map Tiles:** Provided by **[OpenStreetMap (OSM)](https://www.openstreetmap.org/copyright)**. Mandatory in-app attribution: © OpenStreetMap contributors.
* **Traffic Layer:** The traffic overlay is provided by the **[Google Maps Platform](https://developers.google.com/maps/documentation/tile)**. Mandatory in-app attribution: © Google.
* **Air Quality Data:** Provided by the **[World Air Quality Index Project (AQICN)](https://aqicn.org/)**.
* **Wind & Weather Data:** Forecasts and wind velocity data provided by **[OpenWeatherMap](https://openweathermap.org/)**.
* **AI Assistant:** The conversational AI is powered by **[Sea-Lion AI](https://sea-lion.ai/)**.
* **Backend & Auth:** Authentication and personalized data storage are handled by **[Google Firebase](https://firebase.google.com/)**.

### Libraries & Assets
* **Routing Engine:** Uses the **[Leaflet Routing Machine](https://www.liedman.net/leaflet-routing-machine/)** plugin.
* **Wind Visualization:** Implemented using the **[Leaflet Velocity](https://github.com/danwild/leaflet-velocity)** plugin.
* **Iconography:** Application icons provided by **[Lucide Icons](https://lucide.dev/)**.
* **Map Markers:** Custom marker icons sourced from [Pointhi's Leaflet Color Markers](https://github.com/pointhi/leaflet-color-markers).

*(Please refer to the respective project licenses for full details.)*

## Installation and Launch

The application relies on several external APIs and Firebase services. You **must** set up your own keys and configure them, or the application will not function correctly.

### 1. Initial Setup

```bash
# Clone the repository
git clone "https://github.com/jason1ng/airtrace.git"
cd airtrace

# Install all dependencies (from package.json)
npm install 
# OR 
yarn install
