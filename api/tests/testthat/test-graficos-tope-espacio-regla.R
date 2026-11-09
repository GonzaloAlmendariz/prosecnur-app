source("setup-load-all.R")

# P5 (resumen ejecutivo de Arte con 921853216, 2026-11-09): el recorte por espacio alcanza a la escala con `base$*` sin
# regla, al contraste en una ranura (por lo que la ranura de verdad admite, no por un 14 fijo) y el pie del clásico cierra
# con punto. Fixture: helper-tope-espacio-arte.R.

test_that("P5: la escala con `base$*` y sin regla se dibuja y también se recorta, con la nota de siempre", {
  src <- .tea_fuentes()
  el <- p_barras_divergentes(vars = c("docentes$*", "estudiantes$*"), n_negativas = 2, incluir_neutro = FALSE, estilo = "resumen")
  avisos <- character(0)
  plan <- p_plan(slides = list(p_slide_1_grafico(el, titulo = "Escala")))
  out <- withCallingHandlers(suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan,
                                                                solo_lista = TRUE, mensajes_progreso = FALSE)),
                             message = function(m) { avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage") })
  e <- attr(out$rendered[[1]], "pulso_espec")
  expect_identical(e$tipo, "divergentes")
  expect_length(e$filas, 20L)
  expect_identical(e$texto_regla, "Por espacio, se muestran las primeras 20 de 23; el resto en otra lámina.")
  expect_true(any(grepl("23 filas no caben en la lámina: se muestran 20", avisos, fixed = TRUE)))
  expect_false(any(grepl("Sin datos", avisos, fixed = TRUE)))
})

test_that("P5: en una ranura el contraste no se recorta a 14: la ranura deja lo que cabe por la mayor diferencia absoluta", {
  expect_true(.tope_espacio_en_ranura(list(overrides = list(ancho = 6.1))))
  expect_false(.tope_espacio_en_ranura(list(overrides = list(ancho = 12.5))))
  expect_false(.tope_espacio_en_ranura(list(overrides = list())))
  # Orden de la lámina: diferencia con signo, de mayor a menor. Las negativas grandes no se caen primero.
  dif <- c(40, 30, 5, 2, -1, -35, -45)
  V <- cbind(50 + dif / 2, 50 - dif / 2)
  pr <- .contraste_prioridad(dif, V, seq_along(dif))
  expect_identical(pr, c(2L, 4L, 5L, 6L, 7L, 3L, 1L))
  espec <- list(rotulos = sprintf("Pregunta %d", 1:7), grupos = c("A", "B"), prioridad = pr, separadores = integer(0),
                valores = V, cifras = matrix(as.character(V), 7), diferencia = dif, textos_diferencia = as.character(dif))
  f <- .lam_rr_contraste_filas(espec, w_max = 2.6, disponible = 4 * 0.24 + 0.01, pasos = rep(1, 7), par = TRUE)
  expect_identical(f$filas, c(1L, 2L, 6L, 7L))    # +40, +30, −35, −45, en el orden de la lámina
  expect_true(f$por_prioridad)
  sub <- .contraste_espec_filas(espec, f$filas)
  expect_identical(sub$diferencia, c(40, 30, -35, -45)); expect_identical(nrow(sub$valores), 4L)
  # Con separadores el bloque no se parte por la diferencia: van las primeras.
  espec$separadores <- 3L; espec$prioridad <- .contraste_prioridad(dif, V, seq_along(dif), 3L)
  expect_identical(.lam_rr_contraste_filas(espec, 2.6, 4 * 0.24 + 0.01, rep(1, 7), TRUE)$k, 4L)
  expect_null(.lam_rr_contraste_filas(espec, 2.6, 4 * 0.24 + 0.01, rep(1, 7), TRUE)$filas)
})

test_that("P5: el pie del dumbbell clásico termina con punto, en la imagen y en la lámina nativa", {
  d <- data.frame(eje = rep(c("Uno", "Dos"), 2), grupo = factor(rep(c("A", "B"), each = 2), levels = c("A", "B")), valor = c(60, 40, 50, 55))
  p <- graficar_dumbbell(d)
  expect_match(attr(p, "note_outside"), "en puntos\\.$")
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  base <- .lam_unir_base("Base: 100 casos", attr(p, "note_outside"))
  expect_identical(base, "Base: 100 casos. Diferencia: A menos B, en puntos.")
  expect_identical(paste(c("Base: 100 casos", attr(p, "note_outside")), collapse = ". "), base)   # la unión del compositor de pesas
})
