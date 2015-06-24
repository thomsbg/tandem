(function() {
  var Delta, TandemStorage;

  Delta = require('rich-text').Delta;

  TandemStorage = (function() {
    function TandemStorage() {}

    TandemStorage.prototype.authorize = function(authPacket, callback) {
      return callback(null);
    };

    TandemStorage.prototype.find = function(fileId, callback) {
      return callback(null, new Delta(), 0);
    };

    TandemStorage.prototype.update = function(fileId, head, version, deltas, callback) {
      return callback(null);
    };

    return TandemStorage;

  })();

  module.exports = TandemStorage;

}).call(this);
