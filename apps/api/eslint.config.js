import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import drizzle from 'eslint-plugin-drizzle'
import { importX } from 'eslint-plugin-import-x'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import eslintConfigPrettier from 'eslint-config-prettier/flat'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      eslintConfigPrettier,
    ],
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
    },
    languageOptions: {
      ecmaVersion: 2020,
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        project: true,
      },
    },
    plugins: {
      drizzle,
      'import-x': importX,
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      ...drizzle.configs.recommended.rules,
      'drizzle/enforce-delete-with-where': [
        'error',
        {
          drizzleObjectName: ['database', 'db'],
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'simple-import-sort/imports': 'warn',
      'simple-import-sort/exports': 'warn',
    },
  },
])
