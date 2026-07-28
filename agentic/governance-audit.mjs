// Auditoría sustantiva del agentic OS.
//
// `--check` valida ESTRUCTURA: que los adaptadores estén sincronizados y que
// todo nombre declarado resuelva. Nunca comprueba si lo que el manifest AFIRMA
// sobre el repositorio sigue siendo verdad.
//
// Ese hueco tiene historia medida: `policy.frozen_growth_files` congelaba
// `MonitoreoPage.tsx` mucho después de que el archivo se borrara, mientras dos
// monolitos de perfil de ~20.000 líneas crecían sin gobierno y el CI seguía en
// verde. El sincronizador tocaba esa lista una sola vez, con `ensureArray`:
// comprobaba que la lista fuera una lista.
//
// Este módulo comprueba verdad, no forma. Es el equivalente, para el propio
// OS, de la regla que el OS le exige a la UI: verde por conformidad, nunca por
// ausencia.

import fs from 'node:fs'
import path from 'node:path'

// Prefijos con los que un documento de gobierno puede citar una ruta.
const PATH_PREFIXES = ['', 'frontend/', 'frontend/src/', 'frontend/src/features/', 'api/', 'docs/', 'scripts/']
const SOURCE_EXT = new Set(['.R', '.ts', '.tsx', '.css', '.mjs'])
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'coverage', 'worktrees', '.claude', 'tmp'])
const CITED_PATH = /`([A-Za-z0-9_./-]+\.(?:R|tsx?|mjs|css|json|md|ya?ml))`/g
const CITED_MAKE = /`make ([a-z0-9-]+)/g
const MAKE_TARGET = /^([a-zA-Z0-9_-]+):/gm

// Misma semántica que `wc -l`: la línea base es el número que ve una persona.
const countLines = (file) => {
  const content = fs.readFileSync(file, 'utf8')
  return content.split('\n').length - (content.endsWith('\n') ? 1 : 0)
}

function walkSources(root, dir, out) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walkSources(root, full, out)
    } else if (entry.isFile() && SOURCE_EXT.has(path.extname(entry.name)) && !/\.test\.|\.spec\./.test(entry.name)) {
      out.push(path.relative(root, full).split(path.sep).join('/'))
    }
  }
  return out
}

function governanceDocs(root) {
  const docs = ['CLAUDE.md', 'AGENTS.md', 'docs/loops-reparacion.md']
  for (const [dir, file] of [['.claude/skills', 'SKILL.md'], ['.claude/agents', null]]) {
    const abs = path.join(root, dir)
    if (!fs.existsSync(abs)) continue
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (file && entry.isDirectory()) docs.push(`${dir}/${entry.name}/${file}`)
      else if (!file && entry.isFile() && entry.name.endsWith('.md')) docs.push(`${dir}/${entry.name}`)
    }
  }
  return docs.filter((doc) => fs.existsSync(path.join(root, doc)))
}

/**
 * @returns {{errors: string[], warnings: string[], report: object}}
 */
export function runGovernanceAudit(manifest, repoRoot) {
  const errors = []
  const warnings = []
  const report = {}
  const abs = (p) => path.join(repoRoot, p)
  const exists = (p) => fs.existsSync(abs(p))

  const policy = manifest.policy ?? {}
  const frozen = Array.isArray(policy.frozen_growth_files) ? policy.frozen_growth_files : []
  const baseline = policy.frozen_growth_baseline ?? {}
  const exempt = new Set(policy.frozen_growth_exempt ?? [])
  const threshold = Number.isInteger(policy.frozen_growth_threshold) ? policy.frozen_growth_threshold : null

  // A. Los archivos congelados existen y no crecieron sobre su línea base.
  const frozenReport = []
  for (const file of frozen) {
    if (!exists(file)) {
      errors.push(`congelado inexistente: ${file} — retíralo de policy.frozen_growth_files o corrige la ruta`)
      continue
    }
    const lines = countLines(abs(file))
    const max = baseline[file]
    if (!Number.isInteger(max)) {
      errors.push(`congelado sin línea base: ${file} — declara policy.frozen_growth_baseline["${file}"] = ${lines}`)
      frozenReport.push({ file, lines, baseline: null, delta: null })
      continue
    }
    const delta = lines - max
    frozenReport.push({ file, lines, baseline: max, delta })
    if (delta > 0) {
      errors.push(`archivo congelado creció: ${file} ${lines} líneas vs ${max} de línea base (+${delta}). Mueve la funcionalidad nueva a un archivo propio o sube la línea base deliberadamente`)
    }
  }
  report.frozen = frozenReport

  // B. Ningún monolito queda sin gobierno. Todo archivo sobre el umbral está
  //    congelado o exento con decisión explícita.
  if (threshold) {
    const governed = new Set([...frozen, ...exempt])
    const ungoverned = []
    for (const dir of ['api/R', 'frontend/src']) {
      if (!exists(dir)) continue
      for (const file of walkSources(repoRoot, abs(dir), [])) {
        if (governed.has(file)) continue
        const lines = countLines(abs(file))
        if (lines >= threshold) ungoverned.push({ file, lines })
      }
    }
    ungoverned.sort((a, b) => b.lines - a.lines)
    report.ungoverned = ungoverned
    for (const { file, lines } of ungoverned) {
      errors.push(`monolito sin gobierno: ${file} (${lines} líneas >= umbral ${threshold}) — añádelo a policy.frozen_growth_files con su línea base, o a policy.frozen_growth_exempt con razón`)
    }
  }

  // C. Nada declarado queda sin conectar a una ruta.
  const routes = Object.values(manifest.routes ?? {})
  const usedSkills = new Set(routes.flatMap((r) => r.skills ?? []))
  const usedAgents = new Set(routes.flatMap((r) => Object.values(r.pools ?? {}).flat()))
  const orphanSkills = (manifest.skills ?? []).filter((s) => !usedSkills.has(s))
  const orphanAgents = (manifest.agents ?? []).filter((a) => !usedAgents.has(a))
  report.orphans = { skills: orphanSkills, agents: orphanAgents }
  for (const s of orphanSkills) errors.push(`skill huérfano: ${s} está declarado y sincronizado pero ninguna ruta lo carga`)
  for (const a of orphanAgents) errors.push(`agente huérfano: ${a} está declarado pero ningún pool lo usa`)

  // D y E. Lo que los documentos de gobierno citan, existe.
  const docs = governanceDocs(repoRoot)
  const brokenPaths = []
  const citedTargets = new Set()
  for (const doc of docs) {
    const text = fs.readFileSync(abs(doc), 'utf8')
    for (const [, cited] of text.matchAll(CITED_PATH)) {
      if (!cited.includes('/')) continue
      if (!PATH_PREFIXES.some((prefix) => exists(prefix + cited))) brokenPaths.push({ doc, cited })
    }
    for (const [, target] of text.matchAll(CITED_MAKE)) citedTargets.add(target)
  }
  report.docs = { scanned: docs.length, brokenPaths }
  for (const { doc, cited } of brokenPaths) errors.push(`ruta inexistente citada en ${doc}: ${cited}`)

  const makefile = exists('Makefile') ? fs.readFileSync(abs('Makefile'), 'utf8') : ''
  const realTargets = new Set([...makefile.matchAll(MAKE_TARGET)].map(([, t]) => t))
  const brokenTargets = [...citedTargets].filter((t) => !realTargets.has(t)).sort()
  report.makeTargets = { cited: citedTargets.size, broken: brokenTargets }
  for (const t of brokenTargets) errors.push(`make target citado en documentación pero inexistente: make ${t}`)

  // F. Carga por ruta. Informativo: una rama muy por encima del resto es señal
  //    de solapamiento, no un fallo objetivo.
  const load = Object.entries(manifest.routes ?? {})
    .map(([name, r]) => ({ name, own: (r.skills ?? []).length, external: (r.external ?? []).length }))
    .map((r) => ({ ...r, total: r.own + r.external }))
    .sort((a, b) => b.total - a.total)
  report.load = load
  if (load.length > 1) {
    const median = load.map((r) => r.total).sort((a, b) => a - b)[Math.floor(load.length / 2)]
    for (const r of load) {
      if (r.total >= median * 2) warnings.push(`ruta sobrecargada: ${r.name} carga ${r.total} (${r.own} propios + ${r.external} externos) contra una mediana de ${median}; revisa solapamiento`)
    }
  }

  return { errors, warnings, report }
}

export function formatAuditReport(report) {
  const lines = []
  if (report.frozen?.length) {
    lines.push('Archivos congelados:')
    for (const f of report.frozen) {
      const margin = f.delta === null ? 'sin línea base' : f.delta === 0 ? 'en su línea base' : `${f.delta > 0 ? '+' : ''}${f.delta}`
      lines.push(`  ${String(f.lines).padStart(6)}  ${f.file}  (${margin})`)
    }
  }
  if (report.ungoverned?.length) {
    lines.push('Monolitos sin gobierno:')
    for (const f of report.ungoverned) lines.push(`  ${String(f.lines).padStart(6)}  ${f.file}`)
  }
  lines.push(`Huérfanos: ${report.orphans.skills.length} skills, ${report.orphans.agents.length} agentes.`)
  lines.push(`Documentos de gobierno: ${report.docs.scanned} leídos, ${report.docs.brokenPaths.length} rutas rotas.`)
  lines.push(`Make targets citados: ${report.makeTargets.cited}, inexistentes: ${report.makeTargets.broken.length}.`)
  lines.push(`Carga por ruta: ${report.load.map((r) => `${r.name}=${r.total}`).join(', ')}.`)
  return lines.join('\n')
}
