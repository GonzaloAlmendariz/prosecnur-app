# Las pestañas que la publicación a Google Sheets tiene permiso de escribir.
#
# Unidad B1 (2026-08-31). La lista vivía en
# `.monitoreo_sheets_controlled_tab_names()` (monitoreo_engine.R, congelado a
# crecimiento), traía «Tabla maestra» dos veces y NO traía ni las pestañas del
# ejecutivo de aulas ni las del libro operativo: publicar el ejecutivo de aulas
# reventaba en `.monitoreo_sheets_validate_controlled_tabs()` y ningún test lo
# cubría. El engine ahora DELEGA aquí (el archivo congelado achica) y el gate
# vive en test-monitoreo-sheets-pestanas.R.
#
# Dos listas que nadie ata es exactamente el patrón que se traga pestañas, así
# que esta función no confía solo en su parte literal: al final se une con lo
# que los DOS generadores de nombres de publicación declaran hoy por familia ×
# audiencia (`.monitoreo_publication_tab_names` y
# `.monitoreo_publication_sheet_tab_names`). Un nombre nuevo en un generador
# entra solo a la lista controlada; el validador existe para frenar escrituras
# AD HOC sobre pestañas del usuario, no para desincronizarse de la publicación.

# Las cuatro familias con juego propio de pestañas. `acreditacion` cae en la
# rama default de los generadores; se recorre igual por si algún día se separa.
.monitoreo_sheets_familias_publicacion <- function() {
  c("territorial", "aulas_universitarias", "telefonico", "acreditacion")
}

#' Pestañas controladas de la publicación de monitoreo a Google Sheets.
#'
#' Sin duplicados. Contiene: la lista heredada del engine (deduplicada), las
#' pestañas del ejecutivo de aulas en sus dos audiencias, las seis hojas del
#' libro operativo de aulas y —como red— todo lo que los generadores de nombres
#' de publicación declaren por familia × audiencia.
#'
#' @return vector de nombres de pestaña únicos.
#' @keywords internal
monitoreo_sheets_pestanas_controladas <- function() {
  heredadas <- c(
    "Prosecnur - Resumen",
    "Prosecnur - Alertas",
    "Prosecnur - Auditoria",
    "Prosecnur - Reporte",
    "Reporte",
    "Detalle del avance",
    "Administrativos - Avance",
    "Docentes - Avance",
    "Egresados - Avance",
    "Empleadores - Avance",
    "Estudiantes - Avance",
    "Avance por actor",
    "Efectivas por fecha",
    "Fuentes por actor",
    "Cliente - Portada",
    "Cliente - Avance",
    "Cliente - Avance diario",
    "Cliente - Avance unidad",
    "Cliente - Avance distrito",
    "Cliente - Fuentes agregadas",
    "Cliente - Diccionario",
    "Interno - Portada",
    "Interno - Avance",
    "Interno - Alertas",
    "Interno - Casos accionables",
    "Interno - Auditoria",
    "Interno - GPS territorio",
    "Interno - Fuentes",
    "Interno - Snapshot operativo",
    "Portada",
    "Resumen de avance",
    "Resumen territorial",
    "Producción",
    "Tabla maestra",
    "Avance por distrito",
    "Avance por UMP",
    "Avance diario",
    "Avance por responsable",
    "Cuotas resumen",
    "Resumen del avance",
    "Resumen ejecutivo",
    "Resumen",
    "Vista general",
    "Avance general",
    "Avance por segmento",
    "Avance por canal",
    "Avance por encuesta",
    "Avance por canal/fuente",
    "Canal y responsable",
    "Avance por canal/recopilador",
    "Brechas de cumplimiento",
    "Pendientes por cubrir",
    "Cobertura y pendientes",
    "Resumen operativo",
    "Mínimos por actor",
    "Metas internas por actor",
    "Faltantes por actor",
    "Pendientes por actor",
    "Seguimiento",
    "Seguimiento operativo",
    "Control de seguimiento",
    "Seguimiento telefónico",
    "Monitoreo telefónico",
    "Puntos de atención",
    "Alertas internas",
    "Alertas",
    "Casos para revisar",
    "Avance de campo",
    "Encuestadores y rutas",
    "Manzanas y responsables",
    "Responsables y rutas",
    "Cuotas por UMP",
    "Cuotas por manzana",
    "Cuotas sexo y edad",
    "Cierre de cuotas",
    "Llenado sexo y edad",
    "Ritmo diario",
    "Validacion de tiempos",
    "Validación de tiempos",
    "Ocurrencias de campo",
    "Ocurrencias en campo",
    "Anulaciones",
    "Casos accionables",
    "GPS y territorio",
    "Corte y fuentes",
    "Reporte telefónico",
    "Avance y cuotas",
    "Responsables",
    "Conciliación",
    "Casos y alertas",
    "Fuentes y actualizacion",
    "Fuentes y actualización",
    "Trazabilidad del corte",
    "Auditoria tecnica",
    "Auditoría técnica",
    "Registros del corte",
    "Base tecnica",
    "Base técnica"
  )

  # El ejecutivo de aulas, en sus dos audiencias. Son los nombres que
  # `.monitoreo_publication_tab_names("aulas_universitarias", ...)` declara y
  # que la lista heredada nunca conoció (el defecto latente de la unidad B1).
  ejecutivo_aulas <- c(
    "Resumen de aulas",
    "Avance agregado",
    "Cuotas y brechas",
    "Agenda de aulas",
    "Avance por aula",
    "Reemplazos",
    "Validación",
    "Consultas"
  )

  # Las seis hojas del libro operativo de aulas. Las tres de datos salen de la
  # spec del lector (`AULAS_LIBRO_HOJAS`) para que el nombre no pueda derivar
  # por su cuenta; «Plan del día» es la 4.ª hoja de datos (B2.1, de ida: sin
  # lector, por eso no está en la spec), y las otras dos son la hoja de
  # indicadores y la de listas.
  libro_aulas <- c(
    vapply(AULAS_LIBRO_HOJAS, function(x) x$hoja, character(1)),
    # B14: las dos hojas del banco de extras. Sus nombres viven en
    # carga_aulas_libro_extras.R (la spec que generadores y lectores comparten),
    # no como literales aqui: dos listas que nadie ata es el patron que se
    # traga pestañas.
    .calx_hojas_extra(),
    "Plan del día",
    # A13a: era «Cómo va el campo»; Gonzalo: «es AVANCE», registro académico.
    "Avance de campo",
    # B68 (dictado 2026-09-03): la cuarta hoja de la APP del publicador — el
    # reparto de aplicadores, condicional a que la sesión tenga
    # disponibilidad. App-owned, regenerada entera; sin lector.
    "Asignación de aplicadores",
    "Listas"
  )

  # Red de seguridad: lo que los generadores declaran HOY. Con el estado actual
  # no agrega ningún nombre (los bloques de arriba ya los cubren), pero si un
  # generador gana una pestaña mañana, entra aquí sola en vez de reventar la
  # publicación con E_GOOGLE_SHEETS.
  declaradas <- unlist(lapply(.monitoreo_sheets_familias_publicacion(), function(familia) {
    unlist(lapply(c("client", "internal"), function(audiencia) {
      c(
        unname(.monitoreo_publication_tab_names(familia, audiencia)),
        unname(.monitoreo_publication_sheet_tab_names(familia, audiencia))
      )
    }), use.names = FALSE)
  }), use.names = FALSE)

  unique(c(heredadas, ejecutivo_aulas, libro_aulas, declaradas))
}
