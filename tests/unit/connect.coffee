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

_       = require('lodash')
expect  = require('chai').expect
http    = require('http')
socketio = require('socket.io')
TandemClient = require('../client')
TandemServer = require('../../index')

describe('Connection', ->
  httpServer = server = client = null

  beforeEach( ->
    httpServer = http.createServer()
    httpServer.listen(9090)
    io = socketio(httpServer)
    server = new TandemServer.Server({ io: io })
    client = new TandemClient.Client('http://localhost:9090')
  )

  afterEach( ->
    httpServer.close()
  )

  it('should connect', (done) ->
    file = client.open('connect-test')
    file.on(TandemClient.File.events.READY, ->
      expect(file.health).to.equal(TandemClient.File.health.HEALTHY)
      file.close()
      done()
    )
  )

  it('should detect disconnect', (done) ->
    file = client.open('disconnect-test')
    file.on(TandemClient.File.events.READY, ->
      expect(file.health).to.equal(TandemClient.File.health.HEALTHY)
      client.adapter.socket.disconnect()
      expect(Object.keys(server.network.files).length).to.equal(1)
      setTimeout( =>
        expect(Object.keys(server.network.files).length).to.equal(0)
        done()
      , 100)
    )
  )
)
