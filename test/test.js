/* global describe, beforeEach, afterEach, it */
var assert = require('chai').assert;
var expect = require('chai').expect;
var SourceMap = require('..');
var RSVP = require('rsvp');
RSVP.on('error', function(err){throw err;});
var mkdirp = require('mkdirp');
var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');
var sinon = require('sinon');
var EOL = require('os').EOL;

describe('fast sourcemap concat', function() {
  var initialCwd;

  beforeEach(function() {
    initialCwd = process.cwd();
    process.chdir(__dirname);
    mkdirp('tmp');
  });
  afterEach(function() {
    rimraf.sync('tmp');
    process.chdir(initialCwd);
  });

  it('should pass basic smoke test', function() {
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
    }).then(function(){
      expectFile('final.js').in('tmp');
      expectFile('final.map').in('tmp');
    });
  });
  
  it("should not crash if a file is not found", function() {
    var s = new SourceMap({outputFile: 'tmp/bogus.js'});
    var filler = "'x';";
    s.addSpace(filler);
    s.addFile('this_is_a_totally_bogus_file_name.js');
    
    return s.end().then(function(){
      expectFile('bogus.js').in('tmp');
      expectFile('bogus.map').in('tmp');
    });
  });

  it("should support file-less concatenation", function() {
    var s = new SourceMap({file: 'from-inline.js', mapURL: 'from-inline.map'});
    s.addFile('fixtures/other/third.js');
    s.addSpace("/* My First Separator */");
    s.addFile('fixtures/inline-mapped.js');
    s.addSpace("/* My Second */");
    s.addFile('fixtures/other/fourth.js');
    return s.end().then(function(r){
      expect(r).to.be.a('object');
      expect(r.map).to.be.a('object');
      expectFile('from-inline.js', r.code || "empty").in('tmp');
      expectFile('from-inline.map', JSON.stringify(r.map) || "empty").in('tmp');
    });
  });

  it("should accept inline sourcemaps", function() {
    var s = new SourceMap({outputFile: 'tmp/from-inline.js'});
    s.addFile('fixtures/other/third.js');
    s.addSpace("/* My First Separator */");
    s.addFile('fixtures/inline-mapped.js');
    s.addSpace("/* My Second */");
    s.addFile('fixtures/other/fourth.js');
    return s.end().then(function(){
      expectFile('from-inline.js').in('tmp');
      expectFile('from-inline.map').in('tmp');
    });
  });

  it("should allow adding file contents from string", function() {
    var filePath = 'fixtures/other/third.js';
    var contents = fs.readFileSync(filePath, { encoding: 'utf8' });

    var s = new SourceMap({outputFile: 'tmp/from-inline.js'});
    s.addFileSource('fixtures/other/third.js', contents);
    s.addSpace("/* My First Separator */");
    s.addFile('fixtures/inline-mapped.js');
    s.addSpace("/* My Second */");
    s.addFile('fixtures/other/fourth.js');

    return s.end().then(function(){
      expectFile('from-inline.js').in('tmp');
      expectFile('from-inline.map').in('tmp');
    });
  });

  it("should allow adding map contents from string", function() {
    var filePath = 'fixtures/from-string/external-mapped.js';
    var contents = fs.readFileSync(filePath, { encoding: 'utf8' });
    var map = fs.readFileSync(filePath+'-map.map', { encoding: 'utf8' });

    var s = new SourceMap({outputFile: 'tmp/from-string.js'});
    s.addFile('fixtures/other/third.js');
    s.addSpace("/* My First Separator */");
    s.addFileSource('fixtures/external-mapped.js', contents, map);
    s.addSpace("/* My Second */");
    s.addFile('fixtures/other/fourth.js');

    return s.end().then(function(){
      expectFile('from-string.js').in('tmp');
      expectFile('from-string.map').in('tmp');
    });
  });

  it("should correctly concatenate a sourcemapped coffeescript example", function() {
    var s = new SourceMap({outputFile: 'tmp/coffee-example.js'});
    s.addFile('fixtures/coffee/aa-loader.js');
    s.addFile('fixtures/coffee/rewriter.js');
    s.addSpace("/* My First Separator */");
    s.addFile('fixtures/other/third.js');
    return s.end().then(function(){
      expectFile('coffee-example.js').in('tmp');
      expectFile('coffee-example.map').in('tmp');
    });
  });

  it("should discover external sources", function() {
    var s = new SourceMap({outputFile: 'tmp/external-content.js', baseDir: path.join(__dirname, 'fixtures')});
    s.addFile('other/third.js');
    s.addSpace("/* My First Separator */");
    s.addFile('external-content/all-inner.js');
    s.addSpace("/* My Second */");
    s.addFile('other/fourth.js');
    return s.end().then(function(){
      expectFile('external-content.js').in('tmp');
      expectFile('external-content.map').in('tmp');
    });
  });

  it("should populate cache", function() {
    var cache = {};
    var s = new SourceMap({outputFile: 'tmp/external-content.js', baseDir: path.join(__dirname, 'fixtures'), cache: cache});
    s.addFile('other/third.js');
    s.addSpace("/* My First Separator */");
    s.addFile('external-content/all-inner.js');
    s.addSpace("/* My Second */");
    s.addFile('other/fourth.js');
    return s.end().then(function(){
      expectFile('external-content.js').in('tmp');
      expectFile('external-content.map').in('tmp');
      assert.deepEqual(cache, {
        "b02a65b427e623a118a1d7ee09aeecbd": { encoder: "AEAAA", lines: 11 }
      });
    });
  });

  it("should use cache", function() {
    var cache = {};

    function once(finalFile){
      var s = new SourceMap({cache: cache, outputFile: 'tmp/intermediate.js'});
      s.addFile('fixtures/inner/first.js');
      var filler = "'x';";
      s.addSpace(filler);
      s.addFile('fixtures/inner/second.js');

      return s.end().then(function(){
        s = new SourceMap({cache: cache, outputFile: 'tmp/intermediate2.js'});
        s.addFile('fixtures/other/fourth.js');
        return s.end();
      }).then(function(){
        s = new SourceMap({cache: cache, outputFile: 'tmp/' + finalFile});
        sinon.spy(s, '_scanMappings');
        s.addFile('tmp/intermediate.js');
        s.addFile('fixtures/other/third.js');
        s.addFile('tmp/intermediate2.js');
        return s.end().then(function(){
          return s._scanMappings;
        });
      });
    }

    return once('firstPass.js').then(function(){
      return once('final.js');
    }).then(function(spy){
      expectFile('final.js').in('tmp');
      expectFile('final.map').in('tmp');
      expect(spy.getCall(0).args[3], 'should receive cacheHint').to.be.ok();
      expect(spy.getCall(1).args[3], 'should receive cacheHint').to.be.ok();
    });
  });

  it("supports mapFile & mapURL", function() {
    var s = new SourceMap({mapFile: 'tmp/maps/custom.map', mapURL: '/maps/custom.map', outputFile: 'tmp/assets/mapdird.js'});
    s.addFile('fixtures/inner/first.js');
    return s.end().then(function(){
      expectFile('mapdird.js').in('tmp/assets');
      expectFile('custom.map').in('tmp/maps');
      s = new SourceMap({mapFile: 'tmp/maps/custom2.map', mapURL: '/maps/custom2.map', outputFile: 'tmp/assets/mapdird2.js', baseDir: path.resolve('tmp')});
      s.addFile('assets/mapdird.js');
      return s.end();
    }).then(function(){
      expectFile('mapdird2.js').in('tmp/assets');
      expectFile('custom2.map').in('tmp/maps');
    });
  });

  it("outputs block comments when 'mapCommentType' is 'block'", function() {
    var FILE = 'tmp/mapcommenttype.css';
    var s = new SourceMap({outputFile: FILE, mapCommentType: 'block'});
    return s.end().then(function() {
      var result = fs.readFileSync(FILE, 'utf-8');
      var expected = "/*# sourceMappingURL=mapcommenttype.css.map */\n";
      assert.equal(result, expected);
    });
  });

  it("should warn but tolerate broken sourcemap URL", function() {
    var s = new SourceMap({outputFile: 'tmp/with-broken-input-map.js', baseDir: path.join(__dirname, 'fixtures')});
    s._warn = sinon.spy();
    s.addFile('other/third.js');
    s.addSpace("/* My First Separator */");
    s.addFile('external-content/broken-link.js');
    s.addSpace("/* My Second */");
    s.addFile('other/fourth.js');
    return s.end().then(function(){
      expectFile('with-broken-input-map.js').in('tmp');
      expectFile('with-broken-input-map.map').in('tmp');
      assert(s._warn.called, 'generates warning');
    });
  });

  it("corrects upstream sourcemap that is too short", function() {
    var s = new SourceMap({outputFile: 'tmp/test-short.js'});
    s.addFile('fixtures/other/third.js');
    s.addFile('fixtures/short/rewriter.js');
    s.addFile('fixtures/other/fourth.js');
    return s.end().then(function(){
      expectFile('test-short.js').in('tmp');
      expectFile('test-short.map').in('tmp');
    });
  });

  it("corrects upstream sourcemap that is too short, on cached second build", function() {
    var cache = {};
    function once() {
      var s = new SourceMap({cache: cache, outputFile: 'tmp/test-short.js'});
      s.addFile('fixtures/other/third.js');
      s.addFile('fixtures/short/rewriter.js');
      s.addFile('fixtures/other/fourth.js');
      return s.end();
    }
    return once().then(once).then(function(){
      expectFile('test-short.js').in('tmp');
      expectFile('test-short.map').in('tmp');
    });
  });

  it("deals with missing newline followed by single newline", function() {
    var s = new SourceMap({outputFile: 'tmp/iife-wrapping.js'});
    s.addFile('fixtures/other/fourth.js');
    s.addSpace('\n');
    s.addFile('fixtures/iife-wrapping/iife-start');
    s.addSpace('\n');
    s.addFile('fixtures/other/third.js');
    s.addSpace('\n');
    s.addFile('fixtures/iife-wrapping/iife-end');

    return s.end().then(function(){
      expectFile('iife-wrapping.js').in('tmp');
      expectFile('iife-wrapping.map').in('tmp');
    });
  });

  it("should tolerate input sourcemaps with fewer sourcesContent than sources", function() {
    var s = new SourceMap({outputFile: 'tmp/too-many-sources-out.js'});
    s.addFile('fixtures/other/fourth.js');
    s.addFile('fixtures/emptyish/too-many-sources.js');
    s.addFile('fixtures/other/third.js');
    return s.end().then(function(){
      expectFile('too-many-sources-out.js').in('tmp');
      expectFile('too-many-sources-out.map').in('tmp');
    });
  });

  it("should tolerate input sourcemaps with more sourcesContent than sources", function() {
    var s = new SourceMap({outputFile: 'tmp/too-few-sources-out.js'});
    s.addFile('fixtures/other/fourth.js');
    s.addFile('fixtures/emptyish/too-few-sources.js');
    s.addFile('fixtures/other/third.js');
    return s.end().then(function(){
      expectFile('too-few-sources-out.js').in('tmp');
      expectFile('too-few-sources-out.map').in('tmp');
    });
  });

  it("should update when input source code is stable but sourcemap has changed", function() {
    // This case occurs when the user makes non-semantic changes to
    // their original source code, which therefore gets preprocessed
    // into identical output that has a different sourceMap.

    var cache = {};

    function runOnce() {
      var s = new SourceMap({outputFile: 'tmp/hello-world-output.js', cache: cache});
      s.addFile('fixtures/inner/first.js');
      s.addFile('tmp/hello-world.js');
      s.addFile('fixtures/inner/second.js');
      return s.end();
    }

    copySync('fixtures/typescript/hello-world-1.js', 'tmp/hello-world.js');
    return runOnce().then(function(){
      expectFile('hello-world-output.js').in('tmp');
      copySync('tmp/hello-world-output.map', 'tmp/hello-world-output-1.map');
      expectFile('hello-world-output-1.map').in('tmp');

      copySync('fixtures/typescript/hello-world-2.js', 'tmp/hello-world.js');
      return runOnce();
    }).then(function() {
      expectFile('hello-world-output.js').in('tmp');
      copySync('tmp/hello-world-output.map', 'tmp/hello-world-output-2.map');
      expectFile('hello-world-output-2.map').in('tmp');
    });
  });

  describe('CONCAT_STATS', function() {
    var outputs;
    var concat;

    beforeEach(function() {
      process.env.CONCAT_STATS = true;
      outputs = [];

      concat = new SourceMap({
        outputFile: 'tmp/hello-world-output.js',
        cache: {}
      });

      concat.writeConcatStatsSync = function(outputPath, content) {
        outputs.push({
          outputPath: outputPath,
          content: content
        });
      };
    });

    afterEach(function() {
      delete process.env.CONCAT_STATS;
    });

    it('correctly emits file for given concat', function() {
      concat.addFile('fixtures/inner/second.js');
      concat.addFile('fixtures/inner/first.js');

      expect(outputs.length).to.eql(0);

      return concat.end().then(function() {
        expect(outputs.length).to.eql(1);

        var outputPath = process.cwd() + '/concat-stats-for/' + concat.id + '-' + path.basename(concat.outputFile) + '.json';
        expect(outputs[0].outputPath).to.eql(outputPath);
        expect(outputs[0].content).to.eql({
          outputFile: concat.outputFile,
          sizes: {
            'fixtures/inner/first.js': 100,
            'fixtures/inner/second.js': 66
          }
        });
      });
    });

    it('correctly DOES NOT emits file for given concat, if the flag is not set', function() {
      delete process.env.CONCAT_STATS;

      concat.addFile('fixtures/inner/second.js');
      concat.addFile('fixtures/inner/first.js');

      expect(outputs.length).to.eql(0);

      return concat.end().then(function() {
        expect(outputs.length).to.eql(0);
      });
    })
  });
});

function expectFile(filename, actualContent) {
  var stripURL = false;
  return {
    in: function(dir) {
      actualContent = actualContent || ensurePosix(fs.readFileSync(path.join(dir, filename), 'utf-8'));
      fs.writeFileSync(path.join(__dirname, 'actual', filename), actualContent);

      var expectedContent;
      try {
        expectedContent = ensurePosix(fs.readFileSync(path.join(__dirname, 'expected', filename), 'utf-8'));
        if (stripURL) {
          expectedContent = expectedContent.replace(/\/\/# sourceMappingURL=.*$/, '');
        }

      } catch (err) {
        console.warn("Missing expcted file: " + path.join(__dirname, 'expected', filename));
      }
      expect(actualContent).equals(expectedContent, "discrepancy in " + filename);
      return this;
    }
  };
}

function copySync(src, dest) {
  fs.writeFileSync(dest, fs.readFileSync(src));
}

function ensurePosix(string) {
  if (EOL !== '\n') {
    string = string.split(EOL).join('\n');
  }
  return string;
}
