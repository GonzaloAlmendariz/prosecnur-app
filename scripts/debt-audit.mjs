#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TEST_PATH = /(?:^|\/)(?:__tests__|tests?|fixtures|snapshots)(?:\/|$)|(?:^|[._-])(?:test|spec)\.[^/]+$|\.contract\.test\.[^/]+$/
const EXCLUDED_PATH = /(?:^|\/)(?:node_modules|dist(?:\.nosync)?|output|outputs|vendor|generated)(?:\/|$)|\.pulso$/
const HEX_6 = /#[0-9A-Fa-f]{6}\b/g
const HEX_ALL = /#(?:[0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})\b/g

const slash = (value) => value.split(path.sep).join('/')

function walk(root, relative = '', out = []) {
  const directory = path.join(root, relative)
  if (!fs.existsSync(directory)) return out
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = slash(path.join(relative, entry.name))
    if (EXCLUDED_PATH.test(child)) continue
    if (entry.isDirectory()) walk(root, child, out)
    else if (entry.isFile()) out.push(child)
  }
  return out
}

function text(root, relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8')
}

function lines(value) {
  if (!value) return []
  const result = value.split(/\r?\n/)
  if (result.at(-1) === '') result.pop()
  return result
}

function lineCount(value) {
  return lines(value).length
}

function countMatches(value, expression) {
  return [...value.matchAll(expression)].length
}

function historicalRMetrics(repoRoot, rFiles) {
  let orDefinitions = 0
  let microHelpers = 0
  let rawStops = 0
  let looseTry = 0

  for (const relative of rFiles) {
    for (const line of lines(text(repoRoot, relative))) {
      if (line.includes('"%||%" <- ') || line.includes('`%||%` <-')) orDefinitions += 1
      if (/\._?[a-z_]+_(?:scalar|slug|chr|bool) <- function/.test(line)) microHelpers += 1
      if (line.includes('stop("') && !line.includes('stop_api')) rawStops += 1
      if (line.includes(' try(')) looseTry += 1
    }
  }

  return { orDefinitions, microHelpers, rawStops, looseTry }
}

function stripRCommentsAndStrings(source) {
  let result = ''
  let state = 'code'
  let quote = ''
  let escaped = false

  for (const character of source) {
    if (state === 'comment') {
      if (character === '\n') {
        state = 'code'
        result += '\n'
      } else {
        result += ' '
      }
      continue
    }
    if (state === 'string') {
      result += character === '\n' ? '\n' : ' '
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === quote) state = 'code'
      continue
    }
    if (state === 'backtick') {
      result += character
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '`') state = 'code'
      continue
    }
    if (character === '#') {
      state = 'comment'
      result += ' '
    } else if (character === '"' || character === "'") {
      state = 'string'
      quote = character
      result += ' '
    } else if (character === '`') {
      state = 'backtick'
      result += character
    } else {
      result += character
    }
  }
  return result
}

function semanticRMetrics(repoRoot, rFiles) {
  const source = rFiles
    .map((relative) => stripRCommentsAndStrings(text(repoRoot, relative)))
    .join('\n')
  return {
    orDefinitions: countMatches(source, /`%\|\|%`\s*<-/g),
    microHelpers: countMatches(
      source,
      /(?:^|[^A-Za-z0-9._])[.]?[A-Za-z][A-Za-z0-9._]*_(?:scalar|slug|chr|bool)\s*<-\s*function\b/gm
    ),
    stopCalls: countMatches(source, /(?:^|[^A-Za-z0-9._])stop\s*\(/gm),
    stopApiCalls: countMatches(source, /(?:^|[^A-Za-z0-9._])stop_api\s*\(/gm),
    tryCalls: countMatches(source, /(?:^|[^A-Za-z0-9._])try\s*\(/gm)
  }
}

function cssMetrics(repoRoot, cssFiles) {
  let sixDigitMatches = 0
  let expandedMatches = 0
  let sixDigitFiles = 0
  let expandedFiles = 0
  const concentration = []

  for (const relative of cssFiles) {
    const source = text(repoRoot, relative)
    const six = countMatches(source, HEX_6)
    const expanded = countMatches(source, HEX_ALL)
    if (six) sixDigitFiles += 1
    if (expanded) expandedFiles += 1
    sixDigitMatches += six
    expandedMatches += expanded
    concentration.push({ path: relative, sixDigitMatches: six, expandedMatches: expanded })
  }

  concentration.sort((left, right) =>
    right.sixDigitMatches - left.sixDigitMatches || left.path.localeCompare(right.path)
  )
  return {
    files: cssFiles.length,
    sixDigitFiles,
    sixDigitMatches,
    expandedFiles,
    expandedMatches,
    concentration: concentration.slice(0, 10)
  }
}

function loadTypeScript(repoRoot) {
  const requireFromFrontend = createRequire(path.join(repoRoot, 'frontend', 'package.json'))
  try {
    return requireFromFrontend('typescript')
  } catch (error) {
    throw new Error(
      `No se pudo cargar TypeScript desde frontend; ejecuta pnpm -C frontend install (${error.message})`
    )
  }
}

function typeScriptMetrics(repoRoot, productionFiles, typescript = loadTypeScript(repoRoot)) {
  let anyKeywords = 0
  let suppressions = 0
  const anyByFile = []

  for (const relative of productionFiles) {
    const source = text(repoRoot, relative)
    const kind = relative.endsWith('.tsx')
      ? typescript.ScriptKind.TSX
      : typescript.ScriptKind.TS
    const tree = typescript.createSourceFile(
      relative,
      source,
      typescript.ScriptTarget.Latest,
      true,
      kind
    )
    let fileAny = 0
    const visit = (node) => {
      if (node.kind === typescript.SyntaxKind.AnyKeyword) fileAny += 1
      typescript.forEachChild(node, visit)
    }
    visit(tree)
    anyKeywords += fileAny
    suppressions += countMatches(source, /@ts-(?:ignore|expect-error)\b/g)
    if (fileAny) anyByFile.push({ path: relative, count: fileAny })
  }

  anyByFile.sort((left, right) => right.count - left.count || left.path.localeCompare(right.path))
  return { anyKeywords, suppressions, anyByFile }
}

function nominalRTests(repoRoot, rFiles, testFiles) {
  const normalizedTests = testFiles.map((relative) =>
    path.basename(relative, '.R')
      .toLowerCase()
      .replace(/^test[-_]/, '')
  )
  const missing = []

  for (const relative of rFiles) {
    const stem = path.basename(relative, '.R')
      .toLowerCase()
      .replaceAll('_', '-')
    if (!normalizedTests.some((testName) => testName.includes(stem))) {
      missing.push({ path: relative, lines: lineCount(text(repoRoot, relative)) })
    }
  }

  missing.sort((left, right) => right.lines - left.lines || left.path.localeCompare(right.path))
  return {
    productionFiles: rFiles.length,
    testFiles: testFiles.length,
    withoutNominalTest: missing.length,
    topMissing: missing.slice(0, 15)
  }
}

function largeTsx(repoRoot, tsxFiles) {
  const files = tsxFiles
    .map((relative) => ({ path: relative, lines: lineCount(text(repoRoot, relative)) }))
    .filter((entry) => entry.lines > 1000)
    .sort((left, right) => right.lines - left.lines || left.path.localeCompare(right.path))
  return { productionFiles: tsxFiles.length, over1000: files.length, files }
}

function frozenMetrics(repoRoot) {
  const manifestPath = path.join(repoRoot, 'agentic', 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const policy = manifest.policy ?? {}
  const frozenFiles = policy.frozen_growth_files ?? []
  const baseline = policy.frozen_growth_baseline ?? {}
  const files = frozenFiles.map((relative) => {
    if (!fs.existsSync(path.join(repoRoot, relative))) {
      return { path: relative, baseline: baseline[relative] ?? null, current: null, delta: null }
    }
    const current = lineCount(text(repoRoot, relative))
    const limit = baseline[relative]
    return { path: relative, baseline: limit, current, delta: current - limit }
  })
  return {
    files,
    violations: files.filter((entry) =>
      entry.current === null || !Number.isInteger(entry.baseline) || entry.delta > 0
    )
  }
}

function gitOutput(repoRoot, args) {
  return execFileSync('git', ['-C', repoRoot, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })
}

function category(relative) {
  if (EXCLUDED_PATH.test(relative)) return 'excluded'
  if (TEST_PATH.test(relative)) return 'tests'
  if (relative.startsWith('docs/') || /^(?:README|CLAUDE|AGENTS)\.md$/.test(relative)) return 'docs'
  if (
    relative.startsWith('.github/') ||
    relative.startsWith('.claude/') ||
    relative.startsWith('.agents/') ||
    relative.startsWith('.codex/') ||
    relative.startsWith('agentic/') ||
    relative.startsWith('scripts/')
  ) return 'governance'
  if (
    relative.startsWith('api/') ||
    relative.startsWith('frontend/src/') ||
    relative.startsWith('desktop/') ||
    relative.startsWith('launcher/') ||
    relative.startsWith('packaging/') ||
    /^Prosecnur\.(?:app|bat)/.test(relative)
  ) return 'product'
  return 'other'
}

function emptyVolume() {
  return {
    product: { added: 0, deleted: 0, files: 0 },
    tests: { added: 0, deleted: 0, files: 0 },
    docs: { added: 0, deleted: 0, files: 0 },
    governance: { added: 0, deleted: 0, files: 0 },
    other: { added: 0, deleted: 0, files: 0 },
    excluded: { added: 0, deleted: 0, files: 0 }
  }
}

function addNumstat(output, volume) {
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const match = line.match(/^([0-9-]+)\t([0-9-]+)\t(.+)$/)
    if (!match) continue
    const relative = slash(match[3])
    const bucket = volume[category(relative)]
    bucket.added += match[1] === '-' ? 0 : Number(match[1])
    bucket.deleted += match[2] === '-' ? 0 : Number(match[2])
    bucket.files += 1
  }
}

function worktreeMetrics(repoRoot) {
  const unstaged = emptyVolume()
  const staged = emptyVolume()
  const untracked = emptyVolume()
  addNumstat(gitOutput(repoRoot, ['diff', '--numstat']), unstaged)
  addNumstat(gitOutput(repoRoot, ['diff', '--cached', '--numstat']), staged)

  const untrackedPaths = gitOutput(
    repoRoot,
    ['ls-files', '--others', '--exclude-standard', '-z']
  ).split('\0').filter(Boolean)
  for (const relative of untrackedPaths) {
    const normalized = slash(relative)
    const kind = category(normalized)
    const bucket = untracked[kind]
    const target = path.join(repoRoot, normalized)
    let count = 0
    if (kind !== 'excluded') {
      try {
        count = lineCount(fs.readFileSync(target, 'utf8'))
      } catch {
        count = 0
      }
    }
    bucket.added += count
    bucket.files += 1
  }

  const productLines = ['unstaged', 'staged', 'untracked'].reduce((total, state) => {
    const bucket = { unstaged, staged, untracked }[state].product
    return total + bucket.added + bucket.deleted
  }, 0)
  return { unstaged, staged, untracked, productLines }
}

function ariaMetrics(repoRoot, productionTs) {
  const joined = productionTs.map((relative) => text(repoRoot, relative)).join('\n')
  return {
    roleTab: countMatches(joined, /\brole="tab"/g),
    roleTabpanel: countMatches(joined, /\brole="tabpanel"/g),
    ariaControls: countMatches(joined, /\baria-controls=/g),
    ariaCurrent: countMatches(joined, /\baria-current\b/g),
    roleRadiogroup: countMatches(joined, /\brole="radiogroup"/g),
    roleRadio: countMatches(joined, /\brole="radio"/g),
    ariaChecked: countMatches(joined, /\baria-checked\b/g),
    glidingNav: countMatches(joined, /<GlidingTabList\b[^>]*\bmode=["']nav["']/gs)
  }
}

export function auditDebt(repoRoot, options = {}) {
  const all = walk(repoRoot)
  const rFiles = all.filter((relative) => relative.startsWith('api/R/') && relative.endsWith('.R'))
  const rTests = all.filter((relative) =>
    relative.startsWith('api/tests/') && relative.endsWith('.R')
  )
  const productionTs = all.filter((relative) =>
    relative.startsWith('frontend/src/') &&
    /\.(?:ts|tsx)$/.test(relative) &&
    !TEST_PATH.test(relative)
  )
  const productionTsx = productionTs.filter((relative) => relative.endsWith('.tsx'))
  const cssFiles = all.filter((relative) =>
    relative.startsWith('frontend/src/features/') && relative.endsWith('.css')
  )

  return {
    observedAt: new Date().toISOString(),
    head: gitOutput(repoRoot, ['rev-parse', 'HEAD']).trim(),
    frozen: frozenMetrics(repoRoot),
    rHistorical: historicalRMetrics(repoRoot, rFiles),
    rSemantic: semanticRMetrics(repoRoot, rFiles),
    css: cssMetrics(repoRoot, cssFiles),
    typescript: typeScriptMetrics(repoRoot, productionTs, options.typescript),
    rNominalTests: nominalRTests(repoRoot, rFiles, rTests),
    largeTsx: largeTsx(repoRoot, productionTsx),
    worktree: worktreeMetrics(repoRoot),
    aria: ariaMetrics(repoRoot, productionTs)
  }
}

export function formatDebtAudit(result) {
  const rows = [
    `Observado: ${result.observedAt}; HEAD ${result.head}`,
    `Eje 1: congelados ${result.frozen.files.length - result.frozen.violations.length}/${result.frozen.files.length} dentro del límite; violaciones ${result.frozen.violations.length}.`,
    `Eje 2: %||%=${result.rHistorical.orDefinitions}; helpers=${result.rHistorical.microHelpers}.`,
    `Eje 3: stop(\"=${result.rHistorical.rawStops}; try( sueltos=${result.rHistorical.looseTry}.`,
    `Serie R semántica: %||%=${result.rSemantic.orDefinitions}; helpers=${result.rSemantic.microHelpers}; stop=${result.rSemantic.stopCalls}; stop_api=${result.rSemantic.stopApiCalls}; try=${result.rSemantic.tryCalls}.`,
    `Eje 4: hex6 ${result.css.sixDigitFiles}/${result.css.files} archivos, ${result.css.sixDigitMatches} coincidencias; serie ampliada ${result.css.expandedFiles}/${result.css.files}, ${result.css.expandedMatches}.`,
    `Eje 5: any AST=${result.typescript.anyKeywords}; supresiones TS en producto=${result.typescript.suppressions}.`,
    `Eje 6: R sin test nominal=${result.rNominalTests.withoutNominalTest}/${result.rNominalTests.productionFiles}.`,
    `Eje 7: TSX >1000=${result.largeTsx.over1000}/${result.largeTsx.productionFiles}.`,
    `Eje 8: volumen de producto sin commit=${result.worktree.productLines} líneas.`,
    `ARIA literal: tab=${result.aria.roleTab}; tabpanel=${result.aria.roleTabpanel}; controls=${result.aria.ariaControls}; current=${result.aria.ariaCurrent}; radiogroup=${result.aria.roleRadiogroup}; radio=${result.aria.roleRadio}; checked=${result.aria.ariaChecked}; Gliding nav=${result.aria.glidingNav}.`
  ]
  return rows.join('\n')
}

function parseArgs(argv) {
  const options = { root: SCRIPT_ROOT, json: false, check: false }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--json') options.json = true
    else if (argument === '--check') options.check = true
    else if (argument === '--root') options.root = path.resolve(argv[++index])
    else throw new Error(`Argumento desconocido: ${argument}`)
  }
  return options
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2))
    const result = auditDebt(options.root)
    process.stdout.write(`${options.json ? JSON.stringify(result, null, 2) : formatDebtAudit(result)}\n`)
    if (options.check && result.frozen.violations.length) process.exitCode = 1
  } catch (error) {
    process.stderr.write(`ERROR: ${error.message}\n`)
    process.exitCode = 1
  }
}
