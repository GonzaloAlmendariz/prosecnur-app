# Contratos de dominio de Recopiladores (ADR 0046, unidad 4 del plan).
#
# Dos cosas se prueban acá y son distintas: que los tres perfiles del gate
# (aulas, acreditación, establecimientos) validen, y que los validadores
# efectivamente RECHACEN lo que deben. Un validador que dice "ok" a todo pasa la
# primera mitad sin servir para nada.

leer_fixture <- function(profile, kind) {
  path <- collection_fixture_path(profile, kind)
  expect_true(nzchar(path) && file.exists(path),
              info = sprintf("fixture ausente: %s/%s", profile, kind))
  jsonlite::fromJSON(path, simplifyVector = FALSE)
}

PERFILES <- c("aulas", "acreditacion", "establecimientos")

test_that("los tres perfiles del gate tienen plan y deployment validos", {
  for (perfil in PERFILES) {
    plan <- leer_fixture(perfil, "plan")
    dep <- leer_fixture(perfil, "deployment")

    res_plan <- collection_plan_validate(plan)
    expect_true(
      res_plan$ok,
      info = sprintf("plan de %s: %s", perfil,
                     paste(collection_contract_problem_lines(res_plan), collapse = " | "))
    )

    res_dep <- collection_deployment_validate(dep, plan)
    expect_true(
      res_dep$ok,
      info = sprintf("deployment de %s: %s", perfil,
                     paste(collection_contract_problem_lines(res_dep), collapse = " | "))
    )
  }
})

test_that("los perfiles ejercitan capabilities distintas y no son el mismo fixture con otro nombre", {
  # Si los tres fueran Kobo con parameterized_link, el gate no probaría que el
  # contrato aguanta las diferencias reales entre proveedores.
  kinds <- lapply(PERFILES, function(p) {
    dep <- leer_fixture(p, "deployment")
    unique(vapply(dep$bindings, function(b) b$access_kind, character(1)))
  })
  todos <- unlist(kinds)
  expect_true("parameterized_link" %in% todos)
  expect_true("provider_collector" %in% todos)
  expect_true("recipient_link" %in% todos)
  expect_true("manual_handoff" %in% todos)

  providers <- vapply(PERFILES, function(p) leer_fixture(p, "deployment")$target$provider, character(1))
  expect_true(all(c("kobo", "surveymonkey") %in% providers))
})

test_that("ningun fixture declara remote_write habilitado", {
  # ADR 0046 regla 3: `remote_write=disabled_v1` aplica a todos los adapters.
  for (perfil in PERFILES) {
    rw <- leer_fixture(perfil, "deployment")$capabilities$remote_write
    expect_false(isTRUE(rw$observed), info = perfil)
    expect_identical(rw$source, "disabled_v1", info = perfil)
  }
})

test_that("el plan rechaza schema, fingerprint y revision malos", {
  plan <- leer_fixture("aulas", "plan")

  malo <- plan; malo$schema <- "collection_plan/v2"
  expect_false(collection_plan_validate(malo)$ok)

  malo <- plan; malo$input_fingerprint <- "abc"
  res <- collection_plan_validate(malo)
  expect_false(res$ok)
  expect_true(any(vapply(res$problems, function(p) p$code == "bad_fingerprint", logical(1))))

  malo <- plan; malo$revision <- 0
  expect_false(collection_plan_validate(malo)$ok)

  malo <- plan; malo$source_ref <- NULL
  expect_false(collection_plan_validate(malo)$ok)
})

test_that("el plan rechaza unit_id duplicado", {
  plan <- leer_fixture("aulas", "plan")
  plan$units[[2]]$unit_id <- plan$units[[1]]$unit_id
  res <- collection_plan_validate(plan)
  expect_false(res$ok)
  expect_true(any(vapply(res$problems, function(p) p$code == "duplicate_unit_id", logical(1))))
})

test_that("el sha256 del instrumento va sin prefijo y el fingerprint con el", {
  plan <- leer_fixture("aulas", "plan")
  # Confundir las dos formas es el error facil: uno se compara con otro sha y el
  # otro identifica un archivo local.
  plan$instrument_ref$sha256 <- paste0("sha256:", plan$instrument_ref$sha256)
  res <- collection_plan_validate(plan)
  expect_false(res$ok)
  expect_true(any(vapply(res$problems, function(p) p$code == "bad_sha256", logical(1))))
})

test_that("una identidad reciclada entre slots se rechaza", {
  # Es la regla 1 del ADR y el bug original: `collector_id` significaba a veces
  # un canal remoto y a veces una unidad curso-horario.
  dep <- leer_fixture("aulas", "deployment")
  dep$bindings[[1]]$provider_collector_id <- dep$bindings[[1]]$unit_id
  res <- collection_deployment_validate(dep)
  expect_false(res$ok)
  problemas <- res$problems[vapply(res$problems, function(p) p$code == "identity_reused", logical(1))]
  expect_length(problemas, 1)
  expect_match(problemas[[1]]$detail, "identidades separadas")
})

test_that("el deployment exige integridad referencial contra su plan", {
  plan <- leer_fixture("aulas", "plan")
  dep <- leer_fixture("aulas", "deployment")

  otro <- dep; otro$plan_id <- "plan-que-no-es"
  res <- collection_deployment_validate(otro, plan)
  expect_false(res$ok)
  expect_true(any(vapply(res$problems, function(p) p$code == "plan_mismatch", logical(1))))

  huerfano <- dep; huerfano$bindings[[1]]$unit_id <- "unit-inexistente"
  res <- collection_deployment_validate(huerfano, plan)
  expect_false(res$ok)
  expect_true(any(vapply(res$problems, function(p) p$code == "unknown_unit", logical(1))))

  # Sin plan de referencia no se puede comprobar y no se debe inventar.
  expect_true(collection_deployment_validate(huerfano)$ok)
})

test_that("un parameterized_link sin prefill se rechaza", {
  dep <- leer_fixture("aulas", "deployment")
  dep$bindings[[1]]$prefill <- list()
  res <- collection_deployment_validate(dep)
  expect_false(res$ok)
  expect_true(any(vapply(res$problems, function(p) p$code == "missing_prefill", logical(1))))
})

test_that("un recipient_link sin recipient_id se rechaza", {
  # ADR 0046 regla 4: los links de recipient nunca se fabrican localmente.
  dep <- leer_fixture("acreditacion", "deployment")
  idx <- which(vapply(dep$bindings, function(b) identical(b$access_kind, "recipient_link"), logical(1)))
  expect_length(idx, 1)
  dep$bindings[[idx]]$recipient_id <- NULL
  res <- collection_deployment_validate(dep)
  expect_false(res$ok)
  expect_true(any(vapply(res$problems, function(p) p$code == "missing_recipient", logical(1))))
})

test_that("un secreto en el target se rechaza", {
  # ADR 0005: los secretos viven fuera del .pulso. El deployment referencia el
  # perfil de conexion, nunca la credencial.
  dep <- leer_fixture("aulas", "deployment")
  dep$target$token <- "kobo-token-de-verdad"
  res <- collection_deployment_validate(dep)
  expect_false(res$ok)
  expect_true(any(vapply(res$problems, function(p) p$code == "secret_in_state", logical(1))))
})

test_that("handed_off sin recibo se rechaza y con recibo pasa", {
  dep <- leer_fixture("acreditacion", "deployment")
  expect_identical(dep$status, "handed_off")
  expect_true(collection_deployment_validate(dep)$ok)

  sin_recibo <- dep; sin_recibo$handoff <- NULL
  res <- collection_deployment_validate(sin_recibo)
  expect_false(res$ok)
  expect_true(any(vapply(res$problems, function(p) p$code == "missing_handoff_receipt", logical(1))))
})

test_that("los estados permitidos son los cuatro del ADR", {
  expect_setequal(COLLECTION_DEPLOYMENT_STATUSES, c("draft", "prepared", "handed_off", "stale"))
  dep <- leer_fixture("aulas", "deployment")
  dep$status <- "listo"
  res <- collection_deployment_validate(dep)
  expect_false(res$ok)
  expect_true(any(vapply(res$problems, function(p) p$code == "bad_status", logical(1))))
})

test_that("un access_id duplicado se rechaza", {
  dep <- leer_fixture("aulas", "deployment")
  dep$bindings[[2]]$access_id <- dep$bindings[[1]]$access_id
  res <- collection_deployment_validate(dep)
  expect_false(res$ok)
  expect_true(any(vapply(res$problems, function(p) p$code == "duplicate_access_id", logical(1))))
})

test_that("la sensibilidad de las URLs es obligatoria", {
  dep <- leer_fixture("aulas", "deployment")
  dep$sensitivity <- NULL
  res <- collection_deployment_validate(dep)
  expect_false(res$ok)
  expect_true(any(vapply(res$problems, function(p) p$code == "missing_sensitivity", logical(1))))
})

test_that("los validadores no lanzan ante basura", {
  # Son puros a proposito: el router de la unidad 5 traduce problemas a stop_api.
  expect_false(collection_plan_validate(NULL)$ok)
  expect_false(collection_plan_validate("texto")$ok)
  expect_false(collection_deployment_validate(list())$ok)
  expect_type(collection_contract_problem_lines(collection_plan_validate(NULL)), "character")
  expect_identical(collection_contract_problem_lines(list(ok = TRUE)), character(0))
})
