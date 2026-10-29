# S1 del GOAL de estándar de composición (docs/qa/goal-estandar-composicion-2026-10-29.md): el plan de la multilista decide
# si una premisa lleva cifra chica con la MISMA barra que se dibuja (`.lam_escala_columnas_box()$ancho_barra`). Medía con
# la barra vieja sin box (~7,5 in) y no veía cifras que, en la barra de 6,2 in, sí salen fuera de su segmento.

.ecp_espec <- function(p) {
  niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo")
  d <- data.frame(item = "q1", N = 100, t1 = p, t2 = 0.30, t3 = 0.40, t4 = 0.30 - p, rotulo = "Una premisa")
  preparar_escala(d, "item", "N", paste0("t", 1:4), niv, var_etiqueta_categoria = "rotulo",
                  colores_grupos = as.list(setNames(.std_paleta("likert")[1:4], niv)))
}

test_that("el plan ve la cifra chica que la barra dibujada saca de su segmento (sin columna de box)", {
  wb <- .lam_escala_columnas_box(.ecp_espec(0.07))$ancho_barra
  # Un segmento cuya cifra cabe en la barra vieja de ~7,5 in y no en la de 6,2 in.
  p <- NA_real_
  for (q in seq(0.03, 0.12, by = 0.005)) {
    seg <- .lam_escala_seg(.ecp_espec(q), 1L)
    if (.lam_tiene_peq(seg, wb) && !.lam_tiene_peq(seg, wb * 7.5 / 6.2)) { p <- q; break }
  }
  skip_if(is.na(p), "no hay un segmento en la franja entre las dos barras con esta letra")
  e <- .ecp_espec(p)
  expect_true(.lam_escala_chica_por_premisa(e, .lam_escala_premisas(e)))
})
