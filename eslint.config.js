import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.{ts,tsx}'],
        plugins: {
            'react-hooks': reactHooksPlugin,
        },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.webextensions,
                chrome: 'readonly',
            },
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        rules: {
            // Allow unused vars prefixed with _
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            // Prefer const
            'prefer-const': 'warn',
            // Allow explicit any in specific cases (controlled usage)
            '@typescript-eslint/no-explicit-any': 'warn',
            // Enforce hooks rules
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
        },
    },
    {
        ignores: [
            'node_modules/',
            '.output/',
            '.wxt/',
            'dist/',
            'RAW/',
            '*.config.js',
            '*.config.ts',
        ],
    }
);
