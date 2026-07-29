# =============================================================================
# Exportación e importación del subsistema Bitácora (ADR 0047)
# =============================================================================
#
# El grafo completo —cronograma, entradas, lienzos y los vínculos que los unen—
# viaja como UN archivo JSON. Sirve para mover el mapa de un estudio a otro y
# para respaldarlo fuera del .pulso.
#
# LA IMPORTACIÓN ES DE DOS PASOS Y NO ES NEGOCIABLE.
#
#   1. `.bit_port_revisar(s, doc)` mira el documento contra el estado actual y
#      devuelve qué crearía, qué actualizaría y qué está roto, SIN ESCRIBIR
#      NADA. Con eso la UI dice «voy a reemplazar 12 hitos» antes de que sea
#      tarde.
#   2. `.bit_port_aplicar(s, doc, token)` ejecuta ese plan.
#
# El token liga el paso 2 al estado que vio el paso 1. Si entre la vista previa
# y la confirmación alguien tocó el proyecto —otra pestaña, un job que terminó,
# el propio usuario en otra sección—, el token queda obsoleto y la aplicación se
# rechaza. Sin esa ligadura la validación previa sería decorativa: mostraría un
# plan y aplicaría otro.

BITACORA_PORT_ESQUEMA <- "bitacora_export_v1"

# Tope de seguridad. Un JSON de 2.000 elementos no es un estudio, es un
# accidente (o un archivo que no era este), y procesarlo bloquea el hilo único
# de Plumber.
BITACORA_PORT_MAX_ITEMS <- 2000L

#' Documento exportable con el grafo completo.
#'
#' Incluye los vínculos porque viven DENTRO de cada entidad (`links`), no en una
#' colección aparte: exportar las entidades exporta el grafo. Los avisos
#' disparados NO viajan —son historia de esta instalación, no del estudio— y las
#' preferencias de filtro tampoco.
.bit_port_exportar <- function(s) {
  plan <- s$plan_trabajo %||% list()
  list(
    schema = BITACORA_PORT_ESQUEMA,
    exported_at = .plan_now_iso(),
    plan = list(
      schema = plan$schema %||% "plan_trabajo_v2",
      tasks = plan$tasks %||% list()
    ),
    bitacora = s$diseno_estudio_bitacora %||% list(),
    canvas = list(
      schema = (s$bitacora_canvas %||% list())$schema %||% "bitacora_canvas_v1",
      canvases = (s$bitacora_canvas %||% list())$canvases %||% list()
    )
  )
}

#' Huella del conjunto de entidades que la vista previa observó.
#'
#' NO es un hash criptográfico ni pretende serlo: solo tiene que cambiar cuando
#' aparece o desaparece una entidad, que es lo que invalida un plan de
#' importación. Un hash del contenido completo obligaría a rehacer la vista
#' previa por un typo en un campo que la importación ni mira, y traer `digest`
#' a DESCRIPTION para esto sería una dependencia por una línea.
.bit_port_huella <- function(s) {
  ids <- sort(.bit_link_ids_vivos(s))
  if (!length(ids)) return("vacio-0")
  texto <- paste(ids, collapse = "|")
  codigos <- utf8ToInt(texto)
  sprintf("%d-%d-%d", length(ids), nchar(texto), sum(codigos * seq_along(codigos)) %% 1000000L)
}

.bit_port_chr <- function(x) {
  if (is.null(x) || length(x) == 0L) return("")
  as.character(x[[1]])
}

.bit_port_canvases <- function(doc) {
  (doc$canvas %||% list())$canvases %||% list()
}

#' Revisa un documento contra el estado actual sin escribir nada.
#'
#' @return lista con `crea`, `actualiza`, `errores`, `aplicable` y `token`.
.bit_port_revisar <- function(s, doc) {
  if (!is.list(doc)) {
    stop_api(400, "E_BITACORA_IMPORT_FORMATO", "El archivo no contiene un documento JSON.")
  }
  esquema <- .bit_port_chr(doc$schema)
  if (!identical(esquema, BITACORA_PORT_ESQUEMA)) {
    stop_api(
      400, "E_BITACORA_IMPORT_ESQUEMA",
      sprintf(
        "El archivo dice ser «%s» y este importador lee «%s».",
        if (nzchar(esquema)) esquema else "(sin esquema)", BITACORA_PORT_ESQUEMA
      )
    )
  }

  tareas <- doc$plan$tasks %||% list()
  entradas <- doc$bitacora %||% list()
  lienzos <- .bit_port_canvases(doc)
  total <- length(tareas) + length(entradas) + length(lienzos)
  if (total > BITACORA_PORT_MAX_ITEMS) {
    stop_api(
      413, "E_BITACORA_IMPORT_TAMANO",
      sprintf("El archivo trae %d elementos y el tope es %d.", total, BITACORA_PORT_MAX_ITEMS)
    )
  }

  vivos <- .bit_link_ids_vivos(s)
  crea <- list(); actualiza <- list(); errores <- list()

  registrar <- function(existe, tipo, id, etiqueta) {
    fila <- list(tipo = tipo, id = id, etiqueta = etiqueta)
    if (existe) actualiza[[length(actualiza) + 1L]] <<- fila
    else crea[[length(crea) + 1L]] <<- fila
  }

  fallar <- function(tipo, id, motivo) {
    errores[[length(errores) + 1L]] <<- list(tipo = tipo, id = id, motivo = motivo)
  }

  for (t in tareas) {
    id <- .bit_port_chr(t$id)
    etiqueta <- .bit_port_chr(t$activity)
    if (!nzchar(id)) { fallar("tarea", "", "Hito sin id."); next }
    if (!nzchar(etiqueta)) { fallar("tarea", id, "Hito sin nombre de actividad."); next }
    registrar(.bit_vinculo_clave("tarea", id) %in% vivos, "tarea", id, etiqueta)
  }

  for (e in entradas) {
    id <- .bit_port_chr(e$id)
    etiqueta <- .bit_port_chr(e$title)
    if (!nzchar(id)) { fallar("entrada", "", "Entrada sin id."); next }
    if (!nzchar(etiqueta)) { fallar("entrada", id, "Entrada sin título."); next }
    registrar(.bit_vinculo_clave("entrada", id) %in% vivos, "entrada", id, etiqueta)
  }

  for (l in lienzos) {
    id <- .bit_port_chr(l$id)
    etiqueta <- .bit_port_chr(l$name)
    if (!nzchar(id)) { fallar("lienzo", "", "Lienzo sin id."); next }
    registrar(.bit_vinculo_clave("lienzo", id) %in% vivos, "lienzo", id, etiqueta)
  }

  # Un ciclo importado es tan inválido como uno escrito a mano, y este es el
  # único camino por el que puede entrar sin pasar por el formulario.
  ciclo <- .bit_cron_ciclo(.bit_port_fusionar_tareas(s$plan_trabajo$tasks %||% list(), tareas))
  if (length(ciclo)) {
    fallar("tarea", ciclo[[1]], sprintf("Dependencias circulares: %s.", paste(ciclo, collapse = " → ")))
  }

  list(
    crea = crea,
    actualiza = actualiza,
    errores = errores,
    aplicable = length(errores) == 0L,
    token = .bit_port_huella(s)
  )
}

#' Aplica un documento ya revisado.
#'
#' El token tiene que ser el que devolvió la revisión sobre ESTE estado. Si el
#' proyecto cambió en el medio se rechaza: el usuario confirmó un plan que ya no
#' describe lo que va a pasar.
.bit_port_aplicar <- function(s, doc, token) {
  if (!identical(.bit_port_chr(token), .bit_port_huella(s))) {
    stop_api(
      409, "E_BITACORA_IMPORT_TOKEN",
      "El proyecto cambió desde que se revisó el archivo. Vuelve a revisarlo antes de importar."
    )
  }

  revision <- .bit_port_revisar(s, doc)
  if (!revision$aplicable) {
    stop_api(
      422, "E_BITACORA_IMPORT_INVALIDO",
      "El archivo tiene errores que hay que resolver antes de importar."
    )
  }

  plan <- s$plan_trabajo %||% NULL
  if (is.null(plan) || !is.list(plan)) plan <- .plan_empty_plan()
  plan$tasks <- .bit_port_fusionar_tareas(plan$tasks %||% list(), doc$plan$tasks %||% list())
  s$plan_trabajo <- .plan_rebuild_derived(plan)

  s$diseno_estudio_bitacora <- .bit_port_fusionar_por_id(
    s$diseno_estudio_bitacora %||% list(), doc$bitacora %||% list()
  )

  canvas <- s$bitacora_canvas %||% list(schema = "bitacora_canvas_v1", canvases = list())
  canvas$canvases <- .bit_port_fusionar_por_id(
    canvas$canvases %||% list(), .bit_port_canvases(doc)
  )
  s$bitacora_canvas <- canvas

  # Lo importado puede apuntar a cosas que este proyecto no tiene: se limpia acá
  # y no queda ni un enlace colgante después de importar.
  .bit_link_gc(s)
}

#' Fusiona por id: lo entrante gana, lo que no viene se conserva.
#'
#' Importar NO es reemplazar. Un mapa traído de otro estudio se suma al que ya
#' existe; borrar lo que el archivo no menciona convertiría cada importación en
#' una pérdida de datos silenciosa.
.bit_port_fusionar_por_id <- function(actuales, entrantes) {
  if (!length(entrantes)) return(actuales)
  por_id <- list()
  orden <- character(0)
  agregar <- function(x) {
    id <- .bit_port_chr(x$id)
    if (!nzchar(id)) return(invisible(NULL))
    if (!(id %in% orden)) orden <<- c(orden, id)
    por_id[[id]] <<- x
    invisible(NULL)
  }
  for (x in actuales) agregar(x)
  for (x in entrantes) agregar(x)
  # `orden` conserva la posición de lo que ya estaba: lo importado se agrega al
  # final en vez de reordenar un cronograma que el usuario ya acomodó.
  unname(por_id[orden])
}

.bit_port_fusionar_tareas <- function(actuales, entrantes) {
  lapply(.bit_port_fusionar_por_id(actuales, entrantes), .bit_normalizar_tarea)
}
