# Orden de lectura de las barras agrupadas en el motor nativo (ADR 0093). El graficador invierte los niveles
# (`invertir_barras`, TRUE en el preset de la casa) porque `coord_flip` dibuja el primer nivel abajo: así el ggplot muestra
# el instrumento de arriba hacia abajo. La espec se armaba con los niveles ya invertidos y la lámina nativa, que dibuja de
# arriba hacia abajo, salía al revés que la ruta anterior, el instrumento y el recetario (p. 162; lámina 8 de
# acrconta_mazo). La espec lleva el orden de lectura; la inversión queda sólo en la ruta ggplot.

.ao_cats <- c("Primera", "Segunda", "Tercera", "Cuarta")
.ao_edad <- c("De 18 a 30 años", "De 31 a 40 años", "De 41 a 50 años", "De 51 años a más")
.ao_grado <- c("Bachiller", "Magíster", "Doctor")
.ao_sexo <- c("Hombre", "Mujer")
.ao_fixture <- function() {
  df <- data.frame(x = rep(.ao_cats, c(10, 40, 20, 30)), edad = rep(.ao_edad, c(25, 15, 35, 25)),
                   sexo = rep(.ao_sexo, c(37, 63)), grado = rep(.ao_grado, c(19, 73, 8)), stringsAsFactors = FALSE)
  listas <- list(lx = .ao_cats, le = .ao_edad, ls = .ao_sexo, lg = .ao_grado)
  ch <- do.call(rbind, lapply(names(listas), function(l) data.frame(list_name = l, name = listas[[l]], label = listas[[l]])))
  vars <- c(x = "lx", edad = "le", sexo = "ls", grado = "lg")
  inst <- list(survey = data.frame(name = names(vars), type = paste("select_one", vars), list_name = unname(vars),
                                   label = c("Pregunta X", "Rango de edades", "Sexo", "Máximo grado alcanzado"), stringsAsFactors = FALSE),
               choices = ch,
               # Las categorías van en el orden del formulario (no por frecuencia), como en acrconta.
               orders_list = lapply(setNames(vars, names(vars)), function(l) list(names = listas[[l]], labels = listas[[l]])))
  list(df = df, inst = inst)
}
# El preset de la casa para agrupadas: orden del instrumento e inversión para coord_flip.
.ao_el <- function(var, ...) p_barras_agrupadas(var, overrides = utils::modifyList(list(orden_barras = "instrumento", invertir_barras = TRUE), list(...)))
.ao_laminas <- function(plan) {
  f <- .ao_fixture(); out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$df, instrumento = f$inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  lapply(.pptx_slide_paths(out), function(sp) .pptx_leer_parte(out, sp))
}
# Rótulos de arriba hacia abajo (menor y primero); `x0`/`x1` acotan a una columna de paneles.
.ao_rotulos <- function(x, x0 = -Inf, x1 = Inf, nombre = "rotulo") {
  xml <- xml2::read_xml(x)
  sp <- xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  off <- xml2::xml_find_first(sp, "./p:spPr/a:xfrm/a:off")
  xs <- as.numeric(xml2::xml_attr(off, "x")) / 914400; ys <- as.numeric(xml2::xml_attr(off, "y")) / 914400
  k <- xs >= x0 & xs < x1
  xml2::xml_text(sp)[k][order(ys[k], xs[k])]
}

test_that("la espec de la agrupada lleva el orden de lectura: no se invierte con invertir_barras ni con la orientación", {
  d <- data.frame(cat = .ao_cats, n = c(10, 40, 20, 30), pct = c(.1, .4, .2, .3), stringsAsFactors = FALSE)
  graf <- function(...) suppressMessages(suppressWarnings(graficar_barras_agrupadas(d, var_categoria = "cat", var_n = "n",
    cols_porcentaje = "pct", etiquetas_series = c(pct = "Total"), orden_barras = "instrumento", ...)))
  g <- graf(invertir_barras = TRUE)
  expect_identical(attr(g, "pulso_espec")$rotulos, .ao_cats)
  expect_identical(attr(graf(invertir_barras = FALSE), "pulso_espec")$rotulos, .ao_cats)          # sin invertir dos veces
  expect_identical(attr(graf(invertir_barras = TRUE, orientacion = "vertical"), "pulso_espec")$rotulos, .ao_cats)
  # Las cifras siguen a su categoría.
  e <- attr(g, "pulso_espec")
  expect_identical(e$cifras[match(.ao_cats, e$rotulos)], c("10%", "40%", "20%", "30%"))
  # El ggplot conserva su inversión: el último nivel del factor (el de arriba con coord_flip) es la primera categoría.
  expect_identical(tail(levels(g$data$cat), 1), "Primera")
})

test_that("en la lámina de un gráfico la primera categoría del instrumento queda arriba, como en la ruta anterior", {
  x <- .ao_laminas(list(a = p_slide_1_grafico(.ao_el("x"), titulo = "Orden")))[[1]]
  expect_identical(.pptx_lamina_estado(x), "nativa")
  expect_identical(.ao_rotulos(x), .ao_cats)
})

test_that("con invertir_barras = FALSE explícito la lámina nativa no invierte dos veces", {
  x <- .ao_laminas(list(a = p_slide_1_grafico(.ao_el("x", invertir_barras = FALSE), titulo = "Sin invertir")))[[1]]
  expect_identical(.pptx_lamina_estado(x), "nativa")
  expect_identical(.ao_rotulos(x), .ao_cats)
})

test_that("en los paneles de la población de 4 la ordinal y las demás se leen en el orden del instrumento", {
  x <- .ao_laminas(list(a = p_slide_4_graficos_poblacion(.ao_el("sexo"), .ao_el("x"), .ao_el("edad"), .ao_el("grado"), titulo = "Perfil")))[[1]]
  expect_identical(.pptx_lamina_estado(x), "nativa")
  expect_identical(.ao_rotulos(x, x1 = 6.6), .ao_edad)                    # abajo a la izquierda: rango de edades
  derecha <- .ao_rotulos(x, x0 = 6.6)
  expect_identical(derecha[derecha %in% .ao_cats], .ao_cats)               # arriba a la derecha
  expect_identical(derecha[derecha %in% .ao_grado], .ao_grado)             # abajo a la derecha
  # La dicotomía pone a la izquierda la primera categoría del instrumento, aunque sea la menor.
  expect_identical(.ao_rotulos(x, nombre = "dicotomia:rotulo")[1], "Hombre")
})
