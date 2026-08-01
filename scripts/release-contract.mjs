#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const SEMVER_SOURCE = '(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)'
const SEMVER = new RegExp(`^${SEMVER_SOURCE}$`)
const RELEASE_TAG = new RegExp(`^v${SEMVER_SOURCE}$`)
const MODES = new Set(['preview', 'prepare', 'stable'])

// Serie 3.x: deuda histórica, no una serie de producto (ADR 0056). Entre junio
// y julio de 2026 los cortes se nombraban «Corte 3.1» refiriéndose a la versión
// 0.3.1, y en algún momento el número del corte pasó a ser el de versión: se
// publicaron siete releases 3.3.1–3.4.2 y después se retomó la serie real en
// 0.5.0. Comparar contra ese máximo obligaría a saltar a 4.0.0 y consagraría el
// accidente como si fuera la línea buena.
//
// La lista es explícita y cerrada a propósito: excluir por patrón (`^v3\.`)
// dejaría la puerta abierta a que un 3.x futuro se colara sin decisión humana.
// La monotonicidad sigue siendo estricta dentro de la serie vigente.
const LEGACY_RELEASE_TAGS = new Set([
  'v3.3.1',
  'v3.3.2',
  'v3.3.3',
  'v3.3.4',
  'v3.4.0',
  'v3.4.1',
  'v3.4.2'
])

const SURFACE_PATHS = {
  api: 'api/DESCRIPTION',
  desktop: 'desktop/package.json',
  inApp: 'frontend/src/features/home/releaseNotes.ts',
  docs: 'docs/versiones-app.md',
  githubNotes: '.github/RELEASE_NOTES.md'
}

const SURFACE_LABELS = {
  api: 'API',
  desktop: 'Desktop',
  inApp: 'notas dentro de la app',
  docs: 'documentación de versiones',
  githubNotes: 'notas de GitHub'
}

function semVerParts(version) {
  const match = SEMVER.exec(version)
  if (!match) throw new TypeError(`SemVer inválido: ${version}`)
  return match.slice(1).map((part) => BigInt(part))
}

export function compareSemVer(left, right) {
  const leftParts = semVerParts(left)
  const rightParts = semVerParts(right)
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] > rightParts[index]) return 1
    if (leftParts[index] < rightParts[index]) return -1
  }
  return 0
}

function nextMajor(version) {
  const [major] = semVerParts(version)
  return `${major + 1n}.0.0`
}

function issue(code, message, details = {}) {
  return { code, message, ...details }
}

function readText(repoRoot, relative) {
  return fs.readFileSync(path.join(repoRoot, relative), 'utf8')
}

function extractApiVersion(text) {
  return text.match(/^Version:\s*(\S+)\s*$/m)?.[1] ?? null
}

function extractDesktopVersion(text) {
  const parsed = JSON.parse(text)
  return typeof parsed.version === 'string' ? parsed.version : (
    parsed.version === undefined ? null : String(parsed.version)
  )
}

function extractInAppVersion(text) {
  const marker = text.indexOf('RELEASE_NOTES')
  if (marker < 0) return null
  return text.slice(marker).match(/\bversion\s*:\s*["']([^"']+)["']/)?.[1] ?? null
}

function extractDocsVersion(text) {
  const marker = /^##\s+Versi[oó]n actual\s*$/m.exec(text)
  if (!marker) return null
  const tail = text.slice(marker.index + marker[0].length)
  const nextHeading = /^##\s+/m.exec(tail)
  const section = nextHeading ? tail.slice(0, nextHeading.index) : tail
  const currentVersion = section.match(/Estamos en\s+`([^`]+)`/i)?.[1] ?? null
  if (currentVersion === null) return null

  const lines = text.split(/\r?\n/)
  const headerIndex = lines.findIndex((line) => /^\|\s*Version\s*\|/i.test(line))
  if (headerIndex < 0 || !/^\|\s*:?-{3,}/.test(lines[headerIndex + 1] ?? '')) {
    throw new Error('no se encontró la tabla de historial de versiones')
  }

  const historyVersions = []
  for (let index = headerIndex + 2; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line.startsWith('|')) break
    const rawVersion = line.split('|')[1]?.trim().replace(/^`|`$/g, '')
    if (rawVersion) historyVersions.push(rawVersion)
  }

  const occurrences = historyVersions.filter((version) => version === currentVersion).length
  if (occurrences !== 1) {
    throw new Error(
      `la versión actual ${currentVersion} debe aparecer una sola vez en la tabla (aparece ${occurrences})`
    )
  }
  const latestHistoryVersion = historyVersions.at(-1) ?? null
  if (latestHistoryVersion !== currentVersion) {
    throw new Error(
      `la última fila del historial declara ${latestHistoryVersion ?? 'ninguna'} y la sección actual ${currentVersion}`
    )
  }

  return currentVersion
}

function extractGithubNotesVersion(text) {
  return text.match(/^#\s+Prosecnur\s+(\S+)/m)?.[1] ?? null
}

const SURFACE_EXTRACTORS = {
  api: extractApiVersion,
  desktop: extractDesktopVersion,
  inApp: extractInAppVersion,
  docs: extractDocsVersion,
  githubNotes: extractGithubNotesVersion
}

function readSurface(repoRoot, surface) {
  const relative = SURFACE_PATHS[surface]
  let rawVersion = null
  try {
    rawVersion = SURFACE_EXTRACTORS[surface](readText(repoRoot, relative))
  } catch (error) {
    return {
      path: relative,
      version: null,
      rawVersion: null,
      problem: issue(
        'SURFACE_UNREADABLE',
        `${relative}: no se pudo leer la versión (${error.message}).`,
        { surface }
      )
    }
  }

  if (rawVersion === null) {
    return {
      path: relative,
      version: null,
      rawVersion: null,
      problem: issue(
        'SURFACE_VERSION_MISSING',
        `${relative}: no se encontró la versión de ${SURFACE_LABELS[surface]}.`,
        { surface }
      )
    }
  }

  if (!SEMVER.test(rawVersion)) {
    return {
      path: relative,
      version: null,
      rawVersion,
      problem: issue(
        'INVALID_SURFACE_VERSION',
        `${relative}: "${rawVersion}" no cumple SemVer X.Y.Z.`,
        { surface, actual: rawVersion }
      )
    }
  }

  return {
    path: relative,
    version: rawVersion,
    rawVersion,
    problem: null
  }
}

function git(repoRoot, args) {
  return execFileSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}

function inspectGit(repoRoot) {
  try {
    const allTags = git(repoRoot, ['tag', '--list']).split('\n').filter(Boolean)
    const releaseTags = []
    const malformedReleaseTags = []
    for (const tag of allTags) {
      const match = RELEASE_TAG.exec(tag)
      if (match) releaseTags.push({ tag, version: tag.slice(1) })
      else if (tag.startsWith('v')) malformedReleaseTags.push(tag)
    }
    releaseTags.sort((left, right) => (
      compareSemVer(left.version, right.version) || left.tag.localeCompare(right.tag)
    ))

    return {
      allTags,
      releaseTags,
      malformedReleaseTags,
      headCommit: git(repoRoot, ['rev-parse', '--verify', 'HEAD']),
      problem: null
    }
  } catch (error) {
    return {
      allTags: [],
      releaseTags: [],
      malformedReleaseTags: [],
      headCommit: null,
      problem: issue(
        'GIT_INSPECTION_FAILED',
        `No se pudo inspeccionar el repositorio Git (${error.message}).`
      )
    }
  }
}

function tagCommit(repoRoot, tag) {
  try {
    return {
      commit: git(repoRoot, ['rev-parse', '--verify', `refs/tags/${tag}^{commit}`]),
      problem: null
    }
  } catch (error) {
    return {
      commit: null,
      problem: issue(
        'TARGET_TAG_COMMIT_UNREADABLE',
        `No se pudo resolver el commit de ${tag} (${error.message}).`,
        { tag }
      )
    }
  }
}

function maxReleaseTag(tags) {
  return tags.length ? tags[tags.length - 1] : null
}

// Los tags legacy siguen listándose en el reporte —son publicaciones reales y
// ocultarlos sería peor— pero no participan del cálculo de monotonicidad.
function comparableReleaseTags(tags) {
  return tags.filter(({ tag }) => !LEGACY_RELEASE_TAGS.has(tag))
}

function pushSurfaceProblems(result, mode) {
  for (const [surface, value] of Object.entries(result.surfaces)) {
    if (!value.problem) continue
    const destination = mode === 'preview' && surface === 'githubNotes'
      ? result.warnings
      : result.errors
    destination.push(value.problem)
  }
}

function requireSurfaceVersion(result, surface, expected, severity = 'error') {
  const actual = result.surfaces[surface].version
  if (actual === null || expected === null || actual === expected) return
  const diagnostic = issue(
    'SURFACE_VERSION_MISMATCH',
    `${result.surfaces[surface].path} declara ${actual}; ${result.mode} exige ${expected}.`,
    { surface, expected, actual }
  )
  result[severity === 'warning' ? 'warnings' : 'errors'].push(diagnostic)
}

function requireGithubNotesVersion(result, expected) {
  const actual = result.surfaces.githubNotes.version
  if (actual === null || expected === null || actual === expected) return
  const diagnostic = issue(
    'GITHUB_NOTES_MISMATCH',
    `${SURFACE_PATHS.githubNotes} declara ${actual}; ${result.mode} espera ${expected}.`,
    { surface: 'githubNotes', expected, actual }
  )
  result[result.mode === 'preview' ? 'warnings' : 'errors'].push(diagnostic)
}

function baseResult(mode, tag, surfaces, gitState) {
  const maximum = maxReleaseTag(comparableReleaseTags(gitState.releaseTags))
  return {
    schemaVersion: 1,
    mode,
    ok: false,
    currentVersion: surfaces.api.version,
    targetTag: tag ?? null,
    targetVersion: null,
    surfaces: Object.fromEntries(
      Object.entries(surfaces).map(([name, value]) => [
        name,
        {
          path: value.path,
          version: value.version,
          ...(value.rawVersion !== value.version ? { rawVersion: value.rawVersion } : {})
        }
      ])
    ),
    releaseTags: gitState.releaseTags.map(({ tag: releaseTag }) => releaseTag),
    malformedReleaseTags: [...gitState.malformedReleaseTags],
    maxTag: maximum?.tag ?? null,
    comparisonMaxTag: maximum?.tag ?? null,
    headCommit: gitState.headCommit,
    targetCommit: null,
    recommendedVersion: null,
    warnings: [],
    errors: []
  }
}

/**
 * Evalúa el contrato de identidad de release sin modificar archivos, refs ni
 * el índice Git. Las únicas operaciones externas son lecturas y comandos Git
 * de inspección.
 */
export function evaluateReleaseContract(repoRoot, {
  mode = 'preview',
  tag = null
} = {}) {
  const surfaces = Object.fromEntries(
    Object.keys(SURFACE_PATHS).map((surface) => [
      surface,
      readSurface(repoRoot, surface)
    ])
  )
  const gitState = inspectGit(repoRoot)
  const result = baseResult(mode, tag, surfaces, gitState)

  if (!MODES.has(mode)) {
    result.errors.push(issue(
      'INVALID_MODE',
      `Modo "${mode}" inválido; usa preview, prepare o stable.`,
      { actual: mode }
    ))
  }

  pushSurfaceProblems({ ...result, surfaces }, mode)
  if (gitState.problem) result.errors.push(gitState.problem)
  for (const malformedTag of gitState.malformedReleaseTags) {
    result.errors.push(issue(
      'INVALID_RELEASE_TAG',
      `El tag ${malformedTag} no cumple el formato vX.Y.Z.`,
      { tag: malformedTag }
    ))
  }

  if (mode === 'preview' || mode === 'prepare') {
    if (tag !== null) {
      result.errors.push(issue(
        'TARGET_TAG_NOT_ALLOWED',
        `${mode} no acepta --tag; usa la versión declarada por las superficies.`,
        { tag }
      ))
    }

    const expected = surfaces.api.version
    for (const surface of ['desktop', 'inApp', 'docs']) {
      requireSurfaceVersion({ ...result, surfaces }, surface, expected)
    }
    requireGithubNotesVersion({ ...result, surfaces }, expected)

    if (expected !== null) {
      result.targetTag = `v${expected}`
      const maximum = maxReleaseTag(comparableReleaseTags(gitState.releaseTags))
      if (maximum && compareSemVer(expected, maximum.version) <= 0) {
        result.recommendedVersion = nextMajor(maximum.version)
        const diagnostic = issue(
          'CURRENT_NOT_ABOVE_TAGS',
          `La versión actual ${expected} no supera el tag máximo ${maximum.tag}; se recomienda ${result.recommendedVersion}.`,
          {
            current: expected,
            maxTag: maximum.tag,
            recommendedVersion: result.recommendedVersion
          }
        )
        result[mode === 'preview' ? 'warnings' : 'errors'].push(diagnostic)
      }

      if (mode === 'prepare' && gitState.allTags.includes(result.targetTag)) {
        result.errors.push(issue(
          'TARGET_TAG_EXISTS',
          `El tag objetivo ${result.targetTag} ya existe; prepare exige un tag libre.`,
          { tag: result.targetTag }
        ))
      }
    }
  }

  if (mode === 'stable') {
    if (typeof tag !== 'string' || !RELEASE_TAG.test(tag)) {
      result.errors.push(issue(
        tag === null ? 'TARGET_TAG_REQUIRED' : 'INVALID_TARGET_TAG',
        tag === null
          ? 'stable exige --tag vX.Y.Z.'
          : `El tag objetivo "${tag}" no cumple el formato vX.Y.Z.`,
        { tag }
      ))
    } else {
      const targetVersion = tag.slice(1)
      result.targetVersion = targetVersion
      for (const surface of Object.keys(SURFACE_PATHS)) {
        requireSurfaceVersion({ ...result, surfaces }, surface, targetVersion)
      }

      const comparisonTags = comparableReleaseTags(gitState.releaseTags)
        .filter(({ tag: releaseTag }) => releaseTag !== tag)
      const comparisonMaximum = maxReleaseTag(comparisonTags)
      result.comparisonMaxTag = comparisonMaximum?.tag ?? null
      if (comparisonMaximum && compareSemVer(targetVersion, comparisonMaximum.version) <= 0) {
        result.recommendedVersion = nextMajor(comparisonMaximum.version)
        result.errors.push(issue(
          'TARGET_NOT_ABOVE_OTHER_TAGS',
          `${tag} no supera el resto de tags; el máximo comparable es ${comparisonMaximum.tag}. Se recomienda v${result.recommendedVersion}.`,
          {
            tag,
            maxTag: comparisonMaximum.tag,
            recommendedVersion: result.recommendedVersion
          }
        ))
      }

      if (!gitState.allTags.includes(tag)) {
        result.errors.push(issue(
          'TARGET_TAG_MISSING',
          `El tag estable ${tag} no existe.`,
          { tag }
        ))
      } else {
        const resolved = tagCommit(repoRoot, tag)
        result.targetCommit = resolved.commit
        if (resolved.problem) result.errors.push(resolved.problem)
        else if (gitState.headCommit && resolved.commit !== gitState.headCommit) {
          result.errors.push(issue(
            'TARGET_TAG_NOT_AT_HEAD',
            `${tag} apunta a ${resolved.commit}; HEAD es ${gitState.headCommit}.`,
            {
              tag,
              targetCommit: resolved.commit,
              headCommit: gitState.headCommit
            }
          ))
        }
      }
    }
  }

  result.ok = result.errors.length === 0
  return result
}

function formatSurface(name, surface) {
  const value = surface.version ?? surface.rawVersion ?? 'NO DISPONIBLE'
  return `  ${name.padEnd(12)} ${value.padEnd(12)} ${surface.path}`
}

export function formatReleaseContract(result) {
  const lines = [
    `Release contract · ${result.mode}: ${result.ok ? 'PASS' : 'FAIL'}`,
    ...Object.entries(result.surfaces).map(([name, surface]) => formatSurface(name, surface)),
    `  maxTag       ${result.maxTag ?? 'ninguno'}`
  ]
  if (result.mode === 'stable') {
    lines.push(`  targetTag    ${result.targetTag ?? 'no indicado'}`)
    lines.push(`  targetCommit ${result.targetCommit ?? 'no disponible'}`)
    lines.push(`  HEAD         ${result.headCommit ?? 'no disponible'}`)
  }
  if (result.recommendedVersion) {
    lines.push(`  recomendada  ${result.recommendedVersion}`)
  }
  return lines.join('\n')
}

const USAGE = [
  'Uso:',
  '  node scripts/release-contract.mjs preview [--json]',
  '  node scripts/release-contract.mjs prepare [--json]',
  '  node scripts/release-contract.mjs stable --tag vX.Y.Z [--json]'
].join('\n')

function parseCliArgs(argv) {
  let mode = null
  let tag = null
  let json = false
  let help = false

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help' || argument === '-h') {
      help = true
    } else if (argument === '--json') {
      if (json) throw new Error('--json está repetido.')
      json = true
    } else if (argument === '--tag') {
      if (tag !== null) throw new Error('--tag está repetido.')
      index += 1
      if (index >= argv.length) throw new Error('--tag exige un valor vX.Y.Z.')
      tag = argv[index]
    } else if (argument.startsWith('--tag=')) {
      if (tag !== null) throw new Error('--tag está repetido.')
      tag = argument.slice('--tag='.length)
    } else if (MODES.has(argument)) {
      if (mode !== null) throw new Error('Indica un solo modo.')
      mode = argument
    } else {
      throw new Error(`Argumento desconocido: ${argument}`)
    }
  }

  if (!help && mode === null) throw new Error('Falta el modo preview, prepare o stable.')
  return { mode, tag, json, help }
}

export function runReleaseContractCli(argv, {
  repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  stdout = process.stdout,
  stderr = process.stderr
} = {}) {
  let options
  try {
    options = parseCliArgs(argv)
  } catch (error) {
    stderr.write(`ERROR [INVALID_CLI] ${error.message}\n${USAGE}\n`)
    return 2
  }

  if (options.help) {
    stdout.write(`${USAGE}\n`)
    return 0
  }

  const result = evaluateReleaseContract(repoRoot, {
    mode: options.mode,
    tag: options.tag
  })
  if (options.json) {
    stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } else {
    stdout.write(`${formatReleaseContract(result)}\n`)
    for (const warning of result.warnings) {
      stderr.write(`WARN [${warning.code}] ${warning.message}\n`)
    }
    for (const error of result.errors) {
      stderr.write(`ERROR [${error.code}] ${error.message}\n`)
    }
  }
  return result.ok ? 0 : 1
}

const invoked = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invoked) {
  process.exitCode = runReleaseContractCli(process.argv.slice(2))
}
