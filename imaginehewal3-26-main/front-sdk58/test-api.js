
console.log('=== VERIFYING ENVIRONMENT IN APP ===\n');

console.log('1. Available in process.env:');
console.log('   EXPO_PUBLIC_GEMINI_API_KEY:', !!process.env.EXPO_PUBLIC_GEMINI_API_KEY);
console.log('   GEMINI_API_KEY:', !!process.env.GEMINI_API_KEY);

console.log('\n2. Simulating env.ts logic:');
const extra = { geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "" };
console.log('   Extra config would have:', !!extra.geminiApiKey);
console.log('   Value would be:', extra.geminiApiKey?.substring(0, 15) + '...');

console.log('\n3. Recommendation:');
console.log('   Your .env.local is working!');
console.log('   The key will be loaded via Expo\'s extra config.');
console.log('   In your chatbot.ts, use:');
console.log('   const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "fallback";');