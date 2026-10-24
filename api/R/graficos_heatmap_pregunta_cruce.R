# =============================================================================
# graficos_heatmap_pregunta_cruce.R — mapa de calor de una pregunta por un cruce (L10-6, bandeja CCSS 2026-10-24)
# =============================================================================
#
# `p_dim_heatmap()` lee dimensiones de Analítica. En CCSS Perfil 2026 se pidió con una pregunta como objetivo
# (`objetivo = "D3_1"`, `cruce = "carrera_marco"`) y la lámina salía «Sin datos» y sin base: el motor de dimensiones
# no encontraba ninguna dimensión y el error se degradaba en silencio.
#
# Variante «pregunta × cruce»: si el objetivo NO es una dimensión y SÍ es una pregunta de respuesta única de la base,
# la lámina es una tabla de calor con los grupos del cruce en las filas (precedidos por el Total) y las opciones de la
# pregunta en las columnas, en el orden del instrumento. Cada fila es la distribución de ese grupo (suma 100 %),
# calculada con `.plan_freq_tabla()` —el mismo helper que `.tab_freq()` del motor: mismo peso, mismas exclusiones,
# mismo orden—. Los casos de cada fila (sin ponderar) van entre paréntesis y la base de la lámina la declara la
# especificación. Si el objetivo no es ni dimensión ni pregunta, se avisa en vez de dibujar «Sin datos».
#
# Se engancha en `.render_dim_heatmap()` (reporte_plan_ppt.R, congelado) sustituyendo una sola línea por
# `.heatmap_dim_o_pregunta()`.

#' Mapa de calor de dimensiones o, si el objetivo es una pregunta, la variante pregunta × cruce
#'
#' @param args Argumentos ya resueltos de `graficar_heatmap_dimensiones()` (data, instrumento, objetivo, cruce, filtros).
#' @param dibujar Función sin argumentos que dibuja el mapa de dimensiones (la ruta de siempre).
#' @keywords internal
.heatmap_dim_o_pregunta <- function(args, dibujar) {
  if (!.heatmap_objetivo_es_dimension(args) && .heatmap_objetivo_es_pregunta(args)) {
    return(graficar_heatmap_pregunta_cruce(args$data, args$instrumento, args$objetivo, args$cruce, filtros = args$filtros %||% list()))
  }
  p <- tryCatch(dibujar(), error = function(e) {
    if (!.heatmap_objetivo_es_dimension(args)) {
      .pulso_aviso(.aviso_en_lamina(sprintf(
        "el mapa de calor de dimensiones no encuentra «%s»: no es una dimensión de Analítica ni una pregunta de respuesta única de la base.",
        as.character(args$objetivo %||% "")[1])))
    }
    stop(e)
  })
  .espec_dim_adjuntar(p, args, "heatmap")
}

#' ¿El objetivo es una dimensión (o indicador) que el motor de dimensiones conoce?
#' @keywords internal
.heatmap_objetivo_es_dimension <- function(args) {
  isTRUE(tryCatch({
    ctx <- .dim_build_context(args$data, instrumento = args$instrumento)
    pl <- .dim_build_payload(ctx, modo = args$modo %||% "general", objetivo = args$objetivo, cruce = args$cruce,
                             filtros = args$filtros %||% list())
    NROW(pl$score_heat) > 0L
  }, error = function(e) FALSE))
}

#' ¿El objetivo es una pregunta de respuesta única de la base, y el cruce otra?
#' @keywords internal
.heatmap_objetivo_es_pregunta <- function(args) {
  obj <- as.character(args$objetivo %||% "")[1]; cr <- as.character(args$cruce %||% "")[1]
  sv <- (args$instrumento %||% list())$survey
  if (is.na(obj) || !nzchar(obj) || is.na(cr) || !nzchar(cr) || !is.data.frame(args$data) || !is.data.frame(sv)) return(FALSE)
  if (!all(c(obj, cr) %in% names(args$data))) return(FALSE)
  tipo <- function(v) trimws(as.character(sv$type[which(sv$name == v)][1]))
  all(grepl("^select_one(\\s|$)", c(tipo(obj), tipo(cr))))
}

#' Tabla de calor de una pregunta por los grupos de un cruce
#'
#' @param data Base (la de la fuente, con su peso).
#' @param instrumento Instrumento de la base (`survey`, `choices`, `orders_list`).
#' @param var Pregunta de respuesta única (columnas).
#' @param cruce Pregunta que define los grupos (filas), en el orden del instrumento.
#' @param filtros Filtros nombrados de la lámina.
#' @return ggplot de respaldo con `attr(, "pulso_espec")` `heatmap/1` (filas = Total y grupos, columnas = opciones).
#' @keywords internal
graficar_heatmap_pregunta_cruce <- function(data, instrumento, var, cruce, filtros = list()) {
  e <- .heatmap_pc_espec(data, instrumento, var, cruce, filtros)
  df <- expand.grid(fila = seq_along(e$filas), col = seq_len(ncol(e$valores)))
  df$v <- e$valores[cbind(df$fila, df$col)]
  df$f <- factor(e$filas[df$fila], levels = rev(e$filas)); df$c <- factor(e$columnas$rotulo[df$col], levels = e$columnas$rotulo)
  tramos <- unlist(.std_paleta("calor")$tramos)
  p <- ggplot2::ggplot(df, ggplot2::aes(x = .data$c, y = .data$f, fill = .data$v)) +
    ggplot2::geom_tile(colour = .std_color("fondo"), linewidth = 1) +
    ggplot2::geom_text(ggplot2::aes(label = paste0(.data$v, "%")), size = 11 / ggplot2::.pt, fontface = "bold",
                       colour = ifelse(df$v > mean(e$rango), "white", .std_color("azul"))) +
    ggplot2::scale_fill_gradientn(colours = tramos, limits = e$rango, guide = "none") +
    ggplot2::scale_x_discrete(position = "top", labels = function(x) vapply(x, function(s) paste(strwrap(s, 16), collapse = "\n"), "")) +
    ggplot2::labs(x = NULL, y = NULL) + ggplot2::theme_minimal(base_family = "Arial") +
    ggplot2::theme(axis.text = ggplot2::element_text(colour = .std_color("azul"), size = 11, face = "bold"),
                   panel.grid = ggplot2::element_blank(),
                   plot.background = ggplot2::element_rect(fill = NA, colour = NA))
  attr(p, "pulso_espec") <- e
  attr(p, "note_outside") <- e$nota   # la base va al pie de la lámina (canal de las notas del motor)
  p
}

#' Ancho de la columna de filas: 2.75 in del recetario o, si un grupo con sus casos no cabe en una línea a 13 pt, lo
#' que pida (hasta 3.6 in); así cada fila mide una línea y la tabla entra entera
#' @keywords internal
.heatmap_pc_ancho_filas <- function(filas) {
  w <- max(.lam_ancho_txt(filas, 13, TRUE)) + 0.15
  min(3.6, max(2.75, ceiling(w * 20) / 20))
}

#' Especificación `heatmap/1` de la variante pregunta × cruce
#' @keywords internal
.heatmap_pc_espec <- function(data, instrumento, var, cruce, filtros = list()) {
  # Las frecuencias salen de `.tab_freq()` del motor cuando el render la expone (mismo peso, exclusiones, rótulos y orden
  # que el resto del mazo); fuera del render, de `.plan_freq_tabla()`, que es lo que ella llama.
  tab_freq <- dynGet(".tab_freq", ifnotfound = NULL)
  frec <- function(extra = list()) {
    t <- if (is.function(tab_freq)) tab_freq(var, filtros = c(filtros %||% list(), extra)) else {
      dd <- .apply_named_filters_safe(data, filters = c(filtros %||% list(), extra), arg_name = "filtros del mapa de calor")
      if (!nrow(dd)) NULL else .plan_freq_tabla(dd, var, survey = instrumento$survey, sm_vars_force = NULL,
                                                orders_list = instrumento$orders_list, mostrar_todo = TRUE, casos = TRUE)
    }
    if (is.null(t) || !nrow(t)) return(NULL)
    t <- as.data.frame(t, stringsAsFactors = FALSE)
    tot <- trimws(as.character(t$Opciones)) == "Total"
    list(opciones = as.character(t$Opciones[!tot]), pct = 100 * suppressWarnings(as.numeric(t$pct[!tot])),
         casos = suppressWarnings(as.numeric((t$n_casos %||% t$n)[tot][1])))
  }
  total <- frec()
  if (is.null(total) || !is.finite(total$casos) || total$casos <= 0) {
    stop("mapa de calor: la pregunta `", var, "` no tiene respuestas con los filtros de la lámina.", call. = FALSE)
  }
  opciones <- .equiv_escala_opciones(instrumento, cruce)
  cod <- vapply(opciones, function(o) as.character(o$codigo %||% "")[1], character(1))
  etq <- vapply(opciones, function(o) as.character(o$etiqueta %||% "")[1], character(1))
  etq[!nzchar(etq)] <- cod[!nzchar(etq)]
  filas <- list(c(list(rotulo = "Total"), total))
  for (k in seq_along(cod)) {
    f <- frec(stats::setNames(list(cod[k]), cruce))
    if (is.null(f) || !is.finite(f$casos) || f$casos <= 0) next
    filas[[length(filas) + 1L]] <- c(list(rotulo = etq[k]), f)
  }
  crudo <- do.call(rbind, lapply(filas, function(f) f$pct[match(total$opciones, f$opciones)]))
  crudo[!is.finite(crudo)] <- 0
  casos <- vapply(filas, function(f) f$casos, 0)
  chica <- casos < 15
  rot <- sprintf("%s (%s%s)", vapply(filas, `[[`, "", "rotulo"), .dumbbell_fmt_casos(casos), ifelse(chica, "*", ""))
  dimnames(crudo) <- list(rot, total$opciones)
  v <- crudo; v[] <- .pulso_round_half_up(as.vector(crudo), 0)
  lo <- max(0, floor(min(crudo) / 5) * 5); hi <- min(100, ceiling(max(crudo) / 5) * 5)
  if (hi <= lo) { lo <- max(0, lo - 5); hi <- min(100, hi + 5) }
  nota <- paste0("Base: ", .dumbbell_fmt_casos(total$casos), " casos que respondieron. Entre paréntesis, los casos de cada fila",
                 if (any(chica)) "; * menos de 15 casos" else "", ".")
  list(version = "heatmap/1", tipo = "heatmap_dim", variante = "pregunta_cruce", filas = rot,
       columnas = data.frame(rotulo = total$opciones, n = NA_real_, stringsAsFactors = FALSE),
       valores = v, valores_crudos = crudo, col_total = NA_integer_, bloques = list(), rango = c(lo, hi),
       rotulo_escala = "% de cada fila", encabezado_dos_lineas = TRUE, n_casos_filas = unname(casos), nota = nota,
       ancho_filas = .heatmap_pc_ancho_filas(rot))
}
