import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.js so the app's dev proxy/build are untouched.
// Default env is node (pure util tests); files needing a DOM opt in per-file with
//   // @vitest-environment jsdom
export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        include: ['src/**/*.test.{js,jsx}'],
    },
});
