import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

const HeatmapLayer = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    // Safety check
    if (!points || points.length === 0) return;

    // Create layer
    const heat = L.heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 10,
    }).addTo(map);

    // Cleanup function: Removed the layer when data changes
    return () => {
      map.removeLayer(heat);
    };
  }, [points, map]); // Dependencies match useMemo in parent

  return null;
};

export default HeatmapLayer;