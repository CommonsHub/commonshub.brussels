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
  // Default to node environment for server-side tests
  // React component tests (.tsx) should add @jest-environment jsdom at the top
  testEnvironment: "node",
  testEnvironmentOptions: {
    customExportConditions: ["node"],
  },
}

// next/jest installs its own transformIgnorePatterns, and the list is an OR:
// adding a permissive pattern cannot undo a matching one. So build the config
// first, then replace the patterns outright — nostr-tools and its @noble/@scure
// dependencies are ESM only and have to go through the transform.
module.exports = async () => {
  const config = await createJestConfig(customJestConfig)()
  config.transformIgnorePatterns = [
    "^.+\\.module\\.(css|sass|scss)$",
    "/node_modules/(?!(next-auth|nostr-tools|@noble|@scure)/)",
  ]
  return config
}
