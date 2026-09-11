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

# --- El plan vive en la SESIÓN, no en la config -------------------------------
#
# `s$monitoreo_config$aulas_universitarias$plan` está vacío en un proyecto
# guardado: el plan de cursos-horario se guarda aparte, en `s$monitoreo_aulas_plan`,
# porque son miles de filas y no tienen por qué viajar en cada payload de config.
# Las rutas del perfil lo saben y lo inyectan (`aulas_plan <- s$monitoreo_aulas_plan
# %||% aulas_cfg$plan`), pero el endpoint del PDF de cliente normaliza la config
# y la pasa tal cual, así que el modelo salía sin plan y respondía
# `E_AULAS_SIN_PLAN`: el botón de la app fallaba con un estudio perfectamente
# cargado.
#
# No se vio en meses de tests ni renderizando a mano —el runner lo inyectaba— y
# sí al pedirle el documento a la aplicación por su propio endpoint.

#' Completa la config de aulas con lo que vive suelto en la sesión.
#'
#' @param cfg config ya normalizada.
#' @param s estado de sesión.
#' @return la misma `cfg` con `aulas_universitarias$plan` y `$partes_campo`
#'   resueltos desde la sesión cuando la config no los trae.
#' @keywords internal
monitoreo_aulas_config_con_sesion <- function(cfg, s) {
  if (!is.list(cfg)) return(cfg)
  au <- cfg$aulas_universitarias
  if (!is.list(au)) return(cfg)
  if (!length(au$plan %||% list())) au$plan <- s$monitoreo_aulas_plan %||% list()
  if (!length(au$partes_campo %||% list())) au$partes_campo <- s$monitoreo_aulas_partes_campo %||% list()
  if (!length(au$control %||% list())) au$control <- s$monitoreo_aulas_control %||% list()
  cfg$aulas_universitarias <- au
  cfg
}
