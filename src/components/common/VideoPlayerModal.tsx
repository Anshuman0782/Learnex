import React, { useEffect } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface VideoPlayerModalProps {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
}

/**
 * A single, app-level fullscreen player (mounted once, like the dialog) so the
 * feed doesn't spin up a video player per card. Plays real uploaded clips.
 */
export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ visible, uri, onClose }) => {
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(uri ?? null, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    if (visible && uri) {
      player.play();
    } else {
      player.pause();
    }
  }, [visible, uri, player]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingBottom: insets.bottom }]}>
        <TouchableOpacity activeOpacity={0.8} onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <VideoView
          player={player}
          style={styles.video}
          nativeControls
          contentFit="contain"
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 28,
    right: 18,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
