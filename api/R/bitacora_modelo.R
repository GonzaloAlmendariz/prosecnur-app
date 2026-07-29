# =============================================================================
# Modelo del subsistema Bitácora (ADR 0047)
# =============================================================================
#
# Normalizadores PUROS de los campos que el ADR 0047 agrega a las entidades del
# módulo: prioridad, etiquetas, recordatorios, recurrencia y vínculos. No tocan
# sesión, no leen disco y no dependen del router: por eso son testeables solos
# y reusables desde cronograma, entradas, canvas y portabilidad.
#
# Regla de la casa: los micro-helpers genéricos (`%||%`, `calc_str`, `calc_enum`,
# `calc_bool`, `calc_int`) viven en helpers_calc_comunes.R y se reusan; acá solo
# vive lo que es específico del dominio de Bitácora.
#
# Contrato de normalización: toda función acepta entrada cruda de jsonlite
# (`simplifyVector = FALSE`, o sea listas anidadas) o un valor ya normalizado, y
# devuelve SIEMPRE la forma canónica. Normalizar dos veces da lo mismo que
# normalizar una — la idempotencia es lo que permite invocarlas en cada lectura
# sin deformar el dato.

# --- Vocabularios cerrados ---------------------------------------------------

# Prioridad ordinal, de mayor a menor. Cuatro niveles y no más: el ADR 0047 fija
# el tope porque una escala larga se vuelve decorativa.
BITACORA_PRIORIDADES <- c("critica", "alta", "media", "baja")

# Cómo ocupa el calendario. Distinto del `kind` de plan_trabajo, que dice qué es
# la tarea en el estudio (activity/milestone/deliverable/fieldwork_window).
BITACORA_TEMPORAL_KINDS <- c("punto", "rango", "recurrente")

BITACORA_ANCLAS_RECORDATORIO <- c("start", "end")
BITACORA_ESTADOS_RECORDATORIO <- c("programado", "disparado", "pospuesto", "descartado")
# Solo in-app por decisión del ADR 0047: no se amplía el contextBridge de Electron.
BITACORA_CANALES_RECORDATORIO <- c("in_app")

BITACORA_REGLAS_RECURRENCIA <- c("daily", "weekly", "monthly")

# A qué puede apuntar un vínculo o un nodo de referencia.
#
# `modulo` es distinto de los demás y por eso se comenta: no apunta a un dato
# del proyecto sino a una PARTE DE LA APP —un módulo o una de sus secciones,
# como `"monitoreo"` o `"procesamiento/carga"`—. Es lo que permite armar en el
# lienzo un mapa del estudio con las mismas piezas que el usuario ya usa, en
# vez de con cajas de texto que solo él entiende.
#
# Consecuencia: un destino de tipo `modulo` SIEMPRE existe. No se puede borrar
# un módulo desde un proyecto, así que el garbage collector de vínculos no lo
# toca, y su resumen lo resuelve el frontend contra `lib/modules.ts` —el
# backend no conoce ese catálogo y no debería.
BITACORA_TIPOS_DESTINO <- c("tarea", "entrada", "nodo", "lienzo", "modulo")
BITACORA_RELACIONES <- c("menciona", "deriva_de", "documenta", "bloquea")

# Topes de cardinalidad. Existen para que un import malicioso o un bug de UI no
# hagan crecer el .pulso sin techo.
BITACORA_MAX_ETIQUETAS <- 8L
BITACORA_MAX_RECORDATORIOS <- 6L
BITACORA_MAX_VINCULOS <- 24L
BITACORA_MAX_BLOQUEADORES <- 12L
BITACORA_MAX_EXCEPCIONES_RECURRENCIA <- 366L

# --- Primitivas --------------------------------------------------------------

.bit_now_iso <- function() {
  format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
}

.bit_id <- function(prefijo) {
  paste0(prefijo, "_", uuid::UUIDgenerate())
}

# Texto saneado: sin caracteres de control (que romperían el JSON del payload y
# el markdown de exportación) y acotado.
.bit_texto <- function(value, max_chars = 300L) {
  out <- calc_str(if (is.list(value)) (value[[1]] %||% "") else value, "")
  out <- gsub("[\001-\010\013\014\016-\037\177]", "", out, perl = TRUE)
  out <- trimws(out)
  if (nchar(out, type = "chars") > max_chars) out <- substr(out, 1L, max_chars)
  out
}

# Fecha de DÍA local en ISO corto. Devuelve "" ante cualquier cosa que no sea
# una fecha real: el cliente distingue "sin fecha" de "fecha inválida" viendo
# vacío, nunca un valor inventado.
#
# `format` explícito: `as.Date(x)` sin formato LANZA error ante una fecha
# imposible como "2026-02-31" en vez de devolver NA.
.bit_fecha <- function(value) {
  v <- .bit_texto(value, 10L)
  if (!nzchar(v)) return("")
  if (!grepl("^[0-9]{4}-[0-9]{2}-[0-9]{2}$", v)) return("")
  d <- suppressWarnings(as.Date(v, format = "%Y-%m-%d"))
  if (is.na(d)) return("")
  format(d, "%Y-%m-%d")
}

# Marca de tiempo ISO completa. Acepta lo que ya está normalizado y descarta el
# resto; no intenta parsear formatos libres.
.bit_marca <- function(value) {
  v <- .bit_texto(value, 40L)
  if (!nzchar(v)) return("")
  if (!grepl("^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}", v)) return("")
  v
}

# Tabla de transliteración explícita. `iconv(to = "ASCII//TRANSLIT")` NO sirve
# acá: su salida depende de la implementación de iconv del sistema — en macOS
# descompone "ñandú" en "nand'u", que tras el saneo queda "nand-u" y parte en
# dos una etiqueta que debería ser una sola. Una tabla fija da el mismo slug en
# macOS, Linux y Windows, que es lo que un .pulso portable necesita.
BITACORA_ACENTOS_DESDE <- "áéíóúüñàèìòùâêîôûç"
BITACORA_ACENTOS_HACIA <- "aeiouunaeiouaeiouc"

# Etiqueta: minúsculas, sin acentos, espacios y guiones bajos a guión. Mismo
# criterio de slug que usa la navegación del frontend, para que una etiqueta
# escrita como "Trabajo de Campo" y otra como "trabajo-de-campo" sean una sola.
.bit_etiqueta <- function(value) {
  v <- .bit_texto(value, 40L)
  if (!nzchar(v)) return("")
  v <- chartr(BITACORA_ACENTOS_DESDE, BITACORA_ACENTOS_HACIA, tolower(v))
  v <- gsub("[^a-z0-9]+", "-", v)
  v <- gsub("^-+|-+$", "", v)
  v
}

.bit_etiquetas <- function(value, max_items = BITACORA_MAX_ETIQUETAS) {
  if (is.null(value)) return(list())
  if (is.list(value)) value <- unlist(value, recursive = TRUE, use.names = FALSE)
  if (!length(value)) return(list())
  out <- vapply(as.character(value), .bit_etiqueta, character(1), USE.NAMES = FALSE)
  out <- unique(out[nzchar(out)])
  as.list(utils::head(out, max_items))
}

# --- Prioridad ---------------------------------------------------------------

.bit_prioridad <- function(value) {
  calc_enum(if (is.list(value)) (value[[1]] %||% "") else value, BITACORA_PRIORIDADES, "media")
}

# Rango numérico para ordenar sin replicar la tabla en el cliente. 0 = crítica.
.bit_prioridad_rank <- function(prioridad) {
  idx <- match(.bit_prioridad(prioridad), BITACORA_PRIORIDADES)
  as.integer(idx - 1L)
}

# --- Recordatorios -----------------------------------------------------------

# Un recordatorio es relativo al hito, nunca absoluto: mover la fecha del hito
# mueve sus avisos sin que haya que reescribirlos. El offset va en minutos con
# signo (negativo = antes), acotado a un año para que un import no programe algo
# a diez siglos vista.
.bit_recordatorio <- function(x = list()) {
  if (is.null(x) || !is.list(x)) x <- list()
  id <- .bit_texto(x$id, 80L)
  if (!nzchar(id)) id <- .bit_id("rem")
  estado <- calc_enum(x$state %||% x$estado, BITACORA_ESTADOS_RECORDATORIO, "programado")
  snoozed <- .bit_marca(x$snoozed_until %||% x$snoozedUntil)
  # Un recordatorio pospuesto sin marca de hasta cuándo no es pospuesto: es una
  # inconsistencia que dejaría el aviso invisible para siempre.
  if (identical(estado, "pospuesto") && !nzchar(snoozed)) estado <- "programado"
  creado <- .bit_marca(x$created_at %||% x$createdAt)
  if (!nzchar(creado)) creado <- .bit_now_iso()
  list(
    id = id,
    anchor = calc_enum(x$anchor %||% x$ancla, BITACORA_ANCLAS_RECORDATORIO, "start"),
    offset_minutes = calc_int(x$offset_minutes %||% x$offsetMinutes %||% x$offset, 0L,
                              min = -525600L, max = 525600L),
    channel = calc_enum(x$channel %||% x$canal, BITACORA_CANALES_RECORDATORIO, "in_app"),
    state = estado,
    snoozed_until = snoozed,
    created_at = creado
  )
}

.bit_recordatorios <- function(value, max_items = BITACORA_MAX_RECORDATORIOS) {
  if (is.null(value) || !is.list(value) || !length(value)) return(list())
  out <- lapply(value, .bit_recordatorio)
  # Dedup por (ancla, offset): dos avisos idénticos sobre el mismo hito son un
  # error de UI, no una intención.
  claves <- vapply(out, function(r) paste0(r$anchor, "|", r$offset_minutes), character(1))
  out <- out[!duplicated(claves)]
  utils::head(out, max_items)
}

# --- Recurrencia -------------------------------------------------------------

.bit_recurrencia <- function(x) {
  if (is.null(x) || !is.list(x) || !length(x)) return(NULL)
  regla <- calc_enum(x$rule %||% x$regla, BITACORA_REGLAS_RECURRENCIA, "")
  if (!nzchar(regla)) return(NULL)
  excepciones <- if (is.null(x$exceptions)) list() else x$exceptions
  if (is.list(excepciones)) excepciones <- unlist(excepciones, recursive = TRUE, use.names = FALSE)
  cumplidas <- if (is.null(x$done_instances)) list() else x$done_instances
  if (is.list(cumplidas)) cumplidas <- unlist(cumplidas, recursive = TRUE, use.names = FALSE)
  normalizar_fechas <- function(v) {
    if (!length(v)) return(list())
    out <- vapply(as.character(v), .bit_fecha, character(1), USE.NAMES = FALSE)
    as.list(utils::head(sort(unique(out[nzchar(out)])), BITACORA_MAX_EXCEPCIONES_RECURRENCIA))
  }
  list(
    rule = regla,
    interval = calc_int(x$interval %||% x$intervalo, 1L, min = 1L, max = 365L),
    until = .bit_fecha(x$until %||% x$hasta),
    count = calc_int(x$count %||% x$repeticiones, 0L, min = 0L, max = 366L),
    exceptions = normalizar_fechas(excepciones),
    done_instances = normalizar_fechas(cumplidas)
  )
}

# --- Vínculos ----------------------------------------------------------------

# El identificador de un nodo de canvas necesita saber en qué lienzo vive; por
# eso se transporta como "<canvas_id>/<node_id>". El resto son ids planos.
.bit_vinculo <- function(x) {
  if (is.null(x) || !is.list(x)) return(NULL)
  tipo <- calc_enum(x$target_type %||% x$targetType %||% x$tipo, BITACORA_TIPOS_DESTINO, "")
  destino <- .bit_texto(x$target_id %||% x$targetId %||% x$destino, 160L)
  if (!nzchar(tipo) || !nzchar(destino)) return(NULL)
  list(
    target_type = tipo,
    target_id = destino,
    relation = calc_enum(x$relation %||% x$relacion, BITACORA_RELACIONES, "menciona")
  )
}

# `origen` permite descartar el auto-enlace: una entidad que se apunta a sí
# misma no aporta información y ensucia el índice de retroenlaces.
.bit_vinculos <- function(value, origen = NULL, max_items = BITACORA_MAX_VINCULOS) {
  if (is.null(value) || !is.list(value) || !length(value)) return(list())
  out <- lapply(value, .bit_vinculo)
  out <- Filter(Negate(is.null), out)
  if (!is.null(origen) && nzchar(origen)) {
    out <- Filter(function(v) !identical(paste0(v$target_type, ":", v$target_id), origen), out)
  }
  claves <- vapply(out, function(v) paste0(v$target_type, "|", v$target_id, "|", v$relation), character(1))
  out <- out[!duplicated(claves)]
  utils::head(out, max_items)
}

.bit_vinculo_clave <- function(tipo, id) {
  paste0(tipo, ":", id)
}

# --- Forma temporal ----------------------------------------------------------

# `temporal_kind` es derivado salvo cuando hay recurrencia declarada: la
# recurrencia es una intención del usuario, el resto se lee de las fechas.
.bit_temporal_kind <- function(start_date, end_date, recurrence = NULL) {
  if (!is.null(recurrence) && is.list(recurrence) && length(recurrence)) return("recurrente")
  inicio <- .bit_fecha(start_date)
  fin <- .bit_fecha(end_date)
  if (!nzchar(inicio) && !nzchar(fin)) return("punto")
  if (!nzchar(fin) || identical(inicio, fin)) return("punto")
  if (!nzchar(inicio)) return("punto")
  if (fin > inicio) "rango" else "punto"
}

# --- Dependencias ------------------------------------------------------------

# --- Normalización de una tarea del cronograma -------------------------------

# Punto ÚNICO donde una tarea de `plan_trabajo` adquiere los campos del ADR
# 0047. Se invoca desde `.plan_rebuild_derived`, por donde pasan todas las
# mutaciones (crear, editar, borrar, importar), así que ninguna ruta puede
# producir una tarea a medias.
#
# Deliberadamente NO toca `id`, `activity`, `kind`, `status` ni las fechas: esos
# son del esquema original y sus dueños son los normalizadores de
# router_plan_trabajo.R. Acá solo se agregan campos, nunca se pisan los viejos.
#
# Depende de `bitacora_fases.R` para resolver la fase. Es la única dependencia
# hacia afuera de este archivo, y existe porque dejar `fase` vacía convertiría a
# cada consumidor en un derivador: el .pulso quedaría con tareas sin clasificar
# y la UI tendría que adivinar, que es justo lo que el ADR 0047 vino a eliminar.
.bit_normalizar_tarea <- function(t) {
  if (is.null(t) || !is.list(t)) return(t)
  id <- calc_str(t$id, "")
  recurrencia <- .bit_recurrencia(t$recurrence)
  t$priority <- .bit_prioridad(t$priority)
  t$priority_rank <- .bit_prioridad_rank(t$priority)
  t$tags <- .bit_etiquetas(t$tags)
  t$reminders <- .bit_recordatorios(t$reminders)
  t$links <- .bit_vinculos(t$links, origen = .bit_vinculo_clave("tarea", id))
  t$blocked_by <- .bit_bloqueadores(t$blocked_by, propio = id)
  t$archived_at <- .bit_marca(t$archived_at)
  t$kind_manual <- calc_bool(t$kind_manual, FALSE)
  t$fase_manual <- calc_bool(t$fase_manual, FALSE)
  t$fase <- .bit_fase_de_tarea(t)
  t$recurrence <- recurrencia
  t$temporal_kind <- .bit_temporal_kind(t$start_date, t$end_date, recurrencia)
  t
}

.bit_bloqueadores <- function(value, propio = "", max_items = BITACORA_MAX_BLOQUEADORES) {
  if (is.null(value)) return(list())
  if (is.list(value)) value <- unlist(value, recursive = TRUE, use.names = FALSE)
  if (!length(value)) return(list())
  out <- vapply(as.character(value), .bit_texto, character(1), max_chars = 160L, USE.NAMES = FALSE)
  out <- unique(out[nzchar(out)])
  # Una tarea nunca se bloquea a sí misma: es el ciclo de longitud 1 y se corta
  # acá, antes de que la detección de ciclos tenga que verlo.
  if (nzchar(propio)) out <- out[out != propio]
  as.list(utils::head(out, max_items))
}
