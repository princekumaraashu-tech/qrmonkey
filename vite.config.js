import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        home: resolve(__dirname, 'home.html'),
        view: resolve(__dirname, 'view.html'),
        scan: resolve(__dirname, 'scan.html'),
        terms: resolve(__dirname, 'terms.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        refund: resolve(__dirname, 'refund.html'),
        contact: resolve(__dirname, 'contact.html')
      }
    }
  }
});
