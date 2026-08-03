# Prompt operativo — GOAL loop v2 Cálculo de muestra

Tipo: Prompt de arranque de sesión / entrada de `/loop`
Estado: Vigente
Sucede a: prompt del loop 2026-07-31
Fecha: 2026-08-01
Autoridad: Lanza el loop de `goal-loop-calc-muestra-v2-2026-08-01.md`; no lo redefine

Pegar el bloque siguiente tal cual en una sesión nueva (o como prompt de
`/loop`). El contrato del goal vive en
`docs/qa/goal-loop-calc-muestra-v2-2026-08-01.md`; este prompt solo lo pone en
marcha.

---

Ejecuta el GOAL loop v2 de Cálculo de muestra.

**PASO CERO, OBLIGATORIO E INNEGOCIABLE: lee COMPLETO
`docs/qa/goal-loop-calc-muestra-v2-2026-08-01.md` antes de tocar cualquier
archivo, abrir cualquier server o lanzar cualquier agente.** El estado del loop
vive en ese doc, no en tu contexto ni en conversaciones anteriores. Ahí están
los cuatro mandatos (M1–M4), la cola de lotes, el ledger, la bandeja y el
registro de iteraciones. El rumbo de producto vive en
`Obsidian_Prosecnur/Boceto_Calculo_de_Aulas_v2.canvas`. La historia I0–I15 y el
scope lock congelado de la iteración 16 viven en
`docs/qa/goal-loop-calc-muestra-2026-07-31.md` (archivo histórico): consúltalo
cuando el doc v2 te remita a él, no lo re-ejecutes.

Después de leerlo, trabaja así:

1. Ejecuta la **siguiente iteración de la cola de lotes** del doc: hoy es la
   16 (cerrar la consola analítica, M1); después 17 «Selección legible» (M2),
   18 «Marco decide» (M3), 19 «Cálculo» (M4). Un lote = una iteración; no lo
   fragmentes en defectos sueltos ni lo diluyas en auditorías.
2. **Prioriza features y su aplicación correcta — en ese orden y sin separar
   los dos.** El producto de cada iteración es capacidad nueva visible para el
   usuario (carril B nunca se excluye por defecto); la correctitud (F0, engine
   con test, dueño del dato) es **cómo** se construye la feature, no una
   excusa para no construirla. Una iteración que solo endurece guards sin
   entregar capacidad no cumple el régimen; una que entrega capacidad con
   cifras sin dueño tampoco. Dato antes que gráfico, y gráfico antes que
   brillo.
3. Sigue la mecánica del doc al pie: auditar como paso 1 → contrato
   proporcional al riesgo → orquestar por rama (máx. 3 trabajadores, 2
   writers) → peaje estructural de entrada → guard → gate escalado al diff →
   `verificador` solo si el lote tocó engine o contrato público → commit
   atómico → **actualizar ledger y registro en el doc v2**. Una iteración que
   no actualiza el doc no existió.

**REGLAS DE NO DETENCIÓN — cúmplelas literalmente:**

- **Este loop NO se detiene. Nunca. Solo Gonzalo lo cierra**, y no lo ha
  cerrado. Al cerrar una iteración (commit hecho, doc actualizado), **empieza
  la siguiente de la cola de inmediato** en la misma sesión, hasta agotar el
  contexto disponible.
- **NO te detengas a preguntar.** Si un hallazgo exige una decisión de Gonzalo,
  anótala en la **bandeja del doc v2** con opciones y recomendación, y sigue
  con lo desbloqueado. D1–D9 ya están resueltas: aplícalas, no las reabras.
- **NO termines la sesión con un párrafo de "próximos pasos".** Si puedes
  enunciar un próximo paso, ejecútalo. La única salida legítima de tu turno
  es: iteración(es) cerrada(s) con evidencia + doc actualizado + bandeja al
  día.
- **NO esperes aprobación para ejecutar lo ya aprobado.** La existencia del
  goal ES la aprobación (regla de la casa: revisión, no permiso). Los gates
  son evidencia para veto, no permisos previos.
- Ante un error (test rojo, server caído, tool que falla): diagnostica, repara
  y reintenta tú. Bloquearte sin agotar alternativas cuenta como detenerte.

Restricciones que el doc ya fija y que no puedes relajar: estadísticos nuevos
se calculan en el engine R con test — el frontend solo formatea; ningún archivo
del módulo crece estando extraíble; `selectionReady` y los guards de vigencia
no se relajan para "arreglar" un vacío; navegación por dirección canónica con
`/ver-ui` y `hsvg2026`; el 8787 es del usuario y no se mata; verificar de más
también es deuda; commits en español. Las cinco trampas operativas del doc
(backend stale, `?pulso=` de un solo uso, fixture por estado, falsos rojos de
vitest, sesiones concurrentes) se pagan una sola vez: la tuya no.

Al final de tu turno reporta: iteraciones ejecutadas, filas del ledger que se
movieron, decisiones nuevas en bandeja (si las hay) y qué lote de la cola toca
después — ya anotado en el doc v2, no solo en el mensaje.
