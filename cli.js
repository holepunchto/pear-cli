#!/usr/bin/env node
const os = require('os')
const path = require('path')
const PEAR_DIR = process.platform === 'darwin'
  ? path.join(os.homedir(), 'Library', 'Application Support', 'Pear')
  : (process.platform === 'win32' ? path.join(os.homedir(), 'AppData', 'Roaming', 'pear') : path.join(os.homedir(), '.config', 'pear'))

try {
  if (process.argv[2] === 'bootstrap') throw Object.assign(new Error('rebootstrap'), { code: 'REBOOTSTRAP' })
  const fs = require('fs')
  const hdir = path.join(PEAR_DIR, 'holestrap', 'Holepunch')
  const swap0 = path.join(hdir, 'platform', 'stable', 'swap-0')
  const nongui = fs.existsSync(path.join(swap0, 'bin')) === false
  if (nongui) process.argv.push('--runtime', process.execPath)
  process.argv.push('--config-dir', hdir)
  require.main.path = path.join(swap0, 'bootstrap')
  const bootjs = require.resolve(`${process.platfom === 'win32' ? hdir.replace(/\\/g, '/') : hdir}/platform/stable/swap-0/bootstrap/boot.js`)
  require(bootjs)
  require.main = require.cache[bootjs]
} catch (err) {
  if (err.code !== 'MODULE_NOT_FOUND' && err.code !== 'REBOOTSTRAP') {
    console.error(err)
    process.exit(1)
  }
  if (process.argv.includes('--runtime')) process.argv.splice(process.argv.indexOf('--runtime'), 2)
  const holestrap = require('@holepunchto/holestrap')

  async function cmd () {
    const argv = process.argv.slice(2)
    const positionals = argv.filter(([c]) => c !== '-')
    const [cmd] = positionals
    if (cmd !== 'bootstrap') positionals.length = 0
    const [, key = 'a41n49cc7gxrgo4fz98141hbmukws3yehac5x5sx8hhognetsczo', length = null, fork = null] = positionals
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
    const iterable = holestrap({ cwd: PEAR_DIR, line: 'stable', key, length, fork, skipRuntime, info, exposeCli: false })
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
}
