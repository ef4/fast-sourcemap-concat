var vlq = require('./vlq');

module.exports = {
  countLines: function(src) {
    var newlinePattern = /(\r?\n)/g;
    var count = 0;
    while (newlinePattern.exec(src)) {
      count++;
    }
    return count;
  }
};
