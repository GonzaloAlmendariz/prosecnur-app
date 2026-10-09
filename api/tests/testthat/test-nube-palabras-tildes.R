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
