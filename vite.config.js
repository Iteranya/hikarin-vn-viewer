import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'HikarinVN',
      fileName: (format) => `hikarin-vn-viewer.${format}.js`
    }
  }
});