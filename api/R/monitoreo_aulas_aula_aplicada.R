# **Una sola definición de «este curso-horario se aplicó».**
#
# Había tres, y las tres daban respuestas distintas sobre las mismas aulas el
# 2026-09-07, primer día de campo:
#
#   · la «Base de control» miraba el `application_status` del parte;
#   · el «Plan del día» escribía `operational_status`, el eje del CIRCUITO, que
#     nunca llega a «aplicada» desde el libro —salía PLANIFICADA en la misma
#     fila donde OBTENIDAS decía 36—;
#   · el avance por facultad miraba también `operational_status` y por eso
#     enseñaba «Aulas aplicadas: 0» en las quince facultades con ocho aulas
#     produciendo encuestas.
#
# Las tres preguntan lo mismo y el operativo tiene una sola respuesta. Aquí
# está, y las tres la llaman.

#' ¿Se aplicó este curso-horario?
#'
#' Cuenta como aplicado el aula cuyo PARTE lo declara —es el veredicto de quien
#' estuvo ahí— y también el aula que ya tiene respuestas en la plataforma, haya
#' parte o no: el parte lo escribe el encargado de campo cuando puede y en la
#' primera semana llega tarde o no llega, mientras que las respuestas llegan
#' solas. Una efectiva obtenida es prueba directa de que ese salón se aplicó.
#'
#' NO se mira `operational_status`: ese es el eje del CIRCUITO —planificada,
#' agendada, reemplazada— y el libro no lo mueve a «aplicada» nunca.
#'
#' @param unidades filas del plan.
#' @param partes partes de campo ya registrados.
#' @param efectivas vector con nombre por código operativo.
#' @return vector lógico, uno por unidad.
#' @export
monitoreo_aulas_aula_aplicada <- function(unidades, partes = list(), efectivas = NULL) {
  n <- length(unidades %||% list())
  if (!n) return(logical(0))
  por_codigo <- list()
  for (pt in (partes %||% list())) {
    if (!is.list(pt)) next
    cod <- .monitoreo_scalar(pt$operational_code %||% pt$classroom_id, "")
    if (nzchar(cod) && is.null(por_codigo[[cod]])) por_codigo[[cod]] <- pt
  }
  vapply(unidades, function(u) {
    cod <- .monitoreo_scalar(u$operational_code %||% u$classroom_id, "")
    pt <- if (nzchar(cod) && cod %in% names(por_codigo)) por_codigo[[cod]] else NULL
    estado <- if (is.null(pt)) {
      .monitoreo_scalar(u$application_status, "")
    } else {
      .monitoreo_scalar(
        .monitoreo_aulas_parte_primero(pt, .MONITOREO_AULAS_PARTE_ALIAS[["estado"]]) %||%
          u$application_status, "")
    }
    e <- if (is.null(efectivas) || !nzchar(cod) || !(cod %in% names(efectivas))) NA_real_ else
      suppressWarnings(as.numeric(efectivas[[cod]]))[1]
    recogio <- isTRUE(is.finite(e) && e > 0)
    if (recogio) return(TRUE)
    if (!identical(monitoreo_aulas_estado_aplicacion(estado), "aplicada")) return(FALSE)
    # **UN PARTE SIN FIRMA NO PRUEBA QUE SE FUERA A CAMPO.**
    #
    # Gonzalo, 2026-09-18: «la fuente de verdad es Kobo —y es la fuente de
    # verdad la que cuenta las efectivas siempre en TODA LA APP—, el parte de la
    # ficha solo reporta lo que los aplicadores ven». Y su caso: «me preocupa
    # que hayan pensado que se aplicó CH 3 cuando jamás se aplicó, sino que fue
    # un caso A y se aplicó R 3.1, y todos los Sheets dan evidencia de eso».
    #
    # CH 3 tenía un parte con «APLICADA» y **ni fecha, ni aplicador, ni una sola
    # respuesta en Kobo**, tomado además en un aula que no es la suya. Con eso
    # bastaba para contarla entre las que fueron a campo, contra lo que dicen
    # las otras tres fuentes: Kobo (0 respuestas), el Sheets (sin aula
    # utilizada, sin fecha agendada) y el plan (`en_contacto`).
    #
    # El estado del parte sigue bastando cuando el parte está FIRMADO —trae
    # fecha o aplicador—: eso es un acta de alguien que estuvo allí, y hay aulas
    # que fueron y no recogieron nada porque todos habían respondido ya (CH 130
    # con 15 duplicados, CH 166 con 21). Medido el 2026-09-18 sobre HSVG2026:
    # de las cuatro aulas dadas por aplicadas sin respuestas en Kobo, tres
    # traen fecha y aplicador y sólo CH 3 no trae ninguno de los dos.
    if (is.null(pt)) return(TRUE)
    firmado <- nzchar(.monitoreo_scalar(
      .monitoreo_aulas_parte_primero(pt, .MONITOREO_AULAS_PARTE_ALIAS[["fecha"]]) %||%
        pt$applied_date, "")) ||
      nzchar(.monitoreo_scalar(pt$applied_by %||% pt$aplicador, ""))
    isTRUE(firmado)
  }, logical(1))
}
