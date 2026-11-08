#!/usr/bin/env bash
# Runs inside the build container (docker/build-apk.sh): web tests, web build,
# then the Kotlin tests and the APK.
# Usage: docker/inside-build.sh VERSION_CODE VERSION_NAME [extra gradle tasks...]
set -euo pipefail
code="$1"; name="$2"; shift 2

npm ci --no-audit --no-fund
npm test
npm run sync
cd android

# Gradle and the Kotlin compiler are downloaded from GitHub releases, which
# sometimes answer 504 to build machines. A failed download is retried (what's
# already downloaded stays in the cache); a failed test or compile is not.
for attempt in 1 2 3; do
  if ./gradlew --no-daemon -PversionCode="$code" -PversionName="$name" testDebugUnitTest assembleDebug "$@" 2>&1 | tee /tmp/gradle.log; then
    exit 0
  fi
  if ! grep -Eq "status code 50[0-9]|response code: 50[0-9]|Could not GET|Could not download|Read timed out|Connect timed out|Connection reset" /tmp/gradle.log; then
    exit 1
  fi
  if [ "$attempt" = 3 ]; then
    echo "Downloads kept failing; giving up."
    exit 1
  fi
  echo "A download failed (not the code). Trying again in 60 s, attempt $((attempt + 1)) of 3."
  sleep 60
done
