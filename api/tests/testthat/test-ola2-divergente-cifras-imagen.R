# Ola 2, E1b (diag4/e1b_repel.R): la divergente que sale como imagen (en una lámina de dos gráficos en vertical) pone las
# cifras de los segmentos chicos con position_stack, sin repulsión: «4%» y «5%» vecinos en el lado negativo se pisan,
# y el gráfico achica el cuerpo de las cifras (8.5 pt) en vez de sacarlas con guía. Además oculta las cifras bajo el 3 %
# (umbral_etiqueta_pct), cuando la lámina nativa las muestra con guía.
#
# Decisión del lead: la imagen muestra toda cifra legible: al cuerpo del preset (`.std_pt("cifra")`), sin solapes, y las
# de menos de 3 % fuera con su guía, igual que la nativa. Nunca se achica.

.ola2_e1b_lamina <- function() {
  fx <- .ola2_e1b()
  sl <- list(p_slide_2_graficos_vertical(
    titulo = "Divergente chica",
    superior = p_barras_divergentes(vars = c("doc$q1", "doc$q2"), n_negativas = 2, incluir_neutro = FALSE),
    inferior = p_barras_agrupadas(var = "doc$q1")))
  pth <- .ola2_pptx(fx, sl)
  formas <- .ola2_formas(pth, 1L)
  cajas <- formas[nzchar(formas$texto), , drop = FALSE]
  # Las cifras de la divergente: las que están a la altura de una de sus premisas (las marcas del eje, abajo, no).
  prem <- cajas[cajas$texto %in% c("Pregunta uno", "Pregunta dos"), , drop = FALSE]
  centro <- (cajas$y0 + cajas$y1) / 2
  en_fila <- vapply(centro, function(y) any(abs(y - (prem$y0 + prem$y1) / 2) < 0.45), logical(1))
  list(formas = formas, cajas = cajas, prem = prem,
       cifras = cajas[.ola2_es_cifra(cajas$texto) & en_fila, , drop = FALSE])
}

test_that("E1b: las cifras de la divergente imagen no se pisan entre sí", {
  skip_if_not_installed("officer")
  r <- .ola2_e1b_lamina()
  expect_identical(nrow(r$prem), 2L)
  expect_gt(nrow(r$cajas), 10L)
  expect_identical(.ola2_solapes(r$cajas), character(0))
})

test_that("E1b: todas las cifras de la divergente imagen van al cuerpo del preset", {
  skip_if_not_installed("officer")
  r <- .ola2_e1b_lamina()
  expect_gt(nrow(r$cifras), 0L)
  piso <- .std_pt("cifra")
  chicas <- r$cifras[is.na(r$cifras$pt) | r$cifras$pt < piso - 0.15, , drop = FALSE]
  expect_identical(sprintf("%s a %.2f pt", chicas$texto, chicas$pt), character(0))
})

test_that("E1b: la cifra de menos de 3 % se muestra, con una guía hacia su segmento", {
  skip_if_not_installed("officer")
  r <- .ola2_e1b_lamina()
  # Pregunta dos: «Totalmente en desacuerdo» = 2 % (4 de 200).
  fila2 <- (r$prem$y0[r$prem$texto == "Pregunta dos"] + r$prem$y1[r$prem$texto == "Pregunta dos"]) / 2
  # La cifra que no cabe va ENCIMA de su barra (la regla de la casa, «arriba con guía»): su centro queda a media barra más
  # su caja del centro de la fila; 0.45 in y no 0.3 (el umbral del primer borrador del test suponía la cifra a su lado).
  c2 <- r$cifras[r$cifras$texto == "2%" & abs((r$cifras$y0 + r$cifras$y1) / 2 - fila2) < 0.45, , drop = FALSE]
  expect_identical(nrow(c2), 1L)
  if (nrow(c2) != 1L) return(invisible(NULL))
  # Guía: un trazo sin texto (línea o curva libre) que toca la caja de la cifra (0.06 in de holgura) y es corto: las
  # rejillas verticales del panel miden todo su alto.
  trazos <- r$formas[!nzchar(r$formas$texto) & r$formas$cust, , drop = FALSE]
  largo <- sqrt((trazos$x1 - trazos$x0)^2 + (trazos$y1 - trazos$y0)^2)
  h <- 0.06
  toca <- trazos$x0 <= c2$x1 + h & trazos$x1 >= c2$x0 - h & trazos$y0 <= c2$y1 + h & trazos$y1 >= c2$y0 - h
  expect_true(any(toca & largo > 0.02 & largo < 1))
})
