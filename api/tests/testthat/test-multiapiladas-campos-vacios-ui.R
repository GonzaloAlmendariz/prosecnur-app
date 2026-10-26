source("setup-load-all.R")

# Arte_v1-4 (2026-10-25): la UI guarda los opcionales vacíos de un bloque como `{}` («titulos_grupo»: {}, «cruces»: {},
# «var»: {}), que jsonlite devuelve como `list()`. `top2box_labels` ya lo leía como «sin valor», pero `titulos_grupo`
# abortaba la lámina («debe ser NULL o character() no vacio») y el PowerPoint no salía.

test_that("un bloque con titulos_grupo, cruces y var vacíos ({} de la UI) arma la lámina sin abortar", {
  bloque <- jsonlite::fromJSON('{"modo":"var","vars":["p11_1"],"titulos_grupo":{},"cruces":{},"var":{},
    "overrides":{"barra_extra":"top2box"},"top2box_labels":["De acuerdo","Totalmente de acuerdo"]}', simplifyVector = FALSE)
  expect_identical(bloque$titulos_grupo, setNames(list(), character(0)))
  el <- expect_no_error(p_barras_multiapiladas(modo = "multilista", bloques = list(bloque)))
  expect_s3_class(el, "ppt_element")
})

test_that("titulos_grupo vacío en el modo simple también es «sin títulos»", {
  el <- expect_no_error(p_barras_multiapiladas(vars = c("p11_1", "p11_2"), titulos_grupo = setNames(list(), character(0))))
  expect_null(el$titulos_grupo)
})
