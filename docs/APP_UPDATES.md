# App updates without a new APK (EAS Update)

LERNEX uses **over-the-air (OTA) updates** through Expo's EAS Update. It's on Expo's free plan, with no card needed; check expo.dev/pricing for the current free limits.

Most changes (screens, logic, text, fixes) are JavaScript. They can be sent to every installed app. On next launch the app shows **"Update available → Update now"** and restarts in a few seconds.

## One-time setup (already done in the code)

- `expo-updates` is installed. `app.json` has `runtimeVersion` (policy `appVersion`) and the update URL.
- Each build profile in `eas.json` listens to its own channel: `preview`, `production` or `development`.
- `src/components/common/UpdatePrompt.tsx` shows the popup.

**You still need ONE new APK** that contains this update system:

```bash
eas build --profile preview --platform android
```

Install it on the phones. From then on, use the command below for normal changes.

## Publishing an update (most changes)

From the project folder:

```bash
eas update --channel preview --message "Short description of the change"
```

Every installed **preview** APK sees the popup the next time it's opened (or brought back from the background).

## When a NEW APK is still needed

OTA can only change JavaScript. Build a new APK when you:

- add or upgrade a package that has native code (anything installed with `npx expo install` that touches the camera, audio, notifications, etc.)
- change `app.json` native settings: permissions, icon, splash, package name, plugins
- upgrade the Expo SDK

**Then bump `"version"` in `app.json`** (e.g. 1.0.0 → 1.1.0) before building. Updates are matched to the app version, so an update made for 1.1.0 never reaches an old 1.0.0 APK it could crash.

Backend changes (anything in `backend/`) never need either: `git push` and Render redeploys.
