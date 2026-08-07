# L11 / H42-D8 — el suelo editorial de la casa lleva version.
#
# El consolidado congela los presets enriquecidos dentro de la receta (eso es
# deliberado: la receta es procedencia y debe reconstruir el mismo deck). El
# sello dice CUAL congelo, para que la divergencia con la doctrina vigente sea
# un dato declarado y no una diferencia invisible entre los cuatro caminos.

test_that("el sello declara version y digest del suelo vigente", {
  sello <- .graficos_presets_floor_stamp()

  expect_type(sello$version, "integer")
  expect_identical(sello$version, .PRESETS_FLOOR_VERSION)
  skip_if_not_installed("digest")
  expect_true(nzchar(sello$digest))
  expect_equal(nchar(sello$digest), 12L)
})

test_that("un suelo identico se reconoce vigente", {
  skip_if_not_installed("digest")
  sello <- .graficos_presets_floor_stamp()
  cmp <- .graficos_presets_floor_compare(sello)

  expect_identical(cmp$estado, "vigente")
  expect_true(cmp$mismo_contenido)
})

test_that("un suelo con otro contenido se marca desactualizado", {
  skip_if_not_installed("digest")

  # Suelo de ayer: el conteo pegado al porcentaje era default (pre-P29).
  viejo <- .PRESETS_DEFAULT_PULSO
  viejo$barras_categoricas$formato_valor <- "porcentaje_n"
  viejo$barras_categoricas$mostrar_frecuencia <- TRUE

  cmp <- .graficos_presets_floor_compare(.graficos_presets_floor_stamp(viejo))
  expect_identical(cmp$estado, "desactualizado")
  expect_false(cmp$mismo_contenido)
})

test_that("el digest manda sobre la etiqueta cuando divergen", {
  skip_if_not_installed("digest")

  # Alguien cambio un default y olvido subir la version: el contenido delata.
  viejo <- .PRESETS_DEFAULT_PULSO
  viejo$histograma$mostrar_frecuencia <- TRUE
  sello_mentiroso <- .graficos_presets_floor_stamp(viejo)
  sello_mentiroso$version <- .PRESETS_FLOOR_VERSION  # etiqueta "al dia"

  cmp <- .graficos_presets_floor_compare(sello_mentiroso)
  expect_identical(cmp$estado, "desactualizado")
  expect_identical(cmp$version_receta, .PRESETS_FLOOR_VERSION)

  # Y al reves: misma etiqueta vieja pero contenido identico sigue siendo vigente.
  sello_ok <- .graficos_presets_floor_stamp()
  sello_ok$version <- 1L
  expect_identical(.graficos_presets_floor_compare(sello_ok)$estado, "vigente")
})

test_that("una receta anterior a la feature no rompe: se declara sin sello", {
  cmp <- .graficos_presets_floor_compare(NULL)

  expect_identical(cmp$estado, "sin_sello")
  expect_true(is.na(cmp$version_receta))
  expect_identical(cmp$version_actual, .PRESETS_FLOOR_VERSION)
})

test_that("la receta del consolidado sella el suelo que congelo", {
  # Contrato de forma: quien lea la receta debe encontrar el sello donde
  # `graficos_consolidado_start` lo escribe.
  sello <- .graficos_presets_floor_stamp()
  recipe <- list(presets = .PRESETS_DEFAULT_PULSO, presets_floor = sello)

  expect_false(is.null(recipe$presets_floor))
  expect_identical(
    .graficos_presets_floor_compare(recipe$presets_floor)$estado,
    if (requireNamespace("digest", quietly = TRUE)) "vigente" else "desactualizado"
  )
})
