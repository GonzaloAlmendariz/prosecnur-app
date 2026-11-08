# Ola 2, E2a (fix3/before/p-5.png, lámina «Agrupada mixta»): en una lámina de dos gráficos en vertical, la agrupada con
# cruce monta las cifras de las dos series del par una sobre otra (10%/27%, 18%/19%: 0.01 in de aire entre cajas que se
# cruzan en x). Y con el alto real del cajón (diag4/e2_alto.R) las cifras bajaban de 14 pt hasta desaparecer: el arreglo
# no puede pagar el aire achicando el cuerpo.
#
# Contrato: cada cifra del cruce al cuerpo del preset (`.std_pt("cifra")`, 14 pt), y ningún par de cifras con las x
# cruzadas tiene menos de 0.03 in de aire vertical.

.ola2_e2a_cifras <- function(ov_sup = list()) {
  fx <- .ola2_familias()
  sl <- list(p_slide_2_graficos_vertical(
    titulo = "Agrupada mixta",
    superior = p_barras_agrupadas(var = "doc$cat6", cruces = "doc$sx", overrides = ov_sup),
    inferior = p_barras_agrupadas(var = "doc$q19", cruces = "doc$ded")))
  pth <- .ola2_pptx(fx, sl)
  cajas <- .ola2_cajas(pth, 1L)
  # E5: los ejes y las leyendas llevan las etiquetas del instrumento.
  expect_true(all(c("Mujer", "Hombre", "Arquitectura", "Tiempo completo (TC)") %in% cajas$texto))
  cajas[.ola2_es_cifra(cajas$texto), , drop = FALSE]
}

.ola2_e2a_contrato <- function(cifras) {
  # Las dos agrupadas son cruces: 6 x 2 arriba y 5 x 2 abajo (sin ceros en estos datos).
  expect_gte(nrow(cifras), 20L)

  piso <- .std_pt("cifra")
  chicas <- cifras[is.na(cifras$pt) | cifras$pt < piso - 0.15, , drop = FALSE]
  expect_identical(sprintf("%s a %.2f pt", chicas$texto, chicas$pt), character(0))

  montadas <- character(0)
  n <- nrow(cifras)
  for (i in seq_len(n - 1)) for (j in (i + 1):n) {
    a <- cifras[i, ]; b <- cifras[j, ]
    cruzan_x <- min(a$x1, b$x1) - max(a$x0, b$x0) > 0
    aire <- .ola2_aire_y(a, b)
    if (cruzan_x && aire < 0.03) montadas <- c(montadas, sprintf("%s / %s: %.3f in de aire", a$texto, b$texto, aire))
  }
  expect_identical(montadas, character(0))
}

test_that("E2a: agrupada mixta en composición: cifras al cuerpo del preset y sin cifras montadas", {
  skip_if_not_installed("officer")
  .ola2_e2a_contrato(.ola2_e2a_cifras())
})

test_that("E2a: con el alto real del cajón (2.565 in) las cifras del cruce no bajan del preset ni se montan", {
  skip_if_not_installed("officer")
  # diag4/e2_alto.R: el alto real del cajón superior de la lámina de dos en vertical. El arreglo (c) hará que la
  # composición pase ese alto a la agrupada con cruce; aquí se declara a mano para fijar el contrato desde hoy.
  .ola2_e2a_contrato(.ola2_e2a_cifras(list(alto = 2.565)))
})

