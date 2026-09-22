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
  meta0 <- tryCatch(.monitoreo_sheets_metadata(id), error = function(e) NULL)
  titulos_remotos <- vapply((meta0 %||% list())$sheets %||% list(), function(h) {
    .monitoreo_scalar((h$properties %||% list())$title, "")
  }, character(1))
  hoja_previa <- tryCatch(
    .madc_pestana_de_la_distribucion(id, titulos_remotos),
    error = function(e) ""
  )
  # Cada pestaña se lee UNA vez por publicación: el presupuesto de requests de
  # este ciclo está pineado en su test y la partición por semana multiplica las
  # lecturas si no se memoiza.
  leidas <- new.env(parent = emptyenv())
  valores_de <- function(hoja) {
    if (!nzchar(hoja)) return(list())
    if (is.null(leidas[[hoja]])) {
      leidas[[hoja]] <- tryCatch(.cads_valores_de_pestana(id, hoja), error = function(e) list())
    }
    leidas[[hoja]]
  }
  remoto_previo <- valores_de(hoja_previa)
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
  #
  # **Y la guarda es POR PESTAÑA, no por documento.** Ésa es la mitad que la
  # partición por semana obliga a cambiar: con una sola hoja, «hay citas
  # escritas» y «no hay dónde publicar» eran lo mismo; con una hoja por semana,
  # que la semana 1 tenga el trabajo del coordinador no puede impedir que se
  # siembre la semana 2. Se respeta la que tiene dueño y se publica el resto.
  citas_escritas <- function(valores) {
    max(0L, sum(vapply(valores, function(r) {
      any(nzchar(trimws(as.character(unlist(r %||% list(), use.names = FALSE)))))
    }, logical(1))) - 1L)
  }

  inicio <- monitoreo_aulas_inicio_de_campo(plan %||% list())
  rep <- monitoreo_aulas_reparto_de_config(plan %||% list(), disponibilidad, config_reparto)
  por_semana <- monitoreo_aulas_reparto_por_semana(rep, inicio)

  tabs <- list()
  respetadas <- list()
  # Sin semanas legibles —un plan sin fechas, o fechas rotas— se publica como
  # siempre, en la hoja de toda la vida: el documento no se queda sin publicar
  # por no saber numerar sus semanas.
  if (!length(por_semana) || identical(names(por_semana), "")) {
    if (nzchar(hoja_previa) && citas_escritas(remoto_previo) > 0L) {
      respetadas[[hoja_previa]] <- citas_escritas(remoto_previo)
    } else {
      tabs[[if (nzchar(hoja_previa)) hoja_previa else .mapd_hoja()]] <- filas
    }
  } else {
    for (nombre in names(por_semana)) {
      trozo <- por_semana[[nombre]]
      destino <- .mads_hoja_para_semana(
        titulos_remotos, nombre, .mads_fechas_cortas(trozo), hoja_previa, valores_de)
      if (!nzchar(destino)) destino <- .mapd_hoja()
      remoto <- valores_de(if (destino %in% titulos_remotos) destino else "")
      escritas <- citas_escritas(remoto)
      filas_semana <- aulas_libro_filas_plan_aplicadores(
        plan %||% list(), disponibilidad, cfg = config_reparto, rep = trozo,
        partes = partes %||% list(), efectivas = efectivas,
        estados_previos = aulas_distribucion_estados_publicados(remoto)
      )
      if (is.null(filas_semana) || length(filas_semana) < 2L) next
      if (escritas > 0L) {
        respetadas[[destino]] <- escritas
        next
      }
      tabs[[destino]] <- filas_semana
    }
  }

  # La hoja «Clases por agendar» DEJÓ DE EXISTIR el 2026-09-21. Gonzalo, viendo
  # la primera versión: «en vez de tener dos hojas separadas […] podemos poner
  # integrados todos los cursos-horario titulares no confirmados» en la hoja de
  # la semana. Una hoja de referencia aparte es de sólo mirar; una fila en la
  # hoja del reparto tiene su desplegable de aplicador y su chip de estado, y el
  # coordinador la trabaja igual que las demás. Las emite
  # `aulas_libro_filas_plan_aplicadores()`, con el resto.

  # Todas con dueño y ninguna que sembrar: es el caso de siempre —«republico y
  # ya» sobre el trabajo del coordinador— y sigue siendo un error, no un no-op
  # silencioso.
  #
  # **Pero la hoja de referencia se escribe ANTES de levantarlo.** Es la única
  # que no tiene dueño y la única cuyo valor es estar al día; dejarla vieja
  # porque las semanas están ocupadas castiga justo al coordinador que está
  # trabajando. Se escribe, se dice en el mensaje, y el 409 sigue saltando para
  # que nadie crea que su republicación tocó la distribución.
  if (!length(tabs) && length(respetadas)) {
    primera <- names(respetadas)[[1L]]
    stop_api(
      409, "E_AULAS_DISTRIBUCION_CON_DUENO",
      paste0(
        "La pestaña «", primera, "» ya tiene ", respetadas[[primera]],
        " citas escritas y el equipo edita ahí: publicar encima borraría sus ",
        "cambios. Adopta la distribución para que la app tome sus filas, y ",
        "añade sólo las aulas agendadas que falten."
      ),
      details = list(hoja = primera, citas = respetadas[[primera]])
    )
  }

  # El roster que llena el desplegable y decide los colores: TODO el equipo con
  # disponibilidad declarada, no sólo quien hoy tiene cita. Reasignar es mover a
  # alguien que no estaba, y una lista sacada de las filas no lo ofrecería.
  roster <- vapply(disponibilidad %||% list(), function(x) {
    aulas_nombre_aplicador(x[["nombre"]] %||% x[["aplicador"]] %||% x)
  }, character(1))
  # El formato va a TODAS las que se escriben. Antes bastaba comparar con el
  # nombre único; con una hoja por semana, comparar con «Plan del día» dejaría
  # la semana 2 sin desplegable de estado y sin colores por aplicador —la hoja
  # se vería como una tabla muerta y nadie podría reasignar desde ella—.
  formato <- function(sheet_id, tab_name, rows) {
    if (!(tab_name %in% names(tabs))) return(list())
    aulas_libro_plan_aplicadores_formato_requests(
      sheet_id, rows, roster = as.list(roster[nzchar(roster)]))
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
  # Las que NO se escribieron viajan en el mismo recibo y con su motivo. Una
  # semana respetada que no se nombra es una publicación que parece completa y
  # dejó una semana fuera: el llamador no puede distinguirla de una que no
  # existía —el defecto de descartar en silencio, aquí con una semana entera—.
  hojas <- c(hojas, lapply(names(respetadas), function(hoja) {
    list(hoja = hoja, accion = "respetada", filas = respetadas[[hoja]])
  }))
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
