# GOAL — el motor produce el instrumento de Ser Adolescente, sin retoques

**Abierto:** 2026-09-24 · **Decisión de Gonzalo:** *réplica fiel, también en grises.*

La calidad que se persigue: **que un XLSForm pase por el motor y salga un instrumento
indistinguible del que Magda diagramó a mano durante tres semanas**. No «parecido», no
«ordenado»: que si alguien pone los dos PDF lado a lado no sepa cuál hizo la app.

Hoy no lo es. El motor produce la estética Pulso (bandas navy, sin bordes, Calibri, zebra
azulada); la referencia es una rejilla en escala de grises, Arial Narrow, con bordes
completos y el enunciado dentro de una celda sombreada.

### Por qué en grises, que no es una cuestión de gusto

Gonzalo, textual: *«los instrumentos son insumos que se imprimen en blanco y negro».*

Un formulario en papel no es un entregable que se mira en pantalla: es un **insumo de campo
que se imprime por cientos y se fotocopia**. La escala de grises no es una excepción a la
identidad Pulso, es **la identidad aplicada a un medio sin color**. Por eso este GOAL no
necesita un ADR que lo disculpe: necesita que el motor sepa que su destino es una
impresora monocroma.

Medido sobre nuestra paleta actual, convertida a luma (lo que hace una impresora B/N):

| token | hex | gris 0-255 | tinta | contraste vs blanco |
|---|---|---|---|---|
| banda de sección | `#002457` | 31 | **88 %** | — |
| texto soft | `#5A6B85` | 105 | 59 % | — |
| zebra | `#F1F4F9` | 244 | 4 % | **1,10 : 1** |
| línea de tabla | `#C7D0E0` | 207 | 19 % | 1,55 : 1 |
| cabecera de matriz | `#E9EEF6` | 237 | 7 % | — |
| REF relleno principal | `#F2F2F2` | 242 | 5 % | 1,12 : 1 |

**El hallazgo no es el que se esperaba.** El relleno de la referencia (5 % de tinta,
1,12 : 1) es *igual de claro* que nuestra zebra (4 %, 1,10 : 1): los dos desaparecen en una
fotocopia. La diferencia está en de qué cuelga la estructura:

- **Nosotros separamos las filas con el relleno**, y el relleno no sobrevive. Sin zebra
  visible, una lista de opciones queda como texto suelto sin rejilla.
- **La referencia separa las filas con bordes de 0,5 pt** y usa el relleno sólo como
  refuerzo decorativo. Fotocopiada, la rejilla sigue entera.

Por eso **L3 (bordes completos) es el ítem de mayor valor de la cola**, por delante del
cambio de paleta: es el que hace que el instrumento sobreviva a la fotocopiadora. Cambiar el
navy por gris sin añadir bordes daría un documento más pobre que el de hoy.

Y la banda de sección son **88 % de tinta a todo el ancho de página**, con texto en blanco
encima: caro en tóner por ejemplar y lo primero que se empasta al fotocopiar, que es cuando
el texto reversado se vuelve ilegible.

**Referencia:** `~/Documents/Pulso/SerAdolecente/Instrumento/` — material de cliente, **no se
versiona**. Dos archivos y no son intercambiables:
- `Instrumento_22_09 EDICIONMAGDA.pdf` — export **real de Word** (`Acrobat PDFMaker 15`),
  del borrador. Es la verdad tipográfica.
- `VistaPrevia_LibreOffice_NO_es_el_render_de_Word.pdf` — vista previa del `.docx` corregido.
  Estructura al día, layout que el cliente **no** ve.

---

## La vara

| | Afirmación | Cómo se mide |
|---|---|---|
| **V1** | El cuerpo va en una **tipografía estrecha** | Word: `w:rFonts` 100 % Arial Narrow ✅. **PDF: Helvetica-Narrow, con reserva declarada** — Arial Narrow es del sistema y en el runner Linux del CI cairo caería a otra en silencio; un PDF distinto según la máquina es peor que otra tipografía. Cumplirlo literalmente exige empaquetar la fuente (decisión de packaging) |
| **V2** | **Cero color.** Ni un `w:color` ni un `w:fill` fuera de la escala de grises | todo `w:color` = `000000`; todo `w:fill` con R=G=B |
| **V3** | Cuerpo base **10 pt** (`w:sz` = 20), cabecera de escala 8 pt (16) | histograma de `w:sz`: el 90 % en {16, 20} |
| **V4** | **Todas** las celdas llevan borde de 0,5 pt (`w:sz` = 4) | cero tablas sin `insideH`/`insideV`; grosor dominante 4 |
| **V5** | El enunciado vive **dentro** de la tabla, en celda con relleno `F2F2F2` | primera fila de cada tabla de pregunta tiene `shd fill="F2F2F2"` |
| **V6** | El número del ítem va en **columna propia**, no pegado a la etiqueta | `tblGrid` de una matriz: primera columna ≤ 500 twips, sólo dígitos |
| **V7** | Ninguna cabecera de escala **parte una palabra** | `pdftotext -bbox`: ninguna palabra de cabecera se corta (§13 del checklist) |
| **V8** | Márgenes ~**680 twips** (1,2 cm), ancho útil ≥ 10 500 | `pgMar` del `sectPr` |
| **V9** | El pie dice **«Página N de M»** | `pdftotext` de la última página contiene `de <total>` |
| **V10** | **El instrumento se lee fotocopiado**: la estructura no depende de ningún relleno | Medido binarizando el render a 1 bit. **Word**: 45 líneas de rejilla a umbral ≥170, 4 por debajo de 166. **PDF**: 37 y 7. La estructura NO depende del relleno (eso se cumple: los bordes la sostienen), pero la rejilla misma se pierde en una copia dura. Ver **B4** |

Medición de partida (2026-09-24), motor actual contra referencia:

| | Referencia | Motor hoy |
|---|---|---|
| fuente | Arial Narrow (4 138 usos) | Calibri |
| color de texto | `000000` (224), **nada más** | navy `#002457`, soft `#5A6B85` |
| rellenos | `F2F2F2` (656) · `E8E8E8` (125) · `D9D9D9` (19) | navy sólido, zebra `#F1F4F9` |
| bordes | 0,5 pt (2 812) · 1 pt (112) | `#C7D0E0` 0,5 pt, sólo exterior + interior vertical |
| cuerpo | 10 pt (2 244), 8 pt (154) | 9–10,5 pt |
| márgenes | 680 / 569 twips | 1 417 twips (2,5 cm) |
| nº de ítem | columna propia | pegado a la etiqueta (`"6.  texto"`) |

---

## La cola

| | Ítem | Dónde vive | Estado |
|---|---|---|---|
| **L3** | Rejilla: bordes completos | **Word ☑** `a6059a042` · **PDF ☑** `4c5d524d3` — línea entre filas en listas y matrices |
| **L1** | Paleta → escala de grises | **Word ☑** `07ea38d40` · **PDF ☑** `57363712b` — paleta local en `reporte_formulario_paleta.R`, sin tocar el theme compartido |
| **L2** | Tipografía estrecha | **Word ☑** `73f55c4d5` (Arial Narrow) · **PDF ☑ con reserva** `04ccec36f` (Helvetica-Narrow, ver V1) |
| **L4** | Enunciado dentro de la tabla | **Word ☑** `3d6d57e38` · **PDF ☑** `3d42ff3a1` |
| **L5** | Columna propia para el número | **Word ☑** `20a8a2b6f` · **PDF ☑** `e92df7684` — constante compartida por dibujo y `block_height` |
| **L6** | Densidad y márgenes | **Word ☑** `9a2fb7f02` (10 546 vs 10 549) · **PDF ☑** `4186e3647` — 61,4 → 54 pt por pregunta; el instrumento pasa de 2 páginas a 1 |
| **L7** | Banda de sección: caja con borde y relleno gris | **Word ☑** `07ea38d40`+`fa6b7b9e2` — relleno gris, texto negro y borde de 0,5 pt con `space = 0` · **PDF ☑** — ya lo hacía; auditado, sin tocar código |
| **L8** | Opciones cortas en fila horizontal | **Word ☑** `7f64804a1` · **PDF ☑** `1ccee9f95` — corte por ancho medido en un helper compartido por dibujo y altura |
| **L9** | Campos de escritura = celda vacía | **Word ☑** `fa6b7b9e2` · **PDF ☑** — ya lo hacía; auditado |
| **L10** | Pie «Página N de M» + casillas del folio | **Word ☑** `39cca7bba` · **PDF ☑** `c767f0d1a` — dos pasadas, porque en `grid` el total no es un campo |
| **L11** | Cabeceras sin partir palabras | **Word ☑** `72425151f` · **PDF ☑** — ya cumplía; auditado midiendo, `wrap_fit` siempre midió ancho real |
| **L12** | El PDF equilibra las columnas de un tramo | **PDF ☑** `3877c1b64` — tinta der/izq 0,44 → 0,85 |
| **L13** | Consentimiento: párrafo justificado + caja de acuerdo | **Word ☑** `649bb12e1` · **PDF ☑** `579a0fc33` — etiquetas de `consent_options`, no inventadas |
| **L14** | Tabla corta partida entre columnas | **Word ☑** `e115a4107` — `keepNext` por fila, NO `cantSplit` · **PDF ☑ por construcción** — no se reproduce: su bucle mide cada bloque y lo pasa ENTERO a la otra columna. Verificado con el fixture que sí lo destapó en Word (0 tablas partidas) y con el caso límite de un bloque más alto que la columna (se va entero a la página siguiente, 0 palabras fuera del marco) |
| **L15** | El énfasis del autor (`**palabra**`) se pinta en negrita | **Word ☑** `cb6e89f4f` — la etiqueta se compone por tramos; cero asteriscos en el artefacto. **PDF ☐ declarado exclusivo de Word**: ese motor dibuja cada cadena con un solo estilo, así que de momento retira los marcadores en su capa de dibujo para no imprimirlos. Cuando aprenda a trocear, se sustituye por el dibujo tramo a tramo |
| **L16** | **El enunciado de la batería va DENTRO de la matriz**, en la celda superior izquierda | ambos renderers | ☐ — hoy el `tenor` se pinta como párrafo encima; en la referencia («P20. Por favor señala qué tan de acuerdo…») vive en la esquina de la tabla, junto a la cabecera de escala. Misma razón que L4: separado, se corta de su tabla |
| **L17** | **Subsecciones como segundo nivel de banda** (`F.1.`, `D.4.`, `D.5.`) | modelo + renderers | ☐ — el modelo ya trae `paper_subgroup` pero lo pinta en la esquina de la matriz, no como banda propia |
| **L18** | **Leyenda de la escala en el enunciado** cuando la cabecera no puede rotular todo | ambos renderers | ☐ — es el paso 3 de la escalera del §13 del checklist, y la referencia lo hace: «considerando que 1 es fuertemente en desacuerdo, 2 en desacuerdo, … (MARCAR SOLO UNA RESPUESTA POR PREGUNTA)» |

## Espera a Gonzalo

| | Qué | Por qué no puedo yo |
|---|---|---|
| **B1** | Honrar `columns` en Word (ítem 12) | cambia la forma de todo export `.docx` existente |
| **B2** | Grano de `n_questions` (ítem 14) | elegir el grano y renombrar rompe consumidores de la API |
| **B3** | ~~¿ADR que declare la salida de la identidad Pulso?~~ **Resuelto**: no hay salida que declarar. El instrumento se imprime en B/N, así que la escala de grises es la identidad aplicada a su medio. | — |
| **B4** | **¿Rejilla fiel o rejilla robusta?** La rejilla es `A6A6A6` (luma 166), que es lo que usa la referencia en 2 666 de sus bordes. Binarizando el render a 1 bit: por encima de umbral 170 sobreviven 37 líneas (PDF) y 45 (Word) — la rejilla entera; por debajo de 166 sobreviven **7 y 4**, sólo lo negro. Una fotocopia normal trabaja en 180–200 y aguanta; una copia dura, no. Oscurecerla a `808080` la haría sobrevivir por debajo de 128, a costa de apartarse de la referencia y algo más de tóner. | Es fidelidad contra robustez, y el requisito («se imprimen en blanco y negro») apunta a robustez mientras la vara apunta a fidelidad. No lo decide el motor |

---

## Trampas

Lo que ya costó una conclusión falsa. Se lee **antes** de medir.

1. **El PDF que acompaña al `.docx` de referencia lo produjo LibreOffice**, no Word. Tiene
   otra caja de página, y en dos columnas LibreOffice **cambia el orden del contenido**, no
   sólo la paginación. Para juzgar tipografía, el único render real de Word es el del
   borrador de 22-09.
2. **Un render de LibreOffice esconde defectos de Word enteros.** Una sección de una columna
   con `<w:col w:w="8838"/>` encoge todo su texto al 82,9 % en Word y LibreOffice lo ignora.
   Hubo un bloque de consentimiento que **desapareció en Word** y nadie lo vio porque
   LibreOffice sí lo pintaba.
3. **La literalidad se verifica en el artefacto, nunca en el modelo.** El modelo conservaba
   `De 5* a 10*`, el warning decía «conservada tal cual», y el papel imprimía `De 5 a 10`:
   los renderers re-limpiaban al dibujar. 216 aserciones en verde sobre el bug.
4. **Leer OOXML con regex se para en el `/>` del primer hijo.** Un `<w:cols num="2">` con dos
   `<w:col>` parecía tener uno solo. Se parsea con un parser.
5. **El archivo de referencia cambia bajo la sesión.** Cambió a las 11:13 tras una copia de
   las 10:25, con md5 distinto. Comprobar el hash antes de citar una medida.
6. **Contar páginas no es medir.** Y el umbral de holgura al pie de 40 pt **reprobaría al
   documento objetivo**: nueve de sus once páginas están por debajo. En dos columnas el
   texto fluye hasta llenar la página.
7. **Revert in-process da falso verde.** Sobrescribir bindings del namespace para probar que
   un test distingue: `test_file` recarga y el test sale en verde. Copiar el paquete entero.
8. **No comparar el artefacto de un fixture con el plan de otro.** Fabrica defectos que no
   existen; el síntoma es que los índices del plan no caben en el modelo medido.
9. **`cantSplit` en un tramo de dos columnas hace que LibreOffice DESCARTE filas**, no que
   las pase a la columna siguiente. Estaban en el `document.xml` y no llegaban al PDF.

## Lo aprendido de ítems que aún no se tocan

- **L8 (opciones horizontales)**: en la referencia sólo se usa para opciones muy cortas
  (`Femenino | 1 | Masculino | 2 | Otro | 3`). Las listas largas siguen en vertical. El
  criterio de corte parece ser el mismo que el del §2: ancho medido.
- **L5**: la columna del número mide ~276 twips en la matriz de la P7 (`tblGrid`
  `[276, 4814, 826, ...]`), y la etiqueta se lleva 4 814 de 10 660 — `frac ≈ 0,45`, frente
  al 0,60 del motor. Ése es el origen del L11: el motor da más a la etiqueta y menos a la
  escala.
- **L7**: la banda de sección de la referencia **no** cruza el medianil en páginas a dos
  columnas: va dentro de su columna, a media página. Confirmado en la página 10.
