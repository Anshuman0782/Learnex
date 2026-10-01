# LERNEX — Real phone notifications & calls (development build)

Expo Go can't deliver phone notifications or run voice/video calls (both need
native code). LERNEX switches them on **automatically** in an installed build.
Everything below uses **free** plans — no paid services.

---

## 1. One-time: free accounts & tools

1. Create a free Expo account at <https://expo.dev/signup>.
2. Install the EAS CLI and log in:

   ```bash
   npm install -g eas-cli
   ```

   ```bash
   eas login
   ```

## 2. Firebase (free "Spark" plan) — required for Android notifications

1. Open <https://console.firebase.google.com> → **Add project** (Analytics not needed).
2. **Add app → Android**. Package name: `com.lernex.app`. Register.
3. Download **`google-services.json`** and put it in the project root
   (next to `app.json`). `app.config.js` picks it up automatically.
   This file is client config, not a secret — it's fine to commit.
4. Firebase → ⚙️ **Project settings → Service accounts → Generate new private key**.
   This JSON **is a secret**: don't commit it (it's git-ignored by name pattern) —
   upload it to Expo instead:

   ```bash
   eas credentials
   ```

   Choose **Android → development → Google Service Account →
   "Manage your Google Service Account Key for Push Notifications (FCM V1)" →
   Upload**, and select the downloaded key. Repeat for the `production` profile later.

## 3. Build & install the app (free EAS build)

```bash
eas build --profile development --platform android
```

When it finishes, open the link on your phone and install the APK
(allow "install unknown apps" if asked). Do the same on a second phone to test calls.

## 4. Run it

1. Start the backend as usual (`npm run start:dev` in `backend/`). Phone and
   computer must be on the same Wi-Fi.
2. Start the app server for the dev build:

   ```bash
   npx expo start --dev-client
   ```

3. Open the installed **LERNEX** app (not Expo Go) and connect to the server.
4. Allow **notifications**, **microphone** and **camera** when asked.

## 5. What to test

| Feature | How |
|---|---|
| Activity notifications | Phone A in background → from phone B like / comment / follow / repost A's post → A gets a phone notification; tap opens it |
| Message notifications | A in background → B sends a chat message → notification shows sender + text; tap opens the chat |
| Calls | A and B **follow each other** → call buttons appear in their chat. Call with A's app closed → A's phone rings with **Answer / Decline** |
| Missed calls | Let it ring 40 s (or hang up) → "Missed call" notification |
| Admin broadcasts | Admin Panel → **Notify** → pick audience → see count → Send now / Schedule |

## 6. Optional: TURN relay for calls on strict mobile networks

Calls use free Google STUN servers. Most Wi-Fi/4G connections work, but some
carrier networks (CGNAT) block direct peer-to-peer media. If calls connect but
have no audio/video on mobile data, add a TURN server — free options:

- **Open Relay** by Metered (free tier, sign up for credentials), or
- self-host **coturn** on a free VM (e.g. Oracle Cloud Always Free).

Then set these in `backend/.env` (no app update needed):

```
TURN_URL=turn:your-turn-host:3478
TURN_USERNAME=...
TURN_CREDENTIAL=...
```

## Notes

- In **Expo Go** everything else keeps working; calls and phone notifications
  simply stay off there (in-app notifications still work).
- Notifications are sent only when the app isn't open in front of the user;
  while it's open, they appear live in the bell instead.
- Logging out removes the phone's notification token, so that account stops
  notifying that device.
