import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://pratikdeshmukh.co.in',
  output: 'static',
  trailingSlash: 'always',
  build: { inlineStylesheets: 'never' },
  devToolbar: { enabled: false },
  server: { host: '127.0.0.1' },
  vite: { build: { sourcemap: false, assetsInlineLimit: 0 } },
});
