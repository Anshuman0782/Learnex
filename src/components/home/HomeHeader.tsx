import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '../../context/AppContext';
import { Avatar } from '../common/Avatar';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

interface HomeHeaderProps {
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  onNotificationPress,
  onProfilePress,
}) => {
  const { user, selectedRole, selectedHobby, openRewardsModal, showDialog } = useApp();

  return (
    <View style={styles.container}>
      {/* Top Brand Logo Bar */}
      <View style={styles.brandRow}>
        <View style={styles.brandContainer}>
          <Image
            source={require('../../../assets/images/home_logo.png')}
            style={styles.brandLogoIcon}
            resizeMode="contain"
          />
          <Text style={styles.brandWordmark}>
            <Text style={styles.brandWordmarkDark}>LERN</Text>
            <Text style={styles.brandWordmarkAccent}>EX</Text>
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onNotificationPress}
          style={styles.bellButton}
        >
          <Ionicons name="notifications-outline" size={20} color="#1E293B" />
          <View style={styles.bellDot} />
        </TouchableOpacity>
      </View>

      {/* Main Profile & Stats Row */}
      <View style={styles.profileAndStatsRow}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onProfilePress}
        style={styles.userProfileRow}
      >
        <View style={styles.avatarContainer}>
          <LinearGradient
            colors={['#6366F1', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarRing}
          >
            <Avatar
              uri={user?.avatarUrl}
              name={user?.name || 'Anshuman Sarkar'}
              size={44}
              showRing={false}
              showOnlineDot={false}
            />
          </LinearGradient>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>L2</Text>
          </View>
        </View>

        <View style={styles.nameBlock}>
          <View style={styles.greetingRow}>
            <Text style={styles.greetingName} numberOfLines={1}>
              {user?.name?.split(' ')[0] || 'Anshuman'}
            </Text>
            <Text style={styles.waveEmoji}>👋</Text>
          </View>
          <View style={styles.badgeRow}>
            <View style={styles.rolePill}>
              <Text style={styles.roleText}>{selectedRole || 'Learner'}</Text>
            </View>
            <Text style={styles.dotSeparator}>•</Text>
            <Text style={styles.hobbyText}>{selectedHobby || 'Music'}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Right: Trophy/Rank Pill + Streak Pill + Notification Bell */}
      <View style={styles.actionsRow}>
        {/* Trophy & XP Rank Pill */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={openRewardsModal}
          style={styles.rewardsPillWrapper}
        >
          <LinearGradient
            colors={['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.rewardsPillGradient}
          >
            <Ionicons name="trophy" size={13} color="#FDE047" />
            <Text style={styles.rewardsPillRank}>#4</Text>
            <View style={styles.pillDivider} />
            <Text style={styles.rewardsPillXp}>{user?.xpPoints || 1240} XP</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Streak Fire Pill */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() =>
            showDialog({
              title: 'Streak Fire 🔥',
              message: `You are on an active ${user?.streakDays || 6}-day learning streak! Complete today's session to keep your momentum going.`,
              icon: 'flame',
              confirmText: 'Keep It Going!',
            })
          }
          style={styles.streakWrapper}
        >
          <LinearGradient
            colors={['#FF5722', '#F97316']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.streakGradient}
          >
            <Ionicons name="flame" size={13} color="#FFFFFF" />
            <Text style={styles.streakCount}>{user?.streakDays || 6}d</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    gap: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogoIcon: {
    width: 38,
    height: 38,
  },
  brandWordmark: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2.2,
  },
  brandWordmarkDark: {
    color: '#0F172A',
    fontWeight: '900',
  },
  brandWordmarkAccent: {
    color: '#EC4899',
    fontWeight: '900',
  },
  profileAndStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: spacing.xs,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarRing: {
    padding: 2.5,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  levelBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  nameBlock: {
    marginLeft: 10,
    flex: 1,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greetingName: {
    fontSize: 17,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  waveEmoji: {
    fontSize: 14,
    marginLeft: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  rolePill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  roleText: {
    fontSize: 10,
    color: '#4F46E5',
    fontWeight: 'bold',
  },
  dotSeparator: {
    fontSize: 10,
    color: '#94A3B8',
  },
  hobbyText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rewardsPillWrapper: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  rewardsPillGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 4,
  },
  rewardsPillRank: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  pillDivider: {
    width: 1,
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  rewardsPillXp: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FDE047',
  },
  streakWrapper: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  streakGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    gap: 4,
  },
  streakCount: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  bellButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  bellDot: {
    position: 'absolute',
    top: 7,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
});
