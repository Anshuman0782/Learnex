import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Skill } from '../../types';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

interface SkillGridProps {
  skills: Skill[];
  onViewAllPress?: () => void;
  onSkillPress?: (skill: Skill) => void;
}

export const SkillGrid: React.FC<SkillGridProps> = ({
  skills,
  onViewAllPress,
  onSkillPress,
}) => {
  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Explore Skills</Text>
          <Text style={styles.sectionSubtitle}>Handpicked tracks tailored for you</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onViewAllPress}
          style={styles.viewAllBtn}
        >
          <Text style={styles.viewAllText}>View All</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Modern 3-column Grid */}
      <View style={styles.grid}>
        {skills.slice(0, 6).map((skill) => (
          <TouchableOpacity
            key={skill.id}
            activeOpacity={0.82}
            onPress={() => onSkillPress?.(skill)}
            style={[styles.skillCard, shadows.soft]}
          >
            {skill.badge && (
              <View style={styles.badgePill}>
                <Text style={styles.badgeText}>{skill.badge}</Text>
              </View>
            )}

            <View style={[styles.iconBox, { backgroundColor: skill.iconBgColor }]}>
              <Ionicons
                name={skill.iconName as keyof typeof Ionicons.glyphMap}
                size={24}
                color={skill.iconColor}
              />
            </View>

            <Text style={styles.skillName} numberOfLines={1}>
              {skill.name}
            </Text>

            <Text style={styles.topicCount}>{skill.topicsCount} tracks</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.base,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    fontSize: typography.sizes.xs + 1,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  skillCard: {
    width: '31.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: spacing.md,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm + 2,
    position: 'relative',
  },
  badgePill: {
    position: 'absolute',
    top: -6,
    right: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  badgeText: {
    fontSize: 8,
    fontWeight: typography.weights.heavy,
    color: '#B45309',
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs + 2,
  },
  skillName: {
    fontSize: typography.sizes.xs + 1,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  topicCount: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: typography.weights.medium,
  },
});
