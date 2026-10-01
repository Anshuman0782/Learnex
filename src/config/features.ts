import Constants from 'expo-constants';

/**
 * True inside the Expo Go sandbox app. Expo Go can't do remote push (SDK 53+)
 * or native WebRTC, so those features switch off there automatically and switch
 * ON in a development / production build — no code change needed.
 */
export const IS_EXPO_GO =
  Constants.appOwnership === 'expo' || (Constants.executionEnvironment as string) === 'storeClient';

/** App feature switches (derived from where the app is running). */
export const FEATURES = {
  /** Voice & video calling (WebRTC). */
  calls: !IS_EXPO_GO,
  /** Phone (push) notifications. In-app notifications always work. */
  pushNotifications: !IS_EXPO_GO,
} as const;
