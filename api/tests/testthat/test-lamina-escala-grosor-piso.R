# N1 (Renzo, 2026-10-22): «barras muy delgadas». Decisión del usuario: piso de 1,12 cm (el grosor que la tabla del estándar
# da con 6 barras) en las láminas de ESCALA de Arte; si con ese piso no caben, se parten. Se declara con `grosor_piso_cm`
# (slot de la lámina o `presets$base$args` del informe). Desde 2026-10-26 (Gonzalo: «las barras se ven muy delgadas cuando
# pensé que ya habíamos solucionado eso en el motor actual») el piso del estándar (`ppt.grosor.piso_escala_cm`, 1,12 cm)
# rige sin declaración; un 0 explícito lo apaga. Las categóricas quedan fuera.

.niv_gp <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo", t5 = "SIN INF")
.espec_gp <- function(n, largo = FALSE, base = 51) {
  set.seed(n)
  d <- do.call(rbind, lapply(seq_len(n), function(k) {
    c3 <- sample(10:25, 1); c4 <- base - c3 - sample(0:2, 1); resto <- base - c3 - c4
    data.frame(item = sprintf("p%02d", k), N = base, t1 = 0, t2 = resto, t3 = c3, t4 = c4, t5 = 0,
               rotulo = if (largo) sprintf("La Unidad de Comunicación Interna garantiza que la información institucional llegue a tiempo, de forma clara y por los canales adecuados a todo el personal (%d)", k)
                        else sprintf("Competencia %d", k))
  }))
  d[paste0("t", 1:5)] <- d[paste0("t", 1:5)] / d$N
  preparar_escala(d, "item", "N", paste0("t", 1:5), .niv_gp, var_etiqueta_categoria = "rotulo",
                  colores_grupos = as.list(setNames(.std_paleta("likert"), .niv_gp)),
                  barra_extra_preset = "top2box", top2box_labels = .niv_gp[3:4])
}
.doc_gp <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.alto_seg_cm <- function(doc) {   # alto de los segmentos de la última lámina, en cm
  x <- doc$slide$get_slide(doc$cursor)$get()
  sp <- xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='segmento']]")
  as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "p:spPr/a:xfrm/a:ext"), "cy")) / 914400 * 2.54
}
.laminas_gp <- function(e) suppressMessages(.lam_laminas_escala(.doc_gp(), e, "Comunicación", folio = 1))
PISO_CM <- 1.12

test_that("sin declarar piso rige el del estándar: 6 barras no bajan de 1,12 cm", {
  withr::local_options(prosecnur.grosor_piso_cm = NULL)
  expect_equal(.std_valor("ppt", "grosor", "piso_escala_cm"), PISO_CM)
  o <- .laminas_gp(.espec_gp(6))
  expect_gte(min(.alto_seg_cm(o$doc)), PISO_CM - 0.005)
})

test_that("con piso 0 (apagado a propósito) el grosor es el de la tabla y las barras de 6 con cifras chicas siguen finas", {
  withr::local_options(prosecnur.grosor_piso_cm = 0)
  expect_equal(.std_grosor(6, "escala_apilada"), 0.44)   # la tabla del estándar va en pulgadas (≈ 1,12 cm)
  expect_equal(.std_grosor(9, "escala_apilada"), 0.38)
  o <- .laminas_gp(.espec_gp(6))
  expect_identical(o$partes, 1L)
  expect_lt(min(.alto_seg_cm(o$doc)), 1.0)    # la regla de cifras chicas adelgaza (0,61 cm medido en Arte)
})

test_that("con piso 1,12 cm una escala de 6 barras no baja de 1,12 cm", {
  e <- .espec_gp(6); e$grosor_piso_cm <- PISO_CM
  o <- .laminas_gp(e)
  expect_gte(min(.alto_seg_cm(o$doc)), PISO_CM - 0.005)
})

test_that("con piso y evitar_cont = FALSE, una lámina de enunciados largos se parte en 2 en vez de apretarse; sin piso, cabe en 1", {
  # M1 (2026-10-22): por defecto, con piso, el aire cede hasta su mínimo y la lámina de 4 enunciados largos cabe en 1
  # (test-lamina-escala-m1-sin-cont.R); apagado, `evitar_cont = FALSE`, vale lo de N1: se parte.
  expect_identical(.laminas_gp(.espec_gp(4, largo = TRUE))$partes, 1L)
  e <- .espec_gp(4, largo = TRUE); e$grosor_piso_cm <- PISO_CM
  op <- options(prosecnur.evitar_cont = FALSE); on.exit(options(op))
  o <- .laminas_gp(e)
  expect_identical(o$partes, 2L)
  expect_gte(min(.alto_seg_cm(o$doc)), PISO_CM - 0.005)
  options(prosecnur.evitar_cont = NULL)
  o1 <- .laminas_gp(e)
  expect_identical(o1$partes, 1L)
  expect_gte(min(.alto_seg_cm(o1$doc)), PISO_CM - 0.005)
})

test_that("el piso sube el grosor de escala y deja las categóricas como estaban", {
  cat_antes <- .std_grosor(8, "categorias"); esc_2 <- .std_grosor(2, "escala_apilada")
  op <- options(prosecnur.grosor_piso_cm = 1.30); on.exit(options(op))
  expect_equal(.std_grosor(8, "escala_apilada"), 1.30 / 2.54, tolerance = 1e-9)
  expect_equal(.std_grosor(8, "categorias"), cat_antes)
  options(prosecnur.grosor_piso_cm = 0.5)    # un piso menor que la tabla no adelgaza
  expect_equal(.std_grosor(2, "escala_apilada"), esc_2)
  options(prosecnur.grosor_piso_cm = 0)      # 0 = sin piso
  expect_equal(.std_grosor(8, "escala_apilada"), 0.38)
})

test_that("con piso la partición no usa la tolerancia 1,15: 6 barras que se pasan por poco se parten", {
  e <- .espec_gp(6, largo = TRUE); pr <- .lam_escala_premisas(e)
  alto_6 <- function(p) 1.10 * .lam_escala_alto_util()          # pasa por 10 %: antes se compactaba
  op <- options(prosecnur.grosor_piso_cm = 0); on.exit(options(op))   # 0 = sin piso (el estándar ya trae uno)
  expect_length(.lam_escala_partir(pr, alto_fn = alto_6), 1L)
  options(prosecnur.grosor_piso_cm = PISO_CM)
  expect_gt(length(.lam_escala_partir(pr, alto_fn = alto_6)), 1L)
})

test_that("el slot y el informe llevan grosor_piso_cm; el slot gana y 0 lo apaga", {
  ov <- function(...) p_barras_multiapiladas(modo = "var", vars = c("p1", "p2"), ...)$overrides$grosor_piso_cm
  expect_equal(ov(grosor_piso_cm = 1.12), 1.12)
  expect_null(ov())
  expect_error(p_barras_multiapiladas(modo = "var", vars = c("p1", "p2"), grosor_piso_cm = "no"), "grosor_piso_cm")
  expect_error(p_barras_multiapiladas(modo = "var", vars = c("p1", "p2"), grosor_piso_cm = -1), "grosor_piso_cm")

  pre <- list(base = list(args = list(grosor_piso_cm = 1.12)))
  op <- .casos_junto_fijar(pre); on.exit(options(op), add = TRUE)
  expect_equal(getOption("prosecnur.grosor_piso_cm"), 1.12)
  e <- .espec_gp(6); e$grosor_piso_cm <- 0     # el slot en 0 apaga el piso del informe
  expect_lt(min(.alto_seg_cm(.laminas_gp(e)$doc)), 1.0)
  options(op)
  expect_null(getOption("prosecnur.grosor_piso_cm"))
  expect_warning(.casos_junto_fijar(list(base = list(args = list(grosor_piso_cm = "x")))), "grosor_piso_cm")
})

test_that("el graficador copia grosor_piso_cm a la espec y la metadata lo declara como número", {
  d <- data.frame(categoria = c("A", "B"), N = c(10, 20), pct_1 = c(.1, .2), pct_2 = c(.2, .2), pct_3 = c(.4, .3), pct_4 = c(.3, .3))
  cats <- c(pct_1 = "Totalmente en desacuerdo", pct_2 = "En desacuerdo", pct_3 = "De acuerdo", pct_4 = "Totalmente de acuerdo")
  p <- graficar_barras_apiladas(d, "categoria", var_n = "N", cols_porcentaje = names(cats), etiquetas_grupos = cats,
                                usar_canvas = FALSE, exportar = "rplot", grosor_piso_cm = 1.12)
  expect_equal(attr(p, "pulso_espec")$grosor_piso_cm, 1.12)
  p2 <- graficar_barras_apiladas(d, "categoria", var_n = "N", cols_porcentaje = names(cats), etiquetas_grupos = cats,
                                 usar_canvas = FALSE, exportar = "rplot")
  expect_null(attr(p2, "pulso_espec")$grosor_piso_cm)
  g <- Filter(function(x) identical(x$name, "p_barras_multiapiladas"), .graficos_registry_payload()$graficadores)
  a <- Filter(function(x) identical(x$name, "grosor_piso_cm"), g[[1]]$args)
  expect_length(a, 1L)
  expect_identical(a[[1]]$tipo_input, "number"); expect_gte(a[[1]]$min, 0)
})
