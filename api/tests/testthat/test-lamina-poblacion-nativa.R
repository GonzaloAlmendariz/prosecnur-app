# Láminas de población con las piezas del recetario (docs/qa/checklist-poblacion-y-filtro-2026-10-14.md). Antes un solo
# panel que no cabía (una torta, una media, seis filas en un panel bajo) mandaba la lámina entera a la plantilla anterior.

.pn_pie <- function(k = 3, forma = "pie") {
  rot <- c("Mujer", "Hombre", "Prefiero no responder", "Otro", "Ninguno")[seq_len(k)]
  list(tipo = "pie", forma = forma, rotulos = rot, valores = rep(1 / k, k), cifras = rep("33%", k))
}

test_that("P1: la torta y la dona caben en un panel mediano y se dibujan como lámina 69 en pequeño", {
  g <- .lam_panel_geo(.pn_pie(3), 0.5, 1.65, 4.31, 2.1, pregunta = "Sexo")
  expect_identical(g$tipo, "circular"); expect_true(g$cabe)
  expect_true(.lam_panel_geo(.pn_pie(2, "donut"), 0.5, 1.65, 3.91, 2.29, pregunta = "¿Conoce la misión?")$cabe)
  expect_false(.lam_panel_geo(.pn_pie(5), 0.5, 1.65, 3.91, 1.2, pregunta = "Sexo")$cabe)            # muy bajo: respaldo
  lz <- .lam_lienzo(); .lam_panel_mixto(lz, .pn_pie(2, "donut"), 0.5, 1.65, 4.31, 2.1, "¿Conoce la misión?")
  xml <- paste(unlist(lz$formas), collapse = "")
  expect_true(grepl("dona:porcion", xml)); expect_true(grepl("dona:cifra", xml))
})

test_that("P2 y D6: una media o mediana sin grupos es una cifra destacada, con su unidad si la pregunta la dice", {
  e <- list(tipo = "numerico", metrica = "median", etiqueta = NULL, rotulos = "Total", cifras = "21.0", n = 172)
  c1 <- .lam_numerico_como_cifra(e)
  expect_identical(c1$tipo, "cifra"); expect_identical(c1$item$valor, "21.0"); expect_identical(c1$item$detalle, "Mediana de 172 respuestas")
  expect_null(.lam_numerico_como_cifra(modifyList(e, list(rotulos = c("A", "B"), cifras = c("1", "2")))))   # con grupos, no
  el <- list(.element_type = "numerico", var = "edad", title_slide = "Edad mediana (años)", overrides = list())
  esp <- lapply(list(structure(ggplot2::ggplot(), pulso_espec = e)), .lam_espec_de)[[1]]
  expect_true(isTRUE(esp$item$desde_numerico))
})

test_that("P3: en un panel ancho y bajo, las categorías que no caben como filas van en columnas", {
  cat6 <- list(tipo = "categorica", rotulos = paste(c("Quinto", "Sexto", "Séptimo", "Octavo", "Noveno", "Décimo"), "ciclo"),
               largos = rep(1 / 6, 6), valores = rep(1 / 6, 6), cifras = rep("17%", 6))
  g <- .lam_panel_geo(cat6, 0.5, 4.3, 12.52, 2.52, pregunta = "Nivel curricular")
  expect_identical(g$tipo, "columnas"); expect_true(g$cabe)
  expect_identical(.lam_panel_geo(cat6, 0.5, 1.65, 4.31, 5.07, pregunta = "Nivel curricular")$tipo, "barras")   # alto: filas
})

test_that("P4: la tira, la de cinco y la de seis tienen la geometría del estándar; la tira, con el enunciado a la izquierda", {
  for (t in c("poblacion_3_tira", "poblacion_5", "poblacion_6")) expect_false(is.null(.lam_mixta_geo(t)), info = t)
  expect_length(.lam_mixta_geo("poblacion_5")$paneles, 5L); expect_length(.lam_mixta_geo("poblacion_6")$paneles, 6L)
  expect_false(is.null(.lam_mixta_geo("poblacion_3_tira")$paneles[[1]]$receta$lateral))
})

test_that("la base que repite el número con otra unidad se cuenta una vez", {
  expect_identical(.lam_bases_sin_repetir(c("Base: 172 estudiantes", "Base: 172 respuestas")), "Base: 172 estudiantes")
  expect_identical(.lam_bases_sin_repetir(c("Base: 172 estudiantes", "Base: 52 respuestas")), c("Base: 172 estudiantes", "Base: 52 respuestas"))
})
