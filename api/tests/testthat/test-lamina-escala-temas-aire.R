# G11/G13/G19/G20 (Gabriela Palacios, revisión de Arte 2026-10-28). Las barras de un mismo tema más juntas y más aire
# entre temas, sin que el bloque crezca (lamina_escala_temas.R); el bloque arranca arriba, bajo el título; la columna
# Top Two Box más pegada a la barra y la barra más larga; el rótulo de la columna en mayúsculas en la lámina.
.gta_formas <- function(doc) {
  x <- doc$slide$get_slide(doc$cursor)$get()
  sp <- xml2::xml_find_all(x, "//p:sp")
  nm <- xml2::xml_attr(xml2::xml_find_first(sp, "p:nvSpPr/p:cNvPr"), "name")
  g <- function(a) as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, paste0("p:spPr/a:xfrm/", if (a %in% c("x", "y")) "a:off" else "a:ext")),
                                             switch(a, x = "x", y = "y", w = "cx", h = "cy"))) / 914400
  data.frame(nombre = nm, x = g("x"), y = g("y"), w = g("w"), h = g("h"), texto = xml2::xml_text(sp), stringsAsFactors = FALSE)
}
.gta_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
# Dos temas con tres públicos cada uno; cifras que caben en su segmento (ninguna cifra chica).
.gta_espec <- function(t1 = 0.10, t2 = 0.20) {
  niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo")
  d <- data.frame(item = sprintf("p%02d", 1:6), N = 120, t1 = t1, t2 = t2, t3 = 0.30, t4 = 1 - t1 - t2 - 0.30,
                  rotulo = rep(c("Docentes", "Estudiantes", "Egresados"), 2))
  e <- preparar_escala(d, "item", "N", paste0("t", 1:4), niv, var_etiqueta_categoria = "rotulo",
                       colores_grupos = as.list(setNames(.std_paleta("likert")[1:4], niv)),
                       barra_extra_preset = "top2box", top2box_labels = niv[3:4])
  e$filas$grupo_id <- rep(c("g1", "g2"), each = 3); e$filas$grupo_titulo <- rep(c("Primera premisa", "Segunda premisa"), each = 3)
  e
}
.gta_barras <- function(f) {
  seg <- f[f$nombre == "segmento", ]
  ys <- sort(unique(round(seg$y, 4))); h <- seg$h[1]
  list(y = ys, h = h, aire = diff(ys) - h, x0 = min(seg$x), fin = max(seg$x + seg$w))
}

test_that("el helper junta las filas de cada tema, pasa el aire a la separación entre temas y no crece", {
  g <- 0.44; fila <- g + 0.5
  r <- .lam_escala_temas_aire(hn = c(0.6, 0.6), nf = c(3, 3), fila = fila, g = g, gaps = 0.5,
                              chica = list(rep(FALSE, 3), rep(FALSE, 3)))
  expect_equal(r$filas - g, rep(.std_comp("escala", "aire_tema"), 2))
  alto0 <- 2 * 3 * fila + 0.5
  expect_lte(r$alto, alto0 + 1e-9)
  # Aire entre temas (última barra de uno a primera del otro): antes fila - g + gap; ahora mayor, hasta el tope.
  expect_gt(r$gaps + .std_comp("escala", "aire_tema"), (fila - g) + 0.5)
  expect_lte(r$gaps + .std_comp("escala", "aire_tema"), max((fila - g) + 0.5, .std_comp("escala", "aire_entre_temas_max")) + 1e-9)
})

test_that("una cifra chica entre barras del mismo tema conserva su aire; un bloque apretado no se toca", {
  g <- 0.44
  r <- .lam_escala_temas_aire(hn = c(0.6, 0.6), nf = c(3, 3), fila = g + 0.6, g = g, gaps = 0.3,
                              chica = list(c(FALSE, TRUE, FALSE), rep(FALSE, 3)))
  expect_equal(r$filas[1] - g, max(0.28 + .lam_holgura_chica(), .std_aire_chica()))
  expect_equal(r$filas[2] - g, .std_comp("escala", "aire_tema"))
  # Venía con menos aire del que pediría la cifra chica: se queda como estaba (nunca se abre la fila).
  r2 <- .lam_escala_temas_aire(hn = c(0.6, 0.6), nf = c(3, 3), fila = g + 0.24, g = g, gaps = 0.26,
                               chica = list(c(FALSE, TRUE, TRUE), c(TRUE, TRUE, TRUE)))
  expect_equal(r2$filas - g, rep(0.24, 2))
  expect_equal(r2$alto, 2 * 3 * (g + 0.24) + 0.26)
})

test_that("en la lámina: el aire dentro del tema es menor que entre temas y el bloque arranca bajo el título (G11/G19)", {
  withr::local_options(prosecnur.grosor_piso_cm = 0)
  o <- suppressMessages(.lam_laminas_escala(.gta_doc(), .gta_espec(), "Formulación", folio = 1))
  expect_identical(o$partes, 1L)
  f <- .gta_formas(o$doc); b <- .gta_barras(f)
  expect_length(b$y, 6L)
  dentro <- b$aire[c(1, 2, 4, 5)]; entre <- b$aire[3]
  expect_true(all(abs(dentro - .std_comp("escala", "aire_tema")) < 1e-3))
  expect_gt(entre, 3 * max(dentro))
  # Arriba: el rótulo de la columna queda 0,45 in sobre el inicio de la franja (zona de datos + 0,1); una lámina que ya
  # llena su alto sólo baja lo poco que le sobra al centrarse (lamina_escala_llenar.R).
  rot <- f[f$nombre == "box:rotulo", ]
  expect_gte(rot$y, .std_geom("zona_datos_y0") + 0.1 - 0.45 - 1e-3)
  expect_lt(rot$y, .std_geom("zona_datos_y0") + 0.1 - 0.45 + 0.1)
  expect_lt(min(b$y), .std_geom("zona_datos_y0") + 0.1 + 0.4)
  # Nada sale de la franja de datos (la leyenda incluida) ni de la lámina.
  gr <- f[!grepl("lamina", f$nombre), ]   # sin el pie (base y folio) ni el título
  expect_lte(max(gr$y + gr$h), .std_geom("base_y") + 1e-6)
  expect_lte(max(gr$x + gr$w), .std_geom("ancho") - .std_geom("margen_der") + 1e-6)
})

test_that("la columna Top Two Box se acerca y la barra se alarga; el rótulo va en mayúsculas sólo en la lámina (G13/G20)", {
  withr::local_options(prosecnur.grosor_piso_cm = 0)
  e <- .gta_espec()
  o <- suppressMessages(.lam_laminas_escala(.gta_doc(), e, "Formulación", folio = 1))
  f <- .gta_formas(o$doc); b <- .gta_barras(f); L <- .std_geom("likert")
  expect_equal(b$fin, L$x_barra + L$ancho_barra, tolerance = 0.01)
  expect_equal(b$fin, 11.4, tolerance = 0.01)   # Contabilidad: la barra termina en 11,43 in
  cif <- f[f$nombre == "box:cifra", ]
  expect_equal(unique(round(cif$x + cif$w / 2, 3)), 12.25, tolerance = 1e-3)
  # La cifra del box (14 pt, centrada) queda donde la pone Contabilidad (~0,65 in de tinta tras la barra), y el rótulo
  # no se mete sobre la barra (Gonzalo, 2026-10-28: «el top two box ahora se está metiendo en las barras»).
  tinta <- max(.lam_ancho_tinta(cif$texto, .std_pt("cifra"), TRUE))
  hueco <- (12.25 - tinta / 2) - b$fin
  expect_gt(hueco, 0.45); expect_lt(hueco, 0.8)
  rot <- f[f$nombre == "box:rotulo", ]
  expect_gte(min(rot$x + rot$w / 2) - .lam_ancho_tinta("TOP TWO BOX", .std_pt("rotulo_top_two_box"), TRUE) / 2 - b$fin, 0.25)
  expect_identical(unique(f$texto[f$nombre == "box:rotulo"]), "TOP TWO BOX")
  # La especificación (la que leen el Word y la UI) conserva su rótulo.
  expect_identical(e$box$rotulo %||% .PPT_ROTULO_TOP_TWO_BOX, "Top Two Box")
})
