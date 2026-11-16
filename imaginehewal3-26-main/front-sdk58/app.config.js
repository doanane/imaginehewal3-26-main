module.exports = ({ config }) => {
  
  try {
    require('dotenv').config({ path: '.env.local' });
  } catch (error) {
    
  }

  return {
    ...config,
    expo: {
      ...config.expo,
      name: "HEWAL3",
      slug: "hewal3",
      version: "1.0.0",
      orientation: "portrait",
      icon: "./assets/images/icon.png",
      scheme: "hewal3",
      userInterfaceStyle: "light",
      newArchEnabled: true,
      ios: {
        supportsTablet: true,
        bundleIdentifier: "com.oggskimmer.hewal3",
        infoPlist: {
          ITSAppUsesNonExemptEncryption: false
        }
      },
      android: {
        adaptiveIcon: {
          backgroundColor: "#E6F4FE",
          foregroundImage: "./assets/images/icon.png",
          backgroundImage: "./assets/images/background.png"
        },
        edgeToEdgeEnabled: true,
        predictiveBackGestureEnabled: false
      },
      web: {
        output: "static",
        favicon: "./assets/images/icon.png"
      },
      plugins: [
        "expo-router",
        [
          "@kingstinct/react-native-healthkit",
          {
            NSHealthShareUsageDescription: "HEWAL3 reads your health data to show your activity and vital trends in one place. You choose what to share.",
            NSHealthUpdateUsageDescription: "HEWAL3 only writes health data when you explicitly log it.",
            background: false
          }
        ],
        [
          "expo-splash-screen",
          {
            "image": "./assets/images/logo.png",
            "imageWidth": 260,
            "resizeMode": "contain",
            "backgroundColor": "#ffffff",
            "dark": {
              "backgroundColor": "#000000"
            }
          }
        ],
        "@react-native-community/datetimepicker",
        ["react-native-ble-plx", { isBackgroundEnabled: false, neverForLocation: true, bluetoothAlwaysPermission: "HEWAL3 uses Bluetooth to read heart rate from your watch." }],
        ["expo-notifications", { color: "#AD0023", sounds: ["./assets/sounds/ringtone.wav"] }],
        "expo-audio",
        ["@config-plugins/react-native-webrtc", { cameraPermission: "HEWAL3 uses the camera for video calls with your doctor and caregivers.", microphonePermission: "HEWAL3 uses the microphone for calls with your doctor and caregivers." }],
        "expo-font",
        "expo-image",
        "expo-secure-store",
        "expo-sharing",
        "expo-status-bar",
        "expo-web-browser"
      ],
      experiments: {
        typedRoutes: true,
        reactCompiler: true
      },
      
      extra: {
        geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "",
        azureOpenAiEndpoint: process.env.EXPO_PUBLIC_AZURE_OPENAI_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT || "",
        azureOpenAiKey: process.env.EXPO_PUBLIC_AZURE_OPENAI_KEY || process.env.AZURE_OPENAI_KEY || "",
        azureOpenAiDeployment: process.env.EXPO_PUBLIC_AZURE_OPENAI_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT || "",
        azureOpenAiApiVersion: process.env.EXPO_PUBLIC_AZURE_OPENAI_API_VERSION || process.env.AZURE_OPENAI_API_VERSION || "2025-01-01-preview",
        emergencyNumber: process.env.EXPO_PUBLIC_HEWAL3_EMERGENCY_NUMBER || process.env.HEWAL3_EMERGENCY_NUMBER || "112",
        eas: {
          projectId: "32b1b881-d290-4f33-91c2-acb92a03f31b"
        }
      }
    }
  };
};