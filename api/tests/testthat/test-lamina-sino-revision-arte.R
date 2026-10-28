source("setup-load-all.R")

# Revisión de Gabriela Palacios al informe de Arte (2026-10-28, docs/qa/checklist-revision-gabriela-arte-2026-10-28.md):
# G8 (cifra de la Sí/No a 14 pt y en blanco), G15/G16 (dicotomía partida sin corchete y «N = 77» encima de la barra),
# G17 (la Sí/No junto a una escala mide lo que ella) y G1 (rótulo de la portada de plantilla a 20 pt).

.ra_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.ra_xml <- function(doc) {
  out <- tempfile(fileext = ".pptx"); print(doc, target = out)
  xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc))))
}
.ra_sp <- function(xml, nombre) xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
.ra_rpr <- function(sp, at) xml2::xml_attr(xml2::xml_find_first(sp, ".//a:rPr"), at)
.ra_col <- function(sp) toupper(xml2::xml_attr(xml2::xml_find_first(sp, ".//a:rPr//a:srgbClr"), "val"))
.ra_sino <- function(si = 0.81) {
  d <- data.frame(item = "q01", N = 279, t1 = si, t2 = 1 - si, rotulo = "¿Conocía los requisitos de admisión?")
  preparar_escala(d, "item", "N", c("t1", "t2"), c(t1 = "Sí", t2 = "No"), var_etiqueta_categoria = "rotulo",
                  colores_grupos = list(Sí = "#081F5C", No = "#9DC3E6"))
}

test_that("G8: la barra_estandar lleva la cifra en blanco en los dos segmentos, también sobre el celeste, y a 14 pt en el panel", {
  e <- preparar_categorica(c("Sí", "No"), c(.62, .38), c("62%", "38%"))
  e$colores <- c(`Sí` = "#081F5C", No = "#9DC3E6"); e$estilo_dicotomia <- "barra_estandar"
  xml <- .ra_xml(.lam_laminas_dicotomia(.ra_doc(), e, "Trabaja")$doc)
  cif <- .ra_sp(xml, "barra:cifra")
  expect_identical(.ra_col(cif), c("FFFFFF", "FFFFFF"))
  expect_equal(as.numeric(.ra_rpr(cif, "sz")) / 100, rep(.std_pt("cifra"), 2))
  otros <- list(preparar_categorica(c("A", "B", "C"), c(.5, .3, .2), c("50%", "30%", "20%")),
                preparar_categorica(c("A", "B", "C"), c(.5, .3, .2), c("50%", "30%", "20%")),
                preparar_categorica(c("x", "y", "z"), c(.5, .3, .2), c("50%", "30%", "20%")), e)
  o <- .lam_laminas_mixta(.ra_doc(), otros, "paneles_4", preguntas = list("P1", "P2", "P3", "¿Trabaja?"), titulo = "Perfil", base = "Base: 52", folio = 1)
  cif <- .ra_sp(.ra_xml(o$doc), "barra:cifra")
  expect_equal(as.numeric(.ra_rpr(cif, "sz")) / 100, rep(.std_pt("cifra"), 2))   # antes 12 en el panel: no encoge, sube
  expect_identical(.ra_col(cif), c("FFFFFF", "FFFFFF"))
})

test_that("G8: la Sí/No como escala marca en blanco sus dos opciones propias, nunca la especial ni otra escala", {
  e <- .ra_sino()
  expect_identical(.lam_escala_sino_blanca(e), c(TRUE, TRUE))
  seg <- .lam_escala_seg(e, 1L); seg$blanca <- .lam_escala_sino_blanca(e)
  expect_identical(vapply(1:2, function(k) .lam_cifra_color_seg(seg, k), ""), c("#FFFFFF", "#FFFFFF"))
  d <- data.frame(item = "q", N = 10, t1 = .2, t2 = .3, t3 = .5, rotulo = "x")
  acuerdo <- preparar_escala(d, "item", "N", c("t1", "t2", "t3"), c(t1 = "Poco", t2 = "Algo", t3 = "Mucho"), var_etiqueta_categoria = "rotulo")
  expect_false(any(.lam_escala_sino_blanca(acuerdo)))
  seg2 <- .lam_escala_seg(acuerdo, 1L)   # sin la columna `blanca`: el contraste de siempre
  expect_identical(.lam_cifra_color_seg(seg2, 3L), .lam_texto_sobre(seg2$color[3]))
})

test_that("G17: con una escala con Top Two Box en la lámina, la Sí/No se marca para medir como ella; sola, no", {
  sino <- list(espec = .ra_sino())
  escala <- list(espec = list(tipo = "escala", box = list(unidades = c("t3", "t4"))))
  r <- .lam_multilista_igualar_ancho(list(escala, sino))
  expect_true(isTRUE(r[[2]]$espec$ancho_como_escala))
  expect_null(r[[1]]$espec$ancho_como_escala)
  expect_null(.lam_multilista_igualar_ancho(list(sino))[[1]]$espec$ancho_como_escala)
  expect_null(.lam_multilista_igualar_ancho(list(sino, sino))[[2]]$espec$ancho_como_escala)
})

test_that("G1: la portada de plantilla pone «Informe consolidado» a 20 pt", {
  expect_identical(.lam_portada_rotulo_plantilla_pt(), 20)
})

test_that("G16: «N = 77» en cursiva, alineado al extremo derecho de la barra y encima; sube si una cifra chica ocupa su lugar", {
  expect_identical(.lam_filtro_sub_n_texto(list(n_sub = 77)), "N = 77")
  expect_identical(.lam_filtro_sub_n_texto(list(n_sub = 1234)), "N = 1,234")
  expect_null(.lam_filtro_sub_n_texto(list(n_sub = NA)))
  lz <- .lam_lienzo()
  .lam_n_encima_barra(lz, "N = 77", x_der = 10, yb = 4)
  b <- lz$cajas[[1]]
  expect_equal(b[3] - 0.1, 10)                       # la tinta (sin su margen interno) acaba en el borde derecho de la barra
  expect_lte(b[4], 4 + 0.02 + 1e-9)                  # no baja a la barra
  expect_match(lz$formas[[1]], ' i="1" ', fixed = TRUE)
  expect_match(lz$formas[[1]], 'name="filtro_sub:n"', fixed = TRUE)
  lz2 <- .lam_lienzo()
  .lam_registrar(lz2, "<p:sp/>", 9.5, 3.72, 0.64, 0.22)   # una cifra chica sobre el último segmento
  .lam_n_encima_barra(lz2, "N = 77", x_der = 10, yb = 4, desde = 0L)
  expect_lte(lz2$cajas[[2]][4], 3.72 + 1e-9)
})

test_that("G15/G16 de punta a punta: la dicotomía partida con escala debajo sale sin llave y con «N = n» sobre la barra dependiente", {
  skip_if_not_installed("officer")
  set.seed(11); n <- 120
  inter <- sample(c("1", "2"), n, TRUE, prob = c(0.6, 0.4)); util <- ifelse(inter == "1", sample(c("1", "2", "3", "4"), n, TRUE), NA)
  inst <- list(survey = data.frame(name = c("inter", "util"), type = c("select_one sino", "select_one acuerdo"), list_name = c("sino", "acuerdo"),
                                   label = c("¿Conoce el reglamento?", "El reglamento es pertinente"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = c("sino", "sino", rep("acuerdo", 4)), name = c("1", "2", "1", "2", "3", "4"),
                                    label = c("Sí", "No", "Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo"),
                                    stringsAsFactors = FALSE), orders_list = NULL)
  inst$orders_list <- .amb_orders_list(inst)
  fx <- list(df = data.frame(inter = inter, util = util, stringsAsFactors = FALSE), inst = inst); out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = fx$df, instrumento = fx$inst, path_ppt = out, mensajes_progreso = FALSE,
    plan = list(a = p_slide_1_grafico(p_filtro_subpregunta("inter", habilita = "Sí", subpregunta = "util", grafico_sub = "escala",
                                                           disposicion = "abajo"), titulo = "Filtro y subpregunta")))))
  x <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  nombres <- xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name")
  expect_false("llave" %in% nombres)
  n <- .ra_sp(x, "filtro_sub:n"); n_si <- sum(fx$df$inter == "1")
  expect_length(n, 1L)
  expect_identical(xml2::xml_text(n), sprintf("N = %d", n_si))
  expect_identical(.ra_rpr(n, "i"), "1")
  at <- function(sp, nodo, a) vapply(a, function(k) as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, paste0("./p:spPr/a:xfrm/a:", nodo)), k)), 0) / 914400
  off <- function(sp) unname(at(sp, "off", c("x", "y"))); ext <- function(sp) unname(at(sp, "ext", c("cx", "cy")))
  seg <- .ra_sp(x, "segmento"); ys <- vapply(seq_along(seg), function(i) off(seg[[i]])[2], 0)
  dep <- which(abs(ys - max(ys)) < 1e-6)   # la barra dependiente (la de más abajo)
  fin <- max(vapply(dep, function(i) off(seg[[i]])[1] + ext(seg[[i]])[1], 0)); top <- max(ys)
  expect_equal(off(n)[1] + ext(n)[1] - 0.1, fin, tolerance = 0.01)          # extremo derecho de la barra dependiente
  expect_lte(off(n)[2] + ext(n)[2], top + 0.03)                              # encima de ella
})
