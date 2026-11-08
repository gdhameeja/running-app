#!/usr/bin/env bash
# Builds a debug APK inside Docker. Output: android/app/build/outputs/apk/debug/app-debug.apk
# Usage: docker/build-apk.sh [extra gradle tasks...]
set -euo pipefail
cd "$(dirname "$0")/.."

docker build -q -t runtracker-android-build -f docker/android-build.Dockerfile docker > /dev/null
# Gradle's downloads persist between builds: a Docker volume here, or a folder
# when GRADLE_CACHE is set (GitHub Actions caches that folder between runs)
if [ -n "${GRADLE_CACHE:-}" ]; then
  mkdir -p "$GRADLE_CACHE"
  GRADLE_MOUNT="$GRADLE_CACHE:/gradle"
else
  docker volume create runtracker-gradle-cache > /dev/null
  # New volumes are root-owned; hand the Gradle cache to the calling user
  docker run --rm -v runtracker-gradle-cache:/gradle runtracker-android-build chown "$(id -u):$(id -g)" /gradle
  GRADLE_MOUNT="runtracker-gradle-cache:/gradle"
fi

# Version from the commit count: a later commit is always a higher versionCode,
# and a GitHub release and a local build of the same commit agree.
VERSION_CODE=$(git rev-list --count HEAD)
VERSION_NAME="1.$VERSION_CODE"

# Keep the debug signing key in the project (.android-user/, git-ignored). Without
# it every build signs with a fresh key and Android refuses to install the update
# over the previous one, forcing an uninstall that wipes your runs.
mkdir -p .android-user

# The container runs as you, but its /etc/passwd only knows uid 1000; the
# Capacitor CLI looks up the current user and crashes on any other uid
# (GitHub's runner is 1001). Hand it a passwd file that includes you.
docker run --rm runtracker-android-build cat /etc/passwd > .android-user/passwd
grep -q "^[^:]*:[^:]*:$(id -u):" .android-user/passwd ||
  echo "builder:x:$(id -u):$(id -g)::/tmp/home:/bin/bash" >> .android-user/passwd

docker run --rm -u "$(id -u):$(id -g)" \
  -e HOME=/tmp/home -e GRADLE_USER_HOME=/gradle -e ANDROID_USER_HOME=/app/.android-user \
  -v "$PWD/.android-user/passwd":/etc/passwd:ro \
  -v "$PWD":/app -v "$GRADLE_MOUNT" \
  runtracker-android-build docker/inside-build.sh "$VERSION_CODE" "$VERSION_NAME" "$@"
echo "APK: android/app/build/outputs/apk/debug/app-debug.apk (version $VERSION_NAME)"
