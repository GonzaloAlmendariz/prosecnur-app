# ADR 0121, fase F1: la representatividad del estudio traducida del contrato v1.
# Las dos formas reales: HSVG (universidad, facultad × sexo) y CCSS (una
# facultad, nivel sin sexo). La suma de las celdas tiene que dar la cuota que
# ya publica el tablero: F1 no cambia ninguna cifra.

.tar_hsvg <- function() list(
  eje_cuota = "facultad", agrupacion_operativa = "facultad",
  design_targets = list(schema = "monitoreo_aulas_design_targets_v1", facultades = list(
    list(facultad = "ARQUITECTURA Y URBANISMO", faculty_key = "arquitectura_y_urbanismo", cuota = 125,
         cuota_sexo = list(F = 85, M = 40), tau = 0.5461),
    list(facultad = "DERECHO", faculty_key = "derecho", cuota = 363, cuota_sexo = list(F = 190, M = 173), tau = 0.57)
  ))
)

.tar_ccss <- function() list(
  eje_cuota = "nivel", agrupacion_operativa = "carrera",
  design_targets = list(schema = "monitoreo_aulas_design_targets_v1", facultades = list(
    list(facultad = "6", faculty_key = "6", cuota = 119, tau = 0.5),
    list(facultad = "7", faculty_key = "7", cuota = 122, tau = 0.5)
  ))
)

test_that("HSVG: universidad, facultad × sexo, una celda por facultad y sexo con meta", {
  plan <- data.frame(faculty = c("DERECHO", "ARQUITECTURA Y URBANISMO", "DERECHO"))
  r <- monitoreo_aulas_representatividad_declarada(.tar_hsvg(), plan = plan)
  expect_identical(r$schema, "representatividad_v1")
  expect_identical(r$origen, "traducida_v1")
  expect_identical(vapply(r$variables, `[[`, "", "clave"), c("facultad", "sexo"))
  expect_identical(r$variables[[2]]$atribucion, "respuesta")
  expect_identical(r$universo$nivel, "universidad")
  expect_true(r$universo$inferido)
  expect_length(r$celdas, 4L)
  expect_identical(r$celdas[[1]]$valores, list(facultad = "ARQUITECTURA Y URBANISMO", sexo = "F"))
  # La suma de las celdas es la cuota del diseño: ninguna cifra cambia.
  expect_equal(sum(vapply(r$celdas, `[[`, 0, "cuota")), 125 + 363)
})

test_that("CCSS: una facultad, nivel sin sexo, con la población del padrón", {
  plan <- data.frame(faculty = rep("CIENCIAS SOCIALES", 3))
  r <- monitoreo_aulas_representatividad_declarada(.tar_ccss(), plan = plan, padron = list(personas = 1354))
  expect_identical(vapply(r$variables, `[[`, "", "clave"), "nivel")
  expect_identical(r$variables[[1]]$atribucion, "persona")
  expect_identical(r$universo$nivel, "facultad")
  expect_identical(r$universo$valor, "CIENCIAS SOCIALES")
  expect_equal(r$universo$poblacion, 1354)
  expect_identical(r$agrupacion_operativa, "carrera")
  expect_identical(lapply(r$celdas, `[[`, "valores"), list(list(nivel = "6"), list(nivel = "7")))
  expect_equal(sum(vapply(r$celdas, `[[`, 0, "cuota")), 241)
})

test_that("un bloque declarado por el diseño manda sobre la traducción", {
  cfg <- .tar_hsvg()
  cfg$design_targets$representatividad <- list(
    schema = "representatividad_v1",
    universo = list(nivel = "facultad", valor = "CIENCIAS SOCIALES"),
    variables = list(list(clave = "nivel"), list(clave = "sexo")),
    celdas = list(list(valores = list(nivel = "9", sexo = "F"), cuota = 30))
  )
  r <- monitoreo_aulas_representatividad_declarada(cfg)
  expect_identical(r$origen, "diseno")
  expect_identical(r$universo$valor, "CIENCIAS SOCIALES")
})

test_that("sin metas del diseño no hay representatividad; sin plan, el universo se declara desconocido", {
  expect_null(monitoreo_aulas_representatividad_declarada(list()))
  expect_null(monitoreo_aulas_representatividad_declarada(list(design_targets = list(facultades = list()))))
  r <- monitoreo_aulas_representatividad_declarada(.tar_ccss())
  expect_identical(r$universo$nivel, "")
  expect_match(r$universo$motivo, "Sin plan")
})
