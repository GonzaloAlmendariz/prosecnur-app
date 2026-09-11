# La portada del reporte de avance, tal como llega desde la UI.
#
# El panel de Salidas manda seis campos de texto libre y ninguno es obligatorio:
# lo que venga en blanco lo resuelve el motor con su defecto derivado
# (`pulso_pdf_portada_normalizar()`). Este archivo es la aduana entre el cuerpo
# del request y el renderizador, y vive fuera del router porque el router está
# congelado a crecimiento y porque esto es validación de dominio, no de HTTP.

.MONITOREO_PORTADA_CAMPOS <- c("titulo", "subtitulo", "cliente", "periodo", "corte", "nota")

# Tope por campo. La portada es una página: un «título» de 4.000 caracteres no
# se corta feo, se come el documento entero. Se recorta aquí y no al dibujar,
# para que lo que se guarda y lo que se pinta sean lo mismo.
.MONITOREO_PORTADA_TOPES <- c(titulo = 140L, subtitulo = 180L, cliente = 140L,
                              periodo = 90L, corte = 90L, nota = 320L)

#' Normaliza el bloque `portada` del cuerpo de una petición de PDF.
#'
#' @param parsed cuerpo ya parseado del request.
#' @return lista con los seis campos como `character(1)`; los ausentes, `""`.
#' @keywords internal
monitoreo_aulas_portada_desde_body <- function(parsed) {
  bruto <- parsed$portada %||% parsed$cover %||% list()
  if (!is.list(bruto)) bruto <- list()
  out <- lapply(.MONITOREO_PORTADA_CAMPOS, function(k) {
    v <- bruto[[k]]
    if (is.null(v) || !length(v)) return("")
    txt <- as.character(v)[[1L]]
    if (is.na(txt)) return("")
    # Los saltos de línea y los tabuladores de un textarea romperían el trazado
    # de una línea de metadatos; el texto largo ya se envuelve solo.
    txt <- gsub("[\r\n\t]+", " ", txt)
    txt <- trimws(gsub(" {2,}", " ", txt))
    tope <- .MONITOREO_PORTADA_TOPES[[k]]
    if (nchar(txt) > tope) txt <- trimws(substr(txt, 1L, tope))
    txt
  })
  names(out) <- .MONITOREO_PORTADA_CAMPOS
  out
}
