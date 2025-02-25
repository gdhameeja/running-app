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
let isPaused = false;
let pausedTime = 0;

// Kalman filters for latitude and longitude
const kalmanLat = new KalmanFilter(0.0001, 0.0005, 1, 25.276987);
const kalmanLon = new KalmanFilter(0.0001, 0.0005, 1, 55.296249);

// Add new global variables for run tracking and IndexedDB
let db;
let currentRunId = null;
let timeSeriesData = [];
let lastTimeSeriesDistance = 0;
let timeSeriesInterval = 400; // Capture data every 400 meters

// Initialize IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("RunDB", 1);
        
        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.error);
            reject("Error opening database");
        };
        
        request.onsuccess = (event) => {
            db = event.target.result;
            console.log("Database opened successfully");
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create object store for runs if it doesn't exist
            if (!db.objectStoreNames.contains("runs")) {
                const runsStore = db.createObjectStore("runs", { keyPath: "runId" });
                runsStore.createIndex("startTime", "startTime", { unique: false });
                console.log("Object store 'runs' created");
            }
        };
    });
}

// Save new run to IndexedDB
function saveRun(runData) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["runs"], "readwrite");
        const runsStore = transaction.objectStore("runs");
        const request = runsStore.add(runData);
        
        request.onsuccess = () => {
            console.log("Run saved successfully");
            resolve(request.result);
        };
        
        request.onerror = (event) => {
            console.error("Error saving run:", event.target.error);
            reject("Error saving run");
        };
    });
}

// Update existing run in IndexedDB
function updateRun(runData) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["runs"], "readwrite");
        const runsStore = transaction.objectStore("runs");
        const request = runsStore.put(runData);
        
        request.onsuccess = () => {
            console.log("Run updated successfully");
            resolve(request.result);
        };
        
        request.onerror = (event) => {
            console.error("Error updating run:", event.target.error);
            reject("Error updating run");
        };
    });
}

// Get all runs from IndexedDB
function getAllRuns() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["runs"], "readonly");
        const runsStore = transaction.objectStore("runs");
        const request = runsStore.getAll();
        
        request.onsuccess = () => {
            resolve(request.result);
        };
        
        request.onerror = (event) => {
            console.error("Error retrieving runs:", event.target.error);
            reject("Error retrieving runs");
        };
    });
}

// Get latest run from IndexedDB
function getLatestRun() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["runs"], "readonly");
        const runsStore = transaction.objectStore("runs");
        const index = runsStore.index("startTime");
        const request = index.openCursor(null, "prev");
        
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                resolve(cursor.value);
            } else {
                resolve(null); // No previous run found
            }
        };
        
        request.onerror = (event) => {
            console.error("Error retrieving latest run:", event.target.error);
            reject("Error retrieving latest run");
        };
    });
}

// Get yearly runs for analysis
function getYearlyRuns(year = new Date().getFullYear()) {
    return new Promise((resolve, reject) => {
        getAllRuns()
            .then(runs => {
                const yearlyRuns = runs.filter(run => {
                    const runDate = new Date(run.startTime);
                    return runDate.getFullYear() === year;
                });
                resolve(yearlyRuns);
            })
            .catch(error => reject(error));
    });
}

// Find previous time from the time series at a specific distance
function findPreviousTime(timeSeries, currentDistance) {
    if (!timeSeries || timeSeries.length === 0) return null;
    
    // Find the closest distance entry
    for (let i = 0; i < timeSeries.length; i++) {
        if (timeSeries[i].distance >= currentDistance) {
            return timeSeries[i].time;
        }
    }
    return null;
}

// Compare current run with previous run at same distance
function compareWithPreviousRun(previousRunTimeSeries, currentDistance, currentTime) {
    if (!previousRunTimeSeries) return;
    
    const previousTime = findPreviousTime(previousRunTimeSeries, currentDistance);
    if (previousTime === null) return;
    
    const difference = previousTime - currentTime;
    const formattedDifference = formatTime(Math.abs(difference));
    
    if (difference > 0) {
        speakText(`You are ${formattedDifference} faster than your last run at this distance.`);
    } else if (difference < 0) {
        speakText(`You are ${formattedDifference} slower than your last run at this distance.`);
    } else {
        speakText(`You are at the same pace as your last run.`);
    }
}

// Display run summary after stopping
function displayRunSummary(run) {
    const summaryElement = document.createElement("div");
    summaryElement.className = "run-summary";
    summaryElement.innerHTML = `
        <h3>Run Summary</h3>
        <p>Date: ${new Date(run.startTime).toLocaleString()}</p>
        <p>Distance: ${(run.distance / 1000).toFixed(2)} km</p>
        <p>Time: ${formatTime(Math.floor(run.time / 1000))}</p>
        <p>Average Pace: ${formatTime(Math.floor(run.pace))} /km</p>
    `;
    
    const container = document.querySelector(".container");
    
    // Remove previous summary if exists
    const existingSummary = document.querySelector(".run-summary");
    if (existingSummary) {
        existingSummary.remove();
    }
    
    container.appendChild(summaryElement);
}

// Initialize DB when the page loads
document.addEventListener("DOMContentLoaded", () => {
    initDB()
        .then(() => {
            console.log("Database initialized");
            initMap();
        })
        .catch(error => console.error("Failed to initialize database:", error));
});

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

// Modify start button event listener
document.getElementById("start").addEventListener("click", () => {
    totalDistance = 0;
    prevPosition = null;
    nextMilestone = 1000;
    startTime = Date.now();
    lastMilestoneTime = startTime;
    pathCoordinates = [];
    elapsedTime = 0;
    timeSeriesData = [];
    lastTimeSeriesDistance = 0;
    
    document.getElementById("distance").textContent = "0.00 kms";
    document.getElementById("time").textContent = "0:00";
    document.getElementById("pace").textContent = "0:00 /km";
    
    // Remove previous summary if exists
    const existingSummary = document.querySelector(".run-summary");
    if (existingSummary) {
        existingSummary.remove();
    }

    // Create new run object
    currentRunId = Date.now();
    const newRun = {
        runId: currentRunId,
        startTime: startTime,
        endTime: null,
        distance: 0,
        time: 0,
        pace: 0,
        timeSeries: []
    };
    
    // Save initial run data
    saveRun(newRun)
        .then(() => {
            // Get previous run for comparison
            return getLatestRun();
        })
        .then(previousRun => {
            // Store previous run time series for comparison
            if (previousRun && previousRun.runId !== currentRunId) {
                window.previousRunTimeSeries = previousRun.timeSeries;
            } else {
                window.previousRunTimeSeries = null;
            }
            
            clearInterval(timerInterval);
            updateTimer();

            // Start tracking
            isPaused = false;
            pausedTime = 0;
            document.getElementById("pause").disabled = false;
            document.getElementById("start").disabled = true;
            document.getElementById("stop").disabled = false;
            
            watchId = startTracking();
        })
        .catch(error => console.error("Error starting run:", error));
});

document.getElementById("pause").addEventListener("click", () => {
    const pauseButton = document.getElementById("pause");
    if (!isPaused) {
        // Pause functionality
        navigator.geolocation.clearWatch(watchId);
        clearInterval(timerInterval);
        pausedTime = Date.now();
        isPaused = true;
        pauseButton.textContent = "Resume";
    } else {
        // Resume functionality
        startTime += (Date.now() - pausedTime);
        lastMilestoneTime += (Date.now() - pausedTime);
        updateTimer();
        watchId = startTracking();
        isPaused = false;
        pauseButton.textContent = "Pause";
    }
});

// Modify stop button event listener
document.getElementById("stop").addEventListener("click", () => {
    navigator.geolocation.clearWatch(watchId);
    clearInterval(timerInterval);
    document.getElementById("start").disabled = false;
    document.getElementById("stop").disabled = true;
    document.getElementById("pause").disabled = true;
    document.getElementById("pause").textContent = "Pause";
    isPaused = false;
    
    // Update the run object with final data
    const endTime = Date.now();
    const runTime = (endTime - startTime) / 1000; // convert to seconds
    const pace = totalDistance > 0 ? (runTime / (totalDistance / 1000)) : 0;
    
    // Get the run from DB and update it
    if (currentRunId) {
        const transaction = db.transaction(["runs"], "readwrite");
        const runsStore = transaction.objectStore("runs");
        const request = runsStore.get(currentRunId);
        
        request.onsuccess = () => {
            const runData = request.result;
            if (runData) {
                runData.endTime = endTime;
                runData.distance = totalDistance;
                runData.time = runTime;
                runData.pace = pace; // pace in sec/km
                runData.timeSeries = timeSeriesData;
                
                updateRun(runData)
                    .then(() => {
                        console.log("Run updated successfully");
                        displayRunSummary(runData);
                    })
                    .catch(error => console.error("Error updating run:", error));
            }
        };
        
        request.onerror = (event) => {
            console.error("Error retrieving run:", event.target.error);
        };
    }
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

// Enhance tracking function to store time-series data
function startTracking() {
    return navigator.geolocation.watchPosition(position => {
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

            // Check for time-series data capture (every 400 meters)
            if (totalDistance - lastTimeSeriesDistance >= timeSeriesInterval) {
                const currentTime = Date.now() - startTime;
                
                // Save time-series data point
                const dataPoint = { 
                    distance: Math.floor(totalDistance / timeSeriesInterval) * timeSeriesInterval, 
                    time: currentTime 
                };
                timeSeriesData.push(dataPoint);
                
                // Compare with previous run if available
                if (window.previousRunTimeSeries) {
                    compareWithPreviousRun(window.previousRunTimeSeries, dataPoint.distance, currentTime);
                }
                
                lastTimeSeriesDistance = Math.floor(totalDistance / timeSeriesInterval) * timeSeriesInterval;
            }

            // Original milestone announcement
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
    }, (error) => {
        console.error("Geolocation error:", error);
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
}

// Add new functions and UI for previous runs
let currentPage = 0;
let currentPageSize = 5;
let sortedRuns = [];

// Load all runs sorted by startTime descending
function loadAllRuns() {
    return getAllRuns().then(runs => {
        return runs.sort((a, b) => b.startTime - a.startTime);
    });
}

function renderPreviousRunsTable() {
    const container = document.getElementById("previous-runs-container");
    container.innerHTML = "";
    
    const startIdx = currentPage * currentPageSize;
    const pageRuns = sortedRuns.slice(startIdx, startIdx + currentPageSize);
    
    if (pageRuns.length === 0) {
        container.innerHTML = "<p>No runs found.</p>";
        return;
    }
    
    let table = `<table border="1" cellpadding="5" cellspacing="0">
        <tr>
            <th>Date</th>
            <th>Distance (km)</th>
            <th>Time (s)</th>
            <th>Pace (s/km)</th>
        </tr>`;
    pageRuns.forEach(run => {
        table += `<tr>
            <td>${new Date(run.startTime).toLocaleString()}</td>
            <td>${(run.distance/1000).toFixed(2)}</td>
            <td>${Math.floor(run.time)}</td>
            <td>${Math.floor(run.pace)}</td>
        </tr>`;
    });
    table += `</table>`;
    container.innerHTML = table;
    
    // Update pagination buttons
    document.getElementById("prevPage").disabled = currentPage === 0;
    document.getElementById("nextPage").disabled = (startIdx + currentPageSize) >= sortedRuns.length;
}

// Event handler for Show Previous Runs button
document.getElementById("showPreviousRuns").addEventListener("click", () => {
    loadAllRuns().then(runs => {
        sortedRuns = runs;
        currentPage = 0;
        renderPreviousRunsTable();
        document.getElementById("previousRunsSection").style.display = "block";
    }).catch(error => console.error("Error loading runs:", error));
});

// Event handler for page size change
document.getElementById("pageSizeSelect").addEventListener("change", (e) => {
    currentPageSize = parseInt(e.target.value);
    currentPage = 0;
    renderPreviousRunsTable();
});

// Next and Previous page buttons
document.getElementById("prevPage").addEventListener("click", () => {
    if (currentPage > 0) {
        currentPage--;
        renderPreviousRunsTable();
    }
});
document.getElementById("nextPage").addEventListener("click", () => {
    if ((currentPage + 1) * currentPageSize < sortedRuns.length) {
        currentPage++;
        renderPreviousRunsTable();
    }
});

initMap();
