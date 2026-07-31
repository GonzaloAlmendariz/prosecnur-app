import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { planScenario } from '../orchestration-policy.mjs'

const auditLines = [
  { agent: 'diagnosticador-regresiones', profile: 'read-only', ownedFiles: [] },
  { agent: 'guardian-contratos', profile: 'read-only', ownedFiles: [] },
  { agent: 'revisor-metodologico', profile: 'read-only', ownedFiles: [] }
]

test('skill canónico alinea contrato y ownership con la política ejecutable', () => {
  const skill = readFileSync(
    new URL('../../.claude/skills/orquestar-trabajo/SKILL.md', import.meta.url),
    'utf8'
  )
  const contract = skill.match(/```text\nORCHESTRATION CONTRACT\n(?<body>[\s\S]*?)```/)?.groups?.body

  assert.doesNotMatch(skill, /\bnormaliza rutas y casing\b/i)
  assert.match(contract ?? '', /^Condición de unión:$/m)
  assert.match(skill, /Prefiere entradas\s+`\{ path, kind: "file" \| "tree" \}`/)
  assert.match(skill, /Preserva rutas y casing:\s+no normalices casing,\s+`\.` ni `\.\.`/)
  assert.match(skill, /Rechaza rutas absolutas,[^.]*segmentos vacíos o ambiguos,[^.]*globs/s)
})

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
  assert.deepEqual(plan.conflicts, ['api/R/contrato.R'])
})

test('smoke escritura: rechaza segmentos ambiguos en vez de normalizarlos', () => {
  const plan = planScenario({
    provider: 'codex',
    lines: [
      { agent: 'backend-r', profile: 'writer', ownedFiles: ['API/R/../R/contrato.R'] },
      { agent: 'frontend-react', profile: 'writer', ownedFiles: ['api/r/contrato.r'] }
    ]
  })
  assert.equal(plan.status, 'blocked')
  assert.equal(plan.reason, 'invalid_ownership_path')
  assert.deepEqual(plan.invalidOwnershipPaths, ['API/R/../R/contrato.R'])
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

test('smoke escritura: no infiere tree por ausencia de extensión', () => {
  const plan = planScenario({
    provider: 'codex',
    lines: [
      { agent: 'frontend-react', profile: 'writer', ownedFiles: ['frontend/src'] },
      { agent: 'autor-regresiones', profile: 'writer', ownedFiles: ['frontend/src/App.test.tsx'] }
    ]
  })
  assert.equal(plan.status, 'ready')
  assert.equal(plan.mode, 'parallel')
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

test('smoke: un agente no declarado se bloquea aunque use un perfil válido', () => {
  const plan = planScenario({
    provider: 'codex',
    lines: [
      { agent: 'agente-falso', profile: 'writer', ownedFiles: ['api/R/falso.R'] },
      auditLines[0]
    ]
  })
  assert.equal(plan.status, 'blocked')
  assert.equal(plan.reason, 'invalid_agent')
  assert.deepEqual(plan.invalidAgents, ['agente-falso'])
})

test('smoke: exige el perfil declarado para cada agente', () => {
  const plan = planScenario({
    provider: 'codex',
    lines: [
      { agent: 'backend-r', profile: 'read-only', ownedFiles: [] },
      auditLines[0]
    ]
  })
  assert.equal(plan.status, 'blocked')
  assert.equal(plan.reason, 'invalid_profile')
  assert.deepEqual(plan.invalidProfiles, ['backend-r'])
})

test('smoke: rechaza provider desconocido de forma determinista', () => {
  const plan = planScenario({ provider: 'otro', lines: auditLines })
  assert.equal(plan.status, 'blocked')
  assert.equal(plan.reason, 'invalid_provider')
  assert.equal(plan.invalidProvider, 'otro')
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

test('smoke escritura: acepta ownership tipado y detecta tree/descendiente', () => {
  const plan = planScenario({
    provider: 'codex',
    lines: [
      { agent: 'frontend-react', profile: 'writer', ownedFiles: [{ path: 'frontend/src', kind: 'tree' }] },
      { agent: 'autor-regresiones', profile: 'writer', ownedFiles: [{ path: 'frontend/src/App.test.tsx', kind: 'file' }] }
    ]
  })
  assert.equal(plan.status, 'blocked')
  assert.equal(plan.reason, 'overlapping_ownership')
  assert.deepEqual(plan.conflicts, ['frontend/src'])
})

test('smoke escritura: rechaza kind inválido sin inferir intención', () => {
  const plan = planScenario({
    provider: 'codex',
    lines: [
      { agent: 'backend-r', profile: 'writer', ownedFiles: [{ path: 'api/R', kind: 'directory' }] },
      auditLines[0]
    ]
  })
  assert.equal(plan.status, 'blocked')
  assert.equal(plan.reason, 'invalid_ownership_kind')
})

test('smoke escritura: rechaza formas de path ambiguas o no portables', () => {
  for (const ownedFile of ['/tmp/a.R', 'api/./R/a.R', 'api/../R/a.R', 'api\\R\\a.R', 'api/R/\u0007a.R']) {
    const plan = planScenario({
      provider: 'codex',
      lines: [
        { agent: 'backend-r', profile: 'writer', ownedFiles: [ownedFile] },
        auditLines[0]
      ]
    })
    assert.equal(plan.status, 'blocked', ownedFile)
    assert.equal(plan.reason, 'invalid_ownership_path', ownedFile)
  }
})

test('smoke escritura: preserva casing al comparar identidades', () => {
  const plan = planScenario({
    provider: 'codex',
    lines: [
      { agent: 'backend-r', profile: 'writer', ownedFiles: ['API/R/contrato.R'] },
      { agent: 'autor-regresiones', profile: 'writer', ownedFiles: ['api/r/contrato.r'] }
    ]
  })
  assert.equal(plan.status, 'ready')
  assert.equal(plan.mode, 'parallel')
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
