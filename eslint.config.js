import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-globals': [
        'error',
        { name: 'alert', message: 'Use toast.error() from components/ui/toastStore.' },
        { name: 'confirm', message: 'Use useConfirm() from components/ui/ConfirmDialog.' },
      ],
    },
  },
  {
    // lib/ must stay framework-free so it is testable without a DOM renderer.
    files: ['src/lib/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['react', 'react-dom', 'react/*'] }],
    },
  },
);
