# Revisión del PPT v7.25 de CCSS (ítems 4 a 11): contratos de presentación. Ninguna cifra, prueba ni regla cambia.

test_that("ítem 6: la guía corre por el carril entre filas y no cruza la franja de otra fila", {
  filas <- c(1, 1.5, 2, 2.5, 3)
  r <- .lam_tarjeta_guia_ruta(xa = 4, ya = 2, xp = 7, tp = 2.15, h = 1, filas_y = filas, fin_barras = 6.5)
  # Sale de su fila junto al punto, baja sólo hasta el carril (2.25) y corre por él hasta la tarjeta.
  expect_equal(r[nrow(r), 2], 2.25)
  ys <- r[, 2]; expect_true(all(ys >= 2 - 1e-9 & ys <= 2.25 + 1e-9))
  expect_equal(r[nrow(r), 1], 7)
  # Tarjeta a la altura de su fila: recta.
  r2 <- .lam_tarjeta_guia_ruta(4, 2, 7, tp = 1.7, h = 0.6, filas_y = filas)
  expect_equal(nrow(r2), 2L)
  # Tarjeta más allá del carril: el tramo vertical va en la columna libre, a la derecha de todas las barras.
  r3 <- .lam_tarjeta_guia_ruta(4, 2, 7, tp = 2.8, h = 0.6, filas_y = filas, fin_barras = 6.5)
  vert <- which(abs(diff(r3[, 1])) < 1e-9 & abs(diff(r3[, 2])) > 0.3)
  expect_true(length(vert) == 1L && r3[vert, 1] > 6.5)
})

test_that("ítem 5: tarjetas activas sin ninguna diferencia dicen los cruces probados", {
  t <- list(tarjetas = list(), cruces = c("area", "nivel", "sexo"),
            grupos = data.frame(cruce = c("area", "area", "nivel", "nivel"), codigo = c("1", "2", "6", "7")),
            rotulos_cruce = c(area = "Área", nivel = "Nivel", sexo = "Sexo"), indicador = "el Top Two Box")
  expect_identical(.tarjetas_sin_diferencias_texto(t), "Sin diferencias por área ni nivel en el Top Two Box.")
  t$tarjetas <- list(list(fila = "x")); expect_null(.tarjetas_sin_diferencias_texto(t))
  expect_null(.tarjetas_sin_diferencias_texto(list(tarjetas = list(), cruces = "area", grupos = NULL)))
  # En una lámina de dos, la mitad sin diferencias calla si la otra tiene tarjetas (decisión de Gonzalo, v7 ítem 18);
  # sólo cuando ninguna ranura encuentra diferencias va una línea para toda la lámina.
  t0 <- list(tarjetas = list(), cruces = "area", grupos = data.frame(cruce = "area"), rotulos_cruce = c(area = "Área"))
  t1 <- list(tarjetas = list(list(fila = "Sí")))
  expect_null(.lam_slide_2_frase_sin(list(t0, t1), list(list(overrides = list(titulo = "Motivos")), list())))
  f <- .lam_slide_2_frase_sin(list(t0, t0))
  expect_identical(f, "Sin diferencias por área.")
  expect_false(grepl("[;·—]", f))
})

test_that("ítems 10 y 11: el resumen ejecutivo lleva una sola pastilla, con el nombre completo y su corto de respaldo", {
  d <- data.frame(etiqueta = c("Algún padre o tutor con estudios universitarios", "Ningún padre o tutor con estudios universitarios"),
                  dir = c("up", "down"), fragil = c(FALSE, FALSE), valor = c(20, -20), p = c(92, 72), p_resto = c(72, 92))
  cx <- list(cortos = c("Algún padre o tutor con estudios universitarios" = "Algún padre univ."))
  c2 <- .halla_comparacion_principal(d, K = 2L, cr = "primera_gen", cx = cx)
  expect_length(c2$partes, 1L)
  expect_identical(c2$partes[[1]]$texto, "Algún padre o tutor con estudios universitarios 92%")
  expect_identical(c2$partes[[1]]$corto, "Algún padre univ. 92%")
  expect_identical(c2$cola, "frente al 72% del resto")
  formas <- .halla_res_rotulo_formas(c2$partes[[1]], w = 4, pt = 9.5)
  expect_identical(formas[[1]], c2$partes[[1]]$texto)
  expect_true(any(vapply(formas, length, 1L) == 2L))
  # «También» apagada por defecto: en el registro y en el constructor.
  tb <- Filter(function(x) identical(x$name, "tambien"), .SLIDES_META$p_slide_hallazgos$args)[[1]]
  expect_false(tb$default)
  expect_false(formals(p_slide_hallazgos)$tambien)
})

test_that("ítem 9: los grupos de un cruce van todos completos o todos cortos, y completos cuando caben", {
  et <- c("Economía y Finanzas", "Ciencias políticas y sociales", "Ningún padre o tutor con estudios universitarios",
          "Algún padre o tutor con estudios universitarios")
  co <- c("Econ. y Fin.", "CC. Pol. y Soc.", "Ningún padre univ.", "Algún padre univ.")
  cr <- c("area", "area", "padres", "padres")
  amplio <- .lam_resumen_rotulos_grupo(et, co, disponible = 20, cruces = cr)
  expect_identical(vapply(amplio$lineas, paste, "", collapse = " "), et)
  justo <- .lam_resumen_rotulos_grupo(et, co, disponible = 7.2, cruces = cr)
  usa <- vapply(justo$lineas, paste, "", collapse = " ")
  for (g in split(seq_along(cr), cr)) expect_true(all(usa[g] == et[g]) || all(usa[g] == co[g]))
  expect_lte(sum(justo$piso), 7.2 - 2.6 + 1e-6)
  expect_gt(.lam_resumen_cuerpos(0.4)$fila, .lam_resumen_cuerpos(0.3)$fila)
})

test_that("ítem 4: el alto libre engrosa la barra antes de separar los bloques, y la premisa tiene su mando", {
  fijo <- function(g) 5 * (0.32 + g)
  r <- .lam_escala_arriba_grosor(g = 0.3, gap = 0.4, n = 5, disp = fijo(0.3) + 0.4 * 4, fijo = fijo)
  expect_gt(r$g, 0.3); expect_lt(r$gap, 0.4)
  expect_identical(.lam_premisa_posicion(list(premisa_posicion = "izquierda")), "izquierda")
  expect_identical(.lam_premisa_posicion(list(premisa_posicion = "otra")), "auto")
  esp <- list(tipo = "escala", filas = data.frame(grupo_id = c(NA, NA)), premisa_posicion = "izquierda")
  expect_false(.lam_escala_arriba_aplica(esp))
  ov <- p_barras_multiapiladas(modo = "var", vars = c("p1", "p2"), premisa_posicion = "arriba")$overrides
  expect_identical(ov$premisa_posicion, "arriba")
  expect_error(p_barras_multiapiladas(modo = "var", vars = c("p1", "p2"), premisa_posicion = "abajo"), "premisa_posicion")
  reg <- Filter(function(x) identical(x$name, "premisa_posicion"), .GRAFICADORES_META$p_barras_multiapiladas$args)
  expect_length(reg, 1L); expect_identical(reg[[1]]$default, "auto")
  expect_true("premisa_posicion" %in% names(formals(graficar_barras_apiladas)))
})

test_that("ítem 8: la columna de rótulos obedece el ancho declarado y, acotada, mide su tinta", {
  rot <- c("Tendré un empleo estable relacionado con mi carrera", "Otros",
           "Desarrollaré actividades de investigación y/o docencia universitaria")
  d <- .lam_barras_ancho_rotulos(rot, ancho = 8.6, size = 11, fila = 0.46, declarada = 3.27)
  expect_equal(d$wlab, 3.27)
  a <- .lam_barras_ancho_rotulos(rot, ancho = 8.6, size = 11, fila = 0.46)
  expect_lte(a$wlab, .lam_barras_tope_rotulo() * 8.6 + 1e-9)
})
