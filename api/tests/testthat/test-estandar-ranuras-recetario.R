# K15 (Gonzalo, 2026-10-10: «sí»): las ranuras del estándar son las que DIBUJAN las láminas de ejemplo del recetario.
#
# docs/qa/motor-ppt-2026-10-06/4-recetario/recetario-moderna.pptx (nunca la copia «Repaired»), medido con python-pptx.
# x, y, w: la caja de la pregunta de cada panel (13 pt negrita); en un texto, del filete de acento al borde de su caja.
# h: hasta el filete o el panel siguiente menos 0.2 in (la regla de la corona, p160); la última fila, hasta 6.25.
# Las fichas «TIPO DE LÁMINA n DE 22» (recetario_fichas.R) dibujaban otra cosa en estos tipos: manda la lámina de
# ejemplo. Tabla antes/después: docs/qa/k15-estandar-vs-recetario-2026-10-10.md. Tolerancia, la del banco de
# conformidad (scripts/qa_estandar_conformidad.R): 0.05 in.

.K15_DIBUJADO <- list(
  p_slide_grafico_texto_derecha = list(pagina = 128L, ranuras = list(c("grafico", 0.495, 1.65, 8.6, 4.6), c("texto", 9.55, 2.45, 3.468, 3.4))),
  p_slide_grafico_texto_izquierda = list(pagina = 130L, ranuras = list(c("texto", 0.495, 2.05, 3.45, 3.4), c("grafico", 4.55, 1.75, 8.4, 4.5))),
  p_slide_2_graficos_texto_izquierda = list(pagina = 140L, ranuras = list(c("texto", 0.495, 2.05, 3.45, 3.6), c("grafico", 4.55, 1.7, 8.468, 1.6), c("grafico", 4.55, 3.7, 8.468, 2.55))),
  p_slide_2_graficos_texto_derecha = list(pagina = 142L, ranuras = list(c("grafico", 0.495, 1.7, 8.6, 1.9), c("grafico", 0.495, 3.8, 8.6, 2.45), c("texto", 9.55, 2.05, 3.468, 3.4))),
  p_slide_2_graficos_asimetrico = list(pagina = 146L, ranuras = list(c("grafico", 0.495, 1.6, 8.4, 4.65), c("grafico", 9.35, 1.6, 3.668, 4.65))),
  p_slide_3_graficos_1mas2 = list(pagina = 151L, ranuras = list(c("grafico", 0.495, 1.65, 6.012, 4.6), c("grafico", 7.007, 1.65, 6.012, 1.65), c("grafico", 7.007, 3.7, 6.012, 2.55))),
  p_slide_3_graficos_1arriba = list(pagina = 154L, ranuras = list(c("grafico", 0.495, 1.6, 12.523, 2.25), c("grafico", 0.495, 4.2, 6.012, 2.05), c("grafico", 7.007, 4.2, 6.012, 2.05))),
  p_slide_3_graficos_poblacion_tira = list(pagina = 158L, ranuras = list(c("grafico", 0.495, 1.65, 12.523, 1.18), c("grafico", 0.495, 3.33, 12.523, 1.18), c("grafico", 0.495, 5.01, 12.523, 1.24))),
  p_slide_4_graficos = list(pagina = 162L, ranuras = list(c("grafico", 0.495, 1.65, 6.012, 2.31), c("grafico", 7.007, 1.65, 6.012, 2.31), c("grafico", 0.495, 4.36, 6.012, 1.89), c("grafico", 7.007, 4.36, 6.012, 1.89))),
  p_slide_5_graficos_poblacion = list(pagina = 164L, ranuras = list(c("grafico", 0.495, 1.65, 3.908, 2.285), c("grafico", 4.803, 1.65, 3.908, 2.285), c("grafico", 9.11, 1.65, 3.908, 2.285), c("grafico", 0.495, 4.335, 5.862, 1.915), c("grafico", 7.157, 4.335, 5.862, 1.915))),
  p_slide_6_graficos_poblacion = list(pagina = 166L, ranuras = list(c("grafico", 0.495, 1.65, 3.908, 2.2), c("grafico", 4.803, 1.65, 3.908, 2.2), c("grafico", 9.11, 1.65, 3.908, 2.2), c("grafico", 0.495, 4.5, 3.908, 1.75), c("grafico", 4.803, 4.5, 3.908, 1.75), c("grafico", 9.11, 4.5, 3.908, 1.75))),
  p_slide_3_graficos_poblacion_cifras = list(pagina = 169L, ranuras = list(c("cifras", 0.495, 1.65, 3.0, 4.6), c("grafico", 3.945, 1.65, 4.312, 1.75), c("grafico", 3.945, 3.75, 4.312, 2.5), c("grafico", 8.707, 1.65, 4.312, 4.6))),
  p_slide_cifras_y_graficos = list(pagina = 171L, ranuras = list(c("cifras", 0.495, 1.65, 12.523, 1.2), c("grafico", 0.495, 3.25, 6.012, 3.0), c("grafico", 7.007, 3.25, 6.012, 3.0)))
)

test_that("las ranuras del estándar calzan con lo dibujado en la lámina de ejemplo de cada tipo (0.05 in)", {
  for (tipo in names(.K15_DIBUJADO)) {
    esperado <- .K15_DIBUJADO[[tipo]]
    r <- .std_tipo_lamina(tipo)$ranuras
    expect_length(r, length(esperado$ranuras))
    for (k in seq_along(esperado$ranuras)) {
      e <- esperado$ranuras[[k]]
      expect_identical(r[[k]]$tipo, e[[1]], label = sprintf("%s ranura %d, tipo", tipo, k))
      for (d in 2:5) {
        dim <- c("tipo", "x", "y", "w", "h")[d]
        expect_lte(abs(r[[k]][[dim]] - as.numeric(e[[d]])), 0.05,
                   label = sprintf("%s (p%d) ranura %d, %s: %.3f contra %s", tipo, esperado$pagina, k, dim, r[[k]][[dim]], e[[d]]))
      }
    }
  }
})
