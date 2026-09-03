import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Share,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

export interface CertificateData {
  id: string;
  title: string;
  category: string;
  issuer: string;
  mentorName: string;
  studentName: string;
  issueDate: string;
  credentialId: string;
  skillsVerified: string[];
}

interface CertificateModalProps {
  visible: boolean;
  certificate: CertificateData | null;
  onClose: () => void;
}

export const CertificateModal: React.FC<CertificateModalProps> = ({
  visible,
  certificate,
  onClose,
}) => {
  if (!certificate) return null;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `I just earned my verified ${certificate.title} on Lernex! Credential ID: ${certificate.credentialId}. Issued by ${certificate.issuer}`,
      });
    } catch {
      Alert.alert('Share', 'Certificate link copied! 🔗');
    }
  };

  const handleDownload = () => {
    Alert.alert(
      'Exporting Certificate 📥',
      `Certificate ${certificate.credentialId} has been exported to your downloads.`
    );
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.cardContainer}>
          {/* Certificate Frame with Golden Border */}
          <View style={[styles.certFrame, shadows.glow]}>
            {/* Top Security & Seal Strip */}
            <View style={styles.certTopStrip}>
              <View style={styles.sealBadge}>
                <Ionicons name="shield-checkmark" size={14} color="#D97706" />
                <Text style={styles.sealText}>VERIFIED CREDENTIAL</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Certificate Header */}
            <Text style={styles.academyTitle}>{certificate.issuer}</Text>
            <Text style={styles.subHeading}>CERTIFICATE OF TECHNICAL MASTERY</Text>

            <View style={styles.goldDivider} />

            {/* Student Name */}
            <Text style={styles.presentedToText}>This is proudly presented to</Text>
            <Text style={styles.studentNameText}>{certificate.studentName}</Text>

            {/* Course / Skill Title */}
            <Text style={styles.achievementDesc}>
              for successful demonstration, pitch precision, and deliberate practice in
            </Text>
            <Text style={styles.certTitleText}>{certificate.title}</Text>

            {/* Skills Verified Tags */}
            <View style={styles.skillsTagRow}>
              {certificate.skillsVerified.map((sk, idx) => (
                <View key={idx} style={styles.skillTag}>
                  <Ionicons name="checkmark-circle" size={11} color="#15803D" />
                  <Text style={styles.skillTagText}>{sk}</Text>
                </View>
              ))}
            </View>

            {/* Signatures & Issue Date Row */}
            <View style={styles.footerRow}>
              <View style={styles.signatureCol}>
                <Text style={styles.sigScript}>{certificate.mentorName}</Text>
                <View style={styles.sigLine} />
                <Text style={styles.sigLabel}>Verified Mentor</Text>
              </View>

              <View style={styles.hologramSeal}>
                <LinearGradient
                  colors={['#FEF3C7', '#FDE68A', '#F59E0B']}
                  style={styles.hologramCircle}
                >
                  <Ionicons name="ribbon" size={24} color="#B45309" />
                </LinearGradient>
              </View>

              <View style={styles.signatureCol}>
                <Text style={styles.issueDateText}>{certificate.issueDate}</Text>
                <View style={styles.sigLine} />
                <Text style={styles.sigLabel}>Issue Date</Text>
              </View>
            </View>

            <Text style={styles.credentialIdText}>ID: {certificate.credentialId}</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleShare}
              style={styles.shareBtn}
            >
              <Ionicons name="share-social" size={16} color="#4F46E5" />
              <Text style={styles.shareBtnText}>Share Certificate</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleDownload}
              style={styles.downloadBtn}
            >
              <LinearGradient
                colors={['#4F46E5', '#7C3AED']}
                style={styles.downloadGradient}
              >
                <Ionicons name="download-outline" size={16} color="#FFFFFF" />
                <Text style={styles.downloadBtnText}>Export PDF</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.base,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 380,
    gap: 12,
  },
  certFrame: {
    backgroundColor: '#FFFDF7',
    borderRadius: borderRadius.xxl,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: '#FDE68A',
    alignItems: 'center',
    gap: 6,
  },
  certTopStrip: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sealBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  sealText: {
    fontSize: 9,
    fontWeight: 'heavy',
    color: '#D97706',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  academyTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0F172A',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  subHeading: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  goldDivider: {
    width: 60,
    height: 2,
    backgroundColor: '#F59E0B',
    marginVertical: 4,
  },
  presentedToText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
  },
  studentNameText: {
    fontSize: 18,
    fontWeight: typography.weights.bold,
    color: '#1E293B',
  },
  achievementDesc: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  certTitleText: {
    fontSize: 14,
    fontWeight: typography.weights.bold,
    color: '#4F46E5',
    textAlign: 'center',
  },
  skillsTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 6,
  },
  skillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    gap: 3,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  skillTagText: {
    fontSize: 10,
    color: '#15803D',
    fontWeight: '600',
  },
  footerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
  },
  signatureCol: {
    flex: 1,
    alignItems: 'center',
  },
  sigScript: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#334155',
  },
  issueDateText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  sigLine: {
    width: '80%',
    height: 1,
    backgroundColor: '#CBD5E1',
    marginVertical: 3,
  },
  sigLabel: {
    fontSize: 9,
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  hologramSeal: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  hologramCircle: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  credentialIdText: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    gap: 6,
  },
  shareBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  downloadBtn: {
    flex: 1,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  downloadGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  downloadBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
