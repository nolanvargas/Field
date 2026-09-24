# Android splash (Capacitor default logo)

On Android 12+, `Theme.SplashScreen` shows **`windowSplashScreenAnimatedIcon`** (defaults to the adaptive launcher icon) unless `android/app/src/main/res/values/styles.xml` sets black background + `@drawable/splash_screen_icon` (inset `splash_mark.png`).

Without those drawables and theme items, cold start shows the stock Capacitor red/purple logo.

Regenerate assets: `npm run branding:native-splash`, then **rebuild/reinstall the APK** (`cap:sync` alone is not enough for res-only changes if the installed build is stale).

Full fix lived on `feat/native-splash-safe-area` (commit `aaab326`); keep `main` in sync when merging splash work.
