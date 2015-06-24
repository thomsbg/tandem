(function() {
  var Delta, EventEmitter, TandemNetworkAdapter, _makeResyncPacket, _onMessageError;

  EventEmitter = require('events').EventEmitter;

  Delta = require('rich-text').Delta;

  _makeResyncPacket = function(file) {
    return {
      resync: true,
      head: file.head,
      version: file.version
    };
  };

  _onMessageError = function(err, sessionId, file, callback) {
    err.fileId = file.id;
    err.sessionId = sessionId;
    TandemEmitter.emit(TandemEmitter.events.ERROR, err);
    return callback(_makeResyncPacket(file));
  };

  TandemNetworkAdapter = (function() {
    TandemNetworkAdapter.routes = {
      RESYNC: 'ot/resync',
      SYNC: 'ot/sync',
      UPDATE: 'ot/update',
      SAVE: 'save'
    };

    function TandemNetworkAdapter(fileManager) {
      this.fileManager = fileManager;
    }

    TandemNetworkAdapter.prototype.handle = function(route, fileId, packet, callback) {
      if (fileId == null) {
        return callback('Undefined fileId');
      }
      return this.fileManager.find(fileId, (function(_this) {
        return function(err, file) {
          var resyncHandler;
          if (err != null) {
            return callback(err, {
              error: err
            });
          }
          resyncHandler = function(err, file, callback) {
            return callback(err, _makeResyncPacket(file));
          };
          switch (route) {
            case TandemNetworkAdapter.routes.RESYNC:
              return resyncHandler(null, file, callback);
            case TandemNetworkAdapter.routes.SYNC:
              return file.sync(parseInt(packet.version), function(err, delta, version) {
                return callback(err, {
                  delta: delta,
                  version: version
                });
              });
            case TandemNetworkAdapter.routes.UPDATE:
              return file.update(new Delta(packet.delta), parseInt(packet.version), function(err, delta, version) {
                if (err != null) {
                  return resyncHandler(err, file, callback);
                } else {
                  return callback(null, {
                    fileId: fileId,
                    version: version
                  }, {
                    delta: delta,
                    fileId: fileId,
                    version: version
                  });
                }
              });
            case TandemNetworkAdapter.routes.SAVE:
              return _this.fileManager.save(file, function(err, version) {
                if (err != null) {
                  return callback(err, {
                    error: err
                  });
                }
                return callback(null, {
                  fileId: fileId,
                  version: version
                });
              });
            default:
              return callback(new Error('Unexpected network route'));
          }
        };
      })(this));
    };

    return TandemNetworkAdapter;

  })();

  module.exports = TandemNetworkAdapter;

}).call(this);
