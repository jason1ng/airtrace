import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import { sampleRoutePoints, calculateRouteAverageAQI } from "../../utils/aqiCalculator";

// Fix for default marker icons missing in Leaflet
import markerIconPng from "leaflet/dist/images/marker-icon.png";
import markerShadowPng from "leaflet/dist/images/marker-shadow.png";

const RoutingControl = ({ start, end, onRoutesFound, airData = [] }) => {
  const map = useMap();

  useEffect(() => {
    if (!start || !end) return;

    // Create the Routing Control
    const routingControl = L.Routing.control({
      waypoints: [
        L.latLng(start[0], start[1]),
        L.latLng(end[0], end[1])
      ],
      routeWhileDragging: false,
      showAlternatives: true, // Show multiple paths
      fitSelectedRoutes: false, // We'll handle fitting manually
      addWaypoints: false, // Don't allow adding waypoints
      lineOptions: {
        styles: [
          { color: "transparent", weight: 0, opacity: 0 }, // Hide default routes - we'll render our own
          { color: "transparent", weight: 0, opacity: 0 },
          { color: "transparent", weight: 0, opacity: 0 },
          { color: "transparent", weight: 0, opacity: 0 },
          { color: "transparent", weight: 0, opacity: 0 }
        ]
      },
      // Customize the markers
      createMarker: function (i, waypoint, n) {
        const markerIcon = L.icon({
          iconUrl: markerIconPng,
          shadowUrl: markerShadowPng,
          iconSize: [25, 41],
          iconAnchor: [12, 41]
        });
        return L.marker(waypoint.latLng, {
          draggable: true,
          icon: markerIcon
        });
      },
      // Remove the default text panel so we can build our own beautiful UI
      containerClassName: 'routing-hidden-container'
    }).addTo(map);

    const container = routingControl.getContainer();
    if (container) {
      container.style.display = 'none';
    }

    // Listen for routes found to pass data back to your "AI" panel
    routingControl.on("routesfound", async function (e) {
      const routes = e.routes;

      // Sort routes by distance (shortest first) and take top 5
      const sortedRoutes = [...routes]
        .sort((a, b) => a.summary.totalDistance - b.summary.totalDistance)
        .slice(0, 5);

      // Process each route to calculate AQI
      const routeData = await Promise.all(
        sortedRoutes.map(async (r, index) => {
          // Extract coordinates from route - handle different coordinate formats
          let routeCoords = [];

          // Try to get coordinates from route.coordinates (most common)
          if (r.coordinates && Array.isArray(r.coordinates) && r.coordinates.length > 0) {
            // If coordinates is an array of {lat, lng} objects
            if (r.coordinates[0] && typeof r.coordinates[0] === 'object') {
              if ('lat' in r.coordinates[0] && 'lng' in r.coordinates[0]) {
                routeCoords = r.coordinates.map(coord => [coord.lat, coord.lng]);
              } else if ('latitude' in r.coordinates[0] && 'longitude' in r.coordinates[0]) {
                routeCoords = r.coordinates.map(coord => [coord.latitude, coord.longitude]);
              }
            }
            // If coordinates is an array of [lat, lng] arrays
            else if (Array.isArray(r.coordinates[0]) && r.coordinates[0].length === 2) {
              routeCoords = r.coordinates;
            }
          }

          // Try to extract from route geometry (latlngs)
          if (routeCoords.length === 0 && r.coordinates) {
            // Check if it's a Leaflet LatLng array
            if (r.coordinates[0] && r.coordinates[0].lat !== undefined) {
              routeCoords = r.coordinates.map(coord => [coord.lat, coord.lng]);
            }
          }

          // Fallback: extract from route input coordinates if available
          if (routeCoords.length === 0 && r.inputWaypoints) {
            routeCoords = r.inputWaypoints.map(wp => [wp.latLng.lat, wp.latLng.lng]);
          }

          // Last resort: try to get from route instructions/geometry
          if (routeCoords.length === 0 && r.coordinates) {
            try {
              routeCoords = r.coordinates;
            } catch (err) {
              console.warn(`Could not extract route coordinates for route ${index + 1}:`, err);
            }
          }

          console.log(`Route ${index + 1} coordinates extracted:`, routeCoords.length, 'points');

          // Sample points every 1km along the route
          const sampledPoints = routeCoords.length > 0
            ? sampleRoutePoints(routeCoords, 1000)
            : [];

          // Calculate average AQI along the route
          let averageAQI = null;
          let minAQI = null;
          let maxAQI = null;

          if (airData && airData.length > 0 && sampledPoints.length > 0) {
            const aqiResult = calculateRouteAverageAQI(sampledPoints, airData, {
              power: 2,
              maxStations: 3,
              maxDistance: 50000,
              minStations: 1
            });

            averageAQI = aqiResult.averageAQI;
            minAQI = aqiResult.minAQI;
            maxAQI = aqiResult.maxAQI;
          }

          return {
            id: index,
            name: r.name || `Route ${index + 1}`,
            summary: r.summary, // { totalDistance, totalTime }
            coordinates: routeCoords,
            instructions: r.instructions,
            sampledPoints: sampledPoints,
            pollutionLevel: averageAQI !== null ? Math.round(averageAQI) : null,
            minAQI: minAQI,
            maxAQI: maxAQI,
            trafficLevel: index === 0 ? "High" : index < 2 ? "Medium" : "Low",
            isRecommended: false // Will be set after sorting
          };
        })
      );

      // Sort by AQI (lowest/best first) for recommendation, but keep original order for display
      const sortedByAQI = [...routeData].sort((a, b) => {
        if (a.pollutionLevel === null) return 1;
        if (b.pollutionLevel === null) return -1;
        return a.pollutionLevel - b.pollutionLevel;
      });

      // Mark the best route (lowest AQI) as recommended
      if (sortedByAQI.length > 0 && sortedByAQI[0].pollutionLevel !== null) {
        const bestRouteId = sortedByAQI[0].id;
        routeData.forEach(route => {
          if (route.id === bestRouteId) {
            route.isRecommended = true;
          }
        });
      }

      if (onRoutesFound) {
        onRoutesFound(routeData);
      }
    });

    return () => {
      map.removeControl(routingControl);
    };
  }, [start, end, map, airData]);

  return null;
};

export default RoutingControl;