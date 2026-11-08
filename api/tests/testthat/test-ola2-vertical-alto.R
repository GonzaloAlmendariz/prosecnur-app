# Ola 2, G1 y G2 (captura «H. 2 vertical multiapilada SIN INF»). Gonzalo, 2026-11-08: «cuando tenemos una lámina que todo
# tiene título y no tiene texto, los gráficos no aprovechan su alto de forma adecuada cuando podrían hacerlo».
#
# G1: cada bloque reservaba 0.4 in para una pregunta vacía y la lámina dejaba ~1/5 de su alto en blanco bajo el título.
# G2: la fila medía 0.72 in fijos y el rótulo de 1.6 in, envuelto a 11 pt, hasta 1.75 in: los enunciados se montaban.
#
# Contrato: ningún rótulo de pregunta pisa a otro ni a la leyenda (>= 0.02 in de aire); la composición ocupa el alto
# libre (de la zona de datos al pie, >= 85 %); y el alto que sobra no infla la barra más allá del grosor de Contabilidad
# para esas barras (`.lam_grosor_holgado`), ni la deja bajo el piso del estándar: verificar_mazo() sin R1, B2 ni B3.

.ola2_g12 <- local({ pth <- NULL; function() { if (is.null(pth)) pth <<- .ola2_vertical_largos(); pth } })

test_that("G2: los rótulos largos de pregunta no se montan entre filas ni sobre la leyenda", {
  skip_if_not_installed("officer")
  cajas <- .ola2_cajas(.ola2_g12(), 1L)
  rot <- cajas[grepl("^(Existe|El reglamento|Existen|Las evaluaciones)", cajas$texto), , drop = FALSE]
  expect_identical(nrow(rot), 4L)
  ley <- cajas[cajas$texto %in% c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF"), , drop = FALSE]
  otras <- rbind(rot, ley)
  malas <- character(0)
  for (i in seq_len(nrow(rot))) for (j in seq_len(nrow(otras))) {
    a <- rot[i, ]; b <- otras[j, ]
    if (identical(a$texto, b$texto)) next
    if (min(a$x1, b$x1) - max(a$x0, b$x0) > 0 && .ola2_aire_y(a, b) < 0.02)
      malas <- c(malas, sprintf("«%s» / «%s»: %.3f in", substr(a$texto, 1, 25), substr(b$texto, 1, 25), .ola2_aire_y(a, b)))
  }
  expect_identical(malas, character(0))
})

test_that("G1: la composición usa el alto libre de la lámina y no reserva preguntas vacías", {
  skip_if_not_installed("officer")
  formas <- .ola2_formas(.ola2_g12(), 1L)
  cajas <- formas[nzchar(formas$texto), , drop = FALSE]
  titulo <- cajas[cajas$texto == "Dos multiapiladas en vertical", , drop = FALSE]
  pie <- cajas[startsWith(cajas$texto, "Base:"), , drop = FALSE]
  cuerpo <- formas[formas$y0 > titulo$y1 + 0.05 & formas$y1 < pie$y0 - 0.02, , drop = FALSE]
  y_ini <- .std_geom("zona_datos_y0") - 0.05; y_fin <- .std_geom("base_y") - 0.1
  uso <- (max(cuerpo$y1) - min(cuerpo$y0)) / (y_fin - y_ini)
  expect_gte(uso, 0.85)
  # Sin cajas vacías de pregunta (antes, dos de 0.3 in sin texto a lo ancho).
  vacias <- formas[!nzchar(formas$texto) & !formas$cust & (formas$x1 - formas$x0) > 10, , drop = FALSE]
  expect_identical(nrow(vacias), 0L)
})

test_that("G1: el alto libre no infla la barra más allá del recetario ni rompe el estándar de grosores", {
  skip_if_not_installed("officer")
  v <- verificar_mazo(.ola2_g12())
  h <- v$hallazgos[v$hallazgos$regla %in% c("R1 grosor de escala", "B2 hueco entre premisas", "B3 grosores desiguales"), , drop = FALSE]
  expect_identical(paste(h$regla, h$valor), character(0))
  formas <- .ola2_formas(.ola2_g12(), 1L)
  seg <- formas[!nzchar(formas$texto) & !formas$cust & (formas$y1 - formas$y0) > 0.2 & (formas$x1 - formas$x0) < 10, , drop = FALSE]
  grosor <- as.numeric(names(which.max(table(round(seg$y1 - seg$y0, 3)))))
  expect_lte(grosor, .lam_grosor_holgado(4L) + 1e-6)
})
