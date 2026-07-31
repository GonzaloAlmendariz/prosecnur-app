#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const MARKDOWN_LINK = /!?\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+["'][^)]*["'])?\)/g
const ADR_FILE = /^(\d{4})-[^/]+\.md$/
const ADR_HEADING = /^#\s+ADR\s+(\d{4})\b/m
const REQUIRED_ADR_SECTIONS = ['Contexto', 'Decision', 'Consecuencias', 'Cumplimiento', 'Notas']
const QA_STATUSES = ['Vigente', 'En curso', 'Histórico', 'Reemplazado']
const QA_REQUIRED_FIELDS = ['Tipo', 'Estado', 'Fecha', 'Autoridad']
const QA_LIFECYCLE_LINK = /^\[[^\]\n]+\]\(([^)\s]+\.md(?:#[^)\s]+)?)\)$/
const QA_TRANSIENT_PATH = /\/Users\/|\/private\/tmp\/|\/private\/var\/|\/tmp\/|file:\/\/|(?:^|[\s("'`=:])(?:tmp|output|outputs|artifacts|screenshots)\//im

const slash = (value) => value.split(path.sep).join('/')

function walkMarkdown(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkMarkdown(full, out)
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full)
  }
  return out
}

function versionablePaths(repoRoot) {
  try {
    const output = execFileSync(
      'git',
      ['-C', repoRoot, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    )
    return new Set(output.split('\0').filter(Boolean).map(slash))
  } catch {
    return null
  }
}

function linkTargets(text) {
  const targets = []
  for (const match of text.matchAll(MARKDOWN_LINK)) {
    let target = match[1]
    if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1)
    targets.push(target)
  }
  return targets
}

function localTarget(target) {
  if (/^(?:https?:|mailto:|data:|javascript:)/i.test(target) || target.startsWith('#')) return null
  const withoutAnchor = target.split('#', 1)[0].split('?', 1)[0]
  if (!withoutAnchor) return null
  try {
    return decodeURIComponent(withoutAnchor)
  } catch {
    return withoutAnchor
  }
}

function firstField(text, field) {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const inline = text.match(new RegExp(`^\\s*(?:[-*]\\s*)?(?:\\*\\*)?${escaped}(?:\\*\\*)?\\s*:\\s*(.+?)\\s*$`, 'im'))
  if (inline) return inline[1].trim()
  const section = text.match(new RegExp(`^##\\s+${escaped}\\s*$\\n+(?:\\s*\\n)*([^\\n]+)`, 'im'))
  return section?.[1]?.trim() ?? null
}

function canonicalStatus(raw) {
  const value = raw?.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase() ?? ''
  if (value.includes('reemplazad')) return 'Reemplazado'
  if (value.includes('rechazad')) return 'Rechazado'
  if (value.includes('propuest')) return 'Propuesto'
  if (value.includes('aceptad')) return 'Aceptado'
  return null
}

function canonicalDate(raw) {
  return raw?.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ?? null
}

function validIsoDate(raw) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw ?? '')) return false
  const parsed = new Date(`${raw}T00:00:00Z`)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === raw
}

function markdownLocalDocumentLink(raw) {
  const match = raw?.match(QA_LIFECYCLE_LINK)
  if (!match) return false
  const target = localTarget(match[1])
  return target !== null && !path.isAbsolute(target)
}

function canonicalSection(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

function parseAdrIndex(text) {
  const rows = []
  const row = /^\|\s*\[([^\]]+)\]\(([^)]+\.md)\)\s*\|\s*([^|]+?)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|/gm
  for (const match of text.matchAll(row)) {
    rows.push({ label: match[1].trim(), target: match[2].trim(), status: canonicalStatus(match[3]), date: match[4] })
  }
  return rows
}

/**
 * Verifica enlaces Markdown, alcance desde docs/README.md y coherencia del
 * índice ADR. La deuda editorial heredada se reporta como warning para poder
 * implantar el gate sin reescribir decisiones históricas.
 */
export function runDocsGovernanceAudit(repoRoot) {
  const errors = []
  const warnings = []
  const docsRoot = path.join(repoRoot, 'docs')
  const docs = walkMarkdown(docsRoot).sort()
  const versionable = versionablePaths(repoRoot)
  const sources = [
    path.join(repoRoot, 'README.md'),
    path.join(repoRoot, 'CLAUDE.md'),
    path.join(repoRoot, 'AGENTS.md'),
    ...docs
  ].filter((file) => fs.existsSync(file))

  const edges = new Map()
  let linksChecked = 0
  for (const source of sources) {
    const relSource = slash(path.relative(repoRoot, source))
    const targets = []
    for (const raw of linkTargets(fs.readFileSync(source, 'utf8'))) {
      const target = localTarget(raw)
      if (!target) continue
      linksChecked += 1
      if (path.isAbsolute(target)) {
        errors.push(`${relSource}: enlace local absoluto no portable: ${raw}`)
        continue
      }
      const resolved = path.resolve(path.dirname(source), target)
      const relResolved = slash(path.relative(repoRoot, resolved))
      if (relResolved.startsWith('../') || relResolved === '..') {
        errors.push(`${relSource}: enlace sale del repositorio: ${raw}`)
        continue
      }
      if (!fs.existsSync(resolved)) {
        errors.push(`${relSource}: enlace local inexistente: ${raw}`)
        continue
      }
      if (versionable) {
        const versionableTarget = versionable.has(relResolved) ||
          [...versionable].some((candidate) => candidate.startsWith(`${relResolved}/`))
        if (!versionableTarget) {
          errors.push(`${relSource}: enlace apunta a un destino ignorado o no versionable: ${raw}`)
          continue
        }
      }
      if (resolved.endsWith('.md') && resolved.startsWith(`${docsRoot}${path.sep}`)) targets.push(resolved)
    }
    edges.set(source, targets)
  }

  const entry = path.join(docsRoot, 'README.md')
  const reachable = new Set()
  const queue = fs.existsSync(entry) ? [entry] : []
  if (!queue.length) errors.push('docs/README.md: falta la portada canónica')
  while (queue.length) {
    const current = queue.shift()
    if (reachable.has(current)) continue
    reachable.add(current)
    for (const target of edges.get(current) ?? []) if (!reachable.has(target)) queue.push(target)
  }
  const orphans = docs.filter((file) => !reachable.has(file)).map((file) => slash(path.relative(repoRoot, file)))
  for (const orphan of orphans) errors.push(`${orphan}: Markdown no alcanzable desde docs/README.md`)

  const qaRoot = path.join(docsRoot, 'qa')
  const qaIndexPaths = new Set([
    path.join(qaRoot, 'README.md'),
    path.join(qaRoot, 'historico', 'README.md')
  ])
  const qaFiles = docs.filter((file) => file.startsWith(`${qaRoot}${path.sep}`) && !qaIndexPaths.has(file))
  const qaStatusCounts = Object.fromEntries(QA_STATUSES.map((status) => [status, 0]))

  for (const file of qaFiles) {
    const relFile = slash(path.relative(repoRoot, file))
    const text = fs.readFileSync(file, 'utf8')
    const fields = Object.fromEntries(QA_REQUIRED_FIELDS.map((field) => [field, firstField(text, field)]))

    for (const field of QA_REQUIRED_FIELDS) {
      if (!fields[field]) errors.push(`${relFile}: ${field} ausente o vacío`)
    }

    const status = fields.Estado
    if (status && !QA_STATUSES.includes(status)) errors.push(`${relFile}: Estado QA no canónico: ${status}`)
    else if (status) qaStatusCounts[status] += 1

    if (fields.Fecha && !validIsoDate(fields.Fecha)) errors.push(`${relFile}: Fecha ISO inválida: ${fields.Fecha}`)

    if (status === 'Histórico' && !markdownLocalDocumentLink(firstField(text, 'Consolidado en'))) {
      errors.push(`${relFile}: Consolidado en exige un enlace Markdown local hacia .md`)
    }
    if (status === 'Reemplazado' && !markdownLocalDocumentLink(firstField(text, 'Reemplazado por'))) {
      errors.push(`${relFile}: Reemplazado por exige un enlace Markdown local hacia .md`)
    }
    if ((status === 'Vigente' || status === 'En curso') && QA_TRANSIENT_PATH.test(text)) {
      errors.push(`${relFile}: documento ${status} contiene una ruta local o transitoria`)
    }
  }

  const adrDir = path.join(docsRoot, 'adrs')
  const adrFiles = docs.filter((file) => path.dirname(file) === adrDir && ADR_FILE.test(path.basename(file)) && !path.basename(file).startsWith('0000-'))
  const indexPath = path.join(adrDir, 'README.md')
  const indexRows = fs.existsSync(indexPath) ? parseAdrIndex(fs.readFileSync(indexPath, 'utf8')) : []
  const rowsByTarget = new Map(indexRows.map((row) => [row.target, row]))
  const ids = new Map()
  const statusCounts = { Aceptado: 0, Propuesto: 0, Rechazado: 0, Reemplazado: 0 }

  for (const file of adrFiles) {
    const basename = path.basename(file)
    const id = basename.match(ADR_FILE)[1]
    const text = fs.readFileSync(file, 'utf8')
    const heading = text.match(ADR_HEADING)?.[1]
    if (heading !== id) errors.push(`${slash(path.relative(repoRoot, file))}: ID de filename ${id} no coincide con encabezado ${heading ?? 'ausente'}`)

    const seen = ids.get(id) ?? []
    seen.push(basename)
    ids.set(id, seen)

    const status = canonicalStatus(firstField(text, 'Estado'))
    const date = canonicalDate(firstField(text, 'Fecha'))
    if (!status) errors.push(`${slash(path.relative(repoRoot, file))}: Estado ausente o no reconocido`)
    else statusCounts[status] += 1
    if (!date) errors.push(`${slash(path.relative(repoRoot, file))}: Fecha ISO ausente`)

    const row = rowsByTarget.get(basename)
    if (!row) errors.push(`${slash(path.relative(repoRoot, file))}: falta en docs/adrs/README.md`)
    else {
      if (row.status !== status) errors.push(`${slash(path.relative(repoRoot, file))}: estado ${status} no coincide con índice ${row.status ?? 'no reconocido'}`)
      if (row.date !== date) errors.push(`${slash(path.relative(repoRoot, file))}: fecha ${date} no coincide con índice ${row.date}`)
    }

    const sections = [...text.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => canonicalSection(match[1]))
    for (const required of REQUIRED_ADR_SECTIONS) {
      if (!sections.includes(canonicalSection(required))) warnings.push(`${slash(path.relative(repoRoot, file))}: falta sección ## ${required}`)
    }
  }

  for (const [id, files] of ids) {
    if (files.length > 1) warnings.push(`docs/adrs: ID ${id} duplicado: ${files.join(', ')}`)
  }
  for (const row of indexRows) {
    if (!adrFiles.some((file) => path.basename(file) === row.target)) errors.push(`docs/adrs/README.md: fila apunta a ADR inexistente o no canónico: ${row.target}`)
  }

  return {
    errors,
    warnings,
    report: {
      markdownFiles: docs.length,
      reachable: reachable.size,
      linksChecked,
      orphans,
      adrFiles: adrFiles.length,
      adrIds: ids.size,
      adrIndexRows: indexRows.length,
      statusCounts,
      qaFiles: qaFiles.length,
      qaStatusCounts
    }
  }
}

export function formatDocsGovernanceAudit(result) {
  const { report } = result
  return [
    `Markdown: ${report.reachable}/${report.markdownFiles} alcanzables; ${report.linksChecked} enlaces locales verificados.`,
    `ADR: ${report.adrFiles} archivos, ${report.adrIds} IDs, ${report.adrIndexRows} filas de índice.`,
    `Estados: ${Object.entries(report.statusCounts).map(([status, count]) => `${status}=${count}`).join(', ')}.`,
    `QA: ${report.qaFiles} documentos; ${Object.entries(report.qaStatusCounts).map(([status, count]) => `${status}=${count}`).join(', ')}.`,
    `Errores: ${result.errors.length}; advertencias: ${result.warnings.length}.`
  ].join('\n')
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invoked) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const result = runDocsGovernanceAudit(repoRoot)
  process.stdout.write(`${formatDocsGovernanceAudit(result)}\n`)
  for (const warning of result.warnings) process.stderr.write(`WARN: ${warning}\n`)
  for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`)
  process.exitCode = result.errors.length ? 1 : 0
}
