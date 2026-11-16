import Constants from 'expo-constants';

const getGeminiApiKey = (): string => {
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_GEMINI_API_KEY) {
    return process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  }

  if (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }

  const extra = Constants.expoConfig?.extra || {};
  return typeof extra.geminiApiKey === 'string' ? extra.geminiApiKey : '';
};

const GEMINI_API_KEY = getGeminiApiKey();

export const env = {
  GEMINI_API_KEY,
  
  get EMERGENCY_NUMBER(): string {
    return "112"; 
  }
};


if (typeof __DEV__ !== 'undefined' && __DEV__) {
  console.log('Environment Status:');
  console.log('Gemini API Key found:', !!env.GEMINI_API_KEY);
  if (env.GEMINI_API_KEY) {
    console.log('Key loaded from .env.local ');
    console.log('Key starts with:', env.GEMINI_API_KEY.substring(0, 10) + '...');
  }
}