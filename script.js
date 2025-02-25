class KalmanFilter {
    constructor(processNoise = 1, measurementNoise = 1, estimateError = 1, initialEstimate = 0) {
        this.processNoise = processNoise;
        this.measurementNoise = measurementNoise;
        this.estimateError = estimateError;
        this.estimate = initialEstimate;
        this.kalmanGain = 0;
    }

    update(measurement) {
        // Prediction update
        this.estimateError += this.processNoise;
        
        // Measurement update
        this.kalmanGain = this.estimateError / (this.estimateError + this.measurementNoise);
        this.estimate += this.kalmanGain * (measurement - this.estimate);
        this.estimateError *= (1 - this.kalmanGain);

        return this.estimate;
    }
}

let map, userMarker, pathLine;
let watchId;
let totalDistance = 0;
let prevPosition = null;
let nextMilestone = 1000;
let startTime, lastMilestoneTime;
let pathCoordinates = [];
let timerInterval;
let elapsedTime = 0;

// Kalman filters for latitude and longitude
const kalmanLat = new KalmanFilter(0.0001, 0.0005, 1, 25.276987);
const kalmanLon = new KalmanFilter(0.0001, 0.0005, 1, 55.296249);

function initMap() {
    map = L.map("map").setView([25.276987, 55.296249], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    userMarker = L.marker([25.276987, 55.296249]).addTo(map).bindPopup("You").openPopup();
    pathLine = L.polyline([], { color: "red", weight: 4 }).addTo(map);

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
    elapsedTime = 0;

    document.getElementById("distance").textContent = "0.00 kms";
    document.getElementById("time").textContent = "0:00";
    document.getElementById("pace").textContent = "0:00 /km";

    clearInterval(timerInterval);
    updateTimer();

    watchId = navigator.geolocation.watchPosition(position => {
        let { latitude, longitude } = position.coords;

        // Apply Kalman filter
        latitude = kalmanLat.update(latitude);
        longitude = kalmanLon.update(longitude);

        if (prevPosition) {
            const dist = getDistance(prevPosition.lat, prevPosition.lon, latitude, longitude);
            totalDistance += dist;
            document.getElementById("distance").textContent = `${(totalDistance / 1000).toFixed(2)} kms`;

            pathCoordinates.push([latitude, longitude]);
            pathLine.setLatLngs(pathCoordinates);

            userMarker.setLatLng([latitude, longitude]);
            map.setView([latitude, longitude]);

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
    clearInterval(timerInterval);
    document.getElementById("start").disabled = false;
    document.getElementById("stop").disabled = true;
});

function speakText(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    speechSynthesis.speak(utterance);
}

function updateTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        elapsedTime = ((Date.now() - startTime) / 1000);
        document.getElementById("time").textContent = formatTime(Math.floor(elapsedTime));
        
        // Calculate and update pace
        if (totalDistance > 0) {
            const paceInSeconds = (elapsedTime / (totalDistance / 1000));
            document.getElementById("pace").textContent = `${formatTime(Math.floor(paceInSeconds))} /km`;
        }
    }, 1000);
}

function formatTime(seconds) {
    let mins = Math.floor(seconds / 60);
    let secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

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

initMap();
