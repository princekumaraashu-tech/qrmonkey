import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        home: resolve(__dirname, 'home.html'),
        view: resolve(__dirname, 'view.html'),
        scan: resolve(__dirname, 'scan.html')
      }
    }
  }
});
