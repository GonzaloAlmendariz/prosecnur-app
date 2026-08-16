# Semilla de las decisiones de gobierno del proyecto sintetico canonico.
#
# El barrido del GOAL "la interfaz dice lo que el motor ya sabe" (2026-08-16)
# midio que tres fenomenos no existian en ningun corpus, asi que lo que la
# interfaz dice sobre ellos nunca se habia visto con datos:
#
#   - reglas de validacion apagadas, con su motivo;
#   - variables excluidas de la auditoria, con su motivo;
#   - un deployment de Recopiladores y entradas de bitacora.
#
# No son datos de cliente ni salen de anonimizar nada: se construyen sobre el
# XLSForm sintetico del propio audit_reference. Lo que aportan es que las
# superficies que narran esas decisiones se puedan mirar de verdad.
#
# Vive en archivo propio porque audit_reference.R ya pasa las mil lineas.

AUDIT_REFERENCE_GOBIERNO_AT <- "2026-08-16T12:00:00Z"

# --- Validacion --------------------------------------------------------------

#' Construye el plan de validacion de una base del proyecto sintetico
#'
#' Reproduce lo que hace `POST /api/validacion/v2/instrumento/plan` con los
#' valores por defecto. Devuelve `NULL` -sin romper el build- si el motor de
#' validacion no puede construirlo con este instrumento: la semilla es un
#' fixture, no un gate.
.audit_reference_plan_validacion <- function(sid, base_nombre, xlsform_path, data_path, data_ext) {
  tryCatch({
    inst <- leer_xlsform_limpieza(xlsform_path, verbose = FALSE)
    ctx <- read_validation_data_ast(path = data_path, ext = data_ext, instrumento = inst)
    op_config <- normalize_validation_operational_config(
      NULL,
      available_variables = names(ctx$principal %||% data.frame())
    )
    bundle <- build_validation_bundle(
      instrumento = inst,
      reglas_custom = list(),
      incluir = list(
        required = TRUE, other = TRUE, relevant = TRUE, constraint = TRUE,
        calculate = TRUE, choice_filter = TRUE,
        repeat_min1 = FALSE, tiempo_ventana = FALSE
      ),
      compatibility = validation_profile_for_base(base_nombre)
    )
    bundle <- validation_operational_append_rules(bundle, op_config)
    plan <- bundle$plan %||% compile_rules_to_plan(bundle$rules)
    resumen <- tryCatch(
      dplyr::arrange(dplyr::count(plan, `Tipo`, name = "n_reglas"), dplyr::desc(n_reglas)),
      error = function(e) NULL
    )
    list(
      plan_result = list(
        plan = plan, bundle = bundle, resumen = resumen,
        operational_config = op_config,
        secciones = inst$meta$section_map, meta = inst$meta
      ),
      operational_config = op_config,
      rules = bundle$rules %||% list()
    )
  }, error = function(e) NULL)
}

#' Dos reglas apagadas y dos variables excluidas, cada una con su motivo
#'
#' Los ids salen del plan recien construido: apagar un id inventado haria que
#' el informe mostrara el id crudo donde deberia ir el nombre de la regla, que
#' es justo el defecto que este fixture existe para poder ver.
.audit_reference_decisiones_validacion <- function(rules, variables_disponibles) {
  ids <- vapply(rules, function(r) as.character(r$id %||% ""), character(1))
  ids <- unique(ids[nzchar(ids)])
  desactivadas <- utils::head(ids, 2L)
  # Las variables que tocan las reglas apagadas: excluir justo esas dejaria las
  # dos listas del informe diciendo lo mismo, y una regla apagada sobre una
  # variable ya excluida es redundante -no es el caso que hay que poder ver-.
  tocadas <- unique(unlist(lapply(
    Filter(function(r) as.character(r$id %||% "") %in% desactivadas, rules),
    function(r) as.character(r$primary_var %||% r$variable %||% character(0))
  )))

  motivos_reglas <- list()
  textos <- c(
    "El equipo la revisa a mano en el consolidado: dispara sobre casos que el operador ya corrige en campo.",
    "Duplica un control del formulario; mantenerla activa contaba dos veces la misma inconsistencia."
  )
  for (i in seq_along(desactivadas)) {
    motivos_reglas[[desactivadas[[i]]]] <- list(
      motivo = textos[[min(i, length(textos))]],
      decidido_en = AUDIT_REFERENCE_GOBIERNO_AT
    )
  }

  candidatas <- setdiff(as.character(variables_disponibles %||% character(0)),
                        c("", NA_character_, tocadas))
  # Se prefieren columnas de plataforma: excluirlas es la decision real que
  # toma un equipo, y no depende de como se llamen las preguntas del piloto.
  preferidas <- intersect(c("_id", "_uuid", "_submission_time", "start", "end", "fecha"), candidatas)
  excluidas <- utils::head(c(preferidas, setdiff(candidatas, preferidas)), 2L)

  motivos_vars <- list()
  textos_vars <- c(
    "Metadato de plataforma: no describe a la persona encuestada y sus reglas no aportan al informe.",
    "Queda fuera del alcance acordado con el cliente para esta ola."
  )
  for (i in seq_along(excluidas)) {
    motivos_vars[[excluidas[[i]]]] <- list(
      motivo = textos_vars[[min(i, length(textos_vars))]],
      decidido_en = AUDIT_REFERENCE_GOBIERNO_AT
    )
  }

  list(
    reglas_desactivadas = as.character(desactivadas),
    reglas_desactivadas_motivo = motivos_reglas,
    variables_excluidas = as.character(excluidas),
    variables_excluidas_motivo = motivos_vars
  )
}

# --- Bitacora ----------------------------------------------------------------

#' Entradas de bitacora que cubren los tres tonos del modulo
.audit_reference_bitacora_semilla <- function() {
  list(
    list(
      module_id = "validacion",
      tone = "decision",
      title = "Se apagan dos reglas del plan",
      body = paste(
        "Una la revisa el equipo a mano en el consolidado y la otra duplicaba",
        "un control del formulario. Ambas quedan registradas con su motivo en",
        "el informe metodologico."
      ),
      tags = list("calidad", "plan")
    ),
    list(
      module_id = "carga",
      tone = "avance",
      title = "Base de la ola 2 incorporada",
      body = "Entra la segunda medicion del panel y queda emparejada con la ola 1.",
      tags = list("panel")
    ),
    list(
      module_id = "monitoreo",
      tone = "riesgo",
      title = "Cobertura por debajo de la meta en una UMP",
      body = paste(
        "El avance de la zona sur va detras del resto. Se acuerda reforzar",
        "con dos encuestadores antes del corte."
      ),
      tags = list("campo", "cobertura")
    )
  )
}

# --- Recopiladores -----------------------------------------------------------

#' Deployment que cubre todas las unidades del plan de recoleccion
#'
#' El .pulso sintetico traia `plan` y `migration` pero `deployment` en NULL, asi
#' que la entrega a campo y su cobertura nunca se veian con datos. Se arma un
#' binding por unidad y se pasa por `collection_deployment_prepare()`, que es lo
#' que hace la app: fabricarlo a mano se saltaria el validador del contrato.
.audit_reference_deployment <- function(sid) {
  st <- tryCatch(collection_state_get(sid), error = function(e) NULL)
  plan <- (st %||% list())$state$plan %||% (st %||% list())$plan
  if (!is.list(plan) || !length(plan$units %||% list())) return(invisible(FALSE))

  bindings <- lapply(seq_along(plan$units), function(i) {
    unit_id <- as.character(plan$units[[i]]$unit_id %||% "")
    list(
      access_id = sprintf("acc-%03d", i),
      logical_collector_id = "col-audit-01",
      unit_id = unit_id,
      access_kind = "parameterized_link",
      status = "ready",
      target = list(url = sprintf("https://ejemplo.local/encuesta?u=%s", unit_id))
    )
  })

  deployment <- list(
    schema = COLLECTION_DEPLOYMENT_SCHEMA,
    deployment_id = "dep-audit-01",
    plan_id = as.character(plan$plan_id %||% ""),
    plan_fingerprint = as.character(plan$input_fingerprint %||% ""),
    status = "draft",
    accesses = bindings
  )

  revision <- as.integer((st %||% list())$state$revision %||% (st %||% list())$state_revision %||% 1L)
  ok <- tryCatch({
    collection_deployment_put(sid, deployment, revision)
    st2 <- collection_state_get(sid)
    rev2 <- as.integer((st2 %||% list())$state$revision %||% (st2 %||% list())$state_revision %||% revision + 1L)
    collection_deployment_prepare(sid, rev2)
    TRUE
  }, error = function(e) {
    message("[audit-reference] deployment no sembrado: ", conditionMessage(e))
    FALSE
  })
  invisible(ok)
}

# --- Punto de entrada --------------------------------------------------------

#' Siembra las decisiones de gobierno sobre una sesion del audit_reference
#'
#' Se llama al final del seed, cuando las bases ya existen. Cada bloque falla
#' hacia adelante: si el motor de validacion no puede construir el plan con
#' este instrumento, el proyecto se genera igual sin esa parte.
audit_reference_seed_gobierno <- function(sid, bases) {
  for (b in bases) {
    armado <- .audit_reference_plan_validacion(
      sid, b$nombre, b$xlsform_path, b$data_path, b$data_ext
    )
    if (is.null(armado)) next
    validacion_scope_set(sid, b$nombre, "plan_result", armado$plan_result)
    validacion_scope_set(sid, b$nombre, "operational_config", armado$operational_config)

    decisiones <- .audit_reference_decisiones_validacion(armado$rules, b$variables)
    for (k in names(decisiones)) validacion_scope_set(sid, b$nombre, k, decisiones[[k]])
  }

  .audit_reference_deployment(sid)

  for (entry in .audit_reference_bitacora_semilla()) {
    tryCatch(.diseno_bitacora_upsert(sid, entry), error = function(e) NULL)
  }

  invisible(TRUE)
}
