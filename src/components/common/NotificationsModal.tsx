import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppNotification } from '../../api/notifications.api';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

interface NotificationsModalProps {
  visible: boolean;
  notifications: AppNotification[];
  onClose: () => void;
  onMarkRead: () => void;
  /** Tap → open what the notification is about. */
  onOpen?: (n: AppNotification) => void;
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
  ANNOUNCEMENT: { icon: 'megaphone', bg: '#E0E7FF', color: '#4338CA' },
};

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  visible,
  notifications,
  onClose,
  onMarkRead,
  onOpen,
}) => {
  // Mark everything read once the sheet is opened.
  useEffect(() => {
    if (visible && notifications.some((n) => !n.read)) {
      onMarkRead();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.dragHandle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Notifications</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {notifications.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={40} color="#94A3B8" />
              <Text style={styles.emptyText}>You’re all caught up.</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
              {notifications.map((n) => {
                const style = ICON_BY_TYPE[n.type] ?? ICON_BY_TYPE.SYSTEM;
                return (
                  <TouchableOpacity
                    key={n.id}
                    activeOpacity={0.8}
                    disabled={!onOpen}
                    onPress={() => onOpen?.(n)}
                    style={[styles.item, !n.read && styles.itemUnread, shadows.soft]}
                  >
                    <View style={[styles.iconCircle, { backgroundColor: style.bg }]}>
                      <Ionicons name={style.icon} size={16} color={style.color} />
                    </View>
                    <View style={styles.itemBody}>
                      <Text style={styles.itemTitle}>{n.title}</Text>
                      <Text style={styles.itemText} numberOfLines={n.type === 'ANNOUNCEMENT' ? 6 : 2}>
                        {n.body}
                      </Text>
                      <Text style={styles.itemTime}>{n.timeAgo}</Text>
                    </View>
                    {!n.read && <View style={styles.unreadDot} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxHeight: '80%',
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
    gap: 10,
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    color: '#94A3B8',
  },
  list: {
    gap: 10,
    paddingBottom: spacing.md,
  },
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
  itemUnread: {
    backgroundColor: '#FCFBFF',
    borderColor: '#C7D2FE',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
  },
  itemText: {
    fontSize: typography.sizes.xs + 1,
    color: '#64748B',
    marginTop: 1,
  },
  itemTime: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 3,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
});
