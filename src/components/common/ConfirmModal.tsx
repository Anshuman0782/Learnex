import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  icon = 'help-circle-outline',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={[styles.dialogCard, shadows.card]}>
              {/* Icon Halo Header */}
              <View
                style={[
                  styles.iconContainer,
                  isDestructive ? styles.destructiveIconBg : styles.defaultIconBg,
                ]}
              >
                <Ionicons
                  name={icon}
                  size={28}
                  color={isDestructive ? '#EF4444' : '#4F46E5'}
                />
              </View>

              {/* Title & Description */}
              <Text style={styles.titleText}>{title}</Text>
              <Text style={styles.messageText}>{message}</Text>

              {/* Action Buttons */}
              <View style={styles.buttonRow}>
                {cancelText ? (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={onCancel}
                    style={styles.cancelButton}
                  >
                    <Text style={styles.cancelButtonText}>{cancelText}</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={onConfirm}
                  style={[styles.confirmButton, !cancelText && { flex: 1 }]}
                >
                  {isDestructive ? (
                    <LinearGradient
                      colors={['#EF4444', '#DC2626']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.confirmGradient}
                    >
                      <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.confirmButtonText}>{confirmText}</Text>
                    </LinearGradient>
                  ) : (
                    <LinearGradient
                      colors={['#4F46E5', '#7C3AED']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.confirmGradient}
                    >
                      <Text style={styles.confirmButtonText}>{confirmText}</Text>
                    </LinearGradient>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg + 4,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  defaultIconBg: {
    backgroundColor: '#EEF2FF',
  },
  destructiveIconBg: {
    backgroundColor: '#FEE2E2',
  },
  titleText: {
    fontSize: 18,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  messageText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: spacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: borderRadius.xl,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#475569',
  },
  confirmButton: {
    flex: 1.2,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  confirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  confirmButtonText: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
});
