/**
 * HEWAL3 Premium + Healthcare Theme System
 * Centralized design tokens for consistent premium healthcare UI/UX
 */

// Configuration flags
export const CONFIG = {
  ENABLE_MOBILE_VIEW_ON_WEB: true,
};

// Background overlay for image backgrounds
export const BACKGROUND_OVERLAY = 'rgba(9, 88, 88, 0.82)';

export const theme = {
  COLORS: {
    /* Clinical teal: calm, trustworthy, accessible (all text pairs meet WCAG AA 4.5:1). */
    primary: '#0B6E6E',
    primaryDark: '#095858',
    primaryLight: '#3E9B98',
    primaryMuted: '#E5F2F1',
    primarySoft: '#E5F2F1',

    gradientStart: '#0B6E6E',
    gradientEnd: '#0E8483',
    gradientOverlay: 'rgba(11, 110, 110, 0.88)',

    /* Semantic: red is reserved for danger and emergencies only. */
    success: '#17724A',
    successDark: '#115C3B',
    successLight: '#E4F4EC',

    warning: '#8A5A00',
    warningDark: '#6E4700',
    warningLight: '#FFF3D6',

    danger: '#B42318',
    dangerDark: '#912018',
    dangerLight: '#FDECEA',

    info: '#1D4ED8',
    infoDark: '#1E40AF',
    infoLight: '#E8EEFD',

    stable: '#17724A',
    critical: '#B42318',
    pending: '#8A5A00',
    offline: '#5F6F82',

    medicalTeal: '#0B6E6E',
    medicalPurple: '#5B4BB7',
    medicalCyan: '#0A7C99',

    /* Surfaces */
    background: '#F4F7FA',
    card: '#FFFFFF',
    cardDark: '#10202F',
    cardGlass: '#FFFFFF',
    cardGlassLight: '#FFFFFF',
    inputBackground: '#FFFFFF',

    /* Text */
    textPrimary: '#10202F',
    textSecondary: '#435468',
    textTertiary: '#5A6B7E',
    textMuted: '#5F6F82',
    textOnPrimary: '#FFFFFF',
    textOnDark: '#FFFFFF',

    /* Lines and overlays */
    border: '#D5DDE6',
    borderLight: '#E8EDF2',
    separator: '#E3E9EF',
    overlay: 'rgba(16, 32, 47, 0.5)',
    overlayLight: 'rgba(16, 32, 47, 0.3)',

    /* Activity rings */
    ringMove: '#B42318',
    ringExercise: '#17724A',
    ringStand: '#0A7C99',

    gradientPrimary: ['#0B6E6E', '#0E8483'] as const,
    gradientSuccess: ['#17724A', '#1E8A5A'] as const,
    gradientWarning: ['#8A5A00', '#A36B00'] as const,
    gradientDanger: ['#B42318', '#C9342A'] as const,
    gradientMedical: ['#0B6E6E', '#0A7C99'] as const,
  },

  /* --------------------------------------------------------------------
   * SPACING
   * -------------------------------------------------------------------- */
  SPACING: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  /* --------------------------------------------------------------------
   * SHADOWS
   * -------------------------------------------------------------------- */
  SHADOWS: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 6,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 24,
      elevation: 12,
    },
    colored: (color: string) => ({
      shadowColor: color,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 8,
    }),
  },

  /* --------------------------------------------------------------------
   * LAYOUT
   * -------------------------------------------------------------------- */
  LAYOUT: {
    borderRadius: {
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      xxl: 32,
      full: 9999,
    },
    maxContentWidth: 480,
    inputHeight: 52,
    buttonHeight: 52,
  },

  /* --------------------------------------------------------------------
   * TYPOGRAPHY
   * -------------------------------------------------------------------- */
  TYPOGRAPHY: {
    h1: { fontSize: 32, fontWeight: '700' as const, lineHeight: 40 },
    h2: { fontSize: 24, fontWeight: '600' as const, lineHeight: 32 },
    h3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
    body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
    bodyMedium: { fontSize: 16, fontWeight: '500' as const, lineHeight: 24 },
    caption: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
    captionMedium: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
    small: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
    label: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
    button: { fontSize: 16, fontWeight: '600' as const },
  },

  /* --------------------------------------------------------------------
   * GLASS MORPHISM
   * -------------------------------------------------------------------- */
  BLUR: {
    intensity: 80,
    tint: 'light' as const,
  },
};

/* ----------------------------------------------------------------------
 * GRADIENT PRESETS (LinearGradient)
 * ---------------------------------------------------------------------- */
export const GRADIENTS = {
  primary: ['#0B6E6E', '#0E8483'] as const,
  primaryDiagonal: ['#0B6E6E', '#0A7C99'] as const,
  header: ['#0B6E6E', '#0E8483'] as const,
  success: ['#17724A', '#1E8A5A'] as const,
  warning: ['#8A5A00', '#A36B00'] as const,
  danger: ['#B42318', '#C9342A'] as const,
  info: ['#1D4ED8', '#2F62E8'] as const,
  medical: ['#0B6E6E', '#0A7C99'] as const,

  premiumHeader: ['#0B6E6E', '#0E8483'] as const,
  authBackground: ['#095858', '#0B6E6E', '#0E8483'] as const,
  card: ['#FFFFFF', '#F4F7FA'] as const,
};

export default theme;
