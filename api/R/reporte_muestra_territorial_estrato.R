# =============================================================================
# reporte_muestra_territorial_estrato.R — el estrato explícito y la selección de
# ciudades en la memoria de cálculo (ADR 0131 §1 y §1b)
# =============================================================================

.reporte_mt_fmt_pi <- function(x) formatC(as.numeric(x), format = "f", digits = 2, decimal.mark = ".")

#' Frase de la nota técnica que declara el estrato explícito y la selección de
#' ciudades, o NULL con estrato distrito. `em` es `sample_size_preview$estrato_muestral`.
.reporte_mt_frase_estrato <- function(em) {
  if (!is.list(em) || !length(em$estratos)) return(NULL)
  lima <- identical(as.character(em$modo %||% "")[1], "provincia_lima_areas")
  minimo <- as.integer(em$rutas_minimas_ciudad %||% HOJAS_RUTA_RUTAS_MINIMAS_CIUDAD)
  ciudades <- em$ciudades %||% list()
  campo <- function(c, k) as.character(c[[k]] %||% NA)[1]
  forzosas <- Filter(function(c) identical(campo(c, "condicion"), "forzosa"), ciudades)
  forzosas <- forzosas[order(-vapply(forzosas, function(c) as.numeric(c$rutas), numeric(1)))]
  lista_forzosas <- paste(vapply(forzosas, function(c) sprintf("%s %d", campo(c, "etiqueta"), as.integer(c$rutas)), character(1)), collapse = "; ")
  grupos <- em$grupos %||% list()
  texto_grupos <- vapply(grupos, function(g) {
    gid <- campo(g, "grupo")
    del_grupo <- Filter(function(c) identical(campo(c, "grupo"), gid), ciudades)
    sorteadas <- Filter(function(c) identical(campo(c, "condicion"), "sorteada"), del_grupo)
    sprintf("%s, %d rutas en %d de sus %d ciudades (%s)",
            unname(HOJAS_RUTA_MACRORREGIONES_ETIQUETAS[gid]) %||% gid, as.integer(g$rutas), as.integer(g$h), length(del_grupo),
            paste(vapply(sorteadas, function(c) sprintf("%s, probabilidad %s", campo(c, "etiqueta"), .reporte_mt_fmt_pi(c$pi_ciudad)), character(1)), collapse = "; "))
  }, character(1))
  paste(c(
    sprintf("El estrato explícito es la provincia%s.", if (lima) ", con Lima Metropolitana en cinco áreas interdistritales y Callao como estrato propio" else ""),
    sprintf(paste(
      "Toda ciudad visitada recibe al menos %d rutas. Entra con certeza la ciudad cuyo reparto proporcional a su población alcanza ese mínimo,",
      "y siempre Lima Metropolitana y Callao, con su reparto proporcional: %s."), minimo, lista_forzosas),
    if (length(texto_grupos)) paste0(
      "Las demás ciudades se agrupan por macrorregión y en cada grupo se sortean, con probabilidad proporcional a su tamaño, tantas ciudades como veces cabe el mínimo en las rutas del grupo; ",
      "cada ciudad sorteada recibe la parte que le toca de las rutas del grupo y representa a las no sorteadas: ",
      paste(texto_grupos, collapse = "; "), ".") else NULL,
    .reporte_mt_frase_distritos(em) %||% paste(
      "Dentro de cada ciudad, las rutas se reparten entre distritos en proporción a la medida de tamaño de sus manzanas del marco elegible,",
      "con un redondeo sistemático aleatorio, y el distrito y la zona actúan como estratos implícitos.",
      "La probabilidad de inclusión de la manzana es la de su ciudad por la de la manzana dentro de la ciudad.")
  ), collapse = " ")
}
