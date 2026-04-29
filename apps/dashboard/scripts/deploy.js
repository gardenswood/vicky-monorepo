#!/usr/bin/env node
/**
 * deploy.js — Script de deploy automático para el dashboard Vicky Bot
 *
 * Uso:
 *   node scripts/deploy.js           → Build y deploy a Cloud Run
 *   node scripts/deploy.js --watch   → Modo watch: despliega automáticamente cuando cambia un archivo
 *   node scripts/deploy.js --dry-run → Muestra qué haría sin ejecutar
 */

const { execSync, spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const ROOT = path.join(__dirname, '..')
const PROJECT = 'webgardens-8655d'
const DRY_RUN = process.argv.includes('--dry-run')
const WATCH = process.argv.includes('--watch')

// Files/dirs to watch for changes
const WATCH_PATTERNS = [
  'src',
  'public',
  'next.config.ts',
  'tailwind.config.ts',
  'package.json',
  'cloudbuild.yaml',
]

// Files to ignore in watch mode
const IGNORE_PATTERNS = ['node_modules', '.next', '.git', '*.log']

function log(msg, color = '\x1b[36m') {
  const reset = '\x1b[0m'
  const time = new Date().toLocaleTimeString('es-AR')
  console.log(`${color}[${time}] ${msg}${reset}`)
}

function runDeploy() {
  log('🚀 Iniciando deploy del dashboard...', '\x1b[33m')

  if (DRY_RUN) {
    log('(DRY RUN) gcloud builds submit --config=cloudbuild.yaml --project=' + PROJECT, '\x1b[35m')
    log('(DRY RUN) Deploy simulado OK', '\x1b[32m')
    return
  }

  try {
    log('📦 Enviando fuentes a Cloud Build...')
    const start = Date.now()

    const output = execSync(
      `gcloud builds submit --config=cloudbuild.yaml --project=${PROJECT}`,
      { cwd: ROOT, stdio: 'pipe', timeout: 600_000 }
    ).toString()

    const elapsed = Math.round((Date.now() - start) / 1000)
    const urlMatch = output.match(/Service URL: (https?:\/\/\S+)/)
    const url = urlMatch ? urlMatch[1] : 'https://vicky-dashboard-uh3qtftq3q-uc.a.run.app'

    log(`✅ Deploy exitoso en ${elapsed}s`, '\x1b[32m')
    log(`🌐 URL: ${url}`, '\x1b[32m')
  } catch (err) {
    log('❌ Deploy falló: ' + err.message, '\x1b[31m')
    process.exitCode = 1
  }
}

function watchAndDeploy() {
  log('👀 Modo watch activado — monitoreando cambios en src/, public/, *.config*', '\x1b[36m')
  log('   Presioná Ctrl+C para detener', '\x1b[90m')

  let debounceTimer = null
  let deploying = false
  const changedFiles = new Set()

  function scheduleDeployIfNeeded() {
    if (deploying) return
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      if (changedFiles.size === 0) return
      const files = [...changedFiles].join(', ')
      changedFiles.clear()
      log(`📝 Cambios detectados: ${files}`, '\x1b[33m')
      log('⏳ Esperando 3s para agrupar cambios...', '\x1b[90m')
      setTimeout(() => {
        if (changedFiles.size > 0) {
          scheduleDeployIfNeeded()
          return
        }
        deploying = true
        runDeploy()
        deploying = false
      }, 3000)
    }, 1000)
  }

  // Watch each pattern recursively
  const watchPaths = WATCH_PATTERNS.map(p => path.join(ROOT, p)).filter(p => fs.existsSync(p))

  watchPaths.forEach(watchPath => {
    try {
      fs.watch(watchPath, { recursive: true }, (event, filename) => {
        if (!filename) return
        // Ignore node_modules, .next, etc.
        if (IGNORE_PATTERNS.some(p => filename.includes(p.replace('*', '')))) return
        changedFiles.add(filename)
        scheduleDeployIfNeeded()
      })
    } catch {}
  })

  log(`🔍 Observando: ${watchPaths.map(p => path.relative(ROOT, p)).join(', ')}`, '\x1b[90m')

  // Initial deploy on start
  log('▶️  Ejecutando deploy inicial...', '\x1b[33m')
  runDeploy()
}

if (WATCH) {
  watchAndDeploy()
} else {
  runDeploy()
}
