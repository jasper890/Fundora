import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        app: resolve(projectRoot, 'index.html'),
        preview: resolve(projectRoot, 'preview.html'),
      },
    },
  },
});
