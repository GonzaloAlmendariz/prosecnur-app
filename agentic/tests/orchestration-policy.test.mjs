import assert from 'node:assert/strict'
import test from 'node:test'
import { planScenario } from '../orchestration-policy.mjs'

const auditLines = [
  { agent: 'diagnosticador-regresiones', profile: 'read-only', ownedFiles: [] },
  { agent: 'guardian-contratos', profile: 'read-only', ownedFiles: [] },
  { agent: 'revisor-metodologico', profile: 'read-only', ownedFiles: [] }
]

test('smoke Codex: tres investigaciones independientes ocupan tres workers', () => {
  const plan = planScenario({ provider: 'codex', lines: auditLines })
  assert.equal(plan.mode, 'parallel')
  assert.equal(plan.mechanism, 'subagents')
  assert.equal(plan.workers.length, 3)
})

test('smoke Claude: subagents background son el mecanismo ordinario', () => {
  const plan = planScenario({ provider: 'claude', lines: auditLines })
  assert.equal(plan.mode, 'parallel')
  assert.equal(plan.mechanism, 'background-subagents')
  assert.equal(plan.workers.length, 3)
})

test('smoke Claude Teams: hipótesis comunicantes usan Agent Teams', () => {
  const plan = planScenario({ provider: 'claude', directCommunication: true, lines: auditLines })
  assert.equal(plan.mechanism, 'agent-teams')
  assert.equal(plan.workers.length, 3)
})

test('smoke escritura: permite dos writers con archivos disjuntos', () => {
  const plan = planScenario({
    provider: 'codex',
    lines: [
      { agent: 'backend-r', profile: 'writer', ownedFiles: ['api/R/nuevo.R'] },
      { agent: 'autor-regresiones', profile: 'writer', ownedFiles: ['api/tests/testthat/test-nuevo.R'] }
    ]
  })
  assert.equal(plan.mode, 'parallel')
  assert.equal(plan.workers.length, 2)
})

test('smoke escritura: reserva el tercer worker para revisión', () => {
  const plan = planScenario({
    provider: 'codex',
    lines: [
      { agent: 'backend-r', profile: 'writer', ownedFiles: ['api/R/nuevo.R'] },
      { agent: 'autor-regresiones', profile: 'writer', ownedFiles: ['api/tests/testthat/test-nuevo.R'] },
      { agent: 'guardian-contratos', profile: 'read-only', ownedFiles: [] },
      { agent: 'frontend-react', profile: 'writer', ownedFiles: ['frontend/src/nuevo.ts'] }
    ]
  })
  assert.deepEqual(plan.workers.map((worker) => worker.agent), [
    'backend-r', 'autor-regresiones', 'guardian-contratos'
  ])
  assert.deepEqual(plan.pending.map((worker) => worker.agent), ['frontend-react'])
})

test('smoke escritura: una colisión detiene la oleada', () => {
  const plan = planScenario({
    provider: 'codex',
    lines: [
      { agent: 'backend-r', profile: 'writer', ownedFiles: ['api/R/contrato.R'] },
      { agent: 'frontend-react', profile: 'writer', ownedFiles: ['api/R/contrato.R'] }
    ]
  })
  assert.equal(plan.status, 'blocked')
  assert.equal(plan.reason, 'overlapping_ownership')
  assert.deepEqual(plan.conflicts, ['api/r/contrato.r'])
})

test('smoke escritura: normaliza paths y casing antes de comparar ownership', () => {
  const plan = planScenario({
    provider: 'codex',
    lines: [
      { agent: 'backend-r', profile: 'writer', ownedFiles: ['API/R/../R/contrato.R'] },
      { agent: 'frontend-react', profile: 'writer', ownedFiles: ['api/r/contrato.r'] }
    ]
  })
  assert.equal(plan.status, 'blocked')
  assert.equal(plan.reason, 'overlapping_ownership')
})

test('smoke escritura: ownership de directorio colisiona con sus descendientes', () => {
  const plan = planScenario({
    provider: 'codex',
    lines: [
      { agent: 'frontend-react', profile: 'writer', ownedFiles: ['frontend/src/'] },
      { agent: 'autor-regresiones', profile: 'writer', ownedFiles: ['frontend/src/App.test.tsx'] }
    ]
  })
  assert.equal(plan.status, 'blocked')
  assert.equal(plan.reason, 'overlapping_ownership')
})

test('smoke escritura: normaliza directorios sin slash final de forma conservadora', () => {
  const plan = planScenario({
    provider: 'codex',
    lines: [
      { agent: 'frontend-react', profile: 'writer', ownedFiles: ['frontend/src'] },
      { agent: 'autor-regresiones', profile: 'writer', ownedFiles: ['frontend/src/App.test.tsx'] }
    ]
  })
  assert.equal(plan.status, 'blocked')
  assert.equal(plan.reason, 'overlapping_ownership')
})

test('smoke escritura: writers sin ownership congelado no se lanzan', () => {
  for (const ownedFiles of [undefined, []]) {
    const plan = planScenario({
      provider: 'codex',
      lines: [
        { agent: 'backend-r', profile: 'writer', ...(ownedFiles === undefined ? {} : { ownedFiles }) },
        { agent: 'frontend-react', profile: 'writer', ownedFiles: ['frontend/src/App.tsx'] }
      ]
    })
    assert.equal(plan.status, 'blocked')
    assert.equal(plan.reason, 'missing_ownership')
    assert.deepEqual(plan.missingOwnership, ['backend-r'])
  }
})

test('smoke: un perfil desconocido no evade el límite de writers', () => {
  const plan = planScenario({
    provider: 'codex',
    lines: [
      { agent: 'agente-falso', profile: 'super-writer', ownedFiles: ['api/R/falso.R'] },
      auditLines[0]
    ]
  })
  assert.equal(plan.status, 'blocked')
  assert.equal(plan.reason, 'invalid_profile')
  assert.deepEqual(plan.invalidProfiles, ['agente-falso'])
})

test('smoke escritura: exige materializar globs antes de lanzar writers', () => {
  const plan = planScenario({
    provider: 'codex',
    lines: [
      { agent: 'backend-r', profile: 'writer', ownedFiles: ['api/R/**'] },
      { agent: 'autor-regresiones', profile: 'writer', ownedFiles: ['api/tests/testthat/test-x.R'] }
    ]
  })
  assert.equal(plan.status, 'blocked')
  assert.equal(plan.reason, 'unresolved_ownership_glob')
  assert.deepEqual(plan.unresolved, ['api/R/**'])
})

test('smoke trivial: una sola línea permanece single-agent', () => {
  const plan = planScenario({ provider: 'codex', lines: [auditLines[0]] })
  assert.equal(plan.mode, 'serial')
  assert.equal(plan.reason, 'single_line')
  assert.equal(plan.workers.length, 1)
  assert.equal(plan.pending.length, 0)
})

test('selector serial conserva las líneas restantes como pending', () => {
  const plan = planScenario({ provider: 'codex', serialFlags: ['credentials'], lines: auditLines })
  assert.equal(plan.mode, 'serial')
  assert.equal(plan.workers.length, 1)
  assert.equal(plan.pending.length, 2)
})
