// The native layer is replaced by plain host elements (jest.setup.js), so these tests check exactly which props the app's
// own components pass down, without needing a phone or simulator.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.tsx'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  transform: {
    '\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'], caller: { name: 'metro', bundler: 'metro', platform: 'ios' } }],
  },
};
