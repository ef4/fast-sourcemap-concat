module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 2017,
    sourceType: 'module',
  },
  extends: [
    'eslint:recommended',
  ],
  env: {
    es6: true,
    node: true,
  },
  rules: {
    'no-console': 'off',

    'no-var': 'error',
  },
  overrides: [{
    // test files
    files: ['test/**/*.js'],
    env: {
      mocha: true,
    },
  }],
};
