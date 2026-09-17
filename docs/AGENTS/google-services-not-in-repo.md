# google-services.json not in git

`google-services.json` and `android/app/google-services.json` must stay local (see `.gitignore`). Copy from Firebase Console for package `app.field.mobile`. If either was ever pushed, rotate/restrict the Firebase Android app key in Google Cloud Console and scrub history with `git filter-repo --invert-paths --path google-services.json --path android/app/google-services.json --force` (re-add `origin` afterward; filter-repo removes it).
