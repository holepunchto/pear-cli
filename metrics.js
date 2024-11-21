'use strict'

class Metrics {
  _coreOpenListener = null
  _coreCloseListener = null
  _interval = null
  _maxHistory = 5
  constructor (corestore, onmetrics) {
    if (!process.stdout.isTTY) return
    this.corestore = corestore
    this.stats = new Map()
    this.ticking = false
    this.onmetrics = onmetrics
    this.priorSize = 0
  }

  setup () {
    if (!process.stdout.isTTY) return
    this._coreOpenListener = (core) => {
      if (this.ticking === false) {
        this.ticking = true
        this._tick()
      }
      const key = core.key.toString('hex')
      this.stats.set(key, {
        history: { bytes: [], blocks: [] },
        bytes: 0,
        blocks: 0,
        peers: 0
      })
      const stats = this.stats.get(key)

      core.on('peer-add', () => {
        stats.peers += 1
      })

      core.on('peer-remove', () => { stats.peers -= 1 })

      core.on('download', (_, bytes) => {
        stats.bytes += bytes
        stats.blocks++
      })
    }
    this._coreCloseListener = (core) => {
      const key = core.key.toString('hex')
      this.stats.delete(key)
    }
    this.corestore.on('core-open', this._coreOpenListener)
    this.corestore.on('core-close', this._coreCloseListener)
  }

  _tick () {
    this._interval = setInterval(() => {
      const stats = [...this.stats.entries()].reduce((acc, [key, s]) => {
        if (s.blocks === 0 && s.history.blocks.length === 0) return acc
        s.history.bytes.push(s.bytes)
        if (s.history.bytes.length > this._maxHistory) s.history.bytes.shift()
        s.history.blocks.push(s.blocks)
        if (s.history.blocks.length > this._maxHistory) s.history.blocks.shift()

        acc.push([key, {
          bytes: this._average(s.history.bytes),
          blocks: this._average(s.history.blocks),
          peers: s.peers
        }])

        s.bytes = 0
        s.blocks = 0

        return acc
      }, [])

      this.onmetrics({ stats })
      this.priorSize = stats.length
      for (const [, s] of stats) {
        s.last = { ...s }
        s.bytes = 0
        s.blocks = 0
      }
    }, 1000)
  }

  _average (arr) {
    if (arr.length === 0) return 0
    const avg = arr.reduce((sum, val) => sum + val, 0) / arr.length
    return Math.round(avg)
  }

  teardown () {
    if (!process.stdout.isTTY) return
    this.corestore.removeListener('core-open', this._coreOpenListener)
    this.corestore.removeListener('core-close', this._coreCloseListener)
    clearInterval(this._interval)
  }
}

module.exports = Metrics
