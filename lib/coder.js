var vlq = require('./vlq');
var fields = ['generatedColumn', 'source', 'originalLine', 'originalColumn', 'name'];

class Coder {
  constructor() {}

  decode(mapping) {
    var value = this.rawDecode(mapping);
    var output = {};

    for (var i=0; i<fields.length;i++) {
      var field = fields[i];
      var prevField = 'prev_' + field;
      if (value.hasOwnProperty(field)) {
        output[field] = value[field];
        if (typeof this[prevField] !== 'undefined') {
          output[field] += this[prevField];
        }
        this[prevField] = output[field];
      }
    }
    return output;
  }

  encode(value) {
    var output = '';
    for (var i=0; i<fields.length;i++) {
      var field = fields[i];
      if (value.hasOwnProperty(field)){
        var prevField = 'prev_' + field;
        var valueField = value[field];
        if (typeof this[prevField] !== 'undefined') {
          output += vlq.encode(valueField-this[prevField]);
        } else {
          output += vlq.encode(valueField);
        }
        this[prevField] = valueField;
      }
    }
    return output;
  }

  resetColumn() {
    this.prev_generatedColumn = 0;
  }

  adjustLine(n) {
    this.prev_originalLine += n;
  }

  rawDecode(mapping) {
    var buf = {rest: 0};
    var output = {};
    var fieldIndex = 0;
    while (fieldIndex < fields.length && buf.rest < mapping.length) {
      vlq.decode(mapping, buf.rest, buf);
      output[fields[fieldIndex]] = buf.value;
      fieldIndex++;
    }
    return output;
  }

  copy() {
    var c = new Coder();
    var key;
    for (var i = 0; i < fields.length; i++) {
      key = 'prev_' + fields[i];
      c[key] = this[key];
    }
    return c;
  }

  serialize() {
    var output = '';
    for (var i=0; i<fields.length;i++) {
      var valueField = this['prev_' + fields[i]] || 0;
      output += vlq.encode(valueField);
    }
    return output;
  }

  add(other) {
    this._combine(other, function(a,b){return a + b; });
  }

  subtract(other) {
    this._combine(other, function(a,b){return a - b; });
  }

  _combine(other, operation) {
    var key;
    for (var i = 0; i < fields.length; i++) {
      key = 'prev_' + fields[i];
      this[key] = operation((this[key] || 0), other[key] || 0);
    }
  }

  debug(mapping) {
    var buf = {rest: 0};
    var output = [];
    var fieldIndex = 0;
    while (fieldIndex < fields.length && buf.rest < mapping.length) {
      vlq.decode(mapping, buf.rest, buf);
      output.push(buf.value);
      fieldIndex++;
    }
    return output.join('.');
  }
}

module.exports = Coder;
