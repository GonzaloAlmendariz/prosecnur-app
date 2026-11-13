# NSE de cada distrito para el atlas de Territorio: el nivel que predomina entre sus hogares
# (GeoPeru/INEI, Ingreso per cápita del hogar 2017, por manzana). Con una ciudad abierta, el mapa
# colorea cada distrito por este nivel para elegir distritos sin cargar sus manzanas: la primera
# lectura de las manzanas de un distrito tarda unos 15 s, y Lima tiene 50 (revisión del 7 nov 2026).

.hojas_ruta_nse_distrito_cache <- new.env(parent = emptyenv())

#' Hogares por nivel NSE y nivel predominante de cada distrito con NSE empaquetado.
#'
#' @return data.frame(ubigeo, nse_predominante, nse_hogares, nse_1..nse_5): `nse_predominante` es el
#'   nivel 1 (Alto) a 5 (Bajo) con más hogares; las manzanas sin dato no cuentan.
#' @noRd
hojas_ruta_nse_por_distrito <- function() {
  path <- hojas_ruta_nse_inei_path()
  clave <- paste(path, if (file.exists(path)) file.mtime(path) else "")
  if (identical(.hojas_ruta_nse_distrito_cache$clave, clave)) return(.hojas_ruta_nse_distrito_cache$valor)
  nse <- tryCatch(hojas_ruta_nse_inei(), error = function(e) data.frame())
  vacio <- data.frame(ubigeo = character(0), nse_predominante = integer(0), nse_hogares = numeric(0))
  valor <- if (!nrow(nse) || !all(c("ubigeo", "nse_nivel", "nse_hogares") %in% names(nse))) {
    vacio
  } else {
    # El código se toma del rótulo, como en la geometría del lienzo (1 = Alto … 5 = Bajo): el `nse_codigo`
    # de la fuente va al revés (1 = BAJO).
    rotulos <- unique(nse$nse_nivel)
    nse$nivel <- vapply(rotulos, .hojas_ruta_geometria_nivel_nse, integer(1), USE.NAMES = FALSE)[match(nse$nse_nivel, rotulos)]
    con_dato <- nse[nse$nivel %in% 1:5 & !is.na(nse$nse_hogares), , drop = FALSE]
    if (!nrow(con_dato)) {
      vacio
    } else {
      tabla <- tapply(con_dato$nse_hogares, list(con_dato$ubigeo, factor(con_dato$nivel, levels = 1:5)), sum)
      tabla[is.na(tabla)] <- 0
      total <- rowSums(tabla)
      # Empate: el nivel más bajo de los empatados (código mayor), para no presentar como alto un distrito mixto.
      pred <- apply(tabla, 1L, function(r) max(which(r == max(r))))
      out <- data.frame(ubigeo = rownames(tabla), nse_predominante = as.integer(ifelse(total > 0, pred, NA_integer_)),
                        nse_hogares = as.numeric(total), stringsAsFactors = FALSE)
      for (k in 1:5) out[[paste0("nse_", k)]] <- as.numeric(tabla[, k])
      rownames(out) <- NULL
      out
    }
  }
  .hojas_ruta_nse_distrito_cache$clave <- clave
  .hojas_ruta_nse_distrito_cache$valor <- valor
  valor
}

#' NSE de una lista de ubigeos para los territorios: el nivel predominante y la proporción de hogares en
#' cada nivel (`nse_pct_1` Alto … `nse_pct_5` Bajo, 0 a 1). NA donde no hay NSE. El reparto va a la ficha del
#' distrito: «medio» predominante puede esconder un 40 % de hogares bajos (revisión del 7 nov 2026).
#' @noRd
hojas_ruta_nse_columnas <- function(ubigeos) {
  ubigeos <- .pulso_ceros_izq(6L, as.character(ubigeos))
  tabla <- hojas_ruta_nse_por_distrito()
  i <- match(ubigeos, tabla$ubigeo)
  out <- data.frame(nse_predominante = tabla$nse_predominante[i])
  total <- tabla$nse_hogares[i]
  for (k in 1:5) {
    hogares <- if (paste0("nse_", k) %in% names(tabla)) tabla[[paste0("nse_", k)]][i] else rep(NA_real_, length(i))
    out[[paste0("nse_pct_", k)]] <- ifelse(!is.na(total) & total > 0, round(hogares / total, 4), NA_real_)
  }
  out
}
