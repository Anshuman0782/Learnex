import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  onLeftIconPress?: () => void;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  isPassword?: boolean;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  leftIcon,
  onLeftIconPress,
  rightIcon,
  onRightIconPress,
  isPassword = false,
  containerStyle,
  style,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputFocused,
          !!error && styles.inputError,
        ]}
      >
        {leftIcon && (
          onLeftIconPress ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onLeftIconPress}
              style={styles.clickableIconWrapper}
            >
              <Ionicons
                name={leftIcon}
                size={20}
                color={isFocused ? colors.primary : colors.textMuted}
                style={styles.leftIcon}
              />
            </TouchableOpacity>
          ) : (
            <Ionicons
              name={leftIcon}
              size={20}
              color={isFocused ? colors.primary : colors.textMuted}
              style={styles.leftIcon}
            />
          )
        )}
        <TextInput
          placeholderTextColor={colors.textMuted}
          secureTextEntry={isPassword && !showPassword}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[styles.input, style]}
          {...props}
        />
        {isPassword ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowPassword(!showPassword)}
            style={styles.rightIcon}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        ) : rightIcon ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onRightIconPress}
            style={styles.rightIcon}
          >
            <Ionicons
              name={rightIcon}
              size={20}
              color={isFocused ? colors.primary : colors.textMuted}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.base,
    width: '100%',
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs + 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.base,
    height: 52,
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  inputError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
    height: '100%',
  },
  leftIcon: {
    marginRight: spacing.sm + 2,
  },
  clickableIconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightIcon: {
    padding: spacing.xs,
  },
  errorText: {
    fontSize: typography.sizes.xs,
    color: colors.error,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
});
