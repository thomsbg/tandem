# Copyright (c) 2012, Salesforce.com, Inc.  All rights reserved.
#
# Redistribution and use in source and binary forms, with or without
# modification, are permitted provided that the following conditions are met:
#
# Redistributions of source code must retain the above copyright notice, this
# list of conditions and the following disclaimer.  Redistributions in binary
# form must reproduce the above copyright notice, this list of conditions and
# the following disclaimer in the documentation and/or other materials provided
# with the distribution.  Neither the name of Salesforce.com nor the names of
# its contributors may be used to endorse or promote products derived from this
# software without specific prior written permission.

_             = require('lodash')
async         = require('async')
TandemAdapter = require('./adapter')
TandemEmitter = require('../emitter')


_authenticate = (socket, packet, callback) ->
  @storage.authorize(packet, (err) =>
    if err?
      err = err.message if _.isObject(err)
    else
      this.join(socket.id, packet.fileId)
    callback({ error: err })
  )


class TandemSocket extends TandemAdapter
  constructor: (@fileManager, @storage, options) ->
    @files = {}
    @sockets = {}
    @io = options.io
    @io.on('connection', (socket) =>
      @sockets[socket.id] = socket
      socket.on('auth', (packet, callback) =>
        _authenticate.call(this, socket, packet, callback)
      )
    )

  join: (sessionId, fileId) ->
    socket = @sockets[sessionId]
    @files[sessionId] = fileId
    socket.on('disconnect', this.leave.bind(this, sessionId, fileId))
    _.each(TandemAdapter.routes, (route, name) =>
      socket.removeAllListeners(route)
      socket.on(route, (packet, callback) =>
        this.handle(route, @files[sessionId], packet, (err, callbackPacket, broadcastPacket) =>
          TandemEmitter.emit(TandemEmitter.events.ERROR, err) if err?
          callback(callbackPacket) if callback?
          socket.to(fileId).emit(route, broadcastPacket) if broadcastPacket?
        )
      )
    )
    socket.join(fileId)

  leave: (sessionId, fileId) ->
    socket = @sockets[sessionId]
    socket.leave(fileId) if socket?
    delete @sockets[sessionId]
    delete @files[sessionId]


module.exports = TandemSocket
