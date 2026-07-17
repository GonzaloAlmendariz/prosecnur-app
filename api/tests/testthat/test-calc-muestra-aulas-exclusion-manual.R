# Exclusión manual de cursos-horario (el criterio más granular del marco de
# aulas): una lista de classroom_id apagados a mano sale del marco tras todos
# los demás filtros. Solo excluye, nunca incluye; sobrevive la normalización y
# activa la suite por sí sola.

.excl_bloque <- function(aula, sids, facultad = "FAC1") {
  n <- length(sids)
  data.frame(
    student_id = sids,
    aula_id = aula,
    curso_id = paste0("C_", aula),
    curso = paste("Curso", aula),
    horario = "H1",
    facultad = facultad,
    programa = "P1",
    sexo = rep(c("F", "M"), length.out = n),
    edad = 20,
    condicion = "regular",
    nivel = "1",
    modalidad = "presencial",
    stringsAsFactors = FALSE
  )
}

.excl_base <- function() {
  rbind(
    .excl_bloque("A1", c("s1", "s2")),
    .excl_bloque("A2", c("s3", "s4")),
    .excl_bloque("A3", c("s5", "s6"))
  )
}

test_that("apagar un classroom_id a mano lo saca del marco y deja los demás", {
  base <- .excl_base()

  # Baseline: sin exclusión las tres aulas entran.
  frame0 <- calc_muestra_aulas_construir(
    base_madre = base,
    config = calc_muestra_aulas_normalize_config(list(filters = list(min_eligible_per_class = 1L)))
  )
  expect_true(all(frame0$aula_frame$included))

  # Excluyendo A2 a mano: A2 sale (razón manual), A1 y A3 quedan.
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    criterios_seleccion = list(manualExcludedClassrooms = list("A2"))
  ))
  frame <- calc_muestra_aulas_construir(base_madre = base, config = cfg)
  af <- frame$aula_frame
  expect_identical(af$classroom_id, c("A1", "A2", "A3"))
  expect_identical(af$included, c(TRUE, FALSE, TRUE))
  expect_match(af$exclude_reason[[2]], "manual_excluded")
  expect_identical(af$exclude_reason[c(1, 3)], c("", ""))
})

test_that("el classroom_id casa por text_key (robusto a mayusculas)", {
  base <- .excl_base()
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(min_eligible_per_class = 1L),
    # minúsculas y espacios: debe casar con el classroom_id "A2" del frame.
    criterios_seleccion = list(manualExcludedClassrooms = list(" a2 "))
  ))
  af <- calc_muestra_aulas_construir(base_madre = base, config = cfg)$aula_frame
  expect_identical(af$included, c(TRUE, FALSE, TRUE))
})

test_that("el campo sobrevive la normalización, dedup + text_key, y activa la suite", {
  sel <- prosecnurapp:::.cm_criterios_normalize_seleccion(
    list(manualExcludedClassrooms = list("A2", "a2", "", "B7"))
  )
  expect_true(prosecnurapp:::.cm_criterios_seleccion_activa(sel))
  expect_setequal(sel$manualExcludedClassrooms, c("a2", "b7"))
})

test_that("sin exclusión el campo no activa la suite (retro-compat)", {
  sel <- prosecnurapp:::.cm_criterios_normalize_seleccion(
    list(manualExcludedClassrooms = list())
  )
  expect_false(prosecnurapp:::.cm_criterios_seleccion_activa(sel))
})
