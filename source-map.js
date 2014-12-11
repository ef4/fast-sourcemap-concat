var fs = require('fs');
var srcURL = require('source-map-url');
var path = require('path');
var RSVP = require('rsvp');
var mkdirp = require('mkdirp');
var util = require('./util');
var Coder = require('./coder');

module.exports = SourceMap;
function SourceMap(opts) {
  if (!this instanceof SourceMap) {
    return new SourceMap(opts);
  }
  if (!opts || !opts.outputFile) {
    throw new Error("Must specify outputFile");
  }
  this.baseDir = opts.baseDir;
  this.outputFile = opts.outputFile;
  this._initializeStream();

  this.content = {
    version: 3,
    sources: [],
    sourcesContent: [],
    names: [],
    mappings: ''
  };
  if (opts.sourceRoot) {
    this.content.sourceRoot = opts.sourceRoot;
  }
  this.content.file = opts.file || path.basename(opts.outputFile);
  this.encoder = new Coder();

  // Keep track of what column we're currently outputing in the
  // generated file. Notice that we don't track line though -- line is
  // implicit in  this.content.mappings.
  this.column = 0;
}

SourceMap.prototype._resolveFile = function(filename) {
  if (this.baseDir && filename.slice(0,1) !== '/') {
    filename = path.join(this.baseDir, filename);
  }
  return filename;
};

SourceMap.prototype._initializeStream = function() {
  var filename = this._resolveFile(this.outputFile);
  mkdirp(path.dirname(filename));
  this.stream = fs.createWriteStream(filename);
};


SourceMap.prototype.addFile = function(filename) {
  var url;
  var source = fs.readFileSync(this._resolveFile(filename), 'utf-8');

  if (srcURL.existsIn(source)) {
    url = srcURL.getFrom(source);
    source = srcURL.removeFrom(source);
  }

  this.stream.write(source);

  if (url) {
    this._assimilateExistingMap(filename, url);
  } else {
    this.content.sources.push('/' + filename);
    this.content.sourcesContent.push(source);
    this._generateNewMap(source);
  }
};

// This is useful for things like separators that you're appending to
// your JS file that don't need to have their own source mapping, but
// will alter the line numbering for subsequent files.
SourceMap.prototype.addSpace = function(source) {
  this.stream.write(source);
  if (!this.shouldBuildMap) {
    return;
  }
  var lineCount = util.countLines(source);
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
  var lineCount = util.countLines(source);

  mappings += this.encoder.encode({
    generatedColumn: this.column,
    source: this.content.sources.length-1,
    originalLine: 0,
    originalColumn: 0
  });

  if (lineCount === 0) {
    // no newline in the source. Keep outputting one big line.
    this.column += source.length;
    mappings += ',';
  } else {
    // end the line
    this.column = 0;
    this.encoder.resetColumn();
    mappings += ';';
  }

  // For the remainder of the lines (if any), we're just following
  // one-to-one.
  for (var i = 0; i < lineCount-1; i++) {
    mappings += 'AACA;';
  }
  this.encoder.adjustLine(lineCount-1);

  this.content.mappings = mappings;
};

SourceMap.prototype._assimilateExistingMap = function(filename, url) {
  var srcMap = fs.readFileSync(path.join(path.dirname(this._resolveFile(filename)), url), 'utf8');
  srcMap = JSON.parse(srcMap);
  var content = this.content;
  var sourcesOffset = content.sources.length;
  var namesOffset = content.names.length;

  content.sources = content.sources.concat(srcMap.sources);
  content.sourcesContent = content.sourcesContent.concat(srcMap.sourcesContent);
  content.names = content.names.concat(srcMap.names);

  this._scanMappings(srcMap, sourcesOffset, namesOffset);
};

SourceMap.prototype._scanMappings = function(srcMap, sourcesOffset, namesOffset) {
  var pattern = /([^;,]+)([;,])?/g;
  var match;
  var mappings = this.content.mappings;
  var firstTime = true;
  var decoder = new Coder();

  while (match = pattern.exec(srcMap.mappings)) {
    if (!firstTime && match[0] === 'AACA;') {
      mappings += 'AACA;';
      this.encoder.adjustLine(1);
      continue;
    }
    var value = decoder.decode(match[1]);
    firstTime = false;

    value.generatedColumn += this.column;
    this.column = 0;

    if (value.hasOwnProperty('source')) {
      value.source += sourcesOffset;
      sourcesOffset = 0;
    }
    if (value.hasOwnProperty('name')) {
      value.name += namesOffset;
      namesOffset = 0;
    }
    mappings += this.encoder.encode(value);
    if (match[2] === ';') {
      mappings += ';';
      this.encoder.resetColumn();
    }
    if (match[1] === ',') {
      mappings += ',';
    }

  }
  this.content.mappings = mappings;
};

SourceMap.prototype.end = function() {
  var filename = this._resolveFile(this.outputFile).replace(/\.js$/, '') + '.map';
  this.stream.write('//# sourceMappingURL=' + path.basename(filename));
  fs.writeFileSync(filename, JSON.stringify(this.content));
  return new RSVP.Promise(function(resolve, reject) {
    this.stream.on('finish', resolve);
    this.stream.on('error', reject);
    this.stream.end();
  }.bind(this));
};
