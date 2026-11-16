
const fs = require('fs');
const path = require('path');

console.log('Setting up HEWAL3 environment...\n');

const envExamplePath = path.join(__dirname, '..', '.env.example');
const envLocalPath = path.join(__dirname, '..', '.env.local');


if (fs.existsSync(envLocalPath)) {
  console.log('.env.local already exists');
  process.exit(0);
}


if (fs.existsSync(envExamplePath)) {
  fs.copyFileSync(envExamplePath, envLocalPath);
  console.log('Created .env.local from .env.example');
  console.log('\n Please edit .env.local with your actual API keys:');
  console.log('   - Get Gemini API key: https://makersuite.google.com/app/apikey');
  console.log('   - Get Azure OpenAI key: https://portal.azure.com');
  console.log('\n Remember: Never commit .env.local to git!\n');
} else {
  console.log('.env.example not found');
  process.exit(1);
}