/* global describe, beforeEach, afterEach, it */
var assert = require('chai').assert;
var SourceMap = require('..');
var RSVP = require('rsvp');
RSVP.on('error', function(err){throw err;});
var mkdirp = require('mkdirp');
var fs = require('fs');

describe('smoketest', function() {
  var initialCwd;

  beforeEach(function() {
    initialCwd = process.cwd();
    process.chdir(__dirname);
    mkdirp('tmp');
  });
  afterEach(function() {
    process.chdir(initialCwd);
  });

  it('should match expected output', function(done) {
    var s = new SourceMap({outputFile: 'tmp/intermediate.js'});
    s.addFile('fixtures/inner/first.js');
    var filler = "'x';";
    s.addSpace(filler);
    s.addFile('fixtures/inner/second.js');

    s.end().then(function(){
      s = new SourceMap({outputFile: 'tmp/intermediate2.js'});
      s.addFile('fixtures/other/fourth.js');
      return s.end();
    }).then(function(){
      s = new SourceMap({outputFile: 'tmp/final.js'});
      s.addFile('tmp/intermediate.js');
      s.addFile('fixtures/other/third.js');
      s.addFile('tmp/intermediate2.js');
      return s.end();
    }).then(function(){
      var expectedJS = fs.readFileSync('expected/final.js', 'utf8');
      var actualJS = fs.readFileSync('tmp/final.js', 'utf8');
      assert.equal(actualJS, expectedJS, 'JS output');

      var expectedMap = fs.readFileSync('expected/final.map', 'utf8');
      var actualMap = fs.readFileSync('tmp/final.map', 'utf8');
      assert.equal(actualMap, expectedMap, 'map output');

      done();
    });
  });

});
