import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { RoleOption } from '../../types';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

interface RoleCardProps {
  role: RoleOption;
  isSelected?: boolean;
  onSelect: (roleId: RoleOption['id']) => void;
}

export const RoleCard: React.FC<RoleCardProps> = ({ role, isSelected = false, onSelect }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => onSelect(role.id)}
      style={[
        styles.cardWrapper,
        shadows.card,
        isSelected && styles.cardSelected,
      ]}
    >
      {/* Top Banner / Tag */}
      <View style={styles.topRow}>
        <View style={[styles.iconCircle, { backgroundColor: role.iconBgColor }]}>
          <Ionicons
            name={role.iconName as keyof typeof Ionicons.glyphMap}
            size={32}
            color={role.iconColor}
          />
        </View>

        <View style={styles.titleArea}>
          <Text style={styles.title}>{role.title}</Text>
          <Text style={styles.subtitle}>{role.subtitle}</Text>
        </View>

        <View
          style={[
            styles.selectRadio,
            isSelected && styles.selectRadioActive,
          ]}
        >
          {isSelected && (
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          )}
        </View>
      </View>

      <Text style={styles.description}>{role.description}</Text>

      {/* Perks Checklist */}
      <View style={styles.perksList}>
        {role.perks.map((perk, i) => (
          <View key={i} style={styles.perkRow}>
            <View style={[styles.checkCircle, isSelected && styles.checkCircleActive]}>
              <Ionicons
                name="checkmark-sharp"
                size={12}
                color={isSelected ? colors.primary : '#10B981'}
              />
            </View>
            <Text style={styles.perkText}>{perk}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xxl,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FAF9FF',
    borderWidth: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  titleArea: {
    flex: 1,
  },
  title: {
    fontSize: typography.sizes.lg + 1,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: typography.sizes.xs + 1,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
  },
  selectRadio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  selectRadioActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  description: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  perksList: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: spacing.md,
    gap: 8,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  checkCircleActive: {
    backgroundColor: colors.accentPurpleLight,
  },
  perkText: {
    fontSize: typography.sizes.xs + 1,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
    flex: 1,
  },
});
