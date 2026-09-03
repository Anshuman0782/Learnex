import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'gradient';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'gradient',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  fullWidth = false,
}) => {
  const getContainerStyles = (): ViewStyle[] => {
    const list: ViewStyle[] = [styles.base];
    if (fullWidth) list.push(styles.fullWidth);

    switch (size) {
      case 'sm':
        list.push(styles.sizeSm);
        break;
      case 'lg':
        list.push(styles.sizeLg);
        break;
      case 'md':
      default:
        list.push(styles.sizeMd);
        break;
    }

    switch (variant) {
      case 'secondary':
        list.push(styles.variantSecondary);
        break;
      case 'outline':
        list.push(styles.variantOutline);
        break;
      case 'ghost':
        list.push(styles.variantGhost);
        break;
      case 'primary':
        list.push(styles.variantPrimary);
        if (!disabled) list.push(shadows.glow);
        break;
      case 'gradient':
      default:
        if (!disabled) list.push(shadows.glow);
        break;
    }

    if (disabled) list.push(styles.disabled);
    if (style) list.push(style);

    return list;
  };

  const getTextStyles = (): TextStyle[] => {
    const list: TextStyle[] = [styles.baseText];

    switch (size) {
      case 'sm':
        list.push(styles.textSm);
        break;
      case 'lg':
        list.push(styles.textLg);
        break;
      case 'md':
      default:
        list.push(styles.textMd);
        break;
    }

    switch (variant) {
      case 'outline':
      case 'ghost':
        list.push(styles.textPrimaryColor);
        break;
      case 'secondary':
        list.push(styles.textSecondaryColor);
        break;
      case 'gradient':
      case 'primary':
      default:
        list.push(styles.textLightColor);
        break;
    }

    if (disabled) list.push(styles.disabledText);
    if (textStyle) list.push(textStyle);

    return list;
  };

  const content = (
    <>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? colors.primary : colors.textLight}
        />
      ) : (
        <View style={styles.contentRow}>
          {icon && iconPosition === 'left' && <View style={styles.iconLeft}>{icon}</View>}
          <Text style={getTextStyles()}>{title}</Text>
          {icon && iconPosition === 'right' && <View style={styles.iconRight}>{icon}</View>}
        </View>
      )}
    </>
  );

  if (variant === 'gradient' && !disabled) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        disabled={disabled || loading}
        style={[fullWidth && styles.fullWidth, style]}
      >
        <LinearGradient
          colors={['#6366F1', '#5B4DFF', '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.base,
            size === 'sm' ? styles.sizeSm : size === 'lg' ? styles.sizeLg : styles.sizeMd,
            shadows.glow,
          ]}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      style={getContainerStyles()}
    >
      {content}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
  sizeSm: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  sizeMd: {
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  sizeLg: {
    paddingVertical: 16,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.xl,
  },
  variantPrimary: {
    backgroundColor: colors.primary,
  },
  variantSecondary: {
    backgroundColor: colors.accentPurpleLight,
  },
  variantOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  variantGhost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    backgroundColor: '#E2E8F0',
    borderColor: '#E2E8F0',
    shadowOpacity: 0,
    elevation: 0,
  },
  baseText: {
    fontWeight: typography.weights.bold,
    textAlign: 'center',
  },
  textSm: {
    fontSize: typography.sizes.sm,
  },
  textMd: {
    fontSize: typography.sizes.base,
  },
  textLg: {
    fontSize: typography.sizes.lg,
  },
  textLightColor: {
    color: colors.textLight,
  },
  textPrimaryColor: {
    color: colors.primary,
  },
  textSecondaryColor: {
    color: colors.accentPurple,
  },
  disabledText: {
    color: colors.textMuted,
  },
});
