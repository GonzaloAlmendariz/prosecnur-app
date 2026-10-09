# Propuesta de diseño de los informes cuantitativos de PULSO PUCP en Word (2026-10-08). Reemplaza al recetario en Word fiel y
# moderno: una sola guía, con el foco del Word (pedido de Gonzalo: «el Word tiene que tener otro enfoque, pero mostrar todas las
# gráficas que se puedan insertar, con la propia lógica del Word: sus márgenes y sus tamaños»). No lleva banco de íconos ni de
# formas ni tipos de lámina. Los gráficos van como imagen PNG a 300 dpi, igual que el motor de Word de la app.
# Uso (desde la raíz del repo):
#   SP=<datos> LOGOS=<media de la plantilla PPT> SALIDA=<docx> [MAZO=<recetario-moderna.pptx>] Rscript docs/qa/motor-ppt-2026-10-06/herramientas/recetario_word.R
Sys.setlocale("LC_ALL", "en_US.UTF-8")
suppressMessages({ library(officer); library(flextable); library(ggplot2) })
`%||%` <- function(a, b) if (is.null(a)) b else a
SP <- Sys.getenv("SP"); LOGOS <- Sys.getenv("LOGOS"); ESTILO <- "moderna"; MOD <- TRUE
MAZO <- Sys.getenv("MAZO", "docs/qa/motor-ppt-2026-10-06/4-recetario/recetario-moderna.pptx")
D <- readRDS(file.path(SP, "datos_muestra.rds")); CONTA <- readRDS(file.path(SP, "src_conta.rds")); NB <- readRDS(file.path(SP, "nube_ing.rds"))
source("docs/qa/motor-ppt-2026-10-06/herramientas/recetario_word_graficos.R", local = TRUE)
fr <- function(b, v) {
  sv <- CONTA$inst_sources[[b]]$survey; ch <- CONTA$inst_sources[[b]]$choices; lc <- function(df) grep("^label", names(df))[1]
  row <- sv[!is.na(sv$name) & sv$name == v, ][1, ]; cc <- ch[!is.na(ch$list_name) & ch$list_name == row$list_name, ]
  d <- as.character(CONTA$data_sources[[b]][[v]]); d <- d[!is.na(d) & d != ""]; n <- as.integer(table(factor(d, levels = cc$name)))
  list(pregunta = row[[lc(sv)]], labels = cc[[lc(ch)]], n = n, valid = length(d), pct = round(100 * n / length(d)))
}
ROT <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "Sin información")
FONT <- "Arial"; NAVY <- "#002060"; CORAL <- "#CA5651"; SOFT <- "#5A6480"; TXT <- "#26303F"
# Línea sobria para un informe formal (Gonzalo, 2026-10-08: «una línea visual demasiado ecléctica para un Word de informe formal»):
# azul oscuro sobre blanco, texto corrido en gris muy oscuro, y el coral sólo como un filete corto en la portada.
TMP <- tempfile("recw_"); dir.create(TMP)

tx <- function(s, size = 10.5, color = TXT, bold = FALSE, italic = FALSE) ftext(s, fp_text(font.family = FONT, font.size = size, color = color, bold = bold, italic = italic))
parr <- function(doc, ..., align = "left", after = 8, before = 0, keep = FALSE) body_add_fpar(doc, fpar(..., fp_p = fp_par(text.align = align, padding.bottom = after, padding.top = before, line_spacing = 1.3, keep_with_next = keep)))
cuerpo <- function(doc, t, keep = FALSE) parr(doc, tx(t), keep = keep, align = "justify")   # texto corrido justificado
# ---- Elementos nativos de Word: todo lo que pone el motor es un estilo o un campo de Word (la posedición se hace desde
# Inicio > Estilos y la numeración se recalcula con F9).
xml_esc <- function(x) gsub(">", "&gt;", gsub("<", "&lt;", gsub("&", "&amp;", x, fixed = TRUE), fixed = TRUE), fixed = TRUE)
rpr_est <- function(sty) if (is.null(sty)) "" else sprintf('<w:rPr><w:rStyle w:val="%s"/></w:rPr>', sty)
run_est <- function(t, sty) structure(list(t = t, sty = sty), class = c("run_est", "run"))
seq_run <- function(id, n, sty = NULL) structure(list(id = id, n = n, sty = sty), class = c("seq_pulso", "run"))
registerS3method("to_wml", "run_est", function(x, add_ns = FALSE, ...) sprintf('<w:r>%s<w:t xml:space="preserve">%s</w:t></w:r>', rpr_est(x$sty), xml_esc(x$t)), envir = asNamespace("officer"))
registerS3method("to_wml", "seq_pulso", function(x, add_ns = FALSE, ...) { r <- rpr_est(x$sty)
  paste0('<w:r>', r, '<w:fldChar w:fldCharType="begin"/></w:r><w:r>', r, '<w:instrText xml:space="preserve"> SEQ ', x$id, ' \\* ARABIC </w:instrText></w:r>',
         '<w:r>', r, '<w:fldChar w:fldCharType="separate"/></w:r><w:r>', r, '<w:t>', x$n, '</w:t></w:r><w:r>', r, '<w:fldChar w:fldCharType="end"/></w:r>') }, envir = asNamespace("officer"))
lectura_runs <- function(texto) {   # «Lectura»: las cifras en negrita, el resto con el estilo
  pos <- gregexpr("[0-9]+([.,][0-9]+)*( ?%| pts| puntos)?", texto)[[1]]; ch <- list(); k <- 1
  if (pos[1] > 0) for (i in seq_along(pos)) { a <- pos[i]; b <- a + attr(pos, "match.length")[i] - 1
    if (a > k) ch[[length(ch) + 1]] <- ftext(substr(texto, k, a - 1))
    ch[[length(ch) + 1]] <- ftext(substr(texto, a, b), fp_text_lite(bold = TRUE)); k <- b + 1 }
  if (k <= nchar(texto)) ch[[length(ch) + 1]] <- ftext(substr(texto, k, nchar(texto)))
  ch
}
# Rótulo arriba, en una línea: «Gráfico 5.» (campo SEQ) y la pregunta, con el estilo «Rótulo de gráfico».
# Con la etiqueta SEQ, Word arma solo el índice de gráficos y el de tablas (Referencias > Insertar tabla de ilustraciones).
# Convención de revista (APA, 7.ª ed.): «Gráfico 5» en negrita y, en la línea siguiente, el título en cursiva. Word arma con el campo SEQ el índice.
rotulo <- function(doc, etiqueta, id, n, titulo) body_add_fpar(doc, fpar(run_est(paste0(etiqueta, " "), "NumeroRotulo"), seq_run(id, n, "NumeroRotulo"), run_linebreak(), ftext(titulo, fp_text_lite(italic = TRUE))), style = "Rótulo de gráfico")
base_fuente <- function(doc, t, keep = FALSE) body_add_fpar(doc, fpar(ftext(t)), style = if (keep) "Base y fuente con lectura" else "Base y fuente")   # con lectura, la nota no se separa de ella   # base y fuente, centradas bajo el gráfico y sin la palabra «Nota» (Gonzalo, 2026-10-08)
GN <- 0; TN <- 0
# Figura: rótulo, imagen del ancho del texto, base y fuente como párrafo propio (editable) y, si hay, el párrafo de lectura.
grafico <- function(doc, titulo, g, alto, texto = NULL, base = NULL) {
  GN <<- GN + 1
  cap <- g$labels$caption %||% ""; g <- g + labs(caption = NULL)
  base <- base %||% sub("^N = ", "Base: ", gsub("\n", " ", cap))
  doc <- rotulo(doc, "Gráfico", "Gráfico", GN, titulo)
  alto <- max(alto, attr(g, "alto") %||% 0) - 0.22   # el pie ya no va dentro de la imagen
  ancho <- attr(g, "ancho") %||% ANCHO_W   # un mapa mide lo que mide su dibujo con la leyenda
  f <- file.path(TMP, sprintf("g%03d.png", GN)); ggsave(f, g, width = ancho, height = alto, dpi = 300, bg = "transparent")
  doc <- body_add_fpar(doc, fpar(external_img(f, width = ancho, height = alto), fp_p = fp_par(text.align = "center", keep_with_next = TRUE)))   # centrado: la nota queda centrada bajo el gráfico
  doc <- base_fuente(doc, base, keep = !is.null(texto))
  if (!is.null(texto)) doc <- body_add_fpar(doc, do.call(fpar, lectura_runs(texto)), style = "Lectura")
  doc
}
imagen <- function(doc, f, alto, ancho = ANCHO_W) body_add_fpar(doc, fpar(external_img(f, width = ancho, height = alto), fp_p = fp_par(text.align = "center", keep_with_next = TRUE)))
CAPN <- 0; SUBN <- 0
CAP_PREV <- NULL
capitulo <- function(doc, t, intro = "") { CAPN <<- CAPN + 1; SUBN <<- 0   # cada capítulo abre en página nueva, con su número grande y claro (apertura B)
  doc <- if (is.null(CAP_PREV)) cerrar_seccion(doc, "", con_portada = TRUE) else cerrar_seccion(doc, CAP_PREV)   # la sección anterior queda con su encabezado
  CAP_PREV <<- t
  apertura_B(doc, CAPN, t, intro) }
seccion <- function(doc, t) { SUBN <<- SUBN + 1; body_add_par(doc, sprintf("%d.%d. %s", CAPN, SUBN, t), style = "heading 2") }
poner_tabla <- function(doc, ft, zebra = FALSE) {   # sin cebra: filetes horizontales finos, como un informe formal
  w <- dim(ft)$widths; ft <- width(ft, j = seq_along(w), width = w * ANCHO_W / sum(w))   # toda tabla mide el ancho útil exacto
  ft <- ft |> bg(bg = "transparent", part = "header") |> color(color = NAVY, part = "header") |> fontsize(size = 8.5, part = "header") |>
    border_remove() |> hline_top(border = fp_border(color = NAVY, width = 1.25), part = "header") |> hline_bottom(border = fp_border(color = NAVY, width = 0.75), part = "header") |>
    hline(border = fp_border(color = "#D5D9DF", width = 0.5), part = "body") |> hline_bottom(border = fp_border(color = NAVY, width = 0.75), part = "body") |>
    padding(j = 1, padding.left = 0, part = "all")
  if (zebra && nrow_part(ft, "body") > 2) ft <- bg(ft, i = seq(2, nrow_part(ft, "body"), 2), bg = "#F3F5F8", part = "body")
  body_add_flextable(doc, paginate(ft, init = TRUE, hdr_ftr = TRUE), align = "left")
}
ft_base <- function(df, anchos, size = 9.5) { ft <- flextable(df) |> font(fontname = FONT, part = "all") |> fontsize(size = size, part = "all") |> color(color = TXT, part = "all") |>
  bold(part = "header") |> bold(j = 1) |> padding(padding.top = 4, padding.bottom = 4, part = "all") |> valign(valign = "top", part = "body")
  for (j in seq_along(anchos)) ft <- width(ft, j = j, width = anchos[j]); ft }
tabla <- function(doc, titulo, ft, base = NULL, zebra = FALSE) { TN <<- TN + 1
  doc <- rotulo(doc, "Tabla", "Tabla", TN, titulo); doc <- poner_tabla(doc, ft, zebra)
  if (!is.null(base)) base_fuente(doc, base) else body_add_par(doc, "") }
tabla_guia <- function(doc, df, anchos) { doc <- poner_tabla(doc, ft_base(df, anchos)); body_add_par(doc, "") }   # tablas de la guía, sin numerar
lista <- function(doc, items) { for (r in items) doc <- body_add_fpar(doc, fpar(tx(paste0("•  ", r))), style = "Lista de la guía"); doc }
cita <- function(doc, ref) body_add_fpar(doc, do.call(fpar, ref), style = "Referencia")

# ---------------- documento, estilos y página (recetario_word_identidad.R)
source("docs/qa/motor-ppt-2026-10-06/herramientas/recetario_word_identidad.R", local = TRUE)
doc <- nuevo_doc()   # la última sección (contraportada) va sin encabezado
cm <- function(x) format(round(x * 2.54, 2), nsmall = 2)

# Láminas del PPT como imagen, para mostrar cómo pasa una lámina al Word (capítulo 2). Se buscan por su título.
PPT_IMG <- list()
if (file.exists(MAZO)) {
  system2("soffice", c("--headless", "--convert-to", "pdf", "--outdir", shQuote(TMP), shQuote(MAZO)), stdout = FALSE, stderr = FALSE)
  pdf_ <- file.path(TMP, sub("\\.pptx$", ".pdf", basename(MAZO)))
  idx <- system2("python3", c("-c", shQuote(paste0("import zipfile,re,sys\nz=zipfile.ZipFile(sys.argv[1]);p=z.read('ppt/presentation.xml').decode();r=z.read('ppt/_rels/presentation.xml.rels').decode()\n",
    "t=dict(re.findall(r'Id=\"(rId\\d+)\"[^>]*Target=\"([^\"]+)\"',r));t.update({b:a for a,b in re.findall(r'Target=\"([^\"]+)\"[^>]*Id=\"(rId\\d+)\"',r)})\n",
    "for n,i in enumerate(re.findall(r'<p:sldId id=\"\\d+\" r:id=\"(rId\\d+)\"',p),1):\n  a=re.findall(r'<a:t>([^<]*)</a:t>',z.read('ppt/'+t[i]).decode())[:2]\n  print(str(n)+'\\t'+' / '.join(a))")), shQuote(MAZO)), stdout = TRUE)
  idx <- do.call(rbind, strsplit(idx, "\t")); PPT_IDX <- setNames(as.integer(idx[, 1]), idx[, 2])
  ppt_img <- function(clave) { n <- PPT_IDX[[clave]]; o <- file.path(TMP, sprintf("ppt_%03d", n))
    system2("pdftoppm", c("-png", "-r", "150", "-f", n, "-l", n, "-singlefile", shQuote(pdf_), shQuote(o))); paste0(o, ".png") }
}
lamina_ppt <- function(doc, clave, pie) {   # la lámina del PPT, con un marco fino, y lo que es
  if (!exists("ppt_img") || !clave %in% names(PPT_IDX)) return(doc)
  f <- ppt_img(clave); im <- magick::image_border(magick::image_read(f), "#D5D9DF", "3x3"); magick::image_write(im, f)
  doc <- body_add_fpar(doc, fpar(tx("EN EL PPT", 8, SOFT, TRUE)), style = "Rótulo de gráfico")
  doc <- imagen(doc, f, ANCHO_W * 9 / 16); base_fuente(doc, pie)
}
en_word <- function(doc) body_add_fpar(doc, fpar(tx("EN EL WORD", 8, SOFT, TRUE), fp_p = fp_par(padding.top = 8, keep_with_next = TRUE)))

# ---------------- portada, contenido e índices: la portada sola en su página (antes el índice la compartía)
doc <- portada_A(doc, list(ante = "PROPUESTA DE DISEÑO", titulo = "Los informes cuantitativos de PULSO PUCP en Word", sub = "La página, los estilos, cada gráfico y cada tabla en su formato de Word",
                           por = "PULSO PUCP", fecha = "Octubre de 2026"))
doc <- body_add_break(doc)
# Resumen y palabras clave, como en un artículo de revista; el contenido empieza en la página siguiente
doc <- parr(doc, tx("Resumen", 12.5, NAVY, TRUE), after = 6)
doc <- cuerpo(doc, paste("Esta propuesta define cómo se diagraman los informes cuantitativos de PULSO PUCP en Word y acompaña a la propuesta de diseño en PPT.",
  "Presenta la estructura del documento y sus partes, las reglas de página y de estilo, la traducción de las láminas del PPT a figuras de Word,",
  "los gráficos del motor con su rótulo, su nota y su lectura, las situaciones de datos más frecuentes, las tablas y un ejemplo por tipo de estudio.",
  "Los rótulos, las notas y las referencias siguen las convenciones editoriales de la American Psychological Association (2020).",
  "El capítulo de acreditación usa los datos del proyecto de referencia. Los demás usan cifras ficticias."))
doc <- parr(doc, tx("Palabras clave: ", 10.5, NAVY, TRUE), tx("diseño de informes, visualización de datos, encuestas, identidad visual, Word"), after = 14)
doc <- body_add_break(doc)
doc <- parr(doc, tx("Contenido", 18, NAVY, TRUE), after = 10)
doc <- body_add(doc, block_toc(level = 2))
doc <- parr(doc, tx("Índice de gráficos", 13, NAVY, TRUE), before = 16, after = 6)
doc <- body_add(doc, block_toc(seq_id = "Gráfico"))
doc <- parr(doc, tx("Índice de tablas", 13, NAVY, TRUE), before = 16, after = 6)
doc <- body_add(doc, block_toc(seq_id = "Tabla"))
doc <- parr(doc, tx("Los índices son campos de Word: se actualizan con clic derecho > Actualizar campos, o seleccionando todo y presionando F9.", 8.5, SOFT, FALSE, TRUE), before = 8)

# ================= 1. El documento (W5 a W7): estructura, portada, índices, aperturas, encabezado y cierre
doc <- capitulo(doc, "El documento", paste("Cómo se ordena un informe de PULSO en Word y cómo se ve cada una de sus partes. La propuesta parte de los informes entregados entre 2022 y 2026:",
  "conserva su orden y resuelve lo que se repetía en ellos, como la numeración de gráficos hecha a mano, la falta de índices de gráficos y de tablas y los capítulos que empezaban a mitad de página."))
doc <- seccion(doc, "Estructura del informe")
doc <- cuerpo(doc, "Todo informe cuantitativo sigue el mismo orden. Lo que cambia según el tipo de estudio es cómo se agrupan los resultados.", keep = TRUE)
doc <- tabla_guia(doc, data.frame(Parte = c("Portada", "Índices", "Introducción", "Diseño metodológico", "Perfil de los participantes", "Resultados", "Conclusiones y recomendaciones", "Anexos", "Contraportada"),
  `Qué lleva` = c("Tipo de informe, título, subtítulo, quién lo elabora y la fecha. Sola en su página", "Contenido, índice de gráficos e índice de tablas, en página propia",
                  "Qué se pidió, el objetivo y cómo se organiza el documento", "Ficha técnica, población, muestra, trabajo de campo, procesamiento y el recuadro «Cómo leer este informe»",
                  "Quiénes respondieron, por público", "Un capítulo por dimensión o por tema, cada uno abierto con su número y su mapa de secciones",
                  "Hallazgos por dimensión y recomendaciones que se desprenden de ellos", "Instrumentos, tablas técnicas y cruces, con numeración propia (A, B, C)", "Logo y contacto de PULSO PUCP"),
  `Según el estudio` = c("Con encargo externo, la versión C, con «Elaborado para»", "Siempre los tres", "", "En acreditación, la matriz del modelo de acreditación",
                         "", "Acreditación: dimensión, factor y criterio del modelo. Otros estudios: por tema, índice o grupo de comparación", "En acreditación, agrupadas por dimensión", "", ""), check.names = FALSE), c(1.55, 2.95, 1.77))
mn_ <- c(mini("portada_A", function(d) portada_A(d)), mini("portada_B", function(d) portada_B(d)), mini("portada_C", function(d) portada_C(d)),
         mini("indice_A", function(d) indice_A(d)), mini("indice_B", function(d) indice_B(d)),
         mini("apertura_A", function(d) { d <- apertura_A(d, 4, "Dimensión 1: Propósitos de la carrera", "Este capítulo presenta cómo conocen y valoran los públicos la misión y los propósitos de la carrera.")
           d <- seccion_ej(d) }),
         mini("apertura_B", function(d) { d <- apertura_B(d, 4, "Dimensión 1: Propósitos de la carrera", "Este capítulo presenta cómo conocen y valoran los públicos la misión y los propósitos de la carrera.",
           c("4.1. Misión y propósitos", "4.2. Gestión y planificación", "4.3. Normativa interna")); seccion_ej(d) }),
         mini("interior", function(d) { d <- body_add_break(d); d <- apertura_A(d, 2, "Diseño metodológico", "El estudio se hizo con una encuesta en línea a cuatro públicos."); recuadro(d, "Cómo leer este informe", LEER_EJ) }),
         mini("contraportada", function(d) contraportada(d), derecha = NULL))
png_ <- mini_png(mn_[1:6]); png2_ <- mini_png(mn_[7]); png_int <- mini_png(mn_[8], pagina = 2); png_ctr <- mini_png(mn_[9], pagina = 1)
doc <- seccion(doc, "Portada")
doc <- cuerpo(doc, "Cada alternativa se ve a página completa en el anexo. La portada va sola en su página, alineada a la izquierda y sin bloques de color de fondo. Los logos van en su encabezado y no se repiten en el interior. El filete coral es el único acento de color del documento.", keep = TRUE)
doc <- galeria(doc, png_[1:3], c("A. Tipográfica (recomendada)", "B. Con banda lateral", "C. Con ficha del encargo"))
doc <- lista(doc, c("A es la portada por defecto: título grande, filete corto, subtítulo y, al pie, quién elabora y la fecha.",
  "B sirve para series de informes de un mismo estudio: la banda azul los identifica en el escritorio y en la impresión.",
  "C se usa cuando hay un encargo externo: «Elaborado para», «Elaborado por», fecha y versión en una tabla de filetes finos."))
doc <- seccion(doc, "Índices")
doc <- cuerpo(doc, "El índice va en página propia y lo arma Word con los títulos del documento. Le siguen el índice de gráficos y el de tablas, que también arma Word a partir de los rótulos numerados.", keep = TRUE)
doc <- galeria(doc, png_[4:5], c("A. Clásico, con la página a la derecha (recomendado)", "B. Con el número del capítulo en columna"), por_fila = 2)
doc <- lista(doc, c("A es el índice que Word genera con los estilos «toc 1» y «toc 2»: se actualiza solo y no hay que mantenerlo a mano.",
  "B es una tabla de Word para informes cortos o de difusión, donde el índice también presenta el contenido. Se mantiene a mano."))
doc <- seccion(doc, "Apertura de capítulo")
doc <- cuerpo(doc, "Cada capítulo empieza en página nueva. La apertura dice qué número es, cómo se llama, de qué trata y qué secciones tiene, y deja el resto de la página para el contenido.", keep = TRUE)
doc <- galeria(doc, c(png_[6], png2_), c("A. Sobria: antetítulo y título", "B. Número grande y mapa del capítulo (recomendada)"), por_fila = 2)
doc <- lista(doc, c("B es la apertura de este documento: el número en un azul muy claro, el título, una frase de entrada y la lista de secciones.",
  "A sirve para informes breves o para anexos, donde una apertura amplia ocuparía demasiado."))
doc <- seccion(doc, "Encabezado, pie y recuadros")
doc <- cuerpo(doc, "En el interior, el encabezado lleva el nombre del informe a la izquierda y el capítulo en curso a la derecha: cada capítulo es una sección de Word con su propio encabezado. El pie lleva sólo el número de página, a la derecha.", keep = TRUE)
doc <- galeria(doc, c(png_int, png_ctr), c("Página interior con el recuadro «Cómo leer este informe»", "Contraportada"), por_fila = 2)
doc <- lista(doc, c("El recuadro «Cómo leer este informe» va en el diseño metodológico: fondo gris muy claro, un filete azul arriba y tres o cuatro líneas.",
  "La contraportada cierra con el logo de PULSO PUCP al centro y el contacto en una línea."))

# ================= 2. Cómo leer este informe (Gonzalo, 2026-10-08: «falta todo lo que tenga que ver con cómo leer el informe en la parte de adelante del
# Word… el gráfico de cómo leer el Top Two Box, el gráfico del redondeo, que ya los tienen los PPT»). En un informe real, estas páginas van en el diseño metodológico.
doc <- capitulo(doc, "Cómo leer este informe", paste("Las páginas que explican al lector cómo leer las cifras del informe. En un informe real van al final del diseño metodológico, antes de los resultados,",
  "y se repiten iguales en todos los estudios: el Top Two Box y el Bottom Two Box, el redondeo, las escalas, las cifras pequeñas, las bases chicas y la información faltante."))
doc <- seccion(doc, "Top Two Box")
doc <- cuerpo(doc, "Es la suma de los dos valores superiores de la escala. Resume en una cifra el acuerdo de cada grupo y permite compararlo entre públicos y con mediciones de otros años.", keep = TRUE)
doc <- grafico(doc, "Cómo se calcula el Top Two Box", g_box_explica(c(5, 5, 35, 55), TRUE), 1.9)
doc <- seccion(doc, "Bottom Two Box")
doc <- cuerpo(doc, "Es la suma de los dos valores inferiores de la escala. Se usa cuando interesa el desacuerdo, por ejemplo para ubicar los aspectos que más críticas reciben. Va en naranja oscuro, al lado del Top Two Box.", keep = TRUE)
doc <- grafico(doc, "Cómo se calcula el Bottom Two Box", g_box_explica(c(12, 20, 41, 27), FALSE), 1.9)
doc <- seccion(doc, "Redondeo de las cifras")
doc <- cuerpo(doc, "Las cifras se muestran en enteros. Hay dos maneras de redondear y el informe dice cuál usa. Las dos tablas usan el mismo ejemplo: 1, 7, 60, 110 y 0 casos de 178.", keep = TRUE)
n_r <- c(1, 7, 60, 110, 0); ex_r <- 100 * n_r / sum(n_r); std_r <- floor(ex_r + 0.5); ent_r <- floor(ex_r); rest_r <- ex_r - ent_r
faltan_r <- 100 - sum(ent_r); suben_r <- order(-rest_r)[seq_len(faltan_r)]; res_r <- ent_r; res_r[suben_r] <- res_r[suben_r] + 1
cab_r <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "Sin información")
t_std <- as.data.frame(rbind(c("Valor exacto", sprintf("%.2f%%", ex_r), "100%"), c("Redondeo estándar", paste0(std_r, "%"), paste0(sum(std_r), "%"))))
names(t_std) <- c(" ", cab_r, "Suma")
doc <- cuerpo(doc, "Redondeo estándar. Cada porcentaje se redondea por separado: desde 0.5 sube y por debajo baja. Cada cifra queda lo más cerca posible de su valor exacto, pero la suma puede dar 99% o 101%.", keep = TRUE)
doc <- tabla(doc, "Redondeo estándar", ft_base(t_std, c(1.5, rep(0.85, 5), 0.6), size = 9) |> align(j = 2:7, align = "center", part = "all") |> bold(i = 2) |>
  color(i = 2, j = 7, color = CORAL) |> fontsize(size = 8.5, part = "header"),
  base = sprintf("Base: ejemplo de 178 casos. La suma queda en %d%% porque cada cifra se redondeó por su cuenta.", sum(std_r)))
t_rm <- as.data.frame(rbind(c("Valor exacto", sprintf("%.2f%%", ex_r), "100%"), c("Parte entera", paste0(ent_r, "%"), paste0(sum(ent_r), "%")),
  c("Resto decimal", sprintf("%.2f", rest_r), ""), c("Resultado", paste0(res_r, "%"), paste0(sum(res_r), "%"))))
names(t_rm) <- c(" ", cab_r, "Suma")
ft_rm <- ft_base(t_rm, c(1.5, rep(0.85, 5), 0.6), size = 9) |> align(j = 2:7, align = "center", part = "all") |> bold(i = 4) |> fontsize(size = 8.5, part = "header") |> color(i = 2, j = 7, color = CORAL)
for (j_ in suben_r) ft_rm <- ft_rm |> bg(i = 3:4, j = j_ + 1, bg = "#FBE3E2") |> color(i = 3:4, j = j_ + 1, color = CORAL)
doc <- cuerpo(doc, "Redondeo del resto mayor. Primero se toma la parte entera de cada porcentaje. Los puntos que faltan para llegar a 100 se dan, uno por uno, a las categorías con el resto decimal más grande. La suma siempre da 100%.", keep = TRUE)
doc <- tabla(doc, "Redondeo del resto mayor", ft_rm, base = sprintf("Base: ejemplo de 178 casos. Faltan %d puntos y van a los %d restos más grandes, marcados. El %.2f%% queda en %d%%.", faltan_r, faltan_r, ex_r[1], res_r[1]))
doc <- seccion(doc, "Una misma escala, muchas redacciones")
doc <- cuerpo(doc, "La redacción de la escala cambia según el estudio y el público, pero el color y el orden se mantienen: de lo negativo a lo positivo y, al final, en gris, la falta de información. El Top Two Box es siempre la suma de las dos respuestas más altas.", keep = TRUE)
esc_r <- data.frame(Escala = c("Acuerdo", "Satisfacción", "Importancia", "Utilidad", "Competencia"),
  `1` = c("Totalmente en desacuerdo", "Muy insatisfecho", "Nada importante", "Nada útil", "Nada competente"), `2` = c("En desacuerdo", "Insatisfecho", "Poco importante", "Poco útil", "Poco competente"),
  `3` = c("De acuerdo", "Satisfecho", "Importante", "Útil", "Competente"), `4` = c("Totalmente de acuerdo", "Muy satisfecho", "Muy importante", "Totalmente útil", "Totalmente competente"),
  `Al final, en gris` = c("Sin información", "No he usado el servicio", "Sin información", "Sin información", "Sin información"), check.names = FALSE)
ft_e <- ft_base(esc_r, c(1.1, 1.15, 1.0, 0.95, 1.15, 1.0), size = 8.5) |> align(j = 2:6, align = "center", part = "all")
for (j_ in 1:5) ft_e <- ft_e |> bg(j = j_ + 1, bg = c("#FBE3D3", "#FFF4CC", "#E6F1D8", "#D5E8C7", "#ECECEC")[j_], part = "header")
doc <- tabla(doc, "Redacciones de la escala y su color", ft_e, base = "Base: escalas usadas en los estudios de PULSO PUCP. El color de cada columna es el de su respuesta en los gráficos.")
doc <- seccion(doc, "Cifras muy pequeñas")
doc <- cuerpo(doc, "Si una cifra no cabe dentro de su color, sube sobre la barra con una línea guía. Si hay varias seguidas, se separan para no taparse, y la fila gana el aire que necesitan. Ninguna cifra se omite.", keep = TRUE)
doc <- grafico(doc, "Cifras pequeñas en distintas posiciones de la barra", g_apilada(list(list(actor = "Todas chicas salvo una", pct = c(2, 1, 93, 3, 1)), list(actor = "Chicas en los dos extremos", pct = c(1, 3, 47, 47, 2)),
  list(actor = "Tres chicas al inicio", pct = c(1, 2, 3, 40, 54)), list(actor = "Tres chicas al final", pct = c(30, 62, 2, 1, 5))), ROT, WTK$likert, envolver = 16, n_txt = "N = 120 casos de ejemplo. Cifras ficticias"), alto_apilada(4) + 0.4)
doc <- seccion(doc, "Bases chicas e información faltante")
doc <- lista(doc, c("Cuando un grupo tiene menos de 30 personas, junto al porcentaje va el número de casos, por ejemplo «12 de 15». Con tan pocos casos, una persona mueve varios puntos y no se comparan los grupos con pruebas de significancia.",
  "«Sin información» reúne a quienes no respondieron o respondieron «No sabe». Va al final de la barra, en gris, y cuenta en la base: así se ve cuántos no pudieron opinar.",
  "Cada gráfico dice su base debajo. Si una pregunta sólo se hizo a una parte, la base lo indica, por ejemplo «Base: 20 estudiantes que respondieron Sí en la pregunta anterior»."))
doc <- recuadro(doc, "Cómo leer este informe", c(LEER_EJ, "Las cifras se redondean al entero con el método del resto mayor, de modo que cada barra suma 100%."))

# ================= 3. Reglas del informe Word
doc <- capitulo(doc, "Reglas del informe Word", "La página, los estilos de Word, la escala tipográfica y los colores que comparten todos los informes. Siguen los principios de claridad y economía visual que proponen Few (2012) y Tufte (2001).")
doc <- seccion(doc, "La página")
doc <- cuerpo(doc, "El informe se arma en una página A4 vertical. El texto, los gráficos y las tablas ocupan el mismo ancho útil, de modo que todo queda alineado con los márgenes.", keep = TRUE)
# Esquema de la página medido: márgenes, encabezado, rótulo, gráfico, base y lectura
g_pagina <- function() { W_ <- 21; H_ <- 29.7; ml <- 2.54; mt <- 2.79; mb <- 2.29; xr <- W_ - ml; Lx <- W_ + 1.2
  bl <- data.frame(x0 = c(ml, ml, ml, ml, ml + 0.3, ml, ml), x1 = c(xr, xr, xr - 6, xr, xr, xr - 7, xr), y0 = H_ - c(1.0, 3.6, 6.6, 7.4, 13.9, 14.3, 15.2),
    y1 = H_ - c(2.3, 4.6, 7.2, 13.6, 14.15, 14.6, 17.0), f = c("#E9EDF4", "#C9D3E6", "#C9D3E6", "#E9EDF4", "#C9D3E6", "#C9D3E6", "#F3F5F8"))
  et <- data.frame(y = H_ - c(1.65, 4.1, 6.9, 10.5, 14.45, 16.1, 28.2), t = c("Encabezado: informe y capítulo en curso", "Título del capítulo", "Rótulo: «Gráfico 5.» y la pregunta",
    "Gráfico: 15.93 cm de ancho, sin fondo", "Base y fuente", "Lectura, en texto corrido", "Pie: nombre del informe y página"))
  ggplot() + annotate("rect", xmin = 0, xmax = W_, ymin = 0, ymax = H_, fill = "#FFFFFF", colour = "#B8C2D3", linewidth = 0.4) +
    annotate("rect", xmin = ml, xmax = xr, ymin = mb, ymax = H_ - mt, fill = NA, colour = "#8E9DBD", linewidth = 0.3, linetype = "dashed") +
    geom_rect(data = bl, aes(xmin = x0, xmax = x1, ymin = y0, ymax = y1, fill = f)) + scale_fill_identity() +
    annotate("segment", x = xr + 0.15, xend = Lx - 0.2, y = et$y, yend = et$y, colour = "#B8C2D3", linewidth = 0.3) +
    annotate("text", x = Lx, y = et$y, label = et$t, hjust = 0, size = 8.5 / .pt, colour = NAVY, family = "Arial") +
    annotate("text", x = W_ / 2, y = -1.1, label = "21 cm. Márgenes de 2.54 cm a los lados, 2.79 cm arriba y 2.29 cm abajo", size = 8 / .pt, colour = SOFT, family = "Arial") +
    coord_fixed(xlim = c(-0.5, 44), ylim = c(-2, H_ + 0.5), expand = FALSE) + theme_void() + labs(caption = "Base: esquema medido de una página del informe. Fuente: PULSO PUCP 2026.") }
doc <- grafico(doc, "La página del informe y sus partes", g_pagina(), 4.4)
doc <- tabla_guia(doc, data.frame(Medida = c("Página", "Márgenes", "Ancho útil", "Encabezado y pie", "Gráfico", "Tabla"),
  Valor = c("A4 vertical, 21 × 29.7 cm", "2.54 cm a los lados, 2.79 cm arriba y 2.29 cm abajo", "15.93 cm", "Logos sólo en la portada. En el interior, el informe y el capítulo en curso arriba y el folio abajo, a 1.02 cm del borde",
            "Del ancho útil, sin fondo. El alto depende del número de filas (capítulo «De PPT a Word»)", "Del ancho útil, con filetes azules arriba y abajo"), check.names = FALSE), c(1.6, 4.67))
doc <- seccion(doc, "Anatomía de una figura")
doc <- cuerpo(doc, "Cada gráfico del informe es una figura de cuatro partes que siempre van juntas: el rótulo arriba, el gráfico, la base y la fuente, y el párrafo de lectura.", keep = TRUE)
doc <- grafico(doc, "La Unidad cuenta con servicios de tutoría académica", g_apilada(list(list(actor = "Docentes", pct = c(2, 8, 54, 21, 15)), list(actor = "Estudiantes", pct = c(6, 18, 34, 19, 23)),
  list(actor = "Egresados", pct = c(3, 12, 50, 30, 5))), ROT, WTK$likert, n_txt = "N = 148 docentes, 1,234 estudiantes y 314 egresados"), alto_apilada(3),
  texto = "El 75% de los docentes y el 53% de los estudiantes está de acuerdo o totalmente de acuerdo con que la Unidad cuenta con servicios de tutoría. Uno de cada cuatro estudiantes no tiene información sobre el servicio.")
doc <- tabla_guia(doc, data.frame(Parte = c("Rótulo", "Gráfico", "Base y fuente", "Lectura"),
  `Qué es` = c("«Gráfico 5.» y la pregunta tal como se hizo, en una línea y en negrita. El número es un campo de Word", "Imagen sin fondo del ancho útil, sin título dentro",
               "Cuántas personas respondieron y quién hizo el estudio, en cursiva gris", "Lo que muestra el gráfico, en texto corrido y con sus mismas cifras en negrita"),
  `Por qué` = c("Con el número, el gráfico entra al índice de gráficos y se puede citar en el texto", "Ocupa el mismo ancho que el texto y no repite el rótulo",
                "Es un párrafo editable: si cambia la base, se corrige sin rehacer la imagen", "Separa lo que el analista concluye de lo que muestra el dato"), check.names = FALSE), c(1.2, 2.7, 2.37))
doc <- seccion(doc, "Estilos de Word")
doc <- cuerpo(doc, "Cada elemento es un estilo o un campo de Word. Para ajustar uno en todo el informe se modifica su estilo en Inicio > Estilos, y para renumerar gráficos, tablas e índices se selecciona todo y se presiona F9.", keep = TRUE)
doc <- tabla_guia(doc, data.frame(Elemento = c("Número de capítulo", "Título de capítulo", "Título de sección", "Rótulo de gráfico o tabla", "Número del rótulo", "Base y fuente", "Lectura", "Índices y encabezado"),
  `Estilo o campo` = c("«Número de capítulo»", "«Título 1»", "«Título 2»", "«Rótulo de gráfico»", "Campo SEQ con el estilo «Número de rótulo»", "«Base y fuente»", "«Lectura»", "Campos de tabla de contenido y de ilustraciones. El encabezado es propio de cada sección"),
  Formato = c("«CAPÍTULO 1», 9 pt, gris, negrita", "18 pt, azul oscuro, negrita, filete inferior", "12.5 pt, azul oscuro, negrita", "10 pt, azul oscuro, negrita, pegado a la figura", "10 pt, azul oscuro, negrita",
              "8.5 pt, gris, cursiva", "10.5 pt, gris muy oscuro, texto corrido", "Se actualizan con F9"), check.names = FALSE), c(1.75, 2.45, 2.07))
doc <- seccion(doc, "Escala tipográfica")
doc <- cuerpo(doc, "El Word se lee impreso o en pantalla, página por página. Por eso la letra es más chica que en el PPT, pero ninguna baja de 8 pt, ni siquiera dentro del gráfico.", keep = TRUE)
esc_ <- data.frame(Uso = c("Número de capítulo", "Título de capítulo", "Título de sección", "Rótulo del gráfico", "Texto y lectura", "Cifras dentro del gráfico", "Rótulos dentro del gráfico", "Leyenda del gráfico", "Base y fuente"),
  Tamaño = c("9 pt", "18 pt", "12.5 pt", "10 pt", "10.5 pt", "9 a 10 pt, negrita", "8.5 a 9 pt", "8 pt", "8.5 pt, cursiva"), `En el PPT` = c("Portadilla", "24 pt", "Antetítulo de 10 pt", "13 pt", "14 a 15 pt", "14 pt", "12 pt", "12 pt", "10 pt"), check.names = FALSE)
doc <- tabla_guia(doc, esc_, c(2.4, 2.0, 1.87))
doc <- seccion(doc, "Colores")
doc <- cuerpo(doc, "Las paletas son las mismas del PPT y significan lo mismo. En Word se imprimen, así que cada color se distingue también en escala de grises.", keep = TRUE)
g_paletas <- function() { pal <- list(`Escala Likert` = list(WTK$likert, c("Totalmente en\ndesacuerdo", "En\ndesacuerdo", "De acuerdo", "Totalmente\nde acuerdo", "Sin\ninformación")),
    `Dicotómica` = list(c(WTK$navy, WTK$celeste), c("Sí", "No")), Actores = list(c("#0B4F8C", "#2A9D8F", "#E9C46A", "#8E9DBD", "#081F5C", "#9DC3E6"), c("Docentes", "Estudiantes", "Egresados", "Autoridades", "Administ.", "Empleadores")),
    `Texto, títulos y realce` = list(c(WTK$navy, CORAL, WTK$verde, WTK$tenue), c("Texto", "Acento", "Top Two Box", "Apoyo")))
  d <- do.call(rbind, lapply(seq_along(pal), function(i) data.frame(f = i, k = seq_along(pal[[i]][[1]]), c = pal[[i]][[1]], l = pal[[i]][[2]])))
  ggplot(d) + geom_rect(aes(xmin = k - 0.45, xmax = k + 0.45, ymin = -f * 1.4 - 0.22, ymax = -f * 1.4 + 0.22, fill = c)) + scale_fill_identity() +
    geom_text(aes(x = k, y = -f * 1.4 - 0.5, label = l), size = 8 / .pt, colour = WTK$navy_w, family = "Arial", vjust = 1, lineheight = 0.85) +
    annotate("text", x = 0.3, y = -seq_along(pal) * 1.4, label = names(pal), hjust = 1, size = 9 / .pt, fontface = "bold", colour = WTK$navy_w, family = "Arial") +
    scale_x_continuous(limits = c(-2.4, 6.6), expand = c(0, 0)) + scale_y_continuous(limits = c(-length(pal) * 1.4 - 1.2, -0.7)) + theme_void() +
    labs(caption = "Base: paletas de la identidad de PULSO PUCP. Fuente: PULSO PUCP 2026.") }
doc <- grafico(doc, "Las cuatro paletas del informe", g_paletas(), 3.0)
doc <- seccion(doc, "Cómo se ubican las cifras y las respuestas")
doc <- lista(doc, c("Las barras apiladas empiezan todas en el mismo punto, a la izquierda, para comparar el Top Two Box de cada fila.",
  "Ninguna cifra se omite. Si no cabe dentro de su color, va encima con una línea guía, y la fila gana el aire que necesita: la barra conserva su grosor.",
  "Las respuestas de una escala van de lo negativo a lo positivo. «Sin información» y «No he usado el servicio» van al final y en gris.",
  "Las respuestas sin orden propio van de la más elegida a la menos elegida. «Otros» y «No sabe» van al final.",
  "Si la pregunta sólo se hizo a una parte de las personas, la base lo dice: por ejemplo, «Base: 20 estudiantes que respondieron Sí en la pregunta anterior»."))

# ================= 2. De PPT a Word
doc <- capitulo(doc, "De PPT a Word", "Un gráfico que se ve bien proyectado no se ve bien impreso por sí solo. Este capítulo da las reglas para pasar cada lámina del PPT al Word sin perder lo que dice.")
doc <- seccion(doc, "Lo que cambia")
doc <- tabla_guia(doc, data.frame(Aspecto = c("Título", "Tamaño de letra", "Ancho", "Base", "Texto de análisis", "Numeración", "Si no cabe"),
  `En Word` = c("Rótulo sobre el gráfico, en una línea: «Gráfico 5.» y la pregunta", "8 a 11 pt", "Fijo: 15.93 cm, el del texto", "Párrafo debajo del gráfico, con la fuente", "Párrafo de lectura debajo del gráfico, en texto corrido",
                "Gráficos y tablas numerados, con índices", "Rótulo, gráfico y base pasan juntos a la página siguiente"),
  `En PPT` = c("El título de la lámina, arriba y en coral", "12 a 14 pt", "Depende del tipo de lámina", "Al pie de la lámina", "Al costado o encima del gráfico", "Sin número", "Pasa a otra lámina marcada «(cont.)»"), check.names = FALSE), c(1.4, 2.5, 2.37))
doc <- seccion(doc, "Ancho y alto del gráfico")
doc <- cuerpo(doc, "El ancho es siempre el del texto. El alto crece con el número de filas, con una medida fija por fila, de modo que el grosor de la barra es el mismo en todo el informe.", keep = TRUE)
filas_ <- c(1, 2, 3, 4, 6, 8, 10)
doc <- tabla_guia(doc, data.frame(Filas = filas_, `Escala apilada: alto del gráfico` = paste(cm(alto_apilada(filas_)), "cm"), `Barras de categorías: alto del gráfico` = paste(cm(alto_barras(filas_)), "cm"),
  check.names = FALSE), c(1.2, 2.55, 2.52))
doc <- lista(doc, c(sprintf("En una escala apilada, cada fila suma %s cm y la barra mide %s cm de grosor.", cm(0.36), cm(0.36 * 0.58)),
  sprintf("En barras de categorías, cada fila suma %s cm y la barra mide %s cm.", cm(0.27), cm(0.27 * 0.64)),
  "Si hay cifras chicas que suben sobre la barra, la fila crece. La barra no adelgaza.",
  "Una etiqueta larga se reparte en varias líneas y su fila crece lo necesario, sin cortar palabras."))
doc <- seccion(doc, "Una lámina con varios gráficos")
doc <- cuerpo(doc, "En el PPT una lámina puede reunir dos o más gráficos. En el Word cada uno es una figura con su número, una debajo de la otra, en el orden en que se leen en la lámina. El texto que acompañaba a la lámina pasa a ser el párrafo de lectura de la última figura.", keep = TRUE)
doc <- lamina_ppt(doc, "DOS GRÁFICOS CON NARRATIVA / Inserción del egresado", "Lámina «Dos gráficos con narrativa» del PPT")
doc <- en_word(doc)
t1 <- D$titulo; a <- D$anio; s <- D$sueldo
doc <- grafico(doc, "¿En qué año obtuvo su título universitario?, egresados", g_columnas(a$labels, a$pct, n_txt = sprintf("N = %d egresados que tienen título", a$valid)), 2.2)
doc <- grafico(doc, "Sueldo mensual bruto, egresados", g_barras(s$labels, s$pct, n_txt = sprintf("N = %d egresados que respondieron", s$valid)), alto_barras(length(s$labels)),
  texto = sprintf("El %d%% de los titulados obtuvo su título en 2025, y el tramo de sueldo más frecuente es %s (%d%%).", a$pct[a$labels == "2025"], tolower(s$labels[which.max(s$pct)]), max(s$pct)))
doc <- seccion(doc, "Cifras destacadas")
doc <- cuerpo(doc, "Las cifras grandes de una lámina pasan al Word como una franja de cifras, que es una tabla de Word. No son una imagen: se editan en la propia tabla.", keep = TRUE)
doc <- lamina_ppt(doc, "CIFRAS EN BANDA SUPERIOR / El estudio en cifras", "Lámina «Cifras en banda superior» del PPT")
doc <- en_word(doc)
act <- c("Docentes", "Estudiantes", "Egresados", "Administrativos")
nact <- vapply(c("docentes", "estudiantes", "egresados", "administrativos"), function(b) nrow(CONTA$data_sources[[b]]), 0L)
franja <- function(doc, valores, rotulos) { cc <- as.data.frame(t(valores)); names(cc) <- paste0("v", seq_along(valores))
  ftk <- flextable(cc) |> delete_part("header") |> border_remove() |> width(width = ANCHO_W / length(valores)) |> font(fontname = FONT, part = "all") |>
    compose(j = seq_along(valores), value = as_paragraph(as_chunk(valores), "\n", as_chunk(rotulos, props = fp_text(font.family = FONT, font.size = 9, color = SOFT)))) |>
    fontsize(size = 24) |> bold() |> color(color = NAVY) |> align(align = "left") |> line_spacing(space = 1) |>
    border(j = seq_along(valores)[-1], border.left = fp_border(color = "#D5D9DF", width = 0.75)) |> padding(padding.left = 10, padding.top = 4, padding.bottom = 4) |> padding(j = 1, padding.left = 0)
  doc <- body_add_flextable(doc, ftk, align = "left"); body_add_par(doc, "") }
doc <- franja(doc, c(format(sum(nact), big.mark = ","), paste(round(median(D$edad$x, na.rm = TRUE)), "años"), paste0(t1$pct[1], "%")), c("personas encuestadas", "edad mediana del estudiante", "de egresados titulados"))
doc <- seccion(doc, "Lo que no pasa al Word")
doc <- lista(doc, c("Los íconos de público y las formas decorativas: en Word el público se nombra en el texto o en el rótulo.",
  "Las portadillas de capítulo: el Word usa el número y el título del capítulo.", "La narrativa al costado del gráfico: pasa a ser el párrafo de lectura."))

# ================= 3. Galería de gráficos
doc <- capitulo(doc, "Galería de gráficos", "Cada tipo de gráfico del motor en su formato de Word, con una línea sobre cuándo se usa. Los datos del proyecto de referencia se usan donde existen. El resto son cifras ficticias con la forma real de cada caso.")
gal <- function(doc, nombre, cuando) { doc <- seccion(doc, nombre); parr(doc, tx(cuando, 10.5, SOFT), keep = TRUE) }
sm <- D$ing_p35
cn <- c("Estados Financieros", "Auditoría", "Costos y presupuestos", "Finanzas", "Tributación", "Visión empresarial")
mm <- sapply(list(c("docentes", "p30_"), c("estudiantes", "p22_"), c("egresados", "p28_")), function(a) vapply(1:6, function(i) { f <- fr(a[1], paste0(a[2], i)); f$pct[3] + f$pct[4] }, 0))
doc <- gal(doc, "Barras de categorías", "Preguntas de categorías sin orden propio. Van de la más elegida a la menos elegida y la mayor se destaca en azul oscuro.")
doc <- grafico(doc, "¿Qué herramientas de inteligencia artificial usa en sus funciones laborales?", g_barras(c("IA generativa (ChatGPT, Copilot, etc.)", "Automatización inteligente", "Analítica avanzada", "Machine Learning", "Visión computacional", "No precisa"),
  c(99, 13, 11, 7, 1, 1), con_n = c(172, 23, 19, 12, 2, 2), n_txt = "N = 174 egresados que usan IA. Opción múltiple: los porcentajes pueden sumar más de 100"), alto_barras(6))
doc <- gal(doc, "Columnas en orden natural", "Escalas numéricas y años. Las columnas siguen el orden de la escala y «No sabe» va al final en gris.")
doc <- grafico(doc, "En una escala de 1 a 10, ¿cuánto confía en el Congreso?", g_columnas(c(as.character(1:10), "NS/NR"), c(18, 9, 12, 11, 15, 10, 8, 6, 3, 2, 6), corte = 5, n_txt = "N = 1,200 entrevistados"), 2.4)
doc <- gal(doc, "Escala apilada con Top Two Box", "Escalas de acuerdo, satisfacción o utilidad. La columna verde suma las dos respuestas positivas.")
o1 <- fr("docentes", "p24_6"); o2 <- fr("estudiantes", "p17_5")
doc <- grafico(doc, o1$pregunta, g_apilada(list(list(actor = "Docentes", pct = o1$pct), list(actor = "Estudiantes", pct = o2$pct)), ROT, WTK$likert, n_txt = sprintf("N = %d docentes y %d estudiantes", o1$valid, o2$valid)), alto_apilada(2))
doc <- gal(doc, "Escala con comparativo de otro año", "Cuando el estudio repite la pregunta. La segunda columna da el Top Two Box de la medición anterior.")
doc <- grafico(doc, paste(o1$pregunta, "(2026 frente a 2021)"), g_apilada(list(list(actor = "Docentes", pct = o1$pct), list(actor = "Estudiantes", pct = o2$pct)), ROT, WTK$likert, ttb21 = c(98, 84),
  n_txt = sprintf("N = %d docentes y %d estudiantes. 2021: informe consolidado anterior", o1$valid, o2$valid)), alto_apilada(2))
doc <- gal(doc, "Dicotómica", "Preguntas de Sí y No. La cifra grande es la del Sí y la barra parte el total.")
doc <- grafico(doc, "¿Cuenta con título universitario?, egresados", g_sino(t1$labels[1:2], t1$pct[1:2], t1$n[1:2], n_txt = sprintf("N = %d egresados", t1$valid)), 1.5)
doc <- gal(doc, "Dona", "Pocas categorías que suman 100%. Con más de cinco se usan barras.")
doc <- grafico(doc, "Situación laboral actual", g_torta(c("Trabaja de manera dependiente", "Trabaja de manera independiente", "No trabaja", "Estudia"), c(62, 21, 11, 6), n_txt = "N = 178 egresados", alto = 2.9), 2.9)
doc <- gal(doc, "Torta con leyenda de cifras", "Dos a cuatro categorías que suman 100%. La leyenda lleva el nombre de cada parte y la torta, sus cifras.")
doc <- grafico(doc, "¿Cuenta con título universitario?, egresados", g_torta(t1$labels[1:2], t1$pct[1:2], n_txt = sprintf("N = %d egresados", t1$valid), alto = 2.6, dona = FALSE), 2.6)
doc <- gal(doc, "Histograma", "Variables numéricas como la edad. Cada columna es un valor y el triángulo marca la mediana.")
ed <- D$edad$x[!is.na(D$edad$x) & D$edad$x <= 32]
doc <- grafico(doc, "Edad de los estudiantes", g_hist(ed, n_txt = sprintf("N = %d estudiantes que declararon su edad", length(ed))), 2.5)
eda <- suppressWarnings(as.numeric(as.character(CONTA$data_sources$estudiantes$p3))); cic <- as.character(CONTA$data_sources$estudiantes$p6)
ok <- !is.na(eda) & !is.na(cic) & eda < 60
codes <- CONTA$inst_sources$estudiantes$choices; codes <- codes[!is.na(codes$list_name) & codes$list_name == CONTA$inst_sources$estudiantes$survey$list_name[match("p6", CONTA$inst_sources$estudiantes$survey$name)], ]
lab_c <- setNames(codes[[grep("^label", names(codes))[1]]], codes$name); grp <- lab_c[cic[ok]]; prom <- round(tapply(eda[ok], grp, mean), 1); prom <- prom[intersect(lab_c, names(prom))]
doc <- gal(doc, "Promedio por grupo", "Un indicador numérico por grupo. La columna mayor va en azul oscuro.")
doc <- grafico(doc, "Edad promedio por nivel curricular", g_promedios(names(prom), as.numeric(prom), n_txt = sprintf("N = %d estudiantes que declararon su edad", sum(ok)), unidad = " años"), 2.2)
doc <- gal(doc, "Diagrama de caja", "Cuánto varía una variable numérica en cada grupo. La caja reúne a la mitad central y la línea es la mediana.")
doc <- grafico(doc, "Distribución de la edad por nivel curricular", g_boxplot(split(eda[ok], factor(grp, levels = names(prom))), n_txt = sprintf("N = %d estudiantes", sum(ok))), 2.4)
pub_ <- list(Docentes = c("docentes", "p4"), Estudiantes = c("estudiantes", "p3"), Egresados = c("egresados", "p4"), Administrativos = c("administrativos", "p3"))
ed_ <- lapply(pub_, function(z) { x <- suppressWarnings(as.numeric(as.character(CONTA$data_sources[[z[1]]][[z[2]]]))); x[!is.na(x) & x < 90] })
doc <- gal(doc, "Media y rango", "Una variable numérica entre públicos distintos. El punto es la media y la línea va del valor más bajo al más alto.")
doc <- grafico(doc, "Edad por público", g_rango(ed_, n_txt = sprintf("N = %s", paste(sprintf("%d %s", lengths(ed_), tolower(names(ed_))), collapse = ", "))), 2.2)
doc <- gal(doc, "Divergentes", "Para leer de un vistazo el desacuerdo y el acuerdo. El cero separa los dos lados y cada lado lleva su total.")
doc <- grafico(doc, "Valoración de la gestión de la carrera, docentes", g_divergente(c("La carrera tiene un plan de mejora conocido", "Las autoridades informan oportunamente", "Los procesos administrativos son ágiles", "Hay canales para presentar sugerencias"),
  list(c(4, 12, 54, 30), c(6, 18, 50, 26), c(12, 27, 44, 17), c(5, 15, 52, 28)), n_txt = "N = 148 docentes"), 2.4)
doc <- gal(doc, "Ranking con puntos", "Una lista larga de opciones, de mayor a menor.")
doc <- grafico(doc, "Qué podría mejorar la carrera (cinco opciones más mencionadas)", g_lollipop(head(sm$labels[order(-sm$pct)], 5), head(sort(sm$pct, decreasing = TRUE), 5), n_txt = "N = 131 egresados"), 2.8)
doc <- gal(doc, "Ranking en barras", "La misma lista larga que el ranking con puntos, en barras. Conviene cuando las cifras son parecidas y hay que leer cada una.")
rk_ <- order(-sm$pct)[1:7]
doc <- grafico(doc, "Qué podría mejorar la carrera (siete opciones más mencionadas)", g_barras(stringr::str_trunc(sm$labels[rk_], 70), sm$pct[rk_], n_txt = "N = 131 egresados. Opción múltiple"), alto_barras(7) + 0.6)
doc <- gal(doc, "Puntos comparativos y brecha", "Dos grupos o dos preguntas emparentadas en cada fila. La distancia entre los puntos es la brecha.")
doc <- grafico(doc, "Conocer la misión frente a saber dónde consultarla, por público", g_dos_grupos(act, vapply(D$mision1, function(m) m$pct[1], 0), vapply(D$mision2, function(m) m$pct[1], 0),
  c("Conoce la misión", "Sabe dónde consultarla"), n_txt = sprintf("N = %s", paste(sprintf("%d %s", vapply(D$mision1, `[[`, 0L, "valid"), tolower(act)), collapse = ", ")), lim = 100), 2.4)
doc <- gal(doc, "Brecha entre dos públicos", "Las mismas preguntas a dos públicos. Cada fila muestra a los dos y, a la derecha, cuántos puntos los separan.")
doc <- grafico(doc, "Top Two Box de las competencias: docentes frente a estudiantes", g_dos_grupos(cn, mm[, 1], mm[, 2], c("Docentes", "Estudiantes"), n_txt = "N = 51 docentes y 109 estudiantes", lim = 100), 2.6)
doc <- gal(doc, "Serie temporal", "Tres o más mediciones en el tiempo. Cada línea lleva su nombre al final, sin leyenda aparte.")
doc <- grafico(doc, "Top Two Box de la tutoría académica en cuatro procesos de acreditación", g_serie(c("2012", "2016", "2021", "2026"), list(Docentes = c(88, 93, 98, 83), Estudiantes = c(71, 79, 84, 53)),
  n_txt = "N = 46, 49, 51 y 52 docentes. 702, 845, 1,102 y 1,234 estudiantes"), 2.4)
de_ <- CONTA$data_sources$estudiantes; it_ <- sprintf("p22_%d", 1:11); ci <- fr("estudiantes", "p6")
dims_ <- list(`Competencias técnicas` = 1:5, `Visión empresarial` = 6, `Competencias transversales` = 7:11)
gr_ <- list(Total = rep(TRUE, nrow(de_)), Masculino = as.character(de_$p5) == "1", Femenino = as.character(de_$p5) == "2")
for (k in seq_along(ci$labels)) gr_[[ci$labels[k]]] <- as.character(de_$p6) == as.character(k)
ttb_ <- function(idx) sapply(it_, function(v) { x <- as.character(de_[[v]])[idx]; ok <- x %in% c("1", "2", "3", "4"); round(100 * mean(x[ok] %in% c("3", "4"))) })
Mi_ <- sapply(gr_, ttb_); Md_ <- t(sapply(dims_, function(ix) colMeans(Mi_[ix, , drop = FALSE])))
Mh_ <- Md_; colnames(Mh_) <- c("Total", "Hombres", "Mujeres", sub(" ciclo$", "", colnames(Md_)[-(1:3)]))   # encabezados cortos: en Word la columna mide 1.2 cm
n_comp <- sum(apply(sapply(it_, function(v) as.character(de_[[v]]) %in% c("1", "2", "3", "4")), 1, any))
doc <- gal(doc, "Mapa de calor por dimensión", "Varias dimensiones entre varios grupos. El tono va siempre de 80% a 100%, para que un color diga lo mismo en todo el informe.")
doc <- grafico(doc, "Top Two Box de las competencias por dimensión y grupo, estudiantes", g_heat(Mh_, n_txt = sprintf("N = %d estudiantes. Las columnas de Quinto a Décimo son los ciclos", n_comp)), 2.4)
lab11 <- vapply(it_, function(v) { t_ <- fr("estudiantes", v)$pregunta; paste(head(strsplit(t_, " ")[[1]], 5), collapse = " ") }, "")
M11 <- Mi_[, c("Total", "Masculino", "Femenino")]; rownames(M11) <- lab11; colnames(M11) <- c("Total", "Hombres", "Mujeres")
doc <- gal(doc, "Mapa de calor por criterio", "Cada competencia dentro de su dimensión, por grupo. Sirve para ubicar en qué criterio está la diferencia que el mapa por dimensión resume.")
doc <- grafico(doc, "Top Two Box de cada competencia, por sexo, estudiantes", g_heat(M11, n_txt = sprintf("N = %d estudiantes", n_comp)), 3.9)
doc <- gal(doc, "Comparativo de dimensiones entre dos grupos", "Dos grupos en cada dimensión, con la diferencia en puntos a la derecha.")
doc <- grafico(doc, "Índice de cada dimensión por sexo, estudiantes", g_dos_grupos(rownames(Md_), round(Md_[, "Masculino"]), round(Md_[, "Femenino"]), c("Masculino", "Femenino"),
  n_txt = sprintf("N = %d estudiantes hombres y %d mujeres", sum(gr_$Masculino), sum(gr_$Femenino)), lim = 100), 2.0)
cn <- c("Estados Financieros", "Auditoría", "Costos y presupuestos", "Finanzas", "Tributación", "Visión empresarial")
mm <- sapply(list(c("docentes", "p30_"), c("estudiantes", "p22_"), c("egresados", "p28_")), function(a) vapply(1:6, function(i) { f <- fr(a[1], paste0(a[2], i)); f$pct[3] + f$pct[4] }, 0))
doc <- gal(doc, "Puntos por competencia, en lugar del radar", "Varias competencias y varios públicos. Con valores altos y parecidos, los puntos en una misma línea se leen mejor que un radar.")
doc <- grafico(doc, "Top Two Box de las competencias del perfil de egreso, por actor", g_competencias(cn, mm, c("Docentes", "Estudiantes", "Egresados"), n_txt = "N = 51 docentes, 109 estudiantes y 161 egresados"), 2.6)
doc <- gal(doc, "Radar con tabla", "Varias competencias y varios públicos, cuando el informe anterior usaba radar. La tabla de al lado da las cifras exactas que el radar no deja leer.")
doc <- grafico(doc, "Formulación del perfil de egreso: Top Two Box por competencia y actor", g_radar(cn, mm, c("Docentes", "Estudiantes", "Egresados"), n_txt = "N = 51 docentes, 109 estudiantes y 161 egresados"), 3.4)
doc <- tabla(doc, "Top Two Box por competencia y actor, cifras del radar", ft_base(data.frame(Competencia = cn, Docentes = paste0(mm[, 1], "%"), Estudiantes = paste0(mm[, 2], "%"), Egresados = paste0(mm[, 3], "%")), c(2.4, 1.2, 1.2, 1.2)) |> align(j = 2:4, align = "center", part = "all"),
  base = "Base: 51 docentes, 109 estudiantes y 161 egresados. Fuente: PULSO PUCP 2026.")
doc <- gal(doc, "Radar por dimensiones", "Muchos ejes (cinco o más) y dos grupos. El eje empieza en 80%: con valores altos y parecidos, así se ven las diferencias.")
doc <- grafico(doc, "Las once competencias por sexo, estudiantes", g_radar(lab11, Mi_[, c("Masculino", "Femenino")], c("Hombres", "Mujeres"), n_txt = sprintf("N = %d estudiantes hombres y %d mujeres", sum(gr_$Masculino), sum(gr_$Femenino))), 3.6)
doc <- gal(doc, "Peso en la satisfacción", "Qué aspecto explica más la satisfacción general. El peso sale de una regresión y suma 100% entre los aspectos con efecto.")
doc <- grafico(doc, "Peso de cada aspecto en la satisfacción con la atención", g_peso(c("Trato del personal", "Tiempo de atención", "Claridad de la información", "Infraestructura"), c(41, 33, 26, NA),
  n_txt = "N = 224 usuarios. Cifras ficticias. Peso estimado con una regresión lineal"), 1.9)
doc <- gal(doc, "Matriz de conteos", "Dos variables con pocos casos. Cada celda muestra la frecuencia y el tono crece con ella.")
doc <- grafico(doc, "Entidades que reconocieron la labor docente, por año", g_matriz(c("Dirección Académica del Profesorado", "Facultad", "Departamento académico", "Universidad", "Escuela de Posgrado"), as.character(2020:2024),
  rbind(c(0, 2, 3, 3, 5), c(3, 3, 3, 4, 2), c(1, 1, 1, 1, 2), c(1, 3, 2, 4, 2), c(0, 0, 1, 3, 1)), n_txt = "N = 26 docentes que respondieron «Sí». Un docente puede declarar varias"), 2.4)
doc <- gal(doc, "Indicadores frente a su meta", "Monitoreo: la barra es lo logrado y la marca coral, la meta.")
doc <- grafico(doc, "Indicadores de la asistencia en efectivo frente a su meta", g_metas(c("Recibió la asistencia en la fecha prevista", "Retiró el dinero sin problemas de acceso", "Usó el efectivo en necesidades básicas", "Conoce cómo presentar una queja", "Se sintió tratado con respeto"),
  c(86, 78, 92, 41, 95), c(80, 85, 90, 60, 90), n_txt = "N = 2,296 hogares. Cifras ficticias"), 2.9)
doc <- gal(doc, "Nube de palabras", "Preguntas abiertas. El tamaño crece con las menciones y acompaña a la tabla de temas, no la reemplaza.")
doc <- grafico(doc, "Palabras más mencionadas por los egresados sobre lo que cambiarían en la carrera", g_nube(NB$freq, n_txt = sprintf("N = %d egresados que respondieron la pregunta abierta", NB$n_resp)), 2.8)
doc <- gal(doc, "Nube de frases", "Las frases de dos o tres palabras que más se repiten. Dice más que las palabras sueltas, porque conserva el sentido.")
fr2 <- c(`plan de estudios` = 31, `prácticas preprofesionales` = 27, `herramientas digitales` = 24, `inteligencia artificial` = 21, `mercado laboral` = 19, `software especializado` = 17,
         `habilidades blandas` = 15, `malla curricular` = 14, `docentes con experiencia` = 12, `casos reales` = 11, `trabajo en equipo` = 9, `ética profesional` = 8, `cursos electivos` = 7, `convenios con empresas` = 6)
doc <- grafico(doc, "Frases que más se repiten en lo que cambiarían los egresados", g_nube(fr2, n_txt = "N = 131 egresados. Cifras ficticias", k = 14), 2.6)
doc <- gal(doc, "Pregunta abierta: temas", "Las respuestas abiertas se codifican en temas. La tabla da los temas con su frecuencia y el gráfico los ordena de mayor a menor.")
tem_ <- data.frame(Tema = c("Actualizar el plan de estudios", "Más prácticas y vínculo con empresas", "Herramientas digitales e inteligencia artificial", "Docentes con experiencia profesional", "Habilidades blandas", "Otros"),
                   n = c(48, 37, 33, 21, 14, 9)); tem_$pct <- round(100 * tem_$n / 131)
doc <- tabla(doc, "Temas de lo que cambiarían los egresados", ft_base(data.frame(Tema = tem_$Tema, Menciones = tem_$n, `%` = paste0(tem_$pct, "%"), check.names = FALSE), c(4.0, 1.1, 1.1)) |> align(j = 2:3, align = "center", part = "all"),
  base = "Base: 131 egresados. Una respuesta puede tocar varios temas. Cifras ficticias. Fuente: PULSO PUCP 2026.")
doc <- grafico(doc, "Temas de lo que cambiarían los egresados", g_barras(tem_$Tema, tem_$pct, n_txt = "N = 131 egresados. Una respuesta puede tocar varios temas. Cifras ficticias"), alto_barras(6))
# Mapas: cartografía real del motor y selección ficticia (la misma del PPT)
suppressMessages(library(sf)); sf::sf_use_s2(FALSE)
CART <- "api/inst/hojas_ruta/cartografia"
LIMA <- suppressMessages(sf::st_read(file.path(CART, "lima_district_coverage.json"), quiet = TRUE))
leer_capa <- function(capa, ubigeo) suppressMessages(sf::st_make_valid(sf::st_read(paste0("/vsigzip/", normalizePath(file.path(CART, capa, paste0(ubigeo, ".geojson.gz")))), quiet = TRUE)))
res8 <- c(`SAN JUAN DE LURIGANCHO` = 58, ATE = 64, `EL AGUSTINO` = 51, `SANTA ANITA` = 69, `VILLA EL SALVADOR` = 73, `VILLA MARIA DEL TRIUNFO` = 61,
          `SAN JUAN DE MIRAFLORES` = 66, CHORRILLOS = 77, COMAS = 55, `LOS OLIVOS` = 71, `SAN MARTIN DE PORRES` = 68, CALLAO = 49)
cl8 <- c("Menos de 55%", "55% a 64%", "65% a 74%", "75% a más", "Sin encuestas"); pal8 <- setNames(c("#C9D5EA", "#8EA3C6", "#4F6B9E", WTK$navy, "#E2E6EC"), cl8)
k8 <- ifelse(LIMA$distrito %in% names(res8), cl8[cut(res8[LIMA$distrito], c(0, 55, 65, 75, 101), right = FALSE, labels = FALSE)], "Sin encuestas")
doc <- gal(doc, "Mapa de resultado por distrito", "Un resultado del estudio por distrito, en clases. La leyenda va a la derecha, con su título, como en el PPT.")
doc <- grafico(doc, "Satisfechos o muy satisfechos con el servicio, por distrito", g_mapa(LIMA, k8, pal8, "Satisfechos o muy satisfechos", alto = 4.4, n_txt = "N = 1,184 personas en doce distritos. Cifras ficticias sobre la cartografía de Lima Metropolitana y Callao (IMP PlanMet 2040)"), 4.4)
zonas_c <- leer_capa("zonas_inei2017_lima_callao", "150110"); zonas_c <- zonas_c[!sf::st_is_empty(zonas_c), ]
set.seed(103); n9 <- nrow(zonas_c); v9 <- rep(0, n9); vt <- sf::st_touches(zonas_c); for (s_ in sample(seq_len(n9), 4)) { r_ <- unique(c(s_, head(vt[[s_]], 5))); v9[r_] <- sample(2:12, length(r_), replace = TRUE) }
cl9 <- c("Sin encuestas", "1 a 4", "5 a 8", "9 a 12"); k9 <- cl9[1 + (v9 > 0) + (v9 >= 5) + (v9 >= 9)]
doc <- gal(doc, "Mapa de un distrito por zonas", "Las zonas de un distrito según un resultado del operativo, como las encuestas logradas.")
doc <- grafico(doc, "Encuestas logradas por zona en Comas", g_mapa(zonas_c, k9, setNames(c("#FFFFFF", "#C9D5EA", "#6F88B5", WTK$navy), cl9), "Encuestas por zona", borde = "#B8C2D3", lw = 0.15, alto = 4.2,
  n_txt = sprintf("N = %d encuestas en %d de %d zonas. Cifras ficticias sobre las zonas censales INEI 2017", sum(v9), sum(v9 > 0), n9)), 4.2)

# ================= 4. Situaciones de datos
grupo <- c(`SAN JUAN DE LURIGANCHO` = "Intervención", ATE = "Intervención", `EL AGUSTINO` = "Intervención", `SANTA ANITA` = "Intervención",
           `VILLA EL SALVADOR` = "Comparación", `VILLA MARIA DEL TRIUNFO` = "Comparación", `SAN JUAN DE MIRAFLORES` = "Comparación", CHORRILLOS = "Comparación")
bb_ <- sf::st_bbox(LIMA[LIMA$distrito %in% names(grupo), ]) + c(-0.04, -0.03, 0.04, 0.03)
LIMA_c <- suppressWarnings(suppressMessages(sf::st_crop(sf::st_make_valid(LIMA), bb_)))
doc <- gal(doc, "Mapa de distritos por grupo", "Los distritos del estudio por grupo, con Lima de contexto en gris.")
doc <- grafico(doc, "Distritos del estudio por grupo", g_mapa(LIMA_c, ifelse(LIMA_c$distrito %in% names(grupo), grupo[LIMA_c$distrito], "Fuera del estudio"),
  c(`Intervención` = "#2F4B7C", `Comparación` = "#9FB1D1", `Fuera del estudio` = "#E2E6EC"), "Distritos", alto = 3.6, n_txt = "N = 189 entrevistados. Selección ficticia sobre la cartografía de Lima Metropolitana y Callao (IMP PlanMet 2040)"), 3.6)
racimos <- function(z, n, semilla) { set.seed(semilla); vz <- sf::st_touches(z); ap <- integer(); while (length(ap) < n) { s_ <- sample(setdiff(seq_len(nrow(z)), ap), 1); ap <- unique(c(ap, s_, head(vz[[s_]], 3))) }; seq_len(nrow(z)) %in% ap }
zves <- leer_capa("zonas_inei2017_lima_callao", "150142"); zves <- zves[!sf::st_is_empty(zves), ]; zves$apl <- racimos(zves, 18, 111)
mzv <- leer_capa("manzanas_inei2017_lima_callao", "150142"); mzv$zona_id <- paste0("150142", mzv$CODZONA, mzv$SUFZONA)
en_v <- mzv$zona_id %in% zves$IDZONA[zves$apl]; set.seed(12); mzv$apl <- en_v & stats::runif(nrow(mzv)) < 0.3
doc <- gal(doc, "Mapa de zonas y manzanas", "Un distrito con sus zonas aplicadas (borde oscuro) y, dentro de ellas, las manzanas visitadas.")
doc <- grafico(doc, "Zonas y manzanas aplicadas en Villa El Salvador", g_mapa(mzv, ifelse(mzv$apl, "Manzana aplicada", ifelse(en_v, "Otra manzana de una zona aplicada", "Fuera de la muestra")),
  c(`Manzana aplicada` = WTK$navy, `Otra manzana de una zona aplicada` = "#9FB1D1", `Fuera de la muestra` = "#FFFFFF"), "Manzanas", borde = "#D5D9DF", lw = 0.06, alto = 4.2, contorno = zves[zves$apl, ],
  n_txt = sprintf("N = %d manzanas aplicadas en %d zonas. Selección ficticia sobre las zonas y manzanas censales INEI 2017", sum(mzv$apl), sum(zves$apl))), 4.2)

doc <- capitulo(doc, "Situaciones de datos", "Las situaciones que aparecen una y otra vez en los estudios, y cómo se resuelven en Word.")
sit <- function(doc, nombre, regla) { doc <- seccion(doc, nombre); parr(doc, tx(regla, 10.5, SOFT), keep = TRUE) }
doc <- sit(doc, "Varios actores en un mismo gráfico", "Si todos los actores responden la misma afirmación, van en un solo gráfico con las barras alineadas, para comparar el Top Two Box de cada uno.")
seis <- list(list(actor = "Estudiantes", pct = c(3, 23, 46, 28, 0)), list(actor = "Egresados", pct = c(0, 22, 61, 15, 2)), list(actor = "Docentes", pct = c(0, 33, 56, 11, 0)),
             list(actor = "Autoridades", pct = c(0, 8, 50, 42, 0)), list(actor = "Administrativos", pct = c(0, 0, 18, 29, 53)), list(actor = "Empleadores", pct = c(4, 12, 46, 31, 7)))
doc <- grafico(doc, "La carrera cuenta con un cuerpo académico suficiente en número, dedicación y calificaciones", g_apilada(seis, ROT, WTK$likert,
  n_txt = "N = 39 estudiantes, 67 egresados, 18 docentes, 12 autoridades, 17 administrativos y 26 empleadores"), alto_apilada(6))
doc <- sit(doc, "Top Two Box, Bottom Two Box y fila Total", "Cuando interesa también el desacuerdo, la columna Bottom Two Box suma las dos respuestas negativas. La fila Total va primero, separada por un filete.")
tot_ <- function(a, na, b, nb) round((a * na + b * nb) / (na + nb))
d1 <- c(0, 2, 29, 54, 15); e1 <- c(6, 18, 34, 19, 23)
doc <- grafico(doc, "La Unidad cuenta con servicios de tutoría académica", g_apilada(list(list(actor = "Total", pct = tot_(d1, 52, e1, 172)), list(actor = "Docentes", pct = d1), list(actor = "Estudiantes", pct = e1)),
  ROT, WTK$likert, b2b = TRUE, n_txt = "N = 224: 52 docentes y 172 estudiantes"), alto_apilada(3))
doc <- sit(doc, "Pregunta filtro y su subpregunta", "Si sólo quienes respondieron «Sí» pasan a la pregunta siguiente, el segundo gráfico va inmediatamente después y su base dice quiénes son.")
doc <- grafico(doc, "¿Ha participado en programas de intercambio?", g_sino(c("Sí", "No"), c(10, 90), c(20, 181), n_txt = "N = 201 estudiantes"), 1.5)
doc <- grafico(doc, "Los programas de intercambio fortalecen mis competencias", g_apilada(list(list(actor = "Participaron", pct = c(10, 0, 55, 35))), ROT[1:4], WTK$likert[1:4],
  n_txt = "N = 20 estudiantes que respondieron «Sí» en la pregunta anterior"), alto_apilada(1))
doc <- sit(doc, "Base chica", "Si un grupo tiene menos de 30 personas, junto al porcentaje va el número de casos entre paréntesis.")
doc <- grafico(doc, "Cargo de las autoridades", g_barras(c("Coordinador(a)", "Jefe(a) de departamento", "Decano(a) o director(a)", "Secretario(a) académico(a)"), c(42, 25, 17, 17), con_n = c(5, 3, 2, 2), n_txt = "N = 12 autoridades. Con menos de 30 casos se lee la frecuencia entre paréntesis"), alto_barras(4))
doc <- sit(doc, "«No he usado el servicio» dentro de la base", "Si una parte no usó el servicio, esa respuesta queda en la barra, al final y en gris, y el Top Two Box se lee sobre todos.")
doc <- grafico(doc, "Satisfacción con el servicio médico de la universidad", g_apilada(list(list(actor = "Estudiantes", pct = c(6, 20, 36, 19, 19)), list(actor = "Docentes", pct = c(1, 16, 61, 22, 0)), list(actor = "Administrativos", pct = c(12, 16, 64, 8, 0))),
  c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho", "No he usado el servicio"), WTK$likert, n_txt = "N = 201 estudiantes, 92 docentes y 25 administrativos"), alto_apilada(3))
doc <- sit(doc, "Sí, No y No sabe", "Si la pregunta admite «No sabe», va al final de la barra y en gris, sin mezclarse con el No.")
doc <- grafico(doc, "¿Conoce el servicio de bienestar psicológico?", g_apilada(list(list(actor = "Estudiantes", pct = c(84, 11, 5)), list(actor = "Docentes", pct = c(72, 20, 8)), list(actor = "Administrativos", pct = c(60, 30, 10))),
  c("Sí", "No", "No sabe"), c(WTK$azul_si, WTK$celeste, "#BFBFBF"), ttb = FALSE, n_txt = "N = 1,234 estudiantes, 148 docentes y 43 administrativos"), alto_apilada(3))
doc <- sit(doc, "Desglose de un actor y cohortes", "Si un actor se divide en grupos, la fila Total va primero y cada grupo declara su base.")
doc <- grafico(doc, "Me siento satisfecho con la formación recibida, estudiantes por etapa", g_apilada(list(list(actor = "Total", pct = c(2, 9, 55, 33, 1)), list(actor = "Primeros ciclos", pct = c(1, 6, 52, 40, 1)), list(actor = "Ciclos intermedios", pct = c(3, 10, 56, 30, 1)), list(actor = "Últimos ciclos", pct = c(2, 12, 57, 28, 1))),
  ROT, WTK$likert, n_txt = "N = 1,234 estudiantes: 410 de primeros ciclos, 452 de ciclos intermedios y 372 de últimos ciclos"), alto_apilada(4),
  texto = "El 88% del total está satisfecho con la formación recibida. Los primeros ciclos llegan a 92% y los últimos, a 85%.")
doc <- sit(doc, "Escalas con otras palabras", "Si la escala habla de competencia, de importancia o de utilidad, cambian las palabras de la leyenda. El color y el orden se mantienen.")
doc <- grafico(doc, "Importancia de las prácticas preprofesionales en la formación", g_apilada(list(list(actor = "Estudiantes", pct = c(1, 4, 33, 60, 2)), list(actor = "Egresados", pct = c(0, 3, 28, 68, 1)), list(actor = "Docentes", pct = c(0, 2, 38, 58, 2))),
  c("Nada importante", "Poco importante", "Importante", "Muy importante", "Sin información"), WTK$likert, n_txt = "N = 1,234 estudiantes, 314 egresados y 148 docentes"), alto_apilada(3))
doc <- sit(doc, "Etiquetas largas", "Si las afirmaciones son largas, el texto se reparte en varias líneas y cada fila crece lo necesario, sin cortar palabras.")
doc <- grafico(doc, "Gestión institucional: afirmaciones extensas", g_apilada(list(
  list(actor = "Las autoridades de la Facultad informan oportunamente a la comunidad académica sobre las decisiones que afectan el desarrollo de la carrera", pct = c(4, 18, 52, 24, 2)),
  list(actor = "La carrera cuenta con recursos suficientes para desarrollar actividades de investigación e innovación", pct = c(6, 24, 47, 20, 3)),
  list(actor = "Los mecanismos de admisión, permanencia y graduación se aplican de manera transparente", pct = c(2, 11, 55, 31, 1))), ROT, WTK$likert,
  envolver = 40, n_txt = "N = 148 docentes"), alto_apilada(3) + 1.0)
doc <- sit(doc, "Cifras chicas seguidas", "Si al inicio de la barra caen 1%, 2% y 3% seguidos, las tres cifras suben sobre la barra con su guía, separadas entre sí.")
doc <- grafico(doc, "El plan de estudios responde a las demandas del mercado laboral", g_apilada(list(list(actor = "Estudiantes", pct = c(1, 2, 3, 51, 43)), list(actor = "Egresados", pct = c(2, 3, 1, 47, 47)), list(actor = "Docentes", pct = c(0, 1, 2, 42, 55))),
  c("Totalmente en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo", "De acuerdo", "Totalmente de acuerdo"), c("#F4B183", "#FFD965", "#D9D9D9", "#ADD493", "#70AD47"),
  n_txt = "N = 1,234 estudiantes, 314 egresados y 148 docentes"), alto_apilada(3))
doc <- sit(doc, "Dos mediciones del mismo indicador", "Con dos mediciones no se usa la serie: cada indicador muestra los dos años y la diferencia en puntos, en verde si sube y en coral si baja.")
doc <- grafico(doc, "Top Two Box de los estudiantes en indicadores repetidos, 2026 frente a 2021", g_dos_grupos(c("Conoce la misión de la carrera", "El plan de estudios es pertinente",
  "Los docentes dominan su materia", "La infraestructura es adecuada", "Recibe orientación académica"), c(81, 86, 92, 64, 53), c(74, 88, 90, 52, 61), c("2026", "2021"),
  n_txt = "N = 1,234 estudiantes en 2026 y 1,102 en 2021. 2021: informe consolidado anterior", lim = 100), 2.6,
  texto = "La infraestructura sube 12 puntos y la orientación académica baja 8. Los demás indicadores se mueven 7 puntos o menos.")
# Diferencias significativas: la prueba del motor (z con proporción combinada para cada par, Bonferroni dentro de la fila, alfa 0.05)
doc <- sit(doc, "Diferencias significativas", "La tabla da la cifra de cada público y, al lado, las letras de los públicos frente a los que es significativamente mayor. El gráfico muestra las mismas letras junto a la barra. La diferencia se juzga con la prueba y no a simple vista, porque comparar barras o intervalos por separado lleva a conclusiones erradas (Cumming y Finch, 2005).")
z_p <- function(x1, n1, x2, n2) { pp <- (x1 + x2) / (n1 + n2); se <- sqrt(pp * (1 - pp) * (1 / n1 + 1 / n2)); if (se == 0) 1 else 2 * pnorm(-abs((x1 / n1 - x2 / n2) / se)) }
mi_ <- D$mision1; xs <- vapply(mi_, function(m) m$n[1], 0); ns <- vapply(mi_, `[[`, 0L, "valid"); pc <- vapply(mi_, function(m) m$pct[1], 0)
pares <- combn(4, 2); alfa <- 0.05 / ncol(pares); letras <- rep("", 4)
for (k in seq_len(ncol(pares))) { i <- pares[1, k]; j <- pares[2, k]
  if (z_p(xs[i], ns[i], xs[j], ns[j]) < alfa) { may <- if (xs[i] / ns[i] > xs[j] / ns[j]) i else j; men <- setdiff(c(i, j), may); letras[may] <- trimws(paste(letras[may], LETTERS[men])) } }
sig_df <- data.frame(Público = paste0(LETTERS[1:4], ". ", act), `Conoce la misión` = paste0(pc, "%"), Base = ns, `Mayor que` = ifelse(nzchar(letras), letras, "Sin diferencias"), check.names = FALSE)
doc <- tabla(doc, "Conoce la misión, por público, con diferencias significativas", ft_base(sig_df, c(2.2, 1.8, 0.9, 1.4)) |> align(j = 2:4, align = "center", part = "all") |> color(j = 4, color = "#4F7FAF", part = "body") |> bold(j = 4, part = "body"),
  base = sprintf("Base: %s. Prueba z para proporciones (Agresti, 2013) con corrección de Bonferroni dentro de la fila (Dunn, 1961), α = 0.05. Fuente: PULSO PUCP 2026.", paste(sprintf("%d %s", ns, tolower(act)), collapse = ", ")))
doc <- grafico(doc, "¿Conoce la misión y los propósitos de la PUCP?, por público", g_barras(paste0(act, " (", LETTERS[1:4], ")"), pc, extra = letras, resid = rep(FALSE, 4),
  n_txt = sprintf("N = %s. Las letras indican frente a qué públicos la cifra es significativamente mayor", paste(sprintf("%d %s", ns, tolower(act)), collapse = ", "))), alto_barras(4),
  texto = "Los docentes conocen la misión en una proporción significativamente mayor que los estudiantes y los egresados. Los administrativos llegan a 93%, pero con 15 casos la diferencia no alcanza a ser significativa.")
newc <- function(x1, n1, x2, n2, z = 1.96) { w <- function(x, n) { p <- x / n; c_ <- (p + z^2 / (2 * n)) / (1 + z^2 / n); h <- z * sqrt(p * (1 - p) / n + z^2 / (4 * n^2)) / (1 + z^2 / n); c(c_ - h, c_ + h) }
  p1 <- x1 / n1; p2 <- x2 / n2; a <- w(x1, n1); b <- w(x2, n2); d <- p1 - p2; 100 * c(d, d - sqrt((p1 - a[1])^2 + (b[2] - p2)^2), d + sqrt((a[2] - p1)^2 + (p2 - b[1])^2)) }
it_s <- list(list("Conoce la misión", D$mision1[[1]]$n[1], D$mision1[[1]]$valid, D$mision1[[2]]$n[1], D$mision1[[2]]$valid),
             list("Sabe dónde consultarla", D$mision2[[1]]$n[1], D$mision2[[1]]$valid, D$mision2[[2]]$n[1], D$mision2[[2]]$valid),
             list("Tutoría académica (Top Two Box)", sum(o1$n[3:4]), o1$valid, sum(o2$n[3:4]), o2$valid),
             list("Tutoría socioemocional (Top Two Box)", { f_ <- fr("docentes", "p24_7"); sum(f_$n[3:4]) }, fr("docentes", "p24_7")$valid, { f_ <- fr("estudiantes", "p17_6"); sum(f_$n[3:4]) }, fr("estudiantes", "p17_6")$valid))
nc_ <- t(vapply(it_s, function(r) newc(r[[2]], r[[3]], r[[4]], r[[5]]), numeric(3)))
doc <- sit(doc, "Diferencias significativas, versión técnica", "Para un lector técnico, cada fila muestra la diferencia entre dos públicos con su intervalo de confianza de 95%. Si el intervalo no cruza el cero, la diferencia es significativa y el punto va lleno.")
doc <- grafico(doc, "Diferencia entre docentes y estudiantes, en puntos", g_forest(vapply(it_s, `[[`, "", 1), nc_[, 1], nc_[, 2], nc_[, 3], n_txt = "N = 52 docentes y 172 estudiantes. Intervalo de Newcombe al 95%",
  etq = c("Mayor en estudiantes", "Mayor en docentes")), 2.4)
sig_ <- nc_[, 2] > 0 | nc_[, 3] < 0
doc <- sit(doc, "Diferencias significativas, versión para público general", "Para un público general, los mismos datos sin intervalos: cada fila muestra a los dos públicos y la lectura dice en palabras cuáles diferencias son significativas.")
doc <- grafico(doc, "Docentes y estudiantes en cuatro preguntas", g_dos_grupos(vapply(it_s, `[[`, "", 1), round(100 * vapply(it_s, function(r) r[[2]] / r[[3]], 0)), round(100 * vapply(it_s, function(r) r[[4]] / r[[5]], 0)),
  c("Docentes", "Estudiantes"), n_txt = "N = 52 docentes y 172 estudiantes", lim = 100), 2.4,
  texto = { ini <- function(x) paste0(tolower(substr(x, 1, 1)), substring(x, 2)); nm <- ini(vapply(it_s, `[[`, "", 1))
    sprintf("La diferencia entre docentes y estudiantes es significativa en %s. En %s no lo es.", paste(nm[sig_], collapse = " y en "), if (any(!sig_)) paste(nm[!sig_], collapse = " y en ") else "ninguna") })
# ================= 5. Tablas
doc <- capitulo(doc, "Tablas", "Las tablas son tablas de Word del ancho del texto: filete azul arriba y abajo, filetes finos entre filas, encabezado en azul y la primera columna alineada con el texto. Llevan rótulo numerado arriba y base debajo, igual que los gráficos.")
doc <- seccion(doc, "Ficha técnica")
fic <- data.frame(Aspecto = c("Técnica", "Instrumento", "Actores consultados", "Respuestas válidas", "Tratamiento"),
  Detalle = c("Encuesta en línea autoadministrada", "Un cuestionario por actor, con preguntas comunes para comparar entre actores", paste(act, collapse = ", "),
              sprintf("%d en total: %s", sum(nact), paste(sprintf("%d %s", nact, tolower(act)), collapse = ", ")), "Base limpia y consistenciada. Las preguntas no obligatorias declaran su base"))
doc <- tabla(doc, "Ficha técnica del estudio", ft_base(fic, c(1.7, 4.57)), base = "Fuente: PULSO PUCP 2026.", zebra = FALSE)
doc <- seccion(doc, "Tabla de resultados por actor")
tab <- data.frame(Competencia = cn, Docentes = paste0(mm[, 1], "%"), Estudiantes = paste0(mm[, 2], "%"), Egresados = paste0(mm[, 3], "%"))
doc <- tabla(doc, "Top Two Box de cada competencia, por actor", ft_base(tab, c(2.4, 1.2, 1.2, 1.2)) |> align(j = 2:4, align = "center", part = "all"), base = "Base: 51 docentes, 109 estudiantes y 161 egresados. Fuente: PULSO PUCP 2026.")
doc <- seccion(doc, "Tabla técnica de frecuencias")
doc <- cuerpo(doc, "En el anexo, cada pregunta puede ir con su tabla técnica: la frecuencia y el porcentaje de cada respuesta, por público.", keep = TRUE)
fd <- fr("docentes", "p24_6"); fe <- fr("estudiantes", "p17_5")
tt <- data.frame(Respuesta = c(ROT, "Total"), `Docentes n` = c(fd$n, fd$valid), `Docentes %` = c(paste0(fd$pct, "%"), "100%"), `Estudiantes n` = c(fe$n, fe$valid), `Estudiantes %` = c(paste0(fe$pct, "%"), "100%"), check.names = FALSE)
doc <- tabla(doc, fd$pregunta, ft_base(tt, c(2.3, 1.0, 1.0, 1.0, 1.0)) |> align(j = 2:5, align = "center", part = "all") |> bold(i = 6), base = sprintf("Base: %d docentes y %d estudiantes. Fuente: PULSO PUCP 2026.", fd$valid, fe$valid))
doc <- seccion(doc, "Respuestas «Otros»")
doc <- cuerpo(doc, "Si las respuestas abiertas de «Otros» son muchas y dispersas, van en una tabla aparte, de mayor a menor, en dos bloques para aprovechar el ancho.", keep = TRUE)
otros <- data.frame(t = c("Ingeniero de proyectos", "Ingeniero de diseño", "Ingeniero de aplicaciones", "Planificador de mantenimiento", "Ingeniero de diseño mecánico", "Ingeniero de tuberías", "Ingeniero mecánico", "Asesor técnico comercial", "Comprador corporativo", "Consultor técnico"), n = c(7, 6, 5, 5, 2, 2, 2, 1, 1, 1))
tabo <- data.frame(`Puesto` = otros$t[1:5], `N.º` = otros$n[1:5], ` ` = "", `Puesto ` = otros$t[6:10], `N.º ` = otros$n[6:10], check.names = FALSE)
doc <- tabla(doc, "Respuestas «Otros» a la pregunta ¿Cuál es su puesto actual?", ft_base(tabo, c(2.3, 0.5, 0.3, 2.3, 0.5)) |> bold(j = 1, bold = FALSE) |> align(j = c(2, 5), align = "center", part = "all"), base = "Base: 62 respuestas en «Otros». Fuente: PULSO PUCP 2026.", zebra = FALSE)
doc <- seccion(doc, "Perfil con pocos casos")
doc <- cuerpo(doc, "Con pocos casos, un gráfico exagera las diferencias. El perfil va en una tabla con frecuencias y porcentajes.", keep = TRUE)
aut <- data.frame(Característica = c("Cargo", "", "", "Años en el cargo", "", "Máximo grado académico", ""),
  Categoría = c("Coordinador(a) de especialidad", "Jefe(a) de departamento", "Decano(a) o director(a)", "Menos de 3 años", "3 años o más", "Magíster", "Doctor(a)"),
  `N.º` = c(5, 4, 3, 7, 5, 4, 8), `%` = c("42%", "33%", "25%", "58%", "42%", "33%", "67%"), check.names = FALSE)
doc <- tabla(doc, "Perfil de las autoridades consultadas", ft_base(aut, c(1.9, 2.6, 0.8, 0.8)) |> align(j = 3:4, align = "center", part = "all"), base = "Base: 12 autoridades. Fuente: PULSO PUCP 2026.", zebra = FALSE)

# ================= 6. Estudios en PULSO
doc <- capitulo(doc, "Estudios en PULSO", "Un ejemplo corto por tipo de estudio, en el orden de lo que más se hace. Acreditación usa los datos del proyecto de referencia. Los demás usan cifras ficticias y no nombran instituciones.")
doc <- seccion(doc, "Acreditación universitaria")
doc <- cuerpo(doc, "El informe abre con la ficha técnica y el número de respuestas por actor, y sigue por capítulos del modelo de acreditación. Cada pregunta común se compara entre los actores que la respondieron.", keep = TRUE)
doc <- franja(doc, c(format(sum(nact), big.mark = ","), format(nact, big.mark = ",")), c("respuestas", tolower(act)))
for (mm_ in list(D$mision1)) doc <- grafico(doc, mm_[[1]]$pregunta, g_apilada(lapply(1:4, function(i) list(actor = act[i], pct = mm_[[i]]$pct[1:2])), c("Sí", "No"), c(WTK$azul_si, WTK$celeste), ttb = FALSE,
  n_txt = sprintf("N = %d docentes, %d estudiantes, %d egresados y %d administrativos", mm_[[1]]$valid, mm_[[2]]$valid, mm_[[3]]$valid, mm_[[4]]$valid)), alto_apilada(4),
  texto = sprintf("El %d%% de los docentes y el %d%% de los administrativos conoce la misión. Entre estudiantes y egresados la proporción es de %d%% y %d%%.", mm_[[1]]$pct[1], mm_[[4]]$pct[1], mm_[[2]]$pct[1], mm_[[3]]$pct[1]))
f1 <- fr("docentes", "p16_4"); f2 <- fr("egresados", "p21_3")
doc <- grafico(doc, f1$pregunta, g_apilada(list(list(actor = "Docentes", pct = f1$pct), list(actor = "Egresados", pct = f2$pct)), ROT, WTK$likert, n_txt = sprintf("N = %d docentes y %d egresados", f1$valid, f2$valid)), alto_apilada(2),
  texto = sprintf("El %d%% de los docentes y el %d%% de los egresados está de acuerdo o totalmente de acuerdo.", f1$pct[3] + f1$pct[4], f2$pct[3] + f2$pct[4]))
for (v in c("p11", "p12")) { f <- fr("egresados", v); doc <- grafico(doc, f$pregunta, g_sino(f$labels[1:2], f$pct[1:2], f$n[1:2], n_txt = sprintf("N = %d egresados", f$valid)), 1.5) }
# Más gráficos de acreditación (Gonzalo, 2026-10-08: «mostrar más ejemplos de gráficos por estudio»)
doc <- grafico(doc, "Top Two Box de las competencias del perfil de egreso, por actor", g_competencias(cn, mm, c("Docentes", "Estudiantes", "Egresados"), n_txt = "N = 51 docentes, 109 estudiantes y 161 egresados"), 2.6,
  texto = "Las seis competencias superan el 90% de acuerdo en los tres públicos. Las diferencias entre públicos son de pocos puntos.")
bat_ <- lapply(sprintf("p14_%d", 2:7), function(v) fr("administrativos", v))
doc <- grafico(doc, "Valoración del personal administrativo sobre su gestión y desarrollo", g_apilada(lapply(bat_, function(f) list(actor = f$pregunta, pct = f$pct)), ROT, WTK$likert, envolver = 34,
  n_txt = sprintf("N = %d administrativos", bat_[[1]]$valid)), alto_apilada(6) + 1.4)
doc <- grafico(doc, "Nivel curricular, estudiantes", g_columnas(ci$labels, ci$pct, n_txt = sprintf("N = %d estudiantes", ci$valid)), 2.2,
  texto = sprintf("La mayor parte de los estudiantes encuestados cursa %s (%d%%).", tolower(ci$labels[which.max(ci$pct)]), max(ci$pct)))
ed_e <- fr("estudiantes", "p3_recod")
doc <- grafico(doc, "Rango de edades de los estudiantes, 2026 frente a 2021", g_dos_grupos(ed_e$labels, ed_e$pct, pmax(1, ed_e$pct + rep_len(c(4, -2, -1, -1, 0), length(ed_e$pct))), c("2026", "2021"),
  n_txt = sprintf("N = %d estudiantes en 2026. 2021: informe consolidado anterior, cifras ilustrativas", ed_e$valid), lim = max(ed_e$pct) + 15), 2.4)
doc <- grafico(doc, "Satisfacción con la formación recibida, por programa", g_apilada(list(list(actor = "Contabilidad", pct = c(2, 9, 55, 33, 1)), list(actor = "Economía", pct = c(3, 12, 52, 31, 2)),
  list(actor = "Gestión", pct = c(4, 15, 50, 28, 3)), list(actor = "Finanzas", pct = c(2, 8, 49, 39, 2))), c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho", "Sin información"), WTK$likert,
  n_txt = "N = 1,644 estudiantes de cuatro programas. Acreditación con varios programas. Cifras ficticias"), alto_apilada(4))
mp_ <- matrix(c(88, 84, 79, 91, 83, 81, 86, 80, 76, 90, 85, 82), nrow = 3, dimnames = list(c("Plan de estudios", "Cuerpo académico", "Servicios de apoyo"), c("Contabilidad", "Economía", "Gestión", "Finanzas")))
doc <- grafico(doc, "Tres dimensiones de la formación, por programa (Top Two Box)", g_heat(mp_, n_txt = "N = 1,644 estudiantes de cuatro programas. Cifras ficticias", lo = 70, hi = 100), 2.0)
doc <- seccion(doc, "Opinión pública")
doc <- cuerpo(doc, "Encuesta a la población en una o varias olas. Las preguntas se cruzan por edad, sexo o zona, y la fila Total va al final.", keep = TRUE)
doc <- grafico(doc, "La democracia es preferible a cualquier otra forma de gobierno, por grupo de edad", g_apilada(list(list(actor = "18 a 29 años", pct = c(9, 21, 44, 22, 4)), list(actor = "30 a 59 años", pct = c(6, 17, 46, 27, 4)), list(actor = "60 años a más", pct = c(4, 12, 43, 37, 4)), list(actor = "Total", pct = c(6, 17, 45, 28, 4))),
  c("Muy en desacuerdo", "En desacuerdo", "De acuerdo", "Muy de acuerdo", "NS/NR"), WTK$likert, n_txt = "N = 1,200 entrevistados: 312 de 18 a 29 años, 641 de 30 a 59 y 247 de 60 a más. Cifras ficticias"), alto_apilada(4))
doc <- grafico(doc, "Aprobación de la gestión en cuatro mediciones", g_serie(c("Marzo", "Junio", "Setiembre", "Diciembre"), list(Aprueba = c(41, 37, 33, 35), Desaprueba = c(52, 56, 60, 58)), n_txt = "N = 1,200 entrevistados en cada ola. Cifras ficticias"), 2.4,
  texto = "La aprobación baja de 41% en marzo a 33% en setiembre y se recupera 2 puntos en diciembre.")
doc <- grafico(doc, "Opinión sobre la gestión, Lima Metropolitana frente al resto del país", g_dos_grupos(c("Aprueba la gestión del gobierno", "Confía en el Congreso", "Cree que la economía mejorará", "Se siente seguro en su barrio"),
  c(31, 12, 38, 42), c(39, 15, 45, 51), c("Lima Metropolitana", "Resto del país"), n_txt = "N = 1,200 entrevistados: 480 en Lima Metropolitana y 720 en el resto del país. Cifras ficticias", lim = 70), 2.4)
doc <- grafico(doc, "¿Cuál es el principal problema del país?", g_barras(c("Corrupción", "Delincuencia e inseguridad", "Economía y empleo", "Salud", "Educación", "Otro", "No sabe"), c(34, 29, 18, 7, 5, 4, 3),
  n_txt = "N = 1,200 entrevistados. Cifras ficticias"), alto_barras(7))
doc <- grafico(doc, "Indicadores de la línea base", g_barras(c("Confía en la municipalidad", "Participa en organizaciones vecinales", "Se siente seguro en su barrio", "Conoce los servicios del distrito", "Recicla en casa"), c(28, 17, 39, 46, 22),
  n_txt = "N = 800 entrevistados en la línea base. Cifras ficticias", destacar = FALSE), alto_barras(5))
doc <- seccion(doc, "Estudio territorial con grupo de comparación")
doc <- cuerpo(doc, "Encuesta en zonas de intervención y de comparación. El mapa ubica los distritos y cada indicador muestra los dos grupos lado a lado.", keep = TRUE)
grupo <- c(`SAN JUAN DE LURIGANCHO` = "Intervención", ATE = "Intervención", `EL AGUSTINO` = "Intervención", `SANTA ANITA` = "Intervención",
           `VILLA EL SALVADOR` = "Comparación", `VILLA MARIA DEL TRIUNFO` = "Comparación", `SAN JUAN DE MIRAFLORES` = "Comparación", CHORRILLOS = "Comparación")
kg <- ifelse(LIMA$distrito %in% names(grupo), grupo[LIMA$distrito], "Fuera del estudio")
bb_ <- sf::st_bbox(LIMA[LIMA$distrito %in% names(grupo), ]); bb_ <- bb_ + c(-0.04, -0.03, 0.04, 0.03)
LIMA_c <- suppressWarnings(suppressMessages(sf::st_crop(sf::st_make_valid(LIMA), bb_)))
doc <- grafico(doc, "Distritos del estudio por grupo", g_mapa(LIMA_c, ifelse(LIMA_c$distrito %in% names(grupo), grupo[LIMA_c$distrito], "Fuera del estudio"),
  c(`Intervención` = "#2F4B7C", `Comparación` = "#9FB1D1", `Fuera del estudio` = "#E2E6EC"), "Distritos", alto = 3.6, n_txt = "N = 189 entrevistados. Selección ficticia sobre la cartografía de Lima Metropolitana y Callao (IMP PlanMet 2040)"), 3.6)
doc <- grafico(doc, "Percepción de la comunidad de acogida, por grupo", g_dos_grupos(c("Considera que la población refugiada aporta a su barrio", "Tiene un vecino de otra nacionalidad con quien conversa", "Participó en una actividad comunitaria en el último año", "Se siente seguro caminando de noche en su barrio"),
  c(58, 64, 31, 47), c(46, 59, 22, 45), c("Intervención", "Comparación"), n_txt = "N = 99 entrevistados en distritos de intervención y 90 en distritos de comparación. Cifras ficticias", lim = 80), 2.6)
zonas_c$apl <- ifelse(v9 > 0, "Zona aplicada", "Fuera de la muestra")
doc <- grafico(doc, "Zonas aplicadas en un distrito de intervención", g_mapa(zonas_c, zonas_c$apl, c(`Zona aplicada` = "#2F4B7C", `Fuera de la muestra` = "#FFFFFF"), "Zonas", borde = "#B8C2D3", lw = 0.15, alto = 3.8,
  n_txt = sprintf("N = %d zonas aplicadas de %d. Selección ficticia sobre las zonas censales INEI 2017", sum(v9 > 0), n9)), 3.8)
doc <- grafico(doc, "Me siento seguro caminando de noche en mi barrio, por grupo", g_apilada(list(list(actor = "Intervención", pct = c(14, 25, 41, 16, 4)), list(actor = "Comparación", pct = c(16, 27, 39, 14, 4))), ROT, WTK$likert,
  n_txt = "N = 99 entrevistados en distritos de intervención y 90 en distritos de comparación. Cifras ficticias"), alto_apilada(2))
doc <- grafico(doc, "Servicios del barrio que usó en el último año", g_barras(c("Centro de salud", "Comedor o olla común", "Parque o losa deportiva", "Comisaría", "Biblioteca o centro cultural", "Ninguno"), c(58, 31, 27, 12, 6, 9),
  n_txt = "N = 189 entrevistados. Opción múltiple: los porcentajes pueden sumar más de 100. Cifras ficticias"), alto_barras(6))
zsjl <- leer_capa("zonas_inei2017_lima_callao", "150132"); zsjl <- zsjl[!sf::st_is_empty(zsjl), ]; zsjl$apl <- racimos(zsjl, 26, 2026)
doc <- grafico(doc, "Zonas aplicadas en intervención y comparación", g_mapas2(list(zsjl, zves), c("Intervención: San Juan de Lurigancho", "Comparación: Villa El Salvador"),
  list(ifelse(zsjl$apl, "Intervención", "Fuera de la muestra"), ifelse(zves$apl, "Comparación", "Fuera de la muestra")),
  c(`Intervención` = "#2F4B7C", `Comparación` = "#9FB1D1", `Fuera de la muestra` = "#FFFFFF"), "Zonas aplicadas",
  n_txt = sprintf("N = %d zonas en intervención y %d en comparación. Selección ficticia sobre las zonas censales INEI 2017", sum(zsjl$apl), sum(zves$apl))), 3.6)
doc <- seccion(doc, "Monitoreo posdistribución")
doc <- cuerpo(doc, "Encuesta telefónica a los hogares que recibieron una asistencia. Cada indicador se lee frente a su meta.", keep = TRUE)
doc <- grafico(doc, "Indicadores de la asistencia frente a su meta", g_metas(c("Recibió la asistencia en la fecha prevista", "Retiró el dinero sin problemas de acceso", "Usó el efectivo en necesidades básicas", "Conoce cómo presentar una queja", "Se sintió tratado con respeto"),
  c(86, 78, 92, 41, 95), c(80, 85, 90, 60, 90), n_txt = "N = 2,296 hogares entrevistados por teléfono. Cifras ficticias"), 2.9,
  texto = "Tres de los cinco indicadores alcanzan su meta. El conocimiento del mecanismo de quejas queda 19 puntos por debajo de la suya.")
doc <- grafico(doc, "¿Recibió la asistencia completa?", g_sino(c("Sí", "No"), c(91, 9), c(2089, 207), n_txt = "N = 2,296 hogares. Cifras ficticias"), 1.5)
doc <- grafico(doc, "¿En qué usó principalmente el dinero recibido?", g_barras(c("Alimentos", "Alquiler de vivienda", "Salud y medicinas", "Pago de deudas", "Educación", "Otro"), c(82, 46, 23, 15, 11, 4),
  n_txt = "N = 2,296 hogares. Opción múltiple: los porcentajes pueden sumar más de 100. Cifras ficticias"), alto_barras(6))
doc <- grafico(doc, "Indicadores clave en tres rondas de monitoreo", g_serie(c("Ronda 1", "Ronda 2", "Ronda 3"), list(`Recibió a tiempo` = c(74, 81, 86), `Conoce cómo quejarse` = c(28, 35, 41)),
  n_txt = "N = 2,140, 2,205 y 2,296 hogares en cada ronda. Cifras ficticias"), 2.4,
  texto = "Los dos indicadores mejoran ronda a ronda. El conocimiento del mecanismo de quejas sube 13 puntos, pero sigue lejos de su meta de 60%.")
doc <- grafico(doc, "Satisfacción con la entrega, por modalidad", g_apilada(list(list(actor = "Transferencia", pct = c(3, 7, 48, 40, 2)), list(actor = "Retiro en agencia", pct = c(8, 15, 51, 24, 2))),
  c("Muy insatisfecho", "Insatisfecho", "Satisfecho", "Muy satisfecho", "Sin información"), WTK$likert, n_txt = "N = 310 hogares con transferencia y 190 con retiro en agencia. Cifras ficticias"), alto_apilada(2))
doc <- seccion(doc, "Encuesta en aulas")
doc <- cuerpo(doc, "Encuesta aplicada en aulas, con una muestra por facultad. Junto al porcentaje va el número de casos, porque las facultades tienen tamaños muy distintos.", keep = TRUE)
doc <- grafico(doc, "Estudiantes que vivieron al menos una situación de hostigamiento, por facultad", g_barras(c("Ciencias Sociales", "Arquitectura", "Derecho", "Artes", "Ingeniería", "Educación", "Ciencias Contables"), c(31, 27, 24, 22, 19, 18, 15), con_n = c(412, 188, 305, 24, 690, 96, 140),
  n_txt = "N = 1,855 estudiantes encuestados en aula. Entre paréntesis, los casos de cada facultad. Cifras ficticias"), alto_barras(7))
doc <- grafico(doc, "Estudiantes que vivieron al menos una situación de hostigamiento, por sexo", g_dos_grupos(c("Comentarios sobre su apariencia", "Miradas o gestos incómodos", "Mensajes no deseados en redes", "Contacto físico no deseado"),
  c(27, 22, 15, 9), c(12, 9, 7, 3), c("Mujeres", "Hombres"), n_txt = "N = 1,855 estudiantes: 1,011 mujeres y 844 hombres. Cifras ficticias", lim = 40), 2.4)
hf_ <- matrix(c(18, 14, 9, 6, 15, 11, 8, 4, 13, 10, 6, 3, 11, 8, 5, 3), nrow = 4, dimnames = list(c("Comentarios sobre su apariencia", "Miradas o gestos incómodos", "Mensajes no deseados", "Contacto físico no deseado"), c("Sociales", "Derecho", "Ingeniería", "Contables")))
doc <- grafico(doc, "Situaciones de hostigamiento por tipo y facultad", g_heat(hf_, n_txt = "N = 1,547 estudiantes de cuatro facultades. Cifras ficticias", lo = 0, hi = 20), 2.2)
doc <- grafico(doc, "¿Sabe a dónde acudir para presentar una denuncia?", g_sino(c("Sí", "No"), c(38, 62), c(705, 1150), n_txt = "N = 1,855 estudiantes. Cifras ficticias"), 1.5,
  texto = "Seis de cada diez estudiantes no sabe a dónde acudir para presentar una denuncia.")
doc <- grafico(doc, "Aulas aplicadas frente a las previstas, por facultad", g_metas(c("Ciencias Sociales", "Arquitectura", "Derecho", "Artes", "Ingeniería", "Educación", "Ciencias Contables"), c(96, 88, 92, 70, 98, 85, 91), rep(90, 7),
  n_txt = "Porcentaje de aulas aplicadas sobre las previstas. Meta: 90%. Cifras ficticias"), 2.9)
doc <- seccion(doc, "Encuesta organizacional")
doc <- cuerpo(doc, "Encuesta a dos actores de una organización, trabajadores y directivos. Las mismas afirmaciones se comparan entre ambos.", keep = TRUE)
doc <- grafico(doc, "Hombres y mujeres tienen las mismas oportunidades de ascenso", g_apilada(list(list(actor = "Trabajadores", pct = c(6, 22, 47, 22, 3)), list(actor = "Directivos", pct = c(1, 6, 45, 47, 1))), ROT, WTK$likert,
  n_txt = "N = 420 trabajadores y 38 directivos. Cifras ficticias"), alto_apilada(2))
doc <- grafico(doc, "Brecha entre trabajadores y directivos (Top Two Box)", g_dos_grupos(c("Oportunidades de ascenso", "Selección transparente", "Conciliación familiar", "Trato respetuoso", "Canal de denuncias conocido"), c(92, 88, 87, 90, 79), c(69, 62, 75, 81, 44),
  c("Directivos", "Trabajadores"), n_txt = "N = 38 directivos y 420 trabajadores. Cifras ficticias", lim = 100), 2.6,
  texto = "La mayor brecha está en el canal de denuncias: el 79% de los directivos lo conoce, frente al 44% de los trabajadores.")
ho_ <- matrix(c(64, 71, 58, 92, 59, 66, 52, 88, 72, 80, 69, 95, 61, 70, 55, 90), nrow = 4, dimnames = list(c("Oportunidades de ascenso", "Selección transparente", "Conciliación familiar", "Trato respetuoso"), c("Operaciones", "Administración", "Comercial", "Directivos")))
doc <- grafico(doc, "Igualdad de oportunidades por área (Top Two Box)", g_heat(ho_, n_txt = "N = 458 personas: 196 de operaciones, 104 de administración, 120 del área comercial y 38 directivos. Cifras ficticias", lo = 50, hi = 100), 2.2)
doc <- grafico(doc, "Qué debería mejorar primero la organización", g_lollipop(c("Transparencia en los ascensos", "Horarios flexibles", "Canal de denuncias confidencial", "Capacitación en igualdad", "Licencias por cuidado"), c(41, 33, 28, 19, 14),
  n_txt = "N = 420 trabajadores. Cifras ficticias"), 2.6)
doc <- grafico(doc, "Políticas de la organización que conocen los trabajadores", g_barras(c("Código de ética", "Política contra el hostigamiento", "Licencias por cuidado", "Teletrabajo", "Política de igualdad salarial", "Ninguna"), c(78, 61, 44, 39, 22, 6),
  n_txt = "N = 420 trabajadores. Opción múltiple. Cifras ficticias"), alto_barras(6))
doc <- seccion(doc, "Evaluación antes y después")
doc <- cuerpo(doc, "La misma población se mide al inicio y al final de una intervención. Cada indicador muestra las dos mediciones y la diferencia en puntos.", keep = TRUE)
doc <- grafico(doc, "Indicadores del programa en la línea de base y en la medición final", g_dos_grupos(c("Ahorra una parte de su ingreso", "Lleva un registro de sus gastos", "Conoce cómo acceder a un crédito formal", "Tiene una cuenta en una entidad financiera"), c(48, 41, 57, 63), c(31, 22, 39, 52),
  c("Final", "Línea de base"), n_txt = "N = 312 participantes medidos en las dos ocasiones. Cifras ficticias", lim = 80), 2.4,
  texto = "Los cuatro indicadores suben entre la línea de base y la medición final. El registro de gastos es el que más avanza, 19 puntos.")

doc <- grafico(doc, "Me siento capaz de administrar el dinero de mi hogar, en la línea de base y en la medición final", g_apilada(list(list(actor = "Línea de base", pct = c(12, 31, 43, 11, 3)), list(actor = "Medición final", pct = c(5, 17, 52, 24, 2))), ROT, WTK$likert,
  n_txt = "N = 312 participantes medidos en las dos ocasiones. Cifras ficticias"), alto_apilada(2))
doc <- grafico(doc, "Puntaje promedio en la prueba de conocimientos financieros (de 0 a 20)", g_promedios(c("Línea de base", "Medición final"), c(9.8, 13.4), n_txt = "N = 312 participantes. Cifras ficticias", unidad = " puntos"), 2.0,
  texto = "El puntaje promedio sube 3.6 puntos entre la línea de base y la medición final.")

doc <- grafico(doc, "Cuánto cambió cada indicador entre la línea de base y la medición final", g_cambio(c("Ahorra una parte de su ingreso", "Lleva un registro de sus gastos", "Conoce cómo acceder a un crédito formal", "Tiene una cuenta en una entidad financiera", "Tiene deudas atrasadas"), c(17, 19, 18, 11, -6),
  n_txt = "N = 312 participantes medidos en las dos ocasiones. Cifras ficticias"), 2.4,
  texto = "Cuatro indicadores suben entre 11 y 19 puntos. Las deudas atrasadas bajan 6 puntos, que en este indicador es una mejora.")

# Referencias en formato APA, con sangría francesa (estilo «Referencia», word_nativo.py)
doc <- cerrar_seccion(doc, CAP_PREV)
doc <- body_add_par(doc, "Referencias", style = "heading 1")
it <- function(t) ftext(t, fp_text_lite(italic = TRUE)); nt <- function(t) ftext(t)
refs <- list(
  list(nt("Agresti, A. (2013). "), it("Categorical data analysis"), nt(" (3.ª ed.). Wiley.")),
  list(nt("American Psychological Association. (2020). "), it("Publication manual of the American Psychological Association"), nt(" (7.ª ed.). https://doi.org/10.1037/0000165-000")),
  list(nt("Cumming, G., y Finch, S. (2005). Inference by eye: Confidence intervals and how to read pictures of data. "), it("American Psychologist, 60"), nt("(2), 170-180. https://doi.org/10.1037/0003-066X.60.2.170")),
  list(nt("Dunn, O. J. (1961). Multiple comparisons among means. "), it("Journal of the American Statistical Association, 56"), nt("(293), 52-64. https://doi.org/10.1080/01621459.1961.10482090")),
  list(nt("Few, S. (2012). "), it("Show me the numbers: Designing tables and graphs to enlighten"), nt(" (2.ª ed.). Analytics Press.")),
  list(nt("Tufte, E. R. (2001). "), it("The visual display of quantitative information"), nt(" (2.ª ed.). Graphics Press.")))
for (r in refs) doc <- cita(doc, r)
# Anexo: cada alternativa de diseño a página completa (Gonzalo, 2026-10-08: «pones distintas portadas, índices y otras cosas pero no las muestras»)
doc <- cerrar_seccion(doc, "Referencias")
doc <- body_add_par(doc, "Anexo. Alternativas de diseño", style = "heading 1")
doc <- cuerpo(doc, "Cada alternativa del capítulo 1, a página completa. Son documentos de Word reales, armados con los mismos estilos de esta propuesta.")
an_ <- mini_png(mn_, res = 160, paginas = c(1, 1, 1, 1, 1, 1, 1, 2, 1))
an_t <- c("A.1. Portada A, tipográfica (recomendada)", "A.2. Portada B, con banda lateral", "A.3. Portada C, con ficha del encargo", "A.4. Índice A, clásico (recomendado)", "A.5. Índice B, con el número del capítulo en columna",
          "A.6. Apertura de capítulo A, sobria", "A.7. Apertura de capítulo B, con número grande y mapa del capítulo (recomendada)", "A.8. Página interior con el recuadro «Cómo leer este informe»", "A.9. Contraportada")
for (k in seq_along(an_)) { if (k > 1) doc <- body_add_break(doc)
  doc <- body_add_par(doc, an_t[k], style = "heading 2")
  doc <- body_add_fpar(doc, fpar(external_img(an_[k], width = 5.6, height = 5.6 * 11.69 / 8.27), fp_p = fp_par(text.align = "center"))) }
doc <- cerrar_seccion(doc, "Anexo")
doc <- contraportada(doc)
print(doc, target = Sys.getenv("SALIDA"))
system2("python3", c(shQuote("docs/qa/motor-ppt-2026-10-06/herramientas/word_nativo.py"), shQuote(Sys.getenv("SALIDA")))); cat("OK", GN, "gráficos y", TN, "tablas\n")
