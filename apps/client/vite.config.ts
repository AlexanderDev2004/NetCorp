import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@netcorp/sim': fileURLToPath(new URL('../../packages/sim/src/index.ts', import.meta.url)),
      '@netcorp/data': fileURLToPath(new URL('../../packages/data/src/index.ts', import.meta.url)),
    },
  },
});
