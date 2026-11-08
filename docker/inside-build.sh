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

# Gradle itself: put it where the wrapper looks before the wrapper tries GitHub
# releases (which time out at times). Gradle's own address first, then two
# well-known mirrors; whichever answers, the file must match Gradle's published
# SHA-256 (also pinned in gradle-wrapper.properties, which the wrapper checks again).
prefetch_gradle() {
  local props=gradle/wrapper/gradle-wrapper.properties
  local url sum file dir
  url=$(sed -n 's/^distributionUrl=//p' "$props" | sed 's/\\:/:/g')
  sum=$(sed -n 's/^distributionSha256Sum=//p' "$props")
  file=$(basename "$url")
  dir="$GRADLE_USER_HOME/wrapper/dists/${file%.zip}/$(node -e 'const h=require("crypto").createHash("md5").update(process.argv[1],"utf8").digest("hex");console.log(BigInt("0x"+h).toString(36))' "$url")"
  [ -n "$sum" ] || return 0
  if ls "$dir"/*.ok > /dev/null 2>&1 || [ -f "$dir/$file" ]; then return 0; fi
  mkdir -p "$dir"
  for from in "$url" "https://mirrors.cloud.tencent.com/gradle/$file" "https://mirrors.huaweicloud.com/gradle/$file"; do
    for try in 1 2; do
      if curl -fsSL --connect-timeout 20 --max-time 600 -o "$dir/$file.part" "$from" &&
         [ "$(sha256sum "$dir/$file.part" | cut -d' ' -f1)" = "$sum" ]; then
        mv "$dir/$file.part" "$dir/$file"
        echo "Gradle from $from (checksum verified)"
        return 0
      fi
      echo "Couldn't get Gradle from $from (try $try)"
      rm -f "$dir/$file.part"
    done
  done
  echo "Couldn't get Gradle anywhere; leaving it to the wrapper"
}
prefetch_gradle

# Gradle itself comes from GitHub releases, which sometimes answer 504 to build
# machines; libraries come through Google's mirror of Maven Central first
# (gradle-init/mirror.gradle). A failed download is retried, waiting longer each
# time (what's already downloaded stays in the cache); a failed test or compile is not.
for attempt in 1 2 3 4; do
  if ./gradlew --no-daemon --init-script ../docker/gradle-init/mirror.gradle -PversionCode="$code" -PversionName="$name" testDebugUnitTest assembleDebug "$@" 2>&1 | tee /tmp/gradle.log; then
    exit 0
  fi
  if ! grep -Eq "status code 50[0-9]|response code: 50[0-9]|Could not GET|Could not download|Read timed out|Connect timed out|Connection reset" /tmp/gradle.log; then
    exit 1
  fi
  if [ "$attempt" = 4 ]; then
    echo "Downloads kept failing; giving up."
    exit 1
  fi
  echo "A download failed (not the code). Trying again in $((attempt * 60)) s, attempt $((attempt + 1)) of 4."
  sleep $((attempt * 60))
done
