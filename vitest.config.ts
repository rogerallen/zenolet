import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts', 'worker/**/*.js'],
      exclude: ['src/**/*.test.ts', 'src/test/**', 'src/types.ts']
    }
  }
});
