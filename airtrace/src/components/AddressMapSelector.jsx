import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom pin icon
const pinIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to handle map clicks
function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click: (e) => {
      onLocationSelect([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

export default function AddressMapSelector({ onLocationSelect, initialAddress, initialCoords }) {
  const [selectedLocation, setSelectedLocation] = useState(initialCoords || null);
  const [address, setAddress] = useState(initialAddress || '');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [center, setCenter] = useState(initialCoords || [3.1473, 101.6991]); // Default to Malaysia

  // Geocode address to coordinates
  const geocodeAddress = async (addressText) => {
    if (!addressText || addressText.trim() === '') {
      return;
    }

    setIsGeocoding(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressText)}&limit=1`,
        {
          headers: {
            'User-Agent': 'AirTrace App'
          }
        }
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        const coords = [lat, lon];
        setSelectedLocation(coords);
        setCenter(coords);
        onLocationSelect(coords, data[0].display_name);
      } else {
        alert('Address not found. Please try a more specific address or click on the map to select your location.');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      alert('Error finding address. Please click on the map to select your location.');
    } finally {
      setIsGeocoding(false);
    }
  };

  // Reverse geocode coordinates to address
  const reverseGeocode = async (coords) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords[0]}&lon=${coords[1]}`,
        {
          headers: {
            'User-Agent': 'AirTrace App'
          }
        }
      );
      const data = await response.json();
      
      if (data && data.display_name) {
        setAddress(data.display_name);
        onLocationSelect(coords, data.display_name);
      } else {
        // If reverse geocoding fails, still pass coordinates with a default address
        const defaultAddress = `${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`;
        setAddress(defaultAddress);
        onLocationSelect(coords, defaultAddress);
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      // Even if reverse geocoding fails, pass the coordinates
      const defaultAddress = `${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`;
      setAddress(defaultAddress);
      onLocationSelect(coords, defaultAddress);
    }
  };

  const handleMapClick = (coords) => {
    setSelectedLocation(coords);
    setCenter(coords);
    reverseGeocode(coords);
  };

  const handleAddressSearch = () => {
    geocodeAddress(address);
  };

  return (
    <div style={{ marginTop: '15px' }}>
      <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>
        Home Address
      </label>
      
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAddressSearch()}
          placeholder="Enter address or click on map..."
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            fontSize: '0.9rem'
          }}
        />
        <button
          type="button"
          onClick={handleAddressSearch}
          disabled={isGeocoding}
          style={{
            padding: '10px 15px',
            borderRadius: '6px',
            border: 'none',
            background: '#0C2B4E',
            color: 'white',
            cursor: isGeocoding ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            opacity: isGeocoding ? 0.6 : 1
          }}
        >
          {isGeocoding ? 'Searching...' : 'Search'}
        </button>
      </div>

      <div style={{ 
        height: '300px', 
        width: '100%', 
        borderRadius: '8px', 
        overflow: 'hidden',
        border: '2px solid #e2e8f0',
        marginBottom: '10px'
      }}>
        <MapContainer
          center={center}
          zoom={selectedLocation ? 15 : 11}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {selectedLocation && (
            <Marker position={selectedLocation} icon={pinIcon} />
          )}
          <MapClickHandler onLocationSelect={handleMapClick} />
        </MapContainer>
      </div>

      {selectedLocation && (
        <div style={{
          padding: '10px',
          background: '#f0f7ff',
          borderRadius: '6px',
          fontSize: '0.85rem',
          color: '#0C2B4E'
        }}>
          <strong>Selected Location:</strong><br />
          Latitude: {selectedLocation[0].toFixed(6)}, Longitude: {selectedLocation[1].toFixed(6)}
          {address && <><br /><strong>Address:</strong> {address}</>}
        </div>
      )}

      <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '8px', fontStyle: 'italic' }}>
        💡 Tip: Enter your address and click "Search", or click directly on the map to pinpoint your location
      </p>
    </div>
  );
}

