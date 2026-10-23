# M1 con piso (Gonzalo, 2026-10-22): «mientras menos (cont) haya mejor» y, antes, «seis barras caben en una lámina».
# Con `grosor_piso_cm` (N1) se quitó la tolerancia 1,15 de la partición y bloques de 6 barras de un solo público se
# partían en «(cont.)». Ahora, con piso, se comprime el AIRE entre premisas (gap >= 0,12 in) y no la barra: 6 barras de
# un solo público caben en una lámina si, con el grosor del piso y ese gap mínimo, entran en la franja; si no, se parte.
.m1_niv <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo")
.m1_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.m1_cola <- c(corta = "", media = " y que permiten desarrollar las actividades", larga = " y que permiten desarrollar con regularidad las actividades de enseñanza, investigación y vinculación con el entorno social del que forma parte la universidad en general")
# `largos`: el largo de cada enunciado (se recicla); `chica`: la primera categoría queda con 1 % (cifra fuera de su segmento)
.m1_espec <- function(n, largos = "media", piso = NULL, chica = TRUE) {
  largos <- rep_len(largos, n)
  d <- data.frame(item = sprintf("p%02d", seq_len(n)), N = 51, t1 = if (chica) 0.01 else 0.10, t2 = if (chica) 0.04 else 0.15, t3 = 0.45, t4 = 0.40,
                  rotulo = sprintf("Los recursos del área %d son suficientes y están disponibles%s", seq_len(n), unname(.m1_cola[largos])))
  e <- preparar_escala(d, "item", "N", paste0("t", 1:4), .m1_niv, var_etiqueta_categoria = "rotulo",
                       colores_grupos = as.list(setNames(.std_paleta("likert")[1:4], .m1_niv)),
                       barra_extra_preset = "top2box", top2box_labels = .m1_niv[3:4])
  if (!is.null(piso)) e$grosor_piso_cm <- piso
  e
}
.m1_formas <- function(doc) {
  x <- doc$slide$get_slide(doc$cursor)$get(); sp <- xml2::xml_find_all(x, "//p:sp")
  nm <- xml2::xml_attr(xml2::xml_find_first(sp, "p:nvSpPr/p:cNvPr"), "name")
  g <- function(a) as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, paste0("p:spPr/a:xfrm/", if (a %in% c("x", "y")) "a:off" else "a:ext")),
                                             switch(a, x = "x", y = "y", w = "cx", h = "cy"))) / 914400
  data.frame(nombre = nm, x = g("x"), y = g("y"), w = g("w"), h = g("h"), stringsAsFactors = FALSE)
}
.m1_lam <- function(e) suppressMessages(.lam_laminas_escala(.m1_doc(), e, "Recursos de apoyo", folio = 1))
PISO <- 1.12

test_that("M1 con piso: cinco enunciados de 3 líneas de un solo público caben en UNA lámina, sin bajar el grosor del piso", {
  e <- .m1_espec(5, "media", PISO)
  pr <- .lam_escala_premisas(e); wp <- .lam_escala_ancho_prem(pr)
  expect_true(all(abs(vapply(pr, .lam_premisa_alto, 0, wp = wp) - 0.75) < 0.01))      # 3 líneas por enunciado
  expect_gt(.lam_escala_alto(pr), .lam_escala_alto_util())                           # con el gap de hoy (0,26 in) no cabía
  o <- .m1_lam(e)
  expect_identical(o$partes, 1L)
  seg <- .m1_formas(o$doc); seg <- seg[seg$nombre == "segmento", ]
  expect_gte(min(seg$h) * 2.54, PISO - 0.005)
})

test_that("M1 con piso: la leyenda no pisa la última barra, las premisas no se pisan y la cifra chica no toca la barra de arriba", {
  f <- .m1_formas(.m1_lam(.m1_espec(5, "media", PISO))$doc)
  seg <- f[f$nombre == "segmento", ]; ley <- f[f$nombre == "leyenda:cuadro", ]
  expect_gt(nrow(ley), 0)
  expect_gte(min(ley$y) - max(seg$y + seg$h), 0.05)
  pr <- f[f$nombre == "premisa", ]; pr <- pr[order(pr$y), ]
  expect_equal(nrow(pr), 5L)
  expect_gte(min(pr$y[-1] - (pr$y + pr$h)[-nrow(pr)]), -1e-6)
  cf <- f[f$nombre == "cifra_fuera", ]; expect_gt(nrow(cf), 0)
  filas <- sort(unique(round(seg$y, 3)))
  holg <- vapply(seq_len(nrow(cf)), function(i) {
    ab <- filas[filas > cf$y[i]][1]; if (is.na(ab)) return(NA_real_)
    sel <- round(seg$y, 3) < ab; if (!any(sel)) return(NA_real_); cf$y[i] - max(seg$y[sel] + seg$h[sel])
  }, 0)
  expect_true(any(!is.na(holg)))
  expect_gte(min(holg, na.rm = TRUE), 0.075 - 1e-6)
})

test_that("M1 con piso: seis barras de enunciados mixtos (sin cifras chicas) caben en una lámina; con cifras chicas y 3 líneas no", {
  expect_identical(.m1_lam(.m1_espec(6, c("media", "corta", "corta"), PISO, chica = FALSE))$partes, 1L)
  expect_gt(.m1_lam(.m1_espec(6, "media", PISO))$partes, 1L)   # 6 x 0,75 in ya no caben ni con el aire mínimo
})

test_that("M1: más de 6 barras, o enunciados que no caben ni comprimidos, se parten como hoy", {
  expect_gt(.m1_lam(.m1_espec(7, "corta", PISO))$partes, 1L)
  expect_gt(.m1_lam(.m1_espec(5, "larga", PISO))$partes, 1L)
})

test_that("M1: evitar_cont = FALSE devuelve el comportamiento de N1 (se parte); sin piso nada cambia", {
  e <- .m1_espec(5, "media", PISO)
  expect_identical(.m1_lam(e)$partes, 1L)
  op <- options(prosecnur.evitar_cont = FALSE); on.exit(options(op))
  expect_identical(.m1_lam(e)$partes, 2L)
  options(op)
  expect_null(getOption("prosecnur.grosor_piso_cm"))
  pr <- .lam_escala_premisas(.m1_espec(7, "corta"))
  fn <- function(p) .lam_escala_aire_minimo(p)$alto
  expect_identical(.lam_escala_partir(pr, aire_min_fn = fn), .lam_escala_partir(pr))   # sin piso el aire mínimo no actúa
  pr6 <- .lam_escala_premisas(.m1_espec(6, "corta"))
  expect_length(.lam_escala_partir(pr6, alto_fn = function(p) 1.10 * .lam_escala_alto_util(), aire_min_fn = fn), 1L)   # y la tolerancia 1,15 sigue
})

test_that("M1: evitar_cont se declara en el informe (presets$base$args$evitar_cont)", {
  op <- .evitar_cont_fijar(list(base = list(args = list(evitar_cont = FALSE)))); on.exit(options(op))
  expect_false(isTRUE(getOption("prosecnur.evitar_cont")))
  expect_identical(.evitar_cont_fijar(list(base = list(args = list()))), list())
})

test_that("M1: el aire mínimo pide la separación de la cifra chica solo antes de la premisa que la tiene", {
  g <- 1.12 / 2.54
  m <- .lam_aire_minimo(rep(0.533, 3), rep(1, 3), g, chica = c(FALSE, FALSE, TRUE))
  expect_equal(m$gaps, c(0.08, g + 0.28 + 0.075 - 0.533), tolerance = 1e-9)
  expect_equal(.lam_aire_minimo(rep(0.533, 3), rep(1, 3), g, chica = FALSE)$gaps, c(0.08, 0.08))
  # enunciados de 3 líneas (0,75 in): el paso de la cifra chica ya lo da el texto y basta el gap mínimo
  expect_equal(.lam_aire_minimo(rep(0.75, 4), rep(1, 4), g, chica = TRUE)$gaps, rep(0.08, 3))
  # la barra no es parte del aire: el alto crece con el piso, no se comprime por debajo de él
  expect_gte(m$fila, g + 0.08)
})
