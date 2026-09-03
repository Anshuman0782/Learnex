import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Clipboard,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SeasonRewardItem } from '../../types';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

interface RewardClaimModalProps {
  visible: boolean;
  reward: SeasonRewardItem | null;
  onClose: () => void;
}

export const RewardClaimModal: React.FC<RewardClaimModalProps> = ({
  visible,
  reward,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!reward) return null;

  const handleCopyCode = () => {
    if (reward.sampleCode) {
      if (Clipboard && Clipboard.setString) {
        Clipboard.setString(reward.sampleCode);
      }
      setCopied(true);
      Alert.alert(
        'Code Copied',
        `Code "${reward.sampleCode}" has been copied to your clipboard.`
      );
      setTimeout(() => setCopied(false), 3000);
    } else {
      Alert.alert('Reward Linked', 'This seasonal perk is linked directly to your profile.');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, shadows.card]}>
          {/* Top Gradient Header */}
          <LinearGradient
            colors={reward.gradientColors || ['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.iconCircle}>
              <Ionicons
                name={reward.icon as keyof typeof Ionicons.glyphMap}
                size={34}
                color="#FFFFFF"
              />
            </View>

            <View style={styles.badgePill}>
              <Ionicons name="sparkles" size={12} color="#FDE047" />
              <Text style={styles.badgeText}>{reward.tag.toUpperCase()}</Text>
            </View>

            <Text style={styles.rewardTitle}>{reward.title}</Text>
            <Text style={styles.rewardSubtitle}>{reward.subtitle}</Text>
          </LinearGradient>

          {/* Body Content */}
          <View style={styles.bodyContent}>
            <Text style={styles.descriptionText}>{reward.description}</Text>

            {/* Voucher Code Box */}
            {reward.sampleCode && (
              <View style={styles.voucherContainer}>
                <Text style={styles.voucherLabel}>DEMO VOUCHER CODE</Text>
                <View style={styles.codeRow}>
                  <Text style={styles.codeText}>{reward.sampleCode}</Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleCopyCode}
                    style={styles.copyBtn}
                  >
                    <Ionicons
                      name={copied ? 'checkmark' : 'copy-outline'}
                      size={15}
                      color="#4F46E5"
                    />
                    <Text style={styles.copyBtnText}>
                      {copied ? 'Copied' : 'Copy'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Included Perks List */}
            <View style={styles.perksSection}>
              <Text style={styles.perksHeaderTitle}>What’s Included:</Text>
              {reward.perks.map((perk, idx) => (
                <View key={idx} style={styles.perkItemRow}>
                  <View style={styles.checkIconBox}>
                    <Ionicons name="checkmark" size={12} color="#10B981" />
                  </View>
                  <Text style={styles.perkItemText}>{perk}</Text>
                </View>
              ))}
            </View>

            {/* Eligibility Note */}
            <View style={styles.eligibilityBox}>
              <Ionicons name="information-circle" size={15} color="#6366F1" />
              <Text style={styles.eligibilityText}>
                Unlocked when cycle finishes for: <Text style={{ fontWeight: 'bold' }}>{reward.minRankRequired}</Text>
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={handleCopyCode}
                style={styles.primaryClaimBtn}
              >
                <LinearGradient
                  colors={reward.gradientColors || ['#4F46E5', '#7C3AED']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryGradient}
                >
                  <Ionicons name="gift-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>Claim Demo Perk</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onClose}
                style={styles.dismissBtn}
              >
                <Text style={styles.dismissBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.base,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xxl,
    overflow: 'hidden',
  },
  headerGradient: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.base,
    alignItems: 'center',
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    marginBottom: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  rewardTitle: {
    fontSize: 18,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  rewardSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  bodyContent: {
    padding: spacing.base,
    gap: spacing.sm,
  },
  descriptionText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    textAlign: 'center',
  },
  voucherContainer: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: borderRadius.lg,
    padding: 12,
    alignItems: 'center',
  },
  voucherLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
  },
  codeText: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.5,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  perksSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: borderRadius.lg,
    padding: 12,
    gap: 7,
  },
  perksHeaderTitle: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    color: '#0F172A',
    marginBottom: 2,
  },
  perkItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkIconBox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkItemText: {
    fontSize: 12,
    color: '#334155',
    flex: 1,
  },
  eligibilityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    padding: 9,
    borderRadius: borderRadius.md,
    gap: 6,
  },
  eligibilityText: {
    fontSize: 11,
    color: '#4338CA',
    flex: 1,
  },
  buttonRow: {
    marginTop: 4,
    gap: 8,
  },
  primaryClaimBtn: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
  dismissBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  dismissBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
});
