module.exports = {
  root: true,
  extends: ['eslint:recommended', 'plugin:react/recommended','@react-native-community', 'prettier'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  env: {
    browser: true,
    node: true,
    es6: true,
  },
  rules: {
    'no-unused-vars': 'warn',
    'react/prop-types': 'off',
    'no-console': 'off',
  },
};
