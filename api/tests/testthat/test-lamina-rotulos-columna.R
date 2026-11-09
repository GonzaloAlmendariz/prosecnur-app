source("setup-load-all.R")

# Gonzalo, 2026-11-09, sobre el resumen de Arte: «sobreestimas el tamaño de las etiquetas del eje, y demasiado»; «la
# etiqueta no debe tener esos tres puntos suspensivos». El medidor único (`.lam_ancho_tinta`) y la columna de rótulos a
# la medida de sus rótulos (`.lam_rotulos_columna`, lamina_rotulos_columna.R).

test_that("el medidor respeta la letra fraccionaria y coincide con la tinta que compone PowerPoint (menos de 3 %)", {
  # Tinta medida en el PDF que exporta PowerPoint (Arial, cuadros de `.lam_txt`, 300 dpi), 2026-11-09.
  pp <- data.frame(t = c("Servicio de salud", "Carga docente equilibrada (Doc.)", "La FAD fomenta la movilidad estudiantil",
                         "Investigación-creación docente suficiente (Doc.)"),
                   s105 = c(1.097, 2.143, 2.550, 3.093), s12 = c(1.240, 2.427, 2.900, 3.510), stringsAsFactors = FALSE)
  w105 <- .lam_ancho_tinta(pp$t, 10.5); w11 <- .lam_ancho_tinta(pp$t, 11); w12 <- .lam_ancho_tinta(pp$t, 12)
  expect_true(all(w105 < w11))                       # con res = 72, 10.5 pt se medía como 11 pt
  expect_true(all(abs(w105 / pp$s105 - 1) < 0.03))
  expect_true(all(abs(w12 / pp$s12 - 1) < 0.03))
  # La cuenta por caracteres ya no se usa: mide lo mismo que la tinta.
  expect_equal(.lam_ancho_txt(pp$t, 12), w12)
})

.rc_alto_holgado <- function(nl, size) list(u = 0.3, alturas = pmax(0.3, nl * size * 1.2 / 72 + 0.05))

test_that("S5: con rótulos cortos la columna mide lo que pide el más largo, sin holgura de más", {
  tx <- c("Carga docente equilibrada (Doc.)", "Bienestar psicológico (Est.)", "Reglamentos se aplican correctamente (Doc.)",
          "Programas de ayuda al trabajador (Adm.)")
  f <- .lam_rotulos_columna(tx, NULL, w_min = 1.2, w_max = 5.5, desde = 12, alto = .rc_alto_holgado)
  expect_equal(f$k, 4L)
  expect_true(all(f$n_lineas == 1L))
  # Del fin de la tinta del rótulo más largo al borde de la columna: los márgenes del cuadro (0.22 in) y nada más que
  # el paso de búsqueda (lo que el estándar de la casa pone después es la calle de 0.2 in hasta la escala).
  sobra <- f$wq - max(.lam_ancho_tinta(tx, f$size)) - 0.22
  expect_gte(sobra, -1e-6)
  expect_lt(sobra, 0.1)
})

test_that("S5: un rótulo largo se parte y no carga a la columna con su ancho", {
  largo <- paste("Los administrativos de la Unidad participamos de actividades de responsabilidad social universitaria",
                 "de la Universidad. (Adm.)")
  tx <- c("Carga docente equilibrada (Doc.)", "Bienestar psicológico (Est.)", "Reglamentos se aplican correctamente (Doc.)", largo)
  f <- .lam_rotulos_columna(tx, NULL, w_min = 1.2, w_max = 5.5, desde = 12, alto = .rc_alto_holgado)
  expect_lt(f$wq, max(.lam_ancho_tinta(tx[1:3], f$size)) + 0.35)
  expect_gt(f$n_lineas[4], 1L)
  expect_lte(f$n_lineas[4], 4L)
})

test_that("S4: un rótulo que ni en cuatro líneas cabe no se corta; va entero y se pide un rótulo corto", {
  largo <- paste(rep("El Departamento de Arte y Diseño fomenta la participación de docentes en el medio profesional", 3), collapse = " ")
  f <- .lam_rotulos_columna(c("Servicio de salud", largo), NULL, w_min = 1.2, w_max = 2.5, desde = 12, alto = .rc_alto_holgado)
  expect_identical(f$textos[2], largo)
  expect_false(any(grepl("…", f$textos, fixed = TRUE)))
  expect_identical(f$largos, largo)
  expect_message(.lam_rotulos_largos_aviso(f$largos),
                 "El rótulo de \"El Departamento de Arte y Diseño\" es largo: dale un rótulo corto en Gráficos › Identidad › Rótulos cortos.",
                 fixed = TRUE)
})

test_that("S4: si las filas no caben con los rótulos enteros, van menos filas en el orden de la prioridad", {
  tx <- paste("Pregunta", 1:12, "con un enunciado bastante largo que necesita varias líneas para leerse entero en la columna")
  alto <- function(nl, size) { a <- nl * size * 1.2 / 72 + 0.05; if (sum(a) > 3) NULL else list(u = 0.2, alturas = a) }
  f <- .lam_rotulos_columna(tx, prioridad = 12:1, w_min = 1.2, w_max = 2.4, desde = 11, alto = alto, n_min = 1L)
  expect_lt(f$k, 12L)
  expect_identical(f$filas, sort(12:1)[seq(12 - f$k + 1L, 12)])   # las de prioridad 1, 2, … (las últimas del orden)
  expect_false(any(grepl("…", f$textos, fixed = TRUE)))
})
