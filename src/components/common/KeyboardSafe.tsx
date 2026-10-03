import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, useKeyboardState } from 'react-native-keyboard-controller';

/**
 * WhatsApp-style keyboard handling for screens with a typing area at the bottom
 * (chat, comments, captions). Works in edge-to-edge Android and inside Modals:
 * the content shrinks with the keyboard frame-by-frame, so the input bar always
 * sits right above the keyboard and never behind it.
 */
export const KeyboardSafeView: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({
  children,
  style,
}) => (
  <KeyboardAvoidingView behavior="padding" automaticOffset style={[{ flex: 1 }, style]}>
    {children}
  </KeyboardAvoidingView>
);

/**
 * Bottom padding for an input bar: clears the phone's gesture bar / 3-button
 * navigation when the keyboard is closed, and hugs the keyboard when it's open.
 */
export function useComposerBottomPadding(extra = 8): number {
  const insets = useSafeAreaInsets();
  const open = useKeyboardState((s) => s.isVisible);
  return open ? extra : Math.max(insets.bottom, 0) + extra;
}
