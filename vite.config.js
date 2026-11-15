import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 3000,
    watch: {
      ignored: [
        '**/dist-app/**',
        '**/dist-exe/**',
        '**/*.asar',
        '**/*.tmp',
        '**/*.vpk'
      ]
    }
  }
});
