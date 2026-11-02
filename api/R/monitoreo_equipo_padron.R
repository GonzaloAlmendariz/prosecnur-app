# El padrón del equipo: una sola lista, la de Monitoreo, de la que Material
# asigna en todos los tipos (cola de coordinación 2026-11-02, punto 4; contrato
# acordado con Hojas/Material).
#
#   GET /api/monitoreo/equipo/padron →
#     list(familia, code_format, origen,
#          personas = list(list(codigo, nombre, rol, activo, telefono?)))
#
# Cada familia guarda hoy a su gente en un sitio distinto, y aquí se leen sin
# moverlas:
#   - territorial: la lista de códigos P (`monitoreo_config$territorial$enumerator_roster`);
#   - aulas: la disponibilidad de aplicadores (`monitoreo_aulas_disponibilidad`);
#   - telefónico y acreditación: los enumeradores confirmados en las
#     equivalencias de nombres del perfil.
# Si la familia no trae a nadie, el equipo que el Planner tenía declarado queda
# de respaldo (ADR 0123 §2).
#
# Nunca sale un DNI: con `code_format = "DNI"` el código ES el DNI, así que
# `personas` va vacío (mismo trato que `.mta_equipo`). `activo` viene siempre.

.MEP_ROL <- c(territorial = "encuestador", aulas_universitarias = "aplicador",
              telefonico = "encuestador", acreditacion = "encuestador")

#' Una persona del padrón con todos sus campos.
#' @keywords internal
.mep_persona <- function(codigo = "", nombre = "", rol = "", activo = TRUE, telefono = "") {
  p <- list(codigo = .monitoreo_scalar(codigo, ""), nombre = trimws(.monitoreo_scalar(nombre, "")),
            rol = rol, activo = isTRUE(activo))
  tel <- trimws(.monitoreo_scalar(telefono, ""))
  if (nzchar(tel)) p$telefono <- tel
  p
}

.mep_territorial <- function(s) {
  raw <- ((s$monitoreo_config %||% list())$territorial %||% list())$enumerator_roster %||% list()
  ro <- tryCatch(.monitoreo_territorial_normalize_enumerator_roster(raw), error = function(e) NULL)
  if (is.null(ro)) return(list(code_format = "PXXX", personas = list()))
  if (identical(ro$code_format, "DNI")) return(list(code_format = "DNI", personas = list()))
  list(code_format = ro$code_format %||% "PXXX", personas = lapply(ro$assignments %||% list(), function(a) {
    .mep_persona(a$codigo_pulso, a$nombre, .MEP_ROL[["territorial"]], !isFALSE(a$activo))
  }))
}

.mep_aulas <- function(s) {
  disp <- s[["monitoreo_aulas_disponibilidad"]] %||% list()
  nombres <- vapply(disp, function(x) {
    tryCatch(aulas_nombre_aplicador(x[["nombre"]] %||% x[["aplicador"]] %||% x), error = function(e) "")
  }, character(1))
  nombres <- unique(nombres[nzchar(nombres)])
  list(code_format = "nombre", personas = lapply(nombres, function(n) .mep_persona("", n, .MEP_ROL[["aulas_universitarias"]])))
}

.mep_equivalencias <- function(s, familia) {
  perfil <- (s$monitoreo_config %||% list())$monitoreo_profile %||% list()
  mapa <- tryCatch(.monitoreo_equivalencias_mapa(perfil), error = function(e) list())
  nombres <- unique(trimws(as.character(unlist(mapa, use.names = FALSE))))
  nombres <- sort(nombres[nzchar(nombres)])
  list(code_format = "nombre", personas = lapply(nombres, function(n) .mep_persona("", n, .MEP_ROL[[familia]])))
}

.mep_planner <- function(s, familia) {
  perfil <- if (identical(familia, "aulas_universitarias")) "aulas" else familia
  pl <- tryCatch(.planner_equipo_de(s, perfil), error = function(e) NULL)
  if (!is.list(pl) || !identical(pl$origen, "declarado")) return(NULL)
  if (isTRUE(pl$bloqueado)) return(list(code_format = "DNI", personas = list()))
  list(code_format = pl$code_format %||% "PXXX", personas = lapply(pl$personas %||% list(), function(p) {
    .mep_persona(p$codigo, p$nombre, p$rol %||% "", isTRUE(p$activo))
  }))
}

#' El padrón del equipo del estudio. Lectura pura sobre la sesión.
#'
#' @param s la sesión.
#' @return `list(familia, code_format, origen, personas)`.
#' @keywords internal
monitoreo_equipo_padron <- function(s) {
  familia <- .monitoreo_scalar(((s$monitoreo_config %||% list())$monitoreo_profile %||% list())$family, "")
  propio <- switch(familia,
    territorial = c(.mep_territorial(s), list(origen = "lista_de_codigos")),
    aulas_universitarias = c(.mep_aulas(s), list(origen = "disponibilidad")),
    telefonico = , acreditacion = c(.mep_equivalencias(s, familia), list(origen = "equivalencias")),
    list(code_format = "PXXX", personas = list(), origen = "vacio")
  )
  # La familia en DNI no se entrega ni cae al respaldo: nadie sale.
  if (identical(propio$code_format, "DNI")) {
    return(list(familia = familia, code_format = "DNI", origen = propio$origen, personas = list()))
  }
  if (!length(propio$personas)) {
    respaldo <- .mep_planner(s, familia)
    if (!is.null(respaldo)) {
      return(list(familia = familia, code_format = respaldo$code_format, origen = "planner",
                  personas = if (identical(respaldo$code_format, "DNI")) list() else respaldo$personas))
    }
  }
  list(familia = familia, code_format = propio$code_format, origen = propio$origen, personas = propio$personas)
}

mount_monitoreo_equipo_padron <- function(pr) {
  pr |>
    plumber::pr_get("/api/monitoreo/equipo/padron", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      c(list(ok = TRUE), monitoreo_equipo_padron(session_get(sid)))
    }))
}
