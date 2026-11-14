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
      userInterfaceStyle: "automatic",
      newArchEnabled: true,
      ios: {
        supportsTablet: true
      },
      android: {
        adaptiveIcon: {
          backgroundColor: "#E6F4FE",
          foregroundImage: "./assets/images/android-icon-foreground.png",
          backgroundImage: "./assets/images/android-icon-background.png",
          monochromeImage: "./assets/images/android-icon-monochrome.png"
        },
        edgeToEdgeEnabled: true,
        predictiveBackGestureEnabled: false
      },
      web: {
        output: "static",
        favicon: "./assets/images/favicon.png"
      },
      plugins: [
        "expo-router",
        [
          "expo-splash-screen",
          {
            "image": "./assets/images/splash-icon.png",
            "imageWidth": 200,
            "resizeMode": "contain",
            "backgroundColor": "#ffffff",
            "dark": {
              "backgroundColor": "#000000"
            }
          }
        ],
        "@react-native-community/datetimepicker"
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
        emergencyNumber: process.env.EXPO_PUBLIC_HEWAL3_EMERGENCY_NUMBER || process.env.HEWAL3_EMERGENCY_NUMBER || "112"
      }
    }
  };
};