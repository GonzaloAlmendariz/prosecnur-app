# Frente C (CCSS Perfil 2026): una cuadrícula con una dona en un cajón chico (seis categorías en `p_slide_4_graficos`, o
# cuatro con una en 0 % en los paneles de 3.9 in de `p_slide_6_graficos_poblacion`) salía con la lámina entera pintada:
# la dona iba como imagen ggplot y rvg escribía la clave de leyenda que no cabía como un rectángulo con
# off = 2147483647 y ext negativa, que LibreOffice dibuja a lámina completa tapando título y paneles.

.gd_fixture <- function() {
  carrera <- c("Economía", "Relaciones Internacionales", "Ciencia Política y Gobierno", "Finanzas", "Antropología", "Sociología")
  genero <- c("Femenino", "Masculino", "Persona de género no binario", "Prefiero no responder")
  nivel <- c("VII", "VI", "VIII", "IX")
  n <- 400
  df <- data.frame(carrera = rep(carrera, c(184, 92, 68, 44, 8, 4)), genero = rep(genero[1:3], c(212, 180, 8)),
                   nivel = rep(nivel, c(120, 120, 96, 64)), edad = rep(18:33, length.out = n),
                   otra = c(rep(c("Abuelos", "Tíos"), c(40, 16)), rep(NA, n - 56)), stringsAsFactors = FALSE)
  ch <- rbind(data.frame(list_name = "lc", name = carrera, label = carrera), data.frame(list_name = "lg", name = genero, label = genero),
              data.frame(list_name = "ln", name = nivel, label = nivel), data.frame(list_name = "lo", name = c("Abuelos", "Tíos"), label = c("Abuelos", "Tíos")))
  inst <- list(survey = data.frame(name = c("carrera", "genero", "nivel", "edad", "otra"),
                                   type = c("select_one lc", "select_one lg", "select_one ln", "integer", "select_one lo"),
                                   list_name = c("lc", "lg", "ln", NA, "lo"), label = c("Carrera", "Género", "Nivel curricular", "Edad", "Otra persona"),
                                   stringsAsFactors = FALSE), choices = ch, orders_list = NULL)
  list(df = df, inst = inst)
}
.gd_lams <- function(plan) {
  f <- .gd_fixture(); out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$df, instrumento = f$inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  lapply(seq_len(length(officer::read_pptx(out))), function(k) xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k))))
}
.gd_degeneradas <- function(x) {
  off <- xml2::xml_find_all(x, "//a:xfrm/a:off"); ext <- xml2::xml_find_all(x, "//a:xfrm/a:ext")
  ox <- as.numeric(xml2::xml_attr(off, "x")); cx <- as.numeric(xml2::xml_attr(ext, "cx")); cy <- as.numeric(xml2::xml_attr(ext, "cy"))
  sum(abs(ox) >= 2^31 - 1 | cx < 0 | cy < 0)
}
.gd_nombres <- function(x) xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name")

test_that("cuatro gráficos con una dona de seis categorías y un histograma: lámina nativa, sin formas fuera de escala", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  lam <- .gd_lams(list(a = p_slide_4_graficos(p_donut("nivel"), p_donut("carrera"), p_donut("genero"), p_histograma("edad", ancho_bin = 1),
                                              titulo = "Lámina que se rompía")))
  x <- lam[[1]]; nm <- .gd_nombres(x)
  expect_identical(.gd_degeneradas(x), 0L)
  expect_true("Titulo lamina" %in% nm)
  expect_equal(sum(nm == "dona:cifra"), 3L)                       # las tres donas, nativas
  rot <- xml2::xml_text(xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='circular:rotulo']]"))
  expect_true(all(c("Economía", "Sociología", "Femenino", "IX") %in% rot))
})

test_that("seis paneles de población con una dona de cuatro categorías (una en 0 %) no pintan la lámina entera", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  lam <- .gd_lams(list(a = p_slide_6_graficos_poblacion(p_barras_categoricas("nivel"), p_barras_categoricas("nivel"), p_donut("carrera"),
                                                        p_barras_categoricas("nivel"), p_donut("genero"), p_barras_categoricas("nivel"),
                                                        titulo = "Seis paneles")))
  x <- lam[[1]]; nm <- .gd_nombres(x)
  expect_identical(.gd_degeneradas(x), 0L)
  expect_true("Titulo lamina" %in% nm)                             # el marco del recetario, con su barra
  expect_true("titulo:barra" %in% nm)
  expect_equal(sum(nm == "dona:cifra"), 2L)
})
