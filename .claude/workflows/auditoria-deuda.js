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

phase('Medición')
const resultados = await parallel(
  GRUPOS.map(g => () =>
    agent(
      `Actúa según la definición del agente en .claude/agents/auditor-deuda.md del repo ` +
        `/Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app (léela primero). ` +
        `Mide EXACTAMENTE ${g.ejes}, con los comandos canónicos de esa definición, en modo solo lectura. ` +
        `Devuelve cada eje con su valor de hoy y el detalle de top ofensores.`,
      { label: g.label, phase: 'Medición', schema: EJE_SCHEMA, agentType: 'general-purpose' }
    )
  )
)

phase('Síntesis')
const mediciones = resultados.filter(Boolean).flatMap(r => r.mediciones)
const sintesis = await agent(
  `Lee /Users/gonzaloalmendariz/Documents/Pulso/prosecnur-app/docs/qa/deuda-baseline.md y compara contra estas mediciones de hoy:\n` +
    JSON.stringify(mediciones, null, 2) +
    `\nProduce: (1) tabla eje → baseline → hoy → Δ → veredicto MEJORÓ/ESTABLE/EMPEORÓ; ` +
    `(2) los 3 movimientos más accionables dimensionados; (3) ejes en rojo sostenido. En español. No edites archivos.`,
  { label: 'sintesis', phase: 'Síntesis' }
)

return { mediciones, sintesis }
