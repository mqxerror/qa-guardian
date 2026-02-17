import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/__tests__/**/*.ts'],
    exclude: ['node_modules', 'dist'],
    passWithNoTests: false, // Feature #171: Tests are now required - CI should fail if no tests
    testTimeout: 10000,
    hookTimeout: 10000,
    // Run tests sequentially to avoid port conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Feature #BMAD: Coverage configuration baseline
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**', 'src/**/*.test.ts', 'src/**/*.d.ts'],
    },
  },
});
