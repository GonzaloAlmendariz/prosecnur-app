# ADR 0009: Fases piloto y campo real en hojas de ruta

Estado: Aceptado

Fecha: 2026-06-04

## Contexto

Hojas de ruta se habia modelado como una sola corrida activa por proyecto,
persistida en las claves legacy `hojas_ruta_config`, `hojas_ruta_ui_state` y
`hojas_ruta_workspace_outputs`. En proyectos como ACNURCG, una corrida real de
30 encuestas puede corresponder metodologicamente a una piloto y debe quedar
como historial sin ser eliminada.

La aplicacion real de campo reutiliza la misma configuracion metodologica:
distritos, rangos de edad, cuotas, metodo de seleccion, carga de ruta y
reemplazos. Lo que cambia es la seleccion de manzanas. Tambien se requiere
decidir si las manzanas titulares de la piloto quedan excluidas del sorteo real
o si la piloto se ignora para permitir su inclusion aleatoria.

La decision es arquitectonicamente significativa porque modifica persistencia
`.pulso`, contrato API y modelo de estado de un modulo local de escritorio.

## Decision

Hojas de ruta tendra dos fases oficiales por proyecto: `pilot` y `field`.
Ambas se persistiran en `hojas_ruta_runs`, y la fase activa en
`hojas_ruta_active_phase`.

Cada run conserva `config`, `ui_state` y `workspace_outputs`. La piloto usa
`role = "pilot"` y `locked = true`. Campo real usa `role = "field"` y agrega
`pilot_exclusion_mode`, con valores `exclude_titulars` o `ignore`.

Las claves legacy `hojas_ruta_config`, `hojas_ruta_ui_state` y
`hojas_ruta_workspace_outputs` se mantienen como espejo de la fase activa para
compatibilidad con proyectos y flujos existentes.

Cuando se abre un proyecto legacy con `hojas_ruta_workspace_outputs$sample` y
sin `hojas_ruta_runs`, esa corrida se migra automaticamente a `pilot`
bloqueada. Se crea `field` copiando la configuracion de la piloto y limpiando
las decisiones de muestra. Campo real preserva resultados reutilizables de
poblacion/marco, pero no preserva `sample_size_preview`, `quota` ni `sample`,
porque el N real y las cuotas reales pueden diferir de la piloto.

Al crear Campo real desde Piloto, el flujo vuelve a la etapa `muestra`. La
configuracion metodologica compartida se conserva, pero la decision de N se
resetea para que la aplicacion real defina su propio tamano muestral antes de
calcular cuotas, manzanas o entregables.

La politica `exclude_titulars` excluye solo las manzanas titulares de la
piloto (`pilot.workspace_outputs.sample.blocks[*].id_manzana`). Los reemplazos
historicos de la piloto no se bloquean, porque no necesariamente fueron usados
en campo. La exclusion se aplica antes de seleccionar titulares y antes de
buscar reemplazos de Campo real.

## Consecuencias

La piloto queda auditable y exportable como historial, mientras Campo real
puede regenerarse sin destruir esa evidencia. Los proyectos sin piloto siguen
operando mediante una sola fase `field`, con las claves legacy sincronizadas.

El costo principal es que el modulo deja de tener una unica fuente directa de
estado y debe resolver la fase activa en cada endpoint. Tambien aumenta el
riesgo de confusion si un flujo antiguo escribe las claves legacy; por eso el
router normaliza runs y vuelve a espejar la fase activa.

Excluir titulares piloto puede reducir el marco elegible. Cuando ocurra, el
motor debe emitir `W_PILOT_EXCLUSION_REDUCED_FRAME` y conservar las alertas de
marco insuficiente existentes si la muestra ya no alcanza.

## Cumplimiento

El backend debe probar que:

- un estado legacy con muestra se migra a `pilot` bloqueada y `field` activa;
- Campo real queda en etapa `muestra`, sin N/cuotas/muestra heredadas de la
  piloto;
- `exclude_titulars` impide que titulares piloto aparezcan como titulares o
  reemplazos reales;
- `ignore` no inyecta exclusiones en la configuracion efectiva;
- recalcular Campo real no modifica la Piloto;
- las claves legacy reflejan la fase activa.

El frontend debe hidratar `runs` y `active_phase`, permitir cambiar entre
Piloto y Campo real, bloquear acciones destructivas por defecto en Piloto y
mostrar la politica de uso de piloto en Campo real.

## Notas

Relacionado con [ADR 0002](0002-formato-pulso.md), que define el formato
persistente `.pulso`, y con [ADR 0006](0006-modulos-por-dominio.md), que
mantiene Hojas de ruta dentro de su frontera de dominio metodologico.
