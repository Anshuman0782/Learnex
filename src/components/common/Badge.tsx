import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'neutral';
  size?: 'sm' | 'md';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'primary',
  size = 'sm',
  style,
  textStyle,
}) => {
  const getBackgroundColor = () => {
    switch (variant) {
      case 'secondary':
        return colors.accentPurpleLight;
      case 'success':
        return colors.accentGreenLight;
      case 'warning':
        return colors.accentOrangeLight;
      case 'neutral':
        return colors.backgroundTertiary;
      case 'primary':
      default:
        return colors.primaryMuted;
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'secondary':
        return colors.accentPurple;
      case 'success':
        return colors.accentGreen;
      case 'warning':
        return colors.accentOrange;
      case 'neutral':
        return colors.textSecondary;
      case 'primary':
      default:
        return colors.primary;
    }
  };

  return (
    <View
      style={[
        styles.badge,
        size === 'md' ? styles.badgeMd : styles.badgeSm,
        { backgroundColor: getBackgroundColor() },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          size === 'md' ? styles.textMd : styles.textSm,
          { color: getTextColor() },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSm: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  badgeMd: {
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
  },
  text: {
    fontWeight: typography.weights.semiBold,
  },
  textSm: {
    fontSize: typography.sizes.xs,
  },
  textMd: {
    fontSize: typography.sizes.sm,
  },
});
