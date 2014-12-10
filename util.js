var vlq = require('./vlq');

module.exports = {
  countLines: function(src) {
    var newlinePattern = /(\r?\n)/g;
    var count = 0;
    while (newlinePattern.exec(src)) {
      count++;
    }
    return count;
  },

  nextLineContinues: [0,0,1,0].map(vlq.encode).join('') + ';'

};
