# Gonzalo (2026-10-13): «no se puede exportar si no está definido… esas cosas no deben pasar, se debe avisar e impedir su
# exportación». Un índice sin capítulos propios ni separadores de capítulo en el informe caía a la plantilla antigua
# (ampolletas y capítulos de ejemplo: «Objetivo del estudio», «Metodología…»). La compuerta común de PPT y Word
# (`.validar_plan_json`) ahora lo rechaza con su motivo.

.lamina <- function(tipo, payload = list()) list(id = paste0("s-", tipo, sample(1e6, 1)), tipo = tipo, payload = payload)
.grafico <- function() .lamina("p_slide_1_grafico", list(titulo = "Servicios", grafico = list(graficador = "p_barras_categoricas", args = list(var = "p1"))))

test_that("un índice sin capítulos y sin separadores en el informe no se exporta, y dice por qué", {
  v <- .validar_plan_json(list(slides = list(.lamina("p_slide_indice", list(meta = list(composicion = "facetas"))), .grafico())))
  expect_false(v$ok)
  expect_match(paste(v$errors, collapse = " "), "índice no tiene capítulos", fixed = TRUE)
  expect_match(paste(v$errors, collapse = " "), "Lámina 1", fixed = TRUE)
})

test_that("con capítulos propios, o con separadores de capítulo en el informe, sí se exporta", {
  propios <- .validar_plan_json(list(slides = list(.lamina("p_slide_indice", list(secciones = "Objetivo\nResultados")), .grafico())))
  expect_true(propios$ok)
  del_informe <- .validar_plan_json(list(slides = list(.lamina("p_slide_indice"), .lamina("p_slide_seccion", list(titulo = "Resultados")), .grafico())))
  expect_true(del_informe$ok)
})

test_that("los separadores de subcapítulo o sin título no cuentan como capítulos del informe", {
  sub <- .lamina("p_slide_seccion", list(titulo = "Detalle", meta = list(nivel = "subcapitulo")))
  vacio <- .lamina("p_slide_seccion", list(titulo = "  "))
  expect_false(.validar_plan_json(list(slides = list(.lamina("p_slide_indice"), sub, vacio, .grafico())))$ok)
})
