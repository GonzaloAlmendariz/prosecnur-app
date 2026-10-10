# =============================================================================
# graficos_estandar_api.R — el estándar del recetario, expuesto al editor (K1, plan F6 §5.1)
# =============================================================================
#
# El editor de Gráficos dibuja las composiciones desde las ranuras, la pestaña «Medidas» y el «cuándo se usa» de cada
# tipo de lámina. Todo eso ya vive en `inst/estandar/estandar_pulso.json` (ADR 0092), que lee `estandar_tokens.R`:
# aquí sólo se le da forma de respuesta, sin copiar un número. Cambiar una ranura es cambiar el recetario y re-exportar
# el JSON; el editor lo ve en la siguiente llamada (Gonzalo, 2026-10-10: «el recetario siempre manda»).
#
# La ranura del JSON trae su papel en `tipo` (grafico, texto, cifras); en la respuesta se llama `rol` para no chocar
# con el `tipo` de lámina del editor. Colores, paletas y geometría van tal cual.

#' Una ranura del estándar con su papel como `rol` y su caja en pulgadas
#' @keywords internal
.graficos_estandar_ranura <- function(r) {
  list(rol = as.character(r$tipo), x = r$x, y = r$y, w = r$w, h = r$h)
}

#' Un tipo de lámina del estándar en la forma que lee el editor
#' @keywords internal
.graficos_estandar_tipo <- function(t) {
  list(
    id = as.character(t$id),
    nombre = as.character(t$nombre),
    uso = as.character(t$uso %||% ""),
    layout = as.character(t$layout),
    familia = t$familia,
    ranuras = lapply(t$ranuras, .graficos_estandar_ranura)
  )
}

#' Respuesta de `GET /api/graficos/estandar`
#'
#' @return `list(version, fuente, unidad, geometria, tipos_lamina, colores, paletas)`; las medidas en pulgadas.
#' @keywords internal
.graficos_estandar_payload <- function() {
  est <- .std()
  list(
    version = est$version,
    fuente = est$fuente,
    unidad = "in",
    geometria = est$ppt$geometria,
    tipos_lamina = lapply(est$ppt$tipos_lamina, .graficos_estandar_tipo),
    colores = est$ppt$colores,
    paletas = est$ppt$paletas
  )
}

#' Tipo del estándar que le corresponde a una lámina del registro
#'
#' Los ids del estándar son los nombres de las láminas (`p_slide_1_grafico`); las once de estructura sin ranuras
#' (portada, índice, separador, ficha técnica, población de 2 a 4 sin cifras…) no tienen tipo.
#' @return `list(id, nombre)` o `NA` (la API lo escribe `null`).
#' @keywords internal
.graficos_estandar_de_slide <- function(nombre) {
  for (t in .std_valor("ppt", "tipos_lamina")) {
    if (identical(t$id, nombre)) return(list(id = as.character(t$id), nombre = as.character(t$nombre)))
  }
  NA
}
