source("setup-load-all.R")

# ADR 0097, capa Word: los renderers leen `espec$colores` (nombres = rótulo) con el recetario como respaldo.

.wcp_capa <- function(g, i = 1L) suppressWarnings(ggplot2::layer_data(g, i))
.wcp_capa_con <- function(g, aes) {
  b <- suppressWarnings(ggplot2::ggplot_build(g))
  for (l in b$data) if (aes %in% names(l)) return(l)
  NULL
}
.wcp_div <- function() {
  d <- data.frame(item = c("Me siento seguro", "Recomendaría el servicio"), a = c(5, 10), b = c(15, 20), c = c(50, 40), e = c(30, 30))
  et <- c(a = "Totalmente en desacuerdo", b = "En desacuerdo", c = "De acuerdo", e = "Totalmente de acuerdo")
  .espec_divergentes(d, "item", c("a", "b", "c", "e"), et, particion = list(negativas = c("a", "b"), neutro = character(0), positivas = c("c", "e")))
}
.wcp_pie <- function() {
  d <- data.frame(cat = c("Dependiente", "Independiente", "No trabaja", "Estudia"), pct = c(.62, .21, .11, .06), n = c(110, 37, 20, 11))
  attr(suppressWarnings(graficar_pie(d, "cat", "pct", "n", tipo_pie = "donut")), "pulso_espec")
}
.wcp_pesas <- function() {
  grupos <- c("Conoce la misión", "Sabe dónde consultarla")
  d <- data.frame(eje = rep(c("Docentes", "Estudiantes", "Egresados", "Administrativos"), 2),
                  grupo = factor(rep(grupos, each = 4), levels = grupos), valor = c(98, 77, 78, 93, 92, 80, 81, 100))
  attr(suppressWarnings(graficar_dumbbell(d, mostrar_brecha = TRUE, orden = "declarado")), "pulso_espec")
}
.wcp_comp <- function() {
  V <- cbind(Masculino = c(94, 98, 96), Femenino = c(97, 96, 98))
  list(filas = c("Técnicas", "Visión", "Transversales"), grupos = colnames(V), valores = V)
}

test_that("el helper empareja por rótulo exacto, luego normalizado, y sin color cae al respaldo de ESE rótulo (no por posición)", {
  e <- list(colores = c("Sí" = "#00AA00", "no sabe " = "#777777", "Otro" = "#123456"))
  r <- .word_colores_de_espec(e, c("No", "Sí", "No  Sabe"), c("#000001", "#000002", "#000003"))
  expect_identical(as.vector(r), c("#000001", "#00AA00", "#777777"))
  expect_identical(attr(r, "de_paleta"), c(FALSE, TRUE, TRUE))
  # exacto gana al normalizado
  e2 <- list(colores = c("si" = "#111111", "Sí" = "#222222"))
  expect_identical(as.vector(.word_colores_de_espec(e2, "Sí", "#000000")), "#222222")
  expect_identical(as.vector(.word_colores_de_espec(e2, "SI", "#000000")), "#111111")
  # sin colores, sin nombres o con colores inválidos: el respaldo tal cual
  expect_identical(as.vector(.word_colores_de_espec(list(), c("a", "b"), c("#1", "#2"))), c("#1", "#2"))
  expect_identical(as.vector(.word_colores_de_espec(list(colores = c("#FF0000")), "a", "#000000")), "#000000")
  expect_identical(as.vector(.word_colores_de_espec(list(colores = c(a = "rojo")), "a", "#000000")), "#000000")
  expect_identical(.word_rotulo_norm("  Totalmente   DE acuérdo "), "totalmente de acuerdo")
})

test_that("barras: sin colores el relleno es el del recetario; con colores cada barra toma el suyo por rótulo", {
  e <- preparar_categorica(c("Redes sociales", "Un amigo", "No sabe"), c(.45, .30, .25), c("45%", "30%", "25%"))
  T <- .WORD_TINTA
  e$residuales_gris <- TRUE      # el gris de las residuales es opcional (test-residuales-gris-opcional.R): aquí, encendido
  r0 <- .wcp_capa(.word_g_barras(e))
  esperado0 <- ifelse(grepl(.CATEGORIAS_RESIDUALES, e$rotulos, ignore.case = TRUE), T$gris,
                      ifelse(seq_along(e$rotulos) == which.max(ifelse(grepl(.CATEGORIAS_RESIDUALES, e$rotulos, ignore.case = TRUE), -1, e$largos)),
                             T$navy, if (isTRUE(e$realce)) T$tenue else T$navy))
  expect_identical(r0$fill, esperado0)
  e$colores <- c("Un amigo" = "#AA0000", "Redes sociales" = "#00AA00")      # orden distinto al de las barras
  r1 <- .wcp_capa(.word_g_barras(e))
  expect_identical(r1$fill[e$rotulos == "Redes sociales"], "#00AA00")
  expect_identical(r1$fill[e$rotulos == "Un amigo"], "#AA0000")
  expect_identical(r1$fill[e$rotulos == "No sabe"], r0$fill[e$rotulos == "No sabe"])   # desconocido: respaldo del recetario
})

test_that("dicotomía: la paleta llega a las dos partes por rótulo", {
  e <- preparar_categorica(c("Sí", "No"), c(.31, .69), c("31%", "69%"), n = c(56, 122))
  r0 <- .wcp_capa(.word_g_sino(e))
  expect_identical(r0$fill, c(.WORD_TINTA$navy, .WORD_TINTA$celeste)[match(c("Sí", "No"), e$rotulos[1:2])])
  e$colores <- c(No = "#CC0000", "Sí" = "#00CC00")
  r1 <- .wcp_capa(.word_g_sino(e))
  expect_identical(r1$fill, c("#00CC00", "#CC0000")[match(e$rotulos[1:2], c("Sí", "No"))])
})

test_that("lollipop: el punto toma el color de su rótulo y, sin paleta, el mayor va en azul", {
  e <- preparar_categorica(c("A", "B", "C"), c(.2, .5, .3), c("20%", "50%", "30%"))
  p0 <- .wcp_capa(.word_g_lollipop(e), 2L)
  expect_identical(p0$colour, c(.WORD_TINTA$tenue, .WORD_TINTA$navy, .WORD_TINTA$tenue))   # orden de la espec: A, B, C
  e$colores <- c(B = "#0000AA", A = "#AA0000")
  p1 <- .wcp_capa(.word_g_lollipop(e), 2L)
  expect_identical(p1$colour, c("#AA0000", "#0000AA", .WORD_TINTA$tenue))                 # C sin color: su respaldo
})

test_that("divergentes: los colores van por etiqueta, no por posición", {
  esp <- .wcp_div()
  r0 <- .wcp_capa(.word_g_divergente(esp))
  C <- esp$categorias
  expect_setequal(unique(r0$fill), C$color)
  esp$colores <- c("Totalmente de acuerdo" = "#006600", "En desacuerdo" = "#EE8888")    # orden inverso y parcial
  g <- .word_g_divergente(esp)
  r1 <- .wcp_capa(g)
  k <- as.character(g$data$k)
  expect_true(all(r1$fill[k == "Totalmente de acuerdo"] == "#006600"))
  expect_true(all(r1$fill[k == "En desacuerdo"] == "#EE8888"))
  expect_true(all(r1$fill[k == "De acuerdo"] == C$color[C$rotulo == "De acuerdo"]))
  expect_true(all(r1$fill[k == "Totalmente en desacuerdo"] == C$color[C$rotulo == "Totalmente en desacuerdo"]))
})

test_that("torta/dona: cada porción toma su color por rótulo y el resto conserva el del recetario", {
  e <- .wcp_pie()
  rot <- as.character(e$rotulos)
  g0 <- .word_g_pie(e)
  r0 <- .wcp_capa(g0)
  expect_identical(r0$fill, .WORD_PALETA_TORTA[seq_along(rot)][match(as.character(g0$data$k), rot)])
  e$colores <- c(Estudia = "#FF00FF", Dependiente = "#00FFFF")
  g1 <- .word_g_pie(e)
  r1 <- .wcp_capa(g1)
  k <- as.character(g1$data$k)
  expect_identical(r1$fill[k == "Estudia"], "#FF00FF")
  expect_identical(r1$fill[k == "Dependiente"], "#00FFFF")
  expect_identical(r1$fill[k == "Independiente"], r0$fill[as.character(g0$data$k) == "Independiente"])
})

test_that("pesas: los dos grupos toman su color por rótulo; sin paleta, navy y celeste con la cifra de la segunda en azul medio", {
  e <- .wcp_pesas(); T <- .WORD_TINTA; gr <- as.character(e$grupos)
  g0 <- .word_g_pesas(e)
  p0 <- .wcp_capa(g0, 2L)
  expect_setequal(unique(p0$colour), c(T$navy, T$celeste))
  expect_identical(.wcp_capa(g0, 4L)$colour[1], T$medio)
  e$colores <- stats::setNames(c("#AA5500", "#0055AA"), rev(gr))
  g1 <- .word_g_pesas(e)
  p1 <- .wcp_capa(g1, 2L)
  expect_identical(p1$colour[p0$colour == T$navy], rep("#0055AA", sum(p0$colour == T$navy)))     # gr[1] era navy
  expect_identical(p1$colour[p0$colour == T$celeste], rep("#AA5500", sum(p0$colour == T$celeste)))
  expect_identical(.wcp_capa(g1, 3L)$colour[1], "#0055AA")
  expect_identical(.wcp_capa(g1, 4L)$colour[1], "#AA5500")
})

test_that("comparativo de dimensiones: pasa la paleta a los puntos y sin ella dibuja como hoy", {
  e <- .wcp_comp(); T <- .WORD_TINTA
  p0 <- .wcp_capa(.word_g_comparativo_dim(e), 2L)
  expect_setequal(unique(p0$colour), c(T$navy, T$celeste))
  e$colores <- c(Femenino = "#990099", Masculino = "#009999")
  p1 <- .wcp_capa(.word_g_comparativo_dim(e), 2L)
  expect_identical(p1$colour[p0$colour == T$navy], rep("#009999", sum(p0$colour == T$navy)))
  expect_identical(p1$colour[p0$colour == T$celeste], rep("#990099", sum(p0$colour == T$celeste)))
})

test_that("una paleta con rótulos de otra lista no cambia nada: todo cae al recetario", {
  e <- preparar_categorica(c("Redes sociales", "Un amigo", "Otro"), c(.45, .30, .25), c("45%", "30%", "25%"))
  r0 <- .wcp_capa(.word_g_barras(e))
  e$colores <- c(Nada = "#FF0000", Que = "#00FF00", Ver = "#0000FF")
  expect_identical(.wcp_capa(.word_g_barras(e))$fill, r0$fill)
  p <- .wcp_pie(); f0 <- .wcp_capa(.word_g_pie(p))$fill
  p$colores <- c(Nada = "#FF0000")
  expect_identical(.wcp_capa(.word_g_pie(p))$fill, f0)
})
