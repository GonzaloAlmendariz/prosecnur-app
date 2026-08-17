# El minimo de elegibles por aula es POR FACULTAD, no un umbral generalista.
#
# Decision de Gonzalo (2026-08-17), textual: «depende de cada facultad, no es un
# criterio generalista porque cada facultad tiene su propia naturaleza».
#
# Importa porque es la diferencia mas grande entre nuestro marco y el de 2025:
# de las 511 aulas que nos separan, 449 caen por el minimo —el nuestro es 15 y
# 2025 uso >= 10— y 308 estan justo en la franja 10-14. Con un umbral unico hay
# que elegir entre perder las aulas chicas de Gastronomia o inundar de aulas
# chicas a Ciencias e Ingenieria; con uno por facultad, no.
#
# El mecanismo existia —`criterios_seleccion$minEligible$byFaculty` sobre
# `.cm_criterios_eval_min_eligible`— y nada lo protegia. Estos tests lo fijan en
# las DOS direcciones: bajar el umbral en una facultad y subirlo en otra.

.mef_base <- function() {
  aula <- function(fac, i, n) do.call(rbind, lapply(seq_len(n), function(j) data.frame(
    student_id = paste0(fac, "-", i, "-e", j), aula_id = paste0(fac, "-A", i),
    curso = "C1", horario = "L 8", facultad = fac, programa = "P1", sexo = "F",
    edad = 20, condicion = "regular", nivel = "pregrado", modalidad = "PRESENCIAL",
    stringsAsFactors = FALSE
  )))
  rbind(aula("DERECHO", 1, 12), aula("DERECHO", 2, 20),
        aula("GASTRONOMIA", 1, 12), aula("GASTRONOMIA", 2, 20))
}

.mef_incluidas <- function(legacy, min_elig = NULL) {
  cfg <- list(filters = list(min_eligible_per_class = legacy))
  if (!is.null(min_elig)) {
    cfg$criterios_seleccion <- list(
      # La suite tiene que estar ACTIVA para que su minEligible mande: con
      # `byVariable` vacio el gate de aula no corre y decide el filtro legacy.
      byVariable = list(modality = list(
        scope = "aula", kind = "flat", mode = "include", match = "any",
        categories = "presencial"
      )),
      minEligible = min_elig
    )
  }
  af <- calc_muestra_aulas_construir(base_madre = .mef_base(), config = cfg)$aula_frame
  inc <- af$included %in% TRUE
  setNames(inc, paste0(af$faculty, "/", af$eligible_n))
}

test_that("CONTROL: sin umbral por facultad, el mismo corte rige en las dos", {
  # Si esto ya diera distinto por facultad, los tests de abajo no probarian nada.
  x <- .mef_incluidas(15L)
  expect_false(x[["DERECHO/12"]])
  expect_false(x[["GASTRONOMIA/12"]])
  expect_true(x[["DERECHO/20"]])
  expect_true(x[["GASTRONOMIA/20"]])
})

test_that("una facultad puede BAJAR su minimo sin arrastrar a las demas", {
  # Gastronomia admite aulas de 10; Derecho sigue en 15.
  x <- .mef_incluidas(15L, list(threshold = 15, byFaculty = list(gastronomia = 10)))
  expect_true(x[["GASTRONOMIA/12"]])
  expect_false(x[["DERECHO/12"]])
})

test_that("una facultad puede SUBIR su minimo sin arrastrar a las demas", {
  # Y al reves: el piso general es 10 y Derecho exige 15.
  x <- .mef_incluidas(10L, list(threshold = 10, byFaculty = list(derecho = 15)))
  expect_false(x[["DERECHO/12"]])
  expect_true(x[["GASTRONOMIA/12"]])
})

test_that("el umbral de la suite manda sobre el filtro legacy", {
  # Con la suite activa y un umbral propio de 10, el legacy de 15 no vuelve a
  # cortar por su cuenta: un solo recorte, una sola razon.
  x <- .mef_incluidas(15L, list(threshold = 10, byFaculty = list()))
  expect_true(x[["DERECHO/12"]])
  expect_true(x[["GASTRONOMIA/12"]])
})

test_that("una facultad sin umbral propio usa el general", {
  x <- .mef_incluidas(15L, list(threshold = 20, byFaculty = list(gastronomia = 10)))
  expect_true(x[["GASTRONOMIA/12"]])
  expect_false(x[["DERECHO/12"]])
  # Derecho cae al general de 20, asi que ni su aula de 20 se salva por poco.
  expect_true(x[["DERECHO/20"]])
})

test_that("el evaluador respeta el umbral de cada facultad", {
  claves <- .cm_criterios_fac_key(c("DERECHO", "GASTRONOMIA", "DERECHO"))
  flags <- .cm_criterios_eval_min_eligible(
    c(12, 12, 20), claves,
    list(threshold = 15, byFaculty = list(gastronomia = 10))
  )
  expect_equal(flags, c(FALSE, TRUE, TRUE))
})
