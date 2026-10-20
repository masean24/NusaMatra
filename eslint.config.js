import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // `integrations/` holds temporary external handoff packages; their host copies under src/ are linted.
    ignores: ['dist', 'coverage', 'playwright-report', 'test-results', '.taste-skill', 'integrations'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked, jsxA11y.flatConfigs.strict],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
      // Lists styled without bullets lose their list role in Safari/VoiceOver unless it is explicit.
      'jsx-a11y/no-redundant-roles': ['error', { ul: ['list'], ol: ['list'] }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*/*', '!@/features/*/index'],
              message: 'Import a feature through its public index, not its internal files.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-*', 'three', '@react-three/*', '@/features/*', '@/components/*'],
              message: 'Domain code stays pure: no UI, rendering or feature imports.',
            },
          ],
        },
      ],
    },
  },
  {
    /*
     * External 3D engine (Gemini handoff, copied per its INTEGRATION-FOR-CLAUDE.md). It is held to
     * the strict TypeScript compiler settings, but not to the host's stylistic lint profile: these
     * rules would force a rewrite of code the engine team owns. Correctness rules stay on.
     */
    files: ['src/features/map-3d/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      // three.js types `Object3D.userData` as `any`.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      // The WebGL scene is built once per mode; theme and callbacks are applied in later effects.
      'react-hooks/exhaustive-deps': 'off',
    },
  },
  {
    files: ['*.config.{js,ts}', 'tests/e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['eslint.config.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
