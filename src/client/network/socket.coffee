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

_ = require('lodash')
socketio = require('socket.io-client')
TandemAdapter = require('./adapter')


authenticate = ->
  authPacket =
    auth: @authObj
    fileId: @fileId
    userId: @userId
  info.call(this, "Attempting auth to", @fileId, authPacket)
  @socket.emit('auth', authPacket, (response) =>
    unless response.error?
      info.call(this, "Connected!", response)
      this.setReady() if @ready == false
    else
      this.emit(TandemAdapter.events.ERROR, response.error)
  )

info = (args...) ->
  return unless @settings.debug
  return unless console?.info?
  if _.isFunction(console.info.apply)
    console.info(args...)
  else
    console.info(args)

track = (type, route, packet) ->
  @stats[type] = {} unless @stats[type]?
  @stats[type][route] = 0  unless @stats[type][route]?
  @stats[type][route] += 1


class TandemSocketAdapter extends TandemAdapter
  @CALLBACK : 'callback'
  @RECIEVE  : 'recieve'
  @SEND     : 'send'

  @DEFAULTS:
    debug: false
    latency: 0

  constructor: (endpointUrl, @fileId, @userId, @authObj, options = {}) ->
    super
    options = _.pick(options, _.keys(TandemSocketAdapter.DEFAULTS).concat(_.keys(TandemSocketAdapter.IO_DEFAULTS)))
    @settings = _.extend({}, TandemSocketAdapter.DEFAULTS, options)
    @socketListeners = {}
    @stats =
      send     : {}
      recieve  : {}
      callback : {}
    socketOptions = _.clone(@settings)
    @socket = socketio(endpointUrl, socketOptions)
    @socket.on('reconnecting', =>
      this.emit(TandemAdapter.events.RECONNECTING)
      @ready = false
    ).on('reconnect', =>
      this.emit(TandemAdapter.events.RECONNECT)
      authenticate.call(this) if @ready == false
    ).on('disconnect', =>
      this.emit(TandemAdapter.events.DISCONNECT)
    )
    authenticate.call(this)

  close: ->
    super
    @socket.removeAllListeners()
    @socketListeners = {}

  listen: (route, callback) ->
    onSocketCallback = (packet) =>
      info.call(this, "Got", route, packet)
      track.call(this, TandemSocketAdapter.RECIEVE, route, packet)
      callback.call(this, packet) if callback?
    @socket.off(route, onSocketCallback) if @socketListeners[route]?
    @socketListeners[route] = onSocketCallback
    @socket.on(route, onSocketCallback)
    return this

  send: (route, packet, callback) ->
    track.call(this, TandemSocketAdapter.SEND, route, packet)
    setTimeout( =>
      if callback?
        @socket.emit(route, packet, (response) =>
          track.call(this, TandemSocketAdapter.CALLBACK, route, response)
          info.call(this, 'Callback:', response)
          callback.call(this, response)
        )
      else
        @socket.emit(route, packet)
    , @settings.latency)


module.exports = TandemSocketAdapter
