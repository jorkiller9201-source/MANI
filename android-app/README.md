# MANI Android (WebView → Azure)

Shell APK that loads only:

`https://mani-web.ashysky-26ab9584.eastus.azurecontainerapps.io`

## Build

```bat
cd android-app
gradlew.bat assembleDebug
```

Output: `app/build/outputs/apk/debug/app-debug.apk`

Copy to the website:

```bat
copy app\build\outputs\apk\debug\app-debug.apk ..\frontend\public\downloads\mani.apk
```

## Cache

- `android:largeHeap=true`
- WebView DOM storage + HTTP cache enabled
- Online: `LOAD_DEFAULT`; offline: `LOAD_CACHE_ELSE_NETWORK`
- The app never clears WebView / cookie / disk cache folders under `mani_http_cache`, `mani_webview`, `mani_persistent`
