# Geometría de la lámina de dependencia (PPT 23 de Arte, v3) y de la leyenda de pesas (PPT 39): solo medidas, ninguna cifra.
# Se verifican las medidas del XML que sale por la ruta real, no las funciones auxiliares.

.fg_fixture <- function() {
  set.seed(11)
  n <- 120
  inter <- sample(c("1", "2"), n, TRUE, prob = c(0.25, 0.75))                      # 1 = Sí participó
  lab <- sample(c("1", "2", "3", "4", "5"), n, TRUE)                               # situación laboral (1–3 trabajan)
  util <- ifelse(inter == "1", sample(c("1", "2", "3", "4"), n, TRUE), NA)        # sólo quienes participaron
  rel <- ifelse(lab %in% c("1", "2", "3"), sample(c("1", "2", "3"), n, TRUE), NA)  # sólo quienes trabajan
  df <- data.frame(inter = inter, util = util, lab = lab, rel = rel, stringsAsFactors = FALSE)
  survey <- data.frame(name = c("inter", "util", "lab", "rel"),
                       type = c("select_one sino", "select_one acuerdo", "select_one lab", "select_one rel"),
                       list_name = c("sino", "acuerdo", "lab", "rel"),
                       label = c("¿Ha participado en programas de intercambio?", "Los intercambios fortalecen mis competencias",
                                 "¿Cuál es su situación laboral actual?", "¿Qué tan relacionado está su trabajo con la carrera?"),
                       stringsAsFactors = FALSE)
  choices <- data.frame(
    list_name = c("sino", "sino", rep("acuerdo", 4), rep("lab", 5), rep("rel", 3)),
    name = c("1", "2", "1", "2", "3", "4", "1", "2", "3", "4", "5", "1", "2", "3"),
    label = c("Sí", "No", "Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo",
              "Dependiente", "Independiente", "Dependiente e independiente", "Busca empleo", "No trabaja ni busca",
              "Muy relacionado", "Relacionado", "Poco relacionado"),
    stringsAsFactors = FALSE)
  inst <- list(survey = survey, choices = choices, orders_list = NULL)
  inst$orders_list <- .amb_orders_list(inst)   # como lo arma la sesión: las etiquetas salen del orden del instrumento
  list(df = df, inst = inst)
}

.fg_formas <- function(grafico, base = NULL) {
  fx <- .fg_fixture(); out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = fx$df, instrumento = fx$inst, path_ppt = out, mensajes_progreso = FALSE,
    plan = list(a = p_slide_1_grafico(grafico, titulo = "x", base = base)))))
  xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
}
.fg_ext <- function(xml, n) {
  sp <- xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]/p:spPr/a:xfrm", n))
  data.frame(x = as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "./a:off"), "x")) / 914400,
             y = as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "./a:off"), "y")) / 914400,
             w = as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "./a:ext"), "cx")) / 914400,
             h = as.numeric(xml2::xml_attr(xml2::xml_find_first(sp, "./a:ext"), "cy")) / 914400)
}
.fg_span <- function(e) c(x0 = min(e$x), x1 = max(e$x + e$w))

.fg_dependencia <- function(...) {
  .fg_formas(p_filtro_subpregunta("inter", habilita = "Sí", subpregunta = "util", grafico_sub = "escala", disposicion = "abajo",
                                  overrides = list(barra_extra_preset = "top2box", top2box_labels = c("De acuerdo", "Totalmente de acuerdo")), ...))
}

test_that("PPT 23: las dos barras de la dependencia miden y arrancan igual, en la columna de texto de la lámina", {
  skip_if_not_installed("officer")
  for (rot in list(NULL, "Participaron")) {
    xml <- if (is.null(rot)) .fg_dependencia() else .fg_dependencia(rotulo = rot)
    arriba <- .fg_span(.fg_ext(xml, "dicotomia:segmento"))
    abajo <- .fg_span(.fg_ext(xml, "segmento"))
    expect_lt(abs(arriba[["x0"]] - abajo[["x0"]]), 0.02)
    expect_lt(abs(arriba[["x1"]] - abajo[["x1"]]), 0.02)
    # Sin rótulo, arranca donde arranca el texto de las demás láminas (margen izquierdo + inset de 0,1 in), no en el borde.
    if (is.null(rot)) expect_gte(abajo[["x0"]], .std_geom("margen_izq") + 0.1 - 0.02)
  }
})

test_that("PPT 23: la leyenda de la escala dependiente se centra en la lámina, no en su barra", {
  skip_if_not_installed("officer")
  xml <- .fg_dependencia()
  txt <- .fg_ext(xml, "leyenda:texto"); cua <- .fg_ext(xml, "leyenda:cuadro")
  expect_gt(nrow(cua), 1L)
  # Bloque de la leyenda: del primer cuadro a la tinta del último texto (el texto mide su caja menos el margen que se le añade).
  ult <- which.max(txt$x)
  fin <- txt$x[ult] + 0.12 + .lam_ancho_tinta(xml2::xml_text(xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='leyenda:texto']]"))[ult],
                                              .std_pt("leyenda"))
  centro <- (min(cua$x) + fin) / 2
  expect_lt(abs(centro - .std_geom("ancho") / 2), 0.02)
})

test_that("PPT 23: la base de la subpregunta se dice una vez, «Sólo los N que...», sin «La subpregunta,»", {
  skip_if_not_installed("officer")
  xml <- .fg_dependencia(frase = "que conocen el reglamento")
  pie <- xml2::xml_text(xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='Base lamina']]"))
  expect_false(grepl("La subpregunta", pie, fixed = TRUE))
  expect_match(pie, "Sólo los [0-9]+ que conocen el reglamento")
})

test_that("PPT 39: la leyenda de pesas va centrada a la lámina, al tamaño estándar y sin tocar el título", {
  skip_if_not_installed("officer")
  d <- data.frame(eje = rep(c("A", "B"), 2), grupo = factor(rep(c("Docentes", "Estudiantes"), each = 2), levels = c("Docentes", "Estudiantes")),
                  valor = c(92, 96, 94, 91), n = rep(c(51, 109), each = 2))
  e <- attr(graficar_dumbbell(d), "pulso_espec")
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  out <- tempfile(fileext = ".pptx"); print(.lam_laminas_pesas(doc, e, "Competencias de salida", ante = "Comparaciones", folio = 39)$doc, target = out)
  xml <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  txt <- .fg_ext(xml, "leyenda:texto"); cua <- .fg_ext(xml, "leyenda:cuadro")
  expect_equal(nrow(txt), 2L)
  # Tamaño: el de las leyendas de las demás láminas.
  sz <- as.numeric(xml2::xml_attr(xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='leyenda:texto']]//a:rPr"), "sz")) / 100
  expect_true(all(sz == .std_pt("leyenda")))
  # Centro del bloque = centro de la lámina; altura estándar; bajo el título.
  nombres <- xml2::xml_text(xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='leyenda:texto']]"))
  ult <- which.max(txt$x)
  fin <- txt$x[ult] + 0.12 + .lam_ancho_tinta(nombres[ult], .std_pt("leyenda"))
  expect_lt(abs((min(cua$x) + fin) / 2 - .std_geom("ancho") / 2), 0.02)
  expect_lt(abs(min(txt$y) - (.std_geom("leyenda_y") - 0.05)), 0.02)
  tit <- .fg_ext(xml, "Titulo lamina")
  expect_gt(min(txt$y), tit$y + tit$h - 1e-6)
  # Y ya no sube al antetítulo.
  ante <- xml2::xml_text(xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='Antetitulo lamina']]"))
  expect_false(any(grepl("DOCENTES", ante)))
})
