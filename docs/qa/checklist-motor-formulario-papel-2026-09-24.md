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
| 1 | **Dos columnas por secciones**, el salto de calidad más grande | modelo + ambos renderers | **cerrado** |
| 2 | **Decidir el corte por ancho medido**, no por ojo | modelo | **cerrado con reserva** — ver §2 |
| 3 | **Una matriz no se parte entre páginas** (`cantSplit` + `keepNext`) | renderer Word | **cerrado** |
| 4 | **Gate por holgura al pie**, no por conteo de páginas | test / QA | **cerrado, replanteado** — ver §4 |
| 5 | **Consentimiento como tabla 1×1 con bordes** | renderer Word | **cerrado** |
| 6 | **Una sola numeración**: el número lo pone quien numera | modelo | **cerrado** |
| 7 | **El número va en la matriz, no en el enunciado previo** | modelo | **cerrado** (el conteo, en el 14) |
| 8 | **Segunda persona consistente** en los enunciados generados | — | **descartado** — ver §8 |
| 9 | **El pie sobrevive en la última página** (`titlePg`) | renderer Word | **cerrado** |
| 10 | **Verificador OOXML del artefacto** | test | **cerrado** |
| 11 | **`clean_text` borra `*` y backticks de las categorías** | modelo + ambos renderers | **cerrado** — ver §11 |
| 12 | **El renderer Word ignora `columns` desde siempre** | renderer Word | **bloqueado** — decide Gonzalo |
| 13 | **Las cabeceras de matriz parten palabras** | ambos renderers | **cerrado** — Word `72425151f` (envoltorio por ancho medido); el PDF ya cumplía: `wrap_fit` siempre midió ancho real |
| 14 | **`n_questions` no tiene grano declarado** | modelo + API | **bloqueado** — decide Gonzalo |
| 15 | **La geometría del motor no alcanza a la de la referencia** | modelo | **resuelto en la práctica** — se adoptaron sus márgenes de 680 twips: útil 10 546 vs 10 549 de la referencia (`9a2fb7f02`, `4186e3647`) |
| 16 | Sección de 1 columna con su propio `<w:col w:w>` | renderer Word | **no nos pasa** — ver §16 |
| 17 | El ancho útil se toma por sección, no de una constante | renderer Word | **riesgo latente** — hoy todas las secciones comparten `pgMar`, así que no muerde |
| 18 | Sangría negativa que saca texto del margen | renderer Word | **no nos pasa** (0 medidas) |
| 19 | Tabla más ancha que su columna | renderer Word | **1 twip de redondeo**, sin efecto medible — ver §19 |
| 20 | Banda sin `keepNext`, y la cadena rota por huecos | renderer Word | **no nos pasa** (4/4 con cadena intacta) |
| 21 | Cabecera de matriz repetida con `tblHeader` | renderer Word | **ya lo hacemos** |
| 22 | Tabla corta partida entre columnas | ambos renderers | **cerrado** — Word `e115a4107` (`keepNext` por fila, NO `cantSplit`); el PDF no lo reproduce: pasa el bloque entero de columna |
| 23 | Párrafos de relleno y marcos vacíos | renderer Word | **no nos pasa** (0 medidos) |
| 24 | El borde de párrafo se dibuja `space` pt por fuera | renderer Word | **no nos pasa** (`space=0`) |
| 25 | **El PDF no equilibra las dos columnas de un tramo** | renderer PDF | **cerrado** `3877c1b64` — corte por mitad del alto acumulado; tinta der/izq 0,44 → 0,85 |



**Estado al 2026-09-25.** De los diez ítems originales quedan **cerrados nueve**; el 8 lo
descartó Gonzalo. De los que aparecieron midiendo —11, 13, 22, 25— están **los cuatro
cerrados**. Siguen **bloqueados esperando decisión suya el 12 y el 14**, y el 17 queda
como riesgo latente que hoy no muerde.

El trabajo se continuó como GOAL —`docs/qa/goal-formulario-replica-ser-adolescente-2026-09-24.md`—
tras la instrucción de tomar el instrumento de Ser Adolescente como referencia y replicarlo
**también en escala de grises**, porque «los instrumentos son insumos que se imprimen en
blanco y negro». Ese doc lleva la cola L1–L14 (completa en los dos renderers) y la vara
V1–V10 con sus mediciones; ahí vive lo que falta.

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

**Cerrado con reserva, y la reserva importa.** El criterio implementado decide bien —todas
las matrices verdaderas van a una columna, como en la referencia— pero **no mide un ancho
continuo**: barrido el espacio de entradas, el término `110 * nchar` nunca alcanza su tope
(una lista de opciones jamás pasa de 4 000 < 4 323), así que el criterio equivale a *«hay
una matriz en modo categorías, o una matriz de más de 5 columnas ⇒ 1 columna; el resto ⇒
2»*. Es decir, la señal de **tipo** que este mismo ítem decía que el modelo ya tenía.
Llamarlo «por ancho medido» sobrevende lo que hace: de los tres umbrales
(`lbl_min=2600`, `col_min=340..1400`, `110*nchar`), dos son inertes.

Además, comparar `min_width_twips` con los `tblGrid` de la referencia **es inválido**: son
magnitudes distintas (uno pretende ser cota inferior, el otro es ancho ocupado) y, de
hacerlo, los 4907–5250 de la referencia son todos mayores que el `half` del motor, así que
clasificaría sus tres secciones de dos columnas como de una. La causa está en §15.

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
`poppler-utils` del workflow lo apagaría en silencio. **Resuelto**: el guard se salta en
local sin poppler, pero **falla** cuando `CI` está definido.

**Implementado así**, con las dos trampas medidas antes de elegir el método:

- Buscar la etiqueta de cabecera como **cadena contigua no encuentra nada**: `pdftotext`
  devuelve las celdas envueltas e intercaladas con las vecinas
  (`"Totalmente En Indiferente De Totalmente / en desacuerdo …"`). Habría dado verde por
  ausencia. Se ancla por palabra (la más larga de cada etiqueta, ≥5 caracteres) y se exige
  intersección de páginas no vacía entre las anclas de escala y los ítems.
- Una palabra derramada **no aparece «un poco fuera»**: el borde de la página la recorta y
  `pdftotext` devuelve media palabra (`DERRA` por `DERRAMADA`).
- El gate mide el **marco de página**, no la columna del cuerpo: la cabecera y el pie viven
  fuera de la caja de texto a propósito, y exigirles la caja del cuerpo sería un falso
  positivo garantizado.

Fuera de alcance, dicho para que no se confunda con cobertura: no mide que una palabra
invada la **columna vecina**, y el de matriz vale mientras la matriz quepa en una página.

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

## 13. Las cabeceras de matriz parten palabras

`Totalment/e`, `desacue/rdo`. No es una decisión de rotulación: es Word partiendo
una palabra porque la celda no la contiene, y el pre-wrap del renderer lo enmascara —
`wrap_chars = 11` está en **caracteres** y la celda en **pulgadas**, sin que nada
compruebe que la palabra más larga cabe.

Medido: para una escala de 5 en Word, `matrix_label_frac(5) = 0.60` deja **725 twips**
por columna de escala. La referencia usa `frac ≈ 0.45` y **786–925 twips**, sobre una
caja además 15 % más ancha (§15). El motor da más a la etiqueta y menos a la escala.

**No se resuelve mandando la escala a `extremos`**, y esto es criterio metodológico, no
estético: el instrumento es autoadministrado (*«Marca una sola respuesta»*), y `extremos`
es convención de administración con encuestador. Borrar los rótulos intermedios obliga a
interpolar categorías no verbalizadas, sesga hacia la tendencia central y rompe la
comparabilidad con la misma escala aplicada por CATI/CAPI o web. La referencia rotula las
siete categorías de sus escalas de 7 puntos.

Escalera correcta, en orden: (1) derivar `wrap_chars` del ancho real de columna y del
cuerpo tipográfico; (2) si la palabra más larga no cabe, bajar `matrix_label_frac` y/o
ensanchar la caja del tramo; (3) si sigue sin caber, **leyenda en el enunciado y códigos
desnudos en la cabecera**, que es lo que hace la referencia y queda declarado en
`warnings`; (4) `extremos` sólo por decisión explícita del autor o escala numérica.
Nunca por ancho.

Mitigado de momento: una escala de más de 6 puntos ya **avisa** de que el modo automático
le va a quitar los rótulos intermedios, en vez de hacerlo en silencio.

## 14. `n_questions` no tiene grano declarado — **bloqueado**

Se publica en la respuesta de la API y hay tests que lo fijan, así que hoy es un número
citable y no reproducible. Medido, se equivoca **en los dos sentidos a la vez**:

- **Sobreestima**: una `note` de instrucción se emite con `kind = "question"` y el conteo
  cuenta `kind %in% c("question","matrix")`. Suma exactamente el número de notas.
- **Subestima**: una matriz sin `tenor` aporta 1 al conteo mientras consume 3 números.

Los dos errores no se cancelan y su signo depende del instrumento. No es «preguntas
numeradas», no es «ítems» y no es «bloques de pregunta». Está bloqueado porque arreglarlo
es elegir un grano y renombrar el campo, y eso rompe consumidores de la API.

## 15. La geometría del motor no alcanza a la de la referencia — **bloqueado**

Medido sobre el `.docx` de referencia: `pgMar left=680 right=680` → ancho de texto
**10 549 twips**, y **10 660** en la sección de matrices (`right=569`). Magda recortó los
márgenes a ~1,2 cm. El motor trabaja con **9 072** (A4 de officer, márgenes de ~2,5 cm):
su media columna mide 4 323 twips contra los 5 062 de la referencia, **15 % menos**.

Consecuencia directa: los anchos de la referencia (4907–5250 en sus secciones de dos
columnas) **no caben** en media columna del motor. El patrón de reparto sí se replica; la
densidad no. Decidir si el motor adopta los márgenes de la referencia —lo que cambia todos
los exports— o si el objetivo estético se declara inalcanzable en anchos.

## 16–24. Los nueve defectos de layout Word medidos sobre la referencia

**Origen:** otra sesión siguió puliendo el `.docx` de referencia contra capturas de Word
del usuario y midió nueve defectos con su causa exacta. **No son medidas mías**; lo que sí
verifiqué es cuáles alcanzan a *nuestro* motor, y ese es el veredicto de la tabla.

**Aviso sobre el archivo de referencia**: cambió a las 11:13 del 2026-09-24, después de la
copia de las 10:25 con la que se midió el §4 de este documento (md5 distinto). Las cifras
de holgura del §4 son del estado anterior. Re-medido el archivo actual: siguen siendo 7
`sectPr` con el reparto 1-2-2-1-2-2-1, pero ahora **0 sangrías negativas** (había 48),
`tblHeader` de 0 a 12, `keepNext` de 1336 a 1454, y los `<w:col w:w="8838"/>` **han
desaparecido**. El archivo de hoy es el golden corregido.

**§16 — el hallazgo principal de esa ronda, y el menos obvio.** Una sección de UNA columna
puede declarar su propio ancho con `<w:cols w:space="425" w:equalWidth="0"><w:col
w:w="8838"/></w:cols>`. Word encoge **todo el texto** de la sección al 82,9 % del ancho
útil; las tablas no se enteran porque llevan su propio `tblW`, así que las bandas salen más
cortas que las tablas que encabezan y ningún `tblGrid` lo explica. **LibreOffice lo
ignora**: el defecto sólo aparecía en capturas de Word. Nuestro motor **no lo produce**:
sus secciones de una columna salen como `<w:cols/>` sin hijos, que es justo la forma
corregida.

**§17 — los márgenes no son iguales en todas las secciones del mismo documento.** En la
referencia el cuerpo tiene 10 660 twips útiles (margen derecho 569) y la hoja del aplicador
10 549 (680). Normalizar a una constante desborda medio documento. Nuestro renderer usa
`.FORM_WORD_USABLE_IN = 6.3`, **una constante**. Hoy no muerde porque todas nuestras
secciones comparten `pgMar`; el día que una no lo haga, sí. Riesgo latente, no defecto.

**§19 — tabla más ancha que su columna.** Ancho de columna = (útil − `space`) / `num`.
Nuestras tablas de tramo a dos columnas miden 4 323, exactamente el ancho de columna. La
del tramo de una mide **9 073 contra 9 072 útiles**, y el propio `<w:cols>` suma 9 073: un
twip de redondeo (0,0007 in). No desborda en la práctica, pero es la misma familia y
conviene cerrarlo al tocar la geometría.

**§22 — tabla corta partida entre columnas. Éste sí nos pasa**, y ya lo reportó el
implementador: una pregunta fluye con su cabecera al pie de la columna izquierda y sus
filas arriba en la derecha, sin enunciado. No se arregla con `cantSplit` —en dos columnas
LibreOffice **descarta** las filas en vez de pasarlas—. La receta medida es `keepNext` en
los párrafos de todas las filas menos la última, **sólo** en tablas cortas (≤12 filas) de
secciones a dos columnas. Las matrices largas quedan fuera a propósito: ésas tienen que
partirse, y para eso repiten cabecera con `tblHeader` (§21).

**Cómo se verifica esto**, que aquí importa tanto como el arreglo:

1. **Medir píxeles, no fiarse del XML.** Lo que cerró esa ronda fue renderizar las páginas
   y buscar, por página, el píxel con tinta más a la derecha contra el margen. Leer `tblW`
   no detecta un derrame.
2. **Para juzgar una banda contra su tabla, comparar proporciones**: 83,3 % medido en la
   captura frente a 8838/10660 = 82,9 % señaló la causa sin abrir Word.
3. **Antes de descartar una captura ajena por «ser de otra versión», comprobarlo con una
   huella.** Allí fue el patrón de corte de palabras de la cabecera, que depende del ancho
   de columna. Casi se entierra el hallazgo principal por dar por vieja la captura buena.
4. **Un render de LibreOffice no juzga una página a dos columnas**: cambia el orden del
   contenido entre columnas, no sólo la paginación.
5. Y un recordatorio de esta sesión: **leer el `<w:cols>` con regex se para en el `/>` del
   primer hijo** y hace creer que una sección de 2 columnas declara una sola. Se parsea con
   un parser, que es la lección que el helper OOXML del repo ya tenía escrita.

## 25. El PDF no equilibra las dos columnas de un tramo

Destapado al generar un XLSForm de ejemplo end-to-end y comparar los dos renderers sobre el
**mismo** modelo y el mismo `column_plan` (tramos 1-2-1-2).

- **Word equilibra**: en el tramo sociodemográfico, P1–P3 quedan en la columna izquierda y
  P4–P5 pasan a la derecha; el de vivienda reparte P12 a la izquierda y P13–P14 a la
  derecha. El instrumento entero ocupa **1 página**.
- **El PDF no**: apila todo en la columna izquierda y deja la derecha **vacía**, con el
  divisor central dibujado sobre media página en blanco. El mismo instrumento ocupa
  **2 páginas**.

La causa es que el PDF implementa el tramo marcando `full_width` en los bloques de los
tramos de una columna y dejando que el resto fluya por su maquinaria de dos columnas, que
llena la izquierda de arriba abajo y sólo desborda a la derecha cuando se acaba la página.
Un `sectPr` continuous de Word, en cambio, **equilibra** el contenido entre columnas al
cerrar la sección. No es el mismo comportamiento, y por eso el mismo plan produce dos
documentos distintos.

Consecuencia práctica: hoy la ventaja del ítem 1 sólo se cobra en el `.docx`. En el PDF los
tramos cortos gastan el doble de papel que el Word y se ven peor que antes del cambio, con
media página en blanco a la derecha.

Cierre: el renderer PDF necesita repartir los bloques del tramo entre las dos columnas
midiendo su alto —ya tiene `.form_pdf_block_height()`— en vez de llenar la izquierda hasta
el fondo. Queda **pendiente**, no cerrado: llegó después del gate y no se toca código sin
verificación al cierre de la unidad.

---

## Regla que no se negocia

**Las categorías de respuesta existentes no se tocan.** Indicación explícita del usuario: un
cambio de etiqueta no consultado en un cuestionario ya acordado con el cliente es un problema
serio, porque rompe la comparabilidad y nadie lo detecta hasta el análisis. Si el motor
normaliza etiquetas, lo hace de forma declarada y reversible, nunca en silencio.
