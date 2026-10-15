import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type AttachmentSource = 'gallery' | 'camera' | 'document' | 'audio';

const OPTIONS: { key: AttachmentSource; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: 'document', label: 'Document', icon: 'document-text', color: '#7C3AED' },
  { key: 'camera', label: 'Camera', icon: 'camera', color: '#DB2777' },
  { key: 'gallery', label: 'Gallery', icon: 'images', color: '#4F46E5' },
  { key: 'audio', label: 'Audio', icon: 'headset', color: '#EA580C' },
];

/**
 * WhatsApp-style attachment tray shown above the chat composer. Rendered
 * inline (not as a separate modal) so it never fights the chat's own modal.
 */
export const AttachmentSheet: React.FC<{ onPick: (s: AttachmentSource) => void; onClose: () => void }> = ({
  onPick,
  onClose,
}) => (
  <View style={styles.tray}>
    <View style={styles.row}>
      {OPTIONS.map((o) => (
        <TouchableOpacity
          key={o.key}
          activeOpacity={0.8}
          onPress={() => {
            onClose();
            onPick(o.key);
          }}
          style={styles.item}
          accessibilityLabel={`Attach ${o.label}`}
        >
          <View style={[styles.circle, { backgroundColor: o.color }]}>
            <Ionicons name={o.icon} size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.label}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  tray: {
    marginHorizontal: 12,
    marginBottom: 6,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  item: { alignItems: 'center', gap: 6, width: 72 },
  circle: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '600', color: '#334155' },
});
