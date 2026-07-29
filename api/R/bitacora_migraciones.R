# =============================================================================
# Migración versionada del estado de Bitácora (ADR 0047)
# =============================================================================
#
# El .pulso no tenía versionado POR MÓDULO: `build_pulso` serializa state.rds
# completo y `load_pulso` lo restaura tal cual. Eso alcanzaba mientras el
# esquema de un módulo no cambiaba; el ADR 0047 agrega campos a `plan_trabajo`
# y a `diseno_estudio_bitacora`, así que hace falta un salto explícito.
#
# El precedente es `.xlsform_forms_seed_from_legacy()`: una función idempotente
# invocada desde `load_pulso`, que deja el estado en la forma nueva sin destruir
# la vieja. Acá se generaliza a saltos numerados para que agregar una versión 3
# sea agregar una función, no reescribir la migración.
#
# INVARIANTES (las fija test-bitacora-migraciones.R):
#   1. Idempotencia — migrar dos veces produce exactamente lo mismo que una.
#   2. Aditividad — ningún campo preexistente se pierde ni cambia de valor.
#   3. Totalidad — tras migrar, no quedan tareas ni entradas sin los campos
#      nuevos, aunque el objeto de origen fuese `NULL` o estuviera a medias.

# Versión de destino de cada sub-esquema del módulo que DECLARA versión.
#
# `plan_trabajo` la declara en su campo `schema` y por eso se migra por saltos.
# Las entradas de bitácora no: `s$diseno_estudio_bitacora` es una lista pelada
# sin lugar donde escribir una versión. Para ellas la migración es incondicional
# y es idempotente por construcción, porque todo lo que aplica son los
# normalizadores puros de bitacora_modelo.R. Se re-normalizan en cada apertura;
# con el tope de entradas del módulo el costo es despreciable, y a cambio no hay
# un campo de versión que pueda mentir.
BITACORA_ESQUEMAS <- c(plan = 3L)

# Lee la versión declarada en un `schema` con forma "<prefijo>_v<N>". Un objeto
# sin `schema` legible es v1 por definición: es lo que había antes de que el
# campo existiera.
.bit_version_de <- function(objeto, prefijo) {
  if (is.null(objeto) || !is.list(objeto)) return(1L)
  declarado <- calc_str(objeto$schema, "")
  m <- regmatches(declarado, regexec(paste0("^", prefijo, "_v([0-9]+)$"), declarado))[[1]]
  if (length(m) != 2L) return(1L)
  v <- suppressWarnings(as.integer(m[2]))
  if (is.na(v) || v < 1L) 1L else v
}

# Aplica los saltos que falten, uno por uno. `saltos` se indexa por la versión
# de ORIGEN del salto: saltos[["1"]] lleva de v1 a v2.
.bit_migrar_por_saltos <- function(objeto, prefijo, destino, saltos) {
  if (is.null(objeto) || !is.list(objeto)) return(objeto)
  v <- .bit_version_de(objeto, prefijo)
  while (v < destino) {
    salto <- saltos[[as.character(v)]]
    if (is.null(salto)) break
    objeto <- salto(objeto)
    v <- v + 1L
    objeto$schema <- paste0(prefijo, "_v", v)
  }
  objeto
}

# --- Salto plan v1 → v2 ------------------------------------------------------
#
# Agrega los campos del ADR 0047 a cada tarea. `fase` queda vacía a propósito:
# la deriva desde `sync_targets` la hace bitacora_fases.R, que es su dueño y
# llega en la fase siguiente. Acá solo se garantiza que el campo exista, para
# que ningún consumidor tenga que preguntarse si está.
.bit_salto_plan_1_2 <- function(plan) {
  plan$tasks <- lapply(plan$tasks %||% list(), .bit_normalizar_tarea)
  plan
}

# Salto 2 -> 3: se retira la fase «Diseño».
#
# El cronograma se construye DESDE la bitácora, así que una fase que apunta al
# módulo donde el usuario ya está parado no declara nada. Las tareas que la
# tenían no se descartan ni se quedan sin clasificar —eso dejaría el cronograma
# con huecos y con filas que el compositor no sabe dónde poner—: pasan a Campo,
# que es donde arranca lo que se planifica de verdad.
#
# `fase_manual` se respeta igual que en cualquier otra edición: si el usuario
# había fijado la fase a mano, la reasignación la deja fijada en el destino
# nuevo en vez de volver a abrirla a la adivinanza.
.bit_salto_plan_2_3 <- function(plan) {
  plan$tasks <- lapply(plan$tasks %||% list(), function(t) {
    if (!is.list(t)) return(t)
    if (identical(calc_str(t$fase, ""), "diseno")) t$fase <- BITACORA_FASE_FALLBACK
    .bit_normalizar_tarea(t)
  })
  plan
}

# --- Entradas: normalización incondicional -----------------------------------
#
# Sin campo de versión donde apoyarse, la garantía la da la idempotencia de los
# normalizadores: aplicar esto sobre una entrada ya migrada la deja idéntica.
.bit_migrar_entradas <- function(entradas) {
  lapply(entradas %||% list(), function(e) {
    if (!is.list(e)) return(e)
    e$revisions <- .bit_revisiones(e$revisions)
    e$archived_at <- .bit_marca(e$archived_at)
    e$links <- .bit_vinculos(e$links, origen = .bit_vinculo_clave("entrada", calc_str(e$id, "")))
    e
  })
}

# Tope de historial por entrada. Diez revisiones cubren la vida útil de una nota
# operativa; más que eso es un log, y el .pulso no es el lugar para un log.
BITACORA_MAX_REVISIONES <- 10L

.bit_revision <- function(x) {
  if (is.null(x) || !is.list(x)) return(NULL)
  marca <- .bit_marca(x$revised_at %||% x$revisedAt)
  if (!nzchar(marca)) return(NULL)
  list(
    revised_at = marca,
    title = .bit_texto(x$title, 120L),
    body = .bit_texto(x$body, 1600L),
    tone = calc_str(x$tone, "nota"),
    module_id = calc_str(x$module_id %||% x$moduleId, "diseno-estudio")
  )
}

.bit_revisiones <- function(value, max_items = BITACORA_MAX_REVISIONES) {
  if (is.null(value) || !is.list(value) || !length(value)) return(list())
  out <- Filter(Negate(is.null), lapply(value, .bit_revision))
  # Más reciente primero: la UI muestra "qué decía antes" en ese orden y el
  # recorte por tope debe descartar lo más viejo, no lo último editado.
  orden <- order(vapply(out, function(r) r$revised_at, character(1)), decreasing = TRUE)
  utils::head(out[orden], max_items)
}

# --- Entrada única -----------------------------------------------------------

# Migra el estado de Bitácora dentro de una sesión. Idempotente: se puede
# invocar en cada `load_pulso` y también defensivamente al construir el payload,
# porque una sesión efímera creada antes de este cambio también necesita migrar.
#
# NO llama a `session_set`: recibe y devuelve el objeto de sesión para que el
# llamador decida cuándo persistir. Así `load_pulso` puede migrar antes de
# instalar la sesión, sin marcar el proyecto como sucio por el solo hecho de
# abrirlo.
.bitacora_migrar_estado <- function(s) {
  if (is.null(s) || !is.list(s)) return(s)

  plan <- s$plan_trabajo
  if (is.list(plan)) {
    s$plan_trabajo <- .bit_migrar_por_saltos(
      plan, "plan_trabajo", BITACORA_ESQUEMAS[["plan"]],
      list("1" = .bit_salto_plan_1_2, "2" = .bit_salto_plan_2_3)
    )
  }

  entradas <- s$diseno_estudio_bitacora
  if (is.list(entradas) && length(entradas)) {
    s$diseno_estudio_bitacora <- .bit_migrar_entradas(entradas)
  }

  s
}
