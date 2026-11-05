import js from '@eslint/js';
import ts from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.astro/**',
      'docs/**',
      'references/**',
      'test-results/**',
      'playwright-report/**',
      'reports/**',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...astro.configs.recommended,
  {
    files: ['**/*.mjs', '**/*.ts', '**/*.astro'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
  {
    files: ['src/scripts/**/*.ts', 'tests/e2e/**/*.ts'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        matchMedia: 'readonly',
        requestAnimationFrame: 'readonly',
        IntersectionObserver: 'readonly',
        HTMLElement: 'readonly',
        HTMLButtonElement: 'readonly',
        SVGElement: 'readonly',
        MediaQueryListEvent: 'readonly',
      },
    },
  },
];
