#!/usr/bin/env node
const Corestore = require('corestore')
const Hypercore = require('hypercore')
const HypercoreID = require('hypercore-id-encoding')
const os = require('os')
const path = require('path')
const fs = require('fs')
const { isWindows, isLinux, isMac, platform, arch } = require('which-runtime')
const prettierBytes = require('prettier-bytes')
const Metrics = require('./metrics')
const PROD_KEY = 'pear://pqbzjhqyonxprx8hghxexnmctw75mr91ewqw5dxe1zmntfyaddqy'
const PEAR_KEY = fs.readFileSync(path.join(__dirname, 'pear.key'), { encoding: 'utf8' }).trim()
const DKEY = Hypercore.discoveryKey(HypercoreID.decode(PEAR_KEY)).toString('hex')

const HOST = platform + '-' + arch

const PEAR_DIR = isMac
  ? path.join(os.homedir(), 'Library', 'Application Support', 'pear')
  : isLinux
    ? path.join(os.homedir(), '.config', 'pear')
    : path.join(os.homedir(), 'AppData', 'Roaming', 'pear')

const LINK = path.join(PEAR_DIR, 'current')
const BIN = path.join(PEAR_DIR, 'bin')
const CURRENT_BIN = path.join(LINK, 'by-arch', HOST, 'bin/pear-runtime' + (isWindows ? '.exe' : ''))

if (isInstalled()) {
  require('child_process').spawn(CURRENT_BIN, process.argv.slice(2), {
    stdio: 'inherit'
  }).on('exit', function (code) {
    process.exit(code)
  })
} else {
  const bootstrap = require('pear-updater-bootstrap')
  const corestore = new Corestore(path.join(PEAR_DIR, 'corestores/platform'))
  const metrics = new Metrics(corestore, outputMetrics)

  function outputMetrics ({ stats = [], clear = false }) {
    process.stdout.write('\x1b[?25l') // hide cursor
    for (let i = 0; i < metrics.priorSize; i++) {
      process.stdout.write('\x1b[2K') // clear current line
      process.stdout.write('\x1b[1A') // move up one
    }
    if (stats.length === 0) {
      process.stdout.write('\x1b[K') // clear to eol
      process.stdout.write('\x1b[?25h') // show cursor
      return
    }
    if (clear === false) {
      const lines = stats.map(([key, s]) => {
        return `Core ${key.slice(0, 6)} Peers=${s.peers} Blocks=${s.blocks}/s Bytes=${prettierBytes(s.bytes)}/s`
      })
      process.stdout.write(lines.join('\x1b[K\n') + '\n')
    }
    process.stdout.write('\x1b[?25h') // show cursor
  }

  console.log('Installing Pear Runtime (Please stand by, this might take a bit...)')
  if (PEAR_KEY !== PROD_KEY) console.log('Bootstrapping:', PEAR_KEY)
  metrics.setup()
  bootstrap(PEAR_KEY, PEAR_DIR, { corestore }).then(function () {
    outputMetrics({ clear: true })
    metrics.teardown()
    console.log('Pear Runtime installed!')
    console.log()
    console.log('Finish the installation by opening the runtime app')
    console.log()
    console.log('npx pear run pear://runtime')
    if (makeBin()) {
      console.log()
      console.log('Or by adding the following to your path')
      console.log()
      if (isWindows) {
        console.log(`cmd:        set PATH="${BIN};%PATH%"`)
        console.log(`PowerShell: $env:PATH="${BIN};$env:PATH"`)
      } else {
        console.log(`export PATH="${BIN}:$PATH"`)
      }
    }
  }).finally(() => { metrics.teardown() })
}

function makeBin () {
  try {
    fs.mkdirSync(BIN, { recursive: true })

    if (isWindows) {
      fs.writeFileSync(path.join(BIN, 'pear.cmd'), `@echo off\r\n"${CURRENT_BIN}" %*`)
      fs.writeFileSync(path.join(BIN, 'pear.ps1'), `& "${CURRENT_BIN}" @args`)
    } else {
      fs.symlinkSync(CURRENT_BIN, path.join(BIN, 'pear'))
    }
  } catch {
    return false
  }
  return true
}

function isInstalled () {
  try {
    const p = fs.realpathSync(LINK)
    return path.basename(path.dirname(p)) === DKEY
  } catch {
    return false
  }
}
