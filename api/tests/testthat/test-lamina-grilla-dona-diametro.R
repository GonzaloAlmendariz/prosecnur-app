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

test_that("en la cuadrícula de 2 x 2 y en la de dos gráficos la figura toma todo el alto o todo el ancho que deja su leyenda", {
  # Revisión del PPT v7 de CCSS (lámina 23): «la dona no aprovecha todo su alto». Antes el disco tenía un tope de 42 % del
  # ancho del panel y de 2.6 in; ahora sólo lo limitan el alto del cajón y el ancho que deja su leyenda angosta.
  e <- .dd_espec(c("VI", "VII", "VIII", "IX"), c(120, 120, 96, 64))   # sin porciones chicas: 0.05 in de aire alrededor
  for (tipo in c("paneles_4", "graficos_2")) {
    p <- .lam_mixta_geo(tipo)$paneles[[1]]
    g <- .lam_panel_circular_geo(e, p$x, p$y, p$w, p$h)
    alto <- p$y + p$h - (p$y + 0.62) - 0.1
    expect_equal(g$d, min(alto - 0.1, p$w - g$ley$w - .LAM_PANEL_HUECO - 0.1), tolerance = 1e-6, info = tipo)
  }
  p <- .lam_mixta_geo("graficos_2")$paneles[[1]]
  expect_gt(.lam_panel_circular_geo(e, p$x, p$y, p$w, p$h)$d, min(p$h - 0.72, p$w * 0.42, 2.6) + 0.5)
})
