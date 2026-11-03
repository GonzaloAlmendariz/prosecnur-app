# Tablas de cruces con la regla de diferencias del estudio (ADR 0126 §1, decisión D1)
# ==================================================================================
#
# Las tablas marcaban con la z de muestreo aleatorio simple y Bonferroni por fila mientras las láminas del mismo estudio
# pasaban a Rao-Scott con BH del informe: la doble vara que el dictamen de CCSS 2026-II encontró (268 de 9.029 pares
# cambian de veredicto, letras en grupos de 6 y 11 casos). Con la regla del estudio vigente en el worker
# (`prosecnur.sig_informe`), la tabla usa la misma evaluación que la lámina y la misma familia de BH, así que dan las
# mismas letras. Sin regla vigente (un llamador viejo, un script), la tabla sigue con `comparar_columnas_sig`.
#
# En la tabla se marcan las dos filas de una dicotómica (es una referencia exhaustiva), pero la familia cuenta esa
# prueba una sola vez. La letra en minúscula es la frágil, porque una celda de Excel no tiene contorno.

#' Letras de una tabla con la regla vigente, o la prueba de siempre si no hay regla
#' @keywords internal
.cruces_comparar_con_regla <- function(data, var, opciones, codes_row, estratos, var_estrato, tp, weight_col, nn,
                                       alpha = 0.05) {
  ctx <- .sig_informe_vigente()
  if (is.null(ctx)) return(comparar_columnas_sig(nn$n_mat, nn$N_vec, alpha = alpha))
  regla <- ctx$regla
  opciones <- as.character(opciones); codes_row <- as.character(codes_row); estratos <- as.character(estratos)
  Y <- vapply(codes_row, function(code) .repeat_outcome_for_code(data, var, code, codes_row, tp), numeric(nrow(data)))
  if (!is.matrix(Y)) Y <- matrix(Y, nrow = nrow(data))
  colnames(Y) <- opciones
  w <- get_pesos(data, weight_col)
  ind <- list(Y = Y, codigos = stats::setNames(as.list(codes_row), opciones), tipo = tp, w = w,
              en_base = rowSums(!is.na(Y)) > 0)
  filas <- .sig_filas_a_probar(opciones, ind$codigos, regla, solo_principal = FALSE)
  cl <- if (identical(regla$prueba, "rao_scott") && !is.null(regla$conglomerado) && regla$conglomerado %in% names(data))
    data[[regla$conglomerado]] else NULL
  st <- if (!is.null(regla$estrato) && regla$estrato %in% names(data)) data[[regla$estrato]] else NULL
  ev <- .sig_evaluar(ind, as.character(data[[var_estrato]]), estratos, estratos, cluster = cl, estrato = st,
                     regla = regla, filas = filas, binaria = !identical(tp, "sm") && length(filas) == 2L)
  ev <- .sig_veredictos(ev, regla, ctx$familia)
  letras <- matrix("", length(opciones), length(estratos), dimnames = list(opciones, estratos))
  sig <- matrix(FALSE, length(opciones), length(estratos), dimnames = list(opciones, estratos))
  m <- ev$marcas
  if (!is.null(m)) for (k in seq_len(nrow(m))) {
    txt <- if (nzchar(m$letras[k])) m$letras[k] else m$flecha[k]
    letras[m$fila[k], m$grupo[k]] <- if (isTRUE(m$fragil[k])) tolower(txt) else txt
    sig[m$fila[k], m$grupo[k]] <- TRUE
  }
  list(letras = letras, sig = sig, method = paste0("regla_", regla$prueba), regla = regla)
}

#' Nota de la tabla con la regla del estudio, desde la fuente única de textos
#' @keywords internal
.cruces_nota_regla <- function(regla) {
  magnitud <- if ((regla$umbral_puntos %||% 0) > 0) sprintf(" y de al menos %s puntos", .sig_num(regla$umbral_puntos)) else ""
  base <- if (identical(regla$prueba, "rao_scott")) {
    sprintf("Las columnas con menos de %s casos o de %s %ss no se comparan.", .sig_num(regla$base_minima),
            regla$conglomerados_minimos, .sig_nombre_conglomerado(regla$conglomerado))
  } else {
    sprintf("Las columnas con menos de %s casos no se comparan.", .sig_num(regla$base_minima))
  }
  paste0("Las letras comparan las columnas de una misma variable de cruce: la letra marca la columna superada, con ",
         "diferencia significativa", magnitud, ". En minúscula, frágil (p ajustado entre 0.01 y ",
         .sig_num(regla$alfa), "). ", base, " ", .sig_texto_metodo(regla))
}
