# =============================================================================
# graficos_espec_criterios.R — mapa de calor por criterio con cruce (lámina 93; ADR 0093, N5)
# =============================================================================
#
# recetario_m3d.R:61-77: cada criterio en su fila, agrupado por dimensión, y una columna por público (Total y los grupos
# del cruce) con su base. Gonzalo aprobó la lámina el 2026-10-09 y dejó las dos métricas disponibles:
#   - «top_two_box» (por defecto): porcentaje de respuestas en las dos categorías más altas de la escala, sin los
#     códigos especiales 90-99, sobre las válidas;
#   - «lineal»: el promedio ponderado del criterio tal como viene (índice 0-100), que es lo que el motor calculaba.
# Si un criterio no es una pregunta de escala con códigos numéricos, el Top Two Box no existe y la lámina usa la
# lineal en todos, y lo declara.
#
# `graficador_dimensiones.R` está congelado: el cálculo de la lámina vive aquí y se adjunta como espec.

#' Valores de la escala de un criterio, sin los especiales 90-99
#'
#' Un criterio recodificado a 0-100 por `reporte_dimensiones()` (`r100_*`) trae en `recodificacion_items_meta` el
#' puntaje de cada código: la escala son esos puntajes. Si no, los códigos numéricos de su `select_one`.
#' @keywords internal
.criterios_escala <- function(instrumento, var, data = NULL) {
  meta <- attr(data, "recodificacion_items_meta", exact = TRUE)
  m <- Filter(function(x) identical(as.character(x$variable_salida %||% "")[1], var), meta %||% list())
  if (length(m)) {
    mp <- m[[1]]$mapeo; cod <- suppressWarnings(as.numeric(as.character(mp$codigo)))
    sc <- suppressWarnings(as.numeric(mp$score_0_100))[is.finite(cod) & !(cod >= 90 & cod <= 99)]
    sc <- sort(unique(sc[is.finite(sc)]))
    return(if (length(sc) < 3L) NULL else sc)
  }
  sv <- instrumento$survey; ch <- instrumento$choices
  if (is.null(sv) || is.null(ch) || !"name" %in% names(sv)) return(NULL)
  tipo <- as.character(sv$type[match(var, as.character(sv$name))])
  if (is.na(tipo) || !grepl("^select_one\\s+", tipo)) return(NULL)
  lista <- trimws(sub("^select_one\\s+", "", tipo))
  cod <- suppressWarnings(as.numeric(as.character(ch$name[as.character(ch$list_name) == lista])))
  cod <- cod[is.finite(cod) & !(cod >= 90 & cod <= 99)]
  if (length(cod) < 3L) NULL else sort(cod)
}

#' Valores del mapa de calor por criterio
#'
#' @param config Lista de dimensiones: cada una con `titulo`/`id`, `vars` (resueltas en `data`) y `labels` opcionales.
#' @param cruce Variable del público (o `NULL`, sólo Total).
#' @param metrica «top_two_box» o «lineal».
#' @return Lista `valores` (matriz criterios × públicos, sin redondear), `filas`, `grupos` (dimensión de cada fila),
#'   `columnas` (rótulo y casos), `metrica` (la usada).
#' @keywords internal
.criterios_calcular <- function(data, instrumento, config, cruce = NULL, metrica = "top_two_box") {
  metrica <- if (identical(metrica, "lineal")) "lineal" else "top_two_box"
  vars <- unlist(lapply(config, function(c) as.character(c$vars)), use.names = FALSE)
  escalas <- lapply(vars, function(v) .criterios_escala(instrumento, v, data))
  if (identical(metrica, "top_two_box") && any(vapply(escalas, is.null, TRUE))) metrica <- "lineal"
  vp <- as.character(attr(data, "var_peso", exact = TRUE) %||% "peso")[1]
  w <- if (nzchar(vp) && vp %in% names(data)) suppressWarnings(as.numeric(data[[vp]])) else rep(1, nrow(data))
  w[!is.finite(w) | w < 0] <- 0
  etiqueta_de <- function(v, labels) {
    l <- if (!is.null(labels) && !is.null(names(labels)) && v %in% names(labels)) as.character(labels[[v]])[1] else NA_character_
    if (is.na(l) || !nzchar(l)) l <- as.character(attr(data[[v]], "label", exact = TRUE) %||% NA_character_)[1]
    if (is.na(l) || !nzchar(l)) l <- as.character(instrumento$survey$label[match(v, as.character(instrumento$survey$name))] %||% NA_character_)[1]
    if (is.na(l) || !nzchar(l)) v else trimws(l)
  }
  filas <- character(0); grupos <- character(0)
  for (k in seq_along(config)) {
    c0 <- config[[k]]; tit <- as.character(c0$titulo %||% c0$id %||% names(config)[k] %||% paste("Dimensión", k))[1]
    for (v in as.character(c0$vars)) { filas <- c(filas, etiqueta_de(v, c0$labels)); grupos <- c(grupos, tit) }
  }
  # Públicos: el Total y, con cruce, sus categorías en el orden del instrumento, sólo las observadas.
  pub <- list(Total = rep(TRUE, nrow(data)))
  if (!is.null(cruce) && cruce %in% names(data)) {
    g <- trimws(as.character(data[[cruce]]))
    sv <- instrumento$survey; ch <- instrumento$choices
    lista <- trimws(sub("^select_one\\s+", "", as.character(sv$type[match(cruce, as.character(sv$name))])))
    cods <- as.character(ch$name[as.character(ch$list_name) == lista]); lbls <- as.character(ch$label[as.character(ch$list_name) == lista])
    for (i in seq_along(cods)) if (any(g == cods[i], na.rm = TRUE)) pub[[lbls[i] %||% cods[i]]] <- !is.na(g) & g == cods[i]
  }
  V <- matrix(NA_real_, length(vars), length(pub), dimnames = list(NULL, names(pub)))
  for (i in seq_along(vars)) {
    x <- suppressWarnings(as.numeric(as.character(data[[vars[i]]])))
    for (j in seq_along(pub)) {
      if (identical(metrica, "top_two_box")) {
        esc <- escalas[[i]]; ok <- pub[[j]] & is.finite(x) & x %in% esc & w > 0
        if (any(ok)) V[i, j] <- 100 * sum(w[ok & x %in% utils::tail(esc, 2)]) / sum(w[ok])
      } else {
        ok <- pub[[j]] & is.finite(x) & w > 0
        if (any(ok)) V[i, j] <- sum(x[ok] * w[ok]) / sum(w[ok])
      }
    }
  }
  # Casos: quien respondió al menos un criterio, en cada público.
  resp <- rowSums(!is.na(as.data.frame(data)[, vars, drop = FALSE])) > 0
  n <- vapply(pub, function(m) sum(m & resp), 0)
  list(valores = V, filas = filas, grupos = grupos, columnas = data.frame(rotulo = names(pub), n = unname(n), stringsAsFactors = FALSE),
       metrica = metrica)
}

#' Especificación de la lámina 93
#' @keywords internal
preparar_heatmap_criterios <- function(calc) {
  crudo <- calc$valores
  if (!length(crudo) || all(!is.finite(crudo))) return(NULL)
  v <- crudo; v[] <- .pulso_round_half_up(as.vector(crudo), 0)
  lo <- max(0, floor(min(crudo, na.rm = TRUE) / 5) * 5); hi <- min(100, ceiling(max(crudo, na.rm = TRUE) / 5) * 5)
  if (hi <= lo) hi <- min(100, lo + 5)
  bloques <- lapply(unique(calc$grupos), function(g) list(titulo = g, filas = which(calc$grupos == g)))
  list(version = "heatmap_criterios/1", tipo = "heatmap_criterios", valores = v, valores_crudos = crudo, filas = calc$filas,
       bloques = bloques, columnas = calc$columnas, rango = c(lo, hi), metrica = calc$metrica,
       sufijo = if (identical(calc$metrica, "top_two_box")) "%" else "",
       rotulo_escala = if (identical(calc$metrica, "top_two_box")) "Top Two Box" else "Índice")
}

#' Adjunta la espec de la 93 al lienzo del graficador por criterio (ruta anterior intacta si algo falla)
#' @param el El elemento del plan (trae `cruce` y `metrica`).
#' @keywords internal
.espec_criterios_adjuntar <- function(p, args, el) {
  if (is.null(p)) return(p)
  espec <- tryCatch({
    cruce <- if (!is.null(el$cruce)) .graficos_ref_parts(el$cruce)$name else NULL
    if (!is.null(cruce) && !cruce %in% names(args$data)) stop("cruce no está en la base")
    preparar_heatmap_criterios(.criterios_calcular(args$data, args$instrumento, args$config_criterios, cruce, el$metrica %||% "top_two_box"))
  }, error = function(e) NULL)
  if (!is.null(espec)) attr(p, "pulso_espec") <- espec
  p
}
