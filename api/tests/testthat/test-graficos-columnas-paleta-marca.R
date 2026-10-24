# Frente C (CCSS Perfil 2026, `p_slide_2_graficos` con `p_barras_categoricas`): las columnas de una sola serie salían
# cada una de un color (azul, verde, amarillo, naranja). El preset de fábrica trae diez colores con claves genéricas
# (`Categoria_1`…) que no son una decisión del proyecto; sin colores propios, una serie va en el azul de la marca y la
# mayor resaltada, como las barras horizontales y la lámina nativa.

.cp_df <- function() data.frame(cat = c("Hasta secundaria completa", "Superior técnica", "Universitaria", "Posgrado"),
                                n = c(91, 79, 147, 64), stringsAsFactors = FALSE)
.cp_fill <- function(p) { d <- attr(p, "pulso_barras_categoricas_data"); stats::setNames(d$fill, d$categoria) }
.cp_fabrica <- function() as.list(stats::setNames(c("#CA5651", "#EFD25E", "#85BB85", "#70AD47", "#7594CC", "#9688D3", "#E4A34C",
                                                    "#BFBFBF", "#081F5C", "#D8D8D8"), paste0("Categoria_", 1:10)))

test_that("sin colores propios, las columnas van en el azul de la marca con la mayor resaltada", {
  d <- .cp_df(); d$p <- d$n / sum(d$n)
  for (cc in list(NULL, .cp_fabrica())) {
    p <- graficar_barras_categoricas(d, "cat", "p", var_n = "n", colores_categorias = cc, orientacion = "vertical")
    f <- .cp_fill(p); cats <- .std_paleta("categorias")
    expect_identical(unname(f[["Universitaria"]]), cats$mayor)
    expect_true(all(f[names(f) != "Universitaria"] == cats$resto))
    # el ggplot dibuja ese mismo color
    b <- ggplot2::ggplot_build(p)$data[[1]]
    expect_setequal(unique(toupper(b$fill)), toupper(c(cats$mayor, cats$resto)))
  }
})

test_that("con un empate en la mayor, todas van en el azul de la marca", {
  d <- data.frame(cat = c("A", "B", "C"), p = c(.4, .4, .2))
  f <- .cp_fill(graficar_barras_categoricas(d, "cat", "p", orientacion = "vertical"))
  expect_true(all(f == .std_paleta("categorias")$mayor))
})

test_that("los colores que el proyecto fijó por categoría o en paleta se respetan", {
  d <- .cp_df(); d$p <- d$n / sum(d$n)
  propios <- list("Hasta secundaria completa" = "#AA0000", "Superior técnica" = "#00AA00", "Universitaria" = "#0000AA", "Posgrado" = "#AAAA00")
  f <- .cp_fill(graficar_barras_categoricas(d, "cat", "p", colores_categorias = propios, orientacion = "vertical"))
  expect_identical(toupper(unname(f)), c("#AA0000", "#00AA00", "#0000AA", "#AAAA00"))
  f2 <- .cp_fill(graficar_barras_categoricas(d, "cat", "p", paleta_colores = c("#111111", "#222222", "#333333", "#444444"), orientacion = "vertical"))
  expect_identical(toupper(unname(f2)), c("#111111", "#222222", "#333333", "#444444"))
})
