import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'public', 'legacy-src', 'supabase', 'src/tools/*/legacy']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // Lógica migrada desde FormConverterExcel: se mantiene tal cual, sin reescribirla por estilo.
    files: ['src/lib/**/*.js'],
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', args: 'none', caughtErrors: 'none' }],
      'no-prototype-builtins': 'off',
    },
  },
])
