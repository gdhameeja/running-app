let map, userMarker, pathLine;
let watchId;
let totalDistance = 0;
let prevPosition = null;
let nextMilestone = 1000;
let startTime, lastMilestoneTime;
let pathCoordinates = [];
let timerInterval;
let elapsedTime = 0; // Add elapsed time variable

function initMap() {
    map = L.map("map").setView([25.276987, 55.296249], 15); // Default: Dubai

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    userMarker = L.marker([25.276987, 55.296249]).addTo(map).bindPopup("You").openPopup();
    pathLine = L.polyline([], { color: "red", weight: 4 }).addTo(map);

    // 📌 Fix: Ensure map resizes properly on mobile
    setTimeout(() => {
        map.invalidateSize();
    }, 500);
}

document.getElementById("start").addEventListener("click", () => {
    totalDistance = 0;
    prevPosition = null;
    nextMilestone = 1000;
    startTime = Date.now();
    lastMilestoneTime = startTime;
    pathCoordinates = [];
    elapsedTime = 0; // Reset elapsed time to 0

    document.getElementById("distance").textContent = "0.00 kms";
    document.getElementById("time").textContent = "0:00";

    clearInterval(timerInterval); // Clear any existing timer
    updateTimer(); // Start timer

    watchId = navigator.geolocation.watchPosition(position => {
        const { latitude, longitude } = position.coords;

        if (prevPosition) {
            const dist = getDistance(prevPosition.lat, prevPosition.lon, latitude, longitude);
            totalDistance += dist;
            const distanceInKilometers = (totalDistance / 1000).toFixed(2);
            document.getElementById("distance").textContent = `${distanceInKilometers} kms`;

            // Update path
            pathCoordinates.push([latitude, longitude]);
            pathLine.setLatLngs(pathCoordinates);

            // Update marker
            userMarker.setLatLng([latitude, longitude]);
            map.setView([latitude, longitude]);

            // Announce milestones
            if (totalDistance >= nextMilestone) {
                let now = Date.now();
                let timeTaken = ((now - lastMilestoneTime) / 1000).toFixed(0);
                let timeFormatted = formatTime(timeTaken);
                speakText(`You've completed ${nextMilestone / 1000} kilometer in ${timeFormatted}.`);
                
                nextMilestone += 1000;
                lastMilestoneTime = now;
            }
        }

        prevPosition = { lat: latitude, lon: longitude };
    });

    document.getElementById("start").disabled = true;
    document.getElementById("stop").disabled = false;
});

document.getElementById("stop").addEventListener("click", () => {
    navigator.geolocation.clearWatch(watchId);

    clearInterval(timerInterval); // Clear the timer interval

    document.getElementById("start").disabled = false;
    document.getElementById("stop").disabled = true;
});

// 🔊 Speak Function
function speakText(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    speechSynthesis.speak(utterance);
}

// ⏱️ Timer Function
function updateTimer() {
    clearInterval(timerInterval); // Clear existing interval to prevent duplicates
    timerInterval = setInterval(() => {
        let now = Date.now();
        let currentElapsed = ((now - startTime) / 1000);
        elapsedTime = currentElapsed; // Update elapsed time
        document.getElementById("time").textContent = formatTime(Math.floor(elapsedTime));
    }, 1000);
}

// ⏱️ Format Time (MM:SS)
function formatTime(seconds) {
    let mins = Math.floor(seconds / 60);
    let secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 📏 Distance Calculation (Haversine formula)
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// 🔥 Initialize map on load
initMap();

