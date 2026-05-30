#!/bin/bash
# Post-install script to patch react-native-record-screen for Android compatibility
# Fixes: Unresolved reference 'currentActivity' and broken AppCompatActivity inheritance

RECORD_SCREEN_DIR="node_modules/react-native-record-screen/android/src/main/java/com/recordscreen"

# Fix RecordScreenModule.kt - use reactApplicationContext.currentActivity
MODULE_FILE="$RECORD_SCREEN_DIR/RecordScreenModule.kt"
if [ -f "$MODULE_FILE" ]; then
  sed -i '' 's/currentActivity!!\.startActivityForResult/reactApplicationContext.currentActivity!!.startActivityForResult/g' "$MODULE_FILE" 2>/dev/null || \
  sed -i 's/currentActivity!!\.startActivityForResult/reactApplicationContext.currentActivity!!.startActivityForResult/g' "$MODULE_FILE"
  echo "✅ Patched RecordScreenModule.kt"
fi

# Fix RecordScreenPackage.kt - remove AppCompatActivity inheritance
PACKAGE_FILE="$RECORD_SCREEN_DIR/RecordScreenPackage.kt"
if [ -f "$PACKAGE_FILE" ]; then
  cat > "$PACKAGE_FILE" << 'EOF'
package com.recordscreen

import java.util.Arrays

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class RecordScreenPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return Arrays.asList<NativeModule>(RecordScreenModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList<ViewManager<*, *>>()
  }
}
EOF
  echo "✅ Patched RecordScreenPackage.kt"
fi
