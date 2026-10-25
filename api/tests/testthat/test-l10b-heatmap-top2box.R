source("setup-load-all.R")

# L10-10 (bandeja CCSS, 2026-10-24; lámina 63 del mazo V2): la tabla de calor de una escala Likert por carrera no traía
# el Top Two Box, que es lo que el título compara. Columna opcional, encendida por defecto cuando la escala es ordinal de
# cuatro o más puntos, con el criterio de las multiapiladas (`.box_decidir`): suma las categorías DECLARADAS en
# `top2box_labels` (no se deducen del orden); sin declararlas la columna se omite y se avisa. Las celdas no cambian.

.l10bh_lk <- c("Totalmente en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo", "De acuerdo", "Totalmente de acuerdo")
.l10bh_inst <- function() list(
  survey = data.frame(name = c("car", "p", "q"), type = c("select_one cr", "select_one lk", "select_one tr"), list_name = c("cr", "lk", "tr"),
                      label = c("Carrera", "Afirmación", "Tres"), stringsAsFactors = FALSE),
  choices = data.frame(list_name = c("cr", "cr", rep("lk", 5), rep("tr", 3)), name = c("1", "2", as.character(1:5), as.character(1:3)),
                       label = c("Economía", "Derecho", .l10bh_lk, "Bajo", "Medio", "Alto"), stringsAsFactors = FALSE),
  orders_list = list(car = list(names = c("1", "2"), labels = c("Economía", "Derecho"), label = "Carrera"),
                     p = list(names = as.character(1:5), labels = .l10bh_lk, label = "Afirmación"),
                     q = list(names = as.character(1:3), labels = c("Bajo", "Medio", "Alto"), label = "Tres")))
# Economía (10): p = 1,2,3,3,4,4,4,5,5,5 → TTB 60 %. Derecho (10): p = 1,1,1,2,2,3,3,4,5,5 → TTB 30 %. Total: 45 %.
.l10bh_dat <- function() data.frame(
  car = rep(c("1", "2"), each = 10),
  p = as.character(c(1, 2, 3, 3, 4, 4, 4, 5, 5, 5, 1, 1, 1, 2, 2, 3, 3, 4, 5, 5)),
  q = rep(c("1", "2", "3", "1", "2"), 4), stringsAsFactors = FALSE)
.l10bh_ruta <- function(el) {
  out <- tempfile(fileext = ".pptx")
  plan <- list(a = p_slide_1_grafico(grafico = el, titulo = "L10-10"))
  suppressWarnings(reporte_ppt_plan(data = .l10bh_dat(), instrumento = .l10bh_inst(), plan = plan, path_ppt = out, mensajes_progreso = FALSE))
  xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
}
.l10bh_txt <- function(xml, n) xml2::xml_text(xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))
.l10bh_ttb <- c("De acuerdo", "Totalmente de acuerdo")

test_that("L10-10: con las categorías declaradas la tabla suma la columna Top Two Box, al final y sin tocar las celdas", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  xml <- suppressMessages(.l10bh_ruta(p_dim_heatmap(modo = "general", objetivo = "p", cruce = "car",
                                                    overrides = list(top2box_labels = .l10bh_ttb))))
  expect_identical(.l10bh_txt(xml, "calor:columna"), .l10bh_lk)                         # las opciones, como antes
  expect_identical(.l10bh_txt(xml, "calor:box_columna"), "Top Two Box")
  expect_identical(.l10bh_txt(xml, "calor:box_cifra"), c("45%", "60%", "30%"))           # Total, Economía, Derecho
  expect_identical(.l10bh_txt(xml, "calor:cifra"),
                   c("20%", "15%", "20%", "20%", "25%", "10%", "10%", "20%", "30%", "30%", "30%", "20%", "20%", "10%", "20%"))
})

test_that("L10-10: el Top Two Box es la suma de las cifras rotuladas, como en las multiapiladas", {
  e <- .heatmap_pc_espec(.l10bh_dat(), .l10bh_inst(), "p", "car", box = list(top2box_labels = .l10bh_ttb))
  expect_identical(e$col_box, 6L)
  expect_equal(unname(e$valores[, 6]), unname(rowSums(e$valores[, 4:5])))
  expect_equal(unname(e$valores_crudos[, 6]), unname(rowSums(e$valores_crudos[, 4:5])))
  # Con cifras que redondean hacia arriba (26,4 + 21,4 = 47,8): el box dice 47, lo que suman las celdas que se leen.
  e2 <- e; e2$valores_crudos[1, 1:5] <- c(10, 20.8, 21.4, 26.4, 21.4); e2$valores[1, 1:5] <- c(10, 21, 21, 26, 21)
  e2$valores <- e2$valores[, 1:5]; e2$valores_crudos <- e2$valores_crudos[, 1:5]; e2$columnas <- e2$columnas[1:5, ]; e2$col_box <- NULL
  expect_equal(unname(.heatmap_pc_con_box(e2, .l10bh_ttb)$valores[1, 6]), 47)
})

test_that("L10-10: encendida por defecto en una escala ordinal de 4+ puntos, sin categorías declaradas se omite y se avisa", {
  expect_message(e <- .heatmap_pc_espec(.l10bh_dat(), .l10bh_inst(), "p", "car"), "Top Two Box.*no hay categorías declaradas")
  expect_null(e$col_box); expect_identical(ncol(e$valores), 5L)
})

test_that("L10-10: se apaga con top2box = FALSE, y en una escala de tres puntos no se ofrece ni avisa", {
  expect_silent(e <- .heatmap_pc_espec(.l10bh_dat(), .l10bh_inst(), "p", "car", box = list(top2box = FALSE, top2box_labels = .l10bh_ttb)))
  expect_null(e$col_box)
  expect_silent(e3 <- .heatmap_pc_espec(.l10bh_dat(), .l10bh_inst(), "q", "car"))
  expect_null(e3$col_box)
})

test_that("L10-10: p_dim_heatmap declara el Top Two Box en el editor, por overrides", {
  a <- .GRAFICADORES_META$p_dim_heatmap$args
  nm <- vapply(a, function(x) x$name, "")
  expect_true(all(c("top2box", "top2box_labels") %in% nm))
  expect_true(all(vapply(a[nm %in% c("top2box", "top2box_labels")], function(x) isTRUE(x$via_overrides), TRUE)))
})

test_that("L10-10: con la columna la tabla sigue nativa aunque los grupos pidan una columna de filas ancha (lámina 63 de CCSS)", {
  e <- .heatmap_pc_espec(.l10bh_dat(), .l10bh_inst(), "p", "car", box = list(top2box_labels = .l10bh_ttb))
  e$ancho_filas <- .heatmap_pc_ancho_filas("Relaciones Internacionales (90)")   # 3.3 in, como en CCSS
  expect_true(.lam_dimensiones_cabe(e))   # «Ni de acuerdo ni en desacuerdo» sigue en dos líneas: el box va angosto
})
