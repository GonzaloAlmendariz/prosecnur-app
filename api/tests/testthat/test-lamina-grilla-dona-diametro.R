# CCSS-26 (CCSS Perfil 2026, `p_slide_6_graficos_poblacion`): las donas de la fila de abajo (celdas de 1.75 in de alto)
# salían más chicas que las de arriba (2.2 in). En una grilla todas las donas llevan el mismo diámetro: el que cabe en la
# celda más baja.

.dd_espec <- function(rot, v) attr(suppressWarnings(graficar_pie(data.frame(c = rot, p = v / sum(v), n = v), "c", "p", var_n = "n", tipo_pie = "donut")), "pulso_espec")

test_that("en la grilla de seis todas las donas tienen el mismo diámetro", {
  P <- .lam_mixta_geo("poblacion_6")$paneles
  for (e in list(.dd_espec(c("VI", "VII", "VIII", "IX"), c(120, 120, 96, 64)), .dd_espec(c("Privado", "Estatal"), c(340, 60)),
                 .dd_espec(c("Femenino", "Masculino", "Persona de género no binario", "Prefiero no responder"), c(212, 182, 9, 1)))) {
    d <- vapply(P, function(p) .lam_panel_circular_geo(e, p$x, p$y, p$w, p$h)$d, 0)
    expect_lt(diff(range(d)), 1e-6)
  }
})

test_that("en la cuadrícula de 2 x 2 y en la de dos gráficos el diámetro no cambia", {
  e <- .dd_espec(c("VI", "VII", "VIII", "IX"), c(120, 120, 96, 64))
  p <- .lam_mixta_geo("paneles_4")$paneles[[1]]
  expect_equal(.lam_panel_circular_geo(e, p$x, p$y, p$w, p$h)$d, min(p$y + p$h - (p$y + 0.62) - 0.1, p$w * 0.42, 2.6))
  p <- .lam_mixta_geo("graficos_2")$paneles[[1]]
  expect_equal(.lam_panel_circular_geo(e, p$x, p$y, p$w, p$h)$d, min(p$y + p$h - (p$y + 0.62) - 0.1, p$w * 0.42, 2.6))
})
