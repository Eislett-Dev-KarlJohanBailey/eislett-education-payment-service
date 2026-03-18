/** @type {import('jest').Config} */
module.exports = {
  displayName: "e2e",
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests/e2e"],
  testMatch: ["**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  clearMocks: true,
  setupFiles: ["<rootDir>/tests/setup/localstack.setup.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup/mock-console.ts"],
  testTimeout: 60000,
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.base.json" }],
  },
  moduleNameMapper: {
    "^@libs/domain$": "<rootDir>/libs/domain/src/index.ts",
    "^@libs/domain/(.*)$": "<rootDir>/libs/domain/src/$1",
  },
};
