import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Community } from '../../types';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

interface CommunityCardProps {
  community: Community;
  isJoined: boolean;
  onToggleJoin: (communityId: string) => void;
}

export const CommunityCard: React.FC<CommunityCardProps> = ({
  community,
  isJoined,
  onToggleJoin,
}) => {
  return (
    <View style={[styles.card, shadows.soft, isJoined && styles.cardJoined]}>
      {/* Top Header */}
      <View style={styles.topRow}>
        <View style={[styles.iconBox, { backgroundColor: community.iconBgColor }]}>
          <Ionicons
            name={community.iconName as keyof typeof Ionicons.glyphMap}
            size={24}
            color={community.iconColor}
          />
        </View>

        <View style={styles.infoCol}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {community.name}
            </Text>
            {community.isHot && (
              <View style={styles.hotBadge}>
                <Ionicons name="flame" size={11} color="#EF4444" />
                <Text style={styles.hotBadgeText}>HOT</Text>
              </View>
            )}
          </View>
          <Text style={styles.memberText}>{community.memberCount} active learners & mentors</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onToggleJoin(community.id)}
          style={[
            styles.joinBtn,
            isJoined ? styles.joinBtnActive : styles.joinBtnInactive,
          ]}
        >
          <Ionicons
            name={isJoined ? 'checkmark' : 'add'}
            size={16}
            color={isJoined ? '#FFFFFF' : colors.primary}
          />
          <Text
            style={[
              styles.joinBtnText,
              isJoined ? styles.joinBtnTextActive : styles.joinBtnTextInactive,
            ]}
          >
            {isJoined ? 'Joined' : 'Join'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.description} numberOfLines={2}>
        {community.description}
      </Text>

      {/* Footer with Tags and Avatar Stack */}
      <View style={styles.footerRow}>
        <View style={styles.tagsRow}>
          {community.tags?.slice(0, 2).map((t, idx) => (
            <View key={idx} style={styles.tagChip}>
              <Text style={styles.tagText}>{t}</Text>
            </View>
          ))}
        </View>

        {/* Overlapping Avatar Stack */}
        <View style={styles.avatarStack}>
          {community.avatarStack?.map((uri, idx) => (
            <Image
              key={idx}
              source={{ uri }}
              style={[styles.stackAvatar, { left: idx * 14 }]}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: spacing.base,
    marginBottom: spacing.md,
  },
  cardJoined: {
    borderColor: '#C7D2FE',
    backgroundColor: '#FCFBFF',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  infoCol: {
    flex: 1,
    paddingRight: spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  hotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    gap: 2,
  },
  hotBadgeText: {
    fontSize: 9,
    fontWeight: typography.weights.heavy,
    color: '#E11D48',
  },
  memberText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  joinBtnInactive: {
    backgroundColor: colors.accentPurpleLight,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  joinBtnActive: {
    backgroundColor: colors.primary,
  },
  joinBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  joinBtnTextInactive: {
    color: colors.primary,
  },
  joinBtnTextActive: {
    color: '#FFFFFF',
  },
  description: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tagChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  avatarStack: {
    position: 'relative',
    width: 60,
    height: 24,
  },
  stackAvatar: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
});
