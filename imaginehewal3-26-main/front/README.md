# HEWAL3 - Frontend

A comprehensive health tracking mobile application built with React Native and Expo for the Imagine Cup 2026 competition.

## Overview

HEWAL3 is a smart health tracking application designed to help users manage their chronic conditions, monitor their nutrition, track fitness activities, and receive AI-powered health insights.

## Key Features

### Food Logging & AI Analysis

- **Camera-based food scanning** - Take a photo or upload from gallery
- **AI-powered meal analysis** - Automatic food detection using Azure AI Vision
- **Nutritional insights** - Detailed breakdown of calories, macros, and health scores
- **Personalized recommendations** - Based on chronic conditions and health profile
- **Manual entry fallback** - Traditional form-based food logging

### Health Tracking

- Blood pressure monitoring
- Blood glucose tracking
- Medication reminders
- Health metrics visualization

### Fitness & Wellness

- Step counter integration
- Workout tracking
- Water intake monitoring
- Activity goals and progress

### AI Assistant

- Health-focused chatbot
- Emergency detection
- Personalized health tips
- Chronic condition guidance

### User Management

- Patient and caregiver roles
- Profile customization
- Chronic condition profiles
- Secure authentication with JWT

## Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Navigation**: Expo Router (file-based routing)
- **State Management**: React Context API
- **Storage**: AsyncStorage
- **Image Handling**: expo-image-picker
- **UI Components**: Custom components with Ionicons
- **API Integration**: REST API (FastAPI backend)

## Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd front
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment**
   Create a `.env` file in the root directory
   Example of variable: front\.env.example

4. **Start the development server**

```bash
npm run dev
```

## Project Structure

```
front/
├── app/                          # Main application screens
│   ├── (auth)/                   # Authentication screens
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   └── forgot-password.tsx
│   ├── (patient)/                # Patient-specific screens
│   │   ├── dashboard.tsx
│   │   ├── home.tsx
│   │   ├── health/
│   │   │   ├── food-log.tsx     # Main food logging (Route: /health/food-log)
│   │   │   ├── log-health.tsx
│   │   │   └── index.tsx
│   │   ├── fitness/
│   │   ├── nutrition/
│   │   │   ├── index.tsx
│   │   │   ├── goals.tsx
│   │   │   └── log-water.tsx
│   │   ├── ai-chat.tsx
│   │   └── ...
│   ├── (caregiver)/              # Caregiver-specific screens
│   ├── index.tsx                 # App entry point
│   └── onboarding.tsx
├── components/                    # Reusable UI components
├── contexts/                      # React Context providers
│   ├── AuthContext.tsx
│   ├── NutritionContext.tsx
│   └── ToastContext.tsx
├── services/                      # API and external services
│   ├── api.ts                    # Main API client
│   └── chatbot.ts
├── assets/                        # Images, fonts, etc.
└── package.json
```

## Key Routes

- `/` - Onboarding/Landing
- `/login` - User authentication
- `/signup` - User registration
- `/health/food-log` - Food logging with AI analysis
- `/dashboard` - Patient dashboard
- `/home` - Patient home screen
- `/ai-chat` - AI health assistant

## Design System

### Color Palette

- **Primary**: `#AD0023` (Crimson red)
- **Success**: `#28a745` (Green)
- **Info**: `#007bff` (Blue)
- **Background**: `#F8F9FA` (Light gray)
- **Text**: `#333` (Dark gray)

### Typography

- **Headings**: Bold, weight 700
- **Body**: Regular, weight 400-600
- **Labels**: Semi-bold, weight 600

### Web Mobile View Restriction

On web platforms, the app is restricted to a mobile viewport (max 480px centered) for a consistent mobile-first experience. To toggle this off:

1. Open `constants/theme.ts`
2. Find the `CONFIG` object at the top
3. Set `ENABLE_MOBILE_VIEW_ON_WEB: false`

```typescript
export const CONFIG = {
  ENABLE_MOBILE_VIEW_ON_WEB: false, // Set to false for full-width web view
};
```

## Configuration

### API Integration

The app connects to the HEWAL3 backend API:

- **Base URL**: `https://hewal3-backend-api-aya3dzgefte4b3c3.southafricanorth-01.azurewebsites.net`
- **Authentication**: JWT tokens stored in AsyncStorage
- **Endpoints**: See `/services/api.ts` for full API documentation

### Image Picker Configuration

- **Formats**: JPEG, PNG, GIF
- **Quality**: 0.5 (50% compression)
- **Aspect Ratio**: 4:3 (for food photos)
- **Max Size**: 10MB

## Development

### Running the App

```bash
# Start Expo dev server
npm run dev

# Start on specific platform
npm run android
npm run ios
npm run web
```

### Code Quality

```bash
# Type checking
npx tsc --noEmit

# Linting (if configured)
npm run lint
```

## Recent Updates

### Food Logging Feature (v1.0)

- Added AI-powered food analysis using Azure AI Vision and OpenAI
- Implemented camera and gallery image selection
- Created analysis result modal with nutritional breakdown
- Added diet score calculation based on user health profile
- Integrated personalized recommendations for chronic conditions
- Maintained original design with #AD0023 color scheme

### File Consolidation

- Removed duplicate `nutrition/log-food.tsx`
- Consolidated to single source: `health/food-log.tsx`
- Added route comments for clarity

## Known Issues

- GEMINI_API_KEY warning (can be ignored - chatbot uses backend API)
- Shadow property deprecation warnings on web platform

## Contributing

This is an Imagine Cup 2026 competition project. For questions or contributions, please contact the development team.

## License

[Add license information here]

## Team

HEWAL3 Development Team - Imagine Cup 2026

---

**Note**: This app requires a running instance of the HEWAL3 backend API. See the backend repository for setup instructions.
