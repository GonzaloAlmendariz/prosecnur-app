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

# Una muestra corta del contenido de la columna. Sin esto el selector obliga a
# elegir a ciegas entre nombres como `Core/E2_sex` y `condicion_sexual`, que es
# justo el error que el mapeo manual existe para evitar.
.monitoreo_territorial_columna_ejemplo <- function(valores, max_chars = 40L) {
  if (is.null(valores) || !length(valores)) return("")
  txt <- tryCatch(as.character(valores), error = function(e) character(0))
  txt <- txt[!is.na(txt) & nzchar(trimws(txt))]
  if (!length(txt)) return("")
  muestra <- trimws(txt[[1]])
  if (nchar(muestra) > max_chars) paste0(substr(muestra, 1L, max_chars - 1L), "…") else muestra
}

#' Inventario de columnas de la base, para elegir el mapeo a mano.
#'
#' Cada entrada trae `nombre`, un `ejemplo` del contenido y `cobertura`, la
#' proporción de filas con dato. La cobertura importa tanto como el nombre: una
#' columna que existe pero viene vacía en el 100 % de las filas mapea sin error
#' y no sirve para nada.
monitoreo_territorial_columnas <- function(data = NULL) {
  if (!is.data.frame(data) || !ncol(data)) return(list())
  n <- nrow(data)
  lapply(names(data), function(nm) {
    col <- data[[nm]]
    llenos <- if (!n) 0L else {
      txt <- tryCatch(as.character(col), error = function(e) rep(NA_character_, n))
      sum(!is.na(txt) & nzchar(trimws(txt)))
    }
    list(
      nombre = nm,
      ejemplo = .monitoreo_territorial_columna_ejemplo(col),
      no_vacios = as.integer(llenos),
      cobertura = if (!n) 0 else round(llenos / n, 4)
    )
  })
}

#' Payload completo de la pestaña de mapeo manual.
#'
#' Reúne en una sola respuesta lo que la pestaña necesita para no depender de
#' una estructura de instrumento estándar: qué variables pide la app, a qué
#' columna apunta hoy cada una, y qué columnas ofrece realmente la base.
#'
#' `variables[[i]]$resuelta` es TRUE cuando la variable apunta a una columna
#' que existe. **No garantiza que sea la columna correcta**: la autodetección
#' casa por subcadena y puede acertar el nombre y errar la variable. Por eso el
#' campo se llama «resuelta» y no «correcta», y por eso esta pestaña existe.
monitoreo_territorial_mapeo_payload <- function(config = NULL, data = NULL, fase = "") {
  tcfg <- if (is.list(config) && is.list(config$territorial)) config$territorial else config
  columnas <- monitoreo_territorial_columnas(data)
  disponibles <- vapply(columnas, function(c) c$nombre, character(1))
  pendientes <- monitoreo_territorial_mapeo_pendiente(config, data)
  motivo_por_campo <- list()
  for (p in pendientes) motivo_por_campo[[p$campo]] <- p$motivo
  variables <- lapply(.MONITOREO_TERRITORIAL_VARS_DE_INTERES, function(v) {
    apunta_a <- if (is.list(tcfg)) tryCatch(as.character(tcfg[[v$campo]] %||% ""), error = function(e) "") else ""
    if (length(apunta_a) != 1L || is.na(apunta_a)) apunta_a <- ""
    motivo <- motivo_por_campo[[v$campo]] %||% ""
    list(
      campo = v$campo,
      etiqueta = v$etiqueta,
      apunta_a = apunta_a,
      resuelta = !nzchar(motivo) && nzchar(apunta_a),
      motivo = motivo,
      cobertura = {
        idx <- match(apunta_a, disponibles)
        if (is.na(idx)) NULL else columnas[[idx]]$cobertura
      }
    )
  })
  list(
    ok = TRUE,
    fase = .monitoreo_scalar(fase, ""),
    columnas = columnas,
    variables = variables,
    aviso = monitoreo_territorial_mapeo_aviso(config, data)
  )
}
