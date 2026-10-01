import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useCall } from '../../realtime/CallContext';
import { subscribeToPushTaps, type PushData, type PushTap } from '../../realtime/push';
import { navigationRef } from '../../navigation/navigationRef';
import { getPostRequest } from '../../api/posts.api';
import { CritiqueModal } from '../community/CritiqueModal';
import { CommentsSheet } from '../community/CommentsSheet';
import type { CommunityPost } from '../../types';

/**
 * Opens whatever a notification is about — from a phone notification tap
 * (including the one that launched the app) or a tap in the bell list.
 * Taps that arrive before the user is signed in are kept and handled after.
 */
export const NotificationRouter: React.FC = () => {
  const { user, openChatWith, openUserProfile, openNotifications, setNotificationOpener } = useApp();
  const { handleCallPush } = useCall();
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [commentsPost, setCommentsPost] = useState<CommunityPost | null>(null);
  const pending = useRef<PushTap | null>(null);
  const ready = !!user;

  const goToCircle = (communityId?: string) => {
    if (!navigationRef.isReady()) return;
    navigationRef.navigate('Main', {
      screen: 'CirclesTab',
      params: communityId ? { openCircleId: communityId } : undefined,
    });
  };

  const open = useCallback(
    async (data: PushData, action = 'default') => {
      const name = (data.fromName as string | undefined) ?? (data.actorName as string | undefined) ?? '';
      switch (data.kind) {
        case 'call':
          handleCallPush(data, action);
          return;
        case 'chat':
          if (data.userId) {
            openChatWith({ id: data.userId, name: name || 'Chat', avatarUrl: data.fromAvatar as string | undefined });
          }
          return;
        case 'profile':
        case 'missed_call': {
          const id = data.userId ?? (data.actorId as string | undefined);
          if (id) openUserProfile({ id, name } as any);
          return;
        }
        case 'event':
        case 'circle':
          goToCircle(data.communityId);
          return;
        case 'announcement':
          openNotifications();
          return;
        case 'post':
        default: {
          if (!data.postId) {
            openNotifications();
            return;
          }
          try {
            const p = await getPostRequest(data.postId);
            // Photo posts open their comments (no separate post window).
            if (p.postType === 'image' || data.openComments) setCommentsPost(p);
            else setPost(p);
          } catch {
            openNotifications(); // deleted / no longer visible
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleCallPush, openChatWith, openUserProfile, openNotifications],
  );

  // Phone notification taps.
  useEffect(
    () =>
      subscribeToPushTaps((tap) => {
        if (tap.data.kind === 'call') {
          // Calls must react immediately (the ring is time-limited).
          handleCallPush(tap.data, tap.action);
          return;
        }
        if (!ready) pending.current = tap;
        else void open(tap.data, tap.action);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready],
  );

  // A tap that arrived while signing in → handle it now.
  useEffect(() => {
    if (ready && pending.current) {
      const tap = pending.current;
      pending.current = null;
      setTimeout(() => void open(tap.data, tap.action), 400);
    }
  }, [ready, open]);

  // Bell-list taps go through the same routing.
  useEffect(() => {
    setNotificationOpener((d) => void open(d));
    return () => setNotificationOpener(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <CritiqueModal visible={!!post} post={post} onClose={() => setPost(null)} />
      <CommentsSheet visible={!!commentsPost} post={commentsPost} onClose={() => setCommentsPost(null)} />
    </>
  );
};
