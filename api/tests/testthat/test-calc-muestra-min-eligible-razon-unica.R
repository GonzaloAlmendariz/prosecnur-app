# Un solo recorte publica una sola razón.
#
# El criterio `minEligible` de la suite, cuando no trae umbral propio, cae al
# mismo valor que el filtro legacy `min_eligible_per_class` y evalúa exactamente
# el mismo corte. Publicaba además su propia razón, así que un recorte salía
# firmado por dos criterios distintos.
#
# Medido en el proyecto real de 2025-2: ambas razones marcaban LAS MISMAS 2.320
# aulas —conjuntos idénticos, las de eligible_n < 15— con
# `criterios_seleccion$minEligible` vacío.
#
# Importa por lo que la pantalla dice: dos criterios donde hay uno hacen creer
# que se decide algo ya decidido, y mover el que no actúa no cambia nada sin que
# nada lo advierta.

.minelig_base <- function() {
  # A1 con 2 alumnos (cae bajo cualquier umbral >= 3), A2 con 6 (sobrevive).
  filas <- rbind(
    data.frame(student_id = paste0("a", 1:2), aula_id = "A1", stringsAsFactors = FALSE),
    data.frame(student_id = paste0("b", 1:6), aula_id = "A2", stringsAsFactors = FALSE)
  )
  data.frame(
    student_id = filas$student_id, aula_id = filas$aula_id,
    curso_id = paste0("C_", filas$aula_id), curso = "Curso", horario = "H1",
    facultad = "FAC1", programa = "P1", sexo = "F", edad = 20,
    condicion = "regular", nivel = "1", modalidad = "presencial",
    stringsAsFactors = FALSE
  )
}

# La suite DEBE estar activa: con `byVariable` vacío el criterio `minEligible`
# ni se evalúa, y un test montado así pasa igual con el defecto puesto — se
# comprobó con mutante y no distinguía nada.
.minelig_suite_activa <- function(minEligible) {
  list(
    byVariable = list(
      modality = list(scope = "aula", kind = "flat", mode = "include",
                      categories = list("presencial"))
    ),
    minEligible = minEligible
  )
}

.minelig_razones <- function(cfg) {
  af <- calc_muestra_aulas_construir(base_madre = .minelig_base(), config = cfg)$aula_frame
  r <- as.character(af$exclude_reason[af$classroom_id == "A1"])
  trimws(unlist(strsplit(r, "|", fixed = TRUE)))
}

test_that("sin umbral propio, la razón la publica sólo el filtro legacy", {
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 4L),
    criterios_seleccion = .minelig_suite_activa(minEligible = NULL)
  ))
  razones <- .minelig_razones(cfg)

  expect_true("min_eligible_per_class" %in% razones)
  # LA propiedad: el criterio de la suite no firma un corte que no decidió.
  expect_false("min_eligible" %in% razones)
})

test_that("el corte se sigue aplicando: callar la razón no es dejar pasar", {
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 4L),
    criterios_seleccion = .minelig_suite_activa(minEligible = NULL)
  ))
  af <- calc_muestra_aulas_construir(base_madre = .minelig_base(), config = cfg)$aula_frame

  expect_false(af$included[af$classroom_id == "A1"])
  expect_true(af$included[af$classroom_id == "A2"])
})

test_that("con umbral propio, el criterio de la suite sí firma su recorte", {
  # Aquí la suite decide algo distinto del legacy, así que su razón es
  # información y no ruido.
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    criterios_seleccion = .minelig_suite_activa(minEligible = list(threshold = 4L))
  ))
  razones <- .minelig_razones(cfg)

  expect_true("min_eligible" %in% razones)
})
