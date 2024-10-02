#!/usr/bin/env node
'use strict'
const { fileURLToPath } = require('url')
const { spawn } = require('child_process')
const cwd = process.cwd()
const platform = process.platform
const BIN = 'by-arch/' + platform + '-' + process.arch + '/bin/'
const swapURL = new URL(cwd + '/', 'file://')
const isWindows = platform === 'windows'
const RUNTIME_EXEC = isWindows ? 'pear-runtime.exe' : 'pear-runtime'

const RUNTIME = toPath(new URL(BIN + RUNTIME_EXEC, swapURL))
const Pear = spawn(RUNTIME, process.argv.slice(2), { stdio: 'inherit' })
Pear.on('exit', (code) => { process.exitCode = code })

function toPath (u) {
  return fileURLToPath(u).replace(/[/\\]$/, '') || '/'
}
