import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { registerPushTokenRequest, unregisterPushTokenRequest } from '../api/calls.api';
import { IS_EXPO_GO } from '../config/features';
import { handleReplyAction } from './backgroundNotifications';

/** LERNEX logo orange — tints the notification icon and LED. */
const BRAND = '#F2542D';
/** Bundled 28s ringtone (see app.json → expo-notifications → sounds). */
const RINGTONE = 'lernex_ringtone.wav';

/** Kept for existing callers. */
export function isExpoGo(): boolean {
  return IS_EXPO_GO;
}

/** What the server puts in a push's `data` so a tap can open the right screen. */
export interface PushData {
  kind?: 'call' | 'call_cancel' | 'chat' | 'post' | 'profile' | 'missed_call' | 'event' | 'circle' | 'announcement' | 'mentor-test';
  callId?: string;
  callType?: 'voice' | 'video';
  fromUserId?: string;
  fromName?: string;
  conversationId?: string;
  userId?: string;
  postId?: string;
  openComments?: boolean;
  eventId?: string;
  communityId?: string;
  notificationId?: string;
  [k: string]: unknown;
}

export interface PushTap {
  data: PushData;
  /** 'answer' | 'decline' for call buttons; otherwise the default tap. */
  action: string;
}

type NotificationsModule = typeof import('expo-notifications');
let mod: NotificationsModule | null = null;
/**
 * `expo-notifications` is imported lazily and ONLY outside Expo Go — importing
 * it inside Expo Go (SDK 53+) throws. In Expo Go every function here is a no-op.
 */
async function N(): Promise<NotificationsModule | null> {
  if (IS_EXPO_GO) return null;
  if (!mod) mod = await import('expo-notifications');
  return mod;
}

let configured = false;
async function configure(Notifications: NotificationsModule) {
  if (configured) return;
  configured = true;

  // While the app is open we already show things in-app (and the call screen),
  // so only show a banner for pushes that still arrive in the foreground.
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const kind = (n.request.content.data as PushData | undefined)?.kind;
      const show = kind !== 'call';
      return {
        shouldShowBanner: show,
        shouldShowList: show,
        shouldPlaySound: show,
        shouldSetBadge: true,
        shouldShowAlert: show,
      } as any;
    },
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Activity',
      description: 'Likes, comments, followers, events and announcements',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 200, 120, 200],
      lightColor: BRAND,
    });
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      description: 'New chat messages',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 150, 250],
      lightColor: BRAND,
    });
    // Calls RING: a 28-second ringtone + long vibration, shown on the lock
    // screen. (Android channel sounds can't change after creation, hence a new
    // channel id instead of the old 'calls'.)
    await Notifications.setNotificationChannelAsync('incoming_calls', {
      name: 'Incoming calls',
      description: 'Rings when someone calls you',
      importance: Notifications.AndroidImportance.MAX,
      sound: RINGTONE,
      vibrationPattern: [0, 1000, 800, 1000, 800, 1000, 800, 1000, 800, 1000, 800, 1000],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      lightColor: BRAND,
      enableVibrate: true,
    });
    await Notifications.deleteNotificationChannelAsync('calls').catch(() => undefined);
  }

  // WhatsApp-style inline reply on message notifications (works while closed).
  await Notifications.setNotificationCategoryAsync('chat_message', [
    {
      identifier: 'reply',
      buttonTitle: 'Reply',
      textInput: { submitButtonTitle: 'Send', placeholder: 'Type a reply…' },
      options: { opensAppToForeground: false },
    },
  ]);

  await Notifications.setNotificationCategoryAsync('incoming_call', [
    { identifier: 'answer', buttonTitle: 'Answer', options: { opensAppToForeground: true } },
    { identifier: 'decline', buttonTitle: 'Decline', options: { opensAppToForeground: true, isDestructive: true } },
  ]);
}

/**
 * Asks for notification permission, gets this device's free Expo push token and
 * registers it with the backend. Best-effort and silent — never throws.
 */
export async function registerForPush(): Promise<void> {
  try {
    const Notifications = await N();
    if (!Notifications) return;
    const Device = await import('expo-device');
    if (!Device.isDevice) return;
    await configure(Notifications);

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    const tokenResult = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (tokenResult.data) await registerPushTokenRequest(tokenResult.data);
  } catch {
    // Push is an enhancement; the app works without it.
  }
}

/** On logout: this phone stops receiving the account's notifications. */
export async function unregisterPush(): Promise<void> {
  try {
    if (IS_EXPO_GO) return;
    await unregisterPushTokenRequest();
    const Notifications = await N();
    await Notifications?.setBadgeCountAsync(0);
    await Notifications?.dismissAllNotificationsAsync();
  } catch {
    /* ignore */
  }
}

/**
 * Calls `onTap` when the user taps a notification (or one of its buttons) —
 * including the tap that launched the app from a killed state.
 */
export function subscribeToPushTaps(onTap: (tap: PushTap) => void): () => void {
  let sub: { remove: () => void } | null = null;
  let cancelled = false;
  void (async () => {
    const Notifications = await N();
    if (!Notifications || cancelled) return;
    await configure(Notifications);
    const handle = (r: import('expo-notifications').NotificationResponse | null) => {
      if (!r) return;
      // Inline reply: send it, don't open anything.
      if (r.actionIdentifier === 'reply') {
        void handleReplyAction(
          r.notification.request.identifier,
          (r.notification.request.content.data ?? {}) as Record<string, unknown>,
          r.userText,
        );
        return;
      }
      onTap({
        data: (r.notification.request.content.data ?? {}) as PushData,
        action: r.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER ? 'default' : r.actionIdentifier,
      });
      void Notifications.dismissNotificationAsync(r.notification.request.identifier).catch(() => undefined);
    };
    sub = Notifications.addNotificationResponseReceivedListener(handle);
    // Cold start: the app was opened by tapping a notification.
    const last = await Notifications.getLastNotificationResponseAsync();
    if (last && !cancelled) {
      handle(last);
      await Notifications.clearLastNotificationResponseAsync?.();
    }
  })();
  return () => {
    cancelled = true;
    sub?.remove();
  };
}

/** App-icon badge = unread notifications + unread messages. */
export async function setAppBadge(count: number): Promise<void> {
  try {
    const Notifications = await N();
    await Notifications?.setBadgeCountAsync(Math.max(0, count));
  } catch {
    /* ignore */
  }
}

/** Removes the "incoming call" notification once the call is answered / over. */
export async function dismissCallNotification(callId: string): Promise<void> {
  try {
    const Notifications = await N();
    if (!Notifications) return;
    const shown = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      shown
        .filter((n) => (n.request.content.data as PushData | undefined)?.callId === callId)
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
    );
  } catch {
    /* ignore */
  }
}
