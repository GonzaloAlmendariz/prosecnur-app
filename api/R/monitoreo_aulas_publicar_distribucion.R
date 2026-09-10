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
# **Y por qué su hoja es propia y no el «Plan del día» del libro.** La primera
# versión publicaba dos pestañas reusando los productores del operativo, y duró
# unas horas: «le estás dando a los aplicadores más información de la que
# necesitan, y documentación interna». Lo que comparten es el REPARTO —el mismo
# `monitoreo_aulas_reparto()`, sin una segunda lectura de quién va a qué aula—,
# no las columnas: las del libro son de gestión de la muestra y aquí sobran.

#' La ÚNICA pestaña del documento de los aplicadores.
#'
#' La primera versión publicaba dos —la asignación por persona y el plan del día
#' entero— y Gonzalo la corrigió el mismo día: «le estás dando a los aplicadores
#' más información de la que necesitan, y documentación interna». Una hoja, con
#' lo que contesta las cuatro preguntas de quien sale a aplicar.
#' @keywords internal
.mapd_hoja <- function() "Plan del día"

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
  # **Leer ANTES de generar.** El estado que ya está puesto en el documento
  # manda sobre el que la app deduce: «APLICADA» la elige también el coordinador
  # en el chip desplegable, y suele hacerlo antes de que llegue el parte. Sin
  # esta lectura el motor le publicaría «POR APLICAR» encima.
  hoja_previa <- tryCatch({
    meta0 <- .monitoreo_sheets_metadata(id)
    .madc_pestana_de_la_distribucion(id, vapply(meta0$sheets %||% list(), function(h) {
      .monitoreo_scalar((h$properties %||% list())$title, "")
    }, character(1)))
  }, error = function(e) "")
  remoto_previo <- if (nzchar(hoja_previa)) {
    tryCatch(.cads_valores_de_pestana(id, hoja_previa), error = function(e) list())
  } else list()
  filas <- aulas_libro_filas_plan_aplicadores(
    plan %||% list(), disponibilidad, cfg = config_reparto,
    partes = partes %||% list(), efectivas = efectivas,
    estados_previos = aulas_distribucion_estados_publicados(remoto_previo)
  )
  if (is.null(filas)) {
    stop_api(
      409, "E_AULAS_DISTRIBUCION_SIN_DISPONIBILIDAD",
      paste(
        "No hay reparto que publicar: falta cargar la disponibilidad de los",
        "aplicadores. Cárgala en Fuentes y vuelve a publicar."
      )
    )
  }
  # **UNA DISTRIBUCIÓN CON CONTENIDO NO SE SOBRESCRIBE.**
  #
  # Esta función nació para SEMBRAR el documento, cuando la pestaña estaba
  # vacía y la app era su única autora. Desde el 2026-09-08 dejó de serlo: el
  # coordinador de campo edita ahí en vivo —ese día llevaba 33 cambios de
  # aplicador y tres reagendaciones— y el ciclo real es otro, el que dictó
  # Gonzalo: la app PROPONE, él DISPONE, la app ADOPTA lo que él cambió y sólo
  # AÑADE lo que falta.
  #
  # Publicar encima borraría su trabajo entero de un request, y es la clase de
  # llamada que se hace sin pensar («republico y ya»). Las cuatro hojas del
  # equipo en el libro operativo llevan esta misma guarda desde hace semanas;
  # esta pestaña se había quedado sin ella justo cuando pasó a tener dueño.
  # Se reusa lo leído arriba: el presupuesto de requests de este ciclo está
  # pineado en su test y volver a pedir metadata lo duplicaría.
  hoja_existente <- hoja_previa
  if (nzchar(hoja_existente)) {
    remoto <- remoto_previo
    con_datos <- sum(vapply(remoto, function(r) {
      any(nzchar(trimws(as.character(unlist(r %||% list(), use.names = FALSE)))))
    }, logical(1)))
    if (con_datos > 1L) {
      stop_api(
        409, "E_AULAS_DISTRIBUCION_CON_DUENO",
        paste0(
          "La pestaña «", hoja_existente, "» ya tiene ", con_datos - 1L,
          " citas escritas y el equipo edita ahí: publicar encima borraría sus ",
          "cambios. Adopta la distribución para que la app tome sus filas, y ",
          "añade sólo las aulas agendadas que falten."
        ),
        details = list(hoja = hoja_existente, citas = con_datos - 1L)
      )
    }
  }

  tabs <- list()
  tabs[[.mapd_hoja()]] <- filas

  # El roster que llena el desplegable y decide los colores: TODO el equipo con
  # disponibilidad declarada, no sólo quien hoy tiene cita. Reasignar es mover a
  # alguien que no estaba, y una lista sacada de las filas no lo ofrecería.
  roster <- vapply(disponibilidad %||% list(), function(x) {
    aulas_nombre_aplicador(x[["nombre"]] %||% x[["aplicador"]] %||% x)
  }, character(1))
  formato <- function(sheet_id, tab_name, rows) {
    if (identical(tab_name, .mapd_hoja())) {
      return(aulas_libro_plan_aplicadores_formato_requests(
        sheet_id, rows, roster = as.list(roster[nzchar(roster)])))
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
      filas = max(0L, length(tabs[[hoja]]) - 1L)
    )
  })
  list(
    ok = TRUE,
    spreadsheet_id = id,
    url = paste0("https://docs.google.com/spreadsheets/d/", id, "/edit"),
    updated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    hojas = hojas,
    # S7: QUÉ se publicó, para que el tablero pueda decir después si el
    # reparto vigente ya es otro.
    huella = monitoreo_aulas_distribucion_huella(filas),
    citas = max(0L, length(filas) - 1L)
  )
}

# --- S7 (loop estética-aulas-sheets, 2026-09-07): la app recuerda el destino --
#
# El día 1 de campo la distribución publicada quedó vieja —85 citas vigentes
# contra 83 publicadas, 20 cambios de persona— y nada lo decía: este publicador
# escribía el documento y no guardaba ni el id, ni cuándo, ni qué. Hubo que
# medirlo fuera de la app. Ahora la publicación deja una huella de las filas
# escritas, el destino se recuerda en la config (whitelist, como `libro_sheets`)
# y el tablero expone la huella del reparto vigente: si difieren, el reparto
# cambió desde la última publicación y la UI lo dice con su salida.

#' Huella de las filas publicadas a los aplicadores.
#'
#' Misma familia que el hash de pestaña del motor de Sheets: `digest` sha256
#' sobre las filas tal como viajan; sin `digest` devuelve "" y la comparación
#' se declara indeterminada en vez de mentir.
#' @keywords internal
monitoreo_aulas_distribucion_huella <- function(filas) {
  if (is.null(filas) || !length(filas)) return("")
  if (!requireNamespace("digest", quietly = TRUE)) return("")
  digest::digest(lapply(filas, function(f) as.character(unlist(f, use.names = FALSE))), algo = "sha256")
}

#' Normaliza el bloque `distribucion_sheets` para la whitelist de la config.
#'
#' `monitoreo_aulas_normalize_config()` es una lista CERRADA: lo que no nombra
#' no persiste. Devuelve `NULL` sin destino, que es como están los estudios
#' que nunca publicaron a los aplicadores.
#' @keywords internal
monitoreo_aulas_distribucion_sheets_normalizar <- function(x) {
  if (!is.list(x)) return(NULL)
  id <- .monitoreo_extract_spreadsheet_id(
    x[["spreadsheet_id"]] %||% x[["url"]] %||% x[["enlace"]] %||% ""
  )
  if (!nzchar(id)) return(NULL)
  citas <- suppressWarnings(as.integer(x[["citas"]] %||% NA_integer_))[1]
  list(
    spreadsheet_id = id,
    url = paste0("https://docs.google.com/spreadsheets/d/", id, "/edit"),
    updated_at = .monitoreo_scalar(x[["updated_at"]], ""),
    huella = .monitoreo_scalar(x[["huella"]], ""),
    citas = if (is.na(citas)) 0L else citas
  )
}

#' Recuerda (o olvida) el Sheets de los aplicadores en la config de monitoreo.
#'
#' @param cfg config de monitoreo completa.
#' @param enlace_o_id enlace o id; `""` olvida el destino.
#' @param huella,citas lo que acaba de publicarse, para comparar después.
#' @return la config con `aulas_universitarias$distribucion_sheets` puesto o retirado.
#' @keywords internal
monitoreo_aulas_distribucion_destino_set <- function(cfg, enlace_o_id, huella = "", citas = 0L) {
  if (!is.list(cfg)) cfg <- list()
  aulas <- if (is.list(cfg[["aulas_universitarias"]])) cfg[["aulas_universitarias"]] else list()
  crudo <- trimws(.monitoreo_scalar(enlace_o_id, ""))
  if (!nzchar(crudo)) {
    aulas[["distribucion_sheets"]] <- NULL
    cfg[["aulas_universitarias"]] <- aulas
    return(cfg)
  }
  id <- .monitoreo_extract_spreadsheet_id(crudo)
  if (!nzchar(id)) {
    stop_api(
      400, "E_SHEETS_SPREADSHEET",
      "El enlace no parece de Google Sheets: no trae el identificador del documento.",
      details = list(entrada = crudo)
    )
  }
  aulas[["distribucion_sheets"]] <- list(
    spreadsheet_id = id,
    url = paste0("https://docs.google.com/spreadsheets/d/", id, "/edit"),
    updated_at = .monitoreo_now_iso(),
    huella = .monitoreo_scalar(huella, ""),
    citas = as.integer(citas %||% 0L)[1]
  )
  cfg[["aulas_universitarias"]] <- aulas
  cfg
}
