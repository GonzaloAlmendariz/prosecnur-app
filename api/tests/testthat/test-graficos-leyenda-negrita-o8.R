source("setup-load-all.R")

# O8 (docs/qa/checklist-revamp-informe-graficos-2026-10-14.md, Gonzalo 2026-10-15): negrita por elemento y leyenda que
# cabe, en la lámina nativa y en las figuras del Word; ID6-b: el paso de letra llega a las figuras del Word.
# Los valores por defecto reproducen lo de hoy.

.o8_likert <- c("Totalmente en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo", "De acuerdo", "Totalmente de acuerdo")
# Medida determinista para la función pura (no depende de las fuentes de la máquina).
.o8_medir <- function(s, size, bold) nchar(s) * size * (if (isTRUE(bold)) 0.56 else 0.5) / 72
.o8_seguidas <- function(filas) identical(unlist(filas), seq_len(length(unlist(filas)))) &&
  all(vapply(filas, function(f) all(diff(f) == 1L), TRUE))

# --- .leyenda_plan (pura) ---------------------------------------------------------------------------------------------

test_that("automática: una fila si cabe; si no, filas equilibradas en orden de lectura que caben", {
  p <- .leyenda_plan(.o8_likert, 12.52, 12, medir = .o8_medir)
  expect_length(p$filas, 1L); expect_true(p$cabe); expect_equal(p$gaps, 0.3)
  p <- .leyenda_plan(.o8_likert, 6.01, 12, medir = .o8_medir)
  expect_true(p$cabe); expect_gt(length(p$filas), 1L)
  expect_true(.o8_seguidas(p$filas))                                   # 1-2-3 / 4-5, nunca por columnas
  expect_true(all(p$totales <= 6.01 + 1e-9))
  expect_lte(max(lengths(p$filas)) - min(lengths(p$filas)), 1L)        # equilibradas
})

test_that("una fila: aprieta el espacio y después la letra hasta el piso; si no puede, cae a filas y lo avisa", {
  labs <- c("Muy en desacuerdo", "En desacuerdo", "De acuerdo", "Muy de acuerdo")   # 57 caracteres
  p <- .leyenda_plan(labs, 5.4, 12, modo = "una_fila", piso_pt = 10, medir = .o8_medir)
  expect_length(p$filas, 1L); expect_true(p$cabe); expect_lt(p$size, 12); expect_gte(p$size, 10)
  expect_null(p$aviso)
  p <- .leyenda_plan(.o8_likert, 4, 12, modo = "una_fila", piso_pt = 10, medir = .o8_medir)
  expect_gt(length(p$filas), 1L); expect_equal(p$size, 12)
  expect_match(p$aviso, "no cabe en una fila")
})

test_that("dos filas: equilibradas y seguidas aunque una sola cupiera; con dos rótulos, como la automática", {
  p <- .leyenda_plan(.o8_likert, 12.52, 12, modo = "dos_filas", medir = .o8_medir)
  expect_identical(p$filas, list(1:3, 4:5))
  expect_length(.leyenda_plan(c("Sí", "No"), 12.52, 12, modo = "dos_filas", medir = .o8_medir)$filas, 1L)
  expect_identical(.leyenda_plan(.o8_likert, 12.52, 12, modo = "nada", medir = .o8_medir)$modo, "automatica")
})

test_that("con negrita la leyenda se mide más ancha", {
  a <- .leyenda_plan(.o8_likert, 30, 12, medir = .o8_medir)
  b <- .leyenda_plan(.o8_likert, 30, 12, bold = TRUE, medir = .o8_medir)
  expect_gt(b$totales, a$totales)
})

test_that("la rejilla de ggplot suma las columnas más anchas de todas las filas", {
  p <- .leyenda_plan(c("aaaaaaaaaa", "b", "c", "dddddddddddddddddddd"), 1e3, 10, modo = "dos_filas", rejilla = TRUE, medir = .o8_medir)
  w <- .o8_medir(c("aaaaaaaaaa", "b", "c", "dddddddddddddddddddd"), 10, FALSE) + 0.22
  expect_equal(p$totales[2], max(w[1], w[3]) + max(w[2], w[4]) + 0.3)
})

# --- negrita por elemento ---------------------------------------------------------------------------------------------

test_that("sin opción o con el defecto, cada pieza conserva su negrita de fábrica", {
  withr::local_options(prosecnur.negrita = NULL)
  expect_identical(.std_negrita("titulos", FALSE), FALSE)
  expect_identical(.std_negrita("categorias", c(TRUE, FALSE)), c(TRUE, FALSE))
  withr::local_options(prosecnur.negrita = .NEGRITA_DEFECTO)
  for (rol in names(.NEGRITA_DEFECTO)) {
    expect_identical(.std_negrita(rol, c(TRUE, FALSE)), c(TRUE, FALSE), info = rol)
  }
})

test_that("un rol que se aparta del defecto fuerza su negrita; categorías todas y ninguna", {
  withr::local_options(prosecnur.negrita = list(titulos = FALSE, leyenda = TRUE, categorias = "ninguna"))
  expect_false(.std_negrita("titulos", TRUE))
  expect_true(.std_negrita("leyenda", FALSE))
  expect_identical(.std_negrita("categorias", c(TRUE, FALSE)), c(FALSE, FALSE))
  expect_identical(.word_cara("categorias", c(TRUE, FALSE)), c("plain", "plain"))
  withr::local_options(prosecnur.negrita = list(categorias = "todas"))
  expect_identical(.word_cara("categorias", c(TRUE, FALSE)), c("bold", "bold"))
  expect_true(.std_negrita_forzada("categorias"))
})

test_that("el nombre de cada pieza de la lámina cae en su rol", {
  esperado <- c("Titulo lamina" = "titulos", "portada:titulo" = "titulos", "pregunta" = "preguntas", "premisa" = "preguntas",
                "box:cifra" = "box", "box2:rotulo" = "box", "ttb:cifra" = "box", "leyenda:texto" = "leyenda",
                "Base lamina" = "base", "premisa:n" = "base", "torta:casos" = "base", "cifra" = "cifras", "cifra_fuera" = "cifras",
                "dicotomia:cifra" = "cifras", "pesas:cifra_a" = "cifras", "rotulo" = "categorias", "actor" = "categorias",
                "lollipop:rotulo" = "categorias", "mapa:cifra_rotulo" = NA, "encabezado" = NA, "eje:marca" = NA)
  for (n in names(esperado)) expect_identical(.lam_rol_negrita(n), unname(esperado[[n]]), info = n)
})

test_that(".lam_txt aplica la negrita del rol en el XML de la pieza", {
  b <- function(nombre, bold) {
    lz <- .lam_lienzo(); .lam_txt(lz, "x", 0, 0, 1, 0.3, bold = bold, nombre = nombre)
    regmatches(lz$formas[[1]], regexpr('b="[01]"', lz$formas[[1]]))
  }
  withr::local_options(prosecnur.negrita = NULL)
  expect_identical(b("rotulo", TRUE), 'b="1"'); expect_identical(b("leyenda:texto", FALSE), 'b="0"')
  withr::local_options(prosecnur.negrita = list(categorias = "ninguna", leyenda = TRUE, cifras = FALSE))
  expect_identical(b("rotulo", TRUE), 'b="0"'); expect_identical(b("leyenda:texto", FALSE), 'b="1"')
  expect_identical(b("cifra", TRUE), 'b="0"'); expect_identical(b("encabezado", TRUE), 'b="1"')
})

# --- transporte en estilo_cliente -------------------------------------------------------------------------------------

test_that("estilo_cliente valida negrita y leyenda con E_BAD_ESTILO_CLIENTE", {
  ok <- list(letra = list(negrita = list(titulos = FALSE, categorias = "todas", leyenda = TRUE), leyenda = "dos_filas"))
  expect_silent(.graficos_estilo_cliente_validar(ok))
  expect_silent(.graficos_estilo_cliente_validar(list(letra = list(negrita = list(futuro = 1)))))   # clave nueva: se conserva
  for (malo in list(list(letra = list(negrita = list(categorias = "algunas"))), list(letra = list(negrita = list(base = "no"))),
                    list(letra = list(negrita = "todo")), list(letra = list(leyenda = "tres_filas")))) {
    e <- tryCatch(.graficos_estilo_cliente_validar(malo), api_error = function(e) e)
    expect_s3_class(e, "api_error")
    expect_identical(e$code %||% e$data$code %||% attr(e, "code"), "E_BAD_ESTILO_CLIENTE")
  }
})

test_that("sólo se guarda lo que se aparta de hoy y el worker recibe y repone las opciones", {
  x <- list(version = 1, letra = list(negrita = list(titulos = TRUE, categorias = "mayor", leyenda = TRUE), leyenda = "automatica"))
  d <- .graficos_estilo_cliente_solo_decisiones(x)
  expect_identical(d$letra, list(negrita = list(leyenda = TRUE)))
  expect_identical(.graficos_estilo_cliente_solo_decisiones(list(letra = list(negrita = .NEGRITA_DEFECTO, leyenda = "automatica"))), list())
  est <- .graficos_estilo_cliente_resolver("sin-sesion", list(estilo_cliente = list(letra = list(negrita = list(cifras = FALSE), leyenda = "una_fila"))))
  expect_identical(est$letra$negrita, list(cifras = FALSE))
  expect_identical(est$letra$leyenda, "una_fila")
  expect_identical(.graficos_estilo_cliente_resolver("sin-sesion", list(estilo_cliente = list(letra = list(negrita = .NEGRITA_DEFECTO)))), list())
  withr::local_options(prosecnur.negrita = NULL, prosecnur.leyenda = NULL)
  previas <- .graficos_estilo_cliente_aplicar_letra(est$letra)
  expect_identical(getOption("prosecnur.negrita"), list(cifras = FALSE)); expect_identical(.std_leyenda_modo(), "una_fila")
  options(previas)
  expect_null(getOption("prosecnur.negrita")); expect_identical(.std_leyenda_modo(), "automatica")
  expect_false(identical(.graficos_estilo_cliente_huella(est), NULL))                    # la miniatura cambia de huella
})

# --- lámina: la leyenda del panel de media columna no sale del panel ---------------------------------------------------

.o8_cajas_leyenda <- function(lz) {
  nom <- vapply(lz$formas, function(f) sub('.*name="([^"]*)".*', "\\1", f), "")
  do.call(rbind, lz$cajas[startsWith(nom, "leyenda:")])
}

test_that("cinco rótulos largos de escala en un panel de media columna quedan dentro del panel (antes se salían ~0,5 in)", {
  x0 <- 0.495; w <- 6.01; x1 <- x0 + w
  cols <- rep("#123456", 5)
  lz <- .lam_lienzo()
  fin <- .lam_leyenda_panel(lz, 5, .o8_likert, cols, centro = x0 + 1.4 + (w - 1.4) / 2, x0 = x0, x1 = x1)
  cj <- .o8_cajas_leyenda(lz)
  cuadros <- cj[seq(1, nrow(cj), 2), , drop = FALSE]
  plan <- attr(.lam_leyenda_filas(.o8_likert, w), "plan")
  expect_true(plan$cabe)
  expect_gte(min(cuadros[, 1]), x0 - 1e-9)
  # El texto termina donde termina su tinta (la caja lleva 0,3 in de holgura a la derecha y 0,1 de margen interno).
  fin_tinta <- cuadros[, 1] + 0.22 + plan$anchos
  expect_lte(max(fin_tinta), x1 + 1e-6)
  expect_equal(fin - 5, 0.3 * length(plan$filas))
  # El reparto anterior (3 + 2 a 0,15 in) no cabía: la primera fila medía más que el panel.
  vieja <- sum(0.22 + .lam_ancho_tinta(.o8_likert[1:3], .std_pt("leyenda"))) + 0.15 * 2
  expect_gt(vieja, w)
})

test_that("en el ancho de la lámina la automática reproduce la leyenda de siempre (una fila, mismas posiciones)", {
  withr::local_options(prosecnur.negrita = NULL, prosecnur.leyenda = NULL)
  labs <- c("Muy en desacuerdo", "En desacuerdo", "De acuerdo", "Muy de acuerdo")
  centro <- 5; lz <- .lam_lienzo(); .lam_leyenda(lz, 6, labs, rep("#123456", 4), centrar_en = centro)
  cj <- .o8_cajas_leyenda(lz)
  # Lo que hacía `.lam_leyenda` antes de O8.
  g <- .std_geom; ml <- g("margen_izq"); finx <- g("ancho") - g("margen_der")
  ws <- 0.22 + .lam_ancho_tinta(labs, .std_pt("leyenda")); gap <- 0.3; tot <- sum(ws) + gap * 3
  disp <- 2 * min(centro - ml, finx - centro)
  if (tot > disp) { gap <- max(0.15, (disp - sum(ws)) / 3); tot <- sum(ws) + gap * 3 }
  x <- min(max(centro - tot / 2, ml), finx - tot); xs <- x + c(0, cumsum(ws + gap)[1:3])
  expect_equal(cj[seq(1, nrow(cj), 2), 1], xs, tolerance = 1e-9)
  expect_true(all(cj[, 2] %in% c(6, 6.07)))
})

test_that("la compuerta del panel de escala exige que la leyenda quepa", {
  rot <- c("Una categoría con un rótulo larguísimo que no entra en ningún panel angosto de la lámina", "Otra")
  d <- data.frame(item = "i1", N = 100, p1 = .5, p2 = .5)
  e <- preparar_escala(d, "item", "N", c("p1", "p2"), c(p1 = rot[1], p2 = rot[2]))
  expect_false(attr(.lam_leyenda_filas(rot, 3), "plan")$cabe)
  expect_false(.lam_panel_geo(e, 0.5, 2, 3, 2.15)$cabe)
})

# --- Word: filas de la leyenda medidas, negrita y paso de letra (ID6-b) -----------------------------------------------

.o8_escala <- function(rot = c("Muy en desacuerdo", "En desacuerdo", "De acuerdo", "Muy de acuerdo", "SIN INF")) {
  d <- data.frame(actor = c("Docentes", "Estudiantes"), N = c(52, 172), p1 = c(.02, .03), p2 = c(.06, .11), p3 = c(.44, .51),
                  p4 = c(.46, .33), p5 = c(.02, .02))
  preparar_escala(d, "actor", "N", paste0("p", 1:5), setNames(rot, paste0("p", 1:5)), barra_extra_preset = "top2box",
                  top2box_labels = rot[3:4])
}
.o8_guia <- function(g) {
  p <- g$guides$guides$fill$params
  list(nrow = p$nrow, byrow = isTRUE(p$theme$legend.byrow))   # ggplot2 4: byrow vive en el tema de la guía
}

test_that("la leyenda Word va en las filas del plan, por filas y en orden", {
  withr::local_options(prosecnur.leyenda = NULL, prosecnur.negrita = NULL)
  g <- .word_g_escala(.o8_escala())
  expect_length(attr(g, "leyenda_plan")$filas, 1L)
  expect_equal(.o8_guia(g)$nrow, 1L)
  g <- .word_g_escala(.o8_escala(.o8_likert))
  expect_identical(attr(g, "leyenda_plan")$filas, list(1:3, 4:5))
  expect_equal(.o8_guia(g)$nrow, 2L); expect_true(.o8_guia(g)$byrow)
  withr::local_options(prosecnur.leyenda = "dos_filas")
  expect_equal(.o8_guia(.word_g_escala(.o8_escala()))$nrow, 2L)
})

test_that("las divergentes Word ordenan la leyenda por filas (antes, con seis rótulos, por columnas)", {
  withr::local_options(prosecnur.leyenda = NULL)
  esp <- list(filas = "a", categorias = data.frame(rotulo = paste("Categoría", 1:6), color = rep("#123456", 6),
                                                   lado = c("neg", "neg", "neg", "pos", "pos", "pos")),
              unidades = matrix(c(10, 10, 10, 20, 20, 30), 1), cifras = matrix(rep("1%", 6), 1),
              orden_neg = 1:3, orden_pos = 4:6, total_neg = 30, total_pos = 70, cifras_neg = "30%", cifras_pos = "70%")
  g <- .word_g_divergente(esp)
  expect_true(.o8_guia(g)$byrow)
  expect_true(.o8_seguidas(attr(g, "leyenda_plan")$filas))
})

.o8_textos <- function(g) {
  pts <- vapply(g$layers, function(l) if (inherits(l$geom, "GeomText") && is.numeric(l$aes_params$size)) l$aes_params$size * ggplot2::.pt else NA_real_, 0)
  sort(unique(round(pts[!is.na(pts)], 2)))
}

test_that("ID6-b: el paso de letra llega a las figuras del Word; en «estándar» salen los tamaños de siempre", {
  withr::local_options(prosecnur.letra_desplazo = NULL)
  g0 <- .word_g_escala(.o8_escala())
  expect_equal(.o8_textos(g0), c(8, 8.55, 9.03, 9.5))                    # medido antes del cambio
  expect_equal(g0$theme$legend.text$size, 8)
  withr::local_options(prosecnur.letra_desplazo = .graficos_estilo_cliente_desplazos(list(paso = "muy_grande")))
  g4 <- .word_g_escala(.o8_escala())
  expect_true(all(.o8_textos(g4) > 9.5))                                  # antes: 8/8.55/9.03/9.5, igual que en estándar
  expect_equal(g4$theme$legend.text$size, 12)
  expect_equal(.word_tema()$legend.text$size, 12)
})

test_that("la negrita del Word sigue Identidad › Letra: la categoría mayor, todas o ninguna; cifras y leyenda", {
  esp <- preparar_categorica(c("A", "B", "C"), c(.5, .3, .2), c("50%", "30%", "20%"))
  esp$realce <- TRUE
  caras <- function() {
    b <- suppressWarnings(ggplot2::ggplot_build(.word_g_barras(esp)))
    rot <- Filter(function(l) "label" %in% names(l) && any(l$label %in% c("A", "B", "C")), b$data)[[1]]
    stats::setNames(rot$fontface, rot$label)
  }
  withr::local_options(prosecnur.negrita = NULL)
  expect_identical(unname(caras()[c("A", "B")]), c("bold", "plain"))
  withr::local_options(prosecnur.negrita = list(categorias = "todas"))
  expect_true(all(caras() == "bold"))
  withr::local_options(prosecnur.negrita = list(categorias = "ninguna", cifras = FALSE, leyenda = TRUE))
  expect_true(all(caras() == "plain"))
  g <- .word_g_barras(esp)
  expect_identical(g$layers[[2]]$aes_params$fontface, "plain")           # la cifra de cada barra
  expect_identical(.word_tema()$legend.text$face, "bold")
})
