// This is an implementation of the alternate "Index Map" format for
// sourcemaps. It lets you embed existing sourcemaps together, which
// should be perfect for the concatenation case, assuming browsers
// actually implement this correctly.

var mkdirp = require('mkdirp');
var fs = require('fs');
var path = require('path');
var srcURL = require('source-map-url');
var trivialMap = require('./trivial-map');
var util = require('./util');
var RSVP = require('rsvp');


module.exports = IndexMap;
function IndexMap(opts) {
  if (!this instanceof IndexMap) {
    return new IndexMap(opts);
  }

  if (!opts || !opts.outputFile) {
    throw new Error("Must specify outputFile");
  }
  this.content = {
    version: 3,
    file: opts.file || path.basename(opts.outputFile),
    sections: [],
  };
  this.baseDir = opts.baseDir;
  this.outputFile = opts.outputFile;
  this._initializeStream();
  this.line = 0;
  this.column = 0;
}

IndexMap.prototype._resolveFile = function(filename) {
  if (this.baseDir && filename.slice(0,1) !== '/') {
    filename = path.join(this.baseDir, filename);
  }
  return filename;
};


IndexMap.prototype._initializeStream = function() {
  var filename = this._resolveFile(this.outputFile);
  mkdirp(path.dirname(filename));
  this.stream = fs.createWriteStream(filename);
};

IndexMap.prototype._loadSourceAndMap = function(filename) {
  var source = fs.readFileSync(this._resolveFile(filename), 'utf-8');
  var srcMap;

  if (srcURL.existsIn(source)) {
    var url = srcURL.getFrom(source);
    source = srcURL.removeFrom(source);
    srcMap = fs.readFileSync(
      path.join(path.dirname(this._resolveFile(filename)), url), 'utf8'
    );
    return {map: JSON.parse(srcMap), source: source};
  } else {
    return {map: trivialMap(filename, source), source: source};
  }
};

IndexMap.prototype.addFile = function(filename) {
  var sm = this._loadSourceAndMap(filename);
  this.stream.write(sm.source);
  this.content.sections.push({
    offset: { line: this.line, column: this.column },
    map: sm.map
  });

  var lineCount;
  if (sm.map.hasOwnProperty('x_newlines')) {
    lineCount = sm.map.x_newlines;
  } else {
    lineCount = util.countLines(sm.source);
  }
  this.line += lineCount;
  this._updateColumn(lineCount, sm.source);
};

IndexMap.prototype._updateColumn = function(newLines, source) {
  var overhang = /[^\n]*$/.exec(source)[0].length;
  if (newLines.length === 0) {
    this.column += overhang;
  } else {
    this.column = overhang;
  }
};


// This is useful for things like separators that you're appending to
// your JS file that don't need to have their own source mapping, but
// will alter the line numbering for subsequent files.
IndexMap.prototype.addSpace = function(source) {
  this.stream.write(source);
  var lineCount = util.countLines(source);
  this.line += lineCount;
  this._updateColumn(lineCount, source);
};

IndexMap.prototype.end = function() {
  var filename = this._resolveFile(this.outputFile).replace(/\.js$/, '') + '.map';
  this.stream.write('//# sourceMappingURL=' + path.basename(filename));
  fs.writeFileSync(filename, JSON.stringify(this.content));
  return new RSVP.Promise(function(resolve, reject) {
    this.stream.on('finish', resolve);
    this.stream.on('error', reject);
    this.stream.end();
  }.bind(this));
};
