# Base de control — lo que Gonzalo pidió el 2026-09-07 (tarde)

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
| C1 | `TOTAL ENVIADAS`, `ENVIADAS VS MATRICULADOS`, `ENVIADAS VS ELEGIBLES` las escribe el motor desde la plataforma | motor: `monitoreo_aulas_efectivas.R` (contador nuevo) + `carga_aulas_libro_generar.R` | ☐ |
| C2 | «cortas / largas» → **efectivas / no efectivas (en plataforma)**; una sola pareja, sin duplicar `EFECTIVAS OBTENIDAS` | spec: `carga_base_control.R` | ☐ |
| C3 | Los `FILTRO DE VALIDACIÓN n` llevan el **nombre de la variable** que el estudio declara, y cuentan cuántas respuestas del aula pasan cada uno | spec + motor | ☐ |
| C4 | El estudio declara su criterio: `consent_1`, `consent_2`, `filtro`. **Decisión de Gonzalo** | config `source_mapping.valid_filters` | ☐ BLOQUEADO |
| C5 | `ALUMNOS QUE NO RESPONDIERON`, `% ASISTENCIA`, `% DE CUOTA CUBIERTA`, `FALTAN PARA LA CUOTA` los calcula el motor | `carga_aulas_libro_generar.R` | ☐ |
| C6 | `MUJERES/HOMBRES OBTENIDOS` y sus `%` — exigen `sex_var` declarada. **Decisión de Gonzalo**: `datos_demo/P2` (1/2) o `datos_demo/P3` (1/2/3/88) | config `source_mapping.sex_var` | ☐ BLOQUEADO |
| C7 | `ÚLTIMO DÍA DE RESPUESTA` desde la plataforma | motor | ☐ |
| C8 | `HORARIO NORMALIZADO` y `FRANJA HORARIA` los escribe el motor | motor | ☐ |
| C9 | **Orden de los encabezados con criterio declarado**: el aula → la aplicación → lo que esperábamos → lo que llegó → cómo vamos | `carga_base_control.R` + `aulas_libro_grupos_control()` | ☐ |
| C10 | Columnas que repiten a su vecina fuera: `ELEGIBLES: BASE DEL %` es `MATRICULADOS ELEGIBLES` | spec | ☐ |
| C11 | `AULA` y `HORARIO` traían el MISMO texto; `AULA` pasa a ser el lugar (`scheduled_venue`) | motor | ☐ |
| C12 | `campos_equipo` deja de anclarse a dos extremos y se declara como «lo que la app NO escribe» | `carga_aulas_libro_generar.R` | ☐ |
| C13 | Regenerar y republicar | Sheets `11HV4-…` | ☐ |

## Preguntas abiertas

- **C4** — ¿los tres filtros son `consent_1 = 1`, `consent_2 = 1`, `filtro = 1`?
  ¿O «efectiva» además exige que la encuesta esté completa (llegue al final)?
- **C6** — ¿cuál de `datos_demo/P2` (1/2) y `datos_demo/P3` (1/2/3/88) es sexo?
  No se adivina: `sub_a` ya costó una lectura al revés.
