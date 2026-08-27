# El avance por FACULTAD y por SEXO de la hoja «Cómo va el campo».
#
# Gonzalo, pidiendo la tabla de avance para el cliente: «centrarse en el reporte
# de avance por facultad por sexo a la muestra y la sobremuestra y la cantidad
# de aulas aplicadas».
#
# La hoja ya existía y ya traía el agregado del estudio —meta, conseguidas,
# avance, producción por aplicador y la serie diaria—. Lo que NO tenía es el
# corte que decide el operativo: **la cuota es por facultad y dentro por sexo, y
# no se compensa entre celdas** (ADR 0079). Un 98,7 % global puede convivir con
# tres facultades cortas, y el agregado las esconde.
#
# Vive en archivo propio: `carga_aulas_libro_indicadores.R` sólo lo llama.
#
# LO QUE NO PUEDE PUBLICAR, Y POR QUÉ NO SE INVENTA
#
# La **sobremuestra** que Gonzalo nombra —la muestra operativa, 3 750 contra la
# muestra de 2 500 en HSVG2026, ×1,5— **no viaja al libro**: `design_targets`
# trae `facultad`, `faculty_key`, `cuota`, `cuota_sexo` y `tau`, y ni la
# sobremuestra ni su ratio están en la config de Monitoreo. Comprobado el
# 2026-08-27. Publicar aquí una sobremuestra reconstruida sería inventarla, así
# que la columna no se escribe y la falta se declara en la propia hoja.

#' Avance por facultad y sexo contra la cuota del diseño.
#'
#' @param unidades filas del plan.
#' @param efectivas vector con nombre por código operativo (efectivas de
#'   PLATAFORMA; el parte es otra cuenta y no entra aquí).
#' @param cuotas bloque `design_targets` de la config de Monitoreo.
#' @param responses respuestas, para el reparto por sexo.
#' @param validas vector lógico por fila de `responses`.
#' @param cfg config de aulas, para localizar la columna de sexo.
#' @return `data.frame` con una fila por facultad, o `NULL` sin cuotas.
#' @keywords internal
.calaf_avance_por_facultad <- function(unidades, efectivas = NULL, cuotas = NULL,
                                       responses = NULL, validas = NULL, cfg = list()) {
  facs <- if (is.list(cuotas)) (cuotas$facultades %||% list()) else list()
  if (!length(facs)) return(NULL)

  # Índice del plan: código operativo -> facultad, y si el aula se aplicó.
  cod <- vapply(unidades, function(u) .cai_txt(u$operational_code), character(1))
  fac <- vapply(unidades, function(u) .cai_txt(u$faculty), character(1))
  # El eje de aplicación es `operational_status`, el mismo que cuenta el KPI del
  # tablero; `application_status` viene del parte y llega vacío en los estudios
  # reales.
  apl <- vapply(unidades, function(u) .cai_txt(u$operational_status), character(1)) %in%
    c("aplicada", "cerrada")
  clave <- .cm_criterios_fac_key(fac)

  ef_de <- function(codigo) {
    if (is.null(efectivas)) return(NA_real_)
    i <- match(codigo, names(efectivas))
    if (is.na(i)) 0 else suppressWarnings(as.numeric(efectivas[[i]]))
  }
  ef_fila <- vapply(cod, ef_de, numeric(1))

  # Reparto por sexo de lo conseguido: sale de las RESPUESTAS, que es donde el
  # sexo se declara. Sin columna de sexo no se reparte y se dice.
  sexo_por_fac <- list()
  if (is.data.frame(responses) && nrow(responses)) {
    col <- .monitoreo_aulas_col(responses, c("sex", "sexo", "genero", "género", "gender"))
    aula <- .monitoreo_aulas_response_classroom(responses, cfg)
    if (nzchar(col) && length(aula) == nrow(responses)) {
      sk <- .maac_sexo_key(.monitoreo_aulas_values(responses, col, ""))
      ok <- if (!is.null(validas) && length(validas) == nrow(responses)) validas %in% TRUE else rep(TRUE, nrow(responses))
      # LA RESPUESTA SE ATRIBUYE POR `classroom_id`, NO POR `operational_code`.
      # Son dos identificadores distintos del mismo aula: el código operativo es
      # el del libro («CH 31») y el `classroom_id` es el que viaja en el QR. La
      # primera versión mapeó por código y las 3 700 respuestas cayeron en NA,
      # dejando el reparto por sexo vacío en las veinte facultades.
      ids <- vapply(unidades, function(u) .cai_txt(u$classroom_id), character(1))
      alt <- vapply(unidades, function(u) .cai_txt(u$collection_unit_id), character(1))
      mapa <- stats::setNames(clave[nzchar(ids)], ids[nzchar(ids)])
      extra <- nzchar(alt) & !(alt %in% names(mapa))
      if (any(extra)) mapa <- c(mapa, stats::setNames(clave[extra], alt[extra]))
      fk <- unname(mapa[aula]); fk[is.na(fk)] <- ""
      for (k in unique(fk[nzchar(fk)])) {
        sel <- ok & fk == k
        sexo_por_fac[[k]] <- c(F = sum(sel & sk == "F"), M = sum(sel & sk == "M"))
      }
    }
  }

  filas <- lapply(facs, function(f) {
    k <- .cai_txt(f$faculty_key %||% .cm_criterios_fac_key(.cai_txt(f$facultad)))
    idx <- clave == k
    cuota <- .cai_num(f$cuota)
    cs <- f$cuota_sexo %||% list()
    sx <- sexo_por_fac[[k]] %||% c(F = NA_real_, M = NA_real_)
    conseguidas <- if (is.null(efectivas)) NA_real_ else sum(ef_fila[idx], na.rm = TRUE)
    data.frame(
      Facultad = .cai_txt(f$facultad),
      # LA MUESTRA es la cuota del diseño, no la suma de metas por aula: son dos
      # denominadores y el segundo está estructuralmente por encima (ADR 0079).
      Muestra = cuota,
      `Muestra mujeres` = .cai_num(cs$F),
      `Muestra hombres` = .cai_num(cs$M),
      `Aulas aplicadas` = sum(idx & apl),
      `Aulas del plan` = sum(idx),
      Conseguidas = conseguidas,
      `Conseguidas mujeres` = unname(sx[["F"]]),
      `Conseguidas hombres` = unname(sx[["M"]]),
      Avance = if (is.finite(cuota) && cuota > 0 && is.finite(conseguidas)) conseguidas / cuota else NA_real_,
      Faltan = if (is.finite(cuota) && is.finite(conseguidas)) max(0, cuota - conseguidas) else NA_real_,
      check.names = FALSE, stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, filas)
  # Por lo que FALTA y no alfabético: la facultad que peor va abre la tabla, que
  # es lo que se mira primero.
  out[order(-ifelse(is.finite(out$Faltan), out$Faltan, -1)), , drop = FALSE]
}
