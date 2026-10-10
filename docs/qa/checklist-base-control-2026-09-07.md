# Base de control — lo que Gonzalo pidió el 2026-09-07 (tarde)

Tipo: Checklist de dictado
Estado: En curso
Fecha: 2026-09-07
Autoridad: Pedido de Gonzalo. Evidencia de QA; no reemplaza un ADR

Dos mensajes, sobre el libro ya publicado a media jornada del primer día de
campo:

> «Y porque todo esto está vacía, además cortas y largas ya no existe es
> efectivas y no efectivas (en plataforma)» *(captura del bloque CONTROL -
> CUENTA: TOTAL ENVIADAS … LARGAS VS ENVIADAS, todo en blanco)*

> «Esto también sigue en blanco. Además noto muchísimo desorden en el orden en
> que se encuentran los encabezados, no parece seguir ningún criterio lógico en
> su orden» *(captura del bloque CONTROL - CUOTAS)*

## Lo medido antes de tocar nada

204 respuestas sincronizadas de Kobo. **166 son de un aula** (`collectorID`
`CH n`); las otras 38 son `CAPACITACION` (26), `PRUEBA_2026` (9),
`CAPATICACION` (1, con typo) e `INTERNOPULSO` (1).

El estudio **no declara su criterio de validez** (`source_mapping$valid_filters`
está vacío), así que `.monitoreo_aulas_valid_response()` cae en su rama
permisiva y **cuenta como efectiva toda respuesta que llegó**. Aplicando los
tres filtros del propio formulario —`inicio/consent_1 = 1`,
`inicio/consent_2 = 1`, `inicio/filtro = 1`—:

| aula | enviadas | efectivas |
|---|---|---|
| CH 76 | 48 | 38 |
| CH 72 | 36 | 34 |
| CH 7 | 29 | 27 |
| CH 43 | 17 | 16 |
| CH 79 | 18 | 17 |
| CH 103 | 8 | 7 |
| CH 108 | 7 | 6 |
| CH 38 | 3 | 0 |

Es decir: **la columna EFECTIVAS OBTENIDAS que se publicó dice enviadas.**

## Checklist

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| C1 | `TOTAL ENVIADAS`, `ENVIADAS VS MATRICULADOS`, `ENVIADAS VS ELEGIBLES` las escribe el motor desde la plataforma | `monitoreo_aulas_conteos_control.R` | ☑ |
| C2 | «cortas / largas» → **efectivas / no efectivas (en plataforma)**; una sola pareja | `carga_base_control.R` | ☑ |
| C3 | Los `FILTRO DE VALIDACIÓN n` llevan el nombre de su variable entre paréntesis y cuentan cuántas pasan ESE filtro | spec + motor | ☑ |
| C4 | El estudio declara su criterio: `inicio/consent_1 = 1`, `inicio/consent_2 = 1`, `inicio/filtro = 1` | config `valid_filters` | ☑ decidido por Gonzalo |
| C5 | `ALUMNOS QUE NO RESPONDIERON`, `% ASISTENCIA`, `% DE CUOTA CUBIERTA`, `FALTAN PARA LA CUOTA` los calcula el motor | `carga_aulas_libro_generar.R` | ☑ |
| C6 | `MUJERES/HOMBRES OBTENIDOS` y sus `%`: `sex_var = datos_demo/P2`, `1 = Mujer`, `2 = Hombre` | config `sex_var` + `sex_female_values` | ☑ decidido por Gonzalo · contrastado contra el padrón |
| C7 | `ÚLTIMO DÍA DE RESPUESTA` desde la plataforma | motor | ☑ |
| C8 | `HORARIO NORMALIZADO` y `FRANJA HORARIA` los escribe el motor | motor | ☑ |
| C9 | Orden de encabezados con criterio declarado, en cinco tramos y registro formal | spec + `aulas_libro_grupos_control()` | ☑ |
| C10 | Columnas que repiten a su vecina fuera (`ELEGIBLES: BASE DEL %`) | spec | ☑ |
| C11 | `AULA` deja de repetir a `HORARIO`: lleva el lugar confirmado | motor | ☑ |
| C12 | El criterio de fila queda en uno solo: aplicada o con respuestas | motor | ☑ |
| C13 | Regenerar y republicar | Sheets `11HV4-…` | ☑ |
| C14 | Las respuestas que no son del operativo (`CAPACITACION`, `PRUEBA_2026`…) no cuentan | config `descartes` + `criterio_validez` | ☑ decidido por Gonzalo |
| C15 | La app dice «8 aulas aplicadas», no 1: una sola definición de aula aplicada | `monitoreo_aulas_aula_aplicada.R` | ☑ |
| C16 | El avance por facultad cuenta aulas aplicadas y reparte por sexo | `carga_aulas_libro_avance_facultad.R` | ☑ |
| C17 | La brecha por facultad deja de ser la cuota entera (528 con 27 conseguidas) | `monitoreo_aulas_avance_cuota.R` | ☑ |
| C18 | Un solo resolvedor de la variable de sexo para los cuatro sitios que la adivinaban | `monitoreo_aulas_sexo.R` | ☑ |
| C19 | Guard: ningún ancla de la Base de control se pone por rótulo | `test-carga-aulas-libro.R` | ☑ |

## Lo que quedó medido

Sobre las 253 respuestas sincronizadas al cierre de la jornada:

- **193 efectivas** de 253 recibidas. Caen 36 por no ser del operativo
  (capacitación, prueba) y el resto por consentimiento o filtro.
- **8 aulas aplicadas** de 174 del operativo; la tarjeta de la app decía 1.
- **Brecha 2 355** de una cuota de 2 500; decía 2 500.
- El reparto por sexo, contrastado contra el padrón de la DTI: en las aulas de
  mayoría masculina —CH 43 (44 h / 6 m), CH 7 (25 h / 5 m)— el código `2`
  domina, que es lo que fija `1 = Mujer`.

## Preguntas resueltas

- **C4** — Gonzalo: los tres filtros, `consent_1 = 1 · consent_2 = 1 · filtro = 1`.
- **C6** — Gonzalo: `datos_demo/P2`. La equivalencia `1 = Mujer` no se adivinó:
  se contrastó el reparto obtenido contra el padrón de la DTI aula por aula.
- **C14** — Gonzalo: las 36 de capacitación y prueba, fuera del avance.
