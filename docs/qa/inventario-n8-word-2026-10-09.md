# N8 — Word completo: inventario y hitos (2026-10-09)

La norma es `docs/qa/motor-ppt-2026-10-06/4-recetario/propuesta-word.docx`: 81 páginas A4 y 12 secciones, con 96 campos
`SEQ Gráfico`, 11 `SEQ Tabla` y 3 TOC (`\o "1-2"`, `\c "Gráfico"` y `\c "Tabla"`). La generan los archivos de
`docs/qa/motor-ppt-2026-10-06/herramientas/`:

- **RW**: `recetario_word.R`
- **RI**: `recetario_word_identidad.R`
- **RG**: `recetario_word_graficos.R`
- **WN**: `word_nativo.py`

El motor actual es **RPW**: `api/R/reporte_plan_word.R` (549 líneas) más `api/R/docx_conformar.R`. Arma el documento
desde el `render_meta` de `reporte_ppt_plan(solo_lista = TRUE)`.

Cuando el recetario se contradice consigo mismo, manda lo dibujado, como en N7. Hay dos casos:

- La tabla de estilos dice «Base y fuente… cursiva» (RW:265), pero el estilo es recto (RI:25-26, p14).
- El alto de la brecha entre dos públicos es fijo (RW:380-402).

## 1. Piezas: recetario frente al motor

| Pieza | Recetario | Medidas | Motor hoy | Pág. |
|---|---|---|---|---|
| Página | RI:53-55 | A4: `pgSz` 11909×16834. Márgenes de 1.1 in arriba, 0.9 in abajo y 1.0 in a los lados; encabezado y pie a 0.4 in; ancho útil 6.27 in | Plantilla de officer con márgenes de 2.5 cm (RPW:387) | todas |
| Estilos | RI:17-43 | h1 18 pt navy, negrita, con filete inferior · h2 12.5 pt · «Rótulo de gráfico» 10 pt, keepNext · «Número de rótulo» 10 pt navy, negrita · «Base y fuente» 8.5 pt #5A6480, centrado · «Lectura» 10.5 pt justificado, interlineado 1.3 · toc 1/2 | No existen: todo es formato directo (RPW:316-328, 110-115) | 15 |
| Ajustes nativos | WN:49-83 | `updateFields`, idioma es-PE, widowControl, sangría francesa en «Referencia», sin autoHyphenation | `docx_conformar.R` cubre WN:85-107; **falta WN:49-83** | — |
| Numeración | RW:31-38, RI:51 | Rótulo con `SEQ Gráfico \* ARABIC` y estilo «NumeroRotulo»; folio con campo `PAGE`, 8.5 pt | Texto fijo «Gráfico Nº 3.» (RPW:355-362) | 9, 14 |
| Portada A | RI:71-79 (B 80-89, C 90-101) | Título 28 pt navy y filete coral de 0.9 in × 2.5 pt; logos de 0.5 in en `titlePg` | `title_doc`: tres párrafos de 12 pt (RPW:409-426) | 1; 72-74 |
| Índices | RW:132-138 | «Contenido» con `block_toc(level = 2)` más índice de gráficos y de tablas, cada uno con `seq_id` | `body_add_toc` desactivado por defecto (RPW:119) | 3; 75-76 |
| Sección por capítulo | RW:70-73, RI:57-58 | Cada capítulo cierra en una `nextPage` con su encabezado escrito; sin STYLEREF | No existe | — |
| Encabezado y pie | RI:47-51 | Título corto y capítulo a 8 pt con filete #D5D9DF; `PAGE` a la derecha | No existe | 8 |
| Apertura B | RI:134-146 | Número 60 pt #C9D3E6, h1, entrada 11.5 pt y lista de secciones en flextable | `section`: heading más intro, sin página nueva (RPW:429-451) | 4, 9, 13… |
| Figura | RW:39-66 | Rótulo «Gráfico N» con título en cursiva · PNG de 300 dpi y 6.27 in, fondo transparente · base centrada · lectura con cifras en negrita | Título centrado, PNG de 6.1 in con fondo blanco, base directa; **`entry$note` se pierde** | 14, 20 |
| Franja de cifras | RW:321-326 | Cifra 24 pt y rótulo 9 pt | No existe | 20 |
| Tablas | RW:75-89 | Ancho 6.27 in, filetes navy, cuerpo 9.5 pt, «Tabla N» con SEQ | Se emite `technical_table` sin datos y Word la descarta (RPW:454) | 50-52 |
| «Cómo leer» | RW:185-228, RI:151-160 | Top Two Box y Bottom Two Box, redondeo, redacciones de la escala, cifras chicas y recuadro #F3F5F8 | No existe: `top_two_box` y `redondeo` no emiten render_meta | 9-12 |
| Contraportada | RI:162-167 | Logo PULSO de 1.0 in centrado y contacto a 8.5 pt | `cierre` no emite render_meta | 81 |

## 2. El render_meta

Hoy existen cuatro kinds:

- `title_doc`
- `section`
- `chart`, normal y de bloque multiactor. El de bloque multiactor no lleva `note`.
- `technical_table`, que sólo trae `title` y `nrow`.

Las especificaciones **sí llegan**: `attr(entry$plot_word, "pulso_espec")`.

Lo que falta:

1. **`slide_i` en cada entrada.** Se agrega en la misma línea de los cinco literales (`reporte_plan_ppt.R` 4011, 4089,
   7513, 8233 y 8341), porque el archivo está congelado en 9817 líneas.
2. **El resto se lee del plan**, que `reporte_ppt_plan` ya devuelve en `ppt_result$plan`: índice, Top Two Box, redondeo,
   texto, narrativas (fuente de la lectura), cierre y filas de la tabla técnica.
3. **Un nivel de capítulo unificado** (`meta$nivel` frente a `word_heading_level`). Se reutiliza
   `.lam_secciones_numeradas()`.

`alto_word_sugerido` es incoherente: da 1.36 in con 2 filas y 2.95 in con 1. El recetario pide 1.2 + 0.36·n − 0.22.

## 3. Figuras por especificación

El ADR 0093 pide un renderer ggplot propio con la geometría Word, alimentado por la especificación. El despachador
`.word_figura(entry)` usa el renderer de su tipo si existe; si no, usa `plot_word` con fondo transparente y piso de 8 pt.

**Correspondencia de tipos con RG:**

| Especificación | Renderer del recetario |
|---|---|
| `escala` | `g_apilada` |
| `categorica` | `g_barras`, `g_columnas`, `g_lollipop`, `g_sino` |
| `divergentes` | `g_divergente` |
| `pesas` y `serie2` | `g_dos_grupos` |
| `histograma` | `g_hist` |
| `boxplot` | `g_boxplot` |
| `media_rango` | `g_rango` |
| `numerico` | `g_promedios` |
| `heatmap_dim` | `g_heat` |
| `radar` | `g_radar` más tabla |
| `pie` | `g_torta` |
| `mapa` | `g_mapa` |
| `ggplot_marco` | el ggplot con `tema_w` |

**Altos:**

- Apilada: 1.2 + 0.36·filas − 0.22.
- Barras: 0.75 + 0.27·filas − 0.22.
- Fijos por tipo (RW:312-465): dicotomía 1.5, histograma 2.5, radar 3.4, mapa de 3.8 a 4.4, etc.

Todos estos altos se exportan como tokens Word en `exportar_estandar.R` y `estandar_pulso.json`.

**Brecha del dumbbell, que es obligatoria:**

- El ggplot hace `.b − .a` (`graficador_dumbbell.R:141`).
- La especificación, la lámina nativa y el recetario hacen a − b (RG:149; en p30, 99 − 96 = +3).
- Por eso el Word y el respaldo PPT muestran el signo contrario.
- El arreglo es un cambio de contrato: `test-graficos-ola4-metodologia.R:215-225` pasa de esperar 80 a esperar −80.
  Pasa por `guardian-contratos` y `revisor-metodologico`.

## 4. Hitos (una pieza, un test y un par con su página)

| Hito | Pieza | Par |
|---|---|---|
| N8.0 | Banco de pares Word (`scripts/qa_pares_word.R`), tokens Word y logos como assets | — |
| N8.1 | `reporte_word_identidad.R`: estilos (id resuelto por nombre) y página A4 | 2 |
| N8.2 | `.docx_conformar(revista = TRUE)` con WN:49-83 y test con `validate.py` local | — |
| N8.3 | Secciones por capítulo, encabezado y pie | 4, 8 |
| N8.4 | `reporte_word_figura.R`: rótulo con SEQ, base y lectura | 14, 20 |
| N8.5 | Alto por filas, 6.27 in, fondo transparente y piso de 8 pt | 19, 23 |
| N8.6 | Renderer `escala` | 12, 14, 23, 24, 43, 47 |
| N8.7 | `categorica`, dicotomía, lollipop y divergentes | 22-29 |
| N8.8 | Números y brecha a − b | 26, 27, 29, 30 |
| N8.9 | Dimensiones, radar con tabla, torta, mapa y marco | 25, 30-41 |
| N8.10 | Tablas (tabla técnica desde `slots$filas`) y franja de cifras | 33, 50-52 |
| N8.11 | Portada A e índices | 1, 3, 75 |
| N8.12 | Aperturas B | 4, 9, 78 |
| N8.13 | «Cómo leer» | 9-12, 79 |
| N8.14 | Contraportada desde `p_slide_cierre` | 81 |
| N8.15 | `reporte_plan_word.R` como fachada, el job, reinstalación, Word de `acrconta` y `acnur_acg`, y verificador | integral |

**Archivos nuevos** (en `api/R/`):

- `reporte_word_documento.R`
- `reporte_word_identidad.R`
- `reporte_word_figura.R`
- `reporte_word_graficos_{escala,categorica,numericos,otros}.R`
- `reporte_word_como_leer.R`

**Riesgos:**

- `reporte_plan_ppt.R` está congelado: sólo se admiten ediciones en la misma línea.
- La firma de `w_presets()`: todo argumento nuevo lleva default.
- El frontend persiste `size_ejes 7`, que queda bajo el piso de 8 pt.
- `on_complete` del job espera `n_slides`.
- El job callr exige reinstalar el paquete.
- El S3 `to_wml` necesita `@exportS3Method`, o usar `officer::run_seqfield`.
- No hay plantilla docx en `inst/`: se usa la de officer, con ids en francés y resueltos por nombre.
- officer y flextable difieren entre `renv.lock` y el R local.
- `updateFields` sólo va en el informe.

## 5. Comparar página por página

1. Convertir con `soffice --headless --convert-to pdf`.
2. Rasterizar con `pdftoppm -r 70 -f N -l N`.
3. Componer el recetario y el motor en paralelo.

El PDF del recetario ya está rasterizado en el scratchpad de la sesión (`n8/receta/`). LibreOffice no llena los TOC,
así que los índices se verifican por XML. En Word real sólo puede abrirlos Gonzalo.
