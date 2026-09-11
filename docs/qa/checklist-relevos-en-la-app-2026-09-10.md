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
| 28 | **El anti-colisión del mapa mira también las burbujas** | `AulasMapaDeLaDeuda` | ☑ cinco etiquetas pisaban y el detector daba cero |
| 29 | **Los tokens del perfil alcanzan a los portales** | `aulasMonitoreo.css` + `tokensDelPortal.contract.test.ts` | ☑ `9a91a3d9` — `createPortal` sale del selector; todo el popover a 16 px |
| 30 | **El pie del popover deja de dibujarse detrás de la lista** | `aulasReemplazos.css` | ☑ `40201209` — grid de cuatro filas con cinco hijos |
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

## Las cinco decisiones que el ensayo deja abiertas

Su cierre las nombra así: «cinco cosas que no quiero elegir yo, porque cambian
cómo se trabaja y no cómo se ve». Dos quedaron resueltas al implementar; las
otras tres están **bloqueadas por decisión de Gonzalo**, no pendientes de
trabajo.

| # | Decisión | Estado |
|---|---|---|
| D1 | **Qué pasa con el peso cuando entra una extra.** Las extra no cargaban peso de diseño, así que al sustituir un titular cubren el aula pero no su condición. ¿Lo avisa el popover al elegirla, o es cosa del ponderador y aquí no se dice? | 🔒 **bloqueada** — es metodológica y toca al ponderador |
| D2 | **Dónde entra el refuerzo**: al pie de Brechas o como panel propio en Extras. | ☑ resuelta **en los dos**: al pie de Brechas (`AulasLlamadaDeFacultad`, pegado a su diagnóstico) y desde la fila de facultad del mapa (pegado a su inventario). Las dos puertas abren el mismo popover |
| D3 | **Si el botón nombra la letra.** | ☑ resuelta: lo nombra — «Buscar relevo» o «Complementar» según la acción que toque, y el motor decide cuál |
| D4 | **Qué manda en el orden del popover.** Hoy manda la cadena aunque otro puntúe mejor, porque es la guía del procedimiento. En B —el titular no cayó— quizá deba mandar la ayuda. | 🔒 **bloqueada** — cambia el procedimiento, no la pantalla. Hoy: cadena primero siempre, y el duelo enseña cuándo discrepan las dos varas |
| D5 | **Si se puede activar desde aquí**, o el popover sólo propone y alguien lo anota en el Sheets. Activar desde la app ya existe para A; para B y C no. | 🔒 **bloqueada** — toca el motor y el libro vivo |

**Por qué bloqueadas y no pendientes**: las tres cambian cómo trabaja el
equipo, no cómo se ve la pantalla. Elegirlas en silencio sería decidir por
Gonzalo en su propio operativo.
