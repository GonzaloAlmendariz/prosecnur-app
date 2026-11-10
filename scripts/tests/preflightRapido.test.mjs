// El pre-flight rápido espeja pasos de quality.yml. Dos listas que nadie ata se
// separan en silencio: el skill /preparar-release copiaba ocho comandos y dejaba
// fuera cuatro que el CI sí corría (diagnóstico del ciclo de release,
// 2026-11-10). Este contrato ata las dos:
// - cada `run:` de los jobs agentic-os y frontend tiene su paso en el pre-flight
//   o figura entre los excluidos con su motivo;
// - cada paso del pre-flight cita un `run:` que sigue existiendo en el workflow.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { FUERA_DEL_PREFLIGHT, PASOS } from '../preflight-rapido.mjs'

const workflow = readFileSync(new URL('../../.github/workflows/quality.yml', import.meta.url), 'utf8')

/** Los `run:` de un job, de una línea o en bloque (`run: |`), sin sangría. */
export function runsDelJob(texto, job) {
  const lineas = texto.split('\n')
  const inicio = lineas.findIndex((l) => l === `  ${job}:`)
  if (inicio < 0) return null
  const fin = lineas.findIndex((l, i) => i > inicio && /^ {2}[\w-]+:\s*$/u.test(l))
  const bloque = lineas.slice(inicio + 1, fin < 0 ? undefined : fin)
  const runs = []
  for (let i = 0; i < bloque.length; i += 1) {
    const m = bloque[i].match(/^(\s*(?:- )?)run:\s*(.*)$/u)
    if (!m) continue
    if (m[2] !== '|') {
      runs.push(m[2].trim())
      continue
    }
    // El cuerpo del bloque es lo que queda más sangrado que la clave `run:`.
    const sangria = ' '.repeat(m[1].length + 1)
    const cuerpo = []
    for (let j = i + 1; j < bloque.length && (bloque[j].trim() === '' || bloque[j].startsWith(sangria)); j += 1) {
      if (bloque[j].trim()) cuerpo.push(bloque[j].trim())
    }
    runs.push(cuerpo.join('\n'))
  }
  return runs
}

/** Los `run:` del job que ningún paso del pre-flight cita y que nadie excluyó con motivo. */
export function sinEspejo(runs, pasos, excluidos = {}) {
  const citados = new Set(pasos.map((p) => p.ci))
  return runs.filter((r) => !citados.has(r) && !Object.hasOwn(excluidos, r))
}

test('cada paso del job agentic-os tiene su espejo en el pre-flight', () => {
  const runs = runsDelJob(workflow, 'agentic-os')
  assert.ok(runs?.length >= 5, 'no se pudo leer el job agentic-os de quality.yml')
  assert.deepEqual(sinEspejo(runs, PASOS), [], 'quality.yml corre en agentic-os un paso que scripts/preflight-rapido.mjs no espeja')
})

test('cada paso del job frontend tiene su espejo o está excluido con motivo', () => {
  const runs = runsDelJob(workflow, 'frontend')
  assert.ok(runs?.length >= 8, 'no se pudo leer el job frontend de quality.yml')
  assert.deepEqual(sinEspejo(runs, PASOS, FUERA_DEL_PREFLIGHT), [], 'quality.yml corre en frontend un paso que scripts/preflight-rapido.mjs ni espeja ni excluye con motivo')
  for (const [run, motivo] of Object.entries(FUERA_DEL_PREFLIGHT)) {
    assert.ok(runs.includes(run), `la exclusión ya no corresponde a ningún paso de quality.yml: ${run}`)
    assert.ok(motivo.length > 10, `la exclusión de "${run}" no dice por qué`)
  }
})

test('cada paso del pre-flight cita un run que existe en quality.yml', () => {
  const todos = ['agentic-os', 'frontend'].flatMap((job) => runsDelJob(workflow, job) ?? [])
  for (const paso of PASOS) {
    assert.ok(todos.includes(paso.ci), `el paso "${paso.nombre}" cita un run que ya no está en quality.yml: ${paso.ci}`)
  }
})

test('autoprueba: un run nuevo en el job, sin espejo, da rojo', () => {
  const falso = workflow.replace('      - name: Check release preview contract', '      - name: Gate nuevo\n        run: node scripts/gate-que-nadie-espeja.mjs\n\n      - name: Check release preview contract')
  assert.notEqual(falso, workflow)
  assert.deepEqual(sinEspejo(runsDelJob(falso, 'agentic-os'), PASOS), ['node scripts/gate-que-nadie-espeja.mjs'])
  assert.deepEqual(sinEspejo(['node --test agentic/tests/*.test.mjs'], PASOS), [])
  // Lo mismo en frontend, y un `ci` que ya no existe en el workflow.
  const conPasoNuevo = [...runsDelJob(workflow, 'frontend'), 'node scripts/otro-gate.mjs']
  assert.deepEqual(sinEspejo(conPasoNuevo, PASOS, FUERA_DEL_PREFLIGHT), ['node scripts/otro-gate.mjs'])
  assert.equal(runsDelJob(workflow.replace('run: node scripts/check-r-lock.mjs', 'run: node scripts/otro-nombre.mjs'), 'agentic-os').includes('node scripts/check-r-lock.mjs'), false)
})

test('lee los run en bloque y se detiene en el job siguiente', () => {
  const yml = ['jobs:', '  uno:', '    steps:', '      - run: a b', '      - run: |', '          c d', '          e', '  dos:', '    steps:', '      - run: z'].join('\n')
  assert.deepEqual(runsDelJob(yml, 'uno'), ['a b', 'c d\ne'])
  assert.deepEqual(runsDelJob(yml, 'dos'), ['z'])
  assert.equal(runsDelJob(yml, 'tres'), null)
})
