# KinShield for Android

A native Android client for KinShield (Kotlin, Jetpack Compose, Material 3). It calls the same public API Gateway
endpoint as the website and holds no AWS or Bedrock keys.

| Area | What it does | Backend |
|---|---|---|
| **KinBot** | Paste or share a message → verdict with risk badge, headline, exact quotes, steps; then "Kip investigated" (links, numbers, advice) | `POST /kinbot` `check`, `investigate` |
| Ask Kip | Follow-up chat with history and the last verdict as context | `POST /kinbot` `ask` |
| Screenshot | Photo Picker (no storage permission) → ≤1600 px JPEG → vision read → check | `POST /kinbot` `screenshot` |
| Voicemail | Record on speaker (mic permission) or pick an audio file → 16 kHz mono WAV ≤110 s → transcript → check | `POST /kinbot` `voicemail` |
| Share to KinBot | Share `text/plain` or `image/*` from any app straight into a check | intent filters on `MainActivity` |
| **KinModel-Lite** | On-device score (Kotlin port of `lambda/evidence-detector/lite.py` + bundled `lite_model.json`), instant and offline | none |
| **KinVoice demo** | Scripted practice calls, scored turn by turn (max 6 detector calls per call), local notification on HIGH | `GET /scenarios`, `GET /scenario`, `POST /detect` |

Honest limits (also on the in-app About screen):
- The app cannot listen to phone calls. Android 10+ blocks third-party call-audio capture, so KinVoice uses scripted calls only.
- No model is fine-tuned. The detector is gpt-oss-20b on Amazon Bedrock with KinShield's prompt. KinShield-Lite is TF-IDF + logistic regression with int8 weights.
- Alerts are local notifications. There is no account, push service or family sharing.

Package `com.kinshield.app` · minSdk 26 · target/compile SDK 36 · AGP 8.13.2 · Kotlin 2.2.21 · Gradle 8.14.3 (wrapper).

## Configuration (once per machine)

`local.properties` is gitignored. Android Studio writes `sdk.dir`; add the API base URL yourself:

```properties
sdk.dir=/Users/<you>/Library/Android/sdk
kinshield.apiBaseUrl=https://<api-id>.execute-api.us-east-1.amazonaws.com
```

You can find the URL in `kinshield/web/src/config.js`, or in the `ApiUrl` output of the `kinshield-backend` CloudFormation stack.
If it's missing, the app still builds, and every online feature shows "The app has no API address…".

Optional release signing (the keystore lives **outside** the repo; never commit it):

```bash
keytool -genkeypair -keystore ~/.android/kinshield-release.jks -alias kinshield \
  -keyalg RSA -keysize 2048 -validity 10000
```
```properties
kinshield.keystore.path=/Users/<you>/.android/kinshield-release.jks
kinshield.keystore.alias=kinshield
kinshield.keystore.password=...
kinshield.keystore.keyPassword=...
```
These keys can also go in `~/.gradle/gradle.properties`. Without them, `assembleRelease` signs with the debug key,
so you still get an installable APK.

## 1. Open in Android Studio

1. File › Open… › select `kinshield/android/` (the folder that contains `settings.gradle.kts`).
2. Trust the project. Let Gradle sync, which downloads the Gradle 8.14.3 wrapper and the dependencies.
3. If Studio asks for a JDK, use its bundled JBR, or any JDK 17+ (Settings › Build Tools › Gradle › Gradle JDK).

## 2. Start the emulator

- In Studio: Device Manager › Create device › Pixel 8 › API 36 "Google APIs" **arm64-v8a** image (on Apple Silicon) › ▶.
- From a terminal (the AVD used for testing is `KinShield_Pixel_8`):
  ```bash
  export ANDROID_HOME=~/Library/Android/sdk
  $ANDROID_HOME/emulator/emulator -avd KinShield_Pixel_8            # with a window
  $ANDROID_HOME/emulator/emulator -avd KinShield_Pixel_8 -no-window -no-audio -no-snapshot &   # headless
  $ANDROID_HOME/platform-tools/adb wait-for-device shell getprop sys.boot_completed   # prints 1 when ready
  ```

## 3. Run the app

- In Studio, pick the `app` run configuration and the emulator (or a USB device with USB debugging on), then press ▶ Run.
- From a terminal: `./gradlew installDebug`, then `adb shell am start -n com.kinshield.app/.MainActivity`.
- To try sharing into the app:
  `adb shell am start -a android.intent.action.SEND -t text/plain --es android.intent.extra.TEXT "\"Grandma it's me, don't tell Mom, buy gift cards\"" -n com.kinshield.app/.MainActivity`
  (The escaped inner quotes keep the spaces. Without them, adb splits the text.)

## 4. Debug

- **Breakpoints:** click the gutter in any `.kt` file, then press 🐞 Debug instead of Run. You can also use Run › Attach Debugger to Android Process. Good places to start are `KinBotViewModel.call()` (every KinBot request goes through it), `KinShieldApi.execute()` (HTTP and error mapping) and `VoicePlayerViewModel.play()`.
- **Logcat:** filter `tag:KinShield` (or `adb logcat -s KinShield`). Debug builds log app events and one line per HTTP request and response (OkHttp `BASIC` level, which never logs bodies, so pasted messages stay out of Logcat). Release builds drop debug/info logs and have no HTTP logging at all.
- **Network Inspector:** View › Tool Windows › App Inspection › Network Inspector, on a running debug build. It shows the `/kinbot`, `/detect` and `/scenarios` calls with timings and payloads.
- **Layout Inspector** (Tools › Layout Inspector) shows Compose trees. Composer, feed, meter and button nodes carry `testTag`s.
- **Tests:** `./gradlew testDebugUnitTest` runs the JVM tests (Lite parity with Python). `./gradlew connectedDebugAndroidTest` runs on-device tests: Lite parity on Android's ICU regex engine, and Compose UI tests. You need an emulator or device running.

## 5. Generate the APK

- **Studio:** Build › Generate App Bundles or APKs › Generate APKs gives a debug APK. Build › Generate Signed App Bundle or APK › APK lets you pick your keystore and the `release` variant.
- **Terminal:**
  ```bash
  ./gradlew assembleDebug                  # debug, not minified
  ./gradlew assembleRelease                # R8-minified + resource-shrunk; signed with your keystore (or the debug key)
  ./gradlew assembleDebug testDebugUnitTest lint assembleRelease   # what CI should run
  ```

## 6. APK output paths

| Variant | Path | Size (this build) |
|---|---|---|
| Debug | `kinshield/android/app/build/outputs/apk/debug/app-debug.apk` | about 20 MB (unminified, includes the full icon set) |
| Release | `kinshield/android/app/build/outputs/apk/release/app-release.apk` | about 2.3 MB (R8 + shrinkResources) |

Check the signature with `$ANDROID_HOME/build-tools/36.0.0/apksigner verify --print-certs app/build/outputs/apk/release/app-release.apk`.

## 7. Share the APK (sideloading)

- **Send the release APK, not the debug one.** It's about 10× smaller, minified, has no debug logging, and it's signed with a key you control. Every later update must be signed with the **same** key, or Android refuses to install it over the old version. Back up the keystore and its passwords; if you lose them, users have to uninstall and reinstall.
- **How to send it:** upload to Google Drive (share a link), attach it to an email (some providers block `.apk`; zip it or use Drive), or copy it over USB (`adb install app-release.apk`, or drop it into the phone's Download folder).
- **On the phone:** open the APK from Files, Drive or Gmail. The first time, Android asks you to allow **Install unknown apps** for that app (Settings › Apps › Special app access › Install unknown apps). Turn it on, go back, and tap Install.
- **Play Protect** may warn "App scanned / unknown developer" or ask to scan the app, because it isn't from Play. Tap *More details › Install anyway* (or *Send for scanning*). That's expected for any sideloaded app. For wide distribution, publish through Play (internal testing track) instead.

## What the emulator can't reliably test

| Area | Why | How to cover it |
|---|---|---|
| Real phone-call audio | **Not possible at all.** Android 10+ blocks third-party apps from capturing call audio. KinVoice uses scripted calls by design. | Nothing to test. Real-call protection needs carrier or OS integration. |
| Real SMS and carrier calls | The emulator has a fake modem. Real carrier SMS formats, RCS and spam labelling differ. | Share real messages from Messages/Gmail on a physical phone. |
| Microphone quality | The emulator mic was silent in headless mode. Speaker-to-mic recording quality, noise and volume vary by device. | Record a voicemail played on speaker on 2–3 real phones and check the transcript. |
| Share flows from real apps | adb can't grant MediaStore read access the way Photos/Messages do (see test results). | Share a screenshot from Google Photos, Samsung Gallery and Messages on a device. |
| OEM battery/background killers | Samsung, Xiaomi and others kill background apps more aggressively than AOSP. | Start a KinVoice call, switch apps, and check the alert still arrives on those devices. |
| Push via FCM | Not used. Alerts are local notifications only. | Not applicable. |
| Performance on low-end devices | The emulator runs on an M3 Pro host. | Profile on a 2–3 GB RAM device (Lite scoring, image downscale, audio decode). |
| Biometrics | Not used by the app. | Not applicable. |
| Doze / long idle | The emulator rarely enters deep Doze on its own. | `adb shell dumpsys deviceidle force-idle` on a device, then check that the app recovers. |

## Test results (2026-10-03, emulator `KinShield_Pixel_8`, API 36 google_apis arm64, live API)

Evidence screenshots were saved outside the repo in the session scratchpad (`scratchpad/android/shots/`). The file names are listed below.

| # | Test | Result | Evidence |
|---|---|---|---|
| 1 | `./gradlew clean assembleDebug testDebugUnitTest lint assembleRelease` | Pass. Lint: "No issues found". 2/2 unit tests pass. | build log |
| 2 | Lite parity, JVM (12 texts vs `lite.py`, tol 1e-9) | Pass | `LiteModelTest` |
| 3 | Lite parity on the device (Android ICU regex) | Pass. The first device run caught a real bug: `UNICODE_CHARACTER_CLASS` is unsupported on Android, so Lite silently failed. Fixed. | `LiteParityDeviceTest` |
| 4 | `connectedDebugAndroidTest` (3 tests) | Pass | Lite UI test, About test |
| 5 | Install + launch, home layout | Pass | `01-home.png` |
| 6 | KinBot scam text check → HIGH, 4 cited quotes, then investigation | Pass | `04`, `05-kinbot-verdict-top.png` |
| 7 | Ask Kip follow-up chip (history and context sent) | Pass | `23-ask-answer.png` |
| 8 | Share `text/plain` via `am start -a SEND` → auto-check → HIGH | Pass | `06`, `07-share-verdict-top.png` |
| 9 | Share `image/*` via adb | Blocked by the harness: the shell can't grant a MediaStore URI. The app now shows a clear error instead of failing silently. | `09-share-image-error.png` |
| 10 | Screenshot via Photo Picker → vision read → check → investigation → **overall take HIGH** | Pass | `10`–`14-overall-take.png` |
| 11 | Mic permission: deny → rationale → deny again → "turned off" dialog → Open Settings | Pass | `15`–`18` |
| 12 | Mic permission grant → record → stop → WAV attachment | Pass (silent audio on the emulator) | `19`, `20-recorded-attachment.png` |
| 13 | Voicemail file (m4a) → 16 kHz WAV → transcript → HIGH | Pass | `21`, `22-voicemail-result.png` |
| 14 | Rotation keeps the feed, the mode and an unsent draft | Pass | `24-rotated-landscape.png` |
| 15 | Process death (`am kill` while backgrounded) → restored screen, feed and draft | Pass | `25-after-process-death.png` |
| 16 | Offline (wifi + data off): banner, instant Lite score, offline error with retry; KinVoice list offline error; retry after reconnecting | Pass | `26`–`29` |
| 17 | Notification permission prompt → Allow → KinVoice HIGH → notification | Pass | `31`, `34`, `35` |
| 18 | Background: start a call, press Home → HIGH notification arrives | Pass after a fix. Android 15+ cut network to the cached process (UnknownHostException); a short foreground service now covers in-flight work. | `36-background-high-notification.png` |
| 19 | Retry after a failed turn re-scores that turn | Pass after a fix (the first retry skipped the failed turn) | `33`, `34` |
| 20 | Screen sizes: 1080×2400 phone, 720×1280 small phone, 2560×1600 tablet | Pass | `37-tablet-home.png`, `38-small-phone-home.png` |
| 21 | Release APK (R8) on the device: share → HIGH, Lite 96%, no crash, no `KinShield` debug logs | Pass | `40-release-verdict.png` |

About 30 live API calls were used in total.
