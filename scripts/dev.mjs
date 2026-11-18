#!/usr/bin/env node
// Starts the Django API and the Vite client together, with prefixed output.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { request } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const python = process.platform === 'win32'
  ? join(root, 'backend', '.venv', 'Scripts', 'python.exe')
  : join(root, 'backend', '.venv', 'bin', 'python')

if (!existsSync(python)) {
  console.error('[dev] Missing backend virtualenv at backend/.venv')
  console.error('[dev] Create it with:')
  console.error('[dev]   python3 -m venv backend/.venv')
  console.error('[dev]   backend/.venv/bin/pip install -r backend/requirements.txt')
  process.exit(1)
}

if (!existsSync(join(root, 'client', 'node_modules', '.bin'))) {
  console.error('[dev] Missing client dependencies at client/node_modules')
  console.error('[dev] Install them with: npm run install:client')
  process.exit(1)
}

const children = []

function start(name, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  children.push(child)

  const prefix = name === 'api' ? '\x1b[34m[api]\x1b[0m' : '\x1b[32m[web]\x1b[0m'
  for (const stream of [child.stdout, child.stderr]) {
    let buffer = ''
    stream.setEncoding('utf8')
    stream.on('data', (chunk) => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.trim()) console.log(`${prefix} ${line}`)
      }
    })
  }

  child.on('exit', (code) => {
    console.log(`${prefix} stopped (exit ${code ?? 0})`)
    shutdown(code ?? 0)
  })
}

let shuttingDown = false
function shutdown(code) {
  if (shuttingDown) return
  shuttingDown = true

  const active = children.filter(
    (child) => child.exitCode === null && child.signalCode === null,
  )
  if (active.length === 0) process.exit(code)

  let remaining = active.length
  for (const child of active) {
    child.once('close', () => {
      remaining -= 1
      if (remaining === 0) process.exit(code)
    })
    child.kill('SIGTERM')
  }

  // Force-kill anything that ignores SIGTERM (e.g. a stuck dev server).
  setTimeout(() => {
    for (const child of active) {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL')
      }
    }
  }, 3000).unref()
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

function isApiAlreadyRunning() {
  return new Promise((resolve) => {
    const req = request(
      { host: '127.0.0.1', port: 8000, path: '/api/', timeout: 1500 },
      (res) => {
        res.resume()
        resolve(true)
      },
    )
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
    req.end()
  })
}

if (await isApiAlreadyRunning()) {
  console.log('\x1b[2m[dev] API already running on http://localhost:8000 (using it)\x1b[0m')
} else {
  start('api', python, ['backend/manage.py', 'runserver', '127.0.0.1:8000'], root)
}

start('web', process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev'], join(root, 'client'))

console.log('\x1b[2m[dev] API  http://localhost:8000/api/\x1b[0m')
console.log('\x1b[2m[dev] Web  http://localhost:5173/\x1b[0m')
console.log('\x1b[2m[dev] Press Ctrl+C to stop.\x1b[0m')