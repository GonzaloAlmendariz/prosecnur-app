# =============================================================================
# graficos_espec_dimensiones.R — lo que afirman los gráficos de dimensiones (ADR 0093, N5)
# =============================================================================
#
# Capa pura de los mapas de calor y el comparativo de dimensiones del recetario
# (recetario_m3d.R). Se arma desde el payload del motor (`.dim_build_payload`),
# así graficador_dimensiones.R —congelado— no crece: el render del plan adjunta
# esta especificación a lo que devuelve el graficador.

#' Especificación de un mapa de calor por dimensión (lámina 92, recetario_m3d.R:43-60)
#'
#' Filas = dimensiones (sin la fila «Total cruce»), columnas = Total y los grupos del cruce, en su orden.
#' Las cifras se redondean primero (desde 0.5 sube) y la diferencia con el Total se calcula entre cifras
#' redondeadas, como el recetario.
#' @param payload Resultado de `.dim_build_payload()`.
#' @param titulo_cruce Encabezado del bloque de grupos («Sexo»); `NULL` sin encabezado.
#' @return Lista `heatmap/1` con `filas`, `columnas` (rotulo, n), `valores` (matriz redondeada filas x columnas),
#'   `valores_crudos` (sin redondear: deciden el tramo de color),
#'   `col_total` (índice de la columna Total o `NA`), `bloques` (encabezados de grupos de columnas) y `rango`.
#' @keywords internal
preparar_heatmap_dim <- function(payload, titulo_cruce = NULL, rotulo_total = "Total", n_respondieron = NULL) {
  sc <- as.data.frame(payload$score_heat, stringsAsFactors = FALSE)
  sc <- sc[!(sc$tipo %in% "total_cruce") & !(sc$axis_label %in% "Total cruce"), , drop = FALSE]
  if (!nrow(sc)) return(NULL)
  filas <- setdiff(as.character(payload$axis_order_heat %||% unique(sc$axis_label)), "Total cruce")
  filas <- filas[filas %in% sc$axis_label]
  cols <- as.character(payload$group_order_natural %||% payload$group_order %||% unique(sc$grupo))
  cols <- cols[cols %in% sc$grupo]
  crudo <- matrix(NA_real_, length(filas), length(cols), dimnames = list(filas, cols))
  for (k in seq_len(nrow(sc))) {
    i <- match(sc$axis_label[k], filas); j <- match(sc$grupo[k], cols)
    if (!is.na(i) && !is.na(j)) crudo[i, j] <- suppressWarnings(as.numeric(sc$score_raw[k]))
  }
  if (!any(is.finite(crudo))) return(NULL)   # sin una sola cifra no hay mapa: la lámina sigue por la ruta anterior
  v <- crudo; v[] <- .pulso_round_half_up(as.vector(crudo), 0)
  # Casos por columna: los que respondieron la batería (recetario_m3d.R, «base real: quienes respondieron, no el
  # total del grupo»), si se conocen; si no, la base del grupo EN CASOS (`base_casos`, sin ponderar; `base` en
  # payloads anteriores). Una columna sin ninguna cifra no lleva n.
  base_col <- if ("base_casos" %in% names(sc)) sc$base_casos else sc$base
  n <- vapply(cols, function(g) {
    if (!is.null(n_respondieron) && g %in% names(n_respondieron)) return(as.numeric(n_respondieron[[g]]))
    b <- suppressWarnings(as.numeric(base_col[sc$grupo == g])); b <- b[is.finite(b)]; if (length(b)) max(b) else NA_real_
  }, 0)
  n[!apply(is.finite(crudo), 2, any)] <- NA_real_
  col_total <- match("Total", cols)
  rot <- cols; if (!is.na(col_total)) rot[col_total] <- rotulo_total
  bloques <- if (!is.null(titulo_cruce) && nzchar(titulo_cruce)) {
    grupo_cols <- setdiff(seq_along(cols), col_total)
    if (length(grupo_cols)) list(list(titulo = titulo_cruce, cols = grupo_cols)) else list()
  } else list()
  # Como el recetario: el rango y el tramo de cada celda salen del valor sin redondear; se escribe el redondeado.
  lo <- max(0, floor(min(crudo, na.rm = TRUE) / 5) * 5); hi <- min(100, ceiling(max(crudo, na.rm = TRUE) / 5) * 5)
  if (hi <= lo) { lo <- max(0, lo - 5); hi <- min(100, hi + 5) }
  list(version = "heatmap/1", tipo = "heatmap_dim", filas = filas, columnas = data.frame(rotulo = rot, n = unname(n), stringsAsFactors = FALSE),
       valores = v, valores_crudos = crudo, col_total = col_total, bloques = bloques, rango = c(lo, hi))
}

#' Especificación de un comparativo de dimensiones entre dos grupos (lámina 94, recetario_m3d.R:79-98)
#'
#' Del mismo payload que el mapa de calor: las dos primeras columnas que no son el Total. La diferencia se
#' calcula entre cifras redondeadas y se escribe sin signo («3 pts»), como el recetario.
#' @keywords internal
preparar_comparativo_dim <- function(payload, n_respondieron = NULL) {
  h <- preparar_heatmap_dim(payload, n_respondieron = n_respondieron)
  if (is.null(h)) return(NULL)
  g <- setdiff(seq_len(ncol(h$valores)), h$col_total)
  if (length(g) != 2L) return(NULL)
  V <- h$valores[, g, drop = FALSE]
  if (any(!is.finite(V))) return(NULL)   # un grupo sin cifra no se compara (antes la diferencia decía «NA»)
  d <- V[, 2] - V[, 1]
  list(version = "comparativo_dim/1", tipo = "comparativo_dim", filas = h$filas, grupos = h$columnas$rotulo[g], n = h$columnas$n[g],
       valores = V, valores_crudos = h$valores_crudos[, g, drop = FALSE],
       textos_diferencia = ifelse(d == 0, "0", sprintf("%d pts", as.integer(abs(d)))))
}

#' Adjunta a lo que devuelve un graficador de dimensiones su especificación nativa
#'
#' El render del plan (reporte_plan_ppt.R) envuelve la llamada al graficador con esto: recalcula el payload con
#' los mismos argumentos (`.dim_build_payload`) y adjunta `heatmap/1` o `comparativo_dim/1`. Si el payload no
#' se puede armar, el gráfico vuelve tal cual (la lámina sigue por la ruta anterior).
#' @param p Lo que devolvió el graficador.
#' @param args Argumentos con que se lo llamó.
#' @param tipo `"heatmap"` o `"comparativo"`.
#' @keywords internal
.espec_dim_adjuntar <- function(p, args, tipo = c("heatmap", "comparativo")) {
  tipo <- match.arg(tipo)
  if (is.null(p)) return(p)
  # Lo que la lámina del recetario no dibuja (brechas declaradas, el Total pedido en el comparativo) se queda en la
  # ruta anterior en vez de perderse en silencio (verificador de N5).
  if (isTRUE(args$brecha_filas) || isTRUE(args$brecha_cols)) return(p)
  if (identical(tipo, "comparativo") && isTRUE(args$incluir_total)) return(p)
  espec <- tryCatch({
    ctx <- .dim_build_context(args$data, instrumento = args$instrumento)
    # Mismos argumentos que el graficador: `incluir_total` NULL lo resuelve el payload con el default del config.
    payload <- .dim_build_payload(ctx, modo = args$modo %||% "general", objetivo = args$objetivo, cruce = args$cruce,
                                  incluir_total = if (identical(tipo, "heatmap")) args$incluir_total else TRUE,
                                  filtros = args$filtros %||% list(), iter_var = args$iter_var, iter_level = args$iter_level)
    # Con iteración el payload elige el nivel por su cuenta: ahí los casos quedan en la base del grupo.
    n_resp <- if (is.null(args$iter_var)) .dim_n_respondieron(args, payload, weight_col = ctx$weight_col) else NULL
    titulo_cruce <- if (!is.null(args$cruce)) {
      lbl <- attr(args$data[[args$cruce]], "label", exact = TRUE); if (is.null(lbl) || !nzchar(lbl)) NULL else as.character(lbl)[1]
    }
    if (identical(tipo, "heatmap")) preparar_heatmap_dim(payload, titulo_cruce = titulo_cruce, n_respondieron = n_resp) else
      preparar_comparativo_dim(payload, n_respondieron = n_resp)
  }, error = function(e) NULL)
  # La lámina dice una sola base: si los casos son los que respondieron, el pie también (verificador de N5).
  if (!is.null(espec) && exists("n_resp", inherits = FALSE) && !is.null(n_resp) && is.finite(n_resp[["Total"]] %||% NA_real_)) {
    espec$n_respondieron_total <- unname(n_resp[["Total"]])
  }
  # ADR 0097: el comparativo pinta sus dos grupos con la paleta del usuario de la lista del cruce (`paletas_cruce`).
  if (!is.null(espec) && identical(espec$tipo, "comparativo_dim")) espec <- .espec_dim_colores_cruce(espec, args)
  if (!is.null(espec)) attr(p, "pulso_espec") <- espec
  p
}

#' La espec del comparativo con `colores` por grupo si la paleta de la lista del cruce es del usuario
#' @keywords internal
.espec_dim_colores_cruce <- function(espec, args) {
  cr <- as.character(args$cruce %||% "")[1]
  if (is.na(cr) || !nzchar(cr)) return(espec)
  pc <- (attr(args$data, "dimensiones_config", exact = TRUE) %||% list())$paletas_cruce %||% list()
  pal <- pc[[cr]] %||% pc[[sub("^.*\\$", "", cr)]]
  .espec_con_colores(espec, pal, rotulos = espec$grupos)
}

#' Cuántos respondieron la batería en cada grupo del cruce (y en el Total)
#'
#' Responde quien tiene al menos un eje del mapa con dato y peso > 0 (la base es casos sin ponderar, contrato
#' base-sin-ponderar F6: una fila con peso 0 o huérfana no suma a la media ponderada y tampoco a la base). Los grupos
#' se nombran con la etiqueta del instrumento, como en el payload. Sin cruce o sin poder emparejar las etiquetas
#' devuelve `NULL` (se usa la base del grupo).
#' @param weight_col Columna de peso del contexto de dimensiones (`ctx$weight_col`); sin ella, peso 1.
#' @keywords internal
.dim_n_respondieron <- function(args, payload, weight_col = NULL) {
  d <- .dim_apply_filters(args$data, filters = args$filtros %||% list())   # los mismos filtros que el payload
  sc <- as.data.frame(payload$score_heat, stringsAsFactors = FALSE)
  ejes <- unique(sc$axis_var[!(sc$tipo %in% "total_cruce")]); ejes <- ejes[ejes %in% names(d)]
  if (!length(ejes)) return(NULL)
  resp <- rowSums(!is.na(as.data.frame(d)[, ejes, drop = FALSE])) > 0 & .dim_safe_weights(d, weight_col) > 0
  out <- c(Total = sum(resp))
  cruce <- args$cruce
  if (is.null(cruce) || !cruce %in% names(d)) return(out)
  x <- as.character(d[[cruce]])
  sv <- args$instrumento$survey; ch <- args$instrumento$choices
  ln <- if (is.data.frame(sv) && "list_name" %in% names(sv)) sv$list_name[which(sv$name == cruce)][1] else NA
  lc <- if (is.data.frame(ch)) grep("^label", names(ch))[1] else NA
  if (!is.na(ln) && !is.na(lc)) {
    cc <- ch[!is.na(ch$list_name) & ch$list_name == ln, , drop = FALSE]
    m <- stats::setNames(as.character(cc[[lc]]), as.character(cc$name)); x <- ifelse(x %in% names(m), unname(m[x]), x)
  }
  grupos <- setdiff(unique(as.character(sc$grupo)), "Total")
  if (!all(grupos %in% x)) return(out)
  c(out, vapply(grupos, function(g) sum(resp & x == g, na.rm = TRUE), 0))
}
