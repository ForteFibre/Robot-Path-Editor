import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/pwa',
      filename: 'sw.ts',
      injectRegister: false,
      manifest: false,
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false,
      },
      injectManifest: {
        globPatterns: ['**/*.{css,html,ico,js,svg,webmanifest}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    globals: true,
    include: ['src/tests/**/*.test.ts', 'src/tests/**/*.test.tsx'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
