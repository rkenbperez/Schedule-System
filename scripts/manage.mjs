#!/usr/bin/env node
// Runs Django's manage.py with the project's virtualenv interpreter.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const python = process.platform === 'win32'
  ? join(root, 'backend', '.venv', 'Scripts', 'python.exe')
  : join(root, 'backend', '.venv', 'bin', 'python')

if (!existsSync(python)) {
  console.error('Missing backend virtualenv at backend/.venv')
  console.error('Create it with:')
  console.error('  python3 -m venv backend/.venv')
  console.error('  backend/.venv/bin/pip install -r backend/requirements.txt')
  process.exit(1)
}

const child = spawn(python, ['backend/manage.py', ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
})

child.on('exit', (code) => process.exit(code ?? 0))
