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
async   = require('async')
expect  = require('chai').expect
http    = require('http')
socketio = require('socket.io')
TandemClient = require('../client')
TandemServer = require('../../index')

Storage =
  authorize: (authPacket, callback) ->
    return callback(null)
  find: (fileId, callback) ->
    switch fileId
      when 'sync-test'
        return callback(null, new TandemServer.Delta.getInitial('sync'), 5)
      when 'update-test'
        return callback(null, new TandemServer.Delta.getInitial('a'), 5)
      when 'update-conflict-test'
        return callback(null, new TandemServer.Delta.getInitial('go'), 5)
      when 'resync-test'
        return callback(null, new TandemServer.Delta.getInitial('resync'), 5)
      when 'switch-test-1'
        return callback(null, new TandemServer.Delta.getInitial('switch-test-1'), 5)
      when 'switch-test-2'
        return callback(null, new TandemServer.Delta.getInitial('switch-test-2'), 5)
      else
        return callback(null, new TandemServer.Delta.getInitial(''), 0)
  update: (fileId, head, version, deltas, callback) ->
    return callback(null)

describe('Messaging', ->
  httpServer = server = client1 = client2 = null
  
  before( ->
    httpServer = http.createServer()
    httpServer.listen(9090)
    io = socketio(httpServer)
    server = new TandemServer.Server({ io: io, storage: Storage })
    client1 = new TandemClient.Client('http://localhost:9090')
    client2 = new TandemClient.Client('http://localhost:9090')
  )

  after( ->
    httpServer.close()
  )

  it('should sync', (done) ->
    file = client1.open('sync-test')
    file.on(TandemClient.File.events.UPDATE, (delta) ->
      Storage.find('sync-test', (err, head, version) ->
        expect(delta).to.deep.equal(head)
        done()
      )
    )
  )

  it('should sync from old version', (done) ->
    file1 = client1.open('sync-from-old-test')
    # Make file have history of 5 'a' insertions
    async.timesSeries(5, (n, next) ->
      delta = new TandemClient.Delta(n, [
        new TandemClient.RetainOp(0, n)
        new TandemClient.InsertOp(String.fromCharCode('a'.charCodeAt(0) + n))
      ])
      file1.update(delta)
      async.until( ->
        return file1.inFlight.isIdentity() and file1.inLine.isIdentity()
      , (callback) ->
        setTimeout(callback, 100)
      , next)
    , (err) ->
      head = TandemClient.Delta.getInitial('ab')
      file2 = client2.open('sync-from-old-test', null, { head: head, version: 2 })
      file2.on(TandemClient.File.events.UPDATE, (delta) ->
        expected = file1.arrived.decompose(head)
        expect(delta).to.deep.equal(expected)
        done()
      )
    )
  )

  it('should update', (done) ->
    file1 = client1.open('update-test')
    file2 = client2.open('update-test')
    updateDelta = new TandemClient.Delta(1, [
      new TandemClient.RetainOp(0, 1)
      new TandemClient.InsertOp('b')
    ])
    onReady = _.after(2, ->
      file1.update(updateDelta)
    )
    file1.on(TandemClient.File.events.READY, onReady)
    file2.on(TandemClient.File.events.READY, onReady)
    sync = true
    file2.on(TandemClient.File.events.UPDATE, (delta) ->
      if sync
        sync = false
      else
        expect(delta).to.deep.equal(updateDelta)
        done()
    )
  )

  it('should resolve update conflicts', (done) ->
    Storage.find('update-conflict-test', (err, head, version) ->
      initial = { head: head, version: version }
      file1 = client1.open('update-conflict-test', null, initial)
      file2 = client2.open('update-conflict-test', null, initial)
      _.each([file1, file2], (file, i) ->
        file.on(TandemClient.File.events.HEALTH, (newHealth) ->
          expect(newHealth).to.equal(TandemClient.File.health.HEALTHY)
        )
        file.update(new TandemClient.Delta(2, [
          new TandemClient.RetainOp(0, 2)
          new TandemClient.InsertOp(if i == 0 then 'a' else 't')
        ]))
      )
      async.until(->
        file1.version == 7 and file2.version == 7
      , (callback) ->
        setTimeout(callback, 100)
      , ->
        expect(file1.arrived.endLength).to.deep.equal(4)
        expect(file2.arrived).to.deep.equal(file1.arrived)
        done()
      )
    )
  )

  it('should resync', (done) ->
    file = client1.open('resync-test')
    file.arrived = new TandemClient.Delta.getInitial('a')
    file.once(TandemClient.File.events.UPDATE, ->
      expect(file.health).to.equal(TandemClient.File.health.WARNING)
      file.on(TandemClient.File.events.HEALTH, (newHealth, oldHealth) ->
        expect(newHealth).to.equal(TandemClient.File.health.HEALTHY)
        Storage.find('resync-test', (err, head, version) ->
          expect(file.arrived).to.deep.equal(head)
          done()
        )
      )
    )
  )

  it('should switch files', (done) ->
    file1 = client1.open('switch-test-1')
    Storage.find('switch-test-1', (err, head, version) ->
      file1.once(TandemClient.File.events.UPDATE, (delta) ->
        expect(delta).to.deep.equal(head)
        file2 = client1.open('switch-test-2')
        Storage.find('switch-test-2', (err, head, version) ->
          file2.once(TandemClient.File.events.UPDATE, (delta) ->
            expect(delta).to.deep.equal(head)
            done()
          )
        )
      )
    )
  )
)
