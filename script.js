let watchId;
let totalDistance = 0;
let prevPosition = null;
let nextMilestone = 1000; // 1 km
let startTime;
let lastMilestoneTime;

document.getElementById("start").addEventListener("click", () => {
    totalDistance = 0;
    prevPosition = null;
    nextMilestone = 1000; // Reset milestone tracking
    startTime = Date.now();
    lastMilestoneTime = startTime;
    document.getElementById("distance").textContent = totalDistance;
    document.getElementById("time").textContent = "0:00";

    // Start timer
    updateTimer();
    
    watchId = navigator.geolocation.watchPosition(position => {
        const { latitude, longitude } = position.coords;

        if (prevPosition) {
            const dist = getDistanceFromLatLon(prevPosition.lat, prevPosition.lon, latitude, longitude);
            totalDistance += dist;
            document.getElementById("distance").textContent = totalDistance.toFixed(2);

            // Check if we hit the next milestone
            if (totalDistance >= nextMilestone) {
                let now = Date.now();
                let timeTaken = ((now - lastMilestoneTime) / 1000).toFixed(0); // Seconds
                let timeFormatted = formatTime(timeTaken);
                speakText(`You've completed ${nextMilestone / 1000} kilometer in ${timeFormatted}.`);
                
                nextMilestone += 1000; // Set next milestone
                lastMilestoneTime = now; // Update milestone time
            }
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

// ⏳ Update Timer
function updateTimer() {
    if (!startTime) return;
    let now = Date.now();
    let elapsed = ((now - startTime) / 1000).toFixed(0); // Seconds
    document.getElementById("time").textContent = formatTime(elapsed);

    // Keep updating every second
    setTimeout(updateTimer, 1000);
}

// 🔊 Speak Function
function speakText(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    speechSynthesis.speak(utterance);
}

// ⏱️ Format Time (MM:SS)
function formatTime(seconds) {
    let mins = Math.floor(seconds / 60);
    let secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 📏 Distance Calculation (Haversine formula)
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
