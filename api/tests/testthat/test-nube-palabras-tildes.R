# La nube conserva las tildes y no parte las palabras (catálogo del motor: «gesti», «acad», «emico»).

test_that("la nube cuenta palabras con tilde enteras, también fuera de un locale UTF-8", {
  d <- data.frame(t = c("Gestión académica y gestión del departamento", "Mejorar la gestión académica"), stringsAsFactors = FALSE)
  previo <- Sys.getlocale("LC_CTYPE"); on.exit(Sys.setlocale("LC_CTYPE", previo), add = TRUE)
  suppressWarnings(Sys.setlocale("LC_CTYPE", "C"))
  p <- graficar_nube_palabras(d, var_texto = "t")
  pal <- as.character(p$data$label %||% p$data$palabra %||% unlist(lapply(ggplot2::ggplot_build(p)$data, function(x) x$label)))
  expect_true("gestión" %in% pal)
  expect_true("académica" %in% pal)
  expect_false(any(c("gesti", "acad", "emica") %in% pal))
  expect_false(any(c("la", "y", "del") %in% pal))                                   # palabras vacías fuera
})

test_that("sin colores declarados (o con la paleta de fábrica) la nube usa el degradado de azul por menciones", {
  d <- data.frame(t = c(rep("cursos laboral mercado", 6), rep("cursos laboral", 3), "cursos"), stringsAsFactors = FALSE)
  col <- function(p) { b <- ggplot2::ggplot_build(p)$data[[1]]; stats::setNames(b$colour, b$label) }
  c1 <- col(graficar_nube_palabras(d, var_texto = "t"))
  rampa <- toupper(grDevices::colorRampPalette(c("#8EA3C6", .std_color("azul")))(5))
  # Como el recetario: cuartiles dan cuatro tramos sobre una rampa de cinco, la más dicha en el cuarto azul.
  expect_identical(toupper(unname(c1["cursos"])), rampa[4]); expect_identical(toupper(unname(c1["mercado"])), rampa[1])
  expect_false(identical(c1["cursos"], c1["mercado"]))
  fab <- unname(unlist(.PULSO_PPT_COLORS[c("azul", "rojo", "verde", "amarillo", "azul_secundario", "morado")]))
  c2 <- col(graficar_nube_palabras(d, var_texto = "t", colores_palabras = fab))
  expect_identical(c1, c2)                                                           # la paleta fósil no manda
  c3 <- col(graficar_nube_palabras(d, var_texto = "t", colores_palabras = "#CA5651"))
  expect_true(all(toupper(c3) == "#CA5651"))                                         # la del analista sí
})
