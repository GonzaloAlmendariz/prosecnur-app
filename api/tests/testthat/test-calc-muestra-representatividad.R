# ADR 0121 F4, escritura: Cálculo de muestra declara en el Planner el universo y
# las variables de su escenario. Sólo eso: las celdas se quedan en el diseño y
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

test_that("declarar escribe en el Planner y el tablero lo lee sin cambiar cifras", {
  sid <- .cmrep_sesion(.cmrep_estado_hsvg())
  cfg <- session_get(sid)$monitoreo_config$aulas_universitarias
  antes <- monitoreo_aulas_representatividad_declarada(cfg)
  .planner_declarar_representatividad(sid, "aulas", "principal", .cmrep_bloque(session_get(sid)), 0L)

  declarado <- .mrpl_de_sesion(sid)
  expect_identical(vapply(declarado$variables, `[[`, "", "clave"), c("facultad", "sexo"))
  cfg$representatividad_planner <- declarado
  despues <- monitoreo_aulas_representatividad_declarada(cfg)
  expect_identical(despues$origen, "planner")
  expect_false(despues$universo$inferido)
  expect_length(despues$discrepancias, 0L)
  expect_identical(lapply(despues$celdas, `[[`, "valores"), lapply(antes$celdas, `[[`, "valores"))
  expect_equal(sum(vapply(despues$celdas, `[[`, 0, "cuota")), sum(vapply(antes$celdas, `[[`, 0, "cuota")))
})

test_that("con la revisión vencida el Planner rechaza y no escribe", {
  sid <- .cmrep_sesion(.cmrep_estado_hsvg())
  .planner_declarar_representatividad(sid, "aulas", "principal", .cmrep_bloque(session_get(sid)), 0L)
  err <- tryCatch(.planner_declarar_representatividad(sid, "aulas", "principal",
                                                      .cmrep_bloque(session_get(sid)), 0L),
                  error = identity)
  expect_equal(err$code, "E_PLANNER_DESACTUALIZADO")
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
