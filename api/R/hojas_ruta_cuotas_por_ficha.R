# Cuotas de sexo y edad por ficha (UMP), repartidas desde la cuota del distrito.
#
# La cuota del estudio vive en el grano de `quota$cells` (ubigeo × sexo × rango de
# edad). Cada ficha titular recibe sus marginales —cuántos hombres y mujeres,
# cuántos por rango de edad— repartiendo la cuota del distrito entre las fichas del
# distrito, de modo que (I1) la suma de las fichas reproduce la cuota del distrito
# por sexo y por rango, y (I2) cada ficha suma sus k entrevistas. Antes la edad ya
# se repartía así, pero el sexo quedaba fijo en k/2 en todas las fichas.
#
# Se reparten marginales, no la tabla sexo × edad (revisión metodológica de U15:
# con k = 8 y 8 celdas una tabla por ficha sería casi toda ceros y unos, y desvía
# más la ficha). Las celdas sexo × edad se siguen a nivel de distrito en Monitoreo.
# El reparto es el sistemático de `.hojas_ruta_deal_age_quota`: determinista sobre
# el orden de selección, con el sobrante de cada categoría espaciado por todo el
# recorrido (estratificación implícita), no amontonado en una zona.
# Los reemplazos heredan la cuota de su titular.

.hojas_ruta_cpf_texto <- function(mat) apply(mat, 1L, function(r) paste(as.integer(r), collapse = ","))

#' Reparte la cuota de edad y de sexo de cada distrito entre sus fichas titulares.
#'
#' @param blocks_df,replacement_blocks_df Titulares y reemplazos de la muestra.
#' @param cells `quota$cells` (ubigeo, sexo, rango_id, cuota).
#' @param cfg Config normalizada (rangos de edad).
#' @return list(blocks, replacements, alertas) con `cuota_edad_totals` y
#'   `cuota_sexo_totals` ("h,m") en cada bloque.
hojas_ruta_cuotas_por_ficha <- function(blocks_df, replacement_blocks_df, cells, cfg) {
  alertas <- list()
  out <- list(blocks = blocks_df, replacements = replacement_blocks_df, alertas = alertas)
  if (!nrow(blocks_df) || !"ubigeo" %in% names(blocks_df) || !is.data.frame(cells) || !nrow(cells) ||
      !all(c("ubigeo", "rango_id", "cuota") %in% names(cells))) {
    return(out)
  }
  defs <- cfg$age_ranges
  if (!length(defs)) defs <- .hojas_ruta_age_defs_default()
  age_ids <- vapply(defs, function(d) .hojas_ruta_scalar(d$id, ""), character(1))
  cuota <- suppressWarnings(as.numeric(cells$cuota)); cuota[is.na(cuota)] <- 0
  c_ubigeo <- as.character(cells$ubigeo)
  c_rango <- as.character(cells$rango_id)
  c_sexo <- if ("sexo" %in% names(cells)) as.character(cells$sexo) else rep(NA_character_, nrow(cells))
  ent <- suppressWarnings(as.integer(blocks_df$entrevistas)); ent[is.na(ent)] <- 0L
  edad_col <- rep("", nrow(blocks_df))
  sexo_col <- rep("", nrow(blocks_df))
  for (u in unique(as.character(blocks_df$ubigeo))) {
    filas <- which(as.character(blocks_df$ubigeo) == u)
    en_u <- c_ubigeo == u
    if (!any(en_u)) {
      alertas[[length(alertas) + 1L]] <- list(level = "warn", code = "W_QUOTA_PER_SHEET_FALLBACK", ubigeo = u,
        message = sprintf("El distrito %s no tiene cuotas por sexo y edad: sus hojas calculan la cuota por manzana.", u))
      next
    }
    edad_u <- vapply(age_ids, function(id) sum(cuota[en_u & c_rango == id]), numeric(1))
    sexo_u <- c(sum(cuota[en_u & c_sexo == "Hombre"]), sum(cuota[en_u & c_sexo == "Mujer"]))
    if (sum(edad_u) > 0 && sum(edad_u) != sum(ent[filas])) {
      alertas[[length(alertas) + 1L]] <- list(level = "warn", code = "W_QUOTA_PER_SHEET_RESCALED", ubigeo = u,
        message = sprintf("En %s las hojas suman %d entrevistas y la cuota del distrito %d: el reparto por sexo y edad se ajustó a las hojas, conservando las proporciones.",
                          as.character(blocks_df$distrito[filas[1]] %||% u), sum(ent[filas]), as.integer(round(sum(edad_u)))))
    }
    edad_col[filas] <- .hojas_ruta_cpf_texto(.hojas_ruta_deal_age_quota(edad_u, ent[filas]))
    if (sum(sexo_u) > 0) sexo_col[filas] <- .hojas_ruta_cpf_texto(.hojas_ruta_deal_age_quota(sexo_u, ent[filas]))
  }
  blocks_df$cuota_edad_totals <- edad_col
  blocks_df$cuota_sexo_totals <- sexo_col
  if (nrow(replacement_blocks_df) && "titular_id_manzana" %in% names(replacement_blocks_df)) {
    m <- match(as.character(replacement_blocks_df$titular_id_manzana), as.character(blocks_df$id_manzana))
    replacement_blocks_df$cuota_edad_totals <- ifelse(is.na(m), "", edad_col[m])
    replacement_blocks_df$cuota_sexo_totals <- ifelse(is.na(m), "", sexo_col[m])
  }
  list(blocks = blocks_df, replacements = replacement_blocks_df, alertas = alertas)
}

#' Hombres y mujeres de una ficha: la cuota repartida del distrito si el bloque la
#' trae y suma k. Si no (muestra anterior al reparto), mitad y mitad, y el sobrante
#' de un k impar al sexo con más población: la población de UNA manzana es demasiado
#' chica para repartir proporcional (daba 6/2 en una manzana sesgada).
.hojas_ruta_cuota_sexo_de_ficha <- function(block, entrevistas, sex_pop) {
  guardada <- .hojas_ruta_parse_edad_totals(block$cuota_sexo_totals %||% NULL, 2L)
  if (!is.null(guardada) && sum(guardada) == entrevistas) return(as.integer(guardada))
  h <- entrevistas %/% 2L
  m <- entrevistas %/% 2L
  if (entrevistas %% 2L == 1L) {
    mas_mujeres <- sum(sex_pop, na.rm = TRUE) > 0 && isTRUE(sex_pop[["Mujer"]] > sex_pop[["Hombre"]])
    if (mas_mujeres) m <- m + 1L else h <- h + 1L
  }
  as.integer(c(h, m))
}
