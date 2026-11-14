import Constants from 'expo-constants';


export const env = {
  get GEMINI_API_KEY(): string {
    // 1. First try EXPO_PUBLIC_ prefix (recommended for Expo)
    if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_GEMINI_API_KEY) {
      return process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    }
    
    
    if (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) {
      return process.env.GEMINI_API_KEY;
    }
    
    
    const extra = Constants.expoConfig?.extra || {};
    if (extra.geminiApiKey) {
      return extra.geminiApiKey;
    }
    
    
    console.error('GEMINI_API_KEY not found in environment');
    console.error('   Check your .env.local file');
    console.error('   Make sure it has: EXPO_PUBLIC_GEMINI_API_KEY=your_key_here');
    return "";
  },
  
  get EMERGENCY_NUMBER(): string {
    return "112"; 
  }
};


if (typeof __DEV__ !== 'undefined' && __DEV__) {
  console.log('🔧 Environment Status:');
  console.log('Gemini API Key found:', !!env.GEMINI_API_KEY);
  if (env.GEMINI_API_KEY) {
    console.log('Key loaded from .env.local ');
    console.log('Key starts with:', env.GEMINI_API_KEY.substring(0, 10) + '...');
  } else {
    console.log('NO API KEY FOUND! Check .env.local file');
  }
}