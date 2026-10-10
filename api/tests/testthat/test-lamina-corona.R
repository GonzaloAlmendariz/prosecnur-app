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
  # Filas: las de la p160, 0.42 in en los dos paneles (recetario_m2c.R:44 y :48, `fila = 0.42`).
  sup <- sort(b$y[b$y < 4.0]); inf <- sort(b$y[b$y > 4.0])
  .cerca(sup, c(2.28, 2.70, 3.12))
  .cerca(inf, c(4.82, 5.24, 5.66, 6.08))
  expect_equal(diff(inf), rep(0.42, 3), tolerance = 0.005)
})

# Lo que mide la p160 a lo ancho (python-pptx sobre recetario-moderna.pptx, pulgadas). El test de arriba medía sólo y;
# el verificador encontró cuatro divergencias en x y en ancho que pasaban. Orden de las categorías fuera de aquí: la p160
# las dibuja en el orden del instrumento y el motor por frecuencia (decisión D8 pendiente de Gonzalo).
.P160_X <- list(
  # Dicotomía de sexo (recetario_m2c.R:42, `dicotomia(ML, YT + 0.65, wc, ..., n, size = 24, g = 0.38)`): a todo el ancho
  # del panel, con la frecuencia en el rótulo.
  dico_cifra_x = c(0.495, 4.757), dico_cifra_w = 1.6, dico_cifra_y = 2.30,
  dico_rotulo = c("Masculino (33)", "Femenino (19)"), dico_rotulo_x = c(0.495, 3.426), dico_rotulo_w = 2.931, dico_rotulo_y = 2.647,
  dico_x0 = 0.495, dico_x1 = 6.357, dico_y = 2.967, dico_h = 0.38,
  # Barras de grado (:44, `wlab = 1.4`) y de edad (:48, `barras_h(ML + 2.5, ..., ANCHO - 5, wlab = 1.9)`: el bloque
  # centrado, no a todo el ancho).
  sup_rotulo_x = 7.157, sup_rotulo_w = 1.4, sup_barra_x = 8.677, sup_barra_max = 3.269,
  inf_rotulo_x = 2.995, inf_rotulo_w = 1.9, inf_barra_x = 5.015, inf_barra_max = 4.306
)

test_that("la corona calza con la p160 también a lo ancho: dicotomía con n a todo el panel y barras de abajo centradas", {
  f <- .cr_fixture(); out <- tempfile(fileext = ".pptx")
  plan <- list(a = p_slide_3_graficos_poblacion_corona(p_barras_categoricas("sexo"), p_barras_categoricas("grado"),
                                                       p_barras_categoricas("edad"), titulo = "Perfil del docente"))
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$df, instrumento = f$inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  xml <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  E <- .P160_X

  cif <- .cr_off(xml, "dicotomia:cifra"); cif <- cif[order(cif$x), ]
  .cerca(cif$x, E$dico_cifra_x, "x de las cifras de la dicotomía")
  .cerca(cif$w, rep(E$dico_cifra_w, 2), "ancho de las cifras")
  .cerca(cif$y, rep(E$dico_cifra_y, 2), "y de las cifras")
  rot <- .cr_off(xml, "dicotomia:rotulo"); rot <- rot[order(rot$x), ]
  expect_identical(rot$texto, E$dico_rotulo)
  .cerca(rot$x, E$dico_rotulo_x, "x de los rótulos de la dicotomía")
  .cerca(rot$w, rep(E$dico_rotulo_w, 2), "ancho de los rótulos")
  .cerca(rot$y, rep(E$dico_rotulo_y, 2), "y de los rótulos")
  seg <- .cr_off(xml, "dicotomia:segmento")
  .cerca(min(seg$x), E$dico_x0, "borde izquierdo de la dicotomía")
  .cerca(max(seg$x + seg$w), E$dico_x1, "borde derecho de la dicotomía")
  .cerca(seg$y, rep(E$dico_y, 2), "y de la barra partida")
  .cerca(seg$h, rep(E$dico_h, 2), "grosor de la barra partida")

  r <- .cr_off(xml, "rotulo"); b <- .cr_off(xml, "barra")
  rs <- r[r$y < 4.0, ]; ri <- r[r$y > 4.0, ]; bs <- b[b$y < 4.0, ]; bi <- b[b$y > 4.0, ]
  .cerca(rs$x, rep(E$sup_rotulo_x, nrow(rs)), "x de los rótulos de arriba a la derecha")
  .cerca(rs$w, rep(E$sup_rotulo_w, nrow(rs)), "ancho de los rótulos de arriba a la derecha")
  .cerca(bs$x, rep(E$sup_barra_x, nrow(bs)), "x de las barras de arriba a la derecha")
  .cerca(max(bs$w), E$sup_barra_max, "barra más larga de arriba a la derecha")
  .cerca(ri$x, rep(E$inf_rotulo_x, nrow(ri)), "x de los rótulos de abajo")
  .cerca(ri$w, rep(E$inf_rotulo_w, nrow(ri)), "ancho de los rótulos de abajo")
  .cerca(bi$x, rep(E$inf_barra_x, nrow(bi)), "x de las barras de abajo")
  .cerca(max(bi$w), E$inf_barra_max, "barra más larga de abajo")
  # Cada cifra va 0.04 in después de su barra (recetario.R:207).
  cf <- .cr_off(xml, "cifra")
  for (k in seq_len(nrow(b))) {
    c_ <- cf[abs(cf$y - (b$y[k] + (b$h[k] - 0.3) / 2)) < 0.01, ]
    expect_equal(nrow(c_), 1L)
    .cerca(c_$x, b$x[k] + b$w[k] + 0.04, sprintf("cifra de la barra %d", k))
  }
})

test_that("la receta de la corona no toca a las demás mixtas: la dicotomía de la cuadrícula sigue sin n y con margen", {
  # recetario.R:190 (barras_h en moderna): la dicotomía que sale de una categórica de dos opciones va a w - 0.8, sin la
  # frecuencia; la frecuencia en el rótulo es convención de la corona (p160).
  esp <- list(tipo = "categorica", rotulos = c("Sí", "No"), cifras = c("60%", "40%"), largos = c(0.6, 0.4),
              valores = c(0.6, 0.4), n = c(60, 40))
  lz <- .lam_lienzo()
  geo <- .lam_panel_geo(esp, 0.495, 1.65, 6.012, 2.2)
  expect_identical(geo$tipo, "dicotomia")
  expect_null(geo$receta)
})
