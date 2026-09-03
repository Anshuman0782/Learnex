import { TextStyle } from 'react-native';

export const typography = {
  sizes: {
    xs: 11,
    sm: 13,
    md: 14,
    base: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    display: 28,
    hero: 32,
  },
  weights: {
    regular: '400' as TextStyle['fontWeight'],
    medium: '500' as TextStyle['fontWeight'],
    semiBold: '600' as TextStyle['fontWeight'],
    bold: '700' as TextStyle['fontWeight'],
    heavy: '800' as TextStyle['fontWeight'],
  },
  lineHeights: {
    xs: 14,
    sm: 18,
    md: 20,
    base: 24,
    lg: 26,
    xl: 28,
    xxl: 32,
    display: 36,
    hero: 40,
  }
};
