source("setup-load-all.R")

# Revisión de Gonzalo del PPT v7.11 de CCSS Perfil 2026, cinco comentarios. Sólo cambia el dibujo: las cifras son las de
# la espec. Cada bloque cita la lámina del mazo.

# Piezas de un lienzo por nombre, con su caja c(l, t, r, b) en pulgadas.
.v711_piezas <- function(lz, nombre) {
  nm <- vapply(lz$formas, function(x) regmatches(x, regexpr('(?<=name=")[^"]+', x, perl = TRUE)), "")
  k <- which(nm == nombre)
  if (!length(k)) return(data.frame(l = numeric(), t = numeric(), r = numeric(), b = numeric(), texto = character()))
  tx <- vapply(lz$formas[k], function(x) { m <- regmatches(x, regexpr("(?<=<a:t>)[^<]*", x, perl = TRUE)); if (length(m)) gsub("&lt;", "<", m, fixed = TRUE) else "" }, "")
  cj <- do.call(rbind, lz$cajas[k])
  data.frame(l = cj[, 1], t = cj[, 2], r = cj[, 3], b = cj[, 4], texto = tx, stringsAsFactors = FALSE)
}

# ---- Ítem 3, lámina 7: el gráfico de apoyo llena el alto de su tarjeta ------------------------------------------------

.v711_kpi <- function(n_barras) {
  f <- data.frame(rotulo = paste("Grupo", seq_len(n_barras)), p = seq(20, 60, length.out = n_barras), estado = "igual",
                  dir = NA_character_, fragil = NA, stringsAsFactors = FALSE)
  list(cifra = "37%", texto = "usa Claude todos los días", intervalo_texto = "30% a 44%", base = "base de 400", comparacion = NULL,
       grafico = list(titulo = "Uso según grupo", base = "Base: 400.", filas = f, total = 37))
}

test_that("v7.11 lámina 7: con dos, tres o seis barras el gráfico de apoyo reparte sus filas hasta el pie de la tarjeta", {
  lz <- .lam_lienzo()
  espec <- list(tipo = "hallazgos", modo = "cifras_con_graficos", kpis = list(.v711_kpi(2L), .v711_kpi(3L), .v711_kpi(6L)))
  y1 <- 6.4
  .lam_halla_columnas(lz, espec, 0.6, 12.8, 1.4, y1)
  b <- .v711_piezas(lz, "hallazgo:grafico:barra")
  expect_equal(nrow(b), 11L)
  col <- cut(b$l, c(0, 4.6, 8.7, 13), labels = FALSE)
  # La última barra de cada tarjeta queda cerca del pie (antes, con dos barras, quedaba un bloque vacío de ~2 in).
  ultima <- tapply(b$b, col, max)
  expect_true(all(y1 - 0.35 - 0.3 - ultima < 0.6))
  # Las tres tarjetas arrancan sus barras a la misma altura.
  primera <- tapply(b$t + (b$b - b$t) / 2, col, min)
  paso <- tapply(b$t, col, function(t) if (length(t) > 1L) diff(sort(t))[1] else NA)
  expect_lt(diff(range(primera - paso / 2)), 0.02)
})

# ---- Ítem 4, lámina 9: la pista gris hasta el 100% -----------------------------------------------------------------

# Revisión del PPT v7.23, ítem 8 («¿por qué algunos tienen el recuadro gris y otros no?»): "auto" la enciende en toda barra
# de una serie, también con el eje libre (antes, sólo con la escala de 0 a 100% o en población). "nunca" la sigue apagando.
test_that("v7.11 lámina 9 y v7.23 ítem 8: la pista se enciende en toda barra de una serie; el mando la apaga", {
  expect_true(.lam_barras_pista_activa(list(escala_completa = TRUE)))
  expect_true(.lam_barras_pista_activa(list(escala_completa = FALSE)))   # v7.23: antes FALSE
  expect_true(.lam_barras_pista_activa(list(en_poblacion = TRUE)))
  expect_false(.lam_barras_pista_activa(list(escala_completa = TRUE, pista = "nunca")))
  expect_true(.lam_barras_pista_activa(list(pista = "siempre")))
  expect_true(.lam_barras_pista_activa(list(escala_completa = TRUE, pista = "otra")))   # un valor desconocido vale «auto»
  expect_identical(.lam_barras_pista_activa(list(pista = FALSE, escala_completa = TRUE)), FALSE)
})

test_that("v7.11 lámina 9: cada barra va sobre su pista, que mide el 100% y arranca donde la barra", {
  espec <- list(largos = c(0.30, 0.31, 0.24, 0.16), rotulos = paste("Nivel", 6:9), cifras = c("30%", "31%", "24%", "16%"),
                escala_completa = TRUE)
  lz <- .lam_lienzo()
  .lam_barras_h(lz, espec, 0.6, 2, 5.5, wlab = 1.2, g = 0.3, fila = 0.6)
  pista <- .v711_piezas(lz, "barra:pista"); barra <- .v711_piezas(lz, "barra")
  expect_equal(nrow(pista), 4L)
  expect_equal(pista$l, barra$l, tolerance = 1e-9)
  expect_equal((barra$r - barra$l) / (pista$r - pista$l), espec$largos, tolerance = 1e-6)
  # Sin pista, como antes.
  lz2 <- .lam_lienzo(); espec$pista <- "nunca"
  .lam_barras_h(lz2, espec, 0.6, 2, 5.5, wlab = 1.2, g = 0.3, fila = 0.6)
  expect_equal(nrow(.v711_piezas(lz2, "barra:pista")), 0L)
  # «siempre» con eje libre: la escala pasa a 0-100% para que la pista muestre el 100%.
  lz3 <- .lam_lienzo(); espec$pista <- "siempre"; espec$escala_completa <- FALSE
  .lam_barras_h(lz3, espec, 0.6, 2, 5.5, wlab = 1.2, g = 0.3, fila = 0.6)
  b3 <- .v711_piezas(lz3, "barra"); p3 <- .v711_piezas(lz3, "barra:pista")
  expect_equal((b3$r - b3$l) / (p3$r - p3$l), espec$largos, tolerance = 1e-6)
})

test_that("v7.11 lámina 9: el mando `pista_barras` está declarado, viaja por overrides y llega a la espec", {
  for (g in c("p_barras_agrupadas", "p_barras_categoricas")) {
    a <- Filter(function(x) identical(x$name, "pista_barras"), .GRAFICADORES_META[[g]]$args)
    expect_length(a, 1L)
    expect_identical(a[[1]]$default, "auto")
    expect_true(isTRUE(a[[1]]$via_overrides))
    expect_setequal(vapply(a[[1]]$choices, `[[`, "", "value"), .LAM_PISTA_MODOS)
  }
  expect_true("pista_barras" %in% names(formals(graficar_barras_agrupadas)))
  expect_true("pista_barras" %in% names(formals(graficar_barras_categoricas)))
  d <- data.frame(categoria = c("A", "B", "C"), N = 100, s1 = c(.2, .5, .3))
  e <- attr(suppressWarnings(graficar_barras_agrupadas(d, "categoria", "N", "s1", c(s1 = "S"), exportar = "rplot", pista_barras = "nunca")), "pulso_espec")
  expect_identical(e$pista, "nunca")
  e0 <- attr(suppressWarnings(graficar_barras_agrupadas(d, "categoria", "N", "s1", c(s1 = "S"), exportar = "rplot")), "pulso_espec")
  expect_true(.lam_barras_pista_activa(e0))   # la agrupada de una serie va de 0 a 100%: pista encendida por defecto
})

# ---- Ítem 5, lámina 11: el histograma ---------------------------------------------------------------------------------

.v711_hist <- function(marca = "linea") {
  x <- c(18, rep(19, 29), rep(20, 84), rep(21, 103), rep(22, 73), rep(23, 57), rep(24, 26), rep(25, 7), rep(26, 6), rep(27, 5),
         28, rep(29, 5), rep(31, 3))
  e <- attr(.histograma_recetario(x, limite_superior = 30, mostrar_frecuencia = TRUE, unidad = "años", marca_mediana = marca), "pulso_espec")
  lz <- .lam_lienzo()
  .lam_histograma_distribucion(lz, e, 0.8, 1.6, 11.7, 6.6)
  list(e = e, lz = lz)
}

test_that("v7.11 lámina 11: el porcentaje arriba y en negrita, los casos debajo y más chicos", {
  h <- .v711_hist()
  expect_identical(h$e$marca_mediana, "linea")
  pct <- .v711_piezas(h$lz, "histograma:cifra"); cs <- .v711_piezas(h$lz, "histograma:casos")
  expect_true(all(grepl("^<?[0-9]+%$", pct$texto)))
  expect_identical(cs$texto[4], "103"); expect_identical(pct$texto[4], "26%")
  expect_true(all(cs$t > pct$t))                                                 # los casos van bajo el porcentaje
  expect_match(h$lz$formas[[which(vapply(h$lz$formas, grepl, TRUE, pattern = 'name="histograma:casos"'))[1]]], 'sz="900"')
  expect_identical(.lam_hist_cifras(c("103 (26%)", "26%", "1 (<1%)"))$casos, c("103", "", "1"))
})

test_that("v7.11 lámina 11: la línea de la mediana no entra en su barra y el valor del eje de la mediana va en coral", {
  h <- .v711_hist()
  b <- .v711_piezas(h$lz, "histograma:barra"); lin <- .v711_piezas(h$lz, "histograma:mediana")
  expect_gt(nrow(lin), 0L)
  b21 <- b[which.max(b$b - b$t), ]                                              # 21 años, la barra más alta
  expect_true(all(lin$b <= b21$t + 1e-6))
  pct <- .v711_piezas(h$lz, "histograma:cifra")
  expect_true(all(lin$b <= min(pct$t) + 0.3))
  val <- h$lz$formas[vapply(h$lz$formas, grepl, TRUE, pattern = 'name="histograma:valor"')]
  expect_true(any(grepl(.lam_hex(.std_color("coral")), val) & grepl("<a:t>21</a:t>", val)))
  expect_false(any(grepl('prst="triangle"', unlist(h$lz$formas))))
})

test_that("v7.11 lámina 11: con `marca_mediana = \"triangulo\"` va un triángulo bajo la base y no hay línea", {
  h <- .v711_hist("triangulo")
  expect_identical(h$e$marca_mediana, "triangulo")
  expect_equal(nrow(.v711_piezas(h$lz, "histograma:mediana")), 0L)
  tri <- .v711_piezas(h$lz, "histograma:mediana:triangulo"); base <- .v711_piezas(h$lz, "histograma:base")
  expect_equal(nrow(tri), 1L); expect_gt(tri$t, base$t)
  expect_identical(.lam_hist_marca("otra"), "linea")
  a <- Filter(function(x) identical(x$name, "marca_mediana"), .GRAFICADORES_META$p_histograma$args)
  expect_length(a, 1L); expect_identical(a[[1]]$default, "linea"); expect_true(isTRUE(a[[1]]$via_overrides))
  expect_true("marca_mediana" %in% names(formals(graficar_histograma)))
})

# Revisión del PPT v7.23, ítem 3 (Gonzalo: «no me gusta que hayan dos colores diferentes de barras»): retira el azul tenue
# de las barras de pocos casos que pedía la v7.11. Todas las barras y sus porcentajes van en el mismo azul.
test_that("v7.23 ítem 3: todas las barras del histograma van en un solo azul, también las de pocos casos", {
  h <- .v711_hist()
  expect_equal(nrow(.v711_piezas(h$lz, "histograma:barra:pocos")), 0L)
  barras <- h$lz$formas[vapply(h$lz$formas, grepl, TRUE, pattern = 'name="histograma:barra"')]
  expect_length(barras, 13L)
  expect_true(all(grepl(.lam_hex(.std_color("azul")), barras)))
  expect_false(any(grepl(.lam_hex(.std_color("tenue")), barras)))
  cif <- h$lz$formas[vapply(h$lz$formas, grepl, TRUE, pattern = 'name="histograma:cifra"')]
  expect_true(all(grepl(.lam_hex(.std_color("azul")), cif)))
})
