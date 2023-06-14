#!/usr/bin/env node
const os = require('os')
const path = require('path')
const fs = require('fs')
const isMac = process.platform === 'darwin'
const isWin = process.platform === 'win32'
const PEAR_DIR = isMac
  ? path.join(os.homedir(), 'Library', 'Application Support', 'pear')
  : (isWin ? path.join(os.homedir(), 'AppData', 'Roaming', 'pear') : path.join(os.homedir(), '.config', 'pear'))
const KEY = '6ffaz8tspp366sqgmqn63x3oakhrhc7rg5guycjxt5qbqns6ckwo'
// const KEY = '6yepig4zxcfdhwewjb88tofi3wa6ibbr7kuq8m177e936hd8fdzy'
try {
  if (process.argv[2] === 'bootstrap') throw Object.assign(new Error('rebootstrap'), { code: 'REBOOTSTRAP' })
  const unixResolve = require('unix-path-resolve')
  const bin = path.join(PEAR_DIR, 'bin')
  let swapbin = null
  try {
    swapbin = fs.realpathSync(bin)
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
    const err = new Error('This is nongui mode. Completion pending integration with bare. Run pear bootstrap to recover.')
    err.code = 'NOT_IMPLEMENTED'
    throw err
  }

  process.argv.push('--platform-dir', PEAR_DIR)

  const swap = path.join(swapbin, '..', '..')
  require.main.path = swap
  const bootjs = unixResolve(swap, 'boot.js')
  require(bootjs)
} catch (err) {
  if (err.code !== 'MODULE_NOT_FOUND' && err.code !== 'REBOOTSTRAP' && err.code !== 'NOT_IMPLEMENTED') {
    console.error(err)
    process.exit(1)
  }
  if (process.argv.includes('--runtime')) process.argv.splice(process.argv.indexOf('--runtime'), 2)
  const Corestore = require('corestore')
  const Bootdrive = require('@holepunchto/boot-drive')
  const Hyperdrive = require('hyperdrive')
  const Hyperswarm = require('hyperswarm')
  const Localdrive = require('localdrive')
  const goodbye = require('graceful-goodbye')
  const byteSize = require('tiny-byte-size')
  const { decode } = require('hypercore-id-encoding')

  async function cmd () {
    const argv = process.argv.slice(2)
    const positionals = argv.filter(([c]) => c !== '-')
    const [cmd] = positionals
    if (cmd !== 'bootstrap') positionals.length = 0
    const [, key = KEY, length = null, fork = null] = positionals
    if (cmd !== 'bootstrap') {
      const readline = require('readline')
      readline.emitKeypressEvents(process.stdin)
      process.stdin.setRawMode(true)
      const question = new Promise((resolve) => {
        const done = () => {
          process.stdin.setRawMode(false)
          process.stdout.write('\x1b[?25h')
          process.stdin.removeListener('keypress', keypress)
          process.stdin.pause()
          resolve(options[index])
        }
        const options = [
          { value: 'Full', name: 'full', selected: true },
          { value: 'Non-GUI', name: 'nongui', selected: false },
          { value: 'Quit', name: 'quit', selected: false }
        ]
        let index = 0
        const printOptions = () => {
          for (let i = 0; i < options.length; i++) {
            const option = options[i]
            const prefix = option.selected ? '> ' : '  '
            process.stdout.write(`${prefix}${option.value}\n`)
          }
        }

        process.stdout.write('🍐 Pear will bootstrap from peers. To get started, choose:\n')
        printOptions()
        process.stdout.write('\x1b[?25l')

        process.stdin.on('keypress', keypress)
        function keypress (key, info) {
          if (info.name === 'return') {
            done()
            return
          }
          options[index].selected = false
          if (info.ctrl && info.name === 'c') {
            index = 2
            options[index].selected = true
            done()
            return
          }
          if (info.name === 'up') {
            index = (index - 1 + options.length) % options.length
          } else if (info.name === 'down') {
            index = (index + 1) % options.length
          }
          options[index].selected = true
          process.stdout.moveCursor(0, -options.length)
          printOptions()
        }
      })

      const answer = await question

      if (answer.name === 'quit') {
        console.log('🔧 Run pear bootstrap to initialize Pear')
        argv.push('--help')
      }
      if (answer.name === 'nongui') argv.push('--nongui')
    }

    if ((argv.includes('--help') || argv.includes('-h'))) {
      console.log(`
    Usage: pear bootstrap [key|dir] [length] [fork] [...flags]
    
    key             - optional custom remote codebase key
    length          - seq length (version number), default latest
    fork            - fork number, default latest
    
    --nongui        - Server mode only. No GUI runtime.
    --help, -h      - Output usage information
    `)
      process.exit(0)
    }

    const skipRuntime = argv.includes('--nongui')
    const info = skipRuntime ? ' (nongui)' : ''
    const iterable = pearstrap({ key, length, fork, skipRuntime, info })
    process.stdout.write('🍐 ')
    try {
      for await (const output of iterable) process.stdout.write(output)
    } catch (err) {
      if (err.message === 'ENOENT: /boot.js') {
        console.error('🚫 Connection Error - unable to connect to core (' + key + ')')
        process.exit(1)
      }
      throw err
    }
  }

  cmd().catch(console.error)

  async function * pearstrap ({
    key, length = null, fork = null, info = '', skipRuntime
  } = {}) {
    const checkout = { key, length, fork }

    yield `Creating/Updating${info}:\n`

    const bydkey = path.join(PEAR_DIR, 'by-dkey')
    const store = path.join(PEAR_DIR, 'corestores', 'platform')

    const platformDir = new Localdrive(PEAR_DIR)
    goodbye(() => platformDir.close())
    await platformDir.ready()

    let codebase = new Hyperdrive(new Corestore(store), decode(key))

    const swarm = new Hyperswarm()
    goodbye(() => swarm.destroy())

    swarm.on('connection', (socket) => { codebase.corestore.replicate(socket) })
    await codebase.ready()

    const dkey = codebase.discoveryKey.toString('hex')
    const release = path.join(bydkey, dkey)

    let latest = 'swap-0'
    for await (const swap of platformDir.readdir(`/by-dkey/${dkey}`)) {
      if (swap.startsWith('swap-') === false) continue
      latest = swap
    }

    const swap = path.join(release, latest)

    await platformDir.symlink('/bin', `./by-dkey/${dkey}/${latest}/bin/${process.platform}-${process.arch}`)

    swarm.join(codebase.discoveryKey, { server: false, client: true })
    const done = codebase.corestore.findingPeers()
    swarm.flush().then(done, done)

    await codebase.core.update() // make sure we have latest version

    codebase = codebase.checkout(codebase.version)
    goodbye(() => codebase.close())

    await codebase.ready()

    if (checkout.length === null) {
      checkout.length = codebase.version
      checkout.fork = codebase.core.fork
    }

    const width = 40
    let prefix = '/bin/' + process.platform + '-' + process.arch + '/'
    let completed = 0

    if (await codebase.get('/boot.js') === null) {
      yield '  🚫 Couldn\'t get entrypoint /boot.js.\n     Either no such file exists or it\'s not available on the network\n'
      process.exit(1)
    }

    if (codebase.download) {
      yield '  Downloading/Updating platform codebase please wait\n\n'
      let total = 0
      const dls = []
      for await (const entry of codebase.list('/', { recursive: true })) {
        if (!entry.value.blob) continue
        if (entry.key.startsWith('/bin') && entry.key.startsWith(prefix) === false) continue
        total++
      }

      for await (const entry of codebase.list('/', { recursive: true })) {
        if (!entry.value.blob) continue
        if (entry.key.startsWith('/bin') && entry.key.startsWith(prefix) === false) continue
        const blobs = await codebase.getBlobs()
        const r = blobs.core.download({ start: entry.value.blob.blockOffset, length: entry.value.blob.blockLength })
        const dl = r.downloaded()
        dls.push(dl)
        dl.then(() => { completed++ })
        const progress = Math.floor((completed / total) * width)
        const bar = `  [${'='.repeat(progress)}${' '.repeat(width - progress)}] ${Math.round(progress * (100 / width))}% | ${completed}/${total} files dl'd`
        const status = '\x1B[1A\x1B[2K\x1B[200D  ↯ ' + entry.key + ' [' + byteSize(entry.value.blob.byteLength) + ']'
        yield status.slice(0, process.stdout.columns) + '\n\x1b[K' + bar
      }

      yield '\x1b[1A\x1B[2K\x1B[200D  Downloading ' + total + ' files:\x1B[0J'

      const settled = Promise.allSettled(dls)

      /* eslint-disable no-unmodified-loop-condition */
      while (completed < total) {
        const progress = Math.floor((completed / total) * width)
        const bar = `  [${'='.repeat(progress)}${' '.repeat(width - progress)}] ${Math.round(progress * (100 / width))}% | ${completed}/${total} files dl'd`
        yield '\x1B[2K\x1B[200D' + bar
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      /* eslint-enable no-unmodified-loop-condition */

      await settled
      yield '\x1b[1A\x1B[2K\x1B[200D  Download Complete\x1B[0J'
    }

    if (skipRuntime === false) {
      yield '\n  Extracting platform runtime\n'

      const dest = new Localdrive(swap)
      if (isMac) prefix += 'Holepunch Runtime.app'
      else prefix += 'holepunch-runtime'

      const runtime = codebase.mirror(dest, {
        prefix: '/bin',
        filter (key) {
          return key.startsWith(`/bin/${process.platform}-${process.arch}`)
        }
      })
      for await (const { op, key, bytesAdded } of runtime) {
        if (op === 'add') {
          yield '\x1B[2K\x1B[200D  \x1B[32m+\x1B[39m ' + key + ' [' + byteSize(bytesAdded) + ']'
        } else if (op === 'change') {
          yield '\x1B[2K\x1B[200D  \x1B[33m~\x1B[39m ' + key + ' [' + byteSize(bytesAdded) + ']'
        } else if (op === 'remove') {
          yield '\x1B[2K\x1B[200D  \x1B[31m-\x1B[39m ' + key + ' [' + byteSize(bytesAdded) + ']'
        }
      }

      yield '\x1B[2K\x1B[200D  Runtime extraction complete\x1b[K\n'
    }

    yield '  Generating bootstrap files\n'

    const checkoutjs = `module.exports = {key: '${checkout.key}', fork: ${checkout.fork}, length: ${checkout.length}}`
    yield '   ↳ key: ' + checkout.key + '\n     fork: ' + checkout.fork + '\n     length: ' + checkout.length + '\n'

    const boot = new Bootdrive(codebase, {
      entrypoint: 'boot.js',
      additionalBuiltins: ['electron'], // gunk.js requires lib/electron.js
      cwd: swap,
      sourceOverwrites: {
        '/checkout.js': Buffer.from(checkoutjs)
      }
    })

    await boot.warmup()

    const bootjs = boot.stringify()

    yield '  Copying bootstrap files\n'

    await platformDir.put(`./by-dkey/${dkey}/${latest}/boot.js`, bootjs)

    const preferences = 'preferences.json'
    if (await platformDir.entry(preferences) === null) await platformDir.put(preferences, Buffer.from('{}'))

    await platformDir.close()
    await codebase.close()
    await swarm.destroy()

    yield 'Done\n'
  }
}
