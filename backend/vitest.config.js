import { defineConfig } from 'vitest/config';

// Two tiers:
//  - `test:unit` runs the pure, dependency-free suites (engine selection, SQL translation).
//  - `test` additionally runs the read-only live suite, which self-skips unless
//    DATABASE_URL points at Postgres (it loads backend/.env itself).
export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        include: ['tests/**/*.test.js'],
        testTimeout: 20000,
    },
});
