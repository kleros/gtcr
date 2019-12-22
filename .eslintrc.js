module.exports = {
  // Plugins
  plugins: [
    'unicorn',
    'react-hooks',
    'prettier',
    'jsx-a11y',
    'promise'
  ],

  // Extends
  extends: [
    'react-app', // create-react-app config
    'standard', // JS Standard
    'standard-jsx', // JS Standard JSX
    'plugin:unicorn/recommended', // unicorn
    'plugin:prettier/recommended', // prettier overrides
    'prettier/standard',
    'prettier/react',
    'plugin:jsx-a11y/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:promise/recommended'
  ],

  // Rule Overrides
  rules: {
    // Generic JS
    'no-unused-vars': [
      2,
      {
        vars: 'all',
        args: 'all',
        ignoreRestSiblings: false,
        caughtErrors: 'all',
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_'
      }
    ],
    'prefer-const': 2,
    'arrow-body-style': [2, 'as-needed'],
    'curly': [2, 'multi'],
    'padding-line-between-statements': [
      2,
      { blankLine: 'never', prev: 'import', next: 'import' }
    ],
    'no-useless-concat': 2,
    'prefer-template': 2,

    // unicorn
    'unicorn/no-fn-reference-in-iterator': 0, // Allows [].map(func)
    'unicorn/catch-error-name': [2, { name: 'err' }],
    'unicorn/prevent-abbreviations': 'off',
    'unicorn/no-abusive-eslint-disable': 'off',

    // import
    'import/no-unresolved': 2,
    'import/named': 2,
    'import/default': 2,
    'import/namespace': 2,
    'import/no-named-as-default': 2,
    'import/no-named-as-default-member': 2,
    'import/no-extraneous-dependencies': 2,
    'import/newline-after-import': 2,
    'import/no-named-default': 2,
    'import/no-useless-path-segments': 2,

    // React JSX
    'react/jsx-filename-extension': [
      2,
      {
        extensions: ['.js']
      }
    ],
    'react/jsx-indent': 0,
    'react/jsx-curly-brace-presence': [2, 'never'],

    // React
    'react/prefer-stateless-function': 2,
    'react/destructuring-assignment': [2, 'always'],
    'react/prop-types': 2,
    'react/forbid-prop-types': 2,
    'react/no-unused-prop-types': 2,
    'react/require-default-props': 2,
    'react/default-props-match-prop-types': 2,
    // hooks
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // JS Standard
    'standard/computed-property-even-spacing': 0,
    'jsx-a11y/href-no-hash': 0, // Buggy

    // JSDoc
    'require-jsdoc': [
      2,
      {
        require: {
          FunctionDeclaration: true,
          MethodDefinition: false,
          ClassDeclaration: false,
          ArrowFunctionExpression: false,
          FunctionExpression: false
        }
      }
    ],
    'valid-jsdoc': [
      2,
      {
        prefer: {
          arg: 'param',
          argument: 'param',
          class: 'class',
          return: 'returns',
          virtual: 'abstract'
        },
        preferType: {
          Boolean: 'boolean',
          Number: 'number',
          Object: 'object',
          String: 'string'
        },
        requireReturn: false,
        requireReturnType: true,
        matchDescription: '.+',
        requireParamDescription: true,
        requireReturnDescription: true
      }
    ],

    // prettier
    'prettier/prettier': [
      2,
      {
        semi: false,
        singleQuote: true
      }
    ]
  }
}