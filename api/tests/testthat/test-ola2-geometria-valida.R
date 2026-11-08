# Ola 2, Q1 (qa_r7/blank/l6_cruce.pptx, qa_r7/ppt/p-6.png): en una lámina de varios gráficos con una agrupada con cruce,
# la leyenda en una fila medía más que su lienzo y rvg escribía el primer cuadro con geometría no finita
# (`<a:off x="2147483647">`, `<a:ext cx="-2147483648">`): un rectángulo azul que tapa la lámina y obliga a PowerPoint a
# reparar el archivo.
#
# Contrato: ninguna forma de ninguna lámina lleva coordenadas fuera de rango ni extensiones negativas, y los dos rótulos
# de la leyenda del cruce siguen en la lámina.

.ola2_q1_geometria_mala <- function(pptx, k) {
  s <- .leer_parte_zip(pptx, sprintf("ppt/slides/slide%d.xml", k))
  off <- regmatches(s, gregexpr('<a:off x="-?\\d+" y="-?\\d+"', s))[[1]]
  ext <- regmatches(s, gregexpr('<a:ext cx="-?\\d+" cy="-?\\d+"', s))[[1]]
  num <- function(v) as.numeric(unlist(regmatches(v, gregexpr("-?\\d+", v))))
  o <- num(off); e <- num(ext)
  c(if (any(abs(o) >= 2147483647)) sprintf("off fuera de rango en lámina %d", k),
    if (any(e < 0)) sprintf("ext negativa en lámina %d", k))
}

test_that("Q1: la agrupada con cruce de rótulos largos en una composición no deja formas con geometría inválida", {
  skip_if_not_installed("officer")
  fx <- .ola2_familias()
  sl <- list(
    p_slide_2_graficos(titulo = "Dos en horizontal", izquierda = p_barras_agrupadas(var = "doc$cat6", cruces = "doc$ded"),
                       derecha = p_barras_agrupadas(var = "doc$q19")),
    p_slide_4_graficos(titulo = "Cuatro", superior_izquierda = p_barras_agrupadas(var = "doc$sx"),
                       superior_derecha = p_barras_agrupadas(var = "doc$cat6", cruces = "doc$ded"),
                       inferior_izquierda = p_barras_agrupadas(var = "doc$ded"), inferior_derecha = p_barras_agrupadas(var = "doc$p18")))
  pth <- .ola2_pptx(fx, sl)
  expect_identical(unlist(lapply(1:2, function(k) .ola2_q1_geometria_mala(pth, k))), NULL)
  cajas <- .ola2_cajas(pth, 1L)
  expect_true(all(c("Tiempo completo (TC)", "Tiempo parcial por asignaturas (TPA)") %in% cajas$texto))
})

test_that("Q1: una leyenda más ancha que su lienzo se parte en filas y reserva el alto que agrega", {
  skip_if_not_installed("cowplot")
  df <- data.frame(g = c("Tiempo completo (TC)", "Tiempo parcial por asignaturas (TPA)"), v = 1:2)
  p <- ggplot2::ggplot(df, ggplot2::aes(g, v, fill = g)) + ggplot2::geom_col() +
    ggplot2::theme(legend.text = ggplot2::element_text(size = 14), legend.position = "bottom")
  construir <- function(k) cowplot::get_legend(p + ggplot2::guides(fill = ggplot2::guide_legend(ncol = k, byrow = TRUE)))
  ancho1 <- .agrupadas_leyenda_medida_in(construir(2L))[["w"]]
  r <- .agrupadas_leyenda_que_cabe(construir, 2L, 6L, ancho1 * 0.8)
  expect_identical(r$ncol, 1L)
  expect_lte(.agrupadas_leyenda_medida_in(r$grob)[["w"]], ancho1 * 0.8)
  expect_gt(r$extra_h_in, 0)
  # Si cabe, la leyenda sale tal como se pidió.
  r2 <- .agrupadas_leyenda_que_cabe(construir, 2L, 6L, ancho1 * 2)
  expect_identical(r2$ncol, 6L)
  expect_identical(r2$extra_h_in, 0)
})
