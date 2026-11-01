# ADR 0121 F4 y ADR 0123 Q1, escritura: Cálculo de muestra declara en su clave
# propia el universo y las variables de su escenario. Sólo eso: las celdas se quedan en el diseño y
# ninguna cifra del tablero cambia por declarar. Y el ciclo se cierra: lo que se
# declara es lo que el tablero lee después.

source("setup-load-all.R")

.cmrep_sesion <- function(estado = list(), envir = parent.frame()) {
  sid <- session_create()
  withr::defer(session_delete(sid), envir = envir)
  s <- session_get(sid)
  for (k in names(estado)) s[k] <- list(estado[[k]])
  .session_env[[sid]] <- s
  sid
}

.cmrep_estado_hsvg <- function() list(
  calc_muestra_estudio = list(macro_familia = "encuesta_estudiantes",
                              workspace = list(frame_mode = "opinion_universitaria")),
  monitoreo_config = list(aulas_universitarias = list(
    eje_cuota = "facultad",
    plan = list(list(faculty = "DERECHO"), list(faculty = "LETRAS")),
    design_targets = list(schema = "monitoreo_aulas_design_targets_v1", facultades = list(
      list(facultad = "DERECHO", faculty_key = "derecho", cuota = 363, cuota_sexo = list(F = 190, M = 173), tau = 0.57),
      list(facultad = "LETRAS", faculty_key = "letras", cuota = 100, cuota_sexo = list(F = 60, M = 40), tau = 0.5)
    ))
  ))
)

test_that("sin metas en el escenario no hay nada que declarar", {
  sid <- .cmrep_sesion(list())
  expect_null(.cmrep_bloque(session_get(sid)))
})

test_that("el bloque lleva universo confirmado y variables, nunca celdas", {
  sid <- .cmrep_sesion(.cmrep_estado_hsvg())
  b <- .cmrep_bloque(session_get(sid))
  expect_identical(vapply(b$variables, `[[`, "", "clave"), c("facultad", "sexo"))
  expect_identical(b$universo$nivel, "universidad")
  expect_false(b$universo$inferido)
  expect_null(b$celdas)
  # Un universo mandado por quien declara reemplaza al deducido.
  b2 <- .cmrep_bloque(session_get(sid), list(nivel = "facultad", valor = "DERECHO", etiqueta = "Derecho"))
  expect_identical(b2$universo$valor, "DERECHO")
  expect_false(b2$universo$inferido)
})

test_that("declarar escribe en la clave de Cálculo, no en el Planner (ADR 0123 Q1)", {
  sid <- .cmrep_sesion(.cmrep_estado_hsvg())
  planner_antes <- session_get(sid)$planner
  b <- .cmrep_declarar(sid)
  s <- session_get(sid)
  expect_identical(vapply(s$calc_muestra_representatividad$variables, `[[`, "", "clave"), c("facultad", "sexo"))
  expect_match(s$calc_muestra_representatividad$declarado_en, "^\\d{4}-\\d{2}-\\d{2}T")
  expect_identical(s$planner, planner_antes)
  expect_null(.mrpl_de_sesion(sid))
})

test_that("Monitoreo lee la foto de Cálculo antes que el Planner, sin cambiar cifras", {
  sid <- .cmrep_sesion(.cmrep_estado_hsvg())
  cfg <- session_get(sid)$monitoreo_config$aulas_universitarias
  antes <- monitoreo_aulas_representatividad_declarada(cfg)
  # Dos fuentes distintas: Cálculo declara la universidad; el Planner, DERECHO.
  cfg$design_targets$representatividad <- list(
    schema = "representatividad_v1", declarado_en = "2026-11-01T15:00:00Z",
    universo = list(nivel = "universidad", etiqueta = "Universidad"),
    variables = .cmrep_bloque(session_get(sid))$variables)
  cfg$representatividad_planner <- list(universo = list(nivel = "facultad", valor = "DERECHO"),
                                        variables = list(list(clave = "facultad")), poblacion = "principal",
                                        declarado_en = "2026-10-31")
  r <- monitoreo_aulas_representatividad_declarada(cfg)
  expect_identical(r$origen, "calculo")
  expect_identical(r$universo$nivel, "universidad")
  # El universo distinto del Planner se dice; no se reemplaza en silencio.
  expect_identical(vapply(r$discrepancias, `[[`, "", "tipo"), "universo_distinto_planner")
  expect_match(r$discrepancias[[1]]$texto, "El Planner declaraba DERECHO; manda Cálculo de muestra", fixed = TRUE)
  expect_equal(sum(vapply(r$celdas, `[[`, 0, "cuota")), sum(vapply(antes$celdas, `[[`, 0, "cuota")))
  # Sin el dato de Cálculo en la foto, el Planner es el respaldo.
  cfg$design_targets$representatividad <- NULL
  expect_identical(monitoreo_aulas_representatividad_declarada(cfg)$origen, "planner")
})

test_that("una variable de Cálculo sin celdas se dice con su origen", {
  sid <- .cmrep_sesion(.cmrep_estado_hsvg())
  cfg <- session_get(sid)$monitoreo_config$aulas_universitarias
  cfg$design_targets$representatividad <- list(universo = list(nivel = "universidad"), declarado_en = "x",
    variables = list(list(clave = "facultad"), list(clave = "sexo"), list(clave = "nivel")))
  r <- monitoreo_aulas_representatividad_declarada(cfg)
  d <- Filter(function(x) identical(x$tipo, "variable_sin_celdas"), r$discrepancias)
  expect_match(d[[1]]$texto, "Cálculo de muestra declara «nivel»", fixed = TRUE)
})

test_that("volver a declarar sale del escenario vigente, no de la foto ni del Planner", {
  estado <- .cmrep_estado_hsvg()
  estado$monitoreo_config$aulas_universitarias$design_targets$representatividad <- list(
    universo = list(nivel = "facultad", valor = "DERECHO"), variables = list(list(clave = "facultad")), declarado_en = "x")
  sid <- .cmrep_sesion(estado)
  b <- .cmrep_bloque(session_get(sid))
  expect_identical(vapply(b$variables, `[[`, "", "clave"), c("facultad", "sexo"))
  expect_identical(b$universo$nivel, "universidad")
})

test_that("sin universo deducible no se guarda una declaración a medias", {
  estado <- .cmrep_estado_hsvg()
  estado$monitoreo_config$aulas_universitarias$plan <- NULL
  estado$monitoreo_config$aulas_universitarias$eje_cuota <- "nivel"
  sid <- .cmrep_sesion(estado)
  err <- tryCatch(.cmrep_declarar(sid), error = identity)
  expect_equal(err$code, "E_CALC_MUESTRA_SIN_UNIVERSO")
  expect_null(session_get(sid)$calc_muestra_representatividad)
})

test_that("lo guardado dice si ya viaja en la foto de Monitoreo", {
  sid <- .cmrep_sesion(.cmrep_estado_hsvg())
  expect_true(is.na(.cmrep_en_la_foto(session_get(sid))))
  b <- .cmrep_declarar(sid)
  expect_false(.cmrep_en_la_foto(session_get(sid)))
  s <- session_get(sid)
  s$monitoreo_config$aulas_universitarias$design_targets$representatividad <- list(declarado_en = b$declarado_en)
  expect_true(.cmrep_en_la_foto(s))
  expect_true(.cmrep_sorteo_vigente(s))
  s$monitoreo_config$aulas_universitarias$selection_run_id <- "otro-sorteo"
  s$calc_muestra_representatividad$selection_run_id <- "run-1"
  expect_false(.cmrep_sorteo_vigente(s))
})

test_that("importar el plan lleva el universo de Cálculo en la foto design_targets", {
  sel <- list(selection = list(list(course_key = "CH 1", faculty = "DERECHO")))
  rep <- list(universo = list(nivel = "universidad"), variables = list(list(clave = "facultad")), declarado_en = "x")
  dt <- list(facultades = list(list(facultad = "DERECHO", cuota = 10)))
  local_mocked_bindings(.monitoreo_aulas_metas_diseno = function(...) dt)
  cfg <- monitoreo_aulas_from_calc(NULL, sel, NULL, list(), NULL, representatividad = rep)
  expect_identical(cfg$design_targets$representatividad$universo$nivel, "universidad")
  sin <- monitoreo_aulas_from_calc(NULL, sel, NULL, list(), NULL)
  expect_null(sin$design_targets$representatividad)
  # Declarada sobre otro sorteo: no viaja bajo el sello de éste.
  otra <- monitoreo_aulas_from_calc(NULL, c(sel, list(selection_run_id = "run-2")), NULL, list(), NULL,
                                    representatividad = c(rep, list(selection_run_id = "run-1")))
  expect_null(otra$design_targets$representatividad)
  misma <- monitoreo_aulas_from_calc(NULL, c(sel, list(selection_run_id = "run-2")), NULL, list(), NULL,
                                     representatividad = c(rep, list(selection_run_id = "run-2")))
  expect_identical(misma$design_targets$representatividad$universo$nivel, "universidad")
})

test_that("sin plan en la config, el universo se deduce de las facultades del diseño", {
  estado <- .cmrep_estado_hsvg()
  estado$monitoreo_config$aulas_universitarias$plan <- NULL
  sid <- .cmrep_sesion(estado)
  expect_identical(.cmrep_bloque(session_get(sid))$universo$nivel, "universidad")
})

test_that("con el eje en nivel no se deduce el universo de los niveles", {
  estado <- .cmrep_estado_hsvg()
  estado$monitoreo_config$aulas_universitarias$plan <- NULL
  estado$monitoreo_config$aulas_universitarias$eje_cuota <- "nivel"
  sid <- .cmrep_sesion(estado)
  expect_false(identical(.cmrep_bloque(session_get(sid))$universo$nivel, "universidad"))
})
