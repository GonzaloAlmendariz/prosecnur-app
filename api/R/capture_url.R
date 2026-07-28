# Validación de URL de captura.
#
# Una "URL de captura" es la dirección sobre la que se cuelgan los parámetros de
# personalización por unidad (`?d[campo]=valor` en Kobo, Custom Variables en
# SurveyMonkey) y que después se convierte en QR.
#
# La regla central es el fragmento. Todo lo que va después de `#` es local al
# navegador: no viaja al servidor ni lo lee el web form. Si la URL base ya trae
# fragmento, los parámetros que se le concatenen quedan dentro de ese fragmento y
# el formulario nunca los recibe. El QR se imprime, se escanea y abre un
# formulario en blanco sin trazabilidad, y el error solo se descubre cuando las
# respuestas llegan sin `collectorID`.
#
# El caso más frecuente es `<servidor>/#/forms/<uid>/landing`, la landing
# administrativa de Kobo: es la pantalla de gestión del proyecto, no el
# formulario de captura. Se diagnostica aparte porque el mensaje genérico de
# fragmento no le diría al usuario qué hacer.

.capture_url_text <- function(url) {
  value <- suppressWarnings(as.character(url %||% "")[1])
  if (is.na(value)) return("")
  trimws(value)
}

#' Diagnostica por qué una URL no sirve como URL de captura.
#'
#' @param url URL candidata.
#' @return `""` si es utilizable; si no, uno de `"vacia"`, `"no_http"`,
#'   `"landing_kobo"` o `"fragmento"`.
#' @export
capture_url_issue <- function(url) {
  value <- .capture_url_text(url)
  if (!nzchar(value)) return("vacia")
  if (!grepl("^https?://", value, ignore.case = TRUE)) return("no_http")
  if (grepl("#/forms/[^/]+/landing", value, ignore.case = TRUE)) return("landing_kobo")
  if (grepl("#", value, fixed = TRUE)) return("fragmento")
  ""
}

#' @rdname capture_url_issue
#' @export
capture_url_ok <- function(url) {
  identical(capture_url_issue(url), "")
}

#' Mensaje explicativo para un diagnóstico de `capture_url_issue()`.
#'
#' @param issue Código devuelto por [capture_url_issue()].
#' @return Texto en español apto para mostrar al usuario.
#' @export
capture_url_message <- function(issue) {
  switch(
    .capture_url_text(issue),
    vacia = "Falta la URL de captura del formulario.",
    no_http = "La URL de captura debe empezar con http:// o https://.",
    landing_kobo = paste(
      "Esa es la pantalla administrativa del proyecto en Kobo, no el formulario",
      "de captura. Los parámetros que van después de '#' no llegan al",
      "formulario, así que el QR abriría un formulario sin identificar la",
      "unidad. Abre el proyecto en Kobo, copia el enlace del formulario web y",
      "pégalo aquí."
    ),
    fragmento = paste(
      "La URL de captura no puede contener '#'. Todo lo que va después del '#'",
      "se queda en el navegador, así que los parámetros de personalización",
      "nunca llegarían al formulario."
    ),
    ""
  )
}

#' Falla con un error de API si la URL no sirve para capturar.
#'
#' @param url URL candidata.
#' @param context Prefijo opcional que ubica el error para el usuario.
#' @return Invisible `TRUE` cuando la URL es utilizable.
#' @export
capture_url_require <- function(url, context = "") {
  issue <- capture_url_issue(url)
  if (identical(issue, "")) return(invisible(TRUE))
  context <- .capture_url_text(context)
  detail <- capture_url_message(issue)
  stop_api(
    400,
    "E_CAPTURE_URL",
    if (nzchar(context)) paste0(context, ": ", detail) else detail,
    details = list(issue = issue, url = .capture_url_text(url))
  )
}
