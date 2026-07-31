#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TARGET_R_VERSION = '4.5.1'
const MINIMUM_R_VERSION = '4.2'
const BASE_R_PACKAGES = new Set([
  'R',
  'base',
  'compiler',
  'datasets',
  'grDevices',
  'graphics',
  'grid',
  'methods',
  'parallel',
  'splines',
  'stats',
  'stats4',
  'tcltk',
  'tools',
  'utils'
])
const DEPENDENCY_FIELDS = ['Depends', 'Imports', 'Suggests']
const CLOSURE_FIELDS = ['Depends', 'Imports', 'LinkingTo']
const APPROVED_RUNNERS = new Set(['ubuntu-24.04', 'macos-26'])
const ACTION_SHAS = new Map([
  ['actions/checkout', '11d5960a326750d5838078e36cf38b85af677262'],
  ['actions/setup-node', '49933ea5288caeca8642d1e84afbd3f7d6820020'],
  ['pnpm/action-setup', 'b906affcce14559ad1aafd4ab0e942779e9f58b1'],
  ['r-lib/actions', 'd3c5be51b12e724e68f33216ca3c148b66d5f0b6'],
  ['actions/cache', '0057852bfaa89a56745cba8c7296529d2fc39830'],
  ['actions/upload-artifact', 'ea165f8d65b6e75b540449e92b4886f43607fa02'],
  ['actions/download-artifact', 'd3f86a106a0bac45b974a628896c90dbdf5c8093'],
  ['softprops/action-gh-release', '3bb12739c298aeb8a4eeaf626c5b8d85266b0e65']
])

function slash(value) {
  return value.split(path.sep).join('/')
}

function parseDcf(text) {
  const fields = {}
  let current = null
  for (const line of text.split(/\r?\n/)) {
    const field = line.match(/^([^:\s][^:]*):\s*(.*)$/)
    if (field) {
      current = field[1]
      fields[current] = field[2]
    } else if (current && /^\s+/.test(line)) {
      fields[current] += ` ${line.trim()}`
    } else if (line.trim()) {
      current = null
    }
  }
  return fields
}

function dependencyNames(value) {
  if (Array.isArray(value)) value = value.join(',')
  if (typeof value !== 'string') return []
  return value
    .split(',')
    .map((entry) => entry.trim().replace(/\s*\([\s\S]*$/, ''))
    .filter(Boolean)
}

function versionAtLeast(actual, minimum) {
  const actualParts = actual.split('.').map(Number)
  const minimumParts = minimum.split('.').map(Number)
  const length = Math.max(actualParts.length, minimumParts.length)
  for (let index = 0; index < length; index += 1) {
    const actualPart = actualParts[index] ?? 0
    const minimumPart = minimumParts[index] ?? 0
    if (actualPart !== minimumPart) return actualPart > minimumPart
  }
  return true
}

function readText(repoRoot, relative, errors) {
  const target = path.join(repoRoot, relative)
  if (!fs.existsSync(target)) {
    errors.push(`${relative}: archivo requerido ausente`)
    return null
  }
  return fs.readFileSync(target, 'utf8')
}

function actionIdentity(action) {
  if (action.startsWith('r-lib/actions/')) return 'r-lib/actions'
  return action
}

function auditWorkflow(relative, text, errors) {
  let actionUses = 0
  let runners = 0

  for (const match of text.matchAll(/^\s*(?:-\s*)?uses:\s*([^\s#]+)([^\n]*)$/gm)) {
    const spec = match[1]
    if (spec.startsWith('./')) continue
    actionUses += 1
    const separator = spec.lastIndexOf('@')
    const action = separator === -1 ? spec : spec.slice(0, separator)
    const ref = separator === -1 ? '' : spec.slice(separator + 1)
    if (!/^[0-9a-f]{40}$/.test(ref)) {
      errors.push(`${relative}: acción no fijada a SHA completo: ${spec}`)
      continue
    }
    const expected = ACTION_SHAS.get(actionIdentity(action))
    if (expected && ref !== expected) {
      errors.push(`${relative}: SHA no aprobado para ${action}: ${ref}`)
    }
    if (!/#\s*v\d+\b/.test(match[2])) {
      errors.push(`${relative}: ${action} debe conservar comentario de versión junto al SHA`)
    }
  }

  for (const match of text.matchAll(/^\s*runs-on:\s*([^\s#]+)\s*$/gm)) {
    runners += 1
    if (!APPROVED_RUNNERS.has(match[1])) {
      errors.push(`${relative}: runner mutable o no aprobado: ${match[1]}`)
    }
  }

  if (text.includes('actions/cache@') && !text.includes("hashFiles('api/renv.lock')")) {
    errors.push(`${relative}: caché R no depende de api/renv.lock`)
  }
  if (/hashFiles\(\s*['"]api\/DESCRIPTION['"]\s*\)/.test(text)) {
    errors.push(`${relative}: caché R todavía depende de api/DESCRIPTION`)
  }
  if (/^\s*restore-keys\s*:/m.test(text)) {
    errors.push(`${relative}: caché por prefijo puede restaurar un conjunto R obsoleto`)
  }

  return { actionUses, runners }
}

export function runRLockAudit(repoRoot) {
  const errors = []
  const descriptionText = readText(repoRoot, 'api/DESCRIPTION', errors)
  const lockText = readText(repoRoot, 'api/renv.lock', errors)
  const qualityText = readText(repoRoot, '.github/workflows/quality.yml', errors)
  const releaseText = readText(repoRoot, '.github/workflows/release.yml', errors)

  let lock = null
  if (lockText !== null) {
    try {
      lock = JSON.parse(lockText)
    } catch (error) {
      errors.push(`api/renv.lock: JSON inválido: ${error.message}`)
    }
  }

  const description = descriptionText === null ? {} : parseDcf(descriptionText)
  const directDependencies = [...new Set(
    DEPENDENCY_FIELDS.flatMap((field) => dependencyNames(description[field]))
      .filter((packageName) => !BASE_R_PACKAGES.has(packageName))
  )].sort()
  const packages = lock?.Packages && typeof lock.Packages === 'object' ? lock.Packages : {}
  const repositories = Array.isArray(lock?.R?.Repositories) ? lock.R.Repositories : []
  const declaredR = description.Depends?.match(/(?:^|,)\s*R\s*\(\s*>=\s*([0-9]+(?:\.[0-9]+){1,2})\s*\)/)?.[1]

  // api/R/utils_internal.R usa el placeholder de pipe `x = _`, disponible
  // desde R 4.2. Un mínimo menor hace que el paquete no pueda parsearse.
  if (!declaredR || !versionAtLeast(declaredR, MINIMUM_R_VERSION)) {
    errors.push(`api/DESCRIPTION: Depends debe declarar R (>= ${MINIMUM_R_VERSION}) por el placeholder de pipe`)
  }

  if (lock) {
    if (lock.R?.Version !== TARGET_R_VERSION) {
      errors.push(`api/renv.lock: R debe ser exactamente ${TARGET_R_VERSION}; recibido ${lock.R?.Version ?? 'ausente'}`)
    }
    if (repositories.length === 0) errors.push('api/renv.lock: falta repositorio estable')
    for (const repository of repositories) {
      const url = repository?.URL
      if (typeof url !== 'string' || !url.startsWith('https://')) {
        errors.push(`api/renv.lock: repositorio no HTTPS: ${url ?? 'ausente'}`)
      } else if (/(?:^|\/)latest(?:\/|$)/i.test(url)) {
        errors.push(`api/renv.lock: repositorio mutable: ${url}`)
      }
    }

    for (const [packageName, record] of Object.entries(packages)) {
      if (record?.Package !== packageName) errors.push(`api/renv.lock: clave ${packageName} no coincide con Package`)
      if (typeof record?.Version !== 'string' || !/^[0-9]+(?:[.-][0-9A-Za-z]+)*$/.test(record.Version)) {
        errors.push(`api/renv.lock: ${packageName}: Version exacta ausente o inválida`)
      }
      if (record?.Source !== 'Repository') {
        errors.push(`api/renv.lock: ${packageName}: Source debe ser Repository`)
      }
      if (typeof record?.Repository !== 'string' || !record.Repository) {
        errors.push(`api/renv.lock: ${packageName}: Repository ausente`)
      }
      if (typeof record?.MD5sum !== 'string' || !/^[0-9a-f]{32}$/.test(record.MD5sum)) {
        errors.push(`api/renv.lock: ${packageName}: MD5sum inválido`)
      }
      for (const field of CLOSURE_FIELDS) {
        for (const dependency of dependencyNames(record?.[field])) {
          if (!BASE_R_PACKAGES.has(dependency) && !packages[dependency]) {
            errors.push(`api/renv.lock: dependencia transitiva sin registro: ${packageName} -> ${dependency}`)
          }
        }
      }
    }

    for (const dependency of directDependencies) {
      if (!packages[dependency]) {
        errors.push(`api/DESCRIPTION: dependencia directa sin versión exacta: ${dependency}`)
      }
    }
    if (!packages.renv) errors.push('api/renv.lock: falta el paquete bootstrap renv con versión exacta')
  }

  let actionUses = 0
  let runners = 0
  for (const [relative, text] of [
    ['.github/workflows/quality.yml', qualityText],
    ['.github/workflows/release.yml', releaseText]
  ]) {
    if (text === null) continue
    const workflow = auditWorkflow(relative, text, errors)
    actionUses += workflow.actionUses
    runners += workflow.runners
  }

  if (qualityText !== null) {
    const required = [
      ['node scripts/check-r-lock.mjs', 'falta gate del lock R'],
      ['node scripts/check-docs-governance.mjs', 'falta gate documental'],
      ['node scripts/release-contract.mjs preview', 'falta gate preview de release'],
      ['Rscript launcher/install-r-deps.R', 'falta restauración exacta del lock'],
      ['mkdir -p "${RUNNER_TEMP}/r-check"', 'falta crear el directorio de salida de R CMD check'],
      ['--output="${RUNNER_TEMP}/r-check"', 'R CMD check no usa su directorio de salida creado'],
      ['pnpm -C frontend audit --audit-level=high', 'falta audit frontend'],
      ['pnpm -C desktop audit --audit-level=high', 'falta audit desktop']
    ]
    for (const [needle, message] of required) {
      if (!qualityText.includes(needle)) errors.push(`.github/workflows/quality.yml: ${message}`)
    }

    // La suite de scripts dejó de ser una sola invocación: cada contrato corre
    // en el job que le da su infraestructura (R, navegador, sólo Node). Exigir
    // la cadena literal `node --test scripts/tests/*.test.mjs` ya no dice nada
    // sobre la verdad, así que se comprueba lo que importa: que ningún archivo
    // de scripts/tests/ se quede sin correr en ningún job. Un test nuevo que no
    // caiga ni en el glob ni en una lista explícita es deuda invisible —pasaría
    // por verde sin haberse ejecutado— y aquí se vuelve un error.
    const suiteDir = path.join(repoRoot, 'scripts', 'tests')
    const suiteFiles = fs.existsSync(suiteDir)
      ? fs.readdirSync(suiteDir).filter((name) => name.endsWith('.test.mjs')).sort()
      : []
    if (!suiteFiles.length) {
      errors.push('scripts/tests: no hay contratos de scripts que auditar')
    }
    // Cualquier forma del glob cuenta como cobertura amplia: tanto la invocación
    // directa `node --test scripts/tests/*.test.mjs` como el `ls … | grep -vE`
    // que reparte. Atarse a una sola forma haría que volver a la otra marcara
    // todos los contratos como huérfanos.
    const globPresent = /scripts\/tests\/\*\.test\.mjs/.test(qualityText)
    const excluded = []
    for (const match of qualityText.matchAll(/ls\s+scripts\/tests\/\*\.test\.mjs\s*\|\s*grep\s+-vE\s+'([^']+)'/g)) {
      for (const token of match[1].split('|')) {
        const trimmed = token.trim()
        if (trimmed) excluded.push(trimmed)
      }
    }
    for (const file of suiteFiles) {
      const namedExplicitly = qualityText.includes(`scripts/tests/${file}`)
      const coveredByGlob = globPresent && !excluded.some((token) => file.includes(token))
      if (!namedExplicitly && !coveredByGlob) {
        errors.push(`.github/workflows/quality.yml: scripts/tests/${file} no corre en ningún job`)
      }
    }
    if (!/(?:^|\n)\s*(?:-\s*)?(?:run:\s*)?R CMD check\b/.test(qualityText)) {
      errors.push('.github/workflows/quality.yml: falta R CMD check')
    }
    if (
      /ERR_PNPM_AUDIT_BAD_RESPONSE/.test(qualityText) ||
      /pnpm[^\n]*\baudit\b[^\n]*(?:\|\|\s*true|;\s*true)/.test(qualityText) ||
      /continue-on-error:\s*true/.test(qualityText)
    ) {
      errors.push('.github/workflows/quality.yml: audit pnpm debe fallar cerrado')
    }
  }

  return {
    errors,
    report: {
      rVersion: lock?.R?.Version ?? null,
      directDependencies: directDependencies.length,
      lockedPackages: Object.keys(packages).length,
      repositories: repositories.length,
      actionUses,
      runners
    }
  }
}

export function formatRLockAudit(result) {
  const { report } = result
  return [
    `R ${report.rVersion ?? 'sin versión'}: ${report.lockedPackages} paquetes exactos para ${report.directDependencies} dependencias directas.`,
    `Repositorios: ${report.repositories}; acciones fijadas: ${report.actionUses}; runners inspeccionados: ${report.runners}.`,
    `Errores: ${result.errors.length}.`
  ].join('\n')
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invoked) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const result = runRLockAudit(repoRoot)
  process.stdout.write(`${formatRLockAudit(result)}\n`)
  for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`)
  process.exitCode = result.errors.length ? 1 : 0
}
