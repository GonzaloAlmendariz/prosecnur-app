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
  expect_identical(meses$texto, "4 respuestas de Homologación Laboral (100%)")

  past <- .graficos_base_de_variable(d, inst, "PastWorking", 2L)
  expect_equal(past$elegibles, 2L)           # solo Vinculación
  expect_equal(past$publico, "Vinculación Laboral")
})

test_that("el porcentaje se mide contra el universo que el pie nombra", {
  # El pie decía "15 respuestas de Vinculación Laboral (100%)" para una pregunta
  # que solo ven quienes entraron al grupo de WhatsApp: 15 de 15 elegibles es
  # 100%, pero nombraba a Vinculación Laboral, que son 16. Un pie que mide
  # contra un universo distinto del que declara no se puede verificar leyéndolo.
  inst <- list(survey = survey_dos_rutas())
  d <- datos_dos_rutas()

  # `sector` tiene filtro propio (`PastWorking = '1'`): 1 de los 2 de la ruta.
  sector <- .graficos_base_de_variable(d, inst, "sector", 1L)
  expect_equal(sector$publico, "Vinculación Laboral")
  # El denominador es el del público nombrado, no el del filtro interno.
  expect_equal(sector$elegibles, 2L)
  expect_identical(sector$texto, "1 respuesta de Vinculación Laboral (50%)")
  expect_false(grepl("100%", sector$texto, fixed = TRUE))
})

test_that("la redacción es una sola y el porcentaje es tasa entre elegibles", {
  # Formato único, sin prefijo: que unas láminas traigan porcentaje y otras no
  # obliga al lector a preguntarse por qué.
  expect_identical(
    .graficos_base_texto_elegible(4L, 4L, "Vinculación Laboral", 101L),
    "4 respuestas de Vinculación Laboral (100%)"
  )
  expect_identical(
    .graficos_base_texto_elegible(12L, 16L, "Vinculación Laboral", 101L),
    "12 respuestas de Vinculación Laboral (75%)"
  )
  # El porcentaje mide contra los ELEGIBLES, no contra la muestra: 12 de 16 es
  # 75%, no el 11.9% que salía de dividir entre 101.
  expect_false(grepl("11.9", .graficos_base_texto_elegible(12L, 16L, "Vinculación Laboral", 101L), fixed = TRUE))

  # Singular cuando corresponde.
  expect_identical(
    .graficos_base_texto_elegible(1L, 4L, "Vinculación Laboral", 101L),
    "1 respuesta de Vinculación Laboral (25%)"
  )
  # Sin público identificado el universo sigue siendo el de elegibles.
  expect_identical(
    .graficos_base_texto_elegible(45L, 101L, "", 101L),
    "45 respuestas de la muestra total (44.6%)"
  )
  # Sin universo derivable no se inventa denominador ni porcentaje.
  expect_identical(.graficos_base_texto_elegible(101L, NULL, "", 101L), "101 respuestas")
  # Y en ningún caso se escribe el prefijo.
  for (txt in c(
    .graficos_base_texto_elegible(4L, 4L, "Vinculación Laboral", 101L),
    .graficos_base_texto_elegible(45L, 101L, "", 101L),
    .graficos_base_texto_elegible(101L, NULL, "", 101L)
  )) expect_false(grepl("Base:", txt, fixed = TRUE))
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
