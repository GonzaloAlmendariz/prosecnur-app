source("setup-load-all.R")

# Estilo `barra_estandar` de la dicotómica (Renzo, informe Arte, 2026-10-22): una barra normal con el % dentro, en blanco,
# tamaño estándar y leyenda, en vez de la barra partida con cifras de 22/40 pt encima. El defecto sigue siendo la partida.

.be_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.be_xml <- function(doc) {
  out <- tempfile(fileext = ".pptx"); print(doc, target = out)
  xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc))))
}
.be_xml_k <- function(out) xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
.be_sp <- function(xml, nombre) xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre))
.be_sz <- function(sp) as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, ".//a:rPr"), "sz")) / 100
.be_col <- function(sp) toupper(xml2::xml_attr(xml2::xml_find_first(sp, ".//a:rPr//a:srgbClr"), "val"))
.be_rect <- function(sp) {
  off <- xml2::xml_find_first(sp, "./p:spPr/a:xfrm/a:off"); ext <- xml2::xml_find_first(sp, "./p:spPr/a:xfrm/a:ext")
  data.frame(x = as.numeric(xml2::xml_attr(off, "x")), y = as.numeric(xml2::xml_attr(off, "y")),
             w = as.numeric(xml2::xml_attr(ext, "cx")), h = as.numeric(xml2::xml_attr(ext, "cy")))
}
.be_inst <- function() {
  list(survey = data.frame(name = "qsn", type = "select_one sn", list_name = "sn", label = "Pregunta qsn", stringsAsFactors = FALSE),
       choices = data.frame(list_name = "sn", name = c("Sí", "No"), label = c("Sí", "No"), stringsAsFactors = FALSE), orders_list = NULL)
}
.be_espec <- function(estilo = NULL) {
  e <- preparar_categorica(c("Sí", "No"), c(.55, .45), c("55%", "45%"))
  e$colores <- c(`Sí` = "#081F5C", No = "#CA5651")
  e$estilo_dicotomia <- estilo
  e
}
# Lo que hace barra_estandar sobre cualquier lienzo: sin cifra grande, valor blanco dentro de su segmento, leyenda.
.be_verificar_estandar <- function(xml, colores = c("FFFFFF", "FFFFFF")) {
  expect_length(.be_sp(xml, "dicotomia:cifra"), 0L)
  val <- .be_sp(xml, "barra:cifra"); seg <- .be_sp(xml, "barra:segmento")
  expect_length(val, 2L); expect_length(seg, 2L)
  expect_true(all(.be_sz(val) < 24))
  expect_identical(.be_col(val), colores)
  r_v <- .be_rect(val); r_s <- .be_rect(seg)
  expect_true(all(r_v$x >= r_s$x - 1) && all(r_v$x + r_v$w <= r_s$x + r_s$w + 1))   # dentro de su segmento
  expect_true(all(r_v$y >= r_s$y - 1) && all(r_v$y + r_v$h <= r_s$y + r_s$h + 1))
  expect_length(.be_sp(xml, "leyenda:texto"), 2L)
}

test_that("lámina completa: barra_estandar no escribe cifra grande, pone el % blanco dentro del segmento y la leyenda", {
  o <- .lam_laminas_dicotomia(.be_doc(), .be_espec("barra_estandar"), "Trabaja")
  .be_verificar_estandar(.be_xml(o$doc))
})

test_that("panel mixto: barra_estandar dibuja lo mismo dentro del panel", {
  e <- list(preparar_categorica(c("A", "B", "C"), c(.5, .3, .2), c("50%", "30%", "20%")), preparar_categorica(c("A", "B", "C", "D"), c(.4, .3, .2, .1), paste0(c(40, 30, 20, 10), "%")),
            preparar_categorica(c("x", "y", "z"), c(.5, .3, .2), c("50%", "30%", "20%")), .be_espec("barra_estandar"))
  o <- .lam_laminas_mixta(.be_doc(), e, "paneles_4", preguntas = list("P1", "P2", "P3", "¿Trabaja?"), titulo = "Perfil", base = "Base: 52", folio = 1)
  xml <- .be_xml(o$doc)
  expect_length(.be_sp(xml, "dicotomia:cifra"), 0L)
  expect_length(.be_sp(xml, "barra:cifra"), 2L)
  expect_identical(.be_col(.be_sp(xml, "barra:cifra")), c("FFFFFF", "FFFFFF"))
  expect_true(all(.be_sz(.be_sp(xml, "barra:cifra")) < 24))
})

test_that("el informe lo elige con presets$base$args$estilo_dicotomia y el slot gana al informe", {
  expect_identical(.lam_estilo_dicotomia(.be_espec()), "partida")
  withr::local_options(prosecnur.estilo_dicotomia = "barra_estandar")
  expect_identical(.lam_estilo_dicotomia(.be_espec()), "barra_estandar")
  expect_identical(.lam_estilo_dicotomia(.be_espec("partida")), "partida")        # el slot manda
  expect_identical(.lam_estilo_dicotomia(.be_espec("raro")), "barra_estandar")     # lo desconocido no apaga el del informe
  withr::local_options(prosecnur.estilo_dicotomia = NULL)
  viejo <- .estilo_dicotomia_fijar(list(base = list(args = list(estilo_dicotomia = "barra_estandar"))))
  expect_identical(getOption("prosecnur.estilo_dicotomia"), "barra_estandar")
  options(viejo); expect_null(getOption("prosecnur.estilo_dicotomia"))
  expect_length(.estilo_dicotomia_fijar(list()), 0L)                                # sin declaración no toca nada
  expect_identical(p_dicotomica("trabaja", estilo = "barra_estandar")$overrides$estilo_dicotomia, "barra_estandar")
  expect_error(p_dicotomica("trabaja", estilo = "otra"), "barra_estandar")
})

test_that("de punta a punta: el informe (presets) y el slot cambian la lámina; sin ellos sale la partida de siempre", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  dat <- data.frame(qsn = rep(c("Sí", "No"), c(110, 90)), stringsAsFactors = FALSE)
  inst <- .be_inst()
  render <- function(grafico, presets = NULL) {
    out <- tempfile(fileext = ".pptx")
    suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, plan = list(a = p_slide_1_grafico(grafico = grafico, titulo = "Trabajo")),
                                                       presets = presets, path_ppt = out, mensajes_progreso = FALSE)))
    .be_xml_k(out)
  }
  base <- render(p_barras_agrupadas("qsn", overrides = list(orden_barras = "instrumento", invertir_barras = TRUE)))
  expect_length(.be_sp(base, "dicotomia:cifra"), 2L)                                # regresión: el defecto no cambia
  expect_gte(max(.be_sz(.be_sp(base, "dicotomia:cifra"))), 24)
  expect_length(.be_sp(base, "barra:cifra"), 0L)
  slot <- render(p_dicotomica("qsn", estilo = "barra_estandar"))
  .be_verificar_estandar(slot, c("FFFFFF", "081F5C"))   # paleta de la casa: el celeste lleva el azul (contraste), no blanco
  informe <- render(p_barras_agrupadas("qsn", overrides = list(orden_barras = "instrumento", invertir_barras = TRUE)),
                    presets = list(base = list(args = list(estilo_dicotomia = "barra_estandar"))))
  .be_verificar_estandar(informe, c("FFFFFF", "081F5C"))
  gana <- render(p_dicotomica("qsn", estilo = "partida"), presets = list(base = list(args = list(estilo_dicotomia = "barra_estandar"))))
  expect_length(.be_sp(gana, "dicotomia:cifra"), 2L)                                # el slot gana al informe
})

test_that("Word: barra_estandar deja las cifras dentro de los límites de la barra, blancas y más chicas; el defecto no cambia", {
  datos <- function(g) { b <- suppressWarnings(ggplot2::ggplot_build(g)); b$data[vapply(b$data, function(l) "label" %in% names(l), TRUE)] }
  e0 <- .be_espec()
  g0 <- .word_g_sino_partida(e0)                                                     # N5: .word_g_sino ya no la dibuja; la pieza partida queda sólo por nombre
  t0 <- do.call(rbind, lapply(datos(g0), function(l) l[, c("x", "y", "label", "size")]))
  expect_true(any(t0$y > 1))                                                         # la partida sigue con cifras encima de la barra
  e <- .be_espec("barra_estandar")
  g <- .word_grafico(structure(ggplot2::ggplot(), pulso_espec = e))
  rect <- suppressWarnings(ggplot2::ggplot_build(g))$data[[1]]
  tx <- do.call(rbind, lapply(datos(g), function(l) l[, intersect(c("x", "y", "label", "size", "colour"), names(l))]))
  v <- tx[tx$label %in% c("55%", "45%"), ]
  expect_equal(nrow(v), 2L)
  v <- v[match(c("55%", "45%"), v$label), ]; rect <- rect[order(rect$xmin), ]
  expect_true(all(v$y > rect$ymin & v$y < rect$ymax))                                # dentro de la barra en vertical
  expect_true(all(v$x > rect$xmin & v$x < rect$xmax))                                # y en su segmento
  expect_true(all(toupper(v$colour) == "#FFFFFF"))
  expect_lt(max(v$size), max(t0$size))
  expect_false(any(c("Sí", "No") %in% tx$label))                                     # sin rótulos de público sueltos: van en la leyenda
})

test_that("panel mixto: la barra estándar y su leyenda quedan centradas en el panel, con márgenes laterales simétricos", {
  emu <- 914400
  rot <- c("Departamento Académico", "Facultad")
  mk <- function() { e <- preparar_categorica(rot, c(.18, .82), c("18%", "82%")); e$colores <- c(`Departamento Académico` = "#081F5C", Facultad = "#CA5651"); e$estilo_dicotomia <- "barra_estandar"; e$dicotomica_declarada <- TRUE; e }   # N20: un par que no es Sí/No es dicotomía solo si el analista la declara
  gen <- function(i) {   # la dicotomía en la ranura i del panel de 4
    e <- list(preparar_categorica(c("A", "B", "C"), c(.5, .3, .2), c("50%", "30%", "20%")), preparar_categorica(c("A", "B", "C", "D"), c(.4, .3, .2, .1), paste0(c(40, 30, 20, 10), "%")),
              preparar_categorica(c("x", "y", "z"), c(.5, .3, .2), c("50%", "30%", "20%")), preparar_categorica(c("x", "y", "z"), c(.5, .3, .2), c("50%", "30%", "20%")))
    e[[i]] <- mk()
    o <- .lam_laminas_mixta(.be_doc(), e, "paneles_4", preguntas = list("P1", "P2", "P3", "Pertenece a:"), titulo = "Perfil", base = "Base: 52", folio = 1)
    .be_xml(o$doc)
  }
  P <- .lam_mixta_geo("paneles_4")$paneles
  for (i in c(1L, 4L)) {
    xml <- gen(i); p <- P[[i]]
    seg <- .be_rect(.be_sp(xml, "barra:segmento")) / emu
    izq <- min(seg$x); der <- max(seg$x + seg$w)
    centro_panel <- p$x + p$w / 2
    expect_equal((izq + der) / 2, centro_panel, tolerance = 0.02)
    expect_equal(izq - p$x, p$x + p$w - der, tolerance = 0.02)             # márgenes laterales simétricos
    expect_gt(izq - p$x, 0.2)                                              # y con aire: no de borde a borde
    cua <- .be_rect(.be_sp(xml, "leyenda:cuadro")) / emu
    total <- attr(.lam_leyenda_filas(rot, p$w), "plan")$totales[1]
    expect_equal(min(cua$x) + total / 2, (izq + der) / 2, tolerance = 0.02)  # la leyenda comparte el eje de la barra
  }
})

test_that("N20: en el PPT una nominal de 2 categorías (género) sale como barras, no como la pieza dicotomía; el Sí/No no cambia", {
  inst <- list(survey = data.frame(name = c("sexo", "qsn"), type = c("select_one sx", "select_one sn"), list_name = c("sx", "sn"),
                                   label = c("Sexo", "Pregunta qsn"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = c("sx", "sx", "sn", "sn"), name = c("Masculino", "Femenino", "Sí", "No"),
                                    label = c("Masculino", "Femenino", "Sí", "No"), stringsAsFactors = FALSE), orders_list = NULL)
  dat <- data.frame(sexo = rep(c("Masculino", "Femenino"), c(120, 80)), qsn = rep(c("Sí", "No"), c(110, 90)), stringsAsFactors = FALSE)
  render <- function(grafico) {
    out <- tempfile(fileext = ".pptx")
    suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, plan = list(a = p_slide_1_grafico(grafico = grafico, titulo = "Trabajo")),
                                                       path_ppt = out, mensajes_progreso = FALSE)))
    .be_xml_k(out)
  }
  ov <- list(orden_barras = "instrumento", invertir_barras = TRUE)
  expect_length(.be_sp(render(p_barras_agrupadas("sexo", overrides = ov)), "dicotomia:cifra"), 0L)
  sn <- render(p_barras_agrupadas("qsn", overrides = ov))
  expect_length(.be_sp(sn, "dicotomia:cifra"), 2L)
  expect_gte(max(.be_sz(.be_sp(sn, "dicotomia:cifra"))), 24)
  expect_length(.be_sp(render(p_dicotomica("sexo")), "dicotomia:cifra"), 2L)   # declarada: sí es dicotomía
})
