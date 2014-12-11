var fs = require('fs');
var srcURL = require('source-map-url');
var path = require('path');
var vlq = require('./vlq');
var RSVP = require('rsvp');
var mkdirp = require('mkdirp');
var util = require('./util');

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

  mappings += this._relativeEncode('prevGeneratedColumn', this.column);
  mappings += this._relativeEncode('prevSource', this.content.sources.length-1);
  mappings += this._relativeEncode('prevOriginalLine', 0);
  mappings += this._relativeEncode('prevOriginalColumn', 0);

  if (lineCount === 0) {
    // no newline in the source. Keep outputting one big line.
    this.column += source.length;
    mappings += ',';
  } else {
    // end the line
    this.column = 0;
    this.prevGeneratedColumn = null;
    mappings += ';';
  }

  // For the remainder of the lines (if any), we're just following
  // one-to-one.
  for (var i = 0; i < lineCount-1; i++) {
    mappings += 'AACA;';
    this.prevOriginalLine++;
  }

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
  var pattern = /((?:AACA;)+)|(?:([^;,]+)([;,])?)/g;
  var match;
  var mappings = this.content.mappings;
  var firstTime = true;

  while (match = pattern.exec(srcMap.mappings)) {
    if (match[1]) {
      // Fast path: we got a string of AACA, meaning lines continue to
      // map one-to-one.
      mappings += match[1];
      this.prevOriginalLine += match[1].length / 5;
      continue;
    }
    var value = decode(match[2]);
    if (!firstTime) {
      value = this._relativize(value);
    } else {
      firstTime = false;
    }

    mappings += this._relativeEncode('prevGeneratedColumn', this.column + value.generatedColumn);
    this.column = 0;

    if (value.hasOwnProperty('source')) {
      mappings += this._relativeEncode('prevSource', value.source + sourcesOffset);
      sourcesOffset = 0;
    }
    if (value.hasOwnProperty('originalLine')) {
      mappings += this._relativeEncode('prevOriginalLine', value.originalLine);
    }
    if (value.hasOwnProperty('originalColumn')) {
      mappings += this._relativeEncode('prevOriginalColumn', value.originalColumn);
    }
    if (value.hasOwnProperty('name')) {
      mappings += this._relativeEncode('prevName', value.name + namesOffset);
      namesOffset = 0;
    }
    if (match[3] === ';') {
      mappings += ';';
      this.prevGeneratedColumn = null;
    }
    if (match[3] === ',') {
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

SourceMap.prototype._relativeEncode = function(key, value) {
  var prevValue = this[key];
  this[key] = value;
  if (typeof prevValue !== 'undefined') {
    value -= prevValue;
  }
  return vlq.encode(value);
};

SourceMap.prototype._relativize = function(value) {
  var output = {};
  var fields = ['generatedColumn', 'source', 'originalLine', 'originalColumn', 'name'];
  for (var i=0; i<fields.length;i++) {
    var field = fields[i];
    var prevField = 'prev' + capitalize(field);
    if (value.hasOwnProperty(field)) {
      output[field] = value[field];
      if (typeof this[prevField] !== 'undefined') {
        output[field] += this[prevField];
      }
    }
  }
  return output;
};

function capitalize(word) {
  return word.slice(0,1).toUpperCase() + word.slice(1);
}

function decode(mapping) {
  var buf = {rest: mapping};
  var output = {};
  var fields = ['generatedColumn', 'source', 'originalLine', 'originalColumn', 'name'];
  var fieldIndex = 0;
  while (fieldIndex < fields.length && buf.rest.length > 0) {
    vlq.decode(buf.rest, buf);
    output[fields[fieldIndex]] = buf.value;
    fieldIndex++;
  }
  return output;
}
