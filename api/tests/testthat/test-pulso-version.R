# Qué exige un .pulso a quien lo abre y el candado de guardado (ADR 0122 §7).
#
# El riesgo que fija este archivo: una app que no entiende el Planner abre un
# .pulso que lo trae, edita los lugares viejos y lo guarda; lo editado no llega
# a donde se lee. La app que no conoce lo que el .pulso exige NO lo pisa; la
# que lo guardó sin saber queda delatada al volver a abrirlo.

source("setup-load-all.R")

.pv_proyecto_con_planner <- function(dir) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = parent.frame())
  s <- session_get(sid)
  s["calc_muestra_estudio"] <- list(list(macro_familia = "encuesta_estudiantes", titulo = "Estudio de prueba"))
  .session_env[[sid]] <- s
  .planner_declarar(sid, "estudio", list(nombre = "Estudio de prueba"), 0L)
  ruta <- file.path(dir, "proyecto.pulso")
  build_pulso(sid, ruta, project_name = "proyecto")
  ruta
}

.pv_manifest <- function(ruta) {
  dir <- withr::local_tempdir()
  zip::unzip(ruta, files = "manifest.json", exdir = dir)
  jsonlite::fromJSON(file.path(dir, "manifest.json"), simplifyVector = TRUE)
}

# Reescribe el manifest como lo dejaría otra app.
.pv_reescribir_manifest <- function(ruta, cambio) {
  dir <- withr::local_tempdir()
  zip::unzip(ruta, exdir = dir)
  m <- jsonlite::fromJSON(file.path(dir, "manifest.json"), simplifyVector = FALSE)
  m <- cambio(m)
  writeLines(jsonlite::toJSON(m, auto_unbox = TRUE, null = "null"), file.path(dir, "manifest.json"))
  unlink(ruta)
  zip::zip(ruta, files = list.files(dir, recursive = TRUE, all.files = TRUE), root = dir)
  invisible(ruta)
}

.pv_abrir <- function(ruta, envir = parent.frame()) {
  ld <- suppressMessages(load_pulso(ruta))
  withr::defer(session_delete(ld$session_id), envir = envir)
  ld$session_id
}

test_that("guardar con el Planner declarado deja dicho qué exige el .pulso", {
  ruta <- .pv_proyecto_con_planner(withr::local_tempdir())
  m <- .pv_manifest(ruta)
  expect_equal(m$requiere$planner, "planner/v1")
  expect_equal(m$min_app_version, PULSO_VERSION_PLANNER)
})

test_that("un proyecto sin Planner declarado no exige nada (un .pulso de antes sigue igual)", {
  sid <- session_create()
  withr::defer(session_delete(sid))
  s <- session_get(sid)
  s["calc_muestra_estudio"] <- list(list(macro_familia = "encuesta_estudiantes"))
  .session_env[[sid]] <- s
  ruta <- file.path(withr::local_tempdir(), "sin.pulso")
  build_pulso(sid, ruta, project_name = "sin")
  m <- .pv_manifest(ruta)
  expect_null(m$requiere)
  expect_null(m$min_app_version)
  sid2 <- .pv_abrir(ruta)
  expect_null(.pulso_version_de_sesion(sid2))
})

test_that("una app que no conoce el Planner abre el .pulso pero no lo pisa", {
  ruta <- .pv_proyecto_con_planner(withr::local_tempdir())
  huella <- unname(tools::md5sum(ruta))
  # Se simula la app vieja: no conoce ninguna capacidad.
  testthat::local_mocked_bindings(.pulso_capacidades_conocidas = function() c(otra = "otra/v1"))
  sid <- .pv_abrir(ruta)
  expect_true(.pulso_version_de_sesion(sid)$bloqueado)
  err <- tryCatch(build_pulso(sid, ruta, project_name = "proyecto"), error = identity)
  expect_s3_class(err, "api_error")
  expect_equal(err$code, "E_PULSO_VERSION_SUPERIOR")
  expect_equal(err$status, 409)
  # Ni en su sitio ni con «guardar como»: el archivo queda intacto y no nace otro.
  otra <- file.path(dirname(ruta), "copia.pulso")
  expect_error(build_pulso(sid, otra, project_name = "copia"), class = "api_error")
  expect_identical(unname(tools::md5sum(ruta)), huella)
  expect_false(file.exists(otra))
})

test_that("un schema más nuevo del Planner también pone el candado", {
  ruta <- .pv_proyecto_con_planner(withr::local_tempdir())
  .pv_reescribir_manifest(ruta, function(m) { m$requiere$planner <- "planner/v2"; m })
  sid <- .pv_abrir(ruta)
  expect_equal(unlist(.pulso_version_de_sesion(sid)$faltan), "planner")
  expect_error(build_pulso(sid, ruta, project_name = "proyecto"), class = "api_error")
})

test_that("si lo guardó una app que no conoce el Planner, el Planner lo avisa y no bloquea", {
  ruta <- .pv_proyecto_con_planner(withr::local_tempdir())
  # Así queda el manifest después de que lo guarde una app anterior: sin `requiere`.
  .pv_reescribir_manifest(ruta, function(m) { m$requiere <- NULL; m$min_app_version <- NULL; m$app_version <- "0.9.6"; m })
  sid <- .pv_abrir(ruta)
  estado <- .pulso_version_de_sesion(sid)
  expect_false(estado$bloqueado)
  avisos <- .planner_payload(session_get(sid))$avisos
  expect_true("guardado_por_app_anterior" %in% vapply(avisos, `[[`, "", "codigo"))
  expect_true(any(grepl("0.9.6", vapply(avisos, `[[`, "", "mensaje"), fixed = TRUE)))
  # Guardar con esta app vuelve a dejar dicho qué exige y apaga el aviso.
  build_pulso(sid, ruta, project_name = "proyecto")
  expect_equal(.pv_manifest(ruta)$requiere$planner, "planner/v1")
  expect_null(.pulso_version_de_sesion(.pv_abrir(ruta)))
})

# --- Caminos de escritura fuera de «guardar» (revisión de guardian-contratos) --

.pv_router <- function() {
  testthat::skip_if_not_installed("plumber")
  mount_proyecto(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
}

test_that("duplicar con overwrite no borra el destino si el candado se niega", {
  dir <- withr::local_tempdir()
  ruta <- .pv_proyecto_con_planner(dir)
  destino <- file.path(dir, "destino.pulso")
  file.copy(ruta, destino)
  huella <- unname(tools::md5sum(destino))
  testthat::local_mocked_bindings(.pulso_capacidades_conocidas = function() c(otra = "otra/v1"))
  sid <- .pv_abrir(ruta)
  r <- .cmail_fx_call(.pv_router(), sid, "POST", "/api/project/duplicate",
                      .cmail_fx_json(list(target_path = destino, overwrite = TRUE, open_copy = FALSE)))
  expect_identical(r$status, 409L)
  expect_identical(unlist(r$body$error$code), "E_PULSO_VERSION_SUPERIOR")
  expect_true(file.exists(destino))
  expect_identical(unname(tools::md5sum(destino)), huella)
})

test_that("el candado sigue a la sesión al abrir «en el lugar», y no se pega al siguiente proyecto", {
  dir <- withr::local_tempdir()
  ruta <- .pv_proyecto_con_planner(dir)
  actual <- session_create()
  withr::defer({ session_delete(actual); .pulso_version_olvidar(actual) })
  pr <- .pv_router()
  testthat::local_mocked_bindings(.pulso_capacidades_conocidas = function() c(otra = "otra/v1"))
  r <- .cmail_fx_call(pr, actual, "POST", "/api/project/open", .cmail_fx_json(list(path = ruta, in_place = TRUE)))
  expect_identical(r$status, 200L, info = substr(r$raw, 1, 300))
  expect_true(isTRUE(.pulso_version_de_sesion(actual)$bloqueado))
  expect_error(build_pulso(actual, ruta, project_name = "proyecto"), class = "api_error")

  # Abrir otro proyecto, sin exigencias, en la misma sesión: el candado se va.
  testthat::local_mocked_bindings(.pulso_capacidades_conocidas = function() PULSO_CAPACIDADES)
  sid_libre <- session_create()
  withr::defer(session_delete(sid_libre))
  libre <- file.path(dir, "libre.pulso")
  build_pulso(sid_libre, libre, project_name = "libre", allow_empty_overwrite = TRUE)
  r2 <- .cmail_fx_call(pr, actual, "POST", "/api/project/open", .cmail_fx_json(list(path = libre, in_place = TRUE)))
  expect_identical(r2$status, 200L)
  expect_null(.pulso_version_de_sesion(actual))
})

test_that("borrar la sesión borra su candado", {
  ruta <- .pv_proyecto_con_planner(withr::local_tempdir())
  testthat::local_mocked_bindings(.pulso_capacidades_conocidas = function() c(otra = "otra/v1"))
  ld <- suppressMessages(load_pulso(ruta))
  expect_false(is.null(.pulso_version_de_sesion(ld$session_id)))
  session_delete(ld$session_id)
  expect_null(.pulso_version_de_sesion(ld$session_id))
})
