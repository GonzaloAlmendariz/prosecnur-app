# C3 (CCSS Perfil 2026, ronda 2). La dona ya salía nativa en sus tres lugares (panel, dos gráficos, lámina completa);
# la torta de lámina completa no: con más de tres porciones caía a la imagen ggplot (título rojo repetido, leyenda chica
# en orden inverso, sin guía en las tajadas chicas y «0%» donde había casos). Ahora la torta de varias porciones va como
# la dona grande (lamina_circular_dona_grande.R) sin hueco: sectores, cifras dentro o fuera con su guía y la leyenda de
# cifras completa. Y la leyenda compacta del panel alinea su cuadro de color con la primera línea de su cifra (en la
# torta de seis porciones del panel de dos gráficos el cuadro quedaba media fila más abajo que su texto).

.du_fuente <- function() {
  car <- c("Economía", "Relaciones Internacionales", "Ciencia Política y Gobierno", "Finanzas", "Antropología", "Sociología")
  df <- data.frame(carrera = rep(car, c(184, 92, 68, 44, 8, 4)), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = "carrera", type = "select_one lc", list_name = "lc", label = "Carrera", stringsAsFactors = FALSE),
               choices = data.frame(list_name = "lc", name = car, label = car), orders_list = NULL)
  list(df = df, inst = inst, car = car)
}
.du_nombres <- function(x) xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name")

test_that("la torta de seis porciones a lámina completa sale nativa, con su leyenda entera y guía en las tajadas chicas", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  f <- .du_fuente(); out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$df, instrumento = f$inst,
    plan = list(a = p_slide_1_grafico(grafico = p_pie("carrera"), titulo = "Torta de carrera")), path_ppt = out, mensajes_progreso = FALSE)))
  x <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml")); nm <- .du_nombres(x)
  expect_equal(sum(nm == "torta:porcion"), 6L)
  expect_true(any(nm == "torta:guia"))                       # 2 % y 1 % no caben en su tajada: fuera con su guía
  expect_false(any(nm == "dona:cifra"))                       # la torta no lleva cifra al centro
  rot <- xml2::xml_text(xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='torta:rotulo_leyenda']]"))
  expect_identical(rot, f$car)                               # todas, en el orden del instrumento
  # Sin un segundo título: el único texto coral es el título de la lámina.
  textos <- xml2::xml_text(xml2::xml_find_all(x, "//a:t"))
  expect_equal(sum(textos == "Carrera"), 0L)
})

test_that("la torta de dos y tres porciones sigue con su lámina de siempre", {
  e <- attr(suppressWarnings(graficar_pie(data.frame(c = c("Sí", "No"), p = c(0.7, 0.3), n = c(70, 30)), "c", "p", var_n = "n", tipo_pie = "pie")), "pulso_espec")
  expect_true(.lam_torta_cabe(e))
  e6 <- attr(suppressWarnings(graficar_pie(data.frame(c = letters[1:6], p = rep(1 / 6, 6), n = rep(10, 6)), "c", "p", var_n = "n", tipo_pie = "pie")), "pulso_espec")
  expect_false(.lam_torta_cabe(e6))
  expect_true(.lam_circular_cabe(e6))
})

test_that("en la leyenda compacta del panel el cuadro de color va a la altura de la primera línea de su cifra", {
  P <- .lam_mixta_geo("graficos_2")$paneles[[1]]
  rot <- c("Economía", "Relaciones Internacionales", "Ciencia Política y Gobierno", "Finanzas", "Antropología", "Sociología")
  v <- c(184, 92, 68, 44, 8, 4); p <- v / sum(v)
  e <- attr(suppressWarnings(graficar_pie(data.frame(c = rot, p = p, n = v), "c", "p", var_n = "n", tipo_pie = "pie")), "pulso_espec")
  geo <- .lam_panel_circular_geo(e, P$x, P$y, P$w, P$h)
  expect_true(isTRUE(geo$compacto))
  lz <- .lam_lienzo(); .lam_panel_circular(lz, e, geo)
  nm <- vapply(lz$formas, function(f) sub('^.*?name="([^"]*)".*$', "\\1", f), "")
  cu <- do.call(rbind, lz$cajas[nm == "circular:cuadro"]); ci <- do.call(rbind, lz$cajas[nm == "circular:cifra"])
  # Centro del cuadro frente al centro de la primera línea de la cifra (margen superior de 0.05 in de la caja de texto).
  centro_cuadro <- cu[, 2] + (cu[, 4] - cu[, 2]) / 2
  centro_linea <- ci[, 2] + 0.05 + geo$size_cifra * 1.2 / 72 / 2
  expect_true(all(abs(centro_cuadro - centro_linea) <= 0.02), info = paste(round(centro_cuadro - centro_linea, 3), collapse = " "))
})
