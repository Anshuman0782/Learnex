import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

interface BannerCardProps {
  onExplorePress?: () => void;
}

export const BannerCard: React.FC<BannerCardProps> = ({ onExplorePress }) => {
  return (
    <View style={[styles.container, shadows.glow]}>
      <LinearGradient
        colors={['#312E81', '#4F46E5', '#7C3AED']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Background Ambient Glow Orbs */}
        <View style={styles.ambientOrb1} />
        <View style={styles.ambientOrb2} />

        <View style={styles.contentLeft}>
          {/* Milestone Spark Pill */}
          <View style={styles.milestonePill}>
            <Ionicons name="sparkles" size={11} color="#FDE047" />
            <Text style={styles.milestoneText}>DAILY GOAL • 80%</Text>
          </View>

          <Text style={styles.title}>
            Level Up Your{'\n'}Technique ⚡
          </Text>

          <TouchableOpacity
            activeOpacity={0.88}
            onPress={onExplorePress}
            style={styles.exploreButton}
          >
            <Text style={styles.exploreButtonText}>Practice Now</Text>
            <Ionicons name="arrow-forward-circle" size={16} color="#4F46E5" />
          </TouchableOpacity>
        </View>

        {/* Right Hero Visual Meter */}
        <View style={styles.heroVisual}>
          <View style={styles.outerRing}>
            <View style={styles.innerRing}>
              <Ionicons name="headset" size={32} color="#FFFFFF" />
              <View style={styles.starBadge}>
                <Ionicons name="flash" size={13} color="#FDE047" />
              </View>
            </View>
          </View>

          {/* Floating XP Pill */}
          <View style={styles.xpFloatPill}>
            <Text style={styles.xpFloatText}>+50 XP</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
    marginBottom: spacing.base,
    borderRadius: borderRadius.xxl,
    overflow: 'hidden',
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    minHeight: 140,
    position: 'relative',
  },
  ambientOrb1: {
    position: 'absolute',
    right: -25,
    top: -25,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(236, 72, 153, 0.18)',
  },
  ambientOrb2: {
    position: 'absolute',
    left: 40,
    bottom: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(99, 102, 241, 0.22)',
  },
  contentLeft: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  milestonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    gap: 4,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  milestoneText: {
    fontSize: 9,
    fontWeight: typography.weights.heavy,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
    lineHeight: 25,
    marginBottom: spacing.sm + 2,
    letterSpacing: -0.3,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  exploreButtonText: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: '#4F46E5',
  },
  heroVisual: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  outerRing: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  innerRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  starBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#312E81',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FDE047',
  },
  xpFloatPill: {
    position: 'absolute',
    bottom: -6,
    backgroundColor: '#FDE047',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  xpFloatText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1E1B4B',
  },
});
