const fs = require('fs');
const path = require('path');

const recordScreenDir = path.join(__dirname, '../node_modules/react-native-record-screen/android/src/main/java/com/recordscreen');

// 1. Patch RecordScreenModule.kt
const moduleFile = path.join(recordScreenDir, 'RecordScreenModule.kt');
if (fs.existsSync(moduleFile)) {
  let content = fs.readFileSync(moduleFile, 'utf8');
  
  // Make reactContext a private val so we can reference it
  if (!content.includes('private val reactContext')) {
    content = content.replace(
      'class RecordScreenModule(reactContext: ReactApplicationContext)',
      'class RecordScreenModule(private val reactContext: ReactApplicationContext)'
    );
  }
  
  // Replace the entire startRecordingScreen function to be completely idempotent
  const startRecordingScreenRegex = /private fun startRecordingScreen\(\) \{[\s\S]*?\}/;
  const newStartRecordingScreen = `private fun startRecordingScreen() {
    val mediaProjectionManager = reactApplicationContext.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager;
    val permissionIntent = mediaProjectionManager.createScreenCaptureIntent();
    reactContext.currentActivity!!.startActivityForResult(permissionIntent, SCREEN_RECORD_REQUEST_CODE);
  }`;
  
  content = content.replace(startRecordingScreenRegex, newStartRecordingScreen);

  fs.writeFileSync(moduleFile, content, 'utf8');
  console.log('✅ Patched RecordScreenModule.kt');
}

// 2. Patch RecordScreenPackage.kt
const packageFile = path.join(recordScreenDir, 'RecordScreenPackage.kt');
if (fs.existsSync(packageFile)) {
  const packageContent = `package com.recordscreen

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
`;
  fs.writeFileSync(packageFile, packageContent, 'utf8');
  console.log('✅ Patched RecordScreenPackage.kt');
}
