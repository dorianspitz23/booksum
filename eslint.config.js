import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // `.worktrees/` holds full checkouts created by audit tooling. Without this
  // ignore, eslint lints 13 copies of the codebase and reports every problem
  // once per copy.
  // `audit-reports/` holds findings data and the throwaway Node scripts that
  // analyse it. They are records of the audit, not application source, and the
  // browser globals below do not apply to them.
  { ignores: ['dist', 'node_modules', 'coverage', '.worktrees', 'audit-reports'] },
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
