var SourceMap = require('..');
var RSVP = require('rsvp');
var mkdirp = require('mkdirp');
RSVP.on('error', function(err){throw err;});

mkdirp('tmp');
var s = new SourceMap({outputFile: 'tmp/intermediate.js'});

s.addFile('fixtures/inner/first.js');
var filler = "'x';";
s.addSpace(filler);

s.addFile('fixtures/inner/second.js');

s.end().then(function(){
  s = new SourceMap({outputFile: 'tmp/final.js'});
  s.addFile('fixtures/other/third.js');
  s.addFile('tmp/intermediate.js');
  return s.end();
}).catch(function(err){throw err;});
