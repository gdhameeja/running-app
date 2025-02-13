let watchId;
let totalDistance = 0;
let prevPosition = null;

document.getElementById("start").addEventListener("click", () => {
    totalDistance = 0;
    prevPosition = null;
    document.getElementById("distance").textContent = totalDistance;
    
    watchId = navigator.geolocation.watchPosition(position => {
        const { latitude, longitude } = position.coords;
        
        if (prevPosition) {
            const dist = getDistanceFromLatLon(prevPosition.lat, prevPosition.lon, latitude, longitude);
            totalDistance += dist;
            document.getElementById("distance").textContent = totalDistance.toFixed(2);
        }

        prevPosition = { lat: latitude, lon: longitude };
    });

    document.getElementById("start").disabled = true;
    document.getElementById("stop").disabled = false;
});

document.getElementById("stop").addEventListener("click", () => {
    navigator.geolocation.clearWatch(watchId);
    document.getElementById("start").disabled = false;
    document.getElementById("stop").disabled = true;
});

// Haversine formula to calculate distance between two coordinates
function getDistanceFromLatLon(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Radius of Earth in meters
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
}

