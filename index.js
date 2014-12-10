var fs = require('fs');
var srcURL = require('source-map-url');
var path = require('path');
var vlq = require('source-map/lib/source-map/base64-vlq');

module.exports = SourceMap;
function SourceMap(opts) {
  if (!this instanceof SourceMap) {
    return new SourceMap(opts);
  }
  this.content = {
    version: 3,
    sources: [],
    sourcesContent: [],
    names: [],
    mappings: ''
  };
  if (opts) {
    if (opts.file) {
      this.content.file = opts.file;
    }
    if (opts.sourceRoot) {
      this.content.sourceRoot = opts.sourceRoot;
    }
  }

  // These correspond to the five fields of each mapping entry. We
  // always track the previously-used values because each new value is
  // relative to the previous.
  this.prevGeneratedColumn = null;
  this.prevSource = null;
  this.prevOriginalLine = null;
  this.prevOriginalColumn = null;
  this.prevName = null;

  // Keep track of what column we're currently outputing in the
  // generated file. Notice that we don't track line though -- line is
  // implicit in  this.content.mappings.
  this.column = 0;
}

SourceMap.prototype.addFile = function(filename, source) {
  var url;

  if (srcURL.existsIn(source)) {
    url = srcURL.getFrom(source);
    source = srcURL.removeFrom(source);
  }

  if (url) {
    this._assimilateExistingMap(url);
  } else {
    this.content.sources.push(filename);
    this.content.sourcesContent.push(source);
    this._generateNewMap(source);
  }

};

// This is useful for things like separates that you're appending to
// your JS file that don't need to have their own source mapping, but
// will alter the line numbering for subsequent files.
SourceMap.prototype.addSpace = function(source) {
  var lineCount = countLines(source);
  if (lineCount === 0) {
    this.column += source.length;
  } else {
    this.column = 0;
    var mappings = this.content.mappings;
    for (var i = 0; i < lineCount; i++) {
      mappings += ';';
    }
    this.content.mappings = mappings;
  }
};

SourceMap.prototype._generateNewMap = function(source) {
  var mappings = this.content.mappings;
  var lineCount = countLines(source);

  mappings += this.relativeEncode('prevGeneratedColumn', this.column);
  mappings += this.relativeEncode('prevSource', this.content.sources.length-1);
  mappings += this.relativeEncode('prevOriginalLine', 0);
  mappings += this.relativeEncode('prevOriginalColumn', 0);

  if (lineCount === 0) {
    // no newline in the source. Keep outputting one big line.
    this.column += source.length;
    mappings += ',';
  } else {
    // end the line
    this.column = 0;
    mappings += ';';
  }

  // For the remainder of the lines (if any), we're just following
  // one-to-one.
  for (var i = 0; i < lineCount-1; i++) {
    mappings += nextLineContinues;
    this.prevOriginalLine++;
  }

  this.content.mappings = mappings;
};

SourceMap.prototype._assimilateExistingMap = function(url) {

};

SourceMap.prototype.toString = function() {
  return JSON.stringify(this.content);
};

SourceMap.prototype.relativeEncode = function(key, value) {
  var prevValue = this[key];
  this[key] = value;
  if (typeof prevValue !== 'undefined') {
    value -= prevValue;
  }
  return vlq.encode(value);
};

function countLines(src) {
  var newlinePattern = /(\r?\n)/g;
  var count = 0;
  while (newlinePattern.exec(src)) {
    count++;
  }
  return count;
}

// Optimized shorthand for saying that the next line in the generated
// output maps to the next line in the input source.
var nextLineContinues = [0,0,1,0].map(vlq.encode).join('') + ';';
