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
  fs.mkdirSync(path.join(dir, 'frontend/src/lib/navegacion'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'frontend/src/api'), { recursive: true })
  fs.mkdirSync(path.join(dir, '.claude/skills/fixture'), { recursive: true })
  fs.mkdirSync(path.join(dir, '.claude/agents'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'Makefile'), 'listo:\n\t@true\n')
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# fixture\n')
  fs.writeFileSync(path.join(dir, '.claude/skills/fixture/SKILL.md'), '# skill fixture\n')
  fs.writeFileSync(path.join(dir, '.claude/agents/fixture.md'), '# agent fixture\n')
  fs.writeFileSync(path.join(dir, 'frontend/src/lib/modules.ts'), [
    'export const PROSECNUR_NAVIGATION_CONTRACT = {',
    '  version: 3,',
    '  grammar: "modulo/modo/seccion/pestana/panel",',
    '} as const;',
    ''
  ].join('\n'))
  fs.writeFileSync(path.join(dir, 'frontend/src/lib/navegacion/direccion.ts'), [
    'export const NIVELES_DIRECCION = ["modulo", "modo", "seccion", "pestana", "panel"] as const;',
    'export const PARAMS_DIRECCION = {',
    '  modo: "modo",',
    '  seccion: "seccion",',
    '  pestana: "pestana",',
    '  panel: "panel",',
    '} as const;',
    'export function serializarDireccion() {',
    '  const params = new URLSearchParams();',
    '  params.set(PARAMS_DIRECCION.modo, "x");',
    '  params.set(PARAMS_DIRECCION.seccion, "x");',
    '  params.set(PARAMS_DIRECCION.pestana, "x");',
    '  params.set(PARAMS_DIRECCION.panel, "x");',
    '  return params.toString();',
    '}',
    ''
  ].join('\n'))
  fs.writeFileSync(path.join(dir, 'frontend/src/api/client.ts'), 'export * from "./core";\n')
  fs.writeFileSync(path.join(dir, 'frontend/src/api/core.ts'), 'export const apiBase = "/api";\n')
  return dir
}

const file = (dir, rel, lines) => {
  fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true })
  fs.writeFileSync(path.join(dir, rel), 'x\n'.repeat(lines))
}

const baseManifest = (over = {}) => ({
  skills: ['usado'],
  agents: ['usado'],
  routes: {
    r: { skills: ['usado'], external: [], pools: { gate: ['usado'] } },
    disenar: {
      skills: ['usado'],
      external: ['emil-design-eng', 'govern-visual-harmony'],
      pools: {}
    }
  },
  external_skills: ['emil-design-eng', 'govern-visual-harmony'],
  policy: {
    frozen_growth_files: [],
    frozen_growth_baseline: {},
    frozen_growth_threshold: 8000,
    semantic_contract: {
      navigation: {
        version: 3,
        grammar: ['modulo', 'modo', 'seccion', 'pestana', 'panel'],
        manifest_path: 'frontend/src/lib/modules.ts',
        direction_path: 'frontend/src/lib/navegacion/direccion.ts'
      },
      frontend_api: {
        directory: 'frontend/src/api',
        compatibility_barrel: 'frontend/src/api/client.ts'
      },
      external_skills: {
        allowed: ['emil-design-eng', 'govern-visual-harmony'],
        route: 'disenar',
        forbidden_prefixes: ['prosecnur-']
      },
      instructions: {
        roots: ['CLAUDE.md', '.claude/skills', '.claude/agents'],
        forbidden_fragments: [
          'contrato de navegación v2',
          'uno de estos tres niveles',
          '`src/api/client.ts` (~15k líneas',
          '**NO existe conector de API**',
          'Fichas QR',
          'prosecnur-project'
        ]
      }
    }
  },
  ...over
})

test('un fixture semántico conforme pasa y expone estado legible', () => {
  const dir = scratch()
  const { errors, report } = runGovernanceAudit(baseManifest(), dir)
  assert.deepEqual(errors, [])
  assert.deepEqual(
    {
      navigation: report.semantic.navigation.status,
      frontendApi: report.semantic.frontendApi.status,
      externalSkills: report.semantic.externalSkills.status,
      instructions: report.semantic.instructions.status
    },
    { navigation: 'ok', frontendApi: 'ok', externalSkills: 'ok', instructions: 'ok' }
  )
  assert.equal(report.semantic.frontendApi.domainModules.length, 1)
  assert.equal(report.semantic.instructions.scanned, 3)
})

test('policy.semantic_contract es obligatorio y falla con una acción concreta', () => {
  const dir = scratch()
  const m = baseManifest()
  delete m.policy.semantic_contract
  const { errors, report } = runGovernanceAudit(m, dir)
  assert.equal(report.semantic.configured, false)
  assert.ok(errors.some((error) => error.includes('falta policy.semantic_contract')))
})

test('deriva del manifiesto de navegación a v2 falla', () => {
  const dir = scratch()
  fs.writeFileSync(path.join(dir, 'frontend/src/lib/modules.ts'), [
    'export const PROSECNUR_NAVIGATION_CONTRACT = {',
    '  version: 2,',
    '  grammar: "modulo/modo/seccion/pestana/panel",',
    '} as const;',
    ''
  ].join('\n'))
  const { errors, report } = runGovernanceAudit(baseManifest(), dir)
  assert.equal(report.semantic.navigation.status, 'error')
  assert.ok(errors.some((error) => error.includes('version 3') && error.includes('encontrado 2')))
})

test('un external prosecnur-* vuelve a fallar aunque una ruta lo cite', () => {
  const dir = scratch()
  const m = baseManifest()
  m.external_skills.push('prosecnur-project')
  m.routes.r.external = ['prosecnur-project']
  const { errors, report } = runGovernanceAudit(m, dir)
  assert.equal(report.semantic.externalSkills.status, 'error')
  assert.ok(errors.some((error) => error.includes('prefijo "prosecnur-"') && error.includes('prosecnur-project')))
  assert.ok(errors.some((error) => error.includes('routes.r.external') && error.includes('fuera del conjunto')))
})

test('allowed y manifest no pueden derivar juntos hacia un tercer external genérico', () => {
  const dir = scratch()
  const m = baseManifest()
  m.policy.semantic_contract.external_skills.allowed.push('generic-design-helper')
  m.external_skills.push('generic-design-helper')
  m.routes.r.external = ['generic-design-helper']
  const { errors, report } = runGovernanceAudit(m, dir)
  assert.equal(report.semantic.externalSkills.status, 'error')
  assert.ok(errors.some((error) =>
    error.includes('external_skills.allowed debe contener exactamente') &&
    error.includes('emil-design-eng, govern-visual-harmony')))
})

test('los externals solo pueden vivir en la ruta disenar', () => {
  const dir = scratch()
  const m = baseManifest()
  m.routes.r.external = ['emil-design-eng']
  m.routes.disenar.external = ['govern-visual-harmony']
  const { errors, report } = runGovernanceAudit(m, dir)
  assert.equal(report.semantic.externalSkills.status, 'error')
  assert.ok(errors.some((error) =>
    error.includes('routes.disenar.external debe contener exactamente')))
  assert.ok(errors.some((error) =>
    error.includes('routes.r.external debe quedar vacío')))
})

test('serializarDireccion no puede volver a emitir aliases legacy', () => {
  const dir = scratch()
  const direction = path.join(dir, 'frontend/src/lib/navegacion/direccion.ts')
  const source = fs.readFileSync(direction, 'utf8')
  fs.writeFileSync(direction, source.replace(
    '  params.set(PARAMS_DIRECCION.panel, "x");',
    [
      '  params.set(PARAMS_DIRECCION.panel, "x");',
      '  params.set("tab", "legacy");'
    ].join('\n')
  ))
  const { errors, report } = runGovernanceAudit(baseManifest(), dir)
  assert.equal(report.semantic.navigation.status, 'error')
  assert.ok(errors.some((error) =>
    error.includes('serializa el alias legacy "tab"') &&
    error.includes('solo pueden leerse o eliminarse')))
})

test('una instrucción que vuelve a llamar monolito a client.ts falla con archivo y línea', () => {
  const dir = scratch()
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), [
    '# fixture',
    '',
    '`src/api/client.ts` (~15k líneas) concentra el cliente tipado',
    ''
  ].join('\n'))
  const { errors, report } = runGovernanceAudit(baseManifest(), dir)
  assert.equal(report.semantic.instructions.status, 'error')
  assert.deepEqual(report.semantic.instructions.violations, [{
    doc: 'CLAUDE.md',
    line: 3,
    fragment: '`src/api/client.ts` (~15k líneas'
  }])
  assert.ok(errors.some((error) => error.includes('fragmento obsoleto en CLAUDE.md:3')))
})

test('una instrucción no puede reintroducir el nombre retirado de Recopiladores', () => {
  const dir = scratch()
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# fixture\n\nMódulo: Fichas QR\n')
  const { errors, report } = runGovernanceAudit(baseManifest(), dir)
  assert.equal(report.semantic.instructions.status, 'error')
  assert.ok(errors.some((error) =>
    error.includes('fragmento obsoleto en CLAUDE.md:3') &&
    error.includes('Fichas QR')))
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
    disenar: {
      skills: ['usado'],
      external: ['emil-design-eng', 'govern-visual-harmony'],
      pools: { gate: ['usado'] }
    }
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
    assert.match(found, /^ERROR: (archivo congelado creció|congelado inexistente|congelado sin línea base|monolito sin gobierno|skill huérfano|agente huérfano|ruta inexistente citada|make target citado|contrato semántico)/m,
      'todo hallazgo debe pertenecer a una categoría declarada de la auditoría')
  }
})
