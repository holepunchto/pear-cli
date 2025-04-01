#!/usr/bin/env node
const Hypercore = require('hypercore')
const HypercoreID = require('hypercore-id-encoding')
const os = require('os')
const path = require('path')
const fs = require('fs')
const { isWindows, isLinux, isMac, platform, arch } = require('which-runtime')
const goodbye = require('graceful-goodbye')
const speedometer = require('speedometer')
const byteSize = require('tiny-byte-size')

const isTTY = process.stdout.isTTY

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
  const warning = `[ WARNING ] To complete Pear installation, prepend the following to the system ${isWindows ? 'Path environment variable' : '$PATH'}:
${BIN}
Until then, this executable spawns the ${'`pear`'} binary.
Fix automatically with: pear run pear://runtime`
  console.error(warning)
  let child = null
  const childProcessExit = new Promise((resolve) => {
    child = require('child_process').spawn(CURRENT_BIN, process.argv.slice(2), {
      stdio: 'inherit'
    }).on('exit', function (code) {
      resolve(code)
    })
  })
  goodbye(async () => {
    child.kill()
    const code = await childProcessExit
    process.exit(code)
  })
} else {
  if (isLinux && !libatomicCheck()) {
    console.log('Installation failed. The required library libatomic.so may not be installed or was not found on the system.')
    console.log(`
Please install it first using the appropriate package manager for your system.

- Debian/Ubuntu:   sudo apt install libatomic1
- Fedora:          sudo dnf install libatomic
- Arch Linux:      sudo pacman -S libatomic_ops
- Alpine Linux:    sudo apk add libatomic
- RHEL/CentOS:     sudo yum install libatomic
`)
    process.exit(1)
  }
  const bootstrap = require('pear-updater-bootstrap')

  console.log('Installing Pear Runtime (Please stand by, this might take a bit...)\n')
  if (PEAR_KEY !== PROD_KEY) console.log('Bootstrapping:', PEAR_KEY)
  bootstrap(PEAR_KEY, PEAR_DIR, { onupdater: startDriveMonitor }).then(function () {
    stopDriveMonitor()
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
  })
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

let monitorInterval = null

function clear () {
  process.stdout.clearLine()
  process.stdout.cursorTo(0)
}

function stopDriveMonitor () {
  clearInterval(monitorInterval)
  if (isTTY) clear()
}

function startDriveMonitor (updater) {
  if (!isTTY) return

  const downloadSpeedometer = speedometer()
  const uploadSpeedometer = speedometer()
  let peers = 0
  let downloadedBytes = 0
  let uploadedBytes = 0

  updater.drive.getBlobs().then(blobs => {
    blobs.core.on('download', (_index, bytes) => {
      downloadedBytes += bytes
      downloadSpeedometer(bytes)
    })
    blobs.core.on('upload', (_index, bytes) => {
      uploadedBytes += bytes
      uploadSpeedometer(bytes)
    })
    blobs.core.on('peer-add', () => {
      peers = blobs.core.peers.length
    })
    blobs.core.on('peer-remove', () => {
      peers = blobs.core.peers.length
    })
  }).catch(() => {
    // ignore
  })

  monitorInterval = setInterval(() => {
    clear()
    process.stdout.write(`[⬇ ${byteSize(downloadedBytes)} - ${byteSize(downloadSpeedometer())}/s - ${peers} peers] [⬆ ${byteSize(uploadedBytes)} - ${byteSize(uploadSpeedometer())}/s - ${peers} peers]`)
  }, 500)
}

function libatomicCheck () {
  try {
    require('rocksdb-native')
    return true
  } catch () {
    return false
  }
}
