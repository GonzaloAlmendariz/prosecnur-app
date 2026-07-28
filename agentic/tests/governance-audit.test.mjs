import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { runGovernanceAudit } from '../governance-audit.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

function scratch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gov-audit-'))
  fs.mkdirSync(path.join(dir, 'api/R'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'frontend/src'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'Makefile'), 'listo:\n\t@true\n')
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# fixture\n')
  return dir
}

const file = (dir, rel, lines) => {
  fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true })
  fs.writeFileSync(path.join(dir, rel), 'x\n'.repeat(lines))
}

const baseManifest = (over = {}) => ({
  skills: ['usado'],
  agents: ['usado'],
  routes: { r: { skills: ['usado'], external: [], pools: { gate: ['usado'] } } },
  policy: { frozen_growth_files: [], frozen_growth_baseline: {}, frozen_growth_threshold: 8000 },
  ...over
})

test('un archivo congelado que crece sobre su línea base falla', () => {
  const dir = scratch()
  file(dir, 'api/R/engine.R', 120)
  const m = baseManifest()
  m.policy.frozen_growth_files = ['api/R/engine.R']
  m.policy.frozen_growth_baseline = { 'api/R/engine.R': 100 }
  const { errors, report } = runGovernanceAudit(m, dir)
  assert.equal(report.frozen[0].delta, 20)
  assert.equal(errors.filter((e) => e.includes('creció')).length, 1)

  m.policy.frozen_growth_baseline = { 'api/R/engine.R': 120 }
  assert.equal(runGovernanceAudit(m, dir).errors.length, 0, 'en su línea base no debe fallar')
})

test('un congelado inexistente falla en vez de pasar en silencio', () => {
  // Regresión literal: MonitoreoPage.tsx siguió congelado tras borrarse.
  const dir = scratch()
  const m = baseManifest()
  m.policy.frozen_growth_files = ['frontend/src/borrado.tsx']
  m.policy.frozen_growth_baseline = { 'frontend/src/borrado.tsx': 10 }
  assert.equal(runGovernanceAudit(m, dir).errors.filter((e) => e.includes('inexistente')).length, 1)
})

test('un monolito nuevo sin gobierno falla; exento o congelado no', () => {
  // Regresión literal: dos monolitos de perfil de ~20k líneas crecieron
  // invisibles tras retirarse el que sí estaba congelado.
  const dir = scratch()
  file(dir, 'frontend/src/Monolito.tsx', 9000)
  file(dir, 'frontend/src/pequeno.tsx', 40)
  const m = baseManifest()
  const first = runGovernanceAudit(m, dir)
  assert.deepEqual(first.report.ungoverned.map((u) => u.file), ['frontend/src/Monolito.tsx'])
  assert.equal(first.errors.filter((e) => e.includes('sin gobierno')).length, 1)

  m.policy.frozen_growth_exempt = ['frontend/src/Monolito.tsx']
  assert.equal(runGovernanceAudit(m, dir).errors.length, 0, 'exento explícito no debe fallar')
})

test('los tests no cuentan como monolitos sin gobierno', () => {
  const dir = scratch()
  file(dir, 'frontend/src/enorme.test.ts', 9000)
  assert.equal(runGovernanceAudit(baseManifest(), dir).report.ungoverned.length, 0)
})

test('un skill o agente sin ruta es huérfano', () => {
  const dir = scratch()
  const m = baseManifest({ skills: ['usado', 'suelto'], agents: ['usado', 'perdido'] })
  const { errors, report } = runGovernanceAudit(m, dir)
  assert.deepEqual(report.orphans, { skills: ['suelto'], agents: ['perdido'] })
  assert.equal(errors.filter((e) => e.includes('huérfano')).length, 2)
})

test('rutas y make targets citados deben existir', () => {
  const dir = scratch()
  file(dir, 'frontend/src/real.ts', 5)
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'),
    'usa `src/real.ts` y `src/fantasma.ts`; corre `make listo` y `make inventado`\n')
  const { errors, report } = runGovernanceAudit(baseManifest(), dir)
  assert.deepEqual(report.docs.brokenPaths.map((b) => b.cited), ['src/fantasma.ts'],
    'una ruta relativa a frontend/src no es una ruta rota')
  assert.deepEqual(report.makeTargets.broken, ['inventado'])
  assert.equal(errors.filter((e) => e.includes('inexistente')).length, 2)
})

test('una ruta con el doble de la carga mediana avisa sin fallar', () => {
  const dir = scratch()
  const routes = {
    a: { skills: ['usado'], external: [], pools: {} },
    b: { skills: ['usado'], external: [], pools: {} },
    pesada: { skills: ['usado'], external: ['e1', 'e2', 'e3'], pools: { gate: ['usado'] } }
  }
  const { errors, warnings } = runGovernanceAudit(baseManifest({ routes }), dir)
  assert.equal(warnings.filter((w) => w.includes('sobrecargada')).length, 1)
  assert.equal(errors.length, 0, 'el desbalance informa, no bloquea')
})

// La conformidad del repositorio la exige el paso `--audit` del CI, no esta
// suite: un hallazgo real es un estado legítimo que la herramienta debe
// reportar, no una prueba rota. Aquí solo se comprueba que `--audit` corre
// sobre el repositorio real y emite un veredicto reconocible.
test('--audit corre sobre el repositorio real y emite veredicto', () => {
  let out
  try {
    out = execFileSync('node', ['agentic/sync-agentic-os.mjs', '--audit'], { cwd: repoRoot, encoding: 'utf8' })
    assert.match(out, /OK: auditoría de gobierno/)
    return
  } catch (error) {
    assert.equal(error.status, 1, 'un hallazgo debe salir con código 1, no con un fallo de ejecución')
    const found = `${error.stdout ?? ''}${error.stderr ?? ''}`
    assert.match(found, /^ERROR: (archivo congelado creció|congelado inexistente|congelado sin línea base|monolito sin gobierno|skill huérfano|agente huérfano|ruta inexistente citada|make target citado)/m,
      'todo hallazgo debe pertenecer a una categoría declarada de la auditoría')
  }
})
