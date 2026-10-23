# =============================================================================
# reporte_word_documento.R — el Word del recetario armado desde render_meta (N8.15)
# =============================================================================
#
# La fachada del documento completo (ADR 0093; Gonzalo, R9: «El documento completo»): portada con los logos, índices,
# «Cómo leer este informe» cuando hay escalas, un capítulo por sección de nivel 1 con su apertura, encabezado y folio,
# las figuras con su rótulo SEQ, base y renderer del recetario (`.word_grafico`), las tablas técnicas y la contraportada.
# Recorre la misma `render_meta` que el Word clásico (`reporte_word_plan`), que lo llama con
# `estilo_documento = "recetario"`.

# Un texto de una entrada: NULL, NA o vacío dan "" (as.character(NULL)[1] es NA).
.word_txt1 <- function(x) { x <- as.character(x %||% ""); if (!length(x) || is.na(x[1])) "" else trimws(x[1]) }

# Siglas que se conservan al pasar un título en mayúsculas a tipo oración. Lo que lleva «+» o va entre paréntesis
# («(I+D+i)») también se conserva. Los nombres propios (Lima, Contabilidad) no se pueden distinguir desde las mayúsculas:
# bajan a minúscula, y el plan puede escribirlos ya en tipo oración.
.WORD_SIGLAS <- c("PUCP", "PULSO", "ACNUR", "UNSA", "SPSS", "ONG", "IA", "TI", "PDM", "CBI", "KOICA", "MEF", "INEI", "SUNEDU", "SINEACE", "ACRD",
                  "OCDE", "BID", "MINEDU", "MINSA", "ONU", "OEA", "UNESCO", "UNICEF", "CONCYTEC", "OIT", "OMS", "TIC", "PBI", "ODS")

#' Un título escrito en mayúsculas (convención del PPT fiel) pasa a tipo oración como en el recetario Word, conservando
#' siglas; la primera letra va en mayúscula aunque el título empiece con «¿», «¡», comillas o un número. Un título que ya
#' trae minúsculas (más de un décimo de sus letras) queda como está.
#' @keywords internal
.word_oracion <- function(x) {
  x <- .word_txt1(x)
  letras <- gsub("[^[:alpha:]]", "", x)
  if (nchar(letras) < 4L) return(x)
  minus <- nchar(gsub("[^[:lower:]]", "", letras))
  if (minus > nchar(letras) / 10) return(x)                      # ya está en tipo oración o mixto: no se toca
  orig <- strsplit(x, " ", fixed = TRUE)[[1]]
  p <- tolower(orig)
  conservar <- gsub("[^[:alpha:]]", "", orig) %in% .WORD_SIGLAS | grepl("+", orig, fixed = TRUE) | grepl("^\\(.*\\)[[:punct:]]*$", orig)
  p[conservar] <- orig[conservar]
  out <- paste(p, collapse = " ")
  k <- regexpr("[[:alpha:]]", out)                               # la primera LETRA, no el «¿» ni el «1.»
  if (k > 0) substr(out, k, k) <- toupper(substr(out, k, k))
  out
}

#' Nivel de un separador en el Word: 1 = capítulo con apertura, 2 = sección N.M dentro del capítulo
#'
#' Un `meta$word_heading_level` explícito manda; si no hay, un subcapítulo de la app (`meta$nivel = "subcapitulo"`) es
#' una sección N.M y todo lo demás es capítulo. Antes se leía sólo el nivel explícito (1 por defecto), y un subcapítulo
#' salía como capítulo propio con su apertura y una página casi vacía (decisión de Gonzalo, 2026-10-15: N.M).
#' @keywords internal
.word_nivel_seccion <- function(meta) {
  meta <- meta %||% list()
  n <- suppressWarnings(as.integer(unlist(meta$word_heading_level)[1]))
  if (length(n) && is.finite(n) && !is.na(n) && n >= 1L) return(n)
  if (identical(as.character(unlist(meta$nivel)[1] %||% ""), "subcapitulo")) 2L else 1L
}

#' Título corto del encabezado: el que se dé o el título del informe cortado en la última palabra antes de 60 caracteres
#' @keywords internal
.word_titulo_corto <- function(titulo, dado = NULL, max = 60L) {
  if (nzchar(.word_txt1(dado))) return(.word_txt1(dado))
  t <- .word_oracion(titulo)
  if (nchar(t) <= max) return(t)
  corte <- substr(t, 1, max); corte <- sub("\\s+\\S*$", "", corte)
  paste0(sub("[,;:]$", "", corte), "…")
}

#' Opciones del documento Word del recetario cuando el editor no decide nada
#'
#' La autoridad del default (ADR 0094): `config.documento_word` guarda sólo lo que difiere de aquí
#' (`.graficos_documento_word_solo_decisiones`). `redondeo` es el suelo de esta función, pero `reporte_word_plan` lo
#' deduce siempre del informe antes de llamarla (`.word_redondeo_documento`), así que en el proyecto no tiene default
#' fijo: un «estandar» elegido es una decisión.
#' @keywords internal
.DOCUMENTO_WORD_DEFAULTS <- list(portada = "A", apertura = "B", como_leer = NULL, redondeo = "estandar",
                                 contacto = list(), meta_portada = list())

#' Arma el Word del recetario desde `render_meta`
#'
#' @param render_meta Lista de entradas de `reporte_ppt_plan(solo_lista = TRUE, build_render_meta = TRUE)`.
#' @param path_docx Archivo de salida.
#' @param fuente Fuente que cierra cada base («Fuente: PULSO PUCP 2026.»).
#' @param opciones Lista: `portada` («A», «B», «C»), `apertura` («B», «A»), `como_leer` (`NULL`/«auto» = por conteo: cada recurso en >= 2 láminas del plan, `.word_como_leer_auto`; `TRUE`/`FALSE`; o un vector de claves de `.WORD_COMO_LEER_SECCIONES` para llevar sólo esas secciones),
#'   `indices` (`list(contenido = TRUE, graficos = "inicio"|"anexo"|FALSE, tablas = igual)`; default los tres al inicio),
#'   `redondeo` («estandar», «resto_mayor»), `contacto` (para la contraportada), `meta_portada` (ante, para, version...),
#'   `logos` (rutas de los logos propios del cliente por lugar: `portada_izquierda`, `portada_derecha`, `contraportada`;
#'   sólo las pone el worker desde `estilo_cliente`, nunca el body).
#' @return Invisible: `list(path, figuras, tablas, avisos)`.
#' @keywords internal
.word_documento <- function(render_meta, path_docx, fuente = NULL, opciones = list(), mensajes = FALSE) {
  op <- utils::modifyList(.DOCUMENTO_WORD_DEFAULTS, opciones)
  avisos <- character(0); avisar <- function(...) { m <- paste0(...); avisos <<- c(avisos, m); message("[PULSO-AVISO] ", m) }
  base_de <- function(e) {
    partes <- c(if (nzchar(trimws(as.character(e$base %||% "")[1]))) trimws(as.character(e$base)[1]),
                if (!isTRUE(e$base_multi_source) && nzchar(trimws(as.character(fuente %||% "")[1]))) trimws(as.character(fuente)[1]))
    if (length(partes)) paste(partes, collapse = " ") else NULL
  }
  tit <- Filter(function(e) identical(e$kind, "title_doc"), render_meta)
  titulo_informe <- if (length(tit) && nzchar(.word_txt1(tit[[1]]$title))) .word_oracion(tit[[1]]$title) else "Informe"
  titulo_corto <- .word_titulo_corto(titulo_informe, op$titulo_corto)
  hay_escalas <- any(vapply(render_meta, function(e) identical(e$kind %||% "chart", "chart") &&
                              identical(as.character((attr(e$plot_word, "pulso_espec") %||% list())$tipo %||% "")[1], "escala"), TRUE))
  hay_bottom <- any(vapply(render_meta, function(e) {
    esp <- attr(e$plot_word, "pulso_espec"); is.list(esp) && !is.null(esp$box2)
  }, TRUE))
  con_tablas <- any(vapply(render_meta, function(e) isTRUE(e$kind %in% c("technical_table", "otros_tabla")), TRUE))

  # B55: los PNG de cada figura (y la copia que officer hace al insertarlos) viven en tempdir() hasta que print(doc)
  # empaqueta el docx; se borran al salir, también si algo falla antes.
  pngs_antes <- list.files(tempdir(), pattern = "\\.png$", full.names = TRUE)
  on.exit(unlink(setdiff(list.files(tempdir(), pattern = "\\.png$", full.names = TRUE), pngs_antes)), add = TRUE)
  doc <- .word_documento_nuevo()
  # Portada sola en su página, con los logos en el encabezado de la primera página.
  t1 <- if (length(tit)) tit[[1]] else list()
  meta <- utils::modifyList(list(titulo = titulo_informe, sub = .word_txt1(t1$subtitle), fecha = .word_txt1(t1$date)), op$meta_portada)
  doc <- .word_portada(doc, meta, op$portada)
  doc <- .word_cerrar_capitulo(doc, "", titulo_corto, primera = .word_logos(logos = op$logos %||% list()))
  ind <- .word_indices_opciones(op$indices)
  if (isTRUE(ind$contenido) || identical(ind$graficos, "inicio") || (con_tablas && identical(ind$tablas, "inicio"))) {
    doc <- .word_indices(doc, con_tablas = con_tablas, indices = ind, donde = "inicio")
    doc <- .word_cerrar_capitulo(doc, "Contenido", titulo_corto)
  }

  figura <- 1L; tabla <- 1L; cap <- 0L; sec <- 0L; cap_titulo <- NULL
  cerrar <- function(doc) if (is.null(cap_titulo)) doc else .word_cerrar_capitulo(doc, cap_titulo, titulo_corto)
  # Lo que el plan pone antes de su primera sección (objetivo, presentación) va en un capítulo «Introducción»; «Cómo leer
  # este informe» va justo antes de la primera sección de resultados, como en el recetario (diseño metodológico).
  # `como_leer`: NULL (si hay escalas), TRUE/FALSE, o un vector de secciones (`.WORD_COMO_LEER_SECCIONES`) que lo enciende
  # sólo con esas.
  cl <- op$como_leer
  # Ausente o «auto»: por conteo en el plan (`.word_como_leer_auto`: recurso en >= 2 láminas); explícito, manda.
  if (identical(cl, "auto")) cl <- NULL
  if (is.null(cl) && hay_escalas) cl <- .word_como_leer_auto(render_meta)
  secciones_como_leer <- if (is.character(cl)) cl else NULL
  usa_como_leer <- if (is.character(cl)) length(cl) > 0L else isTRUE(cl)
  falta_como_leer <- usa_como_leer
  abrir_intro <- function(doc) {
    if (!is.null(cap_titulo)) return(doc)
    cap <<- cap + 1L; sec <<- 0L; cap_titulo <<- "Introducción"
    .word_apertura(doc, cap, "Introducción", variante = op$apertura)
  }
  poner_como_leer <- function(doc) {
    if (!falta_como_leer) return(doc)
    falta_como_leer <<- FALSE
    doc <- cerrar(doc); cap <<- cap + 1L
    doc <- .word_como_leer(doc, numero = cap, redondeo = op$redondeo, con_bottom = hay_bottom, figura = figura, tabla = tabla, variante_apertura = op$apertura, ponderada = isTRUE(op$ponderacion$ponderada), secciones = secciones_como_leer)
    sig <- attr(doc, "siguientes"); figura <<- sig[["figura"]]; tabla <<- sig[["tabla"]]
    cap_titulo <<- "Cómo leer este informe"
    doc
  }
  saltar <- integer(0)
  for (i in seq_along(render_meta)) {
    if (i %in% saltar) next
    e <- render_meta[[i]]; kind <- e$kind %||% "chart"
    if (isTRUE(mensajes)) message(sprintf("  Word %03d/%03d — %s", i, length(render_meta), kind))
    if (identical(kind, "title_doc")) next
    if (identical(kind, "section")) {
      nivel <- .word_nivel_seccion(e$meta)
      titulo <- .word_oracion(sub("^\\s*\\d+(?:\\.\\d+)*\\.?\\s+", "", .word_txt1(e$title), perl = TRUE))
      if (nivel <= 1L) {
        doc <- poner_como_leer(doc)
        doc <- cerrar(doc); cap <- cap + 1L; sec <- 0L; cap_titulo <- titulo
        doc <- .word_apertura(doc, cap, titulo, intro = .word_txt1(e$word_intro %||% e$subtitle), variante = op$apertura)
      } else {
        sec <- sec + 1L
        doc <- .word_seccion(doc, titulo, if (cap > 0L) paste0(cap, ".", sec) else NULL)
        doc <- .word_entrada(doc, .word_txt1(e$subtitle))
      }
      next
    }
    if (identical(kind, "text")) {
      doc <- abrir_intro(doc); sec <- sec + 1L
      doc <- .word_seccion(doc, .word_oracion(e$title), paste0(cap, ".", sec))
      doc <- .word_cuerpo(doc, paste(e$text, collapse = " "))
      next
    }
    if (identical(kind, "technical_table")) {
      doc <- abrir_intro(doc)
      if (is.data.frame(e$table) && nrow(e$table)) { doc <- .word_tabla_tecnica(doc, tabla, e); tabla <- tabla + 1L }
      else avisar("La tabla técnica «", e$title %||% "", "» no trae filas y no entra al Word.")
      next
    }
    if (identical(kind, "otros_tabla")) { doc <- .word_otros_tabla(doc, tabla, e); tabla <- tabla + 1L; next }   # decisión 21: reporte_word_otros.R
    if (!identical(kind, "chart")) next
    # Un gráfico es un resultado: si todavía no hay capítulo de resultados (plan sin secciones, o gráficos antes de la
    # primera), primero va «Cómo leer» y después un capítulo «Resultados» (verificador de N8.15).
    if (is.null(cap_titulo) || cap_titulo %in% c("Introducción", "Cómo leer este informe")) {
      doc <- poner_como_leer(doc); doc <- cerrar(doc)
      cap <- cap + 1L; sec <- 0L; cap_titulo <- "Resultados"
      doc <- .word_apertura(doc, cap, "Resultados", variante = op$apertura)
    }
    p <- e$plot_word
    # Cifras destacadas (F6.0b.6): las seguidas van juntas en una franja (`.word_franja`, RW:321), no como figuras.
    if (!is.null(attr(p, "pulso_cifra"))) {
      j <- i
      while (j < length(render_meta) && identical(render_meta[[j + 1L]]$kind %||% "chart", "chart") &&
             !is.null(attr(render_meta[[j + 1L]]$plot_word, "pulso_cifra")) &&
             !is.null(e$slide_i) && identical(render_meta[[j + 1L]]$slide_i, e$slide_i)) j <- j + 1L   # una franja por lámina
      items <- lapply(render_meta[i:j], function(x) attr(x$plot_word, "pulso_cifra"))
      doc <- .word_franja(doc, vapply(items, function(it) it$valor_word %||% it$valor, ""), vapply(items, `[[`, "", "rotulo"))
      saltar <- c(saltar, seq.int(i, j)); next
    }
    # Un dibujo sin título ni espec (la lámina de objetivo con íconos del PPT) no es una figura del informe Word.
    if (identical(e$etype, "ggplot_raw") && !nzchar(.word_txt1(e$title)) && is.null(attr(p, "pulso_espec"))) {
      avisar("Un dibujo sin título de la lámina ", i, " (íconos de identidad del PPT) no entra al Word como figura."); next }
    if (!inherits(p, "ggplot")) { avisar("El gráfico «", e$title %||% i, "» no tiene dibujo para el Word y se omite."); next }
    g <- tryCatch(.word_grafico(p), error = function(err) { avisar("El gráfico «", e$title %||% i, "» no se pudo dibujar: ", conditionMessage(err)); NULL })
    if (is.null(g)) next
    ancho <- attr(g, "ancho") %||% .std_word("pagina", "ancho_util")
    png <- .word_png(g, attr(g, "alto"), ancho = ancho)
    doc <- .word_figura(doc, figura, .word_oracion(e$title), png, alto = attr(g, "alto"), ancho = ancho, base = base_de(e),
                        tabla = attr(p, "pulso_word_tabla"))   # radar entre públicos con `word_tabla`: tabla nativa encima de la figura
    figura <- figura + 1L
  }
  doc <- poner_como_leer(doc)      # un plan sin secciones igual lleva «Cómo leer» si tiene escalas
  for (m in .word_avisos_ponderacion(op$ponderacion, render_meta, como_leer = usa_como_leer)) avisar(m)   # D-b/D-c
  doc <- cerrar(doc)
  if (identical(ind$graficos, "anexo") || (con_tablas && identical(ind$tablas, "anexo"))) {   # índices en anexo: no suman capítulo
    doc <- .word_indices(doc, con_tablas = con_tablas, indices = ind, donde = "anexo")
    doc <- .word_cerrar_capitulo(doc, "Índices", titulo_corto)
  }
  doc <- .word_contraportada(doc, op$contacto, logo = (op$logos %||% list())$contraportada)
  print(doc, target = path_docx)
  .docx_conformar(path_docx, revista = TRUE)
  invisible(list(path = path_docx, figuras = figura - 1L, tablas = tabla - 1L, avisos = avisos))
}
