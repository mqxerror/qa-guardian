module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    // Feature #115 & #697: Prevent console.log in production code
    // Use logger utility from utils/logger.ts instead
    'no-console': ['error', { allow: ['warn', 'error'] }],
  },
  overrides: [
    {
      // Logger utility is allowed to use console.log/info (it's the abstraction layer)
      files: ['**/utils/logger.ts'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};
