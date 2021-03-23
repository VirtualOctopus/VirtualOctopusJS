module.exports = {
  transform: {
    '.(js|ts|tsx)': 'ts-jest'
  },
  testTimeout: 30000,
  collectCoverageFrom: [
    'src/**/*',
    '!**/node_modules/**'
  ],
  coveragePathIgnorePatterns: [
    'node_modules/',
    'src/test'
  ],
  testEnvironment: "node",
  testRegex: "/test/.*\\.test\\.ts$",
  moduleFileExtensions: [
    "ts",
    "js",
    "json"
  ],
};
