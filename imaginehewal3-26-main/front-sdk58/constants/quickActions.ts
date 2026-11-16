import type { IconName } from '../components/ui';

export const QUICK: { label: string; icon: IconName; gradient: [string, string]; bg: string; fg: string; path: string }[] = [
  { label: 'Scan meal', gradient: ['#17724A', '#1F9A63'], icon: 'scan-outline', bg: '#E3F4EA', fg: '#17724A', path: '/(patient)/nutrition/meal' },
  { label: 'Log reading', gradient: ['#B42318', '#D8453A'], icon: 'heart-outline', bg: '#FDECEA', fg: '#B42318', path: '/(patient)/health/log-health' },
  { label: 'Log water', gradient: ['#0A7C99', '#1196B8'], icon: 'water-outline', bg: '#DDF1F7', fg: '#0A7C99', path: '/(patient)/nutrition/log-water' },
  { label: 'Start activity', gradient: ['#B45309', '#D9701A'], icon: 'walk-outline', bg: '#FFF0DA', fg: '#B45309', path: '/(patient)/activity/live' },
  { label: 'Ask assistant', gradient: ['#5B4BB7', '#7767D9'], icon: 'sparkles-outline', bg: '#EFE9FB', fg: '#5B4BB7', path: '/(patient)/(tabs)/assistant' },
  { label: 'Message team', gradient: ['#1D4ED8', '#3B72EE'], icon: 'chatbubbles-outline', bg: '#FDECEA', fg: '#B42318', path: '/(patient)/messages' },
];
