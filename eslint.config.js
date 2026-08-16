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
  // The type-checked tier, not the syntactic one. `recommended` alone cannot see
  // types, so every rule that needs them — floating promises, unnecessary
  // conditions, unsafe `any` flowing through a call — was installed and inert.
  // This is an app whose whole risk surface is unvalidated model JSON.
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      // The 12 `!` assertions this repo used to carry are all gone, so enabling
      // this costs nothing today and is the only thing that stops the next one.
      // In an app whose inputs are model JSON and a user-supplied backup file,
      // "trust me, this is not null" is exactly the assumption that breaks.
      '@typescript-eslint/no-non-null-assertion': 'error',
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
  {
    // Config files are outside the app's tsconfig, so type-aware rules have no
    // program for them.
    files: ['*.config.{js,ts}', 'eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
