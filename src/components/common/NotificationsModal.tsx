import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppNotification } from '../../api/notifications.api';
import { typography, spacing, borderRadius, shadows } from '../../theme';

interface NotificationsModalProps {
  visible: boolean;
  notifications: AppNotification[];
  onClose: () => void;
  onMarkRead: () => void;
  /** Tap → open what the notification is about. */
  onOpen?: (n: AppNotification) => void;
  onDelete?: (id: string) => void;
  onClearAll?: () => void;
}

const ICON_BY_TYPE: Record<AppNotification['type'], { icon: keyof typeof Ionicons.glyphMap; bg: string; color: string }> = {
  CRITIQUE: { icon: 'ribbon', bg: '#EDE9FE', color: '#7C3AED' },
  COMMENT: { icon: 'chatbubble-ellipses', bg: '#DBEAFE', color: '#2563EB' },
  LIKE: { icon: 'heart', bg: '#FFE4E6', color: '#E11D48' },
  EVENT: { icon: 'flash', bg: '#FEF3C7', color: '#D97706' },
  SYSTEM: { icon: 'information-circle', bg: '#F1F5F9', color: '#64748B' },
  FOLLOW: { icon: 'person-add', bg: '#DCFCE7', color: '#16A34A' },
  REPOST: { icon: 'repeat', bg: '#DCFCE7', color: '#15803D' },
  CALL: { icon: 'call', bg: '#FEE2E2', color: '#DC2626' },
  ANNOUNCEMENT: { icon: 'megaphone', bg: '#FFEDD5', color: '#EA580C' },
};

/**
 * Notification history. New (unread when opened) and Earlier sections; tap to
 * open, press-and-hold for options (open / delete / clear all).
 */
export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  visible,
  notifications,
  onClose,
  onMarkRead,
  onOpen,
  onDelete,
  onClearAll,
}) => {
  const [menuFor, setMenuFor] = useState<AppNotification | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  // Remember what was unread when the sheet opened, so it stays under "New"
  // even after we mark everything read.
  const newIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) {
      setMenuFor(null);
      setConfirmClear(false);
      return;
    }
    newIds.current = new Set(notifications.filter((n) => !n.read).map((n) => n.id));
    if (newIds.current.size > 0) onMarkRead();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const fresh = notifications.filter((n) => newIds.current.has(n.id));
  const earlier = notifications.filter((n) => !newIds.current.has(n.id));

  const renderItem = (n: AppNotification, isNew: boolean) => {
    const style = ICON_BY_TYPE[n.type] ?? ICON_BY_TYPE.SYSTEM;
    return (
      <Pressable
        key={n.id}
        onPress={() => onOpen?.(n)}
        onLongPress={() => setMenuFor(n)}
        delayLongPress={350}
        style={({ pressed }) => [styles.item, isNew && styles.itemUnread, pressed && styles.itemPressed, shadows.soft]}
      >
        <View style={[styles.iconCircle, { backgroundColor: style.bg }]}>
          <Ionicons name={style.icon} size={17} color={style.color} />
        </View>
        <View style={styles.itemBody}>
          <Text style={styles.itemTitle}>{n.title}</Text>
          <Text style={styles.itemText} numberOfLines={n.type === 'ANNOUNCEMENT' ? 6 : 2}>
            {n.body}
          </Text>
          <Text style={styles.itemTime}>{n.timeAgo}</Text>
        </View>
        {isNew && <View style={styles.unreadDot} />}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.dragHandle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Notifications</Text>
            <View style={styles.headerActions}>
              {notifications.length > 0 && onClearAll && (
                <TouchableOpacity onPress={() => setConfirmClear(true)} style={styles.clearBtn}>
                  <Ionicons name="trash-outline" size={14} color="#DC2626" />
                  <Text style={styles.clearText}>Clear all</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          {notifications.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="notifications-outline" size={34} color="#F2542D" />
              </View>
              <Text style={styles.emptyTitle}>You’re all caught up</Text>
              <Text style={styles.emptyText}>Likes, comments, followers, messages and calls will show up here.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.hint}>Press and hold a notification for more options</Text>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
                {fresh.length > 0 && <Text style={styles.section}>New</Text>}
                {fresh.map((n) => renderItem(n, true))}
                {earlier.length > 0 && <Text style={styles.section}>Earlier</Text>}
                {earlier.map((n) => renderItem(n, false))}
              </ScrollView>
            </>
          )}

          {/* Press-and-hold options */}
          {menuFor && (
            <Pressable style={styles.menuBackdrop} onPress={() => setMenuFor(null)}>
              <Pressable style={styles.menu} onPress={() => undefined}>
                <Text style={styles.menuTitle} numberOfLines={1}>{menuFor.title}</Text>
                {onOpen && (
                  <TouchableOpacity
                    style={styles.menuRow}
                    onPress={() => {
                      const n = menuFor;
                      setMenuFor(null);
                      onOpen(n);
                    }}
                  >
                    <Ionicons name="open-outline" size={18} color="#334155" />
                    <Text style={styles.menuText}>Open</Text>
                  </TouchableOpacity>
                )}
                {onDelete && (
                  <TouchableOpacity
                    style={styles.menuRow}
                    onPress={() => {
                      onDelete(menuFor.id);
                      setMenuFor(null);
                    }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#DC2626" />
                    <Text style={[styles.menuText, { color: '#DC2626' }]}>Delete this notification</Text>
                  </TouchableOpacity>
                )}
                {onClearAll && (
                  <TouchableOpacity
                    style={styles.menuRow}
                    onPress={() => {
                      setMenuFor(null);
                      setConfirmClear(true);
                    }}
                  >
                    <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
                    <Text style={[styles.menuText, { color: '#DC2626' }]}>Clear all notifications</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.menuRow, styles.menuCancel]} onPress={() => setMenuFor(null)}>
                  <Text style={styles.menuCancelText}>Cancel</Text>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          )}

          {/* Confirm clear all */}
          {confirmClear && (
            <Pressable style={styles.menuBackdrop} onPress={() => setConfirmClear(false)}>
              <Pressable style={styles.menu} onPress={() => undefined}>
                <Text style={styles.confirmTitle}>Clear all notifications?</Text>
                <Text style={styles.confirmText}>This removes your whole notification history. It can’t be undone.</Text>
                <View style={styles.confirmRow}>
                  <TouchableOpacity style={[styles.confirmBtn, styles.confirmKeep]} onPress={() => setConfirmClear(false)}>
                    <Text style={styles.confirmKeepText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmBtn, styles.confirmClear]}
                    onPress={() => {
                      setConfirmClear(false);
                      onClearAll?.();
                    }}
                  >
                    <Text style={styles.confirmClearText}>Clear all</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
    minHeight: '45%',
  },
  dragHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: '#0F172A' },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FEF2F2',
  },
  clearText: { fontSize: 12, fontWeight: '800', color: '#DC2626' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 11, color: '#94A3B8', marginBottom: 6 },
  section: { fontSize: 12, fontWeight: '800', color: '#64748B', letterSpacing: 0.5, marginTop: 6, textTransform: 'uppercase' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2, gap: 8, paddingHorizontal: 24 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFF1EC', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  emptyText: { fontSize: typography.sizes.sm, color: '#94A3B8', textAlign: 'center' },
  list: { gap: 10, paddingBottom: spacing.md },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: spacing.md,
    gap: 12,
  },
  itemUnread: { backgroundColor: '#FFF8F5', borderColor: '#FDC9B8' },
  itemPressed: { opacity: 0.85 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  itemBody: { flex: 1 },
  itemTitle: { fontSize: typography.sizes.sm, fontWeight: typography.weights.bold, color: '#0F172A' },
  itemText: { fontSize: typography.sizes.xs + 1, color: '#64748B', marginTop: 1 },
  itemTime: { fontSize: 10, color: '#94A3B8', marginTop: 3 },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#F2542D' },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'flex-end',
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    padding: 12,
  },
  menu: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 8, ...shadows.card },
  menuTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A', paddingHorizontal: 12, paddingVertical: 8 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 13, borderRadius: 12 },
  menuText: { fontSize: 14, fontWeight: '700', color: '#334155' },
  menuCancel: { justifyContent: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 4 },
  menuCancelText: { fontSize: 14, fontWeight: '800', color: '#64748B' },
  confirmTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', paddingHorizontal: 12, paddingTop: 10 },
  confirmText: { fontSize: 13, color: '#64748B', paddingHorizontal: 12, paddingTop: 4, lineHeight: 18 },
  confirmRow: { flexDirection: 'row', gap: 10, padding: 12 },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: 'center' },
  confirmKeep: { backgroundColor: '#F1F5F9' },
  confirmKeepText: { fontSize: 14, fontWeight: '800', color: '#334155' },
  confirmClear: { backgroundColor: '#DC2626' },
  confirmClearText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});
