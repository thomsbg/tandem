/*! Tandem Realtime Coauthoring Engine - v0.13.4 - 2014-10-20
 *  Copyright (c) 2014
 *  Jason Chen, Salesforce.com
 *  Byron Milligan, Salesforce.com
 */

!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Tandem=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
Tandem         = {}
Tandem.Delta   = _dereq_('rich-text').Delta;
Tandem.Client  = _dereq_('./build/client/tandem');
Tandem.File    = _dereq_('./build/client/file');
Tandem.Network = {
  Adapter: _dereq_('./build/client/network/adapter')
};

module.exports = Tandem

},{"./build/client/file":2,"./build/client/network/adapter":3,"./build/client/tandem":4,"rich-text":5}],2:[function(_dereq_,module,exports){
(function() {
  var Delta, EventEmitter2, TandemFile, initAdapterListeners, initHealthListeners, initListeners, onResync, onUpdate, sendResync, sendSync, sendUpdate, setReady, warn, _,
    __slice = [].slice,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  _ = _dereq_('lodash');

  EventEmitter2 = _dereq_('eventemitter2');

  Delta = _dereq_('rich-text').Delta;

  if (EventEmitter2.EventEmitter2 != null) {
    EventEmitter2 = EventEmitter2.EventEmitter2;
  }

  initAdapterListeners = function() {
    return this.adapter.listen(TandemFile.routes.UPDATE, (function(_this) {
      return function(packet) {
        if (!_this.ready) {
          return;
        }
        if (packet.fileId !== _this.fileId) {
          return warn("Got update for other file", packet.fileId);
        }
        if (!_this.remoteUpdate(packet.delta, packet.version)) {
          warn("Remote update failed, requesting resync");
          return sendResync.call(_this);
        }
      };
    })(this));
  };

  initHealthListeners = function() {
    this.adapter.on(this.adapter.constructor.events.RECONNECT, (function(_this) {
      return function(transport, attempts) {
        return sendSync.call(_this);
      };
    })(this)).on(this.adapter.constructor.events.RECONNECTING, (function(_this) {
      return function(timeout, attempts) {
        if (attempts === 1) {
          return _this.emit(TandemFile.events.HEALTH, TandemFile.health.ERROR, _this.health);
        }
      };
    })(this)).on(this.adapter.constructor.events.DISCONNECT, (function(_this) {
      return function() {
        return _this.emit(TandemFile.events.HEALTH, TandemFile.health.ERROR, _this.health);
      };
    })(this)).on(this.adapter.constructor.events.ERROR, (function(_this) {
      return function() {
        var args;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        _this.emit.apply(_this, [TandemFile.events.ERROR].concat(__slice.call(args)));
        return _this.emit(TandemFile.events.HEALTH, TandemFile.health.ERROR, _this.health);
      };
    })(this));
    return this.on(TandemFile.events.HEALTH, (function(_this) {
      return function(newHealth, oldHealth) {
        return _this.health = newHealth;
      };
    })(this));
  };

  initListeners = function() {
    initAdapterListeners.call(this);
    return initHealthListeners.call(this);
  };

  onResync = function(response) {
    var decomposed, delta;
    delta = new Delta(response.head);
    decomposed = delta.decompose(this.arrived);
    this.remoteUpdate(decomposed, response.version);
    return this.emit(TandemFile.events.HEALTH, TandemFile.health.HEALTHY, this.health);
  };

  onUpdate = function(response) {
    this.version = response.version;
    this.arrived = this.arrived.compose(this.inFlight);
    this.inFlight = new Delta(this.arrived.length());
    return sendUpdateIfReady.call(this);
  };

  sendResync = function(callback) {
    this.emit(TandemFile.events.HEALTH, TandemFile.health.WARNING, this.health);
    return this.send(TandemFile.routes.RESYNC, {}, (function(_this) {
      return function(response) {
        onResync.call(_this, response);
        if (callback != null) {
          return callback();
        }
      };
    })(this));
  };

  sendSync = function(callback) {
    return this.send(TandemFile.routes.SYNC, {
      version: this.version
    }, (function(_this) {
      return function(response) {
        if (_.isFunction(callback)) {
          callback(response.error, _this);
          _this.emit(TandemFile.events.OPEN, response.error, _this);
        }
        if (response.error != null) {
          return;
        }
        _this.emit(TandemFile.events.HEALTH, TandemFile.health.HEALTHY, _this.health);
        if (response.resync) {
          _this.ready = false;
          warn("Sync requesting resync");
          return onResync.call(_this, response);
        } else if (_this.remoteUpdate(response.delta, response.version)) {
          return setReady.call(_this, response.delta, response.version, false);
        } else {
          warn("Remote update failed on sync, requesting resync");
          return sendResync.call(_this, function() {
            return setReady.call(_this, response.delta, response.version, true);
          });
        }
      };
    })(this), true);
  };

  sendUpdate = function() {
    var packet, updateTimeout;
    packet = {
      delta: this.inFlight,
      version: this.version
    };
    updateTimeout = setTimeout((function(_this) {
      return function() {
        warn('Update taking over 10s to respond');
        return _this.emit(TandemFile.events.HEALTH, TandemFile.health.WARNING, _this.health);
      };
    })(this), 10000);
    return this.send(TandemFile.routes.UPDATE, packet, (function(_this) {
      return function(response) {
        clearTimeout(updateTimeout);
        if (response.error) {
          _.each(_this.updateCallbacks.inFlight, function(callback) {
            return callback.call(_this, response.error);
          });
          _this.sendIfReady();
          return;
        }
        if (_this.health !== TandemFile.health.HEALTHY) {
          _this.emit(TandemFile.events.HEALTH, TandemFile.health.HEALTHY, _this.health);
        }
        if (response.resync) {
          warn("Update requesting resync", _this.id, packet, response);
          onResync.call(_this, response);
          return sendUpdate.call(_this);
        } else {
          _this.version = response.version;
          _this.arrived = _this.arrived.compose(_this.inFlight);
          _this.inFlight = new Delta(_this.arrived.length());
          _.each(_this.updateCallbacks.inFlight, function(callback) {
            return callback.call(_this, null, _this.arrived);
          });
          return _this.sendIfReady();
        }
      };
    })(this));
  };

  setReady = function(delta, version, resend) {
    if (resend == null) {
      resend = false;
    }
    this.ready = true;
    if (resend && !this.inFlight.isIdentity()) {
      sendUpdate.call(this);
    }
    return this.emit(TandemFile.events.READY, delta, version);
  };

  warn = function() {
    var args;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    if ((typeof console !== "undefined" && console !== null ? console.warn : void 0) == null) {
      return;
    }
    if (_.isFunction(console.warn.apply)) {
      return console.warn.apply(console, args);
    } else {
      return console.warn(args);
    }
  };

  TandemFile = (function(_super) {
    __extends(TandemFile, _super);

    TandemFile.events = {
      ERROR: 'file-error',
      HEALTH: 'file-health',
      OPEN: 'file-open',
      READY: 'file-ready',
      UPDATE: 'file-update'
    };

    TandemFile.health = {
      HEALTHY: 'healthy',
      WARNING: 'warning',
      ERROR: 'error'
    };

    TandemFile.routes = {
      BROADCAST: 'broadcast',
      RESYNC: 'ot/resync',
      SYNC: 'ot/sync',
      UPDATE: 'ot/update',
      SAVE: 'save'
    };

    function TandemFile(fileId, adapter, initial, callback) {
      this.fileId = fileId;
      this.adapter = adapter;
      if ((callback == null) && _.isFunction(initial)) {
        callback = initial;
        initial = {};
      }
      if (initial == null) {
        initial = {};
      }
      this.id = _.uniqueId('file-');
      this.health = TandemFile.health.WARNING;
      this.ready = false;
      this.version = initial.version || 0;
      this.arrived = initial.head || new Delta();
      this.inFlight = new Delta().retain(this.arrived.length());
      this.inLine = new Delta().retain(this.arrived.length());
      this.updateCallbacks = {
        inFlight: [],
        inLine: []
      };
      if (this.adapter.ready) {
        this.emit(TandemFile.events.HEALTH, TandemFile.health.HEALTHY, this.health);
        sendSync.call(this, callback);
      } else {
        this.adapter.once(this.adapter.constructor.events.READY, (function(_this) {
          return function() {
            _this.emit(TandemFile.events.HEALTH, TandemFile.health.HEALTHY, _this.health);
            return sendSync.call(_this, callback);
          };
        })(this));
      }
      initListeners.call(this);
    }

    TandemFile.prototype.broadcast = function(type, packet, callback) {
      packet = _.clone(packet);
      packet.type = type;
      return this.adapter.send(TandemFile.routes.BROADCAST, packet, callback);
    };

    TandemFile.prototype.close = function() {
      this.adapter.close();
      return this.removeAllListeners();
    };

    TandemFile.prototype.isDirty = function() {
      return !this.inFlight.isIdentity() || !this.inLine.isIdentity();
    };

    TandemFile.prototype.remoteUpdate = function(delta, version) {
      var flightDeltaTranform, textTransform;
      this.version = version;
      delta = new Delta(delta);
      if (this.arrived.canCompose(delta)) {
        this.arrived = this.arrived.compose(delta);
        this.inFlight = delta.transform(this.inFlight, true);
        flightDeltaTranform = this.inFlight.transform(delta, false);
        textTransform = this.inLine.transform(flightDeltaTranform, false);
        this.inLine = flightDeltaTranform.transform(this.inLine, true);
        this.emit(TandemFile.events.UPDATE, textTransform);
        return true;
      } else {
        return false;
      }
    };

    TandemFile.prototype.update = function(delta, callback) {
      if (this.inLine.canCompose(delta)) {
        this.inLine = this.inLine.compose(delta);
        return this.sendIfReady(callback);
      } else {
        this.emit(TandemFile.events.ERROR, 'Cannot compose inLine with local delta', this.inLine, delta);
        warn("Local update error, attempting resync", this.id, this.inLine, this.delta);
        return sendResync.call(this);
      }
    };

    TandemFile.prototype.save = function(callback) {
      return this.send(TandemFile.routes.SAVE, {}, (function(_this) {
        return function(response) {
          if (callback != null) {
            return callback(response);
          }
        };
      })(this));
    };

    TandemFile.prototype.send = function(route, packet, callback, priority) {
      if (callback == null) {
        callback = null;
      }
      if (priority == null) {
        priority = false;
      }
      return this.adapter.queue(route, packet, (function(_this) {
        return function(response) {
          if (response.error != null) {
            _this.emit(TandemFile.events.ERROR, response.error);
          }
          if (callback != null) {
            return callback(response);
          }
        };
      })(this), priority);
    };

    TandemFile.prototype.sendIfReady = function(callback) {
      if (callback != null) {
        this.updateCallbacks.inLine.push(callback);
      }
      if (this.inFlight.isIdentity() && !this.inLine.isIdentity()) {
        this.inFlight = this.inLine;
        this.inLine = Delta.getIdentity(this.inFlight.endLength);
        this.updateCallbacks.inFlight = this.updateCallbacks.inLine;
        this.updateCallbacks.inLine = [];
        sendUpdate.call(this);
        return true;
      }
      return false;
    };

    TandemFile.prototype.transform = function(indexes) {};

    return TandemFile;

  })(EventEmitter2);

  module.exports = TandemFile;

}).call(this);

},{"eventemitter2":false,"lodash":false,"rich-text":5}],3:[function(_dereq_,module,exports){
(function() {
  var EventEmitter2, TandemNetworkAdapter, async,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __slice = [].slice;

  async = _dereq_('async');

  EventEmitter2 = _dereq_('eventemitter2');

  if (EventEmitter2.EventEmitter2 != null) {
    EventEmitter2 = EventEmitter2.EventEmitter2;
  }

  TandemNetworkAdapter = (function(_super) {
    __extends(TandemNetworkAdapter, _super);

    TandemNetworkAdapter.events = {
      DISCONNECT: 'adapter-disconnect',
      ERROR: 'adapter-error',
      READY: 'adapter-ready',
      RECONNECT: 'adapter-reconnect',
      RECONNECTING: 'adapter-reconnecting'
    };

    function TandemNetworkAdapter() {
      this.ready = false;
      this.sendQueue = [];
    }

    TandemNetworkAdapter.prototype.close = function() {
      return this.removeAllListeners();
    };

    TandemNetworkAdapter.prototype.listen = function(route, callback) {
      console.warn("Should be overwritten by descendant");
      return this;
    };

    TandemNetworkAdapter.prototype.queue = function(route, packet, callback, priority) {
      if (priority == null) {
        priority = false;
      }
      if (this.ready) {
        return this.send(route, packet, callback, priority);
      } else {
        if (priority) {
          return this.sendQueue.unshift([route, packet, callback]);
        } else {
          return this.sendQueue.push([route, packet, callback]);
        }
      }
    };

    TandemNetworkAdapter.prototype.send = function(route, packet, callback) {
      return console.warn("Should be overwritten by descendant");
    };

    TandemNetworkAdapter.prototype.setReady = function() {
      this.emit(TandemNetworkAdapter.events.READY);
      return async.until((function(_this) {
        return function() {
          return _this.sendQueue.length === 0;
        };
      })(this), (function(_this) {
        return function(callback) {
          var elem, packet, route, sendCallback;
          elem = _this.sendQueue.shift();
          route = elem[0], packet = elem[1], sendCallback = elem[2];
          return _this.send(route, packet, function() {
            var args;
            args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
            if (sendCallback != null) {
              sendCallback.apply(_this, args);
            }
            return callback();
          });
        };
      })(this), (function(_this) {
        return function(err) {
          return _this.ready = true;
        };
      })(this));
    };

    return TandemNetworkAdapter;

  })(EventEmitter2);

  module.exports = TandemNetworkAdapter;

}).call(this);

},{"async":false,"eventemitter2":false}],4:[function(_dereq_,module,exports){
(function() {
  var TandemAdapter, TandemClient, TandemFile, _;

  _ = _dereq_('lodash');

  TandemFile = _dereq_('./file');

  TandemAdapter = _dereq_('./network/adapter');

  TandemClient = (function() {
    TandemClient.DEFAULTS = {
      userId: null,
      network: TandemAdapter
    };

    function TandemClient(endpointUrl, options) {
      this.endpointUrl = endpointUrl;
      this.options = options != null ? options : {};
      options = _.pick(this.options, _.keys(TandemClient.DEFAULTS));
      this.settings = _.extend({}, TandemClient.DEFAULTS, options);
      if (this.settings.userId == null) {
        this.settings.userId = 'anonymous-' + _.random(1000000);
      }
    }

    TandemClient.prototype.open = function(fileId, authObj, initial, callback) {
      this.adapter = _.isFunction(this.settings.network) ? new this.settings.network(this.endpointUrl, fileId, this.settings.userId, authObj, this.options) : this.settings.network;
      return new TandemFile(fileId, this.adapter, initial, callback);
    };

    return TandemClient;

  })();

  module.exports = TandemClient;

}).call(this);

},{"./file":2,"./network/adapter":3,"lodash":false}],5:[function(_dereq_,module,exports){
module.exports = _dereq_('./lib/type');

},{"./lib/type":9}],6:[function(_dereq_,module,exports){
var diff = _dereq_('fast-diff');
var is = _dereq_('./is');
var op = _dereq_('./op');


var NULL_CHARACTER = String.fromCharCode(0);  // Placeholder char for embed in diff()


var Delta = function (ops) {
  // Assume we are given a well formed ops
  if (is.array(ops)) {
    this.ops = ops;
  } else if (is.object(ops) && is.array(ops.ops)) {
    this.ops = ops.ops;
  } else {
    this.ops = [];
  }
};


Delta.prototype.insert = function (text, attributes) {
  var newOp = {};
  if (is.string(text)) {
    if (text.length === 0) return this;
    newOp.insert = text;
  } else if (is.number(text)) {
    newOp.insert = text;
  }
  if (is.object(attributes) && Object.keys(attributes).length > 0) newOp.attributes = attributes;
  return this.push(newOp);
};

Delta.prototype['delete'] = function (length) {
  if (length <= 0) return this;
  return this.push({ 'delete': length });
};

Delta.prototype.retain = function (length, attributes) {
  if (length <= 0) return this;
  var newOp = { retain: length };
  if (is.object(attributes) && Object.keys(attributes).length > 0) newOp.attributes = attributes;
  return this.push(newOp);
};

Delta.prototype.push = function (newOp) {
  var index = this.ops.length;
  var lastOp = this.ops[index - 1];
  newOp = op.clone(newOp);
  if (is.object(lastOp)) {
    if (is.number(newOp['delete']) && is.number(lastOp['delete'])) {
      this.ops[index - 1] = { 'delete': lastOp['delete'] + newOp['delete'] };
      return this;
    }
    // Since it does not matter if we insert before or after deleting at the same index,
    // always prefer to insert first
    if (is.number(lastOp['delete']) && (is.string(newOp.insert) || is.number(newOp.insert))) {
      index -= 1;
      lastOp = this.ops[index - 1];
      if (!is.object(lastOp)) {
        this.ops.unshift(newOp);
        return this;
      }
    }
    if (is.equal(newOp.attributes, lastOp.attributes)) {
      if (is.string(newOp.insert) && is.string(lastOp.insert)) {
        this.ops[index - 1] = { insert: lastOp.insert + newOp.insert };
        if (is.object(newOp.attributes)) this.ops[index - 1].attributes = newOp.attributes
        return this;
      } else if (is.number(newOp.retain) && is.number(lastOp.retain)) {
        this.ops[index - 1] = { retain: lastOp.retain + newOp.retain };
        if (is.object(newOp.attributes)) this.ops[index - 1].attributes = newOp.attributes
        return this;
      }
    }
  }
  this.ops.splice(index, 0, newOp);
  return this;
};

Delta.prototype.chop = function () {
  var lastOp = this.ops[this.ops.length - 1];
  if (lastOp && lastOp.retain && !lastOp.attributes) {
    this.ops.pop();
  }
  return this;
};

Delta.prototype.length = function () {
  return this.ops.reduce(function (length, elem) {
    return length + op.length(elem);
  }, 0);
};

Delta.prototype.slice = function (start, end) {
  start = start || 0;
  if (!is.number(end)) end = Infinity;
  var delta = new Delta();
  var iter = op.iterator(this.ops);
  var index = 0;
  while (index < end && iter.hasNext()) {
    var nextOp;
    if (index < start) {
      nextOp = iter.next(start - index);
    } else {
      nextOp = iter.next(end - start);
      delta.push(nextOp);
    }
    index += op.length(nextOp);
  }
  return delta;
};


Delta.prototype.compose = function (other) {
  var thisIter = op.iterator(this.ops);
  var otherIter = op.iterator(other.ops);
  this.ops = [];
  while (thisIter.hasNext() || otherIter.hasNext()) {
    if (otherIter.peekType() === 'insert') {
      this.push(otherIter.next());
    } else if (thisIter.peekType() === 'delete') {
      this.push(thisIter.next());
    } else {
      var length = Math.min(thisIter.peekLength(), otherIter.peekLength());
      var thisOp = thisIter.next(length);
      var otherOp = otherIter.next(length);
      if (is.number(otherOp.retain)) {
        var newOp = {};
        if (is.number(thisOp.retain)) {
          newOp.retain = length;
        } else {
          newOp.insert = thisOp.insert;
        }
        // Preserve null when composing with a retain, otherwise remove it for inserts
        var attributes = op.attributes.compose(thisOp.attributes, otherOp.attributes, is.number(thisOp.retain));
        if (attributes) newOp.attributes = attributes;
        this.push(newOp);
      // Other op should be delete, we could be an insert or retain
      // Insert + delete cancels out
      } else if (is.number(otherOp['delete']) && is.number(thisOp.retain)) {
        this.push(otherOp);
      }
    }
  }
  return this.chop();
};

Delta.prototype.diff = function (other) {
  var strings = [this.ops, other.ops].map(function (ops) {
    return ops.map(function (op) {
      if (is.string(op.insert)) return op.insert;
      if (is.number(op.insert)) return NULL_CHARACTER;
      var prep = ops === other.ops ? 'on' : 'with';
      throw new Error('diff() called ' + prep + ' non-document');
    }).join('');
  });
  var diffResult = diff(strings[0], strings[1]);
  var thisIter = op.iterator(this.ops);
  var otherIter = op.iterator(other.ops);
  var delta = new Delta();
  diffResult.forEach(function (component) {
    var length = component[1].length;
    while (length > 0) {
      var opLength = 0;
      switch (component[0]) {
        case diff.INSERT:
          opLength = Math.min(otherIter.peekLength(), length);
          delta.push(otherIter.next(opLength));
          break;
        case diff.DELETE:
          opLength = Math.min(length, thisIter.peekLength());
          thisIter.next(opLength);
          delta['delete'](opLength);
          break;
        case diff.EQUAL:
          opLength = Math.min(thisIter.peekLength(), otherIter.peekLength(), length);
          var thisOp = thisIter.next(opLength);
          var otherOp = otherIter.next(opLength);
          if (thisOp.insert === otherOp.insert) {
            delta.retain(opLength, op.attributes.diff(thisOp.attributes, otherOp.attributes));
          } else {
            delta.push(otherOp)['delete'](opLength);
          }
          break;
      }
      length -= opLength;
    }
  });
  return delta.chop();
};

Delta.prototype.transform = function (other, priority) {
  priority = !!priority;
  if (is.number(other)) {
    return this.transformPosition(other, priority);
  }
  var thisIter = op.iterator(this.ops);
  var otherIter = op.iterator(other.ops);
  var delta = new Delta();
  while (thisIter.hasNext() || otherIter.hasNext()) {
    if (thisIter.peekType() === 'insert' && (priority || otherIter.peekType() !== 'insert')) {
      delta.retain(op.length(thisIter.next()));
    } else if (otherIter.peekType() === 'insert') {
      delta.push(otherIter.next());
    } else {
      var length = Math.min(thisIter.peekLength(), otherIter.peekLength());
      var thisOp = thisIter.next(length);
      var otherOp = otherIter.next(length);
      if (thisOp['delete']) {
        // Our delete either makes their delete redundant or removes their retain
        continue;
      } else if (otherOp['delete']) {
        delta.push(otherOp);
      } else {
        // We retain either their retain or insert
        delta.retain(length, op.attributes.transform(thisOp.attributes, otherOp.attributes, priority));
      }
    }
  }
  return delta.chop();
};

Delta.prototype.transformPosition = function (index, priority) {
  priority = !!priority;
  var thisIter = op.iterator(this.ops);
  var offset = 0;
  while (thisIter.hasNext() && offset <= index) {
    var length = thisIter.peekLength();
    var nextType = thisIter.peekType();
    thisIter.next();
    if (nextType === 'delete') {
      index -= Math.min(length, index - offset);
      continue;
    } else if (nextType === 'insert' && (offset < index || !priority)) {
      index += length;
    }
    offset += length;
  }
  return index;
};


module.exports = Delta;

},{"./is":7,"./op":8,"fast-diff":10}],7:[function(_dereq_,module,exports){
module.exports = {
  equal: function (a, b) {
    if (a === b) return true;
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    if (Object.keys(a).length != Object.keys(b).length) return false;
    for(var key in a) {
      // Only compare one level deep
      if (a[key] !== b[key]) return false;
    }
    return true;
  },

  array: function (value) {
    return Array.isArray(value);
  },

  number: function (value) {
    if (typeof value === 'number') return true;
    if (typeof value === 'object' && Object.prototype.toString.call(value) === '[object Number]') return true;
    return false;
  },

  object: function (value) {
    if (!value) return false;
    return (typeof value === 'function' || typeof value === 'object');
  },

  string: function (value) {
    if (typeof value === 'string') return true;
    if (typeof value === 'object' && Object.prototype.toString.call(value) === '[object String]') return true;
    return false;
  }
};

},{}],8:[function(_dereq_,module,exports){
var is = _dereq_('./is');


var lib = {
  attributes: {
    clone: function (attributes, keepNull) {
      if (!is.object(attributes)) return {};
      return Object.keys(attributes).reduce(function (memo, key) {
        if (attributes[key] !== undefined && (attributes[key] !== null || keepNull)) {
          memo[key] = attributes[key];
        }
        return memo;
      }, {});
    },

    compose: function (a, b, keepNull) {
      if (!is.object(a)) a = {};
      if (!is.object(b)) b = {};
      var attributes = this.clone(b, keepNull);
      for (var key in a) {
        if (a[key] !== undefined && b[key] === undefined) {
          attributes[key] = a[key];
        }
      }
      return Object.keys(attributes).length > 0 ? attributes : undefined;
    },

    diff: function(a, b) {
      if (!is.object(a)) a = {};
      if (!is.object(b)) b = {};
      var attributes = Object.keys(a).concat(Object.keys(b)).reduce(function (attributes, key) {
        if (a[key] !== b[key]) {
          attributes[key] = b[key] === undefined ? null : b[key];
        }
        return attributes;
      }, {});
      return Object.keys(attributes).length > 0 ? attributes : undefined;
    },

    transform: function (a, b, priority) {
      if (!is.object(a)) return b;
      if (!is.object(b)) return undefined;
      if (!priority) return b;  // b simply overwrites us without priority
      var attributes = Object.keys(b).reduce(function (attributes, key) {
        if (a[key] === undefined) attributes[key] = b[key];  // null is a valid value
        return attributes;
      }, {});
      return Object.keys(attributes).length > 0 ? attributes : undefined;
    }
  },

  clone: function (op) {
    var newOp = this.attributes.clone(op);
    if (is.object(newOp.attributes)) {
      newOp.attributes = this.attributes.clone(newOp.attributes, true);
    }
    return newOp;
  },

  iterator: function (ops) {
    return new Iterator(ops);
  },

  length: function (op) {
    if (is.number(op['delete'])) {
      return op['delete'];
    } else if (is.number(op.retain)) {
      return op.retain;
    } else {
      return is.string(op.insert) ? op.insert.length : 1;
    }
  }
};


function Iterator(ops) {
  this.ops = ops;
  this.index = 0;
  this.offset = 0;
};

Iterator.prototype.hasNext = function () {
  return this.peekLength() < Infinity;
};

Iterator.prototype.next = function (length) {
  if (!length) length = Infinity;
  var nextOp = this.ops[this.index];
  if (nextOp) {
    var offset = this.offset;
    var opLength = lib.length(nextOp)
    if (length >= opLength - offset) {
      length = opLength - offset;
      this.index += 1;
      this.offset = 0;
    } else {
      this.offset += length;
    }
    if (is.number(nextOp['delete'])) {
      return { 'delete': length };
    } else {
      var retOp = {};
      if (nextOp.attributes) {
        retOp.attributes = nextOp.attributes;
      }
      if (is.number(nextOp.retain)) {
        retOp.retain = length;
      } else if (is.string(nextOp.insert)) {
        retOp.insert = nextOp.insert.substr(offset, length);
      } else {
        // offset should === 0, length should === 1
        retOp.insert = nextOp.insert;
      }
      return retOp;
    }
  } else {
    return { retain: Infinity };
  }
};

Iterator.prototype.peekLength = function () {
  if (this.ops[this.index]) {
    // Should never return 0 if our index is being managed correctly
    return lib.length(this.ops[this.index]) - this.offset;
  } else {
    return Infinity;
  }
};

Iterator.prototype.peekType = function () {
  if (this.ops[this.index]) {
    if (is.number(this.ops[this.index]['delete'])) {
      return 'delete';
    } else if (is.number(this.ops[this.index].retain)) {
      return 'retain';
    } else {
      return 'insert';
    }
  }
  return 'retain';
};


module.exports = lib;

},{"./is":7}],9:[function(_dereq_,module,exports){
var Delta = _dereq_('./delta');
var pkg = _dereq_('../package.json');


module.exports = {
  Delta: Delta,
  name: 'rich-text',
  uri: 'http://sharejs.org/types/rich-text/v1',

  create: function (initial) {
    return new Delta(initial);
  },

  apply: function (snapshot, delta) {
    snapshot = new Delta(snapshot);
    delta = new Delta(delta);
    return snapshot.compose(delta);
  },

  compose: function (delta1, delta2) {
    delta1 = new Delta(delta1);
    delta2 = new Delta(delta2);
    return delta1.compose(delta2);
  },

  diff: function (delta1, delta2) {
    delta1 = new Delta(delta1);
    delta2 = new Delta(delta2);
    return delta1.diff(delta2);
  },

  transform: function (delta1, delta2, side) {
    delta1 = new Delta(delta1);
    delta2 = new Delta(delta2);
    // Fuzzer specs is in opposite order of delta interface
    return delta2.transform(delta1, side === 'left');
  }
};

},{"../package.json":11,"./delta":6}],10:[function(_dereq_,module,exports){
/**
 * This library modifies the diff-patch-match library by Neil Fraser
 * by removing the patch and match functionality and certain advanced
 * options in the diff function. The original license is as follows:
 *
 * ===
 *
 * Diff Match and Patch
 *
 * Copyright 2006 Google Inc.
 * http://code.google.com/p/google-diff-match-patch/
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


/**
 * The data structure representing a diff is an array of tuples:
 * [[DIFF_DELETE, 'Hello'], [DIFF_INSERT, 'Goodbye'], [DIFF_EQUAL, ' world.']]
 * which means: delete 'Hello', add 'Goodbye' and keep ' world.'
 */
var DIFF_DELETE = -1;
var DIFF_INSERT = 1;
var DIFF_EQUAL = 0;


/**
 * Find the differences between two texts.  Simplifies the problem by stripping
 * any common prefix or suffix off the texts before diffing.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @return {Array} Array of diff tuples.
 */
function diff_main(text1, text2) {
  // Check for equality (speedup).
  if (text1 == text2) {
    if (text1) {
      return [[DIFF_EQUAL, text1]];
    }
    return [];
  }

  // Trim off common prefix (speedup).
  var commonlength = diff_commonPrefix(text1, text2);
  var commonprefix = text1.substring(0, commonlength);
  text1 = text1.substring(commonlength);
  text2 = text2.substring(commonlength);

  // Trim off common suffix (speedup).
  commonlength = diff_commonSuffix(text1, text2);
  var commonsuffix = text1.substring(text1.length - commonlength);
  text1 = text1.substring(0, text1.length - commonlength);
  text2 = text2.substring(0, text2.length - commonlength);

  // Compute the diff on the middle block.
  var diffs = diff_compute_(text1, text2);

  // Restore the prefix and suffix.
  if (commonprefix) {
    diffs.unshift([DIFF_EQUAL, commonprefix]);
  }
  if (commonsuffix) {
    diffs.push([DIFF_EQUAL, commonsuffix]);
  }
  diff_cleanupMerge(diffs);
  return diffs;
};


/**
 * Find the differences between two texts.  Assumes that the texts do not
 * have any common prefix or suffix.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @return {Array} Array of diff tuples.
 */
function diff_compute_(text1, text2) {
  var diffs;

  if (!text1) {
    // Just add some text (speedup).
    return [[DIFF_INSERT, text2]];
  }

  if (!text2) {
    // Just delete some text (speedup).
    return [[DIFF_DELETE, text1]];
  }

  var longtext = text1.length > text2.length ? text1 : text2;
  var shorttext = text1.length > text2.length ? text2 : text1;
  var i = longtext.indexOf(shorttext);
  if (i != -1) {
    // Shorter text is inside the longer text (speedup).
    diffs = [[DIFF_INSERT, longtext.substring(0, i)],
             [DIFF_EQUAL, shorttext],
             [DIFF_INSERT, longtext.substring(i + shorttext.length)]];
    // Swap insertions for deletions if diff is reversed.
    if (text1.length > text2.length) {
      diffs[0][0] = diffs[2][0] = DIFF_DELETE;
    }
    return diffs;
  }

  if (shorttext.length == 1) {
    // Single character string.
    // After the previous speedup, the character can't be an equality.
    return [[DIFF_DELETE, text1], [DIFF_INSERT, text2]];
  }

  // Check to see if the problem can be split in two.
  var hm = diff_halfMatch_(text1, text2);
  if (hm) {
    // A half-match was found, sort out the return data.
    var text1_a = hm[0];
    var text1_b = hm[1];
    var text2_a = hm[2];
    var text2_b = hm[3];
    var mid_common = hm[4];
    // Send both pairs off for separate processing.
    var diffs_a = diff_main(text1_a, text2_a);
    var diffs_b = diff_main(text1_b, text2_b);
    // Merge the results.
    return diffs_a.concat([[DIFF_EQUAL, mid_common]], diffs_b);
  }

  return diff_bisect_(text1, text2);
};


/**
 * Find the 'middle snake' of a diff, split the problem in two
 * and return the recursively constructed diff.
 * See Myers 1986 paper: An O(ND) Difference Algorithm and Its Variations.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @return {Array} Array of diff tuples.
 * @private
 */
function diff_bisect_(text1, text2) {
  // Cache the text lengths to prevent multiple calls.
  var text1_length = text1.length;
  var text2_length = text2.length;
  var max_d = Math.ceil((text1_length + text2_length) / 2);
  var v_offset = max_d;
  var v_length = 2 * max_d;
  var v1 = new Array(v_length);
  var v2 = new Array(v_length);
  // Setting all elements to -1 is faster in Chrome & Firefox than mixing
  // integers and undefined.
  for (var x = 0; x < v_length; x++) {
    v1[x] = -1;
    v2[x] = -1;
  }
  v1[v_offset + 1] = 0;
  v2[v_offset + 1] = 0;
  var delta = text1_length - text2_length;
  // If the total number of characters is odd, then the front path will collide
  // with the reverse path.
  var front = (delta % 2 != 0);
  // Offsets for start and end of k loop.
  // Prevents mapping of space beyond the grid.
  var k1start = 0;
  var k1end = 0;
  var k2start = 0;
  var k2end = 0;
  for (var d = 0; d < max_d; d++) {
    // Walk the front path one step.
    for (var k1 = -d + k1start; k1 <= d - k1end; k1 += 2) {
      var k1_offset = v_offset + k1;
      var x1;
      if (k1 == -d || (k1 != d && v1[k1_offset - 1] < v1[k1_offset + 1])) {
        x1 = v1[k1_offset + 1];
      } else {
        x1 = v1[k1_offset - 1] + 1;
      }
      var y1 = x1 - k1;
      while (x1 < text1_length && y1 < text2_length &&
             text1.charAt(x1) == text2.charAt(y1)) {
        x1++;
        y1++;
      }
      v1[k1_offset] = x1;
      if (x1 > text1_length) {
        // Ran off the right of the graph.
        k1end += 2;
      } else if (y1 > text2_length) {
        // Ran off the bottom of the graph.
        k1start += 2;
      } else if (front) {
        var k2_offset = v_offset + delta - k1;
        if (k2_offset >= 0 && k2_offset < v_length && v2[k2_offset] != -1) {
          // Mirror x2 onto top-left coordinate system.
          var x2 = text1_length - v2[k2_offset];
          if (x1 >= x2) {
            // Overlap detected.
            return diff_bisectSplit_(text1, text2, x1, y1);
          }
        }
      }
    }

    // Walk the reverse path one step.
    for (var k2 = -d + k2start; k2 <= d - k2end; k2 += 2) {
      var k2_offset = v_offset + k2;
      var x2;
      if (k2 == -d || (k2 != d && v2[k2_offset - 1] < v2[k2_offset + 1])) {
        x2 = v2[k2_offset + 1];
      } else {
        x2 = v2[k2_offset - 1] + 1;
      }
      var y2 = x2 - k2;
      while (x2 < text1_length && y2 < text2_length &&
             text1.charAt(text1_length - x2 - 1) ==
             text2.charAt(text2_length - y2 - 1)) {
        x2++;
        y2++;
      }
      v2[k2_offset] = x2;
      if (x2 > text1_length) {
        // Ran off the left of the graph.
        k2end += 2;
      } else if (y2 > text2_length) {
        // Ran off the top of the graph.
        k2start += 2;
      } else if (!front) {
        var k1_offset = v_offset + delta - k2;
        if (k1_offset >= 0 && k1_offset < v_length && v1[k1_offset] != -1) {
          var x1 = v1[k1_offset];
          var y1 = v_offset + x1 - k1_offset;
          // Mirror x2 onto top-left coordinate system.
          x2 = text1_length - x2;
          if (x1 >= x2) {
            // Overlap detected.
            return diff_bisectSplit_(text1, text2, x1, y1);
          }
        }
      }
    }
  }
  // Diff took too long and hit the deadline or
  // number of diffs equals number of characters, no commonality at all.
  return [[DIFF_DELETE, text1], [DIFF_INSERT, text2]];
};


/**
 * Given the location of the 'middle snake', split the diff in two parts
 * and recurse.
 * @param {string} text1 Old string to be diffed.
 * @param {string} text2 New string to be diffed.
 * @param {number} x Index of split point in text1.
 * @param {number} y Index of split point in text2.
 * @return {Array} Array of diff tuples.
 */
function diff_bisectSplit_(text1, text2, x, y) {
  var text1a = text1.substring(0, x);
  var text2a = text2.substring(0, y);
  var text1b = text1.substring(x);
  var text2b = text2.substring(y);

  // Compute both diffs serially.
  var diffs = diff_main(text1a, text2a);
  var diffsb = diff_main(text1b, text2b);

  return diffs.concat(diffsb);
};


/**
 * Determine the common prefix of two strings.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {number} The number of characters common to the start of each
 *     string.
 */
function diff_commonPrefix(text1, text2) {
  // Quick check for common null cases.
  if (!text1 || !text2 || text1.charAt(0) != text2.charAt(0)) {
    return 0;
  }
  // Binary search.
  // Performance analysis: http://neil.fraser.name/news/2007/10/09/
  var pointermin = 0;
  var pointermax = Math.min(text1.length, text2.length);
  var pointermid = pointermax;
  var pointerstart = 0;
  while (pointermin < pointermid) {
    if (text1.substring(pointerstart, pointermid) ==
        text2.substring(pointerstart, pointermid)) {
      pointermin = pointermid;
      pointerstart = pointermin;
    } else {
      pointermax = pointermid;
    }
    pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
  }
  return pointermid;
};


/**
 * Determine the common suffix of two strings.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {number} The number of characters common to the end of each string.
 */
function diff_commonSuffix(text1, text2) {
  // Quick check for common null cases.
  if (!text1 || !text2 ||
      text1.charAt(text1.length - 1) != text2.charAt(text2.length - 1)) {
    return 0;
  }
  // Binary search.
  // Performance analysis: http://neil.fraser.name/news/2007/10/09/
  var pointermin = 0;
  var pointermax = Math.min(text1.length, text2.length);
  var pointermid = pointermax;
  var pointerend = 0;
  while (pointermin < pointermid) {
    if (text1.substring(text1.length - pointermid, text1.length - pointerend) ==
        text2.substring(text2.length - pointermid, text2.length - pointerend)) {
      pointermin = pointermid;
      pointerend = pointermin;
    } else {
      pointermax = pointermid;
    }
    pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
  }
  return pointermid;
};


/**
 * Do the two texts share a substring which is at least half the length of the
 * longer text?
 * This speedup can produce non-minimal diffs.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {Array.<string>} Five element Array, containing the prefix of
 *     text1, the suffix of text1, the prefix of text2, the suffix of
 *     text2 and the common middle.  Or null if there was no match.
 */
function diff_halfMatch_(text1, text2) {
  var longtext = text1.length > text2.length ? text1 : text2;
  var shorttext = text1.length > text2.length ? text2 : text1;
  if (longtext.length < 4 || shorttext.length * 2 < longtext.length) {
    return null;  // Pointless.
  }

  /**
   * Does a substring of shorttext exist within longtext such that the substring
   * is at least half the length of longtext?
   * Closure, but does not reference any external variables.
   * @param {string} longtext Longer string.
   * @param {string} shorttext Shorter string.
   * @param {number} i Start index of quarter length substring within longtext.
   * @return {Array.<string>} Five element Array, containing the prefix of
   *     longtext, the suffix of longtext, the prefix of shorttext, the suffix
   *     of shorttext and the common middle.  Or null if there was no match.
   * @private
   */
  function diff_halfMatchI_(longtext, shorttext, i) {
    // Start with a 1/4 length substring at position i as a seed.
    var seed = longtext.substring(i, i + Math.floor(longtext.length / 4));
    var j = -1;
    var best_common = '';
    var best_longtext_a, best_longtext_b, best_shorttext_a, best_shorttext_b;
    while ((j = shorttext.indexOf(seed, j + 1)) != -1) {
      var prefixLength = diff_commonPrefix(longtext.substring(i),
                                           shorttext.substring(j));
      var suffixLength = diff_commonSuffix(longtext.substring(0, i),
                                           shorttext.substring(0, j));
      if (best_common.length < suffixLength + prefixLength) {
        best_common = shorttext.substring(j - suffixLength, j) +
            shorttext.substring(j, j + prefixLength);
        best_longtext_a = longtext.substring(0, i - suffixLength);
        best_longtext_b = longtext.substring(i + prefixLength);
        best_shorttext_a = shorttext.substring(0, j - suffixLength);
        best_shorttext_b = shorttext.substring(j + prefixLength);
      }
    }
    if (best_common.length * 2 >= longtext.length) {
      return [best_longtext_a, best_longtext_b,
              best_shorttext_a, best_shorttext_b, best_common];
    } else {
      return null;
    }
  }

  // First check if the second quarter is the seed for a half-match.
  var hm1 = diff_halfMatchI_(longtext, shorttext,
                             Math.ceil(longtext.length / 4));
  // Check again based on the third quarter.
  var hm2 = diff_halfMatchI_(longtext, shorttext,
                             Math.ceil(longtext.length / 2));
  var hm;
  if (!hm1 && !hm2) {
    return null;
  } else if (!hm2) {
    hm = hm1;
  } else if (!hm1) {
    hm = hm2;
  } else {
    // Both matched.  Select the longest.
    hm = hm1[4].length > hm2[4].length ? hm1 : hm2;
  }

  // A half-match was found, sort out the return data.
  var text1_a, text1_b, text2_a, text2_b;
  if (text1.length > text2.length) {
    text1_a = hm[0];
    text1_b = hm[1];
    text2_a = hm[2];
    text2_b = hm[3];
  } else {
    text2_a = hm[0];
    text2_b = hm[1];
    text1_a = hm[2];
    text1_b = hm[3];
  }
  var mid_common = hm[4];
  return [text1_a, text1_b, text2_a, text2_b, mid_common];
};


/**
 * Reorder and merge like edit sections.  Merge equalities.
 * Any edit section can move as long as it doesn't cross an equality.
 * @param {Array} diffs Array of diff tuples.
 */
function diff_cleanupMerge(diffs) {
  diffs.push([DIFF_EQUAL, '']);  // Add a dummy entry at the end.
  var pointer = 0;
  var count_delete = 0;
  var count_insert = 0;
  var text_delete = '';
  var text_insert = '';
  var commonlength;
  while (pointer < diffs.length) {
    switch (diffs[pointer][0]) {
      case DIFF_INSERT:
        count_insert++;
        text_insert += diffs[pointer][1];
        pointer++;
        break;
      case DIFF_DELETE:
        count_delete++;
        text_delete += diffs[pointer][1];
        pointer++;
        break;
      case DIFF_EQUAL:
        // Upon reaching an equality, check for prior redundancies.
        if (count_delete + count_insert > 1) {
          if (count_delete !== 0 && count_insert !== 0) {
            // Factor out any common prefixies.
            commonlength = diff_commonPrefix(text_insert, text_delete);
            if (commonlength !== 0) {
              if ((pointer - count_delete - count_insert) > 0 &&
                  diffs[pointer - count_delete - count_insert - 1][0] ==
                  DIFF_EQUAL) {
                diffs[pointer - count_delete - count_insert - 1][1] +=
                    text_insert.substring(0, commonlength);
              } else {
                diffs.splice(0, 0, [DIFF_EQUAL,
                                    text_insert.substring(0, commonlength)]);
                pointer++;
              }
              text_insert = text_insert.substring(commonlength);
              text_delete = text_delete.substring(commonlength);
            }
            // Factor out any common suffixies.
            commonlength = diff_commonSuffix(text_insert, text_delete);
            if (commonlength !== 0) {
              diffs[pointer][1] = text_insert.substring(text_insert.length -
                  commonlength) + diffs[pointer][1];
              text_insert = text_insert.substring(0, text_insert.length -
                  commonlength);
              text_delete = text_delete.substring(0, text_delete.length -
                  commonlength);
            }
          }
          // Delete the offending records and add the merged ones.
          if (count_delete === 0) {
            diffs.splice(pointer - count_insert,
                count_delete + count_insert, [DIFF_INSERT, text_insert]);
          } else if (count_insert === 0) {
            diffs.splice(pointer - count_delete,
                count_delete + count_insert, [DIFF_DELETE, text_delete]);
          } else {
            diffs.splice(pointer - count_delete - count_insert,
                count_delete + count_insert, [DIFF_DELETE, text_delete],
                [DIFF_INSERT, text_insert]);
          }
          pointer = pointer - count_delete - count_insert +
                    (count_delete ? 1 : 0) + (count_insert ? 1 : 0) + 1;
        } else if (pointer !== 0 && diffs[pointer - 1][0] == DIFF_EQUAL) {
          // Merge this equality with the previous one.
          diffs[pointer - 1][1] += diffs[pointer][1];
          diffs.splice(pointer, 1);
        } else {
          pointer++;
        }
        count_insert = 0;
        count_delete = 0;
        text_delete = '';
        text_insert = '';
        break;
    }
  }
  if (diffs[diffs.length - 1][1] === '') {
    diffs.pop();  // Remove the dummy entry at the end.
  }

  // Second pass: look for single edits surrounded on both sides by equalities
  // which can be shifted sideways to eliminate an equality.
  // e.g: A<ins>BA</ins>C -> <ins>AB</ins>AC
  var changes = false;
  pointer = 1;
  // Intentionally ignore the first and last element (don't need checking).
  while (pointer < diffs.length - 1) {
    if (diffs[pointer - 1][0] == DIFF_EQUAL &&
        diffs[pointer + 1][0] == DIFF_EQUAL) {
      // This is a single edit surrounded by equalities.
      if (diffs[pointer][1].substring(diffs[pointer][1].length -
          diffs[pointer - 1][1].length) == diffs[pointer - 1][1]) {
        // Shift the edit over the previous equality.
        diffs[pointer][1] = diffs[pointer - 1][1] +
            diffs[pointer][1].substring(0, diffs[pointer][1].length -
                                        diffs[pointer - 1][1].length);
        diffs[pointer + 1][1] = diffs[pointer - 1][1] + diffs[pointer + 1][1];
        diffs.splice(pointer - 1, 1);
        changes = true;
      } else if (diffs[pointer][1].substring(0, diffs[pointer + 1][1].length) ==
          diffs[pointer + 1][1]) {
        // Shift the edit over the next equality.
        diffs[pointer - 1][1] += diffs[pointer + 1][1];
        diffs[pointer][1] =
            diffs[pointer][1].substring(diffs[pointer + 1][1].length) +
            diffs[pointer + 1][1];
        diffs.splice(pointer + 1, 1);
        changes = true;
      }
    }
    pointer++;
  }
  // If shifts were made, the diff needs reordering and another shift sweep.
  if (changes) {
    diff_cleanupMerge(diffs);
  }
};


var diff = diff_main;
diff.INSERT = DIFF_INSERT;
diff.DELETE = DIFF_DELETE;
diff.EQUAL = DIFF_EQUAL;


module.exports = diff;

},{}],11:[function(_dereq_,module,exports){
module.exports={
  "name": "rich-text",
  "version": "1.0.2",
  "description": "Format for representing rich text documents and changes.",
  "author": {
    "name": "Jason Chen",
    "email": "jhchen7@gmail.com"
  },
  "homepage": "https://github.com/ottypes/rich-text",
  "main": "index.js",
  "dependencies": {
    "fast-diff": "~1.0.0"
  },
  "devDependencies": {
    "chai": "~1.9.1",
    "coveralls": "~2.11.1",
    "grunt": "~0.4.5",
    "istanbul": "~0.3.0",
    "lodash": "~2.4.1",
    "mocha": "~1.21.4",
    "ot-fuzzer": "~1.0.0"
  },
  "engines": {
    "node": ">=0.10"
  },
  "license": "MIT",
  "scripts": {
    "test": "grunt test"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/ottypes/rich-text"
  },
  "bugs": {
    "url": "https://github.com/ottypes/rich-text/issues"
  },
  "keywords": [
    "rich text",
    "ot",
    "operational transform",
    "delta"
  ],
  "_id": "rich-text@1.0.2",
  "dist": {
    "shasum": "f4b7301cdcc6918d980e6a063389202d726213f2",
    "tarball": "http://registry.npmjs.org/rich-text/-/rich-text-1.0.2.tgz"
  },
  "_from": "rich-text@1.0.x",
  "_npmVersion": "1.3.14",
  "_npmUser": {
    "name": "jhchen",
    "email": "jhchen7@gmail.com"
  },
  "maintainers": [
    {
      "name": "jhchen",
      "email": "jhchen7@gmail.com"
    }
  ],
  "directories": {},
  "_shasum": "f4b7301cdcc6918d980e6a063389202d726213f2",
  "_resolved": "https://registry.npmjs.org/rich-text/-/rich-text-1.0.2.tgz"
}

},{}]},{},[1])
(1)
});