import { defineConfig } from 'vite';

// Runs only under the Firestore emulator:
//   npm run test:rules
// (which wraps: firebase emulators:exec --only firestore --project demo-verity ...)
export default defineConfig({
  test: {
    environment: 'node',
    include: ['rules-tests/**/*.test.js'],
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
