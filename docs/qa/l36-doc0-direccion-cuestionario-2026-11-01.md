# L36 · DOC.0 — dirección del cuestionario impreso

Fecha: 2026-11-01. Autoría: sesión «Meta B · unidades de la maqueta», con criterio
delegado por Gonzalo («avanza con tu criterio», ronda de 10 preguntas del 1/11).
Cada decisión es reversible y se cita por su código (`D-L36-n`).

## De dónde partimos (medido, no supuesto)

Se generó el Word del instrumento `api/inst/samples/acreditacion/docentes_inst.xlsx`
con `reporte_formulario_word()` y se rasterizó con LibreOffice (7 páginas, 36
preguntas, 20 secciones, 15 matrices). Lo que hay que conservar:

- Paleta de impresión en negro y gris (`.FORM_WORD_INK`, `BAND`, `ZEBRA`): se
  fotocopia bien. Se decidió así a propósito; no se vuelve al navy.
- Matrices Likert con extremos en la cabecera y códigos en la celda.
- Casillas de folio («N.º de encuesta») y pie con «Página n de N».
- Dos columnas cuando el bloque cabe; matrices a todo el ancho.

Lo que está mal, por orden de lo que se ve primero:

1. **Bandas de sección vacías.** Un grupo sin etiqueta dibuja la banda gris sin
   texto (páginas 2 a 7). En el instrumento de docentes, 10 de los 13 grupos de
   matriz vienen sin `label` desde SurveyMonkey. Hoy el papel muestra marcos
   vacíos, que es justo lo que prohíbe la C3.
2. **El número de fila de la matriz se parte** («10. / 1»): la columna del
   número es más angosta que «10.1».
3. **Se imprimen bloques técnicos**: «Metadata SurveyMonkey» y «Variables
   auxiliares SurveyMonkey», con `respondent_id` como pregunta 1. En papel
   nadie responde eso.
4. **El título es el nombre técnico del formulario** («SurveyMonkey reference
   Docentes_AMDT»). No hay portada.
5. **Las opciones de «Sexo» muestran el código de texto** (`femenino`,
   `masculino`) al lado de la etiqueta: el código es el `name` de la opción, no
   un número.

## Dirección (D-L36-1 … D-L36-8)

- **D-L36-1 · El papel es un instrumento de campo, no un volcado del XLSForm.**
  Todo lo que existe sólo para la plataforma (metadatos, variables auxiliares,
  cálculos, `respondent_id`) no se imprime por defecto. Se puede volver a
  mostrar desde el inspector del documento (DOC.3, «ocultas»).
- **D-L36-2 · Ninguna banda sin texto.** Un grupo sin etiqueta no dibuja banda.
  Si el grupo es una matriz, su enunciado sale de la etiqueta del grupo y, si no
  la hay, la matriz va sin enunciado, sin el marco vacío.
- **D-L36-3 · Numeración legible en una línea.** El número de fila de la matriz
  (`10.1`) no se parte. La columna se mide con el número más largo.
- **D-L36-4 · Retirada el mismo día.** Proponía numerar las opciones cuyo
  código es texto (`femenino` → 1). Choca con la decisión del 2026-10-15
  (paridad Word/PDF en `.form_pdf_options_code_mark`): se imprime todo código
  no vacío, también el que repite su etiqueta, porque el papel tiene que decir
  el mismo código que el libro de códigos y que la base. Renumerar le daría a
  quien digita dos verdades. Manda la de octubre.
- **D-L36-5 · Portada con identidad del estudio.** Título del estudio (no el
  `form_id`), institución, periodo y bloque de control (folio, encuestador,
  fecha). Se lee de los ajustes del formulario; si falta el título humano, se
  usa el del proyecto.
- **D-L36-6 · Lógica impresa como instrucción, no como código.** Un salto se
  escribe «Si responde 2 → pase a la P14», junto a la opción que lo dispara. El
  `relevant` crudo nunca llega al papel.
- **D-L36-7 · Estándar único.** Tamaños, grises y márgenes se leen de la clave
  `cuestionario` de `estandar_pulso.json` (DOC.1), igual que láminas: el motor
  no lleva hex propios.
- **D-L36-8 · Vista previa = el documento real.** «Así queda» ya dibuja la
  primera página al instante; la vista completa (DOC.2) rasteriza las páginas
  reales por job, con estado «desactualizada» por hash del instrumento.

## Orden de trabajo

| Fase | Qué | Estado |
|---|---|---|
| DOC.0 | Esta dirección | ☑ 2026-11-01 |
| DOC.0b | Arreglar 1–3 (D-L36-1, 2 y 3) en el motor actual, con test y página rasterizada | ☑ `042c770fc`: Word y PDF sin bandas vacías ni bloques de plataforma, número de fila en una línea, 7 → 6 páginas; «Así queda» con la misma regla |
| DOC.0c | D-L36-5, primer paso: «Título del documento» en Impreso › Formato; viaja como `options$title` y «Así queda» lo dibuja. D-L36-4 retirada (manda la decisión del 2026-10-15) | ☑ `81baf012d`. Portada completa (institución, periodo, bloque de control) queda con DOC.1 |
| DOC.1 | Clave `cuestionario` en el estándar; el motor lee de ahí | ☑ `1c2457aae`: tipografía y colores en `estandar_pulso.json`, el motor sin hex propios y el `.docx` idéntico byte a byte |
| DOC.2 | Visor fiel: páginas del Word y mapa pregunta → página | ☑ `002be9126`, `325f40903`, `b1f56dd23` |
| DOC.3 | Bloques seleccionables sobre la página, con «Papel por pregunta» como inspector | ◐ `64de55dee`, con tests; falta verlo en vivo |
| DOC.4 | Opciones en el `.pulso` y versiones | ☐ |
| DOC.5 | QA: golden de estructura del `.docx` y OOXML válido | ☑ golden del instrumento de docentes (`test-xlsform-formulario-golden.R`) |

Los arreglos de DOC.0b se hacen sobre el motor que existe: no hace falta
esperar al visor para que el papel deje de tener marcos vacíos.

## DOC.2 · Diseño del visor fiel (2026-11-01)

**Qué ya existe y no se rehace.** «Previsualizar» en Impreso lanza el job de
`export-pdf`, baja el PDF y lo muestra embebido; además sabe cuándo quedó viejo
(`previaVieja`: firma de opciones + workbook). Eso es la vista rápida del PDF.

**Qué falta.** L36 pide ver el *Word*, que es el entregable editable, como
páginas reales, y saber en qué página cae cada pregunta. Esa es la base de
DOC.3 (bloques seleccionables sobre la página).

**Decisiones (D-L36-9 … 12):**

- **D-L36-9 · Un solo job, `xlsform_editor.formulario_word_visor`.** Arma el
  modelo, dibuja el `.docx` (mismo `formulario_word_render`), lo convierte a
  PDF con LibreOffice y rasteriza cada página a 60 dpi
  (`.word_visor_paginas`, el mismo de Gráficos). Registra el `.docx` en la
  sesión como cualquier export: lo que se ve es lo que se descarga.
- **D-L36-10 · Mapa pregunta → página con los números que el modelo ya
  conoce.** No se adivina leyendo cifras sueltas: el worker pasa la lista de
  números impresos del modelo (`1`, `8.1`…) y se busca cada uno al inicio de
  línea en el texto de cada página (`N. ` en preguntas, `N.M ` en ítems de
  matriz). Una pregunta que no aparece queda sin página, no con una inventada.
- **D-L36-11 · Endpoint `POST /api/xlsform-editor/word-visor`,** con el mismo
  cuerpo que `export-word` (workbook, filename, options). La respuesta trae
  `file_id`, `n`, `paginas` (data URI) y `mapa` (`[{numero, pagina}]`).
- **D-L36-12 · En Impreso, la previa tiene dos lecturas:** «PDF» (la de hoy) y
  «Páginas del Word» (la nueva), con la misma regla de «desactualizada».
  Las páginas van en columna con su número; una lista «Ir a la pregunta»
  salta a la página donde empieza cada pregunta.

**Hecho (2026-11-01):** backend `002be9126`, front `325f40903` y arreglos de lo
visto en vivo `b1f56dd23`. Con el instrumento de docentes a dos columnas: 9
páginas, 87 de 87 preguntas ubicadas e «Ir a la pregunta» lleva a la página
correcta (la 65, a la 7). Corrección del supuesto inicial: en desarrollo no
hizo falta `R CMD INSTALL`, porque `launch.R` define `PULSO_REPO_ROOT` y el
worker carga el código fuente con `load_all`. Para la app de escritorio
instalada sí hará falta, como con cualquier cambio de R (eso es del corte de
versión). Sigue DOC.3: bloques seleccionables sobre la página.

## DOC.3 · Bloques seleccionables (2026-11-01)

- **D-L36-13 · La caja sale de la posición del número**, no de un modelo de
  página propio: `pdftools::pdf_data` da cada palabra con su posición y el
  número de una pregunta es una palabra suelta («7.», «8.1»). La caja va hasta
  la siguiente pregunta de su columna; los ítems de matriz son filas a todo el
  ancho y el último bloque de la página llega al fin del contenido, no al pie.
- **D-L36-14 · El inspector del bloque es «Papel por pregunta».** Ya tiene los
  ajustes por fila (formato, columnas, salto, nota). Elegir un bloque abre esa
  parte (`foco=papel`) con la fila de la pregunta, y el bloque queda marcado
  mientras esa fila está abierta. Un inspector flotante propio duplicaría esa
  navegación.
