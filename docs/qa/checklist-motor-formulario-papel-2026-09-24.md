# Checklist — llevar el instrumento artesanal al motor de formulario en papel

Tipo: Checklist de traslado al motor
Estado: En curso
Fecha: 2026-09-24
Autoridad: Evidencia de QA; no reemplaza un ADR

**Origen:** el instrumento de *Ser Adolescente en el Perú* (12-2026)
se diagramó a mano fuera de la app durante tres semanas, y el resultado es más limpio que lo
que produce hoy `reporte_formulario_word.R` / `reporte_formulario_pdf.R`. Este documento
traslada lo aprendido, incluidos los errores que costaron horas, para que el motor lo genere
solo.

**Referencia visual:** `~/Documents/Pulso/SerAdolecente/Instrumento/Instrumento_SerAdolescente_EDICIONMAGDA_corregido_240926.docx`
(y su PDF). Es el objetivo estético. No se versiona en el repo: es material de cliente.

**Motor actual:** `api/R/reporte_formulario_pdf.R` (1 957 líneas, congelado a crecimiento —
revisar `agentic/manifest.json`) construye el modelo con `formulario_pdf_build_model()`, que
es agnóstico del renderer; `api/R/reporte_formulario_word.R` (379 líneas) lo pinta con
officer + flextable. Toda capacidad nueva se declara **en el modelo** y la implementan los
dos renderers, o se declara explícitamente como exclusiva de uno.

---

## Los ítems

| # | Ítem | Dónde vive | Estado |
|---|---|---|---|
| 1 | **Dos columnas por secciones**, el salto de calidad más grande | modelo + ambos renderers | pendiente |
| 2 | **Decidir el corte por ancho medido**, no por ojo | modelo | pendiente |
| 3 | **Una matriz no se parte entre páginas** (`cantSplit` + `keepNext`) | renderer Word | pendiente |
| 4 | **Gate por holgura al pie**, no por conteo de páginas | test / QA | pendiente |
| 5 | **Consentimiento como tabla 1×1 con bordes** | renderer Word | pendiente |
| 6 | **Una sola numeración**: el número lo pone quien numera | modelo | pendiente |
| 7 | **El número va en la matriz, no en el enunciado previo** | modelo | pendiente |
| 8 | **Segunda persona consistente** en los enunciados generados | modelo | pendiente |
| 9 | **El pie sobrevive en la última página** (`titlePg`) | renderer Word | pendiente |
| 10 | **Verificador OOXML del artefacto** | test | pendiente |

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

## 4. Gate por holgura, no por conteo de páginas

**LibreOffice y Word no paginan igual.** El instrumento dio 14 páginas en LibreOffice y 15 en
Word, con el bloque de firma arrastrado. `pdfinfo | grep Pages` sobre un render de LibreOffice
no prueba nada sobre lo que verá el cliente.

Lo que sí se mide: `pdftotext -bbox` y, por página, el `yMax` mayor entre las palabras que no
son del pie (y < 800 pt en A4). La distancia hasta el pie es la **holgura real**. Con menos de
~40 pt Word puede desbordar; ~85 pt aguanta. El instrumento de referencia cierra dos páginas a
14 pt: es poco margen y conviene que el motor avise.

Cuando hay que recortar, lo que rinde en orden: alto mínimo de filas, alto de las cajas de
escritura, y por último el `spacing` de párrafo, que es el que más se nota al leer.

Ver `docs/qa/` y la memoria `contar-paginas-en-libreoffice-no-es-medir-en-word`.

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

## 8. Segunda persona consistente

Los enunciados van en segunda persona del singular, sin "usted". Dos trampas:

- No arrancar con "Actualmente" cuando el adverbio no aporta ("Actualmente te encuentras…" →
  "Te encuentras…"). Sí se conserva donde significa algo ("¿A qué te dedicas actualmente?").
- El bloque de vivienda es **redacción estándar INEI** y viene en tercera persona por diseño.
  Tutearlo lo aleja del enunciado oficial. El motor debe poder respetar la literalidad de un
  bloque marcado como estándar externo.

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

---

## Regla que no se negocia

**Las categorías de respuesta existentes no se tocan.** Indicación explícita del usuario: un
cambio de etiqueta no consultado en un cuestionario ya acordado con el cliente es un problema
serio, porque rompe la comparabilidad y nadie lo detecta hasta el análisis. Si el motor
normaliza etiquetas, lo hace de forma declarada y reversible, nunca en silencio.
