'use strict';

const eslint = require('mocha-eslint');

let paths = [
  'lib',
  'test/**/*.js',
  '!test/actual/**/*.js',
  '!test/expected/**/*.js',
  '!test/fixtures/**/*.js',
];

eslint(paths);
