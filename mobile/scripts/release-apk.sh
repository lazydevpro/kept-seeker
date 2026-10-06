#!/bin/sh
# Builds, signs and verifies a release APK for sideloading and GitHub releases.
#
#   ./scripts/release-apk.sh            → ~/.kept-seeker/releases/kept-<version>.apk
#
# The same production settings as the `production` profile in eas.json. The signing key
# lives OUTSIDE the repo, in ~/.kept-seeker/android/ (kept-seeker-release.jks + keystore.properties; create it with `npm run release:key`);
# every release must be signed with it or phones refuse the update. Back it up. Upload it
# to EAS (`eas credentials -p android`) so cloud builds sign with the same key.
#
# Needs JDK 17 and an Android SDK (build-tools 36, NDK 27.1). Paths below are Homebrew's.
set -eu
cd "$(dirname "$0")/.."

# JDK 17 from Homebrew unless KEPT_JAVA_HOME says otherwise — not $JAVA_HOME, which shells often
# point at an Android Studio that is no longer installed.
JAVA_HOME=${KEPT_JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}
[ -x "$JAVA_HOME/bin/java" ] || { echo "No JDK at $JAVA_HOME — install JDK 17: brew install openjdk@17" >&2; exit 1; }
# The Homebrew SDK unless KEPT_ANDROID_HOME says otherwise, for the same reason as JAVA_HOME.
ANDROID_HOME=${KEPT_ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}
[ -d "$ANDROID_HOME/build-tools/36.0.0" ] || { echo "No Android build-tools 36.0.0 under $ANDROID_HOME" >&2; exit 1; }
KEYS=${KEPT_KEYS:-$HOME/.kept-seeker/android}
BT="$ANDROID_HOME/build-tools/36.0.0"
VERSION=$(node -p "require('./app.json').expo.version")
OUT="$HOME/.kept-seeker/releases/kept-$VERSION.apk"
export JAVA_HOME ANDROID_HOME PATH="$JAVA_HOME/bin:$PATH"

[ -f "$KEYS/kept-seeker-release.jks" ] || { echo "No release key at $KEYS/kept-seeker-release.jks — run: npm run release:key" >&2; exit 1; }

# EXPO_PUBLIC_* are inlined into the bundle at build time — must match eas.json.
export NODE_ENV=production
export EXPO_PUBLIC_API_URL=https://kept-seeker-api.keptseeker.workers.dev
export EXPO_PUBLIC_SOLANA_CLUSTER=mainnet-beta
export EXPO_PUBLIC_SITE_URL=https://kept-seeker.pages.dev

# A stale Metro cache has shipped a bundle without the variables above before.
rm -rf node_modules/.cache "${TMPDIR:-/tmp}"/metro-* 2>/dev/null || true

CI=1 npx expo prebuild -p android --no-install
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
# Real phones only: the Seeker is arm64; armv7 covers older Androids. x86 is emulators.
(cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a --no-daemon)

# Gradle signs with the debug key; re-sign with the release key. The password travels in
# an environment variable so it never lands in a log or a process listing.
mkdir -p "$(dirname "$OUT")"
KEPT_KS_PASS=$(sed -n 's/^storePassword=//p' "$KEYS/keystore.properties") \
  "$BT/apksigner" sign --ks "$KEYS/kept-seeker-release.jks" --ks-key-alias kept-seeker \
  --ks-pass env:KEPT_KS_PASS --key-pass env:KEPT_KS_PASS \
  --out "$OUT" android/app/build/outputs/apk/release/app-release.apk

"$BT/apksigner" verify --print-certs "$OUT" | grep "certificate SHA-256"
unzip -p "$OUT" assets/index.android.bundle | LC_ALL=C grep -a -q "$EXPO_PUBLIC_API_URL" \
  || { echo "Bundle does not point at $EXPO_PUBLIC_API_URL" >&2; exit 1; }
echo "sha256: $(shasum -a 256 "$OUT" | cut -d' ' -f1)"
echo "→ $OUT"
