# «Tres gráficos en corona» (tipo 17 de 22): manda el recetario (decisiones F6, 2026-10-10). La página 160 de
# docs/qa/motor-ppt-2026-10-06/4-recetario/recetario-moderna.pptx dibuja DOS gráficos arriba lado a lado y UNO ancho
# abajo; el estándar le había copiado las ranuras de `p_slide_3_graficos_2mas1` (dos a la izquierda y uno alto).
#
# Cajas medidas en el XML de la p160 (python-pptx, pulgadas): pregunta de cada panel en (0.495, 1.65, 5.862),
# (7.157, 1.65, 5.862) y (0.495, 4.2, 12.523); filete vertical en x 6.757 de 1.65 a 3.8 (alto 2.15); filete
# horizontal en y 4.0 de 0.495 a 13.018; la última fila del panel de abajo termina en 6.37.

.P160 <- list(
  ranuras = list(c(x = 0.495, y = 1.65, w = 5.862, h = 2.15), c(x = 7.157, y = 1.65, w = 5.862, h = 2.15),
                 c(x = 0.495, y = 4.2, w = 12.523, h = 2.17)),
  filete_v = c(x = 6.757, y0 = 1.65, y1 = 3.8), filete_h = c(y = 4.0, x0 = 0.495, x1 = 13.018)
)
.TOL_P160 <- 0.05
.cerca <- function(actual, esperado, label = NULL) {
  testthat::expect_lte(max(abs(actual - esperado)), .TOL_P160, label = label %||% deparse(substitute(actual)))
}

test_that("las ranuras de la corona en el estándar son las de la p160 y ya no las de dos apilados + uno alto", {
  r <- Filter(function(x) identical(x$tipo, "grafico"), .std_tipo_lamina("p_slide_3_graficos_poblacion_corona")$ranuras)
  expect_length(r, 3L)
  for (k in 1:3) {
    for (d in c("x", "y", "w", "h")) {
      .cerca(r[[k]][[d]], unname(.P160$ranuras[[k]][[d]]),
             label = sprintf("ranura %d, %s", k, d))
    }
  }
  r2 <- .std_tipo_lamina("p_slide_3_graficos_2mas1")$ranuras
  expect_false(identical(lapply(r, `[`, c("x", "y", "w", "h")), lapply(r2, `[`, c("x", "y", "w", "h"))))
})

test_that("la disposición nativa de la corona sale de las ranuras del estándar", {
  g <- .lam_mixta_geo("poblacion_3_corona")
  expect_false(is.null(g))
  r <- Filter(function(x) identical(x$tipo, "grafico"), .std_tipo_lamina("p_slide_3_graficos_poblacion_corona")$ranuras)
  for (k in 1:3) {
    expect_equal(g$paneles[[k]]$x, r[[k]]$x)
    expect_equal(g$paneles[[k]]$y, r[[k]]$y)
    expect_equal(g$paneles[[k]]$w, r[[k]]$w)
  }
  expect_equal(g$paneles[[1]]$h, r[[1]]$h)
  # El panel de abajo dibuja hasta el fin del contenido, como el de abajo de las demás mixtas.
  expect_equal(g$paneles[[3]]$y + g$paneles[[3]]$h, .std_geom("contenido_y1"))
})

.cr_fixture <- function() {
  edad <- c("De 18 a 30 años", "De 31 a 40 años", "De 41 a 50 años", "De 51 años a más")
  grado <- c("Bachiller", "Magíster", "Doctor")
  df <- data.frame(sexo = rep(c("Masculino", "Femenino"), c(33, 19)), grado = rep(grado, c(10, 38, 4)),
                   edad = rep(edad, c(10, 7, 12, 23)), stringsAsFactors = FALSE)
  ch <- rbind(data.frame(list_name = "ls", name = c("Masculino", "Femenino"), label = c("Masculino", "Femenino")),
              data.frame(list_name = "lg", name = grado, label = grado), data.frame(list_name = "le", name = edad, label = edad))
  inst <- list(survey = data.frame(name = c("sexo", "grado", "edad"), type = paste("select_one", c("ls", "lg", "le")),
                                   list_name = c("ls", "lg", "le"), label = c("Sexo", "Máximo grado alcanzado", "Rango de edades"),
                                   stringsAsFactors = FALSE), choices = ch, orders_list = NULL)
  list(df = df, inst = inst)
}

.cr_off <- function(xml, nombre) {
  sp <- xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  off <- xml2::xml_find_first(sp, "./p:spPr/a:xfrm/a:off"); ext <- xml2::xml_find_first(sp, "./p:spPr/a:xfrm/a:ext")
  data.frame(x = as.numeric(xml2::xml_attr(off, "x")) / 914400, y = as.numeric(xml2::xml_attr(off, "y")) / 914400,
             w = as.numeric(xml2::xml_attr(ext, "cx")) / 914400, h = as.numeric(xml2::xml_attr(ext, "cy")) / 914400,
             texto = xml2::xml_text(sp))
}

test_that("una lámina corona generada sale nativa y calza con la p160 (tolerancia 0.05 in)", {
  f <- .cr_fixture(); out <- tempfile(fileext = ".pptx")
  plan <- list(a = p_slide_3_graficos_poblacion_corona(p_barras_categoricas("sexo"), p_barras_categoricas("grado"),
                                                       p_barras_categoricas("edad"), titulo = "Perfil del docente"))
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$df, instrumento = f$inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  xml <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  nm <- xml2::xml_attr(xml2::xml_find_all(xml, "//p:cNvPr"), "name")
  expect_true("prosecnur:grafico:mixta" %in% nm)

  q <- .cr_off(xml, "panel:pregunta")
  expect_identical(q$texto, c("Sexo", "Máximo grado alcanzado", "Rango de edades"))
  for (k in 1:3) {
    for (d in c("x", "y", "w")) {
      .cerca(q[[d]][k], unname(.P160$ranuras[[k]][[d]]),
             label = sprintf("pregunta del panel %d, %s", k, d))
    }
  }
  s <- .cr_off(xml, "separador")
  v <- s[s$w < 0.05, ]; h <- s[s$h < 0.05, ]
  expect_equal(nrow(v), 1L); expect_equal(nrow(h), 1L)
  .cerca(v$x, unname(.P160$filete_v[["x"]]))
  .cerca(v$y, unname(.P160$filete_v[["y0"]]))
  .cerca(v$y + v$h, unname(.P160$filete_v[["y1"]]))
  .cerca(h$y, unname(.P160$filete_h[["y"]]))
  .cerca(h$x, unname(.P160$filete_h[["x0"]]))
  .cerca(h$x + h$w, unname(.P160$filete_h[["x1"]]))
  # La dicotomía (sexo) va arriba a la izquierda; las barras de grado (3) y de edad (4) en sus paneles.
  expect_equal(nrow(.cr_off(xml, "dicotomia:segmento")), 2L)
  b <- .cr_off(xml, "barra")
  expect_equal(sum(b$y < 4.0 & b$x > 6.757), 3L)
  expect_equal(sum(b$y > 4.0), 4L)
  # Filas: la primera de cada panel cae donde la p160 (2.28 arriba, 4.82 abajo). El paso de las filas lo pone la regla
  # compartida de los paneles mixtos (`.lam_panel_geo`: 90 % del alto, tope 0.5 in), no la ranura: abajo da 0.4365 in
  # contra los 0.42 que la p160 fija a mano, y la cuarta fila queda 0.09 in más abajo (declarado, no se ajusta aquí).
  sup <- sort(b$y[b$y < 4.0]); inf <- sort(b$y[b$y > 4.0])
  .cerca(sup, c(2.28, 2.70, 3.12))
  .cerca(inf[1], 4.82)
  expect_lte(max(abs(inf - c(4.82, 5.24, 5.66, 6.08))), 0.1)
})
