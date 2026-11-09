# =============================================================================
# reporte_slides_composicion_disposicion.R — la lámina de cinco gráficos en «tres arriba y dos abajo» o al revés
# =============================================================================
#
# Ítem 1 del checklist del catálogo (Gonzalo, 2026-11-08): «A este le falta intercalar entre tres arriba y dos abajo y
# viceversa». La disposición la elige el analista en la lámina (`meta$disposicion`, «3+2» por defecto o «2+3»); el motor
# no la decide. Las ranuras se leen en orden de lectura en las dos: con «2+3», la primera y la segunda van arriba y las
# otras tres abajo. Las medidas salen de las ranuras del estándar (`ppt.tipos_lamina`): la fila de dos es la de abajo de
# «3+2» y la de tres, la de arriba, con la misma calle entre filas y el mismo fin del contenido.
#
# La plantilla de respaldo (construir_plantilla_ppt.R, congelada en OOXML) sólo trae «3+2»; con «2+3» la lámina va
# siempre por la composición nativa (un panel que no cabe en piezas nativas lleva su gráfico dentro de su panel).

.DISPOSICIONES_5 <- c("3+2", "2+3")

#' Disposición de la lámina de cinco gráficos: «3+2» si no se declara; un valor fuera del catálogo es un error del plan
#' @return «3+2» o «2+3».
#' @keywords internal
.slide_disposicion_5 <- function(x) {
  v <- trimws(as.character(unlist(x %||% character(0)))[1])
  if (!length(v) || is.na(v) || !nzchar(v)) return(.DISPOSICIONES_5[1])
  if (!v %in% .DISPOSICIONES_5) {
    .plan_spec_abort(sprintf("`disposicion` de la lámina de cinco gráficos debe ser «%s»; llegó «%s».",
                             paste(.DISPOSICIONES_5, collapse = "» o «"), v))
  }
  v
}

#' Fija la disposición de la lámina mientras se compone (la lee `.lam_poblacion_5_geo`)
#' @return Las opciones anteriores, para `on.exit(options(...))`.
#' @keywords internal
.lam_disposicion_fijar <- function(slide) {
  if (!identical(as.character(slide$.slide_type %||% "")[1], "poblacion_5")) return(list())
  options(prosecnur.lam_disposicion_5 = .slide_disposicion_5((slide$meta %||% list())$disposicion))
}

#' ¿La lámina pide una disposición que la plantilla de respaldo no tiene? Entonces va por la composición nativa
#' @keywords internal
.lam_disposicion_forzada <- function(slide, stype) {
  identical(stype, "poblacion_5") && !identical((slide$meta %||% list())$motor_nativo, FALSE) &&
    identical(.slide_disposicion_5((slide$meta %||% list())$disposicion), "2+3")
}

#' Paneles de la lámina de cinco gráficos con la disposición vigente
#' @keywords internal
.lam_poblacion_5_geo <- function() {
  d <- getOption("prosecnur.lam_disposicion_5", .DISPOSICIONES_5[1])
  r <- Filter(function(x) identical(x$tipo, "grafico"), .std_tipo_lamina("p_slide_5_graficos_poblacion")$ranuras %||% list())
  if (!identical(d, "2+3") || length(r) != 5L) return(.lam_poblacion_geo("p_slide_5_graficos_poblacion"))
  # «2+3»: la fila ancha (ranuras 4 y 5 del estándar) sube y la de tres baja, con la misma calle y el mismo fin.
  calle <- r[[4]]$y - (r[[1]]$y + r[[1]]$h)
  y_abajo <- r[[1]]$y + r[[4]]$h + calle
  ranuras <- c(lapply(r[4:5], function(q) utils::modifyList(q, list(y = r[[1]]$y))),
               lapply(r[1:3], function(q) utils::modifyList(q, list(y = y_abajo))))
  .lam_poblacion_geo("p_slide_5_graficos_poblacion", ranuras = ranuras)
}
