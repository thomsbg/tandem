_            = require('underscore')._
async        = require('async')
EventEmitter = require('events').EventEmitter
Tandem       = require('tandem-core')

atomic = (fn) ->
  async.until( =>
    @locked == false
  , (callback) =>
    setTimeout(callback, 100)
  , =>
    @locked = true
    fn( =>
      @locked = false
    )
  )

class TandemServerEngine extends EventEmitter
  @events:
    UPDATE: 'update'

  constructor: (@head, @version, @cache, callback) ->
    @id = _.uniqueId('engine-')
    @locked = false
    atomic.call(this, (done) =>
      @cache.get('versionLoaded', (err, versionLoaded) =>
        if err?
          callback(err)
          return done()
        if versionLoaded?
          @versionLoaded = parseInt(versionLoaded)
          @cache.range('history', @version - @versionLoaded, (err, range) =>
            if err?
              callback(err)
              return done()
            _.each(range, (delta) =>
              delta = Tandem.Delta.makeDelta(JSON.parse(delta))
              @head = @head.compose(delta)
              @version += 1
            )
            callback(null, this)
            done()
          )
        else
          @versionLoaded = @version
          @cache.set('versionLoaded', @version, (err) =>
            callback(err, this)
            done()
          )
      )
    )

  getDeltaSince: (version, callback) ->
    return callback("Negative version") if version < 0
    return callback(null, @head, @version) if version == 0
    return callback(null, Tandem.Delta.getIdentity(@head.endLength), @version) if version == @version
    version -= @versionLoaded
    @cache.range('history', version, (err, range) =>
      return callback(err) if err?
      return callback("No version #{version + @versionLoaded} in history of [#{@versionLoaded} - #{@version}]") if range.length == 0
      range = _.map(range, (delta) ->
        return Tandem.Delta.makeDelta(JSON.parse(delta))
      )
      firstHist = range.shift(range)
      delta = _.reduce(range, (delta, hist) ->
        return delta.compose(hist)
      , firstHist)
      return callback(null, delta, @version)
    )

  transform: (delta, version, callback) ->
    version -= @versionLoaded
    return callback("No version in history") if version < 0
    delta = this.indexesToDelta(delta) if _.isArray(delta)
    @cache.range('history', version, (err, range) =>
      range = _.map(range, (delta) ->
        return Tandem.Delta.makeDelta(JSON.parse(delta))
      )
      delta = _.reduce(range, (delta, hist) ->
        return delta.follows(hist, true)
      , delta)
      return callback(null, delta, @version)
    )
    
  update: (delta, version, callback) ->
    atomic.call(this, (done) =>
      this.transform(delta, version, (err, delta, version) =>
        if err?
          callback(err)
          return done()
        if @head.canCompose(delta)
          @head = @head.compose(delta)
          @cache.push('history', JSON.stringify(delta), (err, length) =>
            @version += 1
            callback(null, delta, @version)
            this.emit(TandemServerEngine.events.UPDATE, delta, version)
            done()
          )
        else
          callback({ message: "Cannot compose deltas", head: @head, delta: delta })
          done()
      )
    )


module.exports = TandemServerEngine
