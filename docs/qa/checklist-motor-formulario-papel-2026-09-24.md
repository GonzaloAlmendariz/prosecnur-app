# Checklist — llevar el instrumento artesanal al motor de formulario en papel

**Fecha:** 2026-09-24 · **Origen:** el instrumento de *Ser Adolescente en el Perú* (12-2026)
se diagramó a mano fuera de la app durante tres semanas, y el resultado es más limpio que lo
que produce hoy `reporte_formulario_word.R` / `reporte_formulario_pdf.R`. Este documento
traslada lo aprendido, incluidos los errores que costaron horas, para que el motor lo genere
solo.

**Referencia visual:** `~/Documents/Pulso/SerAdolecente/Instrumento/Instrumento_SerAdolescente_EDICIONMAGDA_corregido_240926.docx`
(y su PDF). Es el objetivo estético. No se versiona en el repo: es material de cliente.

**Motor actual:** `api/R/reporte_formulario_pdf.R` (1 913 líneas; **no** figura hoy en
`policy.frozen_growth_files` de `agentic/manifest.json` — la afirmación original de este
documento era incorrecta, verificado con `node agentic/sync-agentic-os.mjs --audit`. La regla
de la casa se respeta igual: capacidad nueva en archivo nuevo) construye el modelo con `formulario_pdf_build_model()`, que
es agnóstico del renderer; `api/R/reporte_formulario_word.R` (379 líneas) lo pinta con
officer + flextable. Toda capacidad nueva se declara **en el modelo** y la implementan los
dos renderers, o se declara explícitamente como exclusiva de uno.

---

## Los ítems

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1 | **Dos columnas por secciones**, el salto de calidad más grande | modelo + ambos renderers | en curso |
| 2 | **Decidir el corte por ancho medido**, no por ojo | modelo | en curso |
| 3 | **Una matriz no se parte entre páginas** (`cantSplit` + `keepNext`) | renderer Word | en curso |
| 4 | **Gate por holgura al pie**, no por conteo de páginas | test / QA | **replanteado** — ver §4 |
| 5 | **Consentimiento como tabla 1×1 con bordes** | renderer Word | en curso |
| 6 | **Una sola numeración**: el número lo pone quien numera | modelo | en curso |
| 7 | **El número va en la matriz, no en el enunciado previo** | modelo | en curso |
| 8 | **Segunda persona consistente** en los enunciados generados | — | **descartado** — ver §8 |
| 9 | **El pie sobrevive en la última página** (`titlePg`) | renderer Word | en curso |
| 10 | **Verificador OOXML del artefacto** | test | pendiente |
| 11 | **`clean_text` borra `*` y backticks de las categorías** | modelo | en curso — ver §11 |
| 12 | **El renderer Word ignora `columns` desde siempre** | renderer Word | **bloqueado** — decide Gonzalo |


---

## 1. Dos columnas por secciones

Es lo que hace que el instrumento se vea ordenado, y es lo que nadie identificó mirando el
archivo: **no son tablas de dos columnas**. Son saltos de sección con formato de columnas,
`<w:sectPr>` con `<w:type w:val="continuous"/>` y
`<w:cols w:num="2" w:sep="1" w:space="425"/>`.

Reparto real del instrumento de referencia, siete secciones:

| Sección | Columnas | Contenido |
|---|---|---|
| 1 | 1 | Carátula y datos de control |
| 2–3 | **2** | Bloque A sociodemográfico, P1 a P5 |
| 4 | 1 | Matrices B a G (P6 a P22) |
| 5 | **2** | P23 a P29, ocupación |
| 6 | **2** | H ciudadanía, P30 a P39 y vivienda |
| 7 | 1 | Hoja del aplicador |

En officer esto es `body_end_block_section()` con
`block_section(prop_section(section_columns = section_columns(widths = ...)))`. En el PDF hay
que resolverlo en el layout propio del motor.

El `sectPr` de un párrafo **cierra** la sección que termina ahí; el último va suelto como hijo
de `body`. El orden de hijos dentro de `pPr` y de `sectPr` es estricto: este documento ya
provocó un "contenido ilegible" en Word por un elemento fuera de orden.

## 2. Decidir el corte por ancho medido

El criterio de Magda fue a ojo, tabla por tabla. El ancho está declarado en el XML
(`tblGrid`), así que el motor puede decidirlo por número:

- Tabla angosta (≈5 000 twips, media página): pregunta de respuesta simple → **2 columnas**.
- Tabla ancha (≈10 500 twips): matriz de 9 columnas → **1 columna**.

El modelo ya sabe si un bloque es matriz o lista de opciones; esa es la señal. La regla es
agrupar bloques contiguos del mismo tipo en un tramo y darle a cada tramo su sección.

## 3. Una matriz no se parte entre páginas

`cantSplit` en `trPr` de cada fila y `keepNext` en el párrafo del enunciado. Sin eso una
batería de 15 ítems queda cortada con la cabecera en una página y la mitad de los ítems en la
siguiente, que en papel es inservible porque el encuestador pierde los rótulos de la escala.

## 4. Gate por holgura, no por conteo de páginas — **replanteado con medición**

Se midió el instrumento de referencia y **tres de las premisas de este ítem no se
sostienen**:

- **No da 14 páginas en LibreOffice y 15 en Word.** El `.docx` corregido da **11 páginas**
  en LibreOffice, y el PDF que está junto a él da 11. El delta 14/15 no se reproduce.
- **El PDF "de referencia" es un export de LibreOffice**, no de Word
  (`pdfinfo` → `Producer: LibreOffice 26.2.3.2`; `Creator: Writer`). El único export real de
  Word de la carpeta es el del borrador anterior (`Acrobat PDFMaker 15 para Word`), que
  también da 11 páginas pero es otro documento. **No tenemos un render de Word del
  instrumento final**, así que la comparación Word↔LibreOffice sigue sin evidencia.
- **El umbral de 40 pt reprobaría al documento objetivo.** Holgura al pie medida con
  `pdftotext -bbox` (corte y < 800 pt), página a página: 16.3 · 3.7 · 1.6 · 9.5 · 27.3 · 2.1 ·
  26.9 · 14.0 · 13.5 · 169.9 · 72.5 pt. **Nueve de once páginas por debajo de 40 pt, mínima
  1.6 pt.** En un documento de dos columnas el texto fluye hasta llenar la página: holgura
  cercana a cero es el estado *normal*, no una señal de peligro.

Lo que sí queda en pie: **el conteo de páginas no es un contrato** y `pdfinfo | grep Pages`
sobre un render de LibreOffice no prueba nada sobre lo que verá el cliente.

**Gate que sí discrimina** (reemplaza al de holgura): lo que rompe un instrumento en papel no
es que el texto llegue al pie, es que se parta lo que debe ir junto. Se mide, con
`pdftotext -bbox` sobre el render:

1. Ninguna matriz tiene su cabecera en una página y sus ítems en la siguiente (ítem 3).
2. El pie aparece en **todas** las páginas, incluida la última (ítem 9).
3. Ninguna palabra cae fuera de la caja de texto (`yMax` > margen inferior real).

**Disponibilidad**: `poppler-utils` **sí está en el CI** desde `918aded84` (2026-07-23,
`.github/workflows/quality.yml:175`) — la memoria `ci-sin-poppler-pdftotext` quedó
desactualizada. Así que (1) y (3) pueden ser test de CI sobre el PDF, que el motor produce
directo. **LibreOffice no está en el CI**, de modo que todo lo que exija convertir el `.docx`
es herramienta local de QA, no gate. En local, `soffice` vive en
`/Applications/LibreOffice.app/Contents/MacOS/soffice` (el del `PATH` está roto, exit 127).

Cuidado con el verde por ausencia: si el gate se salta cuando falta `pdftotext`, quitar
`poppler-utils` del workflow lo apagaría en silencio.

## 5. Consentimiento como tabla 1×1 con bordes

El bloque de consentimiento **desapareció en Word** y nadie lo notó porque LibreOffice sí lo
renderizaba, así que todos los chequeos por PDF lo daban por bueno. Causa: era una caja de
texto sin su rama `mc:Fallback`. La forma robusta es una tabla de una fila y una celda con
bordes. Sirve como regla general: **ninguna caja dibujada, todo lo que enmarque va en tabla**.

## 6. Una sola numeración

Si el párrafo tiene `numPr` (numeración automática de Word) y además se le prefija el número
como texto, Word imprime los dos: salieron "C. C. SOLEDAD" y "3. P6.". Decidir quién numera —
el motor, siempre — y quitar `numPr`, normalizando la sangría francesa a mano.

Cuidado adicional: un párrafo ya envuelto en `w:ins` no tiene sus runs como hijos directos, así
que un prefijador ingenuo **falla en silencio** y reporta éxito. Buscar el primer run dentro de
`w:ins` y afirmar el resultado.

## 7. El número va en la matriz, no en el enunciado previo

Criterio del usuario, textual: *"estás considerando los enunciados como preguntas tipo P,
cuando solo la matriz debería ser pregunta"*. Una batería precedida de una instrucción ("Por
favor señala cuán de acuerdo estás…") es **una** pregunta: el número va en la celda de
cabecera de la matriz, no en la instrucción. Los ítems llevan subnumeración X.1 / X.2, que el
motor ya sabe hacer.

## 8. Segunda persona consistente — **descartado**

Decisión de Gonzalo (2026-09-24), textual: *"Esto no, aquí depende enteramente del XLSForm y
no avisa porque no corrige redacción."*

El motor **no reescribe la redacción de los enunciados y tampoco avisa sobre ella**. La
persona gramatical es responsabilidad del XLSForm. Esto deja sin objeto el caso del bloque de
vivienda INEI: al no existir reescritura, no hace falta marcar bloques como redacción externa
para protegerlos.

Se confirmó que hoy el motor no reescribe: las únicas transformaciones semánticas son sobre
texto de **salto** que el propio motor fabrica (`.form_pdf_rephrase_skip`), no sobre
enunciados del usuario. Queda como observación sin acción: esas frases del motor están en
tercera persona del pasado ("Si respondió «No», …").

## 9. El pie sobrevive en la última página

El `sectPr` final con `titlePg` (primera página distinta) hace que la última página pierda el
pie cuando la sección abarca más de una página. Se nota tarde y se ve pobre en impresión.

## 10. Verificador OOXML del artefacto

Un chequeo barato que ya evitó dos accidentes, y que debería correr como test del motor Word:

- Integridad del zip.
- Orden de hijos conforme al esquema en `pPr` / `rPr` / `trPr` / `tcPr` / `tblPr`.
- Cero `rStyle` apuntando a estilos inexistentes.
- Comentarios y anclas balanceados: `commentRangeStart` = `commentRangeEnd` =
  `commentReference`.
- Cero em dashes.

## 11. `clean_text` borra `*` y backticks de las categorías

**La regla innegociable de este documento está rota hoy, en el motor.**
`.form_pdf_clean_text()` (`api/R/reporte_formulario_pdf.R:25`) aplica
`gsub("[`*]", "", x)` a **todo** texto, y las etiquetas de categoría pasan por ahí
(`.form_pdf_options_by_list`, línea 131). Medido literalmente:

| Categoría escrita | Categoría impresa |
|---|---|
| `De 5* a 10*` | `De 5 a 10` |
| `Nota al pie (*)` | `Nota al pie ()` |
| `3 * a la semana` | `3 a la semana` |

No hay warning, no hay registro, no hay forma de saberlo desde el artefacto: es exactamente
la normalización silenciosa que la regla prohíbe. El desmarcado de markdown (`**`, `__`) y el
borrado de `` ` `` y `*` se separan de la limpieza inocua (NBSP, comillas curvas, guiones
largos, colapso de espacios); las categorías pasan **sólo** por la inocua, y cualquier
diferencia se declara en `model$warnings`.

## 12. El renderer Word ignora `columns` desde siempre — **bloqueado**

`api/R/reporte_formulario_word.R` no menciona `columns` ni `full_width` en ninguna de sus 379
líneas. El toggle "Una columna / Dos columnas" del diálogo de exportación
(`ConfigurarPdfDialog.tsx:196-219`) **no tiene efecto sobre el .docx**: sale siempre a una
columna, sin avisar. Es un campo publicado por el modelo (`reporte_formulario_pdf.R:900`) que
nadie consume.

Está **bloqueado**, no pendiente, porque arreglarlo es una decisión, no una reparación:
honrar `columns = 2` en Word **cambia la forma de todo export .docx existente** que se haya
pedido a dos columnas. Las salidas son (a) honrarlo y aceptar el cambio, (b) dejar `2` como
está y que sólo `auto` produzca columnas, o (c) quitar el toggle del diálogo para Word.
Mientras se decide, el trabajo en curso toma (b): `1` y `2` conservan la salida de hoy.

---

## Regla que no se negocia

**Las categorías de respuesta existentes no se tocan.** Indicación explícita del usuario: un
cambio de etiqueta no consultado en un cuestionario ya acordado con el cliente es un problema
serio, porque rompe la comparabilidad y nadie lo detecta hasta el análisis. Si el motor
normaliza etiquetas, lo hace de forma declarada y reversible, nunca en silencio.
