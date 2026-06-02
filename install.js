#!/usr/bin/env node
const { spawnSync } = require('child_process')
const result = spawnSync(
  'npx',
  ['-y', 'pear-install', ...process.argv.slice(2)],
  { stdio: 'inherit' }
)
process.exit(result.exitCode)
