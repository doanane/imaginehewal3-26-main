/**
 * HEWAL3 Premium + Healthcare Theme System
 * Centralized design tokens for consistent premium healthcare UI/UX
 */

// Configuration flags
export const CONFIG = {
  ENABLE_MOBILE_VIEW_ON_WEB: true,
};

// Background overlay for image backgrounds
export const BACKGROUND_OVERLAY = 'rgba(173, 0, 35, 0.7)';

export const theme = {
  COLORS: {
    /* ------------------------------------------------------------------
     * PRIMARY BRAND (Healthcare Blue – Premium)
     * ------------------------------------------------------------------ */
    primary: '#AD0023',
    primaryDark: '#1A4AE5',
    primaryLight: '#6C8DFF',
    primaryMuted: 'rgba(45, 91, 255, 0.1)',

    /* ------------------------------------------------------------------
     * PREMIUM GRADIENT BASE
     * ------------------------------------------------------------------ */
    gradientStart: '#1E40AF',
    gradientEnd: '#3B82F6',
    gradientOverlay: 'rgba(173, 0, 35, 0.85)',

    /* ------------------------------------------------------------------
     * SEMANTIC COLORS
     * ------------------------------------------------------------------ */
    success: '#10B981',
    successDark: '#059669',
    successLight: 'rgba(16, 185, 129, 0.1)',

    warning: '#F59E0B',
    warningDark: '#D97706',
    warningLight: 'rgba(245, 158, 11, 0.1)',

    danger: '#EF4444',
    dangerDark: '#DC2626',
    dangerLight: 'rgba(239, 68, 68, 0.1)',

    info: '#3B82F6',
    infoDark: '#2563EB',
    infoLight: 'rgba(59, 130, 246, 0.1)',

    /* ------------------------------------------------------------------
     * STATUS STATES
     * ------------------------------------------------------------------ */
    stable: '#10B981',
    critical: '#EF4444',
    pending: '#F59E0B',
    offline: '#9CA3AF',

    /* ------------------------------------------------------------------
     * MEDICAL / HEALTHCARE EXTENSIONS
     * ------------------------------------------------------------------ */
    medicalTeal: '#14B8A6',
    medicalPurple: '#8B5CF6',
    medicalCyan: '#06B6D4',

    /* ------------------------------------------------------------------
     * SURFACES
     * ------------------------------------------------------------------ */
    background: '#F8FAFC',
    card: '#FFFFFF',
    cardDark: '#1E1E1E',
    cardGlass: 'rgba(255, 255, 255, 0.9)',
    cardGlassLight: 'rgba(255, 255, 255, 0.7)',
    inputBackground: '#F1F5F9',

    /* ------------------------------------------------------------------
     * TEXT
     * ------------------------------------------------------------------ */
    textPrimary: '#1E293B',
    textSecondary: '#64748B',
    textTertiary: '#94A3B8',
    textMuted: '#6B7280',
    textOnPrimary: '#FFFFFF',
    textOnDark: '#FFFFFF',

    /* ------------------------------------------------------------------
     * UI ELEMENTS
     * ------------------------------------------------------------------ */
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    separator: '#E5E7EB',
    overlay: 'rgba(0, 0, 0, 0.5)',
    overlayLight: 'rgba(0, 0, 0, 0.3)',

    /* ------------------------------------------------------------------
     * ACTIVITY RINGS (Apple-style)
     * ------------------------------------------------------------------ */
    ringMove: '#FF2D55',
    ringExercise: '#32D74B',
    ringStand: '#5AC8FA',

    /* ------------------------------------------------------------------
     * GRADIENT ARRAYS (INLINE USE)
     * ------------------------------------------------------------------ */
    gradientPrimary: ['#2D5BFF', '#3B82F6'] as const,
    gradientSuccess: ['#10B981', '#34D399'] as const,
    gradientWarning: ['#F59E0B', '#FBBF24'] as const,
    gradientDanger: ['#EF4444', '#F87171'] as const,
    gradientMedical: ['#14B8A6', '#06B6D4'] as const,
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
  primary: ['#AD0023', '#DC2626'] as const,
  primaryDiagonal: ['#1E40AF', '#3B82F6'] as const,
  header: ['#DC2626', '#EF4444'] as const,
  success: ['#10B981', '#34D399'] as const,
  warning: ['#F59E0B', '#FBBF24'] as const,
  danger: ['#EF4444', '#F87171'] as const,
  info: ['#3B82F6', '#60A5FA'] as const,
  medical: ['#14B8A6', '#06B6D4'] as const,

  premiumHeader: ['#DC2626', '#EF4444'] as const,
  authBackground: ['#1E40AF', '#3B82F6', '#60A5FA'] as const,
  card: ['#FFFFFF', '#F8FAFC'] as const,
};

export default theme;
