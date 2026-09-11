# Llevar el diseño de «Relevos de aula» a la app — 2026-09-10

Gonzalo, tras ver el artefacto: «la app puede tener ciertas cosas, pero el
diseño que tú has generado del artefacto es un diseño muy, muy, muy bueno, y es
el que tiene que tener».

Ensayo: <https://claude.ai/code/artifact/baf3cd2f-e668-4e98-8a21-167f18ae76bb>

**La regla de este traslado**: el artefacto manda en el diseño; la app manda en
el dato. Donde el artefacto usa una cifra inventada —los embudos, los
candidatos de ejemplo— hay que encontrar de dónde sale de verdad o decir que no
está, nunca teclearla.

| # | Pieza | Dónde va | Estado |
|---|---|---|---|
| 1 | **Composición M/H de un aula en un solo sitio** (`sex_top_1` es el dominante, no mujeres) | `composicionDelAula.ts` | ☑ `4e3b4afa` — era la base de todo lo demás |
| 2 | **La deuda por sexo en la cabecera del popover**: qué hay que mejorar, antes de con qué | `AulasPopoverReemplazo` | ☑ `.aulas-reemplazo-deuda`, leída de `quotas_sex_faculty` |
| 3 | **El efecto de cada candidato**: cuánto de la deuda cubre, si la cierra y qué quedaría | ídem | ☑ `fa7135ed` |
| 4 | **El duelo**: el mejor por parecido contra el mejor por ayuda, cuando son distintos | ídem | ☑ mira los tres grupos, no sólo el activo |
| 5 | **El plazo**: agendar antes de tal día · quedan N días | `AulasPopoverRefuerzo`, de `alertaDeAnticipacion.pedirAntesDe` | ☑ `ae6f7b1b` — en el de refuerzo; falta llevarlo al de reemplazo |
| 6 | **El coste**: qué le queda a la facultad si se toma uno | `AulasPopoverReemplazo` y `AulasPopoverRefuerzo` | ☑ `fa7135ed` — cada sexo se corta contra lo que se debe de ESE sexo |
| 7 | **El popover se abre desde Brechas** — la entrada del complemento (B) | `AulasSeccionConsultas` | ☑ botón por fila de `AulasBrechasDelCorte` |
| 8 | **La entrada del refuerzo (C)** por facultad | `AulasComoVaCadaFacultad` → `AulasPopoverRefuerzo` | ☑ `f0ddffad` — no al pie de Brechas: C arranca de una facultad, no de un curso-horario |
| 9 | **Brechas rediseñada**: franja de severidad, «rinde contra lo previsto de su facultad», botón por fila | ídem | ☑ y además lista sólo lo aplicado que rindió corto: los sin campo se cuentan, no se listan |
| 10 | **Reemplazos rediseñada**: fila por cadena, titular a la izquierda, tira de eslabones con ancho mínimo, tres visibles y «+N por detrás», pastilla de desenlace | `AulasHistoriaCadena` | ☑ `0b56c532` — rejilla `218px \| tira`, 138 px por eslabón, filo por circunstancia |
| 11 | **El mapa de la deuda**: un punto por facultad, hombres contra mujeres, cuadrantes, anti-colisión de etiquetas, clic que abre la facultad | Avance › Efectividad **y Consultas › Brechas** | ☑ `4dfcbe34` — con foco: la elegida se marca y las demás se apagan, nunca se van |
| 12 | **El ranking de facultades**: deuda ordenada, barras por sexo desde el centro, veredicto en palabras | ídem | ☑ la serie de tres jornadas sigue bloqueada por dato |
| 13 | **El porqué de una facultad**: sus cursos-horario y lo que dejó cada uno | ídem | ☑ el detalle da la frase y el consejo; la lista vive en la tabla de abajo para no contar lo mismo dos veces |
| 14 | **El embudo del aula**: padrón → en el aula → respondieron → válidas, y qué escalón pesó más | ídem | ☐ **falta el dato**: la app no guarda cuántos estaban en el aula (ver abajo) |
| 15 | **La matriz «qué sirve para qué»**: las tres procedencias × los tres casos | `AulasQueSirveParaQue`, al pie de Brechas | ☑ `553cc71e` — no es un cartel: cada procedencia trae cuántas hay hoy |
| 16 | **El embudo raro de top-N se retira** | `AulasConcentracionBrecha` | ☑ `4dfcbe34` — «eso ni siquiera estaba planteado en el artefacto»; contestaba una pregunta sobre la forma de la lista, no sobre el campo |
| 18 | **Los nombres de facultad, normalizados en un solo sitio** | `facultadEnPalabras.ts` | ☑ `553cc71e` — el mapa acortaba siete y dejaba el resto en mayúsculas |
| 19 | **El mapa, robusto al filtro y con sus rótulos en los márgenes** | `AulasMapaDeLaDeuda` | ☑ `b408afbf` — las demás facultades se apagan, nunca se van |
| 20 | **Rindió ≠ aportó**: las dos varas de un aula que se metió | `AulasAporteDelAbc` + `aporteDelAbc.ts` | ☑ `94e54d5f` — el criterio es el hecho (¿salió su titular?), no el verbo del libro |
| 21 | **Las válidas por sexo de cada curso-horario** | motor, `.monitoreo_aulas_validas_por_sexo` | ☑ `b408afbf` — **no se verá hasta que el backend R se recargue** |
| 22 | **Los tres caminos A/B/C, separados** | `AulasTresCaminos` + `caminosDelLibro.ts` | ☑ `0b56c532` — «son naturalezas distintas y lógicas distintas» |
| 23 | **Los títulos en el registro del ensayo** | Consultas | ☑ «Qué pasó, y por dónde se sale», «Deuda por sexo, facultad a facultad» |
| 24 | **La facultad, normalizada en todas las superficies** | `facultadEnPalabras` | ☑ `8c3e3e8f` — quedaban tres sitios leyendo `faculty` crudo |
| 25 | **La quinta circunstancia: la cadena intacta** | `AulasHistoriaCadena` | ☑ 110 de 174 no habían pasado nada y enterraban las 26 que sí |
| 26 | **Cada cadena tiene salida** (complementar / buscar relevo) | ídem | ☑ `bfd2c115` |
| 27 | **La llamada de facultad al pie de Brechas** («el refuerzo no sale de una fila») | `AulasLlamadaDeFacultad` | ☑ `52091ce6` |
| 17 | **La tarjeta de candidato con el lenguaje del ensayo**: puesto, identidad con facultad y docente, las dos varas a la derecha, lo que rinde por sexo | `AulasPopoverReemplazo` + su hoja | ☑ |

## Lo que el artefacto promete y el dato todavía no da

- **El reparto por sexo por aula (21) ya no falta**, pero el backend R en
  memoria no lo tiene: el panel «Qué nos dieron las que se metieron» dirá «sin
  reparto por sexo» hasta que la app se reinicie. No se reinstaló a propósito —
  un `R CMD INSTALL` a medias deja la app caída.

- **El embudo (14).** El escalón «estaban en el aula» no está guardado: la tasa
  del aula ya lo lleva dentro. Es el hallazgo de
  `project_cadena_elegibles_a_efectivas`. O se publica ese escalón desde el
  parte de campo —`observed_students`—, o el embudo se queda en tres pasos y lo
  dice.
- **La serie por jornada (12).** Hoy la deuda por facultad se publica al corte,
  no por día. Hace falta que el motor la reparta como ya hace
  `monitoreo_aulas_ritmo_por_facultad`.
- **El plazo (5).** `alertaDeAnticipacion` ya calcula `pedirAntesDe`, pero vive
  en Resumen: hay que pasarlo al popover sin recalcularlo.
