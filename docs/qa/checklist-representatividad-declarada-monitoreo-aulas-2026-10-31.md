# Checklist — representatividad declarada en Monitoreo › Cursos-horario

Tipo: Checklist vivo
Estado: Abierto
Fecha: 2026-10-31
Autoridad: Gonzalo (dictado en sesión)

## El pedido

> «Hay distintas formas de poder ver esto. De la misma forma que en Cálculo de muestra podemos ver
> representatividad a nivel de toda una universidad, también a nivel de una sola facultad. Y la variable
> de representatividad puede cambiar: a nivel de universidad la cuota es el sexo y la facultad; a nivel de
> facultad puede ser el nivel curricular. Tiene que tener esa generalidad, no hardcodear, y hasta ahora
> no veo eso en todas las vistas.»

Principio que se deriva (refuerza G9 de `revamp-monitoreo/aulas.md`): **ninguna vista nombra, agrupa ni
cruza por una variable fija.** El universo del estudio y sus variables de cuota los declara el diseño
(Cálculo de muestra) y viajan en el tablero; cada vista los lee y se rearma: rótulos, columnas, agrupaciones,
qué gráficos existen y qué cruces se muestran.

## Lo que el motor ya declara (no hay que inventarlo)

| Dato | Dónde | Qué dice |
|---|---|---|
| `avance_cuota.eje` | tablero | Clave (`facultad`, `nivel`, `carrera`), etiqueta y plural, atribución (`aula` o `persona`) y de dónde sale el valor (`plan` o `padron`). |
| `ejes_declarables` | tablero | El catálogo de ejes posibles. |
| `config.eje_cuota`, `eje_cuota_motivo` | config de monitoreo | El eje elegido y por qué. |
| `config.agrupacion_operativa` | config | Por qué se agrupa lo OPERATIVO (aulas planificadas y aplicadas): facultad o carrera. Es otra pregunta que el eje de la cuota. |
| `quotas_sex_faculty`, `avance_sexo_facultad` | tablero | El cruce con sexo, hoy sólo cuando el eje es facultad. |
| `avance_cuota.composicion` | tablero | Sexo y carrera como composición DESCRIPTIVA cuando no son cuota. |

Brecha del modelo: la cuota es **un eje más el sexo opcional**. No existe todavía una declaración de N
variables de cuota ni un «universo» explícito (universidad o una facultad): el universo se infiere del plan.

## Ítems

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1 | A1 Resumen nombra y agrupa por el eje | `avance/resumenAulasModelo.ts` (`ejeDe`) | Hecho antes de este pedido |
| 2 | A2 Por facultad se rearma por eje (facultad y sexo, o nivel) | `avance/porFacultadModelo.ts` | Hecho antes de este pedido |
| 3 | A4 Rendimiento: la tasa contra el diseño nombra el grupo por el eje | `avance/rendimientoModelo.ts` | **Hecho** `39936c75b` |
| 4 | A5 Salidas: la vista previa toma el grupo de la hoja, se llame como se llame | `avance/salidasModelo.ts` | **Hecho** `538820197` |
| 5 | A3 Cursos-horario: la columna «Facultad» es un atributo del aula. Con eje por persona y agrupación por carrera (CCSS) no informa: todas las aulas son de la misma facultad. Debe seguir `agrupacion_operativa`. | `dos_tasas.aulas[]` no trae la carrera: hace falta el dato en el motor | Pendiente (motor + vista) |
| 6 | A4 «Por aplicador» y «Día de la semana» no dependen del eje | — | No aplica |
| 7 | El foco `foco=facultad:X` es fijo: debe ser `foco=<eje>:X` | `useFocoMonitoreo`, `AulasCuotasResumen` | Pendiente |
| 8 | Maquetas: cada vista en sus dos variantes (universidad con facultad y sexo; facultad con nivel). Hoy faltan en A3, A4, A5, Ctl1, Ctl4, Ctl5, Ctl6, Ctl7, P2–P4, S1, S2 | lienzo y artefacto | Pendiente |
| 9 | Guard de contrato: un rótulo «Facultad» literal en los modelos de Aulas falla salvo como respaldo de `ejeDe` | test de contrato nuevo | Pendiente |
| 10 | Vistas heredadas (Insumos, Modelo, Control): auditar una por una cuando se rehagan | fichas I1–Ctl8 | Pendiente, con cada ficha |
| 11 | Modelo de cuota con N variables y universo explícito | motor + Cálculo de muestra | **Bloqueado**: decisión de Gonzalo |
