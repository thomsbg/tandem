(function() {
  var TandemAdapter, TandemSocketAdapter, authenticate, info, socketio, track, _,
    __slice = [].slice,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  _ = require('lodash');

  socketio = require('socket.io-client');

  TandemAdapter = require('./adapter');

  authenticate = function() {
    var authPacket;
    authPacket = {
      auth: this.authObj,
      fileId: this.fileId,
      userId: this.userId
    };
    info.call(this, "Attempting auth to", this.fileId, authPacket);
    return this.socket.emit('auth', authPacket, (function(_this) {
      return function(response) {
        if (response.error == null) {
          info.call(_this, "Connected!", response);
          if (_this.ready === false) {
            return _this.setReady();
          }
        } else {
          return _this.emit(TandemAdapter.events.ERROR, response.error);
        }
      };
    })(this));
  };

  info = function() {
    var args;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    if (!this.settings.debug) {
      return;
    }
    if ((typeof console !== "undefined" && console !== null ? console.info : void 0) == null) {
      return;
    }
    if (_.isFunction(console.info.apply)) {
      return console.info.apply(console, args);
    } else {
      return console.info(args);
    }
  };

  track = function(type, route, packet) {
    if (this.stats[type] == null) {
      this.stats[type] = {};
    }
    if (this.stats[type][route] == null) {
      this.stats[type][route] = 0;
    }
    return this.stats[type][route] += 1;
  };

  TandemSocketAdapter = (function(_super) {
    __extends(TandemSocketAdapter, _super);

    TandemSocketAdapter.CALLBACK = 'callback';

    TandemSocketAdapter.RECIEVE = 'recieve';

    TandemSocketAdapter.SEND = 'send';

    TandemSocketAdapter.DEFAULTS = {
      debug: false,
      latency: 0
    };

    function TandemSocketAdapter(endpointUrl, fileId, userId, authObj, options) {
      var socketOptions;
      this.fileId = fileId;
      this.userId = userId;
      this.authObj = authObj;
      if (options == null) {
        options = {};
      }
      TandemSocketAdapter.__super__.constructor.apply(this, arguments);
      options = _.pick(options, _.keys(TandemSocketAdapter.DEFAULTS).concat(_.keys(TandemSocketAdapter.IO_DEFAULTS)));
      this.settings = _.extend({}, TandemSocketAdapter.DEFAULTS, options);
      this.socketListeners = {};
      this.stats = {
        send: {},
        recieve: {},
        callback: {}
      };
      socketOptions = _.clone(this.settings);
      this.socket = socketio(endpointUrl, socketOptions);
      this.socket.on('reconnecting', (function(_this) {
        return function() {
          _this.emit(TandemAdapter.events.RECONNECTING);
          return _this.ready = false;
        };
      })(this)).on('reconnect', (function(_this) {
        return function() {
          _this.emit(TandemAdapter.events.RECONNECT);
          if (_this.ready === false) {
            return authenticate.call(_this);
          }
        };
      })(this)).on('disconnect', (function(_this) {
        return function() {
          return _this.emit(TandemAdapter.events.DISCONNECT);
        };
      })(this));
      authenticate.call(this);
    }

    TandemSocketAdapter.prototype.close = function() {
      TandemSocketAdapter.__super__.close.apply(this, arguments);
      this.socket.removeAllListeners();
      return this.socketListeners = {};
    };

    TandemSocketAdapter.prototype.listen = function(route, callback) {
      var onSocketCallback;
      onSocketCallback = (function(_this) {
        return function(packet) {
          info.call(_this, "Got", route, packet);
          track.call(_this, TandemSocketAdapter.RECIEVE, route, packet);
          if (callback != null) {
            return callback.call(_this, packet);
          }
        };
      })(this);
      if (this.socketListeners[route] != null) {
        this.socket.off(route, onSocketCallback);
      }
      this.socketListeners[route] = onSocketCallback;
      this.socket.on(route, onSocketCallback);
      return this;
    };

    TandemSocketAdapter.prototype.send = function(route, packet, callback) {
      track.call(this, TandemSocketAdapter.SEND, route, packet);
      return setTimeout((function(_this) {
        return function() {
          if (callback != null) {
            return _this.socket.emit(route, packet, function(response) {
              track.call(_this, TandemSocketAdapter.CALLBACK, route, response);
              info.call(_this, 'Callback:', response);
              return callback.call(_this, response);
            });
          } else {
            return _this.socket.emit(route, packet);
          }
        };
      })(this), this.settings.latency);
    };

    return TandemSocketAdapter;

  })(TandemAdapter);

  module.exports = TandemSocketAdapter;

}).call(this);
