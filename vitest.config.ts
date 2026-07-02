import { defineConfig } from 'vitest/config';

// Tests live in each package's tests/ folder, kept out of src/. §11's
// highest-value targets are the parsers and detection rules — pure functions.
export default defineConfig({
  test: {
    include: ['apps/**/tests/**/*.test.ts', 'packages/**/tests/**/*.test.ts'],
  },
});
