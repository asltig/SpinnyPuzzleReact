#!/bin/bash
# Run once after unzipping: fixes two things that couldn't be created in the
# build sandbox — the xcassets Contents.json and the gradle-wrapper.jar.
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "── 1/3  Fix Images.xcassets/Contents.json (was created as directory)"
XCASSETS="ios/SpinnyPuzzle/Images.xcassets"
if [ -d "$XCASSETS/Contents.json" ]; then
  rm -rf "$XCASSETS/Contents.json"
fi
cat > "$XCASSETS/Contents.json" << 'JSON'
{
  "info" : {
    "version" : 1,
    "author" : "xcode"
  }
}
JSON
rm -f "$XCASSETS/root_contents.json"
echo "   ✓ Contents.json fixed"

echo "── 2/3  Download gradle-wrapper.jar"
JAR="android/gradle/wrapper/gradle-wrapper.jar"
curl -fsSL \
  "https://raw.githubusercontent.com/nicoulaj/gradle-wrapper-jar/main/gradle-wrapper.jar" \
  -o "$JAR" 2>/dev/null || \
curl -fsSL \
  "https://github.com/gradle/gradle/raw/v8.6.0/gradle/wrapper/gradle-wrapper.jar" \
  -o "$JAR" 2>/dev/null || \
  echo "   ⚠ Could not download gradle-wrapper.jar automatically."
[ -f "$JAR" ] && echo "   ✓ gradle-wrapper.jar downloaded ($(du -sh $JAR | cut -f1))" || \
  echo "   → Run: cd android && gradle wrapper --gradle-version 8.6 (needs Gradle installed)"

echo "── 3/3  Generate Android debug keystore (if absent)"
KS="android/app/debug.keystore"
if [ ! -f "$KS" ]; then
  keytool -genkey -v -keystore "$KS" \
    -storepass android -alias androiddebugkey -keypass android \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Android Debug,O=Android,C=US" 2>/dev/null && \
    echo "   ✓ debug.keystore generated" || \
    echo "   ⚠ keytool not found — Android Studio will generate this on first build"
else
  echo "   ✓ debug.keystore already exists"
fi

echo ""
echo "Done. Next steps:"
echo "  npm install"
echo "  cd ios && pod install && cd .."
echo "  npx react-native run-ios"
