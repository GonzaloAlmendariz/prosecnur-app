# =============================================================================
# graficos_cifras_clave.R — las cifras de una lámina de resumen con su clave estable (ADR 0135, punto 6)
# =============================================================================
#
# El cierre con hallazgos (graficos_cierre_hallazgos.R) toma sus cifras de otras láminas por referencia viva: el id de la
# lámina de origen y la clave de una de sus cifras. Las cifras se LEEN de la especificación que dibuja esa lámina
# (`attr(p, "pulso_espec")`), con su mismo texto: nunca se recalculan aparte.
#
# Cada cifra es `list(clave, rotulo, texto, valor, unidad)`: `texto` es el de la lámina, tal cual; `unidad` lo completa
# cuando la lámina lo da por entendido («+12» en la columna «Diferencia» se lee «+12 pts»); `valor` es el número.
#
# Claves por especificación (el tema y el público con el rótulo que muestra la lámina):
#   contraste/1    "diferencia:<tema>", "valor:<tema>:<grupo>"
#   panorama/1     "mediana:<publico>", "bajo:<publico>"
#   fortalezas/1   "valor:<tema>"
#   cobertura/1    "casos:<publico>", "tasa:<publico>", "meta:<publico>"
#   divergentes/1  "t2b:<tema>", "sin_info:<tema>"
#
# Con `detalle` (graficos_cifras_detalle.R) el mismo render acepta también los categóricos, apilados y divergentes y
# publica la base, la cifra de cada categoría, las sumas por método de redondeo, la caja y los lados.
#
# Se derivan de la especificación al pedirlas (`.cifras_clave(espec)`) en vez de guardarse en ella: tres de esas
# especificaciones ya usan el nombre `cifras` para las cifras rotuladas de su dibujo, y una copia guardada sería un
# segundo lugar donde pueden discrepar.

.CIFRAS_CLAVE_TIPOS <- c("contraste", "panorama", "fortalezas", "cobertura", "divergentes")
.CIFRAS_CLAVE_GRAFICADORES <- c("p_dumbbell", "p_panorama", "p_fortalezas", "p_cobertura", "p_barras_divergentes")

#' Una cifra con su clave
#' @keywords internal
.cifra_clave <- function(clave, rotulo, texto, valor, unidad = "") {
  list(clave = as.character(clave), rotulo = as.character(rotulo), texto = as.character(texto),
       valor = if (is.finite(suppressWarnings(as.numeric(valor)))) as.numeric(valor) else NULL, unidad = as.character(unidad))
}

#' Las cifras con clave de una especificación; lista vacía si el tipo no las declara
#' @keywords internal
.cifras_clave <- function(espec) {
  if (!is.list(espec)) return(list())
  f <- switch(as.character(espec$tipo %||% "")[1],
              contraste = .cifras_clave_contraste, panorama = .cifras_clave_panorama, fortalezas = .cifras_clave_fortalezas,
              cobertura = .cifras_clave_cobertura, divergentes = .cifras_clave_divergentes, NULL)
  if (is.null(f)) list() else f(espec)
}

#' @keywords internal
.cifras_clave_contraste <- function(esp) {
  out <- list()
  for (i in seq_along(esp$rotulos)) {
    t <- esp$rotulos[i]
    out[[length(out) + 1L]] <- .cifra_clave(paste0("diferencia:", t), sprintf("%s: diferencia (%s)", t, esp$sentido_diferencia %||% ""),
                                            esp$textos_diferencia[i], esp$diferencia[i], "pts")
    for (j in seq_along(esp$grupos)) {
      out[[length(out) + 1L]] <- .cifra_clave(paste0("valor:", t, ":", esp$grupos[j]), sprintf("%s: %s", t, esp$grupos[j]),
                                              esp$cifras[i, j], esp$valores[i, j], "%")
    }
  }
  out
}

#' @keywords internal
.cifras_clave_panorama <- function(esp) {
  out <- list()
  for (i in seq_along(esp$publicos)) {
    p <- esp$publicos[i]
    out[[length(out) + 1L]] <- .cifra_clave(paste0("mediana:", p), sprintf("%s: mediana", p), esp$textos_mediana[i], esp$medianas[i])
    out[[length(out) + 1L]] <- .cifra_clave(paste0("bajo:", p), sprintf("%s: %s", p, tolower(esp$encabezado_bajo %||% "bajo")),
                                            esp$textos_bajo[i], esp$bajo[i])
  }
  out
}

#' @keywords internal
.cifras_clave_fortalezas <- function(esp) {
  out <- list()
  for (cl in esp$columnas %||% list()) for (i in seq_along(cl$rotulos)) {
    out[[length(out) + 1L]] <- .cifra_clave(paste0("valor:", cl$rotulos[i]), sprintf("%s (%s)", cl$rotulos[i], tolower(cl$titulo %||% "")),
                                            cl$cifras[i], cl$valores[i])
  }
  out
}

#' @keywords internal
.cifras_clave_cobertura <- function(esp) {
  pb <- esp$publicos; out <- list()
  for (i in seq_len(NROW(pb))) {
    p <- pb$publico[i]
    out[[length(out) + 1L]] <- .cifra_clave(paste0("casos:", p), sprintf("%s: casos", p), pb$texto_casos[i], pb$casos[i])
    if (is.finite(pb$tasa[i])) out[[length(out) + 1L]] <- .cifra_clave(paste0("tasa:", p), sprintf("%s: tasa de respuesta", p), pb$texto_tasa[i], pb$tasa[i])
    if (is.finite(pb$meta[i])) out[[length(out) + 1L]] <- .cifra_clave(paste0("meta:", p), sprintf("%s: meta", p), pb$texto_meta[i], pb$meta[i])
  }
  out
}

#' @keywords internal
.cifras_clave_divergentes <- function(esp) {
  k <- 10^(esp$decimales %||% 0L); lado <- esp$categorias$lado; out <- list()
  si <- which(lado == "sin_inf")
  for (i in seq_along(esp$filas)) {
    t <- esp$filas[i]
    out[[length(out) + 1L]] <- .cifra_clave(paste0("t2b:", t), sprintf("%s: acuerdo", t), esp$cifras_pos[i], esp$total_pos[i] / k)
    if (length(si)) {
      u <- sum(esp$unidades[i, si])
      out[[length(out) + 1L]] <- .cifra_clave(paste0("sin_info:", t), sprintf("%s: Sin información", t),
                                              .pulso_fmt_pct_unidades(u, esp$decimales %||% 0L), u / k)
    }
  }
  out
}

#' Las cifras de un gráfico, renderizado con el motor del export (lo que responde el endpoint de cifras)
#'
#' @param graficador,args Los del gráfico, como los manda el editor.
#' @param fuentes,presets Fuentes del estudio y presets efectivos (`.build_presets`).
#' @param detalle Si `TRUE`, acepta también los categóricos, apilados y divergentes (`.CIFRAS_DETALLE_GRAFICADORES`) y
#'   agrega `detalle` (graficos_cifras_detalle.R): base, cifra de cada categoría, sumas por redondeo, caja y lados.
#' @param caja Rótulos de las categorías de una caja pedida (sólo con `detalle`).
#' @return `list(ok, tipo, cifras, avisos)`, más `detalle` (objeto, o `NA` si la lámina no lo publica) con `detalle`.
#' @keywords internal
.graficos_cifras_de_grafico <- function(graficador, args, fuentes, presets = NULL, detalle = FALSE, caja = NULL) {
  graficador <- trimws(as.character(graficador %||% "")[1])
  admitidos <- if (isTRUE(detalle)) union(.CIFRAS_CLAVE_GRAFICADORES, .CIFRAS_DETALLE_GRAFICADORES) else .CIFRAS_CLAVE_GRAFICADORES
  if (is.na(graficador) || !graficador %in% admitidos) {
    stop_api(400, "E_CIFRAS_INVALIDO", if (isTRUE(detalle)) sprintf("El gráfico «%s» no publica el detalle de sus cifras.", graficador %||% "")
                                       else sprintf("El gráfico «%s» no publica cifras para el cierre.", graficador %||% ""))
  }
  caja <- if (isTRUE(detalle)) .cifras_detalle_caja(caja) else character(0)
  if (!.graficos_sources_usable(fuentes$data_sources %||% list(), fuentes$inst_sources %||% list())) {
    stop_api(409, "E_NO_VALID_RP_DATA", "La fuente procesada para Gráficos no está disponible o quedó incompleta.")
  }
  el <- .rebuild_graf(list(graficador = graficador, args = as.list(args %||% list())))
  if (is.null(el) || is.null(el$.element_type)) {
    out <- list(ok = TRUE, tipo = "", cifras = list(), avisos = list("Faltan datos del gráfico para leer sus cifras."))
    if (isTRUE(detalle)) out$detalle <- NA
    return(out)
  }
  avisos <- character(0)
  out <- withCallingHandlers(
    reporte_ppt_plan(data = fuentes$data_sources, instrumento = fuentes$inst_sources, presets = presets,
                     plan = p_plan(slides = list(p_slide_1_grafico(el, titulo = "Cifras"))), solo_lista = TRUE,
                     build_render_meta = isTRUE(detalle), mensajes_progreso = FALSE),
    warning = function(w) { avisos <<- c(avisos, conditionMessage(w)); invokeRestart("muffleWarning") })
  esp <- attr(out$rendered[[1]], "pulso_espec", exact = TRUE)
  cifras <- .cifras_clave(esp)
  det <- if (isTRUE(detalle)) .cifras_detalle(esp, (out$render_meta[[1]] %||% list())$base %||% "", caja) else NULL
  if (isTRUE(detalle) && is.null(det)) avisos <- c(avisos, "La lámina no publica el detalle de sus cifras con esta configuración.")
  if (!length(cifras) && !isTRUE(detalle)) avisos <- c(avisos, "La lámina no dibujó cifras con estos datos.")
  res <- list(ok = TRUE, tipo = as.character(esp$version %||% "")[1], cifras = cifras, avisos = as.list(unique(avisos)))
  if (isTRUE(detalle)) res$detalle <- det %||% NA
  res
}
