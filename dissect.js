var fs = require('fs');
var src = fs.readFileSync('test/tmp/final.js', 'utf-8');
var map = JSON.parse(fs.readFileSync('test/tmp/final.map', 'utf-8'));
var Coder = require('./coder');
var padding = 80;

var lines = src.split(/\n\r?/);
var mappings = map.mappings.split(';');
var splitContents = map.sourcesContent.map(function(src){return src.split(/\n\r?/);});
var decoder = new Coder();

function padUpTo(str, padding) {
  var extra = padding - str.length;
  while (extra > 0) {
    extra--;
    str += ' ';
  }
  if (str.length > padding) {
    str = str.slice(0, padding-3) + '...';
  }
  return str;
}

for (var i=0; i<lines.length;i++) {
  var value = decoder.decode(mappings[i]);

  var fileDesc = '';
  var origLine = '';

  if (value.hasOwnProperty('source')) {
    fileDesc += map.sources[value.source];
  }
  if (value.hasOwnProperty('originalLine')) {
    fileDesc += ':' + value.originalLine;
    origLine = splitContents[value.source][value.originalLine];
  }

  console.log([
    padUpTo(fileDesc, padding),
    padUpTo(origLine, padding),
    ' | ',
    padUpTo(lines[i], padding)
  ].join(''));
  if (i % 20 === 0) {
    var sep = '';
    for (var col=0; col<padding*3;col++){
      sep += '-';
    }
    console.log(sep);
  }
}
