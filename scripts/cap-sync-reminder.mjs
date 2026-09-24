console.log(`
Note: cap:sync copied web assets into android/ and ios/.
Bundled APK/IPA installs still use the last native build — run one of:
  npm run apk:serve          (debug APK + LAN sideload)
  cd android && .\\gradlew.bat assembleDebug   (then install app-debug.apk)
Live reload: npm run adb:physical (or adb:virtual) with npm run dev running.
`);
