import { Platform, ViewStyle } from 'react-native';

export const shadows = {
  none: {} as ViewStyle,
  soft: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
    },
    android: {
      elevation: 2,
    },
    default: {},
  }) as ViewStyle,
  card: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 14,
    },
    android: {
      elevation: 3,
    },
    default: {},
  }) as ViewStyle,
  glow: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#5B4DFF',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 16,
    },
    android: {
      elevation: 6,
    },
    default: {},
  }) as ViewStyle,
  floating: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
    },
    android: {
      elevation: 10,
    },
    default: {},
  }) as ViewStyle,
};
