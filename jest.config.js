const nextJest = require("next/jest")

const createJestConfig = nextJest({
  dir: "./",
})

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testMatch: ["<rootDir>/tests/**/*.test.ts", "<rootDir>/tests/**/*.test.tsx"],
  testPathIgnorePatterns: ["/node_modules/", "/tests/e2e/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transformIgnorePatterns: [
    // nostr-tools and its @noble/@scure dependencies ship ESM only
    "node_modules/(?!(next-auth|nostr-tools|@noble|@scure)/)",
  ],
  // Default to node environment for server-side tests
  // React component tests (.tsx) should add @jest-environment jsdom at the top
  testEnvironment: "node",
  testEnvironmentOptions: {
    customExportConditions: ["node"],
  },
}

module.exports = createJestConfig(customJestConfig)
