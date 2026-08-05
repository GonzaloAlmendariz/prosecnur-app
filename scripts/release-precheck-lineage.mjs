#!/usr/bin/env node

// Precheck de release por linaje (ADR 0059).
//
// El reuso base es por SHA exacto: un Quality verde sobre el mismo commit fija
// el árbol entero, incluida la definición de quality.yml, así que no puede
// diferir del run que se omite. Cuando no hay verde del SHA exacto, se camina
// la ancestría por PRIMER PADRE (profundidad máxima 5) mientras el diff
// ACUMULADO ancestro..SHA toque únicamente la lista blanca cerrada de
// packaging: el árbol de producto (api/R, frontend, desktop) es idéntico por
// construcción al del ancestro ya verificado. Cualquier archivo fuera de la
// lista —incluida CUALQUIER ruta de .github/, porque la definición del gate
// solo se valida corriéndolo— corta la caminata y el gate corre completo.
//
// Todo reuso imprime el SHA verde reusado y la lista de archivos del diff: un
// reuso sin esa evidencia es un bug del precheck, no una optimización.

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const LINEAGE_MAX_DEPTH = 5

// Lista blanca CERRADA (ADR 0059): ampliarla exige revisar ese ADR.
const ALLOWED_EXACT = new Set(['api/renv.lock'])
const ALLOWED_PREFIXES = ['packaging/']

export function classifyFile(file) {
  if (file.startsWith('.github/')) return 'gate'
  if (ALLOWED_EXACT.has(file)) return 'allowed'
  if (ALLOWED_PREFIXES.some((prefix) => file.startsWith(prefix))) return 'allowed'
  return 'outside'
}

export function createGitDeps({ cwd }) {
  const git = (...args) => execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })
  return {
    // Devuelve hasta maxDepth ancestros por primer padre, del más cercano al
    // más lejano, sin incluir al propio SHA. Un clone poco profundo devuelve
    // menos ancestros y la caminata simplemente se acorta.
    listFirstParent(sha, maxDepth) {
      return git('rev-list', '--first-parent', '--max-count', String(maxDepth + 1), sha)
        .trim()
        .split('\n')
        .filter(Boolean)
        .slice(1)
    },
    diffFiles(from, to) {
      return git('diff', '--name-only', from, to)
        .trim()
        .split('\n')
        .filter(Boolean)
        .sort()
    }
  }
}

export function createQualityQuery({ repository }) {
  return (sha) => {
    try {
      const out = execFileSync('gh', [
        'api',
        `repos/${repository}/actions/workflows/quality.yml/runs?head_sha=${sha}&status=completed&per_page=20`,
        '--jq',
        '[.workflow_runs[] | select(.conclusion=="success")] | length'
      ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      return Number.parseInt(out.trim(), 10) > 0
    } catch {
      // Fail-closed: si la consulta falla no se asume verde; el gate corre.
      return false
    }
  }
}

export function evaluatePrecheckLineage({
  sha,
  maxDepth = LINEAGE_MAX_DEPTH,
  listFirstParent,
  diffFiles,
  hasGreenQuality
}) {
  const log = []
  if (hasGreenQuality(sha)) {
    log.push(`[precheck] Quality ya pasó para ${sha}; se reusa ese verde.`)
    return { skipGate: true, reusedSha: sha, depth: 0, files: [], reason: 'exact-sha', log }
  }
  log.push(`[precheck] Sin Quality exitoso del SHA exacto ${sha}; se camina la ancestría por primer padre (máx ${maxDepth}).`)

  const ancestors = listFirstParent(sha, maxDepth)
  for (let depth = 1; depth <= Math.min(maxDepth, ancestors.length); depth += 1) {
    const ancestor = ancestors[depth - 1]
    const files = diffFiles(ancestor, sha)
    const gateFiles = files.filter((file) => classifyFile(file) === 'gate')
    const outsideFiles = files.filter((file) => classifyFile(file) === 'outside')
    if (gateFiles.length) {
      log.push(`[precheck] El diff ${ancestor}..${sha} toca .github/ (${gateFiles.join(', ')}); la definición del gate solo se valida corriéndolo. Gate completo.`)
      return { skipGate: false, reason: 'gate-files', cutAt: ancestor, depth, files, log }
    }
    if (outsideFiles.length) {
      log.push(`[precheck] El diff ${ancestor}..${sha} sale de la lista blanca (${outsideFiles.join(', ')}). Gate completo.`)
      return { skipGate: false, reason: 'outside-allowlist', cutAt: ancestor, depth, files, log }
    }
    if (hasGreenQuality(ancestor)) {
      log.push(`[precheck] Quality verde reusado del ancestro ${ancestor} (profundidad ${depth}).`)
      log.push(`[precheck] Diff acumulado ${ancestor}..${sha} (${files.length} archivo${files.length === 1 ? '' : 's'}, todos en la lista blanca): ${files.join(', ') || '(vacío)'}`)
      return { skipGate: true, reusedSha: ancestor, depth, files, reason: 'lineage', log }
    }
    log.push(`[precheck] Ancestro ${ancestor} (profundidad ${depth}) sin Quality verde; el diff acumulado sigue dentro de la lista blanca.`)
  }
  log.push(`[precheck] Sin Quality verde en los primeros ${Math.min(maxDepth, ancestors.length)} ancestros por primer padre. Gate completo.`)
  return { skipGate: false, reason: 'no-green-in-lineage', depth: Math.min(maxDepth, ancestors.length), files: [], log }
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invoked) {
  const sha = process.argv[2] ?? ''
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    process.stderr.write('Uso: node scripts/release-precheck-lineage.mjs <sha-completo>\n')
    process.exit(1)
  }
  const repository = process.env.GITHUB_REPOSITORY ?? ''
  if (!repository) {
    process.stderr.write('Falta GITHUB_REPOSITORY para consultar los runs de Quality.\n')
    process.exit(1)
  }
  const { listFirstParent, diffFiles } = createGitDeps({ cwd: process.cwd() })
  const result = evaluatePrecheckLineage({
    sha,
    listFirstParent,
    diffFiles,
    hasGreenQuality: createQualityQuery({ repository })
  })
  for (const line of result.log) process.stdout.write(`${line}\n`)
  const outputPath = process.env.GITHUB_OUTPUT
  const outputLine = `skip_gate=${result.skipGate ? 'true' : 'false'}\n`
  if (outputPath) {
    fs.appendFileSync(outputPath, outputLine)
  } else {
    process.stdout.write(outputLine)
  }
}
