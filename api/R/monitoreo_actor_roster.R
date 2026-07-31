# El elenco de actores del estudio: declarado, no adivinado.
#
# Hasta aqui un actor de acreditacion no existia como objeto. Nacia del texto
# libre que alguien escribia en `dimensions$actor` al conectar una fuente, y
# `monitoreo_normalize_config` reescribia `profile$units` en CADA normalizacion
# con lo deducido de esas fuentes. El efecto medido en `acrconta`: los cinco
# nombres que la UI ofrecia eran una constante del frontend, renombrar un actor
# exigia editar el string en sus seis fuentes una por una, y equivocarse en una
# sola lo partia en dos actores distintos sin aviso.
#
# El modelo de datos para el elenco ya existia entero —`id`, `actor`, `label`,
# `segment`, `group`, `phone`— y estaba desconectado: ningun endpoint lo
# escribia y la normalizacion lo pisaba. Este archivo lo conecta.
#
# La regla es una sola: **lo declarado manda, lo derivado completa**. Un actor
# que el usuario declaro sobrevive aunque todavia no tenga ninguna fuente —es
# justo el caso que antes no se podia expresar, porque el actor solo nacia al
# conectar algo—. Un actor que aparece en una fuente pero nadie declaro se
# anexa igual, para que conectar una fuente nunca haga desaparecer datos del
# tablero.

MONITOREO_ACTOR_ROSTER_ORIGIN_DECLARED <- "declarado"
MONITOREO_ACTOR_ROSTER_ORIGIN_SOURCES <- "fuentes"

#' Clave de comparacion de un nombre de actor, vacia cuando no hay actor.
#'
#' «Egresados», «egresados » y «EGRESADOS» son el mismo actor. Sin esta
#' normalizacion el elenco se duplicaba por un espacio final.
#'
#' El guard de vacio NO es defensivo de mas: `.monitoreo_safe_name("")` devuelve
#' `"campo"` —su fallback generico para nombres de variable—, asi que una fuente
#' sin actor entraba al elenco como un actor llamado «campo». Aqui la ausencia
#' de actor tiene que seguir siendo ausencia.
.monitoreo_actor_key <- function(actor) {
  clean <- trimws(.monitoreo_scalar(actor, ""))
  if (!nzchar(clean)) return("")
  .monitoreo_safe_name(clean)
}

#' Solo las unidades que el usuario declaro.
#'
#' Se usa antes de recalcular las derivadas: sin este filtro, las unidades que
#' Fuentes dedujo en la vuelta anterior se leerian como elenco y quedarian
#' congeladas aunque la fuente que las origino se hubiera borrado.
monitoreo_actor_roster_declared <- function(units = list()) {
  normalized <- .monitoreo_normalize_model_units(units)
  Filter(
    function(unit) identical(
      .monitoreo_scalar(unit$origin, ""),
      MONITOREO_ACTOR_ROSTER_ORIGIN_DECLARED
    ),
    normalized
  )
}

#' Normaliza un elenco recibido del cliente y lo marca como declarado.
#'
#' Deduplica por nombre conservando el primero: el orden del elenco es el orden
#' en que el usuario lo escribio y es el que despues ordena las tarjetas de
#' Modelo y Avance.
monitoreo_actor_roster_normalize <- function(units = list()) {
  items <- .monitoreo_normalize_profile_list(units)
  out <- list()
  seen <- character(0)
  for (item in items) {
    if (!is.list(item)) next
    actor <- trimws(.monitoreo_scalar(
      item$actor %||% item$label %||% item$etiqueta %||% item$nombre, ""
    ))
    if (!nzchar(actor)) next
    key <- .monitoreo_actor_key(actor)
    if (!nzchar(key) || key %in% seen) next
    seen <- c(seen, key)
    item$actor <- actor
    item$label <- actor
    item$origin <- MONITOREO_ACTOR_ROSTER_ORIGIN_DECLARED
    out[[length(out) + 1L]] <- item
  }
  .monitoreo_normalize_model_units(out)
}

#' El elenco declarado, completado con los actores que solo viven en fuentes.
#'
#' El declarado va primero y en su orden; los derivados se anexan detras. Un
#' derivado que coincide con un declarado no entra: el declarado ya lo
#' representa y es el que lleva el `phone` que el usuario eligio.
monitoreo_actor_roster_merge <- function(declared = list(), derived = list()) {
  declared <- .monitoreo_normalize_model_units(declared)
  derived <- .monitoreo_normalize_model_units(derived)
  keys <- vapply(declared, function(unit) .monitoreo_actor_key(unit$actor), character(1))
  out <- declared
  for (unit in derived) {
    key <- .monitoreo_actor_key(unit$actor)
    if (!nzchar(key) || key %in% keys) next
    keys <- c(keys, key)
    out[[length(out) + 1L]] <- unit
  }
  .monitoreo_normalize_model_units(out)
}

#' Renombra un actor en TODAS sus fuentes.
#'
#' Es la operacion que no existia. Cambiar el nombre en una sola fuente no
#' renombra nada: crea un actor nuevo y deja al viejo vivo en las fuentes que
#' no se tocaron. Aqui se reescriben `actor` y `segmento` —los dos campos que
#' `.monitoreo_source_declared_actor_units` lee como declaracion— en cada
#' fuente que apuntaba al nombre anterior.
monitoreo_actor_roster_rename_sources <- function(sources = list(), from = "", to = "") {
  from_key <- .monitoreo_actor_key(from)
  to_clean <- trimws(.monitoreo_scalar(to, ""))
  if (!nzchar(from_key) || !nzchar(to_clean)) return(sources)
  lapply(sources, function(source) {
    if (!is.list(source)) return(source)
    dimensions <- source$dimensions %||% source$dimensiones %||% list()
    if (!is.list(dimensions)) return(source)
    for (field in c("actor", "unidad")) {
      if (identical(.monitoreo_actor_key(dimensions[[field]]), from_key)) {
        dimensions[[field]] <- to_clean
      }
    }
    # El segmento arrastra el nombre del actor porque el panel de conexion lo
    # guarda como copia. Dejarlo con el nombre viejo revive al actor borrado
    # en cuanto alguien lee `dimensions$segmento`.
    for (field in c("segmento", "segment")) {
      if (identical(.monitoreo_actor_key(dimensions[[field]]), from_key)) {
        dimensions[[field]] <- to_clean
      }
    }
    source$dimensions <- dimensions
    if (!is.null(source$dimensiones)) source$dimensiones <- dimensions
    source
  })
}

#' Renombra un actor en las columnas ya materializadas del snapshot.
#'
#' Sin esto el renombrado deja un fantasma, y se ve: al renombrar «Egresados» a
#' «Ex alumnos» en `acrconta`, las seis fuentes pasaban al nombre nuevo pero el
#' elenco seguia mostrando un «Egresados» con 0 padrones, 0 encuestas y 0
#' barridos. El motivo es que `.monitoreo_source_declared_actor_units` lee dos
#' cosas —el atributo de fuentes Y las columnas `dim_actor` de las filas del
#' snapshot— y `.monitoreo_apply_source_metadata_to_data` solo reescribe las
#' columnas de codigo de persona, no las dimensiones.
#'
#' Reescribir aqui es preferible a invalidar el snapshot: el renombrado no
#' cambia ni una respuesta, y obligar a resincronizar 1.277 registros para
#' cambiar una etiqueta seria cobrar un minuto por corregir una palabra.
monitoreo_actor_roster_rename_snapshot <- function(data = NULL, from = "", to = "") {
  if (is.null(data) || !is.data.frame(data) || !nrow(data)) return(data)
  from_key <- .monitoreo_actor_key(from)
  to_clean <- trimws(.monitoreo_scalar(to, ""))
  if (!nzchar(from_key) || !nzchar(to_clean)) return(data)
  columnas <- intersect(
    c("dim_actor", ".dim_actor", ".source_actor", "source_actor", "dim_unidad", "dim_segmento"),
    names(data)
  )
  for (column in columnas) {
    values <- as.character(data[[column]] %||% "")
    hit <- vapply(values, function(value) identical(.monitoreo_actor_key(value), from_key), logical(1))
    if (any(hit)) values[hit] <- to_clean
    data[[column]] <- values
  }
  data
}

#' Cuantas fuentes de cada papel tiene cada actor.
#'
#' Devuelve una lista por clave de actor con `actor`, `universo`, `respuestas`
#' y `barrido`. Es lo que necesita tanto la validacion de cardinalidad como la
#' vista del elenco para decir «Docentes: sin padron».
monitoreo_actor_roster_counts <- function(sources = list()) {
  counts <- list()
  for (source in sources) {
    if (!is.list(source)) next
    dimensions <- source$dimensions %||% source$dimensiones %||% list()
    if (!is.list(dimensions)) dimensions <- list()
    actor <- trimws(.monitoreo_scalar(dimensions$actor %||% dimensions$unidad, ""))
    key <- .monitoreo_actor_key(actor)
    if (!nzchar(key)) next
    role <- .monitoreo_text_key(.monitoreo_scalar(source$role, ""))
    current <- counts[[key]] %||% list(actor = actor, universo = 0L, respuestas = 0L, barrido = 0L)
    if (role %in% c("universo", "respuestas", "barrido")) {
      current[[role]] <- as.integer(current[[role]]) + 1L
    }
    counts[[key]] <- current
  }
  counts
}

#' Las reglas de cardinalidad del estudio, dichas una sola vez.
#'
#' Salen del boceto de Fuentes y no son cosmeticas: un actor con dos padrones
#' tiene dos universos distintos y su porcentaje de avance depende de cual gane
#' el desempate, que hoy es el orden de la lista. Un actor con dos hojas de
#' barrido duplica intentos y estados de llamada.
#'
#'   · exactamente una base de universo por actor
#'   · como maximo una hoja de barrido por actor
#'   · barrido solo para actores con canal telefonico declarado
#'
#' Se valida al CONECTAR, que es cuando el usuario puede corregir sin perder
#' trabajo. Devuelve `NULL` cuando la fuente entrante es legal.
monitoreo_actor_roster_conflict <- function(sources = list(), incoming = list(), roster = list()) {
  if (!is.list(incoming)) return(NULL)
  role <- .monitoreo_text_key(.monitoreo_scalar(incoming$role, ""))
  if (!role %in% c("universo", "barrido")) return(NULL)

  dimensions <- incoming$dimensions %||% incoming$dimensiones %||% list()
  if (!is.list(dimensions)) dimensions <- list()
  actor <- trimws(.monitoreo_scalar(dimensions$actor %||% dimensions$unidad, ""))
  key <- .monitoreo_actor_key(actor)
  if (!nzchar(key)) return(NULL)

  incoming_id <- .monitoreo_scalar(incoming$id, "")
  # Una fuente que se está reeditando no compite consigo misma: `upsert`
  # reemplaza por `id`, asi que guardar dos veces el mismo padron es legal.
  otras <- Filter(
    function(source) {
      is.list(source) && !identical(.monitoreo_scalar(source$id, ""), incoming_id)
    },
    sources
  )
  counts <- monitoreo_actor_roster_counts(otras)[[key]] %||%
    list(actor = actor, universo = 0L, respuestas = 0L, barrido = 0L)

  if (identical(role, "universo") && as.integer(counts$universo) >= 1L) {
    return(list(
      code = "E_MONITOREO_ACTOR_UNIVERSO_DUPLICADO",
      message = sprintf(
        "%s ya tiene una base de universo. Cada actor se mide contra un solo padron: edita el existente o cambia el actor de esta fuente.",
        actor
      )
    ))
  }

  if (identical(role, "barrido")) {
    if (as.integer(counts$barrido) >= 1L) {
      return(list(
        code = "E_MONITOREO_ACTOR_BARRIDO_DUPLICADO",
        message = sprintf(
          "%s ya tiene una hoja de barrido. Solo se admite una por actor para no duplicar intentos y estados de llamada.",
          actor
        )
      ))
    }
    if (!monitoreo_actor_roster_has_phone(roster, actor)) {
      return(list(
        code = "E_MONITOREO_ACTOR_SIN_CANAL_TELEFONICO",
        message = sprintf(
          "%s no tiene canal telefonico declarado. Activalo en Actores antes de conectar su hoja de barrido.",
          actor
        )
      ))
    }
  }

  NULL
}

#' Si un actor del elenco tiene canal telefonico.
#'
#' Un actor que todavia no esta en el elenco no bloquea nada: el elenco puede
#' estar por declararse y no es este el sitio donde obligar a completarlo.
monitoreo_actor_roster_has_phone <- function(roster = list(), actor = "") {
  key <- .monitoreo_actor_key(actor)
  if (!nzchar(key)) return(TRUE)
  units <- .monitoreo_normalize_model_units(roster)
  declarado <- FALSE
  for (unit in units) {
    if (!identical(.monitoreo_actor_key(unit$actor), key)) next
    declarado <- TRUE
    phone <- unit$phone %||% list()
    if (is.list(phone) && isTRUE(.monitoreo_bool(phone$enabled, FALSE))) return(TRUE)
  }
  !declarado
}
