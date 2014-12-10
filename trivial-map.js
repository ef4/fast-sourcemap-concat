// This builds a trivial sourcemap that just maps every line
// one-to-one. Which seems not-useful, until you realize you can embed
// it into an Index Map.

var util = require('./util');

module.exports = function(filename, source) {
  var mappings = 'AAAA';
  var lineCount = util.countLines(source);
  var srcMap = {
    version: 3,
    sources: [filename],
    sourcesContent: [source],
    x_newlines: lineCount
  };

  if (lineCount === 0) {
    mappings += ',';
  } else {
    mappings += ';';
  }

  for (var i = 0; i<lineCount-1;i++) {
    mappings += util.nextLineContinues;
  }
  srcMap.mappings = mappings;
  return srcMap;
};
