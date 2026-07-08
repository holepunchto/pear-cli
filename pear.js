#!/usr/bin/env node
const process = require('process')
const os = require('os')
const path = require('path')
const fs = require('fs')
const { isWindows, isLinux, isMac } = require('which-runtime')
const goodbye = require('graceful-goodbye')
const byteSize = require('tiny-byte-size')

const isTTY = process.stdout.isTTY

const PEAR_KEY = 'pear://smw4thqaqed9iq6bae7a9cxd4fesruixgkafe38jny33ahs33igy'
const key = PEAR_KEY

const HOME = os.homedir()
const BIN_PATH = isWindows
  ? path.join(
      process.env.LOCALAPPDATA || path.join(HOME, 'AppData', 'Local'),
      'Programs',
      'pear'
    )
  : path.join(HOME, '.local', 'bin')
const BIN = path.join(BIN_PATH, `pear${isWindows ? '.exe' : ''}`)

if (fs.existsSync(BIN)) {
  let child = null
  const childProcessExit = new Promise((resolve) => {
    child = require('child_process')
      .spawn(BIN, process.argv.slice(2), {
        stdio: 'inherit'
      })
      .on('exit', function (code) {
        resolve(code)
      })
      .on('error', function (err) {
        console.error('Failed to run Pear:', err.message)
        resolve(1)
      })
  })
  goodbye(async () => {
    child.kill()
    const code = await childProcessExit
    process.exit(code)
  })
} else {
  if (isLinux && !libatomicCheck()) {
    console.log(
      'Installation failed. The required library libatomic.so was not found on the system.'
    )
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

  try {
    migrateFromV2()
  } catch (err) {
    console.error(err)
  }

  const Install = require('pear-install')

  console.log('Installing Pear (Please stand by, this might take a bit...)')
  console.log('Bootstrapping:', key)

  const install = new Install({ link: key })

  if (isTTY) install.on('stats', printStats)

  install.on('final', (result) => {
    if (isTTY) clear()

    if (result.success) {
      console.log('Pear installed!')
      console.log(
        'Please open a new terminal (or restart your current one) for the updated PATH to take effect.'
      )
    } else {
      console.error('Installation failed:', result)
      process.exit(1)
    }
  })

  install.on('error', (err) => {
    if (isTTY) clear()
    console.error('Installation failed:', err.message)
    process.exit(1)
  })

  install
    .ready()
    .catch((err) => {
      if (isTTY) clear()
      console.error(err.message)
    })
    .finally(() => {
      install.close()
    })
}

function clear() {
  process.stdout.write('\x1b[2K') // clear line
  process.stdout.write('\r') // cursor to 0
}

function printStats(stats) {
  if (!isTTY) return
  clear()
  process.stdout.write(
    `[⬇ ${byteSize(stats.download.bytes)} - ${byteSize(stats.download.speed)}/s - ${stats.peers} peers]`
  )
}

function libatomicCheck() {
  try {
    require('rocksdb-native')
    return true
  } catch {
    return false
  }
}

function migrateFromV2() {
  if (isWindows) return
  const oldPath = isMac
    ? path.join(os.homedir(), 'Library', 'Application Support', 'pear', 'bin')
    : path.join(os.homedir(), '.config', 'pear', 'bin')
  const oldComment = '# Added by Pear Runtime, configures system with Pear CLI'
  for (const rcPath of getRcPaths()) {
    const rc = fs.readFileSync(rcPath, 'utf8')
    const cleaned = rc
      .split('\n')
      .filter(
        (line) =>
          line.trimEnd() !== `export PATH="${oldPath}":$PATH` &&
          line.trimEnd() !== `export PATH="${oldPath}:$PATH"` &&
          line.trimEnd() !== oldComment
      )
      .join('\n')
    if (cleaned !== rc) fs.writeFileSync(rcPath, cleaned)
  }
}

function getRcPaths() {
  const home = os.homedir()

  const candidates = [
    '.zshrc',
    '.zprofile',
    '.bashrc',
    '.bash_profile',
    '.profile',
    '.kshrc',
    '.tcshrc',
    '.cshrc'
  ]

  return candidates
    .map((f) => path.join(home, f))
    .filter((p) => fs.existsSync(p))
}
