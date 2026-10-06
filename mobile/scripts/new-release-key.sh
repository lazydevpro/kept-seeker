#!/bin/sh
# Creates the release signing key for com.lazydevpro.keptseeker, once.
#
# The key lives outside the repo, in ~/.kept-seeker/android/, with a random password in
# keystore.properties beside it. It is this app's own key — nothing is shared with the
# original KEPT app's key in ~/.kept/android/.
#
# BACK THE FOLDER UP when this finishes. Every update to the app, and the dApp Store listing,
# must be signed with this exact key; lose it and the app can never be updated again.
#
#   npm run release:key
set -eu

# JDK 17 from Homebrew, unless KEPT_JAVA_HOME says otherwise. Not $JAVA_HOME: shells often carry
# one for an Android Studio that is no longer installed, and keytool then never runs.
JAVA_HOME=${KEPT_JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}
[ -x "$JAVA_HOME/bin/keytool" ] || { echo "No keytool at $JAVA_HOME/bin — install JDK 17: brew install openjdk@17" >&2; exit 1; }
KEYS=${KEPT_KEYS:-$HOME/.kept-seeker/android}
JKS="$KEYS/kept-seeker-release.jks"

[ -e "$JKS" ] && { echo "A key already exists at $JKS. Not replacing it." >&2; exit 1; }

mkdir -p "$KEYS"
chmod 700 "$KEYS"
umask 077

KEPT_KS_PASS=$(openssl rand -base64 32 | tr -d '/+=' | cut -c1-32)
export KEPT_KS_PASS

# The password file is written only once the key exists, so a failure leaves nothing behind.
"$JAVA_HOME/bin/keytool" -genkeypair -keystore "$JKS" -alias kept-seeker \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass:env KEPT_KS_PASS -keypass:env KEPT_KS_PASS \
  -dname "CN=KEPT for Seeker, O=lazydevpro" >/dev/null
printf 'storePassword=%s\nkeyAlias=kept-seeker\n' "$KEPT_KS_PASS" > "$KEYS/keystore.properties"

echo "Key created in $KEYS — back this folder up now."
"$JAVA_HOME/bin/keytool" -list -v -keystore "$JKS" -storepass:env KEPT_KS_PASS \
  | grep "SHA256:" | sed 's/^[[:space:]]*/certificate /'
