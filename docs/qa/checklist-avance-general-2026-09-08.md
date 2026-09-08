# Checklist — «Avance de campo» reestructurada en cinco tablas (2026-09-08)

Dictado de Gonzalo, con el Sheets del operativo delante y el segundo día de
campo corriendo. **La hoja pasa de cuatro bloques a CINCO tablas dictadas
columna a columna**, y por primera vez sus cifras tienen que ser NÚMEROS y no
texto: pidió porcentaje como formato de celda («el (%) significa que va en
porcentaje, no que les pongas "(%)" al título») y color que sigue al valor, y
ninguna de las dos cosas existe sobre una celda de texto.

| # | Indicación (textual donde importa) | Dónde vive | Estado |
|---|---|---|---|
| 1 | AVANCE GENERAL: columnas `Indicadores · Total · Hombres · Mujeres` | `carga_aulas_libro_avance_general.R` | ☐ |
| 2 | AVANCE GENERAL: 10 filas dictadas, con las tres de aulas (aplicadas, asignadas, planificadas) | `carga_aulas_libro_avance_general.R` | ☐ |
| 3 | AVANCE POR FACULTAD: 17 columnas en el orden dictado, hombres antes que mujeres | `carga_aulas_libro_avance_facultad.R` | ☐ |
| 4 | AVANCE POR FACULTAD: faltantes por sexo TAMBIÉN contra la sobremuestra (no existían) | `carga_aulas_libro_avance_facultad.R` | ☐ |
| 5 | RENDIMIENTO POR FACULTAD: tabla nueva, 7 columnas | `carga_aulas_libro_avance_rendimiento.R` | ☐ |
| 6 | PRODUCCIÓN POR APLICADOR: 10 columnas, con los tres rangos de aplicación | `carga_aulas_libro_avance_aplicadores.R` | ☐ |
| 7 | AVANCE DIARIO: 10 columnas, ahora POR FACULTAD y día | `carga_aulas_libro_avance_diario.R` | ☐ |
| 8 | «la "tasa de facultad" es la "Tasa de rendimiento de la facultad"» — nombre completo | los cinco productores | ☐ |
| 9 | El porcentaje es FORMATO DE CELDA, nunca «(%)» en el rótulo | `monitoreo_aulas_avance_formato.R` | ☐ |
| 10 | Las cifras viajan como NÚMEROS a Sheets (hoy todo es texto y por eso no hay formato ni color) | `monitoreo_sync_incremental.R`, `carga_aulas_libro_avance.R` | ☐ |
| 11 | Diferencia positiva en escala de verde; negativa en escala de rojo | `monitoreo_aulas_avance_formato.R` | ☐ |
| 12 | Celda que llegó a la meta, verde; que llegó a la sobremuestra, azul/celeste | `monitoreo_aulas_avance_formato.R` | ☐ |
| 13 | El xlsx del libro escribe las mismas cinco tablas (un solo modelo, dos renderers) | `carga_aulas_libro_indicadores.R` | ☐ |
| 14 | Gate del área en verde y republicación verificada en el Sheets vivo | — | ☐ |

## Decisiones que tomé yo, y por qué

- **Hombres antes que mujeres, en todas las tablas.** El dictado del 2026-09-08
  lo pide así de forma consistente (`Total · Hombres · Mujeres`, `Efectivas
  hombres · Efectivas mujeres`); la hoja venía en mujeres→hombres por una
  decisión anterior *mía*, no suya. Manda el dictado.
- **Nombres de faltantes normalizados**: escribió «Faltantes hombre muestra» y
  «Faltantes mujeres» para la misma familia. Van como `Faltantes hombres
  muestra` / `Faltantes mujeres muestra` y sus dos gemelas de sobremuestra:
  registro formal y simetría, que es lo que pidió para el Excel.
- **Aulas asignadas** = las que tienen aplicador en el reparto vigente.
  **Aulas planificadas** = los titulares del plan. **Aulas adicionales
  solicitadas** = las reservas del banco de extras ya ACTIVADAS.
- **«Fichas faltantes»** de un aplicador se mide sólo sobre sus aulas ya
  aplicadas: lo que su aula rindió por debajo de lo que se esperaba de ella.
  Sobre las que no ha aplicado todavía no falta nada, falta ir.
