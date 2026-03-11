import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import prettierConfig from 'eslint-config-prettier';

const optionalConfigs = [
  react.configs.flat?.['jsx-runtime'],
  reactHooks.configs['flat/recommended'],
  reactRefresh.configs.vite,
  jsxA11y.flatConfigs.strict,
].filter(Boolean);

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'test-results',
      'eslint.config.js',
      'playwright.config.ts',
      'e2e/**',
    ],
  },

  // ── Base configs ─────────────────────────────────────────
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // ── React ────────────────────────────────────────────────
  {
    ...react.configs.flat.recommended,
    settings: { react: { version: 'detect' } },
  },
  ...optionalConfigs,

  // ── Prettier (must be last to override conflicting rules) ─
  prettierConfig,

  // ── Project-wide settings ────────────────────────────────
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      // ── Strict custom rules ────────────────────────────
      'no-console': 'warn',
      eqeqeq: ['error', 'always'],
      'no-implicit-coercion': 'error',
      'no-param-reassign': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': ['error', 'always'],
      'prefer-template': 'error',
      curly: ['error', 'all'],

      // ── TypeScript strict rules ────────────────────────
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/strict-boolean-expressions': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true },
      ],

      // ── Import rules ───────────────────────────────────
      'import/no-duplicates': 'error',
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-mutable-exports': 'error',

      // ── Runtime / DX rules ─────────────────────────────
      'react-refresh/only-export-components': 'off',
    },
  },
);
