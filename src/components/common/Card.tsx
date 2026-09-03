import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { colors, borderRadius, shadows, spacing } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  selected?: boolean;
  elevation?: 'none' | 'soft' | 'card';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  selected = false,
  elevation = 'soft',
}) => {
  const shadowStyle = elevation === 'card' ? shadows.card : elevation === 'soft' ? shadows.soft : shadows.none;

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        style={[
          styles.card,
          shadowStyle,
          selected && styles.cardSelected,
          style,
        ]}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[
        styles.card,
        shadowStyle,
        selected && styles.cardSelected,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.base,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
});
