import { Platform } from 'react-native';

export const c = {
  bg: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#FBFBFC',
  ink: '#101214',
  inkSoft: '#3D424A',
  muted: '#7B818A',
  faint: '#A8AEB7',
  line: '#ECEEF1',
  soft: '#F1F2F4',
  softPressed: '#E6E8EC',
  primary: '#006FEE',
  primaryPressed: '#005BC4',
  primarySoft: '#E7F1FF',
  success: '#17C964',
  successSoft: '#E7FAF0',
  successInk: '#0B7A42',
  warning: '#F5A524',
  warningSoft: '#FFF3DF',
  warningInk: '#9A5B00',
  danger: '#F31260',
  dangerSoft: '#FDE8EF',
  dangerInk: '#B00043',
  purple: '#9353D3',
  purpleSoft: '#F3E9FF',
  cyan: '#06B7DB',
  cyanSoft: '#E7FAFD',
  orange: '#F97316',
  orangeSoft: '#FFF0E5',
  indigo: '#4F5BD5',
  indigoSoft: '#ECEEFF',
  white: '#FFFFFF',
  overlay: 'rgba(16, 18, 20, 0.38)'
} as const;

export const radius = {
  xl: 28,
  lg: 24,
  md: 18,
  sm: 13,
  pill: 999
} as const;

export const font = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold'
} as const;

export const shadow = {
  card: Platform.select({
    ios: {
      shadowColor: '#0B1220',
      shadowOpacity: 0.04,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 }
    },
    android: { elevation: 1 },
    default: {}
  }),
  floating: Platform.select({
    ios: {
      shadowColor: '#0B1220',
      shadowOpacity: 0.12,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 10 }
    },
    android: { elevation: 10 },
    default: {}
  }),
  sheet: Platform.select({
    ios: {
      shadowColor: '#0B1220',
      shadowOpacity: 0.16,
      shadowRadius: 32,
      shadowOffset: { width: 0, height: -8 }
    },
    android: { elevation: 18 },
    default: {}
  })
} as const;

export const questPalette: Record<string, { color: string; soft: string }> = {
  wake: { color: c.warning, soft: c.warningSoft },
  gym: { color: c.danger, soft: c.dangerSoft },
  breakfast: { color: c.orange, soft: c.orangeSoft },
  lunch: { color: c.success, soft: c.successSoft },
  dinner: { color: c.purple, soft: c.purpleSoft },
  sleep: { color: c.indigo, soft: c.indigoSoft },
  default: { color: c.primary, soft: c.primarySoft }
};

export const mealPalette: Record<string, { color: string; soft: string }> = {
  breakfast: { color: c.orange, soft: c.orangeSoft },
  lunch: { color: c.success, soft: c.successSoft },
  dinner: { color: c.purple, soft: c.purpleSoft },
  snack: { color: c.cyan, soft: c.cyanSoft }
};

export const tierPalette = {
  full_clear: { color: c.success, soft: c.successSoft },
  solid: { color: c.primary, soft: c.primarySoft },
  partial: { color: c.warning, soft: c.warningSoft },
  missed: { color: c.danger, soft: c.dangerSoft }
} as const;
