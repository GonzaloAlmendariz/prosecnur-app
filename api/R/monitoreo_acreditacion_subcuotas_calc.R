# Subcuotas de Monitoreo desde el reparto por estrato del calculador (L29 del
# loop de mejoras de Cálculo de muestra, 2026-09-27).
#
# «Enviar a Monitoreo» copia los componentes del calculador. Monitoreo sigue
# `sub_cuotas` (celda → cuota), pero el calculador publica el reparto en
# `distribucion_estratos`: la meta total (317) llegaba y el reparto se perdía,
# así que Monitoreo no veía que Puno pedía 30. La cuota de cada estrato son sus
# COMPLETAS (`n`), que es lo que Monitoreo cuenta como efectivas; el n a campo
# es cuántos se abordan, no la meta.
.monitoreo_subcuotas_desde_distribucion <- function(distribucion) {
  if (!is.list(distribucion) || length(distribucion) < 2L) return(NULL)
  claves <- vapply(distribucion, function(d) as.character(d$estrato %||% ""), "")
  cuotas <- vapply(distribucion, function(d) suppressWarnings(as.integer(d$n %||% NA)), integer(1))
  ok <- nzchar(claves) & !is.na(cuotas)
  if (sum(ok) < 2L) return(NULL)
  as.list(stats::setNames(cuotas[ok], claves[ok]))
}
