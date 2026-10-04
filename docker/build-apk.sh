#!/usr/bin/env bash
# Builds a debug APK inside Docker. Output: android/app/build/outputs/apk/debug/app-debug.apk
# Usage: docker/build-apk.sh [extra gradle tasks...]
set -euo pipefail
cd "$(dirname "$0")/.."

docker build -q -t runtracker-android-build -f docker/android-build.Dockerfile docker > /dev/null
docker volume create runtracker-gradle-cache > /dev/null
# New volumes are root-owned; hand the Gradle cache to the calling user
docker run --rm -v runtracker-gradle-cache:/gradle runtracker-android-build chown "$(id -u):$(id -g)" /gradle

# Keep the debug signing key in the project (.android-user/, git-ignored). Without
# it every build signs with a fresh key and Android refuses to install the update
# over the previous one, forcing an uninstall that wipes your runs.
mkdir -p .android-user
docker run --rm -u "$(id -u):$(id -g)" \
  -e HOME=/tmp/home -e GRADLE_USER_HOME=/gradle -e ANDROID_USER_HOME=/app/.android-user \
  -v "$PWD":/app -v runtracker-gradle-cache:/gradle \
  runtracker-android-build bash -c "
    set -e
    npm ci --no-audit --no-fund
    npm test
    npm run sync
    cd android && ./gradlew --no-daemon testDebugUnitTest assembleDebug $*
  "
echo "APK: android/app/build/outputs/apk/debug/app-debug.apk"
