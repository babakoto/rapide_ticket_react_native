const fs = require('fs');
const path = require('path');

const recordScreenDir = path.join(__dirname, '../node_modules/react-native-record-screen/android/src/main/java/com/recordscreen');

// 1. Patch RecordScreenModule.kt
const moduleFile = path.join(recordScreenDir, 'RecordScreenModule.kt');
if (fs.existsSync(moduleFile)) {
  let content = fs.readFileSync(moduleFile, 'utf8');
  
  // Make reactContext a private val so we can reference it
  content = content.replace(
    'class RecordScreenModule(reactContext: ReactApplicationContext)',
    'class RecordScreenModule(private val reactContext: ReactApplicationContext)'
  );
  
  // Use reactContext.currentActivity
  content = content.replace(
    /currentActivity!!\.startActivityForResult/g,
    'reactContext.currentActivity!!.startActivityForResult'
  );
  content = content.replace(
    /reactApplicationContext\.currentActivity!!\.startActivityForResult/g,
    'reactContext.currentActivity!!.startActivityForResult'
  );

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
