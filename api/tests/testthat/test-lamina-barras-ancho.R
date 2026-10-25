# CCSS-8 (2026-10-25): las barras horizontales de una categórica usan el ancho útil de la lámina.
# Defecto: la columna de rótulos medía el más largo (hasta 6.3 in) y las barras quedaban angostas al fondo; con el eje
# libre, además, la escala no llegaba al máximo. El 0-100 % por defecto (recetario p74) se conserva.

.cajas_lamina <- function(out, nombre) {
  xml <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  sp <- xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  num <- function(xp, at) as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, xp), at)) / 914400
  data.frame(x = num(".//a:off", "x"), y = num(".//a:off", "y"), w = num(".//a:ext", "cx"), h = num(".//a:ext", "cy"),
             txt = xml2::xml_text(sp), size = as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, ".//a:rPr"), "sz")) / 100,
             stringsAsFactors = FALSE)
}

.lamina_una_serie <- function(niveles, conteos, overrides = list()) {
  dat <- data.frame(p1 = rep(niveles, conteos), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = "p1", type = "select_one l", list_name = "l", label = "Pregunta", stringsAsFactors = FALSE),
               choices = data.frame(list_name = "l", name = niveles, label = niveles, stringsAsFactors = FALSE), orders_list = NULL)
  plan <- list(b = p_slide_1_grafico(grafico = p_barras_agrupadas("p1", overrides = overrides), titulo = "Lámina"))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  out
}

.util <- function() {
  ml <- .std_geom("margen_izq"); list(x0 = ml, ancho = .std_geom("ancho") - ml - .std_geom("margen_der"))
}

niv6 <- c("Economía", "Relaciones Internacionales", "Ciencia Política y Gobierno", "Finanzas", "Antropología", "Sociología")
n6 <- c(183, 91, 67, 44, 12, 8)

test_that("con el eje libre la mayor mide 80-87 % del área de barras y el bloque llena el ancho útil", {
  skip_if_not_installed("officer")
  out <- .lamina_una_serie(niv6, n6, overrides = list(usar_eje_libre = TRUE))
  u <- .util(); b <- .cajas_lamina(out, "barra"); r <- .cajas_lamina(out, "rotulo"); cf <- .cajas_lamina(out, "cifra")
  expect_equal(nrow(b), 6L)
  area <- u$x0 + u$ancho - min(b$x)
  expect_gte(max(b$w) / area, 0.80)
  expect_lte(max(b$w) / area, 0.87 + 1e-6)
  k <- which.max(b$w)
  expect_gte(cf$x[k] + cf$w[k], u$x0 + 0.95 * u$ancho)   # la cifra de la mayor llega al borde del ancho útil
  expect_lte(cf$x[k] + cf$w[k], u$x0 + u$ancho + 1e-6)
  expect_lt(max(r$w), 0.35 * u$ancho)                    # rótulos cortos: la columna mide lo que miden
  expect_identical(cf$txt, c("45.2%", "22.5%", "16.5%", "10.9%", "3%", "2%"))   # cifras y orden sin tocar
})

test_that("por defecto el eje sigue de 0 a 100 % (recetario p74) y las cifras no cambian", {
  skip_if_not_installed("officer")
  out <- .lamina_una_serie(niv6, n6)
  u <- .util(); b <- .cajas_lamina(out, "barra"); cf <- .cajas_lamina(out, "cifra"); r <- .cajas_lamina(out, "rotulo")
  wbar <- u$x0 + u$ancho - max(r$x + r$w) - max(0.8, max(.lam_ancho_tinta(cf$txt, cf$size[1], TRUE)) + 0.12)
  expect_equal(max(b$w) / wbar, 183 / sum(n6), tolerance = 1e-3)   # 45.2 % mide el 45.2 % del área: 0-100
  expect_identical(cf$txt, c("45.2%", "22.5%", "16.5%", "10.9%", "3%", "2%"))
})

test_that("rótulos largos: la columna no pasa del 35 % del ancho útil, envuelve hasta 3 líneas y no se pisa con la barra", {
  skip_if_not_installed("officer")
  niv <- c("Me esfuerzo en todos mis cursos, independientemente de si me gustan o no.",
           "Me involucro en los cursos que me gustan; en los demás, hago lo necesario.",
           "Depende de presiones externas como calificaciones, presión familiar, fechas límites, entre otras.",
           "Más que el contenido, me motiva avanzar rápido y graduarme.")
  u <- .util()
  for (ov in list(list(), list(usar_eje_libre = TRUE))) {   # la columna se acota con el eje de 0 a 100 % y con el libre
    out <- .lamina_una_serie(niv, c(206, 143, 32, 16), overrides = ov)
    b <- .cajas_lamina(out, "barra"); r <- .cajas_lamina(out, "rotulo")
    expect_lte(max(r$x + r$w) - min(r$x), 0.35 * u$ancho + 1e-6)
    expect_true(all(r$size >= 11))
    expect_true(all(.lam_lineas_tinta(r$txt, max(r$w), min(r$size)) <= 3L))
    expect_true(all(r$x + r$w <= min(b$x) + 1e-6))
  }
  area <- u$x0 + u$ancho - min(b$x)
  expect_gte(max(b$w) / area, 0.80)   # el último, con eje libre
})

test_that("con escala completa (con o sin marcas) el eje no se reescala; sólo con el eje libre", {
  e <- preparar_categorica(c("A", "B", "C", "D"), c(0.5, 0.25, 0.15, 0.1), c("50%", "25%", "15%", "10%"))
  e$escala_completa <- TRUE; e$marcas_eje <- TRUE
  expect_null(.lam_barras_ancho_geo(e, 12, 2, 12))
  e$marcas_eje <- FALSE
  expect_null(.lam_barras_ancho_geo(e, 12, 2, 12))
  e$escala_completa <- FALSE
  g <- .lam_barras_ancho_geo(e, 12, 2, 12)
  expect_equal(g$bw_max / g$wbar_area, 1 / 1.15, tolerance = 1e-6)
})

test_that("con tres categorías o menos el bloque no se estira: mide el 75 % y se centra", {
  e <- preparar_categorica(c("A", "B", "C"), c(0.5, 0.3, 0.2), c("50%", "30%", "20%"))
  g <- .lam_barras_ancho_geo(e, 12, 2, 12)
  expect_equal(g$w, 9); expect_equal(g$dx, 1.5)
})

test_that("el encabezado de selección múltiple no pisa un subtítulo que cae en su franja (CCSS lámina 57)", {
  sub <- "Uno de cada tres trabaja para ayudar económicamente en su hogar."
  tit <- "Cubrir gastos personales y ganar experiencia son los principales motivos para trabajar"
  x <- .lam_barras_ancho_x_encabezado(3, sub, tit)
  expect_gt(x, .std_geom("margen_izq") + max(.lam_ancho_tinta(sub, 12.5)))
  expect_equal(.lam_barras_ancho_x_encabezado(3, NULL, tit), 3)
})
