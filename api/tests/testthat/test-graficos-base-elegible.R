# El pie decía "N = 4 de 101 (4.0%)" para una pregunta que solo se le hace a las
# 16 personas de una de las dos rutas del estudio, y dentro de ellas solo a quien
# trabajaba antes. Los 4 eran ciertos; el 101 no.
# Ver `docs/qa/checklist-acnur-v3-preguntas-ausentes-2026-08-19.md`.

survey_dos_rutas <- function() {
  data.frame(
    type = c(
      "select_one ruta", "begin_group",
      "select_one si_no", "select_one sector",
      "end_group", "begin_group",
      "integer", "end_group"
    ),
    name = c(
      "proyecto_ppl", "gVinc",
      "PastWorking", "sector",
      "gVinc", "gHom",
      "MesesReva", "gHom"
    ),
    label = c("Ruta", "", "¿Trabajaba antes?", "¿En qué sector?", "", "", "¿Cuántos meses?", ""),
    relevant = c(
      "", "${proyecto_ppl} = 'Vinculación Laboral'",
      "", "${PastWorking} = '1'",
      "", "${proyecto_ppl} = 'Homologación Laboral'",
      "", ""
    ),
    stringsAsFactors = FALSE
  )
}

datos_dos_rutas <- function() {
  # 6 casos: 4 de Homologación, 2 de Vinculación; de esos 2, uno trabajaba antes.
  data.frame(
    proyecto_ppl = c(rep("Homologación Laboral", 4), rep("Vinculación Laboral", 2)),
    PastWorking = c(rep(NA_character_, 4), "1", "4"),
    sector = c(rep(NA_character_, 4), "2", NA_character_),
    MesesReva = c(3, 5, 2, 8, NA, NA),
    stringsAsFactors = FALSE
  )
}

test_that("el universo de cada pregunta sale del relevant, no de la muestra entera", {
  inst <- list(survey = survey_dos_rutas())
  d <- datos_dos_rutas()

  meses <- .graficos_base_de_variable(d, inst, "MesesReva", 4L)
  expect_true(meses$derivado)
  expect_equal(meses$elegibles, 4L)          # solo Homologación, no los 6
  expect_equal(meses$publico, "Homologación Laboral")

  past <- .graficos_base_de_variable(d, inst, "PastWorking", 2L)
  expect_equal(past$elegibles, 2L)           # solo Vinculación
  expect_equal(past$publico, "Vinculación Laboral")

  # `sector` acumula las dos capas: la ruta (grupo) y el filtro propio.
  sector <- .graficos_base_de_variable(d, inst, "sector", 1L)
  expect_equal(sector$elegibles, 1L)
  expect_equal(sector$publico, "Vinculación Laboral")
})

test_that("la redacción del pie dice la tasa entre elegibles, no la fracción de la muestra", {
  # Todos los elegibles respondieron: el "(100%)" solo seria ruido.
  expect_identical(
    .graficos_base_texto_elegible(4L, 4L, "Vinculación Laboral", 101L),
    "Base: 4 respuestas de Vinculación Laboral"
  )
  # Con no-respuesta, el porcentaje es tasa de respuesta ENTRE ELEGIBLES.
  expect_identical(
    .graficos_base_texto_elegible(12L, 16L, "Vinculación Laboral", 101L),
    "Base: 12 de 16 elegibles de Vinculación Laboral (75%)"
  )
  # Sin público identificado, el universo sigue siendo el de elegibles.
  expect_identical(
    .graficos_base_texto_elegible(80L, 85L, "", 101L),
    "Base: 80 de 85 elegibles (94.1%)"
  )
  # Sin universo derivable se conserva la muestra, pero sin el porcentaje que
  # engañaba.
  expect_identical(
    .graficos_base_texto_elegible(101L, NULL, "", 101L),
    "Base: 101 respuestas, toda la muestra"
  )
})

test_that("sin relevant evaluable no se inventa un universo", {
  # Un `relevant` que el parser degrada a `odk_raw` no debe producir máscara:
  # es mejor el denominador viejo que uno inventado.
  survey <- survey_dos_rutas()
  survey$relevant[survey$name == "gVinc" & survey$type == "begin_group"] <-
    "funcion-que-no-existe(${proyecto_ppl}, 'x')"
  d <- datos_dos_rutas()

  res <- .graficos_base_de_variable(d, list(survey = survey), "PastWorking", 2L)
  # El gate no se pudo evaluar: se cae al comportamiento anterior sin romper.
  expect_true(is.na(res$elegibles) || res$elegibles == nrow(d) || !res$derivado)
  expect_true(nzchar(res$texto))
})

test_that("el público ignora el control operativo del formulario", {
  # `Consent` acompaña a la ruta en el gate de casi todos los grupos: es un
  # requisito de participación, no un público.
  survey <- survey_dos_rutas()
  i <- which(survey$name == "gHom" & survey$type == "begin_group")
  survey$relevant[i] <- "${Consent} = 'Yes' and ${proyecto_ppl} = 'Homologación Laboral'"
  d <- datos_dos_rutas()
  d$Consent <- "Yes"

  res <- .graficos_base_de_variable(d, list(survey = survey), "MesesReva", 4L)
  expect_equal(res$publico, "Homologación Laboral")
  expect_false(grepl("Yes", res$publico, fixed = TRUE))
})
