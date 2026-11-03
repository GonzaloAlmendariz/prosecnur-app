# La regla del estudio dentro del render de una lámina (ADR 0128 §4)
# ==================================================================
#
# `reporte_plan_ppt.R` está congelado a crecimiento: sus dos llamadas a `.graficos_sig_aplicar*` no pueden recibir
# argumentos nuevos. En cada una, el argumento `diseno` pasa de ser un texto a ser la «fuente» del render
# (`.sig_fuente_render(ctx_var, environment())`): la base exacta que el render tabuló, el grupo de cada caso y los
# niveles del cruce en el orden en que se dibujan. Con eso, la prueba de diseño trabaja sobre los mismos casos que la
# lámina y compara sus sumas contra las del gráfico antes de marcar (`.sig_indicadores_cuadran`).
#
# La regla y la familia de BH no viajan por argumentos: el worker del export (o la vista previa) las fija en la opción
# `prosecnur.sig_informe` (`.sig_informe_activar`). Sin esa opción, la regla es la que propone el diseño de la base y la
# familia es la propia lámina (la nota lo dice).

#' Fuente del render: la base tabulada, el grupo de cada caso y el orden de los niveles
#'
#' Lee del entorno del render las variables que este ya calculó (`df_cross`/`cruce_values`/`ordered_values` en
#' agrupadas; `dsrc`/`x_cruce`/`lvls_keys`/`lvls_labels`/`wrap_y_eff` en multiapiladas por cruce). No calcula nada
#' nuevo: si el render no las tiene, la fuente queda sin microdatos y la lámina usa la prueba de siempre.
#' @keywords internal
.sig_fuente_render <- function(ctx_var, env) {
  toma <- function(n) get0(n, envir = env, inherits = FALSE)
  var <- toma("var") %||% ctx_var$var
  fuente <- list(
    diseno = .graficos_sig_diseno_de_fuente(ctx_var$instrumento, ctx_var$var %||% var),
    var = ctx_var$var %||% var, survey = ctx_var$survey, orders_list = ctx_var$orders_list
  )
  if (!is.null(toma("df_cross")) && !is.null(toma("cruce_values"))) {
    fuente$data <- toma("df_cross"); fuente$g <- toma("cruce_values"); fuente$niveles <- toma("ordered_values")
  } else if (!is.null(toma("dsrc")) && !is.null(toma("x_cruce"))) {
    fuente$data <- toma("dsrc"); fuente$g <- toma("x_cruce"); fuente$niveles <- toma("lvls_keys")
    fuente$rotulos_niveles <- toma("lvls_labels"); fuente$ancho_rotulo <- toma("wrap_y_eff")
    fuente$top2box <- .sig_top2box_del_render(toma("el"), toma("overrides"), toma("preset_args_multi"),
                                              toma("all_opts"), ctx_var$choices)
  }
  structure(fuente, class = "sig_fuente")
}

#' Rótulos del *top two box* que la lámina muestra, o NULL
#'
#' Con `top2box_labels` declarados, esos. Con la columna pedida sin rótulos, las dos últimas categorías sustantivas de
#' la escala (las que suma `.box_decidir` por defecto).
#' @keywords internal
.sig_top2box_del_render <- function(el, overrides, preset_args, opciones, choices = NULL) {
  el <- el %||% list(); overrides <- overrides %||% list(); preset_args <- preset_args %||% list()
  pide <- isTRUE(el$top2box) ||
    identical(as.character(unlist(overrides$barra_extra %||% preset_args$barra_extra_preset %||% ""))[1], "top2box")
  if (!pide) return(NULL)
  lab <- as.character(unlist(el$top2box_labels %||% overrides$top2box_labels %||% preset_args$top2box_labels))
  if (length(lab)) return(lab)
  op <- as.character(opciones %||% character(0))
  op <- op[!.sig_fuera_de_prueba(op)]
  if (length(op) < 3L) return(NULL)
  utils::tail(op, 2L)
}

#' Texto de diseño de una fuente (el de siempre si `diseno` ya era texto)
#' @keywords internal
.sig_diseno_texto <- function(diseno) {
  if (inherits(diseno, "sig_fuente")) as.character(diseno$diseno %||% "independiente") else as.character(diseno %||% "independiente")
}

#' Regla y familia vigentes para un render
#' @keywords internal
.sig_contexto_render <- function(data = NULL) {
  ctx <- .sig_informe_vigente()
  if (!is.null(ctx)) return(ctx)
  list(regla = .sig_regla_normalizar(list(), base = .sig_regla_propuesta(data)), familia = NULL)
}

#' Evalúa con la regla del estudio las celdas que el render dibujó
#'
#' @param n_render Matriz filas × grupos de conteos del gráfico (rótulos de fila = los de la tabla de frecuencias).
#' @param codigos Código del cruce de cada columna de `n_render`, en el orden de las letras.
#' @param etiquetas Rótulo de cada grupo.
#' @param top2box Rótulos del *top two box*, si la lámina lo marca en lugar de las categorías.
#' @return La evaluación con veredictos (`.sig_veredictos`), o NULL si no hay microdatos utilizables.
#' @keywords internal
.sig_evaluar_render <- function(fuente, n_render, codigos, etiquetas, top2box = NULL) {
  if (!inherits(fuente, "sig_fuente") || is.null(fuente$data) || is.null(fuente$g)) return(NULL)
  d <- as.data.frame(fuente$data, stringsAsFactors = FALSE)
  ctx <- .sig_contexto_render(d)
  regla <- ctx$regla
  ind <- tryCatch(.sig_indicadores(d, fuente$var, survey = fuente$survey, orders_list = fuente$orders_list),
                  error = function(e) NULL)
  if (is.null(ind)) return(NULL)
  g <- as.character(fuente$g)
  filas_render <- rownames(n_render)
  cuadra <- .sig_indicadores_cuadran(ind$Y, ind$w, g, codigos, n_render)
  if (any(!cuadra) && exists(".pulso_aviso", mode = "function")) {
    .pulso_aviso(sprintf("Diferencias: %d fila(s) de «%s» no cuadran con el gráfico y no se marcan (%s).",
                         sum(!cuadra), fuente$var, paste(utils::head(filas_render[!cuadra], 3), collapse = ", ")))
  }
  sustantivas <- .sig_filas_a_probar(filas_render, ind$codigos, regla, solo_principal = FALSE)
  if (length(top2box)) {
    rot <- paste(top2box, collapse = " + ")
    ind <- .sig_indicadores_derivar(ind, rot, top2box)
    filas <- intersect(rot, colnames(ind$Y))
  } else {
    filas <- .sig_filas_a_probar(filas_render, ind$codigos, regla, solo_principal = TRUE)
    filas <- filas[cuadra[filas]]
  }
  cl <- if (identical(regla$prueba, "rao_scott") && !is.null(regla$conglomerado) && regla$conglomerado %in% names(d))
    d[[regla$conglomerado]] else NULL
  st <- if (!is.null(regla$estrato) && regla$estrato %in% names(d)) d[[regla$estrato]] else NULL
  ev <- .sig_evaluar(ind, g, codigos, etiquetas, cluster = cl, estrato = st, regla = regla, filas = filas,
                     binaria = identical(ind$tipo, "so") && length(sustantivas) == 2L && !length(top2box))
  ev <- .sig_veredictos(ev, regla, ctx$familia)
  ev$regla <- regla
  ev$filas_sin_cuadrar <- filas_render[!cuadra]
  ev
}

#' Marcas de la evaluación como el data frame que entiende el graficador
#'
#' Una fila por celda marcada: la fila del gráfico, la columna de porcentaje y el sufijo de texto («▲AB»), más la
#' estructura (`.letras`, `.flecha`, `.fragil`) para que el graficador dibuje la cápsula. `col_de_grupo` mapea el
#' código del grupo a su columna `pct_*`.
#' @keywords internal
.sig_marcas_a_sufijos <- function(ev, col_de_grupo, var_categoria = "categoria", fila_de = identity) {
  m <- ev$marcas
  if (is.null(m) || !nrow(m)) return(NULL)
  out <- data.frame(
    categoria = fila_de(m$fila),
    .col_pct = unname(col_de_grupo[m$grupo]),
    .sufijo = paste0(" ", m$flecha, m$letras),
    .letras = m$letras, .flecha = m$flecha, .fragil = m$fragil,
    stringsAsFactors = FALSE
  )
  names(out)[1] <- var_categoria
  out[!is.na(out$.col_pct), , drop = FALSE]
}

#' Agrupadas con la regla del estudio: sufijos por celda y nota, o NULL para seguir con la prueba de siempre
#' @keywords internal
.sig_aplicar_regla_agrupadas <- function(fuente, df_long, cols_n, cols_porcentaje, etiquetas_series,
                                         var_categoria = "categoria") {
  if (!inherits(fuente, "sig_fuente") || is.null(fuente$niveles)) return(NULL)
  j <- suppressWarnings(as.integer(sub("^pct_", "", cols_porcentaje)))
  if (anyNA(j)) return(NULL)
  codigos <- as.character(fuente$niveles)[j]
  filas <- as.character(df_long[[var_categoria]])
  n_render <- vapply(cols_porcentaje, function(cp) suppressWarnings(as.numeric(df_long[[cols_n[[cp]]]])),
                     numeric(length(filas)))
  n_render <- matrix(n_render, nrow = length(filas), dimnames = list(filas, codigos))
  n_render[!is.finite(n_render)] <- 0
  ev <- .sig_evaluar_render(fuente, n_render, codigos, unname(etiquetas_series[cols_porcentaje]))
  if (is.null(ev)) return(NULL)
  list(sufijos = .sig_marcas_a_sufijos(ev, stats::setNames(cols_porcentaje, codigos), var_categoria),
       nota = .sig_nota_de_evaluacion(ev, ev$regla), ev = ev)
}

#' Multiapiladas por cruce con la regla del estudio
#'
#' Aquí cada FILA del gráfico es un grupo y cada columna una opción. Las filas del gráfico llevan el rótulo del nivel
#' envuelto al ancho del eje; se recupera su código comparándolo con los rótulos envueltos de cada nivel.
#' @keywords internal
.sig_aplicar_regla_transpuesto <- function(fuente, df_block, cols_n, cols_porcentaje, etiquetas_opciones,
                                           top2box = NULL, var_categoria = "categoria", var_n = "N") {
  if (!inherits(fuente, "sig_fuente") || is.null(fuente$niveles)) return(NULL)
  envolver <- function(x) {
    w <- suppressWarnings(as.integer(fuente$ancho_rotulo %||% NA)[1])
    if (is.na(w) || !requireNamespace("stringr", quietly = TRUE)) return(as.character(x))
    stringr::str_wrap(as.character(x), width = w)
  }
  filas_graf <- as.character(df_block[[var_categoria]])
  candidatos <- envolver(fuente$rotulos_niveles %||% fuente$niveles)
  idx <- match(filas_graf, candidatos)
  if (anyNA(idx)) return(NULL)
  codigos <- as.character(fuente$niveles)[idx]
  etiquetas <- as.character(fuente$rotulos_niveles %||% fuente$niveles)[idx]
  opciones <- as.character(etiquetas_opciones)
  n_render <- t(vapply(cols_n, function(cn) suppressWarnings(as.numeric(df_block[[cn]])), numeric(length(codigos))))
  n_render <- matrix(n_render, nrow = length(cols_n), dimnames = list(opciones, codigos))
  n_render[!is.finite(n_render)] <- 0
  ev <- .sig_evaluar_render(fuente, n_render, codigos, etiquetas, top2box = top2box)
  if (is.null(ev)) return(NULL)
  # La marca del top two box no tiene segmento propio: la lleva la columna del indicador (`top2box`).
  col_de_opcion <- stats::setNames(as.character(cols_porcentaje), opciones)
  m <- ev$marcas
  sufijos <- NULL
  if (!is.null(m) && nrow(m)) {
    sufijos <- data.frame(
      categoria = filas_graf[match(m$grupo, codigos)],
      .col_pct = if (length(top2box)) rep("top2box", nrow(m)) else unname(col_de_opcion[m$fila]),
      .sufijo = paste0(" ", m$flecha, m$letras), .letras = m$letras, .flecha = m$flecha, .fragil = m$fragil,
      stringsAsFactors = FALSE
    )
    names(sufijos)[1] <- var_categoria
    sufijos <- sufijos[!is.na(sufijos$.col_pct), , drop = FALSE]
  }
  list(sufijos = sufijos, nota = .sig_nota_de_evaluacion(ev, ev$regla), ev = ev, filas_grafico = filas_graf,
       codigos = codigos)
}

#' Marca de la columna del *top two box* (la regla del estudio compara el indicador, no sus segmentos)
#'
#' `sufijos` con `.col_pct` igual al preset de la columna (`"top2box"`) se pegan a su cifra, como los de un segmento.
#' @keywords internal
.sig_sufijos_en_box <- function(cifras, preset, ids, sufijos, var_categoria = "categoria") {
  if (is.null(cifras) || !is.data.frame(sufijos) || !nrow(sufijos) ||
      !all(c(var_categoria, ".col_pct", ".sufijo") %in% names(sufijos))) return(cifras)
  s <- sufijos[sufijos$.col_pct == preset, , drop = FALSE]
  if (!nrow(s)) return(cifras)
  i <- match(as.character(s[[var_categoria]]), ids)
  ok <- !is.na(i) & nzchar(s$.sufijo)
  cifras[i[ok]] <- paste(cifras[i[ok]], trimws(s$.sufijo[ok]))
  cifras
}

#' Rótulo de grupo con su letra: «(A) Economía y Finanzas»
#'
#' La nota ya no repite el mapa «A = … | B = …» (D6 de la propuesta): la letra va junto al grupo. Mientras el
#' graficador no la dibuje dentro del cuadro de color de la leyenda, va en el texto del rótulo.
#' @keywords internal
.sig_rotulo_con_letra <- function(letra, rotulo) paste0("(", letra, ") ", rotulo)

#' Agrupadas: la letra de cada serie en su rótulo de leyenda (y la paleta, que se indexa por rótulo, la sigue)
#' @keywords internal
.sig_letras_en_leyenda <- function(base_args, con_regla, cols_porcentaje) {
  if (is.null(con_regla$sufijos) || !nrow(con_regla$sufijos)) return(base_args)
  ev <- con_regla$ev
  et <- base_args$etiquetas_series
  if (is.null(et) || is.null(names(et))) return(base_args)
  codigos <- names(ev$letras)
  for (k in seq_along(cols_porcentaje)) {
    cp <- cols_porcentaje[[k]]
    if (!cp %in% names(et) || k > length(codigos)) next
    viejo <- et[[cp]]
    nuevo <- .sig_rotulo_con_letra(ev$letras[[codigos[[k]]]], viejo)
    et[[cp]] <- nuevo
    pal <- base_args$colores_series
    if (!is.null(names(pal)) && viejo %in% names(pal)) names(pal)[names(pal) == viejo] <- nuevo
    base_args$colores_series <- pal
  }
  base_args$etiquetas_series <- et
  base_args
}

#' Apiladas por cruce: la letra de cada grupo delante del rótulo de su fila
#' @keywords internal
.sig_letras_en_filas <- function(base_args, con_regla, var_categoria = "categoria") {
  if (is.null(con_regla$sufijos) || !nrow(con_regla$sufijos) || is.null(con_regla$filas_grafico)) return(base_args)
  viejas <- con_regla$filas_grafico
  nuevas <- .sig_rotulo_con_letra(unname(con_regla$ev$letras[con_regla$codigos]), viejas)
  d <- base_args$data
  if (is.null(d) || !var_categoria %in% names(d)) return(base_args)
  d[[var_categoria]] <- nuevas[match(as.character(d[[var_categoria]]), viejas)]
  base_args$data <- d
  suf <- base_args$sufijos_etiqueta
  suf[[var_categoria]] <- nuevas[match(as.character(suf[[var_categoria]]), viejas)]
  base_args$sufijos_etiqueta <- suf
  base_args
}
