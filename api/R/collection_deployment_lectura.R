# Lo que el payload de Recopiladores deriva del deployment al LEERLO (H21,
# seguimiento del contrato).
#
# Un deployment guardado antes de H21 no trae `adapter_id` ni la configuracion
# del target (`deployment_active`, `base_access_url`, ...). Accesos los necesita
# para rehidratar el formulario. Se derivan aqui, sobre la copia que va al
# cliente; NUNCA se escriben en `collection_state` ni en el .pulso. La huella
# del despliegue excluye ambos (ver `.collection_deployment_fingerprint`), asi
# que aunque el cliente los devuelva en un PUT/prepare no hay `deployment_changed`.
#
# `deployment_derived_fields` (nivel payload, fuera de `state`) dice que campos
# salieron derivados para que el front no los presente como observados.

.collection_lectura_texto <- function(value) {
  if (!is.character(value) || length(value) != 1L || is.na(value)) return("")
  trimws(value)
}

# El adapter que armo el deployment, cuando no lo trae persistido.
#
# Orden de evidencia, de la mas fuerte a la mas debil:
#   1. `remote_ref$source == "legacy_local"`: lo sembro la migracion legacy con
#      el adapter del plan (`aulas_v1`), no un adapter de proveedor.
#   2. `capability_preflight$adapter_id`: la vista previa de cada adapter deja
#      su preflight dentro del deployment, y el front guarda esa vista previa
#      tal cual. Distingue un `aulas_v1` con target Kobo de un `kobo_existing_v1`,
#      que por proveedor serian indistinguibles.
#   3. Por proveedor: kobo -> `kobo_existing_v1`; surveymonkey -> recipient si
#      algun binding es `recipient_link`, si no weblink. Es la misma regla que
#      el respaldo del front (AccessSection.tsx, `adapterDelDeployment`).
# Sin evidencia devuelve "" y no inventa nada.
.collection_deployment_adapter_derivado <- function(deployment, plan) {
  target <- if (is.list(deployment$target)) deployment$target else list()
  remote_ref <- if (is.list(target$remote_ref)) target$remote_ref else list()
  if (identical(.collection_lectura_texto(remote_ref$source), "legacy_local")) {
    return(.collection_lectura_texto((plan %||% list())$adapter$id))
  }
  preflight_adapter <- .collection_lectura_texto(
    if (is.list(deployment$capability_preflight)) deployment$capability_preflight$adapter_id else NULL
  )
  if (preflight_adapter %in% .collection_adapter_ids) return(preflight_adapter)
  provider <- tolower(.collection_lectura_texto(target$provider))
  if (identical(provider, "kobo")) return("kobo_existing_v1")
  if (identical(provider, "surveymonkey")) {
    kinds <- vapply(deployment$bindings %||% list(), function(binding) {
      if (is.list(binding)) .collection_lectura_texto(binding$access_kind) else ""
    }, character(1))
    return(if ("recipient_link" %in% kinds) {
      "surveymonkey_recipient_existing_v1"
    } else {
      "surveymonkey_weblink_existing_v1"
    })
  }
  ""
}

# `deployment_active = TRUE` para un deployment Kobo preparado que no lo guardo.
#
# `collection_deployment_prepare` NO corre el preflight: solo exige cobertura
# completa de bindings `ready`. La garantia vive en la vista previa del adapter
# `kobo_existing_v1`: su preflight `local_generation` bloquea con
# `kobo_deployment_active_not_observed` si `deployment_active` no es TRUE, y un
# preflight bloqueado deja los bindings en `blocked`. Por eso `status ==
# "prepared"` solo no prueba nada (un PUT a mano o una siembra legacy tambien
# llegan a `prepared`); lo que lo prueba es el preflight Kobo guardado en el
# deployment y sin bloqueos.
.collection_deployment_activo_derivado <- function(deployment, adapter_id) {
  target <- if (is.list(deployment$target)) deployment$target else list()
  if (!is.null(target$deployment_active)) return(FALSE)
  if (!identical(.collection_lectura_texto(deployment$status), "prepared")) return(FALSE)
  if (!identical(adapter_id, "kobo_existing_v1")) return(FALSE)
  remote_ref <- if (is.list(target$remote_ref)) target$remote_ref else list()
  if (identical(.collection_lectura_texto(remote_ref$source), "legacy_local")) return(FALSE)
  preflight <- deployment$capability_preflight
  is.list(preflight) &&
    identical(.collection_lectura_texto(preflight$adapter_id), "kobo_existing_v1") &&
    !length(preflight$blocking %||% list())
}

# Devuelve el deployment con sus derivados y la lista de campos derivados.
.collection_deployment_con_derivados <- function(deployment, plan) {
  if (!is.list(deployment) || !length(deployment)) {
    return(list(deployment = deployment, derived = character(0)))
  }
  derived <- character(0)
  adapter_id <- .collection_lectura_texto(deployment$adapter_id)
  if (!nzchar(adapter_id)) {
    adapter_id <- .collection_deployment_adapter_derivado(deployment, plan)
    if (nzchar(adapter_id)) {
      deployment$adapter_id <- adapter_id
      derived <- c(derived, "adapter_id")
    }
  }
  if (.collection_deployment_activo_derivado(deployment, adapter_id)) {
    deployment$target$deployment_active <- TRUE
    derived <- c(derived, "target.deployment_active")
  }
  list(deployment = deployment, derived = derived)
}

# `handoff` sin recibo. En el estado vive como entrada `NULL` (la siembra legacy
# y `prepare` la escriben asi), y `serializer_unboxed_json` convierte un `NULL`
# dentro de una lista en `{}`: el cliente recibia un objeto vacio donde no hay
# recibo, y si lo devolvia en un PUT se persistia como `list()`. En la SALIDA se
# omite la clave; en la ENTRADA un `{}` vale lo mismo que ausente. La huella ya
# excluia `handoff`, asi que ninguno de los dos cambia `deployment_fingerprint`.
#
# En la entrada (`solo_objeto_vacio = TRUE`) solo se normaliza el `{}` a la
# entrada `NULL` que el estado ya usa, para no cambiar la forma persistida (y con
# ella el no-op de un `prepare` repetido sobre un estado guardado antes).
.collection_deployment_handoff_vacio_fuera <- function(deployment, solo_objeto_vacio = FALSE) {
  if (!is.list(deployment) || !("handoff" %in% names(deployment))) return(deployment)
  handoff <- deployment$handoff
  if (isTRUE(solo_objeto_vacio)) {
    if (is.list(handoff) && !length(handoff)) deployment["handoff"] <- list(NULL)
    return(deployment)
  }
  if (is.null(handoff) || (is.list(handoff) && !length(handoff))) {
    deployment <- deployment[setdiff(names(deployment), "handoff")]
  }
  deployment
}

# Todo payload de collection_state que sale al cliente pasa por aqui: recibos
# con `file_available` (H23) y deployment con sus derivados. Opera sobre la
# copia; el estado de la sesion no se toca.
.collection_payload_de_lectura <- function(payload, session) {
  payload <- .collection_receipts_con_disponibilidad(payload, session)
  plan <- if (is.list(payload$state)) payload$state$plan else payload$plan
  deployment <- if (is.list(payload$state)) payload$state$deployment else payload$deployment
  out <- .collection_deployment_con_derivados(deployment, plan)
  salida <- .collection_deployment_handoff_vacio_fuera(out$deployment)
  if (is.list(salida) && length(salida)) {
    if (is.list(payload$state)) payload$state$deployment <- salida
    if (!is.null(payload$deployment)) payload$deployment <- salida
  }
  payload$deployment_derived_fields <- as.list(out$derived)
  payload
}
