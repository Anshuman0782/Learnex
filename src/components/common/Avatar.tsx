import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography } from '../../theme';

interface AvatarProps {
  uri?: string;
  name?: string;
  size?: number;
  showRing?: boolean;
  showOnlineDot?: boolean;
  style?: ViewStyle;
}

export const Avatar: React.FC<AvatarProps> = ({
  uri,
  name,
  size = 44,
  showRing = false,
  showOnlineDot = false,
  style,
}) => {
  const getInitials = (n?: string) => {
    if (!n) return 'U';
    const parts = n.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  };

  const imageSize = showRing ? size - 6 : size;
  const radius = size / 2;

  // If the remote image fails to load, fall back to initials instead of a blank.
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [uri]);

  const renderContent = () => {
    if (uri && !failed) {
      return (
        <Image
          source={{ uri }}
          onError={() => setFailed(true)}
          style={[
            styles.image,
            { width: imageSize, height: imageSize, borderRadius: imageSize / 2 },
          ]}
        />
      );
    }

    return (
      <View
        style={[
          styles.fallback,
          {
            width: imageSize,
            height: imageSize,
            borderRadius: imageSize / 2,
            backgroundColor: colors.accentPurpleLight,
          },
        ]}
      >
        <Text
          style={[
            styles.initials,
            { fontSize: imageSize * 0.38, color: colors.primary },
          ]}
        >
          {getInitials(name)}
        </Text>
      </View>
    );
  };

  if (showRing) {
    return (
      <View style={[styles.ringContainer, { width: size, height: size }, style]}>
        <LinearGradient
          colors={['#7C3AED', '#5B4DFF', '#38BDF8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.ringGradient, { width: size, height: size, borderRadius: radius }]}
        >
          <View style={[styles.ringInner, { width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }]}>
            {renderContent()}
          </View>
        </LinearGradient>
        {showOnlineDot && <View style={styles.onlineDot} />}
      </View>
    );
  }

  return (
    <View style={[{ width: size, height: size }, style]}>
      {renderContent()}
      {showOnlineDot && <View style={styles.onlineDot} />}
    </View>
  );
};

const styles = StyleSheet.create({
  ringContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  ringInner: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    backgroundColor: '#E2E8F0',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: typography.weights.bold,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
