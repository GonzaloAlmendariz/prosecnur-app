# =============================================================================
# reporte_word_otros.R — la tabla «Respuestas «Otros»» del recetario Word (decisión 21)
# =============================================================================
#
# Forma: `docs/qa/motor-ppt-2026-10-06/herramientas/recetario_word.R:564-568` (propuesta-word.docx, p. 28, «Tabla 10»).
# Con `auto_otros_slides` encendido (la misma opción del proyecto que el PPT; apagada por defecto), tras cada gráfico
# con abierta el Word pone una tabla numerada «Tabla N» con el título «Respuestas «Otros» a la pregunta …», dos bloques
# «Respuesta | N.º» llenados por columna de mayor a menor (la mitad de arriba a la izquierda) y la base
# «Base: N respuestas en «Otros».» con la fuente. Las cuentas son casos, sin ponderar.
#
# No agrupa ni cuenta nada por su lado: toma las láminas «Otros» que ya armó el plan del PPT (`.otros_slides`,
# reporte_plan_otros.R), así que agrupación, orden y umbral (`.otros_minimo()`) tienen una sola fuente. Las láminas
# «(cont.)» de una misma pregunta se reúnen en una sola tabla: el Word no pagina a 24 ítems, pagina Word.

.WORD_OTROS_KIND <- "otros_tabla"
.WORD_OTROS_ENCABEZADO <- c("Respuesta", "N.º")
.WORD_OTROS_ANCHOS <- c(2.3, 0.5, 0.3, 2.3, 0.5)   # recetario_word.R:567, se escalan al ancho útil

.word_otros_es_lamina <- function(s) is.list(s) && isTRUE((s$meta %||% list())$auto_otros) && .otros_lamina_cabe(s$slots %||% list())

# La pregunta de la lámina: la que guardó `.otros_slides`; en un plan viejo, la que queda del título.
.word_otros_pregunta <- function(s) {
  p <- .word_txt1((s$slots$otros %||% list())$pregunta)
  if (nzchar(p)) return(p)
  t <- sub("\\s*\\(cont\\.\\)\\s*$", "", .word_txt1(s$title))
  .otros_mayuscula_inicial(sub("^Respuestas «Otros»:\\s*", "", t))
}

#' Base de la tabla «Otros»: la suma de las cuentas (casos) y, si la hay, la fuente
#' @keywords internal
.word_otros_base <- function(total, fuente = NULL) {
  partes <- c(paste0("Base: ", .otros_fmt_n(total), " respuestas en «Otros»."),
              if (nzchar(.word_txt1(fuente))) .word_txt1(fuente))
  paste(partes, collapse = " ")
}

#' Las tablas «Otros» de un plan ya armado, una por pregunta, con el índice de la lámina a la que siguen
#'
#' @param plan Plan devuelto por `reporte_ppt_plan(auto_otros_slides = TRUE)`.
#' @return Lista de entradas de `render_meta` (`kind = "otros_tabla"`) con `items` (`texto`, `n`), `total`, `title`,
#'   `base` y `slide_i` = la lámina del gráfico al que sigue.
#' @keywords internal
.word_otros_desde_plan <- function(plan, fuente = NULL) {
  es <- vapply(plan, .word_otros_es_lamina, logical(1))
  out <- list(); i <- 1L; n <- length(plan)
  while (i <= n) {
    if (!es[[i]]) { i <- i + 1L; next }
    s <- plan[[i]]; chunks <- max(1L, suppressWarnings(as.integer(s$meta$chunks %||% 1L))[1], na.rm = TRUE)
    j <- i
    while (j < n && es[[j + 1L]] && (j - i + 1L) < chunks && isTRUE(plan[[j + 1L]]$meta$chunk > 1L)) j <- j + 1L
    items <- do.call(rbind, lapply(plan[i:j], function(x) x$slots$otros$items[, c("texto", "n"), drop = FALSE]))
    rownames(items) <- NULL
    previos <- which(!es[seq_len(i - 1L)])
    out[[length(out) + 1L]] <- list(
      kind = .WORD_OTROS_KIND,
      title = paste0("Respuestas «Otros» a la pregunta ", .word_oracion(.word_otros_pregunta(s))),
      items = items, total = s$slots$otros$total %||% sum(items$n),
      base = .word_otros_base(s$slots$otros$total %||% sum(items$n), fuente),
      slide_i = if (length(previos)) max(previos) else 0L
    )
    i <- j + 1L
  }
  out
}

# Lámina de origen de cada entrada de render_meta: la que trae (`slide_i`) o, para los separadores, la que les toca por
# orden entre las láminas «section» del plan. Las demás (bloques de multiapiladas, textos) quedan en NA.
.word_otros_origen <- function(render_meta, plan) {
  orig <- vapply(render_meta, function(e) { v <- suppressWarnings(as.integer(e$slide_i %||% NA)[1]); if (length(v)) v else NA_integer_ }, 0L)
  sec_meta <- which(vapply(render_meta, function(e) identical(e$kind, "section"), logical(1)))
  sec_plan <- which(vapply(plan, function(s) is.list(s) && identical(as.character(s$.slide_type %||% "")[1], "section"), logical(1)))
  if (length(sec_meta) == length(sec_plan)) orig[sec_meta] <- sec_plan
  orig
}

# Dónde va la tabla de la lámina p: tras la última entrada de esa lámina; si sus entradas no dicen de qué lámina son
# (bloques de multiapiladas), tras la última entrada sin origen antes de la primera de una lámina posterior.
.word_otros_ancla <- function(orig, p) {
  propia <- which(!is.na(orig) & orig == p)
  if (length(propia)) return(max(propia))
  despues <- which(!is.na(orig) & orig > p)
  tope <- if (length(despues)) min(despues) - 1L else length(orig)
  antes <- which(seq_along(orig) <= tope & (is.na(orig) | orig < p))
  if (length(antes)) max(antes) else 0L
}

#' Inserta en `render_meta` la tabla «Otros» de cada gráfico con abierta, justo después de él
#'
#' @param render_meta,plan Salida de `reporte_ppt_plan(solo_lista = TRUE, build_render_meta = TRUE, auto_otros_slides = TRUE)`.
#' @param fuente Fuente que cierra la base («Fuente: PULSO PUCP 2026.»).
#' @return `render_meta` con las entradas `otros_tabla`; igual a la de entrada si el plan no trae láminas «Otros».
#' @keywords internal
.word_otros_insertar <- function(render_meta, plan, fuente = NULL) {
  tablas <- .word_otros_desde_plan(plan, fuente = fuente)
  if (!length(tablas)) return(render_meta)
  orig <- .word_otros_origen(render_meta, plan)
  ancla <- vapply(tablas, function(t) .word_otros_ancla(orig, t$slide_i), 0L)
  out <- list()
  for (k in c(0L, seq_along(render_meta))) {
    if (k > 0L) out[[length(out) + 1L]] <- render_meta[[k]]
    for (t in tablas[ancla == k]) out[[length(out) + 1L]] <- t
  }
  out
}

#' Los dos bloques de la tabla: la primera mitad (ceiling(k/2)) a la izquierda y el resto a la derecha, en orden
#' @return `data.frame` de cinco columnas «Respuesta | N.º | | Respuesta | N.º», en texto.
#' @keywords internal
.word_otros_df <- function(items) {
  k <- nrow(items); m <- ceiling(k / 2)
  izq <- seq_len(m); der <- if (k > m) (m + 1L):k else integer(0)
  pad <- function(x) c(x, rep("", m - length(x)))
  df <- data.frame(pad(as.character(items$texto[izq])), pad(.otros_fmt_n(items$n[izq])), rep("", m),
                   pad(as.character(items$texto[der])), pad(.otros_fmt_n(items$n[der])), stringsAsFactors = FALSE)
  # Claves únicas para flextable; el encabezado que se ve es el del recetario (las dos mitades con el mismo rótulo).
  names(df) <- c(.WORD_OTROS_ENCABEZADO, " ", paste0(.WORD_OTROS_ENCABEZADO, " "))
  df
}

#' Tabla «Otros» del recetario Word (recetario_word.R:567): rótulo «Tabla N», dos bloques sin negrita en la primera
#' columna, cuentas centradas, sin cebra y la base debajo
#' @param entry Entrada `otros_tabla` de `render_meta`.
#' @keywords internal
.word_otros_tabla <- function(doc, n, entry) {
  it <- entry$items
  if (!is.data.frame(it) || !nrow(it)) return(doc)
  ft <- .word_ft_base(.word_otros_df(it), .WORD_OTROS_ANCHOS) |>
    flextable::bold(j = 1, bold = FALSE, part = "body") |>
    flextable::align(j = c(2, 5), align = "center", part = "all")
  .word_tabla(doc, n, entry$title %||% "", ft, base = entry$base, cebra = FALSE)
}
