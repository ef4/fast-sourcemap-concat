var SourceMap = require('..');
var RSVP = require('rsvp');
var mkdirp = require('mkdirp');
RSVP.on('error', function(err){throw err;});

mkdirp('tmp');


function once() {

  var s = new SourceMap({outputFile: 'tmp/intermediate.js'});

  s.addFile('fixtures/inner/first.js');
  var filler = "'x';";
  s.addSpace(filler);

  s.addFile('fixtures/inner/second.js');

  return s.end().then(function(){
    s = new SourceMap({outputFile: 'tmp/intermediate2.js'});
    s.addFile('fixtures/other/fourth.js');
    return s.end();
  }).then(function(){
    s = new SourceMap({outputFile: 'tmp/final.js'});
    s.addFile('tmp/intermediate.js');
    s.addFile('fixtures/other/third.js');
    s.addFile('tmp/intermediate2.js');
    return s.end();
  });

}

var remaining = 10;
function loopit() {
  if (remaining === 0){
    return;
  }
  remaining -= 1;
  once().then(loopit);
}

loopit();
