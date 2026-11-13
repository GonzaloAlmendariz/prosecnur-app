# =============================================================================
# hojas_ruta_macrorregiones.R — macrorregiones para el sorteo de ciudades
# (ADR 0131 §1b)
# =============================================================================
#
# Las ciudades cuyo reparto proporcional no alcanza el mínimo operativo de rutas
# se agrupan por macrorregión y se sortean por PPS dentro del grupo. La tabla va
# por departamento (2 primeros dígitos del ubigeo 2017) y cubre los 25: cada uno
# en exactamente una de las cuatro (test-hojas-ruta-ciudades-sorteo.R).
#
# Agrupación declarada (ADR 0131 §1b):
#   norte:   Tumbes, Piura, Lambayeque, La Libertad, Cajamarca, Áncash
#   centro:  Lima (provincias), Callao, Ica, Junín, Pasco, Huánuco, Huancavelica,
#            Ayacucho
#   sur:     Arequipa, Moquegua, Tacna, Cusco, Puno, Apurímac
#   oriente: Amazonas, Loreto, San Martín, Ucayali, Madre de Dios
#
# Lima Metropolitana (1501) y Callao (0701) entran siempre con certeza, así que
# su macrorregión sólo sirve para el rótulo.
# =============================================================================

HOJAS_RUTA_MACRORREGIONES <- list(
  norte = c("24", "20", "14", "13", "06", "02"),
  centro = c("15", "07", "11", "12", "19", "10", "09", "05"),
  sur = c("04", "18", "23", "08", "21", "03"),
  oriente = c("01", "16", "22", "25", "17")
)

HOJAS_RUTA_MACRORREGIONES_ETIQUETAS <- c(norte = "Norte", centro = "Centro", sur = "Sur", oriente = "Oriente")

#' Macrorregión de cada ubigeo o código de provincia (se lee el departamento).
#' Un departamento fuera de la tabla es un error declarado, nunca un grupo vacío.
hojas_ruta_macrorregion_de <- function(codigos) {
  dep <- substr(.pulso_ceros_izq(6L, as.character(codigos)), 1L, 2L)
  dep[nchar(as.character(codigos)) == 4L] <- substr(as.character(codigos)[nchar(as.character(codigos)) == 4L], 1L, 2L)
  out <- rep(NA_character_, length(dep))
  for (g in names(HOJAS_RUTA_MACRORREGIONES)) out[dep %in% HOJAS_RUTA_MACRORREGIONES[[g]]] <- g
  if (anyNA(out)) {
    stop_api(422, "E_HOJAS_RUTA_CIUDAD_SIN_MACRORREGION",
             sprintf("El departamento %s no está en la tabla de macrorregiones.", paste(unique(dep[is.na(out)]), collapse = ", ")))
  }
  out
}
