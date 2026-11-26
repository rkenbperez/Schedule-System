import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // This file is a browser-driven integration helper imported by
    // EngineTestPage, not a Vitest suite.
    exclude: ['src/engine/generate.integration.test.ts'],
  },
});
