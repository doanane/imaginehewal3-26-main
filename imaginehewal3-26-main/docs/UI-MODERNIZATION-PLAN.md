# HEWAL3 UI/UX Modernization Plan

Modernize the HEWAL3 React Native / Expo frontend to achieve a premium, high-class production look.

---

## Theme System (✅ COMPLETED)

Centralized theme file (`constants/theme.ts`) with:

- **COLORS**: Brand red palette, semantic colors, surfaces, text hierarchy
- **SPACING**: Consistent scale (xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48)
- **SHADOWS**: Small, medium, large presets
- **LAYOUT**: Border radius scale, max content width (480px)
- **TYPOGRAPHY**: h1, h2, h3, body, caption, small, label, button styles
- **GRADIENTS**: Auth background gradients, primary gradients
- **CONFIG**: Feature flags (ENABLE_MOBILE_VIEW_ON_WEB)

---

## Completed Screens ✅

### Auth Screens (7 files)

- [x] `(auth)/login.tsx` - LinearGradient + theme
- [x] `(auth)/signup.tsx` - LinearGradient + theme
- [x] `(auth)/forgot-password.tsx`
- [x] `(auth)/reset-password.tsx`
- [x] `(auth)/change-password.tsx`
- [x] `(auth)/verify-email.tsx`
- [x] `(auth)/otp-login.tsx`

### Landing/Onboarding (2 files)

- [x] `index.tsx` - LinearGradient, carousel, theme typography
- [x] `onboarding.tsx` - Role selection with theme styling

### Root Layout

- [x] `_layout.tsx` - Web mobile view restriction (480px), theme integration

### Caregiver Screens (4 files)

- [x] `(caregiver)/caregiver-home.tsx` - Full theme integration
- [x] `(caregiver)/messaging.tsx` - Full theme integration
- [x] `(caregiver)/patient-detail.tsx` - Full theme integration
- [x] `(caregiver)/verify.tsx` - Full theme integration
- [x] `(caregiver)/_layout.tsx` - Stack navigation layout (NEW)

### Patient Screens

| Screen                        | Status     |
| ----------------------------- | ---------- |
| `(patient)/home.tsx`          | ✅ Done    |
| `(patient)/profile.tsx`       | 🟡 Partial |
| `(patient)/settings.tsx`      | 🟡 Partial |
| `(patient)/notifications.tsx` | ✅ Done    |
| `(patient)/dashboard.tsx`     | 🟡 Partial |
| `(patient)/chat.tsx`          | ✅ Done    |
| `(patient)/action-menu.tsx`   | ✅ Done    |
| `(patient)/_layout.tsx`       | ✅ Done    |

### Nutrition Screens (✅ COMPLETED)

| Screen                       | Status                        |
| ---------------------------- | ----------------------------- |
| `nutrition/_layout.tsx`      | ✅ Done                       |
| `nutrition/index.tsx`        | ✅ Done                       |
| `nutrition/scan-food.tsx`    | ✅ Done (NEW: CameraView API) |
| `nutrition/food-log.tsx`     | ✅ Done                       |
| `nutrition/food-details.tsx` | ✅ Done                       |
| `nutrition/log-food.tsx`     | ✅ Done                       |
| `nutrition/log-water.tsx`    | ✅ Done                       |
| `nutrition/goals.tsx`        | ✅ Done                       |

---

## Recent Updates (Jan 2026)

### Health Score Card Enhancement

- Replaced static circular progress with dynamic `react-native-svg` based `CircularProgress` component
- Progress ring now fills based on actual health score percentage
- Color-coded: green (80+), orange (50-79), red (<50)

### Bottom Navigation "Add" Button

- Updated to blue gradient background (`gradientStart` → `gradientEnd`)
- Positioned to overlap bottom navigation (50-50 split effect)
- Removed label text for cleaner look

### Camera API Migration (expo-camera v17)

- Migrated from deprecated `Camera` + `CameraType` to new `CameraView` + `useCameraPermissions`
- Fixed router undefined errors caused by deprecated API

### Layout Structure Fixes

- Added missing `_layout.tsx` files:
  - `(caregiver)/_layout.tsx`
  - `(patient)/nutrition/_layout.tsx`
- Removed non-existent routes from `(patient)/_layout.tsx`

### Icon Warning Fixes

- Added `footsteps` and `aperture` cases to `getCategoryIcon` functions
- Icons now correctly use `Ionicons` instead of falling back to `MaterialCommunityIcons`

---

## Remaining Work 🔄

### Patient Subdirectories

| Directory          | Status     |
| ------------------ | ---------- |
| `health/` screens  | 🟡 Partial |
| `fitness/` screens | 🟡 Partial |

---

## How to Apply Theme

1. **Import theme**: `import { theme } from '../../constants/theme';`

2. **Replace colors**: `backgroundColor: theme.COLORS.background`

3. **Use spacing**: `padding: theme.SPACING.md, marginTop: theme.SPACING.lg`

4. **Apply shadows**: `...theme.SHADOWS.medium`

5. **Use typography**: `...theme.TYPOGRAPHY.h2`

---

## Verification Checklist

- [x] All colors use `theme.COLORS.*`
- [x] All spacing uses `theme.SPACING.*`
- [x] Cards have shadows from `theme.SHADOWS.*`
- [x] Typography uses `theme.TYPOGRAPHY.*`
- [x] No console errors on `npm run dev`
- [x] Layout files exist for all route groups
- [x] Icon names are valid for their respective icon families
