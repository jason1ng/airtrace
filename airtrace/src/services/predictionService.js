export const generateForecast = (currentData, daysAhead) => {
  if (daysAhead === 0) return currentData; 

  return currentData.map(point => {
    let fluctuation = (Math.random() * 30) - 10; 
    if (point.value > 150) fluctuation = -20;

    let predictedAQI = Math.max(10, Math.round(point.value + (fluctuation * daysAhead)));
    
    return {
      ...point,
      value: predictedAQI,
      coordinates: point.coordinates, // <--- FIXED: Use original coordinates
      isPrediction: true,
      dayOffset: daysAhead
    };
  });
};

export const getWindDirection = (daysAhead) => {
  const baseWind = 45; // NE Wind
  return (baseWind + (daysAhead * 10)) % 360; 
};