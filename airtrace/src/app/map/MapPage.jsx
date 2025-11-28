// src/app/map/MapPage.jsx
import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; 


import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function MapPage() {
  // Coordinates for Kuala Lumpur
  const position = [3.1473, 101.6991]; 

  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      {/* The Map Component */}
      <MapContainer center={position} zoom={13} style={{ height: "100%", width: "100%" }}>
        
        {/* The Skin of the map (OpenStreetMap is free) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* A Sample Marker at Kuala Lumpur */}
        <Marker position={position}>
          <Popup>
            Start Point: Kuala Lumpur <br /> Air Quality: Moderate.
          </Popup>
        </Marker>

      </MapContainer>
    </div>
  );
}