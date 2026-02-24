module.exports = {
  // Plugins
  plugins: [
    '@typescript-eslint',
    'unicorn',
    'react-hooks',
    'prettier',
    'jsx-a11y',
    'promise',
  ],

  // Parser
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },

  // Settings
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
      },
    },
    react: {
      version: 'detect',
    },
  },

  // Extends
  extends: [
    'plugin:react/recommended',
    'plugin:unicorn/recommended',
    'plugin:prettier/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'plugin:promise/recommended',
  ],

  env: {
    browser: true,
    es2022: true,
    node: true,
  },

  // Rule Overrides
  rules: {
    // Generic JS
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      2,
      {
        vars: 'all',
        args: 'all',
        ignoreRestSiblings: false,
        caughtErrors: 'all',
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
      },
    ],
    'prefer-const': 2,
    'arrow-body-style': [2, 'as-needed'],
    curly: [2, 'multi'],
    'padding-line-between-statements': [
      2,
      { blankLine: 'never', prev: 'import', next: 'import' },
    ],
    'no-useless-concat': 2,
    'prefer-template': 2,

    // unicorn
    'unicorn/no-fn-reference-in-iterator': 0,
    'unicorn/catch-error-name': [2, { name: 'err' }],
    'unicorn/prevent-abbreviations': 'off',
    'unicorn/no-abusive-eslint-disable': 'off',
    'unicorn/number-literal-case': 'off',

    // import (named, default, namespace are handled by TypeScript)
    'import/no-unresolved': 2,
    'import/no-named-as-default': 2,
    'import/no-named-as-default-member': 0,
    'import/no-extraneous-dependencies': 2,
    'import/newline-after-import': 2,
    'import/no-named-default': 2,
    'import/no-useless-path-segments': 2,

    // React
    'react/prefer-stateless-function': 2,
    'react/prop-types': 0,
    'react/forbid-prop-types': 0,
    'react/no-unused-prop-types': 0,
    'react/require-default-props': 0,
    'react/default-props-match-prop-types': 0,
    'react/destructuring-assignment': 0,
    'react/react-in-jsx-scope': 0,

    // hooks
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // a11y
    'jsx-a11y/href-no-hash': 0,

    // prettier
    'prettier/prettier': [
      2,
      {
        semi: false,
        singleQuote: true,
      },
    ],
  },
}
