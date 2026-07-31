# Diagnóstico del mapeo de variables territoriales.
#
# Decisión 7 del goal visual: la autodetección debe **avisar** cuando no mapea.
#
# El hallazgo original decía que `sex_var` era la única de doce con fallback
# vacío, y al medirlo son cinco —`sex_var`, `territorial_status_var`,
# `coherence_status_var`, `supervisor_var` y `duration_var`—. Pero el fallback
# vacío es solo la mitad del problema, y no la peor.
#
# `monitoreo_territorial_default_config()` resuelve cada variable con `pick()`,
# que recorre alias y, si ninguno calza, devuelve un fallback. Ese fallback
# suele ser un nombre real de instrumento —`Core/E1_age`, `codigo_pulso`—, así
# que la config queda con un nombre de columna **que no existe en la base**. Es
# el mismo silencio que el fallback vacío pero disfrazado de éxito: la config se
# ve completa y la columna sale «S/D» en todas las filas.
#
# Por eso el diagnóstico no pregunta «¿quedó vacío?» sino la pregunta correcta:
# **¿esta variable apunta a una columna que la base realmente tiene?**
#
# Vive en archivo propio porque `monitoreo_engine.R` está congelado a
# crecimiento (`agentic/manifest.json`), y funcionalidad nueva va a
# `monitoreo_<tema>.R` para que el monolito no siga creciendo.

# Las variables cuyo mapeo tiene consecuencia visible en la app, con la etiqueta
# con la que el usuario las reconoce. No están todas las de la config: las que
# no se listan aquí no producen una columna que alguien lea.
.MONITOREO_TERRITORIAL_VARS_DE_INTERES <- list(
  list(campo = "district_var",      etiqueta = "Distrito"),
  list(campo = "ump_var",           etiqueta = "UMP / manzana"),
  list(campo = "pulso_code_var",    etiqueta = "Código Pulso"),
  list(campo = "gps_var",           etiqueta = "Georreferencia"),
  list(campo = "consent_var",       etiqueta = "Consentimiento"),
  list(campo = "age_var",           etiqueta = "Edad"),
  list(campo = "sex_var",           etiqueta = "Sexo"),
  list(campo = "status_var",        etiqueta = "Estado del envío"),
  list(campo = "id_var",            etiqueta = "Identificador"),
  list(campo = "submitted_by_var",  etiqueta = "Encuestador"),
  list(campo = "submission_time_var", etiqueta = "Fecha de envío"),
  list(campo = "duration_var",      etiqueta = "Duración")
)

#' Variables de interés que no apuntan a una columna real de la base.
#'
#' Devuelve una lista de entradas `list(campo, etiqueta, apunta_a, motivo)`.
#' `motivo` es `"sin_mapear"` cuando la config quedó vacía y
#' `"columna_ausente"` cuando apunta a un nombre que la base no tiene —el caso
#' silencioso—. Sin base no hay diagnóstico posible y devuelve lista vacía: no
#' se puede acusar de ausente a una columna que nadie ha cargado.
monitoreo_territorial_mapeo_pendiente <- function(config = NULL, data = NULL) {
  if (!is.data.frame(data) || !ncol(data)) return(list())
  tcfg <- if (is.list(config) && is.list(config$territorial)) config$territorial else config
  if (!is.list(tcfg)) return(list())
  columnas <- names(data)
  pendientes <- list()
  for (v in .MONITOREO_TERRITORIAL_VARS_DE_INTERES) {
    apunta_a <- tryCatch(as.character(tcfg[[v$campo]] %||% ""), error = function(e) "")
    if (length(apunta_a) != 1L || is.na(apunta_a)) apunta_a <- ""
    if (!nzchar(apunta_a)) {
      pendientes[[length(pendientes) + 1L]] <- list(
        campo = v$campo, etiqueta = v$etiqueta, apunta_a = "", motivo = "sin_mapear"
      )
      next
    }
    if (!(apunta_a %in% columnas)) {
      pendientes[[length(pendientes) + 1L]] <- list(
        campo = v$campo, etiqueta = v$etiqueta, apunta_a = apunta_a, motivo = "columna_ausente"
      )
    }
  }
  pendientes
}

#' Resumen legible del diagnóstico, para el payload de estado.
#'
#' `ok = TRUE` cuando las doce variables de interés apuntan a columnas reales.
#' El mensaje nombra cuántas faltan y cuáles, porque un aviso que solo dice
#' «hay problemas de mapeo» obliga a salir a buscar qué problema.
monitoreo_territorial_mapeo_aviso <- function(config = NULL, data = NULL) {
  pendientes <- monitoreo_territorial_mapeo_pendiente(config, data)
  if (!length(pendientes)) {
    return(list(ok = TRUE, n_pendientes = 0L, pendientes = list(), mensaje = ""))
  }
  etiquetas <- vapply(pendientes, function(p) p$etiqueta, character(1))
  list(
    ok = FALSE,
    n_pendientes = length(pendientes),
    pendientes = pendientes,
    mensaje = sprintf(
      "%d variable%s de interés sin columna en la base: %s. Revisa el mapeo del estudio.",
      length(pendientes),
      if (length(pendientes) == 1L) "" else "s",
      paste(etiquetas, collapse = ", ")
    )
  )
}
