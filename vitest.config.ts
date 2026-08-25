import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    include: ['builds/thelma/tests/unit/**/*.test.ts'],
    environment: 'node',
    reporters: ['default', ['json', { outputFile: 'builds/thelma/tests/test-results/unit.json' }]],
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
