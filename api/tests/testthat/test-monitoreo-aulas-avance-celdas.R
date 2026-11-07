# ADR 0121, F2: el avance por celdas de las variables que declara el estudio.
# Sobre las copias reales se verificó que HSVG (facultad × sexo, 30 celdas) y
# CCSS (nivel) dan las mismas cifras que el bloque `avance_cuota` y que
# `quotas_sex_faculty`, celda por celda. Aquí se fija la mecánica con insumos
# chicos, incluida una combinación que el motor antes no podía expresar.

.tac_insumos <- function() {
  plan <- data.frame(
    faculty = c("DERECHO", "DERECHO", "LETRAS"),
    program = c("Derecho", "Derecho", "Filosofía"),
    stringsAsFactors = FALSE
  )
  # Seis respuestas: fila del plan, si cuenta y sexo.
  atr <- data.frame(fila = c(1L, 1L, 2L, 3L, 3L, NA), stringsAsFactors = FALSE)
  eje_atr <- list(
    clave = c("derecho", "derecho", "derecho", "letras", "letras", "sin_facultad"),
    cuenta = c(TRUE, TRUE, TRUE, TRUE, FALSE, FALSE)
  )
  sexo <- c("F", "M", "F", "F", "M", "")
  list(plan = plan, atr = atr, eje_atr = eje_atr, sexo = sexo)
}

.tac_cfg <- function(variables, celdas) list(
  eje_cuota = "facultad",
  design_targets = list(representatividad = list(
    schema = "representatividad_v1", universo = list(nivel = "universidad"),
    variables = variables, celdas = celdas
  ))
)

test_that("facultad × sexo: cada celda cuenta lo suyo y la brecha se suma celda a celda", {
  x <- .tac_insumos()
  cfg <- .tac_cfg(
    list(list(clave = "facultad"), list(clave = "sexo")),
    list(list(valores = list(facultad = "DERECHO", sexo = "F"), cuota = 3),
         list(valores = list(facultad = "DERECHO", sexo = "M"), cuota = 1),
         list(valores = list(facultad = "LETRAS", sexo = "F"), cuota = 1),
         list(valores = list(facultad = "LETRAS", sexo = "M"), cuota = 2))
  )
  r <- monitoreo_aulas_avance_por_celdas(cfg, monitoreo_aulas_eje(cfg), x$eje_atr, x$sexo, x$atr, x$plan)
  expect_identical(vapply(r$celdas, `[[`, 0L, "logradas"), c(2L, 1L, 1L, 0L))
  expect_identical(vapply(r$celdas, `[[`, 0, "brecha"), c(1, 0, 0, 2))
  derecho <- r$marginales$facultad[[1]]
  expect_identical(derecho$logradas, 3L)
  # Derecho lleva 3 de 4 y le falta 1 mujer: la brecha es 1, no 4 - 3 por casualidad.
  expect_identical(derecho$brecha, 1)
  letras <- r$marginales$facultad[[2]]
  # Letras lleva 1 de 3: le faltan 2 hombres; la mujer de más no los cubre.
  expect_identical(letras$brecha, 2)
  expect_identical(r$total$logradas, 4L)
  expect_identical(r$fuera_de_celdas, 0L)
})

test_that("carrera × sexo, que el motor antes no podía expresar, se lee del plan por aula", {
  x <- .tac_insumos()
  cfg <- .tac_cfg(
    list(list(clave = "carrera", atribucion = "aula"), list(clave = "sexo")),
    list(list(valores = list(carrera = "Derecho", sexo = "F"), cuota = 2),
         list(valores = list(carrera = "Filosofía", sexo = "F"), cuota = 1))
  )
  r <- monitoreo_aulas_avance_por_celdas(cfg, monitoreo_aulas_eje(cfg), x$eje_atr, x$sexo, x$atr, x$plan)
  expect_identical(unlist(r$variables), c("carrera", "sexo"))
  expect_identical(vapply(r$celdas, `[[`, 0L, "logradas"), c(2L, 1L))
  # El hombre de Derecho cuenta para el estudio y no tiene celda: se dice.
  expect_identical(r$fuera_de_celdas, 1L)
})

test_that("sin representatividad declarada no hay avance por celdas", {
  x <- .tac_insumos()
  expect_null(monitoreo_aulas_avance_por_celdas(list(), monitoreo_aulas_eje(list()), x$eje_atr, x$sexo, x$atr, x$plan))
})
