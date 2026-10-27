source("setup-load-all.R")

# P10 (Gonzalo, 2026-10-27): «usa el semáforo de Dimensiones como ppt.paletas.semaforo para todo». Un solo semáforo: el
# que el analista configura en Analítica › Dimensiones es el del estándar, y el boxplot, la media y rango y el comparativo
# Top Two Box lo leen de ahí.

test_that("los defaults de Dimensiones y del dashboard son el semáforo del estándar", {
  s <- .std_semaforo()
  expect_identical(toupper(unname(unlist(.dimensiones_default_config()$semaforo$colores)[c("rojo", "ambar", "verde")])), toupper(unname(s)))
  d <- .dashboard_default_config()
  expect_identical(toupper(c(d$semaforo_red_color, d$semaforo_amber_color, d$semaforo_green_color)), toupper(unname(s)))
})

test_that("boxplot, media y rango y el comparativo Top Two Box pintan con el semáforo del estándar", {
  s <- .std_semaforo()
  expect_identical(formals(graficar_boxplot)$chip_colores, quote(.std_semaforo()))
  expect_identical(formals(graficar_media_rango)$chip_colores, quote(.std_semaforo()))
  t2b <- .t2b_semaforo_colores()
  expect_identical(unname(t2b), unname(s[c("verde", "ambar", "rojo")]))
  expect_identical(unname(.t2b_semaforo_color(c(90, 75, 40))), unname(s[c("verde", "ambar", "rojo")]))
  expect_identical(unname(.t2b_tendencia_colores()), unname(s[c("verde", "rojo")]))
})

test_that("el perfil de acreditación pinta con el estándar: Likert, públicos y título coral (P9)", {
  expect_identical(colores_escala_acreditacion(), unname(.std_paleta("likert"))[1:4])
  perfil <- .ppt_style_profile_acreditacion()
  expect_identical(perfil$presets$radar_tabla$colores_series, unname(.std_paleta("actores"))[1:3])
  expect_identical(perfil$presets$base$color_titulo_slide, .std_color("coral"))
  expect_identical(unname(colores_escala_acreditacion(c("De acuerdo", "SIN INF"))), unname(.std_paleta("likert"))[c(3, 5)])
})
