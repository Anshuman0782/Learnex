import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';

interface Props {
  /** Shown under the title — say what's missing on this screen. */
  message?: string;
  /** Run before navigating (e.g. close the profile sheet this banner sits in). */
  onBeforeUpgrade?: () => void;
}

/**
 * Shown ONLY to Guest accounts: explains that guests aren't part of XP / ranks
 * and offers the one-tap upgrade to Learner or Mentor. Renders nothing otherwise.
 */
export const GuestUpgradeBanner: React.FC<Props> = ({ message, onBeforeUpgrade }) => {
  const navigation = useNavigation<any>();
  const { selectedRole } = useApp();
  if (selectedRole !== 'Guest') return null;

  return (
    <LinearGradient colors={['#FFF7ED', '#FDF2F8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={styles.icon}>
        <Ionicons name="person-outline" size={20} color="#EA580C" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>You’re a Guest</Text>
        <Text style={styles.text}>
          {message ??
            'You can post, comment and chat. Guests don’t earn XP and aren’t ranked — become a Learner or Mentor to join in.'}
        </Text>
      </View>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          onBeforeUpgrade?.();
          navigation.navigate('RoleSelection');
        }}
        style={styles.btn}
      >
        <Text style={styles.btnText}>Upgrade</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  text: { fontSize: 12, color: '#64748B', lineHeight: 17, marginTop: 2 },
  btn: { backgroundColor: '#EA580C', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  btnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
});
