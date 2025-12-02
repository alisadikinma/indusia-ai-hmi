const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

const customJestConfig = {
  // Add setup file
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Use jsdom for testing React components
  testEnvironment: 'jest-environment-jsdom',

  // Module path aliases matching jsconfig.json
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  // Ignore e2e tests (handled by Playwright)
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/e2e/',
  ],

  // Files to collect coverage from
  collectCoverageFrom: [
    'lib/**/*.js',
    'hooks/**/*.js',
    'hooks/**/*.jsx',
    'components/**/*.jsx',
    'context/**/*.jsx',
    'app/api/**/*.js',
    '!**/*.test.js',
    '!**/*.test.jsx',
    '!**/node_modules/**',
    '!**/__fixtures__/**',
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },

  // Transform settings for ES modules
  transformIgnorePatterns: [
    '/node_modules/',
    '^.+\\.module\\.(css|sass|scss)$',
  ],

  // Test timeout
  testTimeout: 10000,

  // Verbose output
  verbose: true,
}

module.exports = createJestConfig(customJestConfig)
