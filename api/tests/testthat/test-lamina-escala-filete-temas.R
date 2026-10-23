# N2 (Renzo, 2026-10-22): la línea que separa un tema de otro dentro de la multiapilada no siempre ayuda. `filete_temas`
# la quita con FALSE; el filete bajo la fila Total no se toca.
# N2b (Renzo, 2026-10-22, pedido expreso): «no líneas grises entre cosas que no sean gráficos completamente diferentes; en
# multiapiladas sin la línea». CAMBIO DELIBERADO DE DEFAULT: `filete_temas` pasa de TRUE a FALSE; la línea sale sólo con
# `filete_temas = TRUE` explícito. Por eso el test de «por defecto» ahora espera 0 filetes.

.niv_f <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo", t5 = "SIN INF")
.espec_f <- function() {
  d <- data.frame(item = sprintf("p%02d", 1:4), rotulo = c("Docentes", "Estudiantes", "Docentes", "Estudiantes"), N = 100,
                  t1 = 0.05, t2 = 0.1, t3 = 0.5, t4 = 0.3, t5 = 0.05)
  e <- preparar_escala(d, "item", "N", paste0("t", 1:5), .niv_f, var_etiqueta_categoria = "rotulo",
                       colores_grupos = as.list(setNames(.std_paleta("likert"), .niv_f)),
                       barra_extra_preset = "top2box", top2box_labels = .niv_f[3:4])
  e$filas$grupo_id <- c("P1", "P1", "P2", "P2")
  e$filas$grupo_titulo <- c("La biblioteca", "La biblioteca", "El laboratorio", "El laboratorio")
  e
}
.formas_f <- function(doc, nombre) {
  x <- doc$slide$get_slide(doc$cursor)$get()
  xml2::xml_text(xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre)))
}
.doc_f <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.n_f <- function(e, nombre) length(.formas_f(.lam_laminas_escala(.doc_f(), e, "Servicios", folio = 1)$doc, nombre))

test_that("por defecto no hay filete entre temas; con TRUE explícito sale y con FALSE no", {
  e <- .espec_f()
  expect_identical(.n_f(e, "filete"), 0L)
  e$filete_temas <- TRUE
  expect_gte(.n_f(e, "filete"), 1L)
  e$filete_temas <- FALSE
  expect_identical(.n_f(e, "filete"), 0L)
})

test_that("el graficador y la metadata declaran filete_temas = FALSE por defecto", {
  expect_false(formals(graficar_barras_apiladas)$filete_temas)
  g <- Filter(function(x) identical(x$name, "p_barras_multiapiladas"), .graficos_registry_payload()$graficadores)
  a <- Filter(function(x) identical(x$name, "filete_temas"), g[[1]]$args)
  expect_length(a, 1L)
  expect_false(isTRUE(a[[1]]$default))
})

test_that("filete_temas = FALSE no toca el filete bajo la fila Total", {
  e <- .espec_f(); e$filete_temas <- FALSE
  sin <- .lam_laminas_escala(.doc_f(), e, "Servicios", folio = 1)$doc
  x <- sin$slide$get_slide(sin$cursor)$get()
  nombres <- xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name")
  expect_false("filete" %in% nombres)
  # la fila Total vive en la lámina de filas; ahí `filete:total` se conserva con filete_temas apagado
  src <- paste(deparse(body(.lam_filas_box)), collapse = "\n")
  expect_match(src, "filete:total", fixed = TRUE)
})

test_that("el plan y el graficador llevan filete_temas y validan que sea lógico", {
  expect_false(p_barras_multiapiladas(modo = "var", vars = c("p1", "p2"), filete_temas = FALSE)$overrides$filete_temas)
  expect_null(p_barras_multiapiladas(modo = "var", vars = c("p1", "p2"))$overrides$filete_temas)
  expect_error(p_barras_multiapiladas(modo = "var", vars = c("p1", "p2"), filete_temas = "no"), "filete_temas")

  d <- data.frame(categoria = c("A", "B"), N = c(10, 20), pct_1 = c(.1, .2), pct_2 = c(.2, .2), pct_3 = c(.4, .3), pct_4 = c(.3, .3))
  cats <- c(pct_1 = "Totalmente en desacuerdo", pct_2 = "En desacuerdo", pct_3 = "De acuerdo", pct_4 = "Totalmente de acuerdo")
  p <- graficar_barras_apiladas(d, "categoria", var_n = "N", cols_porcentaje = names(cats), etiquetas_grupos = cats,
                                usar_canvas = FALSE, exportar = "rplot", filete_temas = FALSE)
  expect_false(attr(p, "pulso_espec")$filete_temas)
  p2 <- graficar_barras_apiladas(d, "categoria", var_n = "N", cols_porcentaje = names(cats), etiquetas_grupos = cats,
                                 usar_canvas = FALSE, exportar = "rplot")
  expect_false(attr(p2, "pulso_espec")$filete_temas)
})

test_that("la metadata de la multiapilada declara filete_temas como bool con default FALSE (N2b)", {
  g <- Filter(function(x) identical(x$name, "p_barras_multiapiladas"), .graficos_registry_payload()$graficadores)
  expect_length(g, 1L)
  a <- Filter(function(x) identical(x$name, "filete_temas"), g[[1]]$args)
  expect_length(a, 1L)
  expect_identical(a[[1]]$tipo_input, "bool"); expect_false(a[[1]]$default)
})
