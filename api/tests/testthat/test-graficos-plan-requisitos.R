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

# Escalas distintas en una multiapilada (Gonzalo, 2026-10-14): van en bloques separados. La exportación lo rechaza con
# la misma firma que el editor (`scale_signature`), en vez de dejar la lámina «Sin datos».
.esc_inst <- function() {
  ch <- data.frame(list_name = c(rep("a5", 5), rep("a4", 4), rep("a4b", 4)), name = c(1:5, 1:4, 1:4),
                   label = c("TD", "D", "Ni", "A", "TA", "TD", "D", "A", "TA", "td", "d", "a", "ta"), stringsAsFactors = FALSE)
  sv <- function(t) data.frame(name = "p1", type = t, stringsAsFactors = FALSE)
  list(docentes = list(survey = sv("select_one a5"), choices = ch), estudiantes = list(survey = sv("select_one a4"), choices = ch),
       egresados = list(survey = sv("select_one a4b"), choices = ch))
}
.multi <- function(...) .lamina("p_slide_1_grafico", list(titulo = "Tutoría", grafico = list(graficador = "p_barras_multiapiladas", args = list(...))))

test_that("una multiapilada con escalas distintas no se exporta y sugiere Combinar bloques", {
  v <- .validar_plan_json(list(slides = list(.multi(modo = "var_cruce", vars = list(Tutoria = c("docentes$p1", "estudiantes$p1"))))),
                          inst_sources = .esc_inst())
  expect_false(v$ok)
  expect_match(paste(v$errors, collapse = " "), "escalas distintas", fixed = TRUE)
  expect_match(paste(v$errors, collapse = " "), "Combinar bloques", fixed = TRUE)
})

test_that("la misma escala con otra caja, bloques separados y una pregunta por grupos sí se exportan", {
  inst <- .esc_inst()
  ok <- function(...) .validar_plan_json(list(slides = list(.multi(...))), inst_sources = inst)$ok
  expect_true(ok(modo = "var_cruce", vars = list(Tutoria = c("estudiantes$p1", "egresados$p1"))))
  expect_true(ok(modo = "multilista", bloques = list(list(modo = "var", vars = list("docentes$p1")), list(modo = "var", vars = list("estudiantes$p1")))))
  expect_true(ok(modo = "cruce", var = "docentes$p1", cruces = "docentes$p1"))
  # Sin instrumentos (el validador puro de siempre) no se juzga la escala.
  expect_true(.validar_plan_json(list(slides = list(.multi(modo = "var_cruce", vars = list(T = c("docentes$p1", "estudiantes$p1"))))))$ok)
})
