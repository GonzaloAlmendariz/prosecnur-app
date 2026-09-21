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
#' pestañas del ejecutivo de aulas en sus dos audiencias, las hojas del libro
#' operativo de aulas y —como red— todo lo que los generadores de nombres de
#' publicación declaren por familia × audiencia.
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

  # Las hojas del libro operativo de aulas. Las tres de datos salen de la
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
    # Dictado 2026-09-04: la quinta de la app — la disponibilidad del equipo,
    # para que campo sepa a quién llamar sin preguntarle al lead.
    "Disponibilidad de aplicadores",
    # Dictado 2026-09-08: «me gustaría que Tabla dinámica 2 se vuelva una hoja
    # que la app pueda producir en base a lo agendado». Sexta de la app, y sin
    # condición: lo que mide existe desde el primer día del operativo.
    "Avance de agendación",
    # Dictado 2026-09-12: «necesitamos saber la producción de los aplicadores,
    # quién está aplicando más, quién está aplicando menos, en qué rangos
    # horarios». Séptima de la app y condicional: sin partes no se produce.
    # Es la cara de SALIDA de «Asignación de aplicadores» —lo aplicado, no lo
    # repartido— y por eso son dos hojas y no una columna más.
    "Producción de aplicadores",
    # Dictado 2026-09-14: «me gustaría que quedara en una hoja del excel como
    # control de calidad». La facultad del aula contra la que el alumno
    # declara. Octava de la app y condicional: sin `faculty_var` declarada en
    # el mapping del estudio no se produce.
    "Control de facultad",
    # Su hermana por NIVEL, pegada a ella: las dos son controles de calidad del
    # mismo tipo —un auto-reporte contra una tabla— y leerlas juntas es lo que
    # permite saber si un desacuerdo es del alumno o del marco. Novena de la app
    # y condicional por partida doble: sin `declared_level_var` y sin padrón no
    # hay dos lados que cruzar (fase 4 del plan del eje declarable).
    "Control de nivel",
    # Dictado 2026-09-18: «la hoja de facultades en riesgo debe tener bastante
    # contexto util […] hay que ser bastante precisos con todas esas
    # informaciones». Si cada facultad llega a su meta, de cuántas aulas
    # depende, para cuándo son y qué queda si una se cae. Décima de la app y
    # condicional: sin ninguna facultad con meta contra la que medirse no se
    # produce.
    "Facultades en riesgo",
    "Listas"
  )

  # Las pestañas semanales del Sheets de los aplicadores (dictado 2026-09-11:
  # «que la app aprenda a escribir una pestaña por semana»). El nombre NO se
  # teclea aquí: se pide al mismo `.mads_hoja_de_semana()` que usa el
  # publicador, porque una segunda grafía —«Semana N» contra «SEMANA N»— dejaría
  # la publicación estrellándose contra su propio validador. Cincuenta y dos es
  # el techo de un año de campo; el operativo de aulas dura seis semanas.
  semanas_aplicadores <- vapply(seq_len(52L), .mads_hoja_de_semana, character(1))

  # Y la hoja de las clases a las que se puede entrar sin cita (2026-09-21).
  # UNA sola y sin semana: esas clases se dictan todas. El nombre se le pide a
  # `.albpa_hoja()`, que es quien lo escribe en el publicador; teclearlo aquí
  # dejaría la publicación estrellándose contra su propio validador en cuanto
  # cambiara en un sitio —que es exactamente lo que pasó al estrenarla—.
  semanas_por_agendar <- .albpa_hoja()

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

  unique(c(heredadas, ejecutivo_aulas, libro_aulas, semanas_aplicadores,
           semanas_por_agendar, declaradas))
}
