import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import test from 'node:test'

import {
  LINEAGE_MAX_DEPTH,
  classifyFile,
  createGitDeps,
  evaluatePrecheckLineage
} from '../release-precheck-lineage.mjs'

function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}

function repoFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'precheck-lineage-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  git(root, 'init', '-q', '-b', 'main')
  git(root, 'config', 'user.name', 'Precheck Lineage')
  git(root, 'config', 'user.email', 'precheck@example.test')
  return root
}

function commit(root, message, files) {
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content)
  }
  git(root, 'add', '-A')
  git(root, 'commit', '-qm', message)
  return git(root, 'rev-parse', 'HEAD')
}

function evaluate(root, sha, greens, overrides = {}) {
  const deps = createGitDeps({ cwd: root })
  return evaluatePrecheckLineage({
    sha,
    listFirstParent: deps.listFirstParent,
    diffFiles: deps.diffFiles,
    hasGreenQuality: (candidate) => greens.has(candidate),
    ...overrides
  })
}

test('la lista blanca es cerrada: renv.lock y packaging/** entran, .github/ y el resto no', () => {
  assert.equal(classifyFile('api/renv.lock'), 'allowed')
  assert.equal(classifyFile('packaging/r-snapshot-date.txt'), 'allowed')
  assert.equal(classifyFile('packaging/windows/download-r-win-binaries.R'), 'allowed')
  assert.equal(classifyFile('.github/workflows/release.yml'), 'gate')
  assert.equal(classifyFile('.github/RELEASE_NOTES.md'), 'gate')
  assert.equal(classifyFile('api/R/errors.R'), 'outside')
  assert.equal(classifyFile('api/DESCRIPTION'), 'outside')
  assert.equal(classifyFile('frontend/src/app/App.tsx'), 'outside')
  assert.equal(classifyFile('desktop/main.cjs'), 'outside')
  // Un prefijo parecido no es el prefijo: la lista no filtra por forma.
  assert.equal(classifyFile('packaging-extra/nota.md'), 'outside')
})

test('un verde del SHA exacto se reusa sin caminar el linaje', (t) => {
  const root = repoFixture(t)
  const head = commit(root, 'base', { 'api/R/motor.R': 'motor' })

  const result = evaluate(root, head, new Set([head]))

  assert.equal(result.skipGate, true)
  assert.equal(result.reusedSha, head)
  assert.equal(result.depth, 0)
  assert.deepEqual(result.files, [])
  assert.match(result.log.join('\n'), new RegExp(head))
})

test('un diff acumulado dentro de la lista blanca reusa el verde del ancestro y deja evidencia', (t) => {
  const root = repoFixture(t)
  const base = commit(root, 'base verificada', { 'api/R/motor.R': 'motor' })
  commit(root, 'sube el lock', { 'api/renv.lock': '{"nuevo": true}' })
  const head = commit(root, 'avanza el snapshot', { 'packaging/r-snapshot-date.txt': '2026-08-04\n' })

  const result = evaluate(root, head, new Set([base]))

  assert.equal(result.skipGate, true)
  assert.equal(result.reusedSha, base)
  assert.equal(result.depth, 2)
  assert.deepEqual(result.files, ['api/renv.lock', 'packaging/r-snapshot-date.txt'])
  // El ADR exige la evidencia en el log: SHA reusado y archivos del diff.
  const log = result.log.join('\n')
  assert.match(log, new RegExp(base))
  assert.match(log, /api\/renv\.lock/)
  assert.match(log, /packaging\/r-snapshot-date\.txt/)
})

test('un archivo fuera de la lista blanca corta la caminata aunque el ancestro esté verde', (t) => {
  const root = repoFixture(t)
  const base = commit(root, 'base verificada', { 'api/R/motor.R': 'motor' })
  const head = commit(root, 'toca producto', {
    'packaging/r-snapshot-date.txt': '2026-08-04\n',
    'api/R/motor.R': 'motor cambiado'
  })

  const result = evaluate(root, head, new Set([base]))

  assert.equal(result.skipGate, false)
  assert.equal(result.reason, 'outside-allowlist')
  assert.match(result.log.join('\n'), /api\/R\/motor\.R/)
})

test('cualquier ruta .github/ corta la caminata: el gate solo se valida corriéndolo', (t) => {
  const root = repoFixture(t)
  const base = commit(root, 'base verificada', { 'api/R/motor.R': 'motor' })
  const head = commit(root, 'toca el workflow', {
    'api/renv.lock': '{"nuevo": true}',
    '.github/workflows/release.yml': 'jobs: {}'
  })

  const result = evaluate(root, head, new Set([base]))

  assert.equal(result.skipGate, false)
  assert.equal(result.reason, 'gate-files')
  assert.match(result.log.join('\n'), /\.github\/workflows\/release\.yml/)
})

test('la caminata sigue la línea de primer padre: un merge que trae producto no reusa', (t) => {
  const root = repoFixture(t)
  commit(root, 'base', { 'api/R/motor.R': 'motor' })
  const mainTip = commit(root, 'packaging en main', { 'packaging/nota.txt': 'nota' })
  git(root, 'checkout', '-qb', 'lateral', 'HEAD~1')
  commit(root, 'producto en lateral', { 'frontend/src/app/App.tsx': 'app' })
  git(root, 'checkout', '-q', 'main')
  git(root, 'merge', '-q', '--no-ff', '-m', 'merge lateral', 'lateral')
  const mergeSha = git(root, 'rev-parse', 'HEAD')
  assert.equal(git(root, 'rev-parse', 'HEAD^1'), mainTip)

  const result = evaluate(root, mergeSha, new Set([mainTip]))

  // El primer padre (mainTip) está verde, pero el diff acumulado del merge
  // incluye el frontend traído por la rama lateral: gate completo.
  assert.equal(result.skipGate, false)
  assert.equal(result.reason, 'outside-allowlist')
  assert.match(result.log.join('\n'), /frontend\/src\/app\/App\.tsx/)
})

test('un verde más allá de la profundidad máxima no se reusa', (t) => {
  const root = repoFixture(t)
  const base = commit(root, 'base verificada', { 'api/R/motor.R': 'motor' })
  let head = base
  for (let step = 1; step <= LINEAGE_MAX_DEPTH + 1; step += 1) {
    head = commit(root, `packaging ${step}`, { 'packaging/nota.txt': `nota ${step}` })
  }

  const result = evaluate(root, head, new Set([base]))

  assert.equal(result.skipGate, false)
  assert.equal(result.reason, 'no-green-in-lineage')
  assert.equal(result.depth, LINEAGE_MAX_DEPTH)

  // Falsabilidad del límite: el mismo linaje con el verde a profundidad 5 sí
  // reusa. Si esto dejara de pasar, el test anterior estaría verde por otra
  // causa (p. ej. un walk roto que nunca encuentra nada).
  const withinDepth = evaluate(root, head, new Set([git(root, 'rev-parse', `${head}~${LINEAGE_MAX_DEPTH}`)]))
  assert.equal(withinDepth.skipGate, true)
  assert.equal(withinDepth.depth, LINEAGE_MAX_DEPTH)
})

test('sin verde en el SHA ni en los ancestros el gate corre completo', (t) => {
  const root = repoFixture(t)
  commit(root, 'base', { 'api/R/motor.R': 'motor' })
  const head = commit(root, 'packaging', { 'packaging/nota.txt': 'nota' })

  const result = evaluate(root, head, new Set())

  assert.equal(result.skipGate, false)
  assert.equal(result.reason, 'no-green-in-lineage')
})

test('una historia más corta que la profundidad máxima no rompe la caminata', (t) => {
  const root = repoFixture(t)
  const head = commit(root, 'único commit', { 'packaging/nota.txt': 'nota' })

  const result = evaluate(root, head, new Set())

  assert.equal(result.skipGate, false)
  assert.equal(result.reason, 'no-green-in-lineage')
  assert.equal(result.depth, 0)
})
