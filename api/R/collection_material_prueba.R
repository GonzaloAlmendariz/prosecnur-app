# collection_material_prueba.R — la ficha que no va a un aula.
#
# Antes de repartir 1.512 hojas hay que escanear una y comprobar tres cosas: que
# el QR abre, que la respuesta llega con su `collectorID` y que al terminar
# redirige. Y durante la capacitación el equipo necesita una ficha con la que
# practicar sin que sus respuestas entren al estudio.
#
# Las dos cosas son la misma pieza: una ficha con el MISMO enlace del operativo
# —misma URL base, mismo asset, mismo `returnUrl`— pero con un identificador que
# el analista escribe a mano: `PRUEBA_2026`, `CAPACITACION`, `prueba_interna`.
#
# **No entra al plan, pero SÍ queda registrada.** Las fichas de prueba viven en
# `collection_state$pruebas`, una lista hermana de `plan` y `deployment` —nunca
# dentro de `plan$units`, que es lo que movería el conteo de unidades, el handoff
# a Monitoreo y las cuotas por facultad—.
#
# Se guardan porque el equipo necesita volver a ellas: cuál era el enlace de
# `CAPACITACION`, poder abrirlo otra vez, reimprimir el PDF que se repartió en el
# taller. Sin registro había que acordarse del código y regenerarla a ciegas.
#
# Del PDF se guarda el enlace, no el archivo: un binario en el estado lo prohíbe
# el contrato (`.cc_security_problems`) y los entregables no viven dentro del
# `.pulso`. Regenerarlo es determinista —mismo enlace, misma plantilla—, así que
# el histórico no pierde nada.
#
# Vive aparte de `collection_materials_job.R` porque su entrada no es una
# instancia persistida sino un código suelto, y mezclarlas obligaría a que ese
# archivo distinga a cada paso entre lo que se guarda y lo que no.

# Un identificador que viaja dentro de una URL y se imprime como titulo. Se
# limita a lo que no obliga a escapar nada ni se lee mal en papel: letras sin
# tilde, digitos, guion y guion bajo. El punto y el espacio quedan fuera a
# proposito -«prueba 1» y «prueba_1» serian dos colectores distintos en Kobo y
# nadie lo notaria-.
.cmp_codigo_ok <- function(codigo) {
  grepl("^[A-Za-z0-9][A-Za-z0-9_-]{0,47}$", codigo)
}

#' Normaliza y valida el código de una ficha de prueba.
#'
#' @param codigo lo que el analista escribió.
#' @return el código sin espacios alrededor.
#' @keywords internal
.cmp_codigo <- function(codigo) {
  codigo <- trimws(as.character(codigo %||% "")[1])
  if (is.na(codigo) || !nzchar(codigo)) {
    stop_api(
      422, "E_COLLECTION_PRUEBA_CODIGO",
      "La ficha de prueba necesita un código: PRUEBA_2026, CAPACITACION, prueba_interna."
    )
  }
  if (!.cmp_codigo_ok(codigo)) {
    stop_api(
      422, "E_COLLECTION_PRUEBA_CODIGO",
      paste(
        "El código sólo admite letras sin tilde, dígitos, guion y guion bajo,",
        "hasta 48 caracteres. Va dentro del enlace y se imprime como título."
      )
    )
  }
  codigo
}

#' Ficha de prueba: una hoja con el enlace real y un código inventado.
#'
#' Reusa el target del deployment vigente —el mismo adapter, la misma URL base,
#' el mismo `prefill_field` y el mismo `returnUrl`—, así que el enlace que sale es
#' el que va a correr en campo salvo por el identificador. Ésa es toda la gracia:
#' una prueba que use otro enlace no prueba nada.
#'
#' @param sid sesión.
#' @param codigo identificador a inyectar (`PRUEBA_2026`, `CAPACITACION`…).
#' @param etiqueta rótulo opcional bajo el QR; por defecto, el propio código.
#' @return snapshot `collection_material_render_snapshot/v1` listo para
#'   `collection_material_render_job()`.
#' @export
collection_material_prueba_snapshot <- function(sid, codigo, etiqueta = NULL) {
  codigo <- .cmp_codigo(codigo)
  session <- session_get(sid)
  state <- .collection_current(session)
  deployment <- state$deployment
  if (!is.list(deployment) || !is.list(deployment$target)) {
    stop_api(
      409, "E_COLLECTION_DEPLOYMENT_REQUIRED",
      "Configura los accesos antes de generar una ficha de prueba: sin ellos no hay enlace que probar."
    )
  }
  etiqueta <- trimws(as.character(etiqueta %||% "")[1])
  if (is.na(etiqueta) || !nzchar(etiqueta)) etiqueta <- codigo

  # El enlace se CLONA de una unidad real y sólo se le cambia el valor del
  # identificador. No se vuelve a pedir al adapter con el target guardado,
  # porque ese target no conserva la URL base: `.collection_deployment_normalize()`
  # la poda —vive dentro de cada `access_ref`, y duplicarla sería una segunda
  # fuente de verdad—, así que reconstruirlo desde ahí daría un enlace vacío.
  #
  # Clonar además es lo que hace que la prueba PRUEBE: mismo servidor, misma
  # ruta, mismo nombre de parámetro de prefill, mismo `returnUrl`. Una ficha de
  # ensayo que use un enlace parecido pero no idéntico no demuestra nada del que
  # va a campo.
  modelo <- NULL
  for (b in deployment$bindings %||% list()) {
    if (is.list(b) && identical(b$status, "ready") &&
        identical(b$access_kind, "parameterized_link") && length(b$prefill %||% list())) {
      modelo <- b
      break
    }
  }
  if (is.null(modelo)) {
    stop_api(
      422, "E_COLLECTION_PRUEBA_SIN_ENLACE",
      paste(
        "Ninguna unidad del plan tiene todavía un enlace personalizado del que copiar.",
        "Prepara los accesos en Accesos y vuelve a intentarlo."
      )
    )
  }
  campo <- names(modelo$prefill)[[1]]
  prefill <- list()
  prefill[[campo]] <- codigo
  binding <- list(
    access_id = paste0("access-prueba-", tolower(codigo)),
    logical_collector_id = codigo,
    unit_id = paste0("prueba-", tolower(codigo)),
    provider_collector_id = modelo$provider_collector_id,
    recipient_id = NULL,
    operator_id = NULL,
    access_kind = "parameterized_link",
    access_ref = modelo$access_ref,
    prefill = prefill,
    status = "ready"
  )
  unidad <- list(
    unit_id = binding$unit_id,
    label = etiqueta,
    role = "prueba",
    group = "Prueba",
    # «Por confirmar» y no vacio: una prueba no pertenece a ninguna facultad,
    # pero el vacio caia a raya de escritura mientras docente/aula/horario
    # decian «Por confirmar» — la misma hoja con dos tratos (lo noto Gonzalo,
    # 2026-09-01). Se iguala AQUI y no en el fallback del render: alla el ""
    # tambien alimenta la carpeta del bundle y el subtitulo del afiche.
    faculty = "Por confirmar",
    dimensions = list(legacy_ref = codigo, classroom_id = codigo)
  )
  plan_prueba <- list(
    schema = COLLECTION_PLAN_SCHEMA,
    plan_id = paste0("plan-prueba-", tolower(codigo)),
    adapter = state$plan$adapter %||% list(id = "aulas_v1", version = 1L),
    unit_type = state$plan$unit_type %||% "classroom_course_schedule",
    units = list(unidad),
    revision = 1L
  )
  deployment_prueba <- list(
    deployment_id = paste0("dep-prueba-", tolower(codigo)),
    target = deployment$target,
    bindings = list(binding),
    # `operational` y no lo que traiga el deployment: `.collection_access_url()`
    # devuelve "" con sensibilidad `restricted`, y una ficha de prueba sin enlace
    # no prueba nada. Es deliberado y acotado a esta hoja, que no se reparte.
    sensitivity = list(access_urls = "operational"),
    status = "prepared"
  )

  template <- .cm_material_template(state)
  fp <- function(x) collection_fingerprint(x)
  instancia <- list(
    schema = COLLECTION_MATERIAL_INSTANCE_SCHEMA,
    instance_id = paste0("material-prueba-", tolower(codigo)),
    template_ref = list(
      template_id = template$template_id,
      revision = as.integer(template$revision),
      sha256 = template$template_sha256
    ),
    deployment_id = deployment_prueba$deployment_id,
    deployment_fingerprint = fp(deployment_prueba),
    access_fingerprint = fp(list(binding)),
    instance_fingerprint = fp(list(codigo, template$template_sha256)),
    unit_refs = list(unidad$unit_id),
    access_refs = list(binding$access_id),
    locale = "es-PE",
    status = "ready",
    sensitivity = "operational",
    warnings = list()
  )
  snapshot <- list(
    schema = "collection_material_render_snapshot/v1",
    template = template,
    instance = instancia,
    project = .cm_project_snapshot(session),
    plan = plan_prueba,
    deployment = deployment_prueba,
    resolved_access = list(),
    brand_assets = .cm_brand_assets_map(session, .cm_template_brand_ids(template))
  )

  # El nombre del archivo dice que es una prueba. Una hoja indistinguible de las
  # 1.512 puede colarse en el reparto, y entonces alguien aplica un aula entera
  # contra un colector que no existe en el plan.
  snapshot$output_filename <- .export_filename(sid, paste0("ficha_prueba_", tolower(codigo)), "pdf")
  snapshot$audience <- "internal"
  snapshot
}

#' Arranca el job que renderiza la ficha de prueba.
#'
#' @inheritParams collection_material_prueba_snapshot
#' @return `list(ok, job_id, kind, codigo)`; el PDF llega por el job.
#' @export
collection_material_prueba_start <- function(sid, codigo, etiqueta = NULL) {
  snapshot <- collection_material_prueba_snapshot(sid, codigo, etiqueta)
  # Se registra ANTES de renderizar: si el job falla, la ficha igual queda en el
  # histórico con su enlace, que es lo que el equipo necesita recordar. Al revés
  # —registrar al terminar— un fallo de render borraría el rastro de un enlace
  # que quizá ya se repartió.
  .cmp_registrar(sid, snapshot)
  snapshot_path <- job_save_rds(sid, "collection_material_prueba_snapshot", snapshot)
  job_id <- job_submit(
    sid = sid,
    kind = "recopiladores.materials_prueba",
    func = collection_material_render_job,
    args = list(snapshot_path = snapshot_path, format = "pdf", page = 1L),
    result_filename = snapshot$output_filename
  )
  list(
    ok = TRUE, job_id = job_id, kind = "recopiladores.materials_prueba",
    codigo = snapshot$instance$unit_refs[[1]]
  )
}

# ---------------------------------------------------------------------------
# Histórico
# ---------------------------------------------------------------------------

.cmp_pruebas <- function(state) {
  pruebas <- state$pruebas
  if (!is.list(pruebas)) return(list())
  Filter(function(x) is.list(x) && nzchar(as.character(x$codigo %||% "")[1]), pruebas)
}

#' Registra —o actualiza— una ficha de prueba en el histórico.
#'
#' El enlace se guarda **tal como se generó**, no se recalcula al leerlo: una
#' hoja ya impresa lleva el QR que llevaba, y si mañana cambian los accesos, la
#' del taller de la semana pasada sigue apuntando a donde apuntaba. Por eso viaja
#' también el `deployment_fingerprint`: es lo que permite avisar de que una ficha
#' quedó de un despliegue anterior, en vez de enseñar un enlace muerto como si
#' estuviera vigente.
#'
#' Un mismo código se ACTUALIZA en su sitio en vez de duplicarse: `CAPACITACION`
#' generada tres veces es una entrada, no tres.
#'
#' @param sid sesión.
#' @param snapshot el de `collection_material_prueba_snapshot()`.
#' @param creada_en marca de tiempo ISO; por defecto, ahora.
#' @return el estado nuevo, ya persistido.
#' @keywords internal
.cmp_registrar <- function(sid, snapshot, creada_en = NULL) {
  state <- .collection_current(session_get(sid))
  binding <- snapshot$deployment$bindings[[1]]
  codigo <- as.character(binding$logical_collector_id)[[1]]
  entrada <- list(
    codigo = codigo,
    etiqueta = as.character(snapshot$plan$units[[1]]$label %||% codigo)[[1]],
    enlace = .collection_access_url(
      binding, "operational",
      snapshot$deployment$target$provider %||% "kobo",
      snapshot$deployment$target$return_url
    ),
    creada_en = as.character(creada_en %||% format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")),
    deployment_fingerprint = .collection_deployment_fingerprint(state$deployment)
  )
  pruebas <- .cmp_pruebas(state)
  codigos <- vapply(pruebas, function(x) as.character(x$codigo)[[1]], character(1))
  hit <- which(codigos == codigo)
  if (length(hit)) pruebas[[hit[[1]]]] <- entrada else pruebas <- c(pruebas, list(entrada))

  next_state <- state
  next_state$pruebas <- pruebas
  next_state$state_revision <- as.integer(state$state_revision) + 1L
  .collection_store(sid, next_state)
  next_state
}

#' El histórico de fichas de prueba, con su vigencia resuelta.
#'
#' @param sid sesión.
#' @return `list(ok, pruebas)`; cada una con `vigente`, que dice si su enlace
#'   sigue siendo el del despliegue actual.
#' @export
collection_prueba_historico <- function(sid) {
  state <- .collection_current(session_get(sid))
  actual <- .collection_deployment_fingerprint(state$deployment)
  pruebas <- lapply(.cmp_pruebas(state), function(x) {
    # `vigente` se calcula al leer y no se guarda: es una relación entre la
    # ficha y el despliegue de HOY, y guardarla la dejaría mintiendo en cuanto
    # cambiaran los accesos sin que nadie tocara la ficha.
    x$vigente <- identical(as.character(x$deployment_fingerprint %||% ""), as.character(actual %||% ""))
    x
  })
  list(ok = TRUE, pruebas = pruebas, state_revision = state$state_revision)
}
