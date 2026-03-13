/** @type {import('jest').Config} */
module.exports = {
  displayName: "integration",
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests/integration"],
  testMatch: ["**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  clearMocks: true,
  setupFiles: ["<rootDir>/tests/setup/localstack.setup.ts"],
  testTimeout: 30000,
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.base.json" }],
  },
  moduleNameMapper: {
    "^@libs/domain$": "<rootDir>/libs/domain/src/index.ts",
    "^@libs/domain/(.*)$": "<rootDir>/libs/domain/src/$1",
  },
};
