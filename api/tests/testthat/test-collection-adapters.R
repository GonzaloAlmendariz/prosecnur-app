.collection_adapter_env <- new.env(parent = baseenv())
assign("%||%", function(a, b) if (is.null(a) || (length(a) == 1L && is.na(a))) b else a, envir = .collection_adapter_env)
sys.source(testthat::test_path("../../R/capture_url.R"), envir = .collection_adapter_env)
sys.source(testthat::test_path("../../R/surveymonkey_api.R"), envir = .collection_adapter_env)
sys.source(testthat::test_path("../../R/collection_adapters.R"), envir = .collection_adapter_env)

.collection_adapter_plan <- function() {
  list(
    schema = "collection_plan/v1",
    plan_id = "plan-fixture",
    input_fingerprint = paste0("sha256:", strrep("a", 64L)),
    unit_type = "establishment",
    units = list(
      list(unit_id = "unit-1", label = "Unidad 1", link_key = "opaque-1"),
      list(unit_id = "unit-2", label = "Unidad 2", link_key = "opaque-2")
    )
  )
}

test_that("registry V1 es exacto y expone toda la interface del ADR", {
  registry <- .collection_adapter_env$collection_adapter_registry()
  expected_ids <- c(
    "aulas_v1",
    "manual_links_v1",
    "kobo_existing_v1",
    "surveymonkey_weblink_existing_v1",
    "surveymonkey_recipient_existing_v1"
  )
  methods <- c(
    "supports", "normalize_plan", "inspect_target", "preview_deployment",
    "commit_deployment", "prepare_material_instances", "render_artifacts",
    "handoff_to_monitoring"
  )

  expect_identical(names(registry), expected_ids)
  for (adapter in registry) {
    expect_true(all(methods %in% names(adapter)), info = adapter$id)
    expect_true(all(vapply(adapter[methods], is.function, logical(1))), info = adapter$id)
  }
})

test_that("preflight separa dimensiones y remote_write esta deshabilitado sin excepciones", {
  allowed_support <- c("supported", "unsupported", "unknown")
  allowed_implementation <- c("available", "partial", "planned", "unavailable")
  allowed_policy <- c("allowed_v1", "allowed_explicit", "disabled_v1", "future")
  allowed_evidence <- c("observed", "declared", "current_code", "unknown")

  for (adapter_id in names(.collection_adapter_env$collection_adapter_registry())) {
    out <- .collection_adapter_env$collection_capability_preflight(adapter_id)
    expect_equal(out$schema, "collection_capability_preflight/v1")
    for (capability in out$capabilities) {
      expect_named(capability, c("provider_support", "implementation", "policy", "evidence"))
      expect_true(capability$provider_support %in% allowed_support)
      expect_true(capability$implementation %in% allowed_implementation)
      expect_true(capability$policy %in% allowed_policy)
      expect_true(capability$evidence %in% allowed_evidence)
    }
    expect_equal(out$capabilities$remote_write$implementation, "unavailable")
    expect_equal(out$capabilities$remote_write$policy, "disabled_v1")
    blocked <- .collection_adapter_env$collection_capability_preflight(adapter_id, "remote_write")
    expect_true(any(vapply(blocked$blocking, function(item) identical(item$code, "remote_write_disabled_v1"), logical(1))))
  }
})

test_that("preflight no confunde implementacion con readiness Kobo observado", {
  incomplete <- .collection_adapter_env$collection_capability_preflight(
    "kobo_existing_v1",
    "local_generation",
    list(base_access_url = "https://kf.example.test/#/forms/a1/landing")
  )
  codes <- vapply(incomplete$blocking, `[[`, character(1), "code")
  expect_true("capture_url_landing_kobo" %in% codes)
  expect_true("kobo_asset_survey_not_observed" %in% codes)
  expect_true("kobo_deployment_active_not_observed" %in% codes)
  expect_equal(incomplete$capabilities$local_generation$provider_support, "supported")
  expect_equal(incomplete$capabilities$local_generation$implementation, "available")

  ready <- .collection_adapter_env$collection_capability_preflight(
    "kobo_existing_v1",
    "local_generation",
    list(
      base_access_url = "https://ee.example.test/x/form",
      asset_type = "survey",
      deployment_active = TRUE
    )
  )
  expect_length(ready$blocking, 0L)
})

test_that("preflight Web Link exige type y Custom Variable observados", {
  incomplete <- .collection_adapter_env$collection_capability_preflight(
    "surveymonkey_weblink_existing_v1",
    "local_generation",
    list(base_access_url = "https://es.surveymonkey.com/r/shared")
  )
  codes <- vapply(incomplete$blocking, `[[`, character(1), "code")
  expect_true("surveymonkey_weblink_type_not_observed" %in% codes)
  expect_true("surveymonkey_custom_variable_not_observed" %in% codes)

  ready <- .collection_adapter_env$collection_capability_preflight(
    "surveymonkey_weblink_existing_v1",
    "local_generation",
    list(
      type = "weblink",
      base_access_url = "https://es.surveymonkey.com/r/shared",
      custom_variable = "unit_key",
      custom_variables = list("unit_key", "wave")
    )
  )
  expect_length(ready$blocking, 0L)
})

test_that("remote_read disponible requiere perfil o evidencia explicita", {
  blocked <- .collection_adapter_env$collection_capability_preflight(
    "kobo_existing_v1", "remote_read", list()
  )
  expect_true(any(vapply(
    blocked$blocking,
    function(item) identical(item$code, "remote_read_not_explicit"),
    logical(1)
  )))
  expect_equal(blocked$capabilities$remote_read$implementation, "available")
  expect_equal(blocked$capabilities$remote_read$policy, "allowed_explicit")

  with_profile <- .collection_adapter_env$collection_capability_preflight(
    "kobo_existing_v1",
    "remote_read",
    list(connection_ref = list(connection_profile_id = "profile-kobo"))
  )
  expect_length(with_profile$blocking, 0L)

  with_evidence <- .collection_adapter_env$collection_capability_preflight(
    "surveymonkey_weblink_existing_v1",
    "remote_read",
    list(remote_read_evidence = "observed")
  )
  expect_length(with_evidence$blocking, 0L)
})

test_that("Kobo existing genera d[] local sobre web form verificado", {
  adapter <- .collection_adapter_env$collection_adapter_get("kobo_existing_v1")
  inspected <- adapter$inspect_target(
    list(connection_profile_id = "profile-kobo", token = "must-not-leak"),
    list(
      asset_uid = "aSurvey",
      asset_type = "survey",
      deployment_active = TRUE,
      version_id = "v7",
      base_access_url = "https://ee.example.test/x/opaque-form",
      prefill_field = "collectorID"
    )
  )
  deployment <- adapter$preview_deployment(.collection_adapter_plan(), inspected)

  expect_true(inspected$ok)
  expect_null(inspected$connection_ref$token)
  expect_equal(deployment$status, "prepared")
  expect_true(all(vapply(deployment$bindings, function(binding) identical(binding$access_kind, "parameterized_link"), logical(1))))
  # El adapter declara base + personalizacion por separado; NO arma la URL. Si
  # tambien horneara el parametro en `access_ref`, `.collection_access_url()` lo
  # colgaria una segunda vez y el QR saldria con `d[collectorID]` duplicado.
  expect_equal(deployment$bindings[[1]]$access_ref, "https://ee.example.test/x/opaque-form")
  expect_equal(deployment$bindings[[1]]$prefill, list(collectorID = "opaque-1"))
  expect_false(grepl("opaque-1", deployment$bindings[[1]]$access_ref, fixed = TRUE))
  expect_equal(deployment$capabilities$remote_write, list(observed = FALSE, source = "disabled_v1"))
})

test_that("el preflight de un target ecoa return_url, no solo prefill_field", {
  # `.ca_target_ref()` es una whitelist manual: agregar un campo nuevo al
  # target (aca `return_url`, ver `.ca_preview_deployment()`) y olvidar
  # sumarlo a esta whitelist lo deja invisible para cualquier UI futura que
  # lea `inspect_target()$target` en vez de reconstruir el target a mano.
  adapter <- .collection_adapter_env$collection_adapter_get("kobo_existing_v1")
  inspected <- adapter$inspect_target(
    list(),
    list(
      asset_uid = "aSurvey", asset_type = "survey", deployment_active = TRUE,
      base_access_url = "https://ee.example.test/x/opaque-form",
      prefill_field = "collectorID", return_url = "https://acnur.example.test/gracias"
    )
  )
  expect_equal(inspected$target$prefill_field, "collectorID")
  expect_equal(inspected$target$return_url, "https://acnur.example.test/gracias")
})

test_that("sin prefill_field explicito, el campo por defecto es la ruta XPath del asset", {
  # El enlace real que Gonzalo confirmo en produccion usa `d[/<asset_uid>/collectorID]`,
  # no `d[collectorID]`. Con el asset conocido y SIN override, el motor tiene que
  # producir esa ruta por defecto -no el nombre pelado que algunos servidores
  # Enketo rechazan-.
  adapter <- .collection_adapter_env$collection_adapter_get("kobo_existing_v1")
  inspected <- adapter$inspect_target(list(), list(
    asset_uid = "aNNuP72AedZ886EoAUeV5o", asset_type = "survey", deployment_active = TRUE,
    base_access_url = "https://ee-eu.kobotoolbox.org/single/ccIcHAqm"
  ))
  deployment <- adapter$preview_deployment(.collection_adapter_plan(), inspected)

  expect_equal(names(deployment$bindings[[1]]$prefill), "/aNNuP72AedZ886EoAUeV5o/collectorID")
  # La composicion final de la URL (`.collection_access_url()`, que ademas
  # preserva la barra sin escapar) se verifica en test-collection-engine.R,
  # donde vive esa funcion.
})

test_that("prefill_field explicito sigue ganando aunque el asset_uid se conozca", {
  adapter <- .collection_adapter_env$collection_adapter_get("kobo_existing_v1")
  inspected <- adapter$inspect_target(list(), list(
    asset_uid = "aNNuP72AedZ886EoAUeV5o", asset_type = "survey", deployment_active = TRUE,
    base_access_url = "https://ee-eu.kobotoolbox.org/single/ccIcHAqm",
    prefill_field = "collectorID"
  ))
  deployment <- adapter$preview_deployment(.collection_adapter_plan(), inspected)

  expect_equal(names(deployment$bindings[[1]]$prefill), "collectorID")
})

test_that("Kobo bloquea landing administrativa y deployment inactivo", {
  adapter <- .collection_adapter_env$collection_adapter_get("kobo_existing_v1")
  inspected <- adapter$inspect_target(list(), list(
    asset_uid = "aSurvey",
    asset_type = "survey",
    deployment_active = FALSE,
    base_access_url = "https://kf.example.test/#/forms/aSurvey/landing"
  ))

  expect_false(inspected$ok)
  codes <- vapply(inspected$blocking, `[[`, character(1), "code")
  expect_true("capture_url_landing_kobo" %in% codes)
  expect_true("kobo_target_not_deployed" %in% codes)
})

test_that("SurveyMonkey Web Link exige variable declarada y nunca asume presencial", {
  adapter <- .collection_adapter_env$collection_adapter_get("surveymonkey_weblink_existing_v1")
  inspected <- adapter$inspect_target(list(), list(
    collector_id = "collector-web",
    type = "weblink",
    status = "open",
    base_access_url = "https://es.surveymonkey.com/r/shared",
    custom_variable = "unit_key"
  ))
  deployment <- adapter$preview_deployment(.collection_adapter_plan(), inspected)

  expect_true(inspected$ok)
  # Misma separacion que en Kobo: la Custom Variable viaja en `prefill`, no
  # pegada a la URL base.
  expect_equal(deployment$bindings[[1]]$access_ref, "https://es.surveymonkey.com/r/shared")
  expect_equal(deployment$bindings[[1]]$prefill, list(unit_key = "opaque-1"))
  expect_false(any(grepl("presencial", unlist(deployment, use.names = FALSE), ignore.case = TRUE)))
})

test_that("recipient adapter reutiliza links observados como refs opacas y no fabrica faltantes", {
  adapter <- .collection_adapter_env$collection_adapter_get("surveymonkey_recipient_existing_v1")
  target <- list(
    collector_id = "collector-sms",
    type = "sms",
    recipients = list(
      list(
        unit_id = "unit-1",
        recipient_id = "recipient-1",
        survey_link = "https://es.surveymonkey.com/r/native-sensitive"
      )
    )
  )
  deployment <- adapter$preview_deployment(.collection_adapter_plan(), target)

  expect_equal(deployment$bindings[[1]]$status, "ready")
  expect_equal(deployment$bindings[[1]]$access_ref, "surveymonkey:recipient-link:recipient-1")
  expect_false(grepl("https://", deployment$bindings[[1]]$access_ref, fixed = TRUE))
  expect_equal(deployment$bindings[[2]]$status, "missing")
  expect_null(deployment$bindings[[2]]$access_ref)
  expect_equal(deployment$sensitivity$access_urls, "sensitive")
})

test_that("manual links permanece offline y determinista", {
  adapter <- .collection_adapter_env$collection_adapter_get("manual_links_v1")
  plan <- .collection_adapter_plan()
  plan$units[[1]]$access_ref <- "https://field.example.test/u/1"
  plan$units[[2]]$access_ref <- "https://field.example.test/u/2"

  first <- adapter$preview_deployment(plan, list())
  second <- adapter$preview_deployment(plan, list())

  expect_identical(first, second)
  expect_equal(first$status, "prepared")
  expect_true(all(vapply(first$bindings, function(binding) identical(binding$access_kind, "manual_handoff"), logical(1))))
})

test_that("todos los commit V1 bloquean y ningun metodo referencia transporte mutante", {
  registry <- .collection_adapter_env$collection_adapter_registry()
  for (adapter in registry) {
    blocked <- adapter$commit_deployment(list(deployment_id = "preview"), confirmation = TRUE)
    expect_false(blocked$ok, info = adapter$id)
    expect_true(blocked$blocked, info = adapter$id)
    expect_equal(blocked$preflight$capabilities$remote_write$policy, "disabled_v1")

    method_text <- paste(vapply(
      adapter[c(
        "supports", "normalize_plan", "inspect_target", "preview_deployment",
        "commit_deployment", "prepare_material_instances", "render_artifacts",
        "handoff_to_monitoring"
      )],
      function(fun) paste(deparse(body(fun)), collapse = " "),
      character(1)
    ), collapse = " ")
    expect_false(grepl("POST|PATCH|DELETE|curl|_request_json", method_text, ignore.case = TRUE), info = adapter$id)
  }
})
