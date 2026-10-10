# Orden de las barras agrupadas en el motor nativo (ADR 0093): paridad con la ruta ggplot. La lámina nativa dibuja de
# arriba hacia abajo (o de izquierda a derecha) en el orden en que se LEE el ggplot del mismo elemento, con
# `invertir_barras` TRUE o FALSE. Antes la espec tomaba los niveles del factor tal cual y, con el preset de la casa
# (`invertir_barras = TRUE`, que compensa a `coord_flip`), la lámina salía al revés que la ruta anterior, el instrumento y el
# recetario (p. 162; láminas 8 y 11 de acrconta_mazo). Lo que signifique `invertir_barras` se decide en F6.1 (ADR).

.ao_cats <- c("Primera", "Segunda", "Tercera", "Cuarta")
.ao_edad <- c("De 18 a 30 años", "De 31 a 40 años", "De 41 a 50 años", "De 51 años a más")
.ao_grado <- c("Bachiller", "Magíster", "Doctor")
.ao_sexo <- c("Hombre", "Mujer")

# Instrumento con listas declaradas (códigos y rótulos) y orders_list explícito: el motor no reordena.
.ao_inst <- function(listas, etiquetas, ordenes = NULL) {
  vars <- names(listas)
  ch <- do.call(rbind, lapply(vars, function(v) data.frame(list_name = paste0("l_", v), name = names(listas[[v]]), label = unname(listas[[v]]),
                                                          stringsAsFactors = FALSE)))
  ord <- lapply(setNames(vars, vars), function(v) {
    cod <- (ordenes %||% list())[[v]] %||% names(listas[[v]])
    list(names = cod, labels = unname(listas[[v]][cod]))
  })
  list(survey = data.frame(name = vars, type = paste("select_one", paste0("l_", vars)), list_name = paste0("l_", vars),
                           label = unname(etiquetas[vars]), stringsAsFactors = FALSE),
       choices = ch, orders_list = ord)
}
.ao_lista <- function(x) setNames(x, x)
.ao_base <- function() {
  df <- data.frame(x = rep(.ao_cats, c(10, 40, 20, 30)), edad = rep(.ao_edad, c(25, 15, 35, 25)),
                   sexo = rep(.ao_sexo, c(37, 63)), grado = rep(.ao_grado, c(19, 73, 8)), stringsAsFactors = FALSE)
  inst <- .ao_inst(list(x = .ao_lista(.ao_cats), edad = .ao_lista(.ao_edad), sexo = .ao_lista(.ao_sexo), grado = .ao_lista(.ao_grado)),
                   c(x = "Pregunta X", edad = "Rango de edades", sexo = "Sexo", grado = "Máximo grado alcanzado"))
  list(df = df, inst = inst)
}
# El preset de la casa para agrupadas: orden del instrumento e inversión para coord_flip.
.ao_el <- function(var, ..., mostrar_ceros = NULL) {
  p_barras_agrupadas(var, mostrar_ceros = mostrar_ceros,
                     overrides = utils::modifyList(list(orden_barras = "instrumento", invertir_barras = TRUE), list(...)))
}
.ao_laminas <- function(plan, f = .ao_base()) {
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$df, instrumento = f$inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  lapply(.pptx_slide_paths(out), function(sp) .pptx_leer_parte(out, sp))
}
.ao_formas <- function(x, nombre) {
  xml <- xml2::read_xml(x)
  sp <- xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
  xf <- xml2::xml_find_first(sp, "./p:spPr/a:xfrm")
  num <- function(path, attr) as.numeric(xml2::xml_attr(xml2::xml_find_first(xf, path), attr)) / 914400
  data.frame(t = xml2::xml_text(sp), x = num("./a:off", "x"), y = num("./a:off", "y"), h = num("./a:ext", "cy"), stringsAsFactors = FALSE)
}
# Rótulos de arriba hacia abajo; `x0`/`x1` acotan a una columna de paneles.
.ao_rotulos <- function(x, x0 = -Inf, x1 = Inf, nombre = "rotulo") {
  f <- .ao_formas(x, nombre); f <- f[f$x >= x0 & f$x < x1, ]
  f$t[order(f$y, f$x)]
}
# Cada rótulo con la cifra de su fila (centros verticales más cercanos).
.ao_pares <- function(x) {
  r <- .ao_formas(x, "rotulo"); c <- .ao_formas(x, "cifra")
  r <- r[order(r$y), ]; cr <- r$y + r$h / 2; cc <- c$y + c$h / 2
  setNames(vapply(cr, function(y) c$t[which.min(abs(cc - y))], ""), r$t)
}
# Orden en que se lee el ggplot: de arriba hacia abajo en horizontal (el eje discreto se lista de abajo hacia arriba).
.ao_lectura_gg <- function(g, orientacion) {
  pp <- ggplot2::ggplot_build(g)$layout$panel_params[[1]]
  if (identical(orientacion, "horizontal")) rev(pp$y$get_labels()) else pp$x$get_labels()
}

test_that("la espec nativa se lee en el mismo orden que el ggplot: invertir_barras TRUE/FALSE × horizontal/vertical", {
  d <- data.frame(cat = .ao_cats, n = c(10, 40, 20, 30), pct = c(.1, .4, .2, .3), stringsAsFactors = FALSE)
  for (o in c("horizontal", "vertical")) for (inv in c(TRUE, FALSE)) {
    g <- suppressMessages(suppressWarnings(graficar_barras_agrupadas(d, var_categoria = "cat", var_n = "n", cols_porcentaje = "pct",
      etiquetas_series = c(pct = "Total"), orden_barras = "instrumento", invertir_barras = inv, orientacion = o)))
    e <- attr(g, "pulso_espec")
    expect_identical(e$rotulos, .ao_lectura_gg(g, o), info = paste(o, inv))
    expect_identical(unname(e$cifras[match(.ao_cats, e$rotulos)]), c("10%", "40%", "20%", "30%"), info = paste(o, inv))
  }
  # Con la inversión de la casa, el horizontal se lee en el orden del instrumento.
  g <- suppressMessages(suppressWarnings(graficar_barras_agrupadas(d, var_categoria = "cat", var_n = "n", cols_porcentaje = "pct",
    etiquetas_series = c(pct = "Total"), orden_barras = "instrumento", invertir_barras = TRUE)))
  expect_identical(attr(g, "pulso_espec")$rotulos, .ao_cats)
})

test_that("por la ruta real la lámina de un gráfico sigue al ggplot con invertir_barras TRUE y FALSE", {
  lam <- .ao_laminas(list(a = p_slide_1_grafico(.ao_el("x"), titulo = "Con inversión"),
                          b = p_slide_1_grafico(.ao_el("x", invertir_barras = FALSE), titulo = "Sin inversión")))
  expect_identical(vapply(lam, .pptx_lamina_estado, ""), c("nativa", "nativa"))
  expect_identical(.ao_rotulos(lam[[1]]), .ao_cats)                       # coord_flip con niveles invertidos: Primera arriba
  expect_identical(.ao_rotulos(lam[[2]]), rev(.ao_cats))                  # sin invertir, el ggplot pone Primera abajo
  expect_identical(.ao_pares(lam[[1]]), c(Primera = "10%", Segunda = "40%", Tercera = "20%", Cuarta = "30%"))
  expect_identical(.ao_pares(lam[[2]])[.ao_cats], c(Primera = "10%", Segunda = "40%", Tercera = "20%", Cuarta = "30%"))
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

test_that("un orders_list 3, 1, 2, 4 sale tal cual: el motor no reordena", {
  cod <- c(`1` = "Uno", `2` = "Dos", `3` = "Tres", `4` = "Cuatro")
  f <- list(df = data.frame(q = rep(names(cod), c(10, 40, 20, 30)), stringsAsFactors = FALSE),
            inst = .ao_inst(list(q = cod), c(q = "Pregunta Q"), ordenes = list(q = c("3", "1", "2", "4"))))
  x <- .ao_laminas(list(a = p_slide_1_grafico(.ao_el("q"), titulo = "Orden declarado")), f)[[1]]
  expect_identical(.ao_rotulos(x), c("Tres", "Uno", "Dos", "Cuatro"))
  expect_identical(.ao_pares(x), c(Tres = "20%", Uno = "10%", Dos = "40%", Cuatro = "30%"))
})

test_that("la cifra queda pegada a su categoría con categorías sin casos, con especiales y con «Otro» al final", {
  # Una categoría sin casos (mostrar_ceros = FALSE) no se dibuja y las demás conservan su cifra y su orden.
  f0 <- .ao_base(); f0$df$x[f0$df$x == "Tercera"] <- "Cuarta"                       # Tercera queda con 0 casos (Cuarta: 50)
  x0 <- .ao_laminas(list(a = p_slide_1_grafico(.ao_el("x", mostrar_ceros = FALSE), titulo = "Sin casos")), f0)[[1]]
  expect_identical(.ao_rotulos(x0), c("Primera", "Segunda", "Cuarta"))
  expect_identical(.ao_pares(x0), c(Primera = "10%", Segunda = "40%", Cuarta = "50%"))

  # Códigos especiales 80-99 y «Otro» en medio del instrumento: «Otro» y los especiales van al final, cada uno con su cifra.
  cod <- c(`1` = "Sí, siempre", `2` = "A veces", `5` = "Otro", `3` = "Nunca", `99` = "No sabe / no responde")
  n <- c(`1` = 30, `2` = 25, `5` = 5, `3` = 30, `99` = 10)
  fe <- list(df = data.frame(q = rep(names(n), n), stringsAsFactors = FALSE), inst = .ao_inst(list(q = cod), c(q = "Frecuencia")))
  xe <- .ao_laminas(list(a = p_slide_1_grafico(.ao_el("q"), titulo = "Especiales")), fe)[[1]]
  rot <- .ao_rotulos(xe)
  expect_identical(rot[1:3], c("Sí, siempre", "A veces", "Nunca"))
  expect_setequal(rot[-(1:3)], c("Otros", "No sabe / no responde"))         # el motor rotula «Otro» con su etiqueta de resto
  pares <- .ao_pares(xe)
  pct <- function(k) paste0(round(100 * n[[k]] / sum(n)), "%")
  expect_identical(unname(pares[c("Sí, siempre", "A veces", "Nunca", "Otros", "No sabe / no responde")]),
                   c(pct("1"), pct("2"), pct("3"), pct("5"), pct("99")))
})

# Residuales del recetario (`.CATEGORIAS_RESIDUALES`: «Otro…», «No sabe…», «Ninguna…», «Ninguno», «Prefiero no…») al final con
# el preset de la casa, en el ggplot, la espec y la lámina nativa a la vez (graficos_espec_categorica.R:7-8). `otros_al_final`
# sólo reconocía una lista exacta («Otros», «No sabe / no responde»…) y «Ninguno» se quedaba donde lo ponía el instrumento.
.ao_pres_casa <- function() .build_presets(.enriquecer_presets(list(), NULL))
.ao_lamina_casa <- function(cod, n, orden = NULL, ...) {
  f <- list(df = data.frame(q = rep(names(n), n), stringsAsFactors = FALSE), inst = .ao_inst(list(q = cod), c(q = "Pregunta")))
  ov <- if (is.null(orden)) list() else list(orden_barras = orden)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$df, instrumento = f$inst, presets = .ao_pres_casa(), path_ppt = out, mensajes_progreso = FALSE,
    plan = list(a = p_slide_1_grafico(p_barras_agrupadas("q", mostrar_ceros = FALSE, overrides = ov, ...), titulo = "Residuales")))))
  .pptx_leer_parte(out, .pptx_slide_paths(out)[[1]])
}
.ao_graf_casa <- function(cats, n, orden = "instrumento", orientacion = "horizontal") {
  a <- .ao_pres_casa()$barras_agrupadas$args
  d <- data.frame(cat = cats, n = n, pct = n / sum(n), stringsAsFactors = FALSE)
  args <- utils::modifyList(a[intersect(names(a), names(formals(graficar_barras_agrupadas)))],
                            list(data = d, var_categoria = "cat", var_n = "n", cols_porcentaje = "pct", etiquetas_series = c(pct = "Total"),
                                 orden_barras = orden, orientacion = orientacion, usar_canvas = FALSE))
  suppressMessages(suppressWarnings(do.call(graficar_barras_agrupadas, args)))
}

test_that("con el preset de la casa «Ninguno» y «Ninguna de las anteriores» van al final en el ggplot, la espec y la lámina, con su cifra", {
  # «Ninguno» en medio del instrumento.
  cats <- c("Uno", "Ninguno", "Dos", "Tres"); n <- c(30, 10, 40, 20)
  g <- .ao_graf_casa(cats, n)
  expect_identical(.ao_lectura_gg(g, "horizontal"), c("Uno", "Dos", "Tres", "Ninguno"))
  expect_identical(attr(g, "pulso_espec")$rotulos, c("Uno", "Dos", "Tres", "Ninguno"))
  # «Ninguna de las anteriores» como la mayor, ordenado de mayor a menor: igual al final.
  cats2 <- c("Uno", "Dos", "Ninguna de las anteriores", "Tres"); n2 <- c(30, 10, 45, 15)
  g2 <- .ao_graf_casa(cats2, n2, orden = "mayor_menor")
  expect_identical(.ao_lectura_gg(g2, "horizontal"), c("Uno", "Tres", "Dos", "Ninguna de las anteriores"))
  expect_identical(attr(g2, "pulso_espec")$rotulos, c("Uno", "Tres", "Dos", "Ninguna de las anteriores"))
  expect_identical(attr(g2, "pulso_espec")$cifras, c("30%", "15%", "10%", "45%"))
  # Por la ruta real, con el orden del motor entre residuales: los del instrumento («Ninguno», «Otro…») y NS/NR al final.
  cod <- c(`1` = "Siempre", `2` = "Ninguno", `3` = "Nunca", `4` = "Otro (especifique)", `99` = "No sabe / no responde")
  nn <- c(`1` = 30, `2` = 25, `3` = 20, `4` = 15, `99` = 10)
  x <- .ao_lamina_casa(cod, nn)
  expect_identical(.pptx_lamina_estado(x), "nativa")
  rot <- .ao_rotulos(x)
  expect_identical(rot[1:2], c("Siempre", "Nunca"))
  expect_true(all(grepl(.CATEGORIAS_RESIDUALES, rot[-(1:2)], ignore.case = TRUE)))
  expect_identical(tail(rot, 1), "No sabe / no responde")
  pares <- .ao_pares(x)
  esperado <- setNames(paste0(round(100 * nn / sum(nn)), "%"), cod)
  esperado <- esperado[names(esperado) %in% names(pares)]
  expect_identical(pares[names(esperado)], esperado)
  x2 <- .ao_lamina_casa(c(a = "Uno", b = "Dos", c = "Ninguna de las anteriores", d = "Tres"), c(a = 30, b = 10, c = 45, d = 15), orden = "mayor_menor")
  expect_identical(.ao_rotulos(x2), c("Uno", "Tres", "Dos", "Ninguna de las anteriores"))
  expect_identical(.ao_pares(x2)[["Ninguna de las anteriores"]], "45%")
})

test_that("contrato de la espec vertical: hoy no la consume nadie (la lámina va por la ruta anterior)", {
  cod <- c(`1` = "Siempre", `2` = "A veces", `3` = "Nunca")
  x <- .ao_lamina_casa(cod, c(`1` = 30, `2` = 25, `3` = 45))
  expect_identical(.pptx_lamina_estado(x), "nativa")                                     # control: horizontal sí es nativa
  f <- list(df = data.frame(q = rep(names(cod), c(30, 25, 45)), stringsAsFactors = FALSE), inst = .ao_inst(list(q = cod), c(q = "Pregunta")))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$df, instrumento = f$inst, presets = .ao_pres_casa(), path_ppt = out, mensajes_progreso = FALSE,
    plan = list(a = p_slide_1_grafico(p_barras_agrupadas("q", overrides = list(orientacion = "vertical", usar_canvas = FALSE)), titulo = "Vertical")))))
  expect_identical(.pptx_lamina_estado(.pptx_leer_parte(out, .pptx_slide_paths(out)[[1]])), "ruta_anterior")
  # Si algún día se consume, debe leerse como el ggplot vertical: de izquierda a derecha.
  g <- .ao_graf_casa(unname(cod), c(30, 25, 45), orientacion = "vertical")
  expect_identical(attr(g, "pulso_espec")$rotulos, .ao_lectura_gg(g, "vertical"))
})
