# =============================================================================
# reporte_plan_otros.R — la lámina «Otros aparte» del recetario (decisión 21)
# =============================================================================
#
# Forma: `docs/qa/motor-ppt-2026-10-06/herramientas/recetario_m5.R:85-100` (C6,
# `recetario-moderna.pptx` p. 203, `m5:4`). Las respuestas abiertas de «Otros» se
# agrupan por texto normalizado y se cuentan (casos, sin ponderar), se suman con
# las categorías que la barra plegó en «Otros», se ordenan de mayor a menor y se
# reparten en dos columnas llenadas por columna, con mini-barra, cuenta y texto.
# Hallazgos H45 (crudo y pegado en un run), H46 (lámina con 1 o 2 respuestas) y H47
# (espacio perdido en el título) de `checklist-motor-ppt-diagnostico-2026-10-06.md`.
#
# `reporte_plan_ppt.R` (congelado) sólo resuelve los datos de cada gráfico y llama
# a `.otros_insertar_plan()` y a `.otros_laminas()`. Sigue opt-in
# (`auto_otros_slides = FALSE` por defecto). El Word no la lleva.

.OTROS_MINIMO <- 5L          # H46: sólo con 5 o más respuestas en la pregunta
.OTROS_FILAS <- 12L          # filas de una línea por columna (~24 por lámina)
.OTROS_PASO <- 0.42          # paso de fila del recetario, en pulgadas
.OTROS_PT <- 12              # cuenta y texto (recetario_m5.R:96)
.OTROS_ANTETITULO <- "Otros aparte"

# El umbral se puede bajar sólo para probar la selección de respuestas con pocos casos.
.otros_minimo <- function() {
  v <- suppressWarnings(as.integer(getOption("prosecnur.otros_minimo", .OTROS_MINIMO))[1])
  if (is.na(v) || v < 1L) .OTROS_MINIMO else v
}

# Espacios, saltos y NBSP a un solo espacio: el salto de una etiqueta no se come la palabra (H47).
.otros_squish <- function(x) {
  x <- as.character(x %||% character(0)); x[is.na(x)] <- ""
  trimws(gsub("[\\s ]+", " ", x, perl = TRUE))
}

# Clave de agrupación: sin tildes, en minúsculas, sin puntuación y con los espacios colapsados.
.otros_clave <- function(x) {
  y <- stringi::stri_trans_tolower(stringi::stri_trans_general(.otros_squish(x), "Latin-ASCII"))
  trimws(gsub("[^a-z0-9]+", " ", y, perl = TRUE))
}

.otros_mayuscula_inicial <- function(s, mayus = TRUE) {
  pos <- stringi::stri_locate_first_regex(s, "\\p{L}")[, 1]
  ok <- !is.na(pos)
  ch <- stringi::stri_sub(s[ok], pos[ok], pos[ok])
  stringi::stri_sub(s[ok], pos[ok], pos[ok]) <- if (mayus) stringi::stri_trans_toupper(ch) else stringi::stri_trans_tolower(ch)
  s
}

# Tipo oración: minúsculas salvo las siglas (palabras en mayúsculas dentro de un texto que no está todo en mayúsculas).
.otros_oracion <- function(x) {
  x <- .otros_squish(x)
  out <- vapply(x, function(s) {
    if (!nzchar(s)) return(s)
    pal <- strsplit(s, " ", fixed = TRUE)[[1]]
    todo_mayus <- !stringi::stri_detect_regex(s, "\\p{Ll}")
    sigla <- !todo_mayus & stringi::stri_detect_regex(pal, "^[\\p{Lu}\\d]{2,6}$")
    pal[!sigla] <- stringi::stri_trans_tolower(pal[!sigla])
    paste(pal, collapse = " ")
  }, "", USE.NAMES = FALSE)
  .otros_mayuscula_inicial(out)
}

# Agrupa pares (texto, n) por clave: suma las cuentas y rotula con la variante de más peso (empate: la primera).
.otros_agrupar <- function(texto, n = rep(1, length(texto))) {
  vacio <- data.frame(texto = character(0), n = numeric(0), clave = character(0), stringsAsFactors = FALSE)
  texto <- .otros_squish(texto); n <- suppressWarnings(as.numeric(n)); clave <- .otros_clave(texto)
  ok <- nzchar(clave) & is.finite(n) & n > 0
  if (!any(ok)) return(vacio)
  texto <- texto[ok]; n <- n[ok]; clave <- clave[ok]
  claves <- unique(clave)
  rotulo <- vapply(claves, function(k) {
    i <- which(clave == k); peso <- tapply(n[i], factor(texto[i], levels = unique(texto[i])), sum)
    names(peso)[which.max(peso)]
  }, "", USE.NAMES = FALSE)
  data.frame(texto = rotulo, n = vapply(claves, function(k) sum(n[clave == k]), 0, USE.NAMES = FALSE),
             clave = claves, stringsAsFactors = FALSE)
}

#' Ítems de la lámina «Otros»: categorías plegadas más respuestas abiertas, fusionados por texto normalizado
#'
#' @param categorias `data.frame(texto, n)` de las categorías que la barra plegó en «Otros», o `NULL`.
#' @param textos Respuestas abiertas (una por caso), en crudo.
#' @return `data.frame(texto, n, clave)` ordenado por `n` descendente y alfabético; las cuentas son casos sin ponderar.
#' @keywords internal
.otros_items <- function(categorias = NULL, textos = character(0)) {
  cat_df <- if (is.data.frame(categorias) && nrow(categorias)) .otros_agrupar(categorias$texto, categorias$n) else .otros_agrupar(character(0))
  txt_df <- .otros_agrupar(textos)
  txt_df$texto <- .otros_oracion(txt_df$texto)
  todo <- rbind(cat_df, txt_df)          # la categoría del instrumento va primero: su rótulo manda al fusionar
  if (!nrow(todo)) return(todo)
  claves <- unique(todo$clave)
  out <- data.frame(texto = todo$texto[match(claves, todo$clave)],
                    n = vapply(claves, function(k) sum(todo$n[todo$clave == k]), 0, USE.NAMES = FALSE),
                    clave = claves, stringsAsFactors = FALSE)
  alfa <- integer(nrow(out)); alfa[stringi::stri_order(out$clave, opts_collator = stringi::stri_opts_collator(locale = "es", numeric = TRUE))] <- seq_len(nrow(out))
  out <- out[order(-out$n, alfa), , drop = FALSE]   # «Actividad 2» antes que «Actividad 10»
  rownames(out) <- NULL
  out
}

.otros_geo <- function() {
  g <- .std_geom; ml <- g("margen_izq"); gap <- g("separacion_paneles")
  wc <- (g("ancho") - ml - g("margen_der") - gap) / 2
  list(ml = ml, gap = gap, wc = wc, y0 = g("zona_datos_y0") + 0.1, w_texto = wc - 1.0)
}

# Alto de una fila: el paso del recetario, más una línea de 12 pt por cada línea de texto de más.
.otros_alto_fila <- function(texto, w_texto = .otros_geo()$w_texto) {
  if (!length(texto)) return(numeric(0))
  .OTROS_PASO + 0.2 * (pmax(1L, .lam_lineas_tinta(texto, w_texto, .OTROS_PT)) - 1L)
}

#' Reparte los ítems en láminas de dos columnas llenadas por columna
#'
#' Cada lámina toma tantos ítems como quepan con `ceiling(k / 2)` en la primera columna; la letra nunca encoge.
#' @return Lista de `data.frame(fila, columna)`, una por lámina.
#' @keywords internal
.otros_paginar <- function(items, w_texto = .otros_geo()$w_texto, alto = .OTROS_FILAS * .OTROS_PASO,
                           max_items = 2L * .OTROS_FILAS) {
  n <- nrow(items); if (!n) return(list())
  h <- .otros_alto_fila(items$texto, w_texto)
  paginas <- list(); s <- 1L
  while (s <= n) {
    k_ok <- 1L
    for (k in seq_len(min(max_items, n - s + 1L))) {
      idx <- s:(s + k - 1L); m <- ceiling(k / 2)
      if (sum(h[idx[seq_len(m)]]) <= alto + 1e-6 && sum(h[idx[-seq_len(m)]]) <= alto + 1e-6) k_ok <- k
    }
    m <- ceiling(k_ok / 2)
    paginas[[length(paginas) + 1L]] <- data.frame(fila = s:(s + k_ok - 1L), columna = rep(1:2, c(m, k_ok - m)))
    s <- s + k_ok
  }
  paginas
}

.otros_titulo <- function(pregunta) paste0("Respuestas «Otros»: ", .otros_mayuscula_inicial(.otros_squish(pregunta), mayus = FALSE))

.otros_fmt_n <- function(x) format(as.integer(round(x)), big.mark = ",", scientific = FALSE, trim = TRUE)

#' Láminas «Otros» de una pregunta, en el plan
#'
#' @param info Lista con `title`, `source`, `parent_var`, `text_var`, `kind`, `items` (categorías plegadas) y/o
#'   `respuestas` (texto abierto).
#' @param base_fmt Formateador de la base del preset (`.apply_base_format`).
#' @return Lista de `p_slide_texto()` (vacía bajo el umbral).
#' @keywords internal
.otros_slides <- function(info, base_fmt = function(core) paste0("Base: ", core)) {
  items <- .otros_items(info$items, info$respuestas %||% character(0))
  total <- sum(items$n)
  if (!nrow(items) || total < .otros_minimo()) return(list())
  pregunta <- .otros_squish(info$title)
  base <- base_fmt(paste0(.otros_fmt_n(total), " respuestas en «Otros» en la pregunta ", pregunta))
  paginas <- .otros_paginar(items)
  lapply(seq_along(paginas), function(i) {
    pg <- items[paginas[[i]]$fila, c("texto", "n"), drop = FALSE]
    pg$columna <- paginas[[i]]$columna
    titulo <- .otros_titulo(pregunta)
    if (i > 1L) titulo <- .particion_titulo_cont(titulo)
    slide <- p_slide_texto(
      titulo = titulo, bullets = paste0(pg$texto, " (", .otros_fmt_n(pg$n), ")"), base = base,
      meta = list(auto_otros = TRUE, antetitulo = .OTROS_ANTETITULO, source = info$source, parent_var = info$parent_var,
                  text_var = info$text_var, kind = info$kind %||% "open_text_otros", chunk = i, chunks = length(paginas))
    )
    slide$slots$otros <- list(items = pg, n_max = max(items$n), total = total)
    slide
  })
}

.otros_key <- function(info) {
  filtros_key <- tryCatch(
    jsonlite::toJSON(info$filtros %||% list(), auto_unbox = TRUE, null = "null"),
    error = function(e) paste(utils::capture.output(utils::str(info$filtros %||% list())), collapse = "|")
  )
  paste(info$source, info$parent_var, info$text_var, filtros_key, sep = "\r")
}

#' Inserta tras cada lámina las «Otros» de sus gráficos
#'
#' Las categorías plegadas y el texto abierto de la MISMA variable van en una sola lista, con una base.
#' @param f Lista de funciones del motor: `elementos(slide)`, `agrupada(el)`, `refs(el)`, `texto(ref, el)` y `base_fmt`.
#' @keywords internal
.otros_insertar_plan <- function(plan, f) {
  seen <- character(0); out <- list()
  emitir <- function(info, extra = character(0)) {
    key <- .otros_key(info)
    if (key %in% seen) return(invisible(NULL))
    seen <<- c(seen, key, extra)
    for (s in .otros_slides(info, f$base_fmt)) out[[length(out) + 1L]] <<- s
    invisible(NULL)
  }
  for (slide in plan) {
    out[[length(out) + 1L]] <- slide
    for (el in f$elementos(slide)) {
      g <- f$agrupada(el); con_g <- !is.null(g) && isTRUE(g$n > 0)
      tis <- Filter(function(ti) !is.null(ti) && isTRUE(ti$n > 0), lapply(f$refs(el), function(ref) f$texto(ref, el)))
      hit <- if (con_g) which(vapply(tis, function(ti) identical(ti$parent_var, g$parent_var) && identical(ti$source, g$source), logical(1))) else integer(0)
      m <- if (length(hit)) hit[[1]] else NA_integer_
      if (con_g) {
        if (!is.na(m)) g$respuestas <- tis[[m]]$respuestas
        emitir(g, if (is.na(m)) character(0) else .otros_key(tis[[m]]))
      }
      for (j in seq_along(tis)) if (is.na(m) || j != m) emitir(tis[[j]])
    }
  }
  class(out) <- unique(c("ppt_plan", "list", class(plan)))
  out
}

#' ¿La lámina trae la lista «Otros» ya compuesta?
#' @keywords internal
.otros_lamina_cabe <- function(slots) {
  it <- (slots$otros %||% list())$items
  is.data.frame(it) && nrow(it) > 0L && all(c("texto", "n", "columna") %in% names(it))
}

#' Lámina «Otros aparte» con piezas nativas (recetario_m5.R:85-100)
#'
#' Cada ítem es su propio cuadro de un párrafo (H45), con mini-barra (tinta si n > 1, tenue si n = 1) y su cuenta.
#' @return Lista con `doc` y `partes`.
#' @keywords internal
.otros_laminas <- function(doc, slots, titulo, ante = NULL, folio = NULL, layout = "Title and Content",
                           master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  o <- slots$otros; it <- o$items; geo <- .otros_geo()
  n_max <- max(1, suppressWarnings(as.numeric(o$n_max %||% max(it$n))), na.rm = TRUE)
  azul <- .std_color("azul"); tenue <- .std_color("tenue")
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante %||% .OTROS_ANTETITULO)
  lz <- .lam_lienzo()
  for (cc in 1:2) {
    x <- geo$ml + (cc - 1L) * (geo$wc + geo$gap); yc <- geo$y0
    for (k in which(it$columna == cc)) {
      h <- .otros_alto_fila(it$texto[k], geo$w_texto); nk <- .otros_fmt_n(it$n[k])
      .lam_caja(lz, x, yc + 0.08, 0.5 * it$n[k] / n_max + 0.04, 0.2, if (it$n[k] > 1) azul else tenue, nombre = "otros:barra")
      .lam_txt(lz, nk, x + 0.62, yc, max(0.4, .lam_ancho_txt(nk, .OTROS_PT, TRUE) + 0.2), 0.34, .OTROS_PT, azul, bold = TRUE, nombre = "otros:n")
      .lam_txt(lz, it$texto[k], x + 1.0, yc, geo$w_texto, h - 0.08, .OTROS_PT, azul, nombre = "otros:texto")
      yc <- yc + h
    }
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:otros")
  doc <- .lam_pie(doc, slots$base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}
