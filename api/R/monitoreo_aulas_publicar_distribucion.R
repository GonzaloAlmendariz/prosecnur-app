# monitoreo_aulas_publicar_distribucion.R — el Sheets que ven los aplicadores.
#
# Dictado de Gonzalo (2026-09-07, primer día de campo): «ya que tenemos toda la
# distribución de aplicaciones de la semana, los aplicadores necesitan poder
# verlos en un sheets aparte. El motor debe ser capaz de publicar un sheets de
# su distribución para ser compartido a ellos».
#
# **Por qué un documento aparte y no una pestaña más del libro operativo.** El
# libro trae la base de control, el avance, los denominadores y las dos hojas
# que llena el equipo de campo; compartirlo con veintidós aplicadores para que
# cada uno lea su día es enseñarles el operativo entero y exponer un documento
# que otros están editando en vivo. Este publica SOLO la distribución, a un
# spreadsheet que el lead comparte con permiso de lectura.
#
# **Y por qué reusa los mismos productores.** Las dos hojas se construyen con
# `aulas_libro_valores_asignacion()` y `aulas_libro_hoja_plan_dia()`, que son
# las que ya alimentan el libro. Escribir aquí una segunda versión de «quién va
# a qué aula» sería la tercera capa leyendo la misma regla, y esas divergen: es
# el defecto que este módulo lleva un mes cerrando en otras superficies.

#' Las dos pestañas del documento de los aplicadores.
#'
#' La primera contesta «¿qué me toca?» y la segunda «¿a dónde voy y con quién
#' hablo?». En ese orden, porque quien abre el documento se busca a sí mismo.
#' @keywords internal
.mapd_hoja_asignacion <- function() "Asignación de aplicadores"

#' @keywords internal
.mapd_hoja_plan_dia <- function() "Plan del día"

#' Publica la distribución de aplicadores a un Sheets propio.
#'
#' A diferencia de `monitoreo_aulas_publicar_libro()`, aquí NO hay hojas del
#' equipo que respetar: el documento es de la app de punta a punta y se
#' sobrescribe entero en cada publicación. Esa es justamente la garantía que se
#' le ofrece al aplicador: lo que lee es el reparto vigente, no una copia que
#' alguien actualizó a mano hace dos días.
#'
#' Sin disponibilidad cargada no hay reparto que publicar y se declara con un
#' error accionable en vez de escribir un documento vacío, que es peor: un
#' aplicador que abre su hoja y la ve en blanco no sabe si es que no le toca
#' nada o si el sistema falló.
#'
#' @param spreadsheet_id id o enlace del documento destino.
#' @param plan filas del plan (mismo insumo que la pestaña de la app).
#' @param disponibilidad oferta de aplicadores en sesión.
#' @param config_reparto config vigente del reparto (fijadas, rango, semilla).
#' @param partes partes de campo, para que el detalle diga qué ya se aplicó.
#' @param efectivas efectivas por código, cuando el estudio las tiene.
#' @return lista `{ok, spreadsheet_id, url, updated_at, hojas}`.
#' @export
monitoreo_aulas_publicar_distribucion <- function(spreadsheet_id,
                                                  plan = list(),
                                                  disponibilidad = NULL,
                                                  config_reparto = list(),
                                                  partes = list(),
                                                  efectivas = NULL) {
  id <- .monitoreo_extract_spreadsheet_id(spreadsheet_id)
  if (!nzchar(id)) {
    stop_api(
      400, "E_SHEETS_SPREADSHEET",
      "El enlace no parece de Google Sheets: no trae el identificador del documento."
    )
  }
  valores_asignacion <- aulas_libro_valores_asignacion(
    plan %||% list(), disponibilidad, cfg = config_reparto
  )
  if (is.null(valores_asignacion)) {
    stop_api(
      409, "E_AULAS_DISTRIBUCION_SIN_DISPONIBILIDAD",
      paste(
        "No hay reparto que publicar: falta cargar la disponibilidad de los",
        "aplicadores. Cárgala en Fuentes y vuelve a publicar."
      )
    )
  }
  # El detalle por aula sale del MISMO productor que el libro, con los
  # aplicadores ya puestos por el reparto vigente.
  plan_dia <- .malp_df_a_values(aulas_libro_hoja_plan_dia(
    .calg_unidades_del_libro(plan %||% list(), partes = partes, control = list()),
    partes = partes,
    efectivas = efectivas,
    asignados = aulas_libro_asignados_por_codigo(
      plan %||% list(), disponibilidad, cfg = config_reparto
    )
  ))

  tabs <- list()
  tabs[[.mapd_hoja_asignacion()]] <- valores_asignacion
  tabs[[.mapd_hoja_plan_dia()]] <- plan_dia

  formato <- function(sheet_id, tab_name, rows) {
    if (identical(tab_name, .mapd_hoja_asignacion())) {
      return(aulas_libro_asignacion_formato_requests(sheet_id, rows))
    }
    if (identical(tab_name, .mapd_hoja_plan_dia())) {
      return(monitoreo_aulas_plan_dia_formato_requests(sheet_id, rows))
    }
    list()
  }
  pub <- .monitoreo_sync_sheets_publish_tabs(id, tabs, format_requests = formato)
  saltadas <- as.character(unlist(pub$skipped_tabs %||% list(), use.names = FALSE))

  hojas <- lapply(names(tabs), function(hoja) {
    list(
      hoja = hoja,
      accion = if (hoja %in% saltadas) "sin_cambios" else "actualizada",
      # Filas de DATOS: la cabecera no es un dato y contarla infla el recibo.
      filas = max(0L, length(tabs[[hoja]]) - .malp_cabeceras(hoja))
    )
  })
  list(
    ok = TRUE,
    spreadsheet_id = id,
    url = paste0("https://docs.google.com/spreadsheets/d/", id, "/edit"),
    updated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    hojas = hojas
  )
}
