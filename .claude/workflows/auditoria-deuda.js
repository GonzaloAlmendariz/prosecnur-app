export const meta = {
  name: 'auditoria-deuda',
  description: 'Mide los 8 ejes de deuda técnica de Prosecnur en paralelo y sintetiza deltas vs baseline',
  whenToUse: 'Auditoría periódica de deuda (skill /auditoria-deuda) cuando se quiere la versión multi-agente exhaustiva',
  phases: [
    { title: 'Medición', detail: 'un agente auditor-deuda por grupo de ejes' },
    { title: 'Síntesis', detail: 'deltas vs baseline y hallazgos priorizados' },
  ],
}

const EJE_SCHEMA = {
  type: 'object',
  properties: {
    mediciones: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          eje: { type: 'number' },
          nombre: { type: 'string' },
          valor_hoy: { type: 'string' },
          detalle: { type: 'string', description: 'top ofensores con archivo:línea' },
        },
        required: ['eje', 'nombre', 'valor_hoy', 'detalle'],
      },
    },
  },
  required: ['mediciones'],
}

const GRUPOS = [
  { label: 'ejes-r', ejes: 'los ejes 1 (archivos congelados), 2 (duplicación de micro-helpers R) y 3 (stop() crudos y try() sueltos)' },
  { label: 'ejes-frontend', ejes: 'los ejes 4 (deriva de tokens CSS con hex hardcodeado), 5 (higiene TS: any y ts-ignore) y 7 (componentes .tsx de más de 1000 líneas)' },
  { label: 'ejes-proceso', ejes: 'los ejes 6 (archivos R sin test por nombre, con los 10 más grandes sin cubrir) y 8 (volumen sin commitear del working tree)' },
]
const EJES_ESPERADOS = [1, 2, 3, 4, 5, 6, 7, 8]

phase('Medición')
const resultados = await parallel(
  GRUPOS.map(g => () =>
    agent(
      `ORCHESTRATION CONTRACT: objetivo=medir ${g.label}; perfil=read-only; ` +
        `permitidos=.claude/agents/auditor-deuda.md,docs/qa/deuda-baseline.md,api/,frontend/; ` +
        `excluidos=todo archivo en escritura; dependencias=ninguna; stopping rule=mediciones reproducibles. ` +
        `Actúa según .claude/agents/auditor-deuda.md de la raíz actual (léela primero). ` +
        `Mide EXACTAMENTE ${g.ejes}, con los comandos canónicos de esa definición, en modo solo lectura. ` +
        `Devuelve cada eje con su valor de hoy y el detalle de top ofensores.`,
      { label: g.label, phase: 'Medición', schema: EJE_SCHEMA, agentType: 'general-purpose' }
    )
  )
)

if (!Array.isArray(resultados) || resultados.length !== GRUPOS.length ||
    resultados.some(resultado => !resultado || typeof resultado !== 'object' || !Array.isArray(resultado.mediciones))) {
  throw new Error('Auditoría de deuda incompleta: se requieren 3 resultados válidos antes de la síntesis')
}

const mediciones = resultados.flatMap(resultado => resultado.mediciones)
const ejes = mediciones.map(medicion => medicion?.eje)
const ejesUnicos = [...new Set(ejes)].sort((a, b) => a - b)
if (mediciones.length !== EJES_ESPERADOS.length ||
    ejesUnicos.length !== EJES_ESPERADOS.length ||
    ejesUnicos.some((eje, index) => eje !== EJES_ESPERADOS[index])) {
  throw new Error(
    `Auditoría de deuda incompleta: se requieren exactamente los ejes únicos 1..8 antes de la síntesis; ` +
    `recibidos=${JSON.stringify(ejes)}`
  )
}

phase('Síntesis')
const sintesis = await agent(
  `Lee docs/qa/deuda-baseline.md desde la raíz actual y compara contra estas mediciones de hoy:\n` +
    JSON.stringify(mediciones, null, 2) +
    `\nProduce: (1) tabla eje → baseline → hoy → Δ → veredicto MEJORÓ/ESTABLE/EMPEORÓ; ` +
    `(2) los 3 movimientos más accionables dimensionados; (3) ejes en rojo sostenido. En español. No edites archivos.`,
  { label: 'sintesis', phase: 'Síntesis' }
)

return { mediciones, sintesis }
