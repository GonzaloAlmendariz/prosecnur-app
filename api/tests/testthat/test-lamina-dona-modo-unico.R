# Frente C (CCSS Perfil 2026): la dona tenía dos aspectos. Hasta cuatro categorías iba nativa en su panel (cifra al centro,
# leyenda con %); con más, o en `p_slide_2_graficos`, iba como imagen ggplot con otro estilo, el título repetido en rojo
# y la leyenda cortada. Ahora el panel circular es nativo para cualquier número de categorías: la leyenda se compacta o
# se reparte en columnas y nunca se corta.

.dm_espec <- function(k, forma = "donut") {
  rot <- c("Economía", "Relaciones Internacionales", "Ciencia Política y Gobierno", "Finanzas", "Antropología", "Sociología",
           "Derecho", "Psicología", "Comunicaciones", "Arquitectura")[seq_len(k)]
  v <- rev(seq_len(k)) + 1; p <- v / sum(v)
  attr(suppressWarnings(graficar_pie(data.frame(c = rot, p = p, n = round(p * 397)), "c", "p", var_n = "n", tipo_pie = forma)), "pulso_espec")
}
.dm_cajas <- function(lz, nombre) {
  nm <- vapply(lz$formas, function(f) sub('^.*?name="([^"]*)".*$', "\\1", f), "")
  do.call(rbind, lz$cajas[nm == nombre])
}

# Límite medido: en los paneles de población (3.9 x 1.75 in) caben hasta seis categorías; con más, la leyenda no se
# lee ni a 8 pt y el panel va con su gráfico de respaldo.
test_that("el panel circular cabe con 6, 8 y 10 categorías en la cuadrícula de 2 x 2 y hasta 6 en los paneles de población", {
  P4 <- .lam_mixta_geo("paneles_4")$paneles[[2]]
  P6 <- .lam_mixta_geo("poblacion_6")$paneles
  for (k in c(2L, 4L, 6L, 8L, 10L)) {
    e <- .dm_espec(k)
    expect_true(isTRUE(.lam_panel_circular_geo(e, P4$x, P4$y, P4$w, P4$h)$cabe), info = paste("2x2", k))
    if (k <= 6L) for (p in P6) expect_true(isTRUE(.lam_panel_circular_geo(e, p$x, p$y, p$w, p$h)$cabe), info = paste("pob6", k, p$h))
  }
})

test_that("la leyenda del panel lleva todas las categorías, dentro del panel y sin encimarse", {
  for (k in c(6L, 10L)) for (p in list(.lam_mixta_geo("paneles_4")$paneles[[2]], .lam_mixta_geo("poblacion_6")$paneles[[5]])) {
    e <- .dm_espec(k); geo <- .lam_panel_circular_geo(e, p$x, p$y, p$w, p$h)
    lz <- .lam_lienzo(); .lam_panel_circular(lz, e, geo)
    r <- .dm_cajas(lz, "circular:rotulo")
    expect_equal(nrow(r), k)
    expect_true(all(r[, 1] >= p$x - 1e-6 & r[, 3] <= p$x + p$w + 1e-6), info = paste(k, "x"))
    expect_true(all(r[, 4] <= p$y + p$h + 1e-6), info = paste(k, "y"))
    # Ningún rótulo invade al de la fila de abajo de su misma columna.
    for (col in unique(round(r[, 1], 4))) {
      q <- r[abs(r[, 1] - col) < 1e-4, , drop = FALSE]; q <- q[order(q[, 2]), , drop = FALSE]
      if (nrow(q) > 1L) expect_true(all(q[-nrow(q), 4] <= q[-1, 2] + 1e-6), info = paste(k, "encimados"))
    }
    cu <- .dm_cajas(lz, "circular:cuadro")
    expect_equal(nrow(unique(round(cu[, 1:2], 4))), k)          # un cuadro por categoría, en su lugar
  }
})

test_that("cada porción lleva un color distinto aunque haya más de cinco", {
  expect_length(unique(.lam_colores_pie(6L)), 6L)
  expect_length(unique(.lam_colores_pie(10L)), 10L)
  expect_identical(.lam_colores_pie(4L), c(.std_color("azul"), .std_color("azul_medio"), .std_color("tenue"), .std_color("azul_rango")))
})

test_that("p_slide_2_graficos con dos donas sale nativa, con la barra del título y sin imagen ggplot", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  car <- c("Economía", "Relaciones Internacionales", "Ciencia Política y Gobierno", "Finanzas", "Antropología", "Sociología")
  df <- data.frame(carrera = rep(car, c(184, 92, 68, 44, 8, 4)), g = rep(c("Privado", "Estatal"), c(340, 60)), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = c("carrera", "g"), type = c("select_one lc", "select_one lg"), list_name = c("lc", "lg"),
                                   label = c("Carrera", "Gestión del colegio"), stringsAsFactors = FALSE),
               choices = rbind(data.frame(list_name = "lc", name = car, label = car),
                               data.frame(list_name = "lg", name = c("Privado", "Estatal"), label = c("Privado", "Estatal"))), orders_list = NULL)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = df, instrumento = inst, plan = list(a = p_slide_2_graficos(p_donut("carrera"), p_donut("g"), titulo = "Dos donas")),
                                                     path_ppt = out, mensajes_progreso = FALSE)))
  x <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml")); nm <- xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name")
  expect_true("titulo:barra" %in% nm)
  expect_equal(sum(nm == "dona:cifra"), 2L)
  expect_false("mixta:respaldo" %in% nm)
  rot <- xml2::xml_text(xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='circular:rotulo']]"))
  expect_true(all(car %in% rot))
})
