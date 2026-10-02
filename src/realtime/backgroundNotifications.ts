import * as TaskManager from 'expo-task-manager';
import { IS_EXPO_GO } from '../config/features';
import { sendMessageRequest } from '../api/chat.api';

/**
 * Background notification work — runs even when the app is CLOSED (Android):
 *  - "Reply" typed straight into a message notification → sends it.
 *  - A silent "call ended" push → removes the ringing call notification, which
 *    stops the ringtone immediately (answered elsewhere / cancelled / missed).
 *
 * Must be imported from index.ts (module scope) so Android can run it headless.
 */
export const BACKGROUND_NOTIFICATION_TASK = 'LERNEX_BACKGROUND_NOTIFICATIONS';

type NotificationsModule = typeof import('expo-notifications');
const N = async (): Promise<NotificationsModule> => import('expo-notifications');

/** Replies already sent (the open app and the background task can both see a tap). */
const handled = new Set<string>();

/** Sends a reply typed into a message notification, then clears it. */
export async function handleReplyAction(
  notificationId: string,
  data: Record<string, unknown>,
  text?: string | null,
): Promise<void> {
  const body = text?.trim();
  const conversationId = typeof data.conversationId === 'string' ? data.conversationId : null;
  if (!body || !conversationId || handled.has(notificationId)) return;
  handled.add(notificationId);
  const Notifications = await N();
  try {
    await sendMessageRequest(conversationId, body.slice(0, 4000));
    await Notifications.dismissNotificationAsync(notificationId);
  } catch {
    handled.delete(notificationId);
    // Let the user know it didn't go through (e.g. offline / signed out).
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Reply not sent',
        body: 'Open LERNEX to send your message.',
        data: { kind: 'chat', conversationId, userId: data.userId, fromName: data.fromName },
      },
      trigger: null,
    }).catch(() => undefined);
  }
}

/** Removes any shown notification for this call (stops its ringtone). */
export async function dismissCallById(callId: string): Promise<void> {
  try {
    const Notifications = await N();
    const shown = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      shown
        .filter((n) => (n.request.content.data as Record<string, unknown> | undefined)?.callId === callId)
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
    );
  } catch {
    /* ignore */
  }
}

function parsePayloadData(raw: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!raw) return {};
  for (const key of ['dataString', 'body']) {
    const v = raw[key];
    if (typeof v === 'string') {
      try {
        return JSON.parse(v) as Record<string, unknown>;
      } catch {
        /* not JSON */
      }
    }
  }
  return raw;
}

if (!IS_EXPO_GO) {
  TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
    if (error || !data) return;
    const payload = data as Record<string, any>;

    // A button on a notification was tapped (app backgrounded or closed).
    if ('actionIdentifier' in payload) {
      const content = payload.notification?.request?.content ?? {};
      if (payload.actionIdentifier === 'reply') {
        await handleReplyAction(payload.notification?.request?.identifier ?? '', content.data ?? {}, payload.userText);
      }
      return;
    }

    // A silent (data-only) push.
    const d = parsePayloadData(payload.data);
    if (d.kind === 'call_cancel' && typeof d.callId === 'string') {
      await dismissCallById(d.callId);
    }
  });

  // Register once the native module is available (no-op if already registered).
  void N()
    .then((Notifications) => Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK))
    .catch(() => undefined);
}
