import type { IconName } from '../components/ui';

export const BEHAVIORS: Record<string, { label: string; short: string; icon: IconName; blurb: string }> = {
  movement: { label: 'Move more', short: 'Movement', icon: 'walk-outline', blurb: 'Build up your daily steps gradually.' },
  nutrition: { label: 'Eat more vegetables and fruit', short: 'Nutrition', icon: 'nutrition-outline', blurb: 'Add servings to meals you already eat.' },
  activity: { label: 'Be active', short: 'Activity', icon: 'body-outline', blurb: 'Minutes of any movement, with or without steps.' },
  sleep: { label: 'Sleep better', short: 'Sleep', icon: 'moon-outline', blurb: 'Reach a healthier, regular sleep time.' },
};

export const BARRIERS: Record<string, string> = {
  time: 'No time', tired: 'Too tired', forgot: 'Forgot', motivation: 'Low motivation', weather: 'Weather',
  access: 'No access', pain_sick: 'Pain or sick', stress: 'Stressed', craving: 'Craving', other: 'Other',
};

export const EMERGENCY_NUMBER = process.env.EXPO_PUBLIC_HEWAL3_EMERGENCY_NUMBER || '112';
