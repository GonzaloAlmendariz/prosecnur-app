# Lámina del recetario alrededor de un ggplot (ADR 0093, N6): la nube de palabras y la serie de tres o más
# mediciones conservan su dibujo, pero el antetítulo, el título, la base y el folio son los nativos de la lámina.

.mc_xml <- function(path, n = 1L) xml2::read_xml(unz(path, sprintf("ppt/slides/slide%d.xml", n)))
.mc_nombres <- function(xml) xml2::xml_attr(xml2::xml_find_all(xml, "//p:cNvPr"), "name")
.mc_txt <- function(xml, n) xml2::xml_text(xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))

test_that("la serie de tres mediciones lleva su lámina del recetario con el gráfico corrido como en la 88", {
  d <- data.frame(eje = rep(c("Docentes", "Estudiantes"), each = 3), grupo = rep(c("2016", "2021", "2026"), 2), valor = c(93, 98, 83, 79, 84, 53))
  p <- graficar_serie_temporal(d)
  e <- attr(p, "pulso_espec")
  expect_identical(e$tipo, "ggplot_marco"); expect_equal(unname(e$zona[["dx"]]), 0.4)
  expect_true(.lam_compositor_aplica(p, list(meta = list())))
  expect_false(.lam_compositor_aplica(p, list(meta = list(motor_nativo = FALSE))))     # el analista puede volver a la ruta anterior
  doc <- officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
  o <- .lam_laminas_ggplot(doc, p, e, "Tutoría en tres procesos", ante = "Serie temporal", base = "Base: docentes y estudiantes", folio = 88)
  out <- tempfile(fileext = ".pptx"); print(o$doc, target = out)
  xml <- .mc_xml(out, length(o$doc))
  expect_identical(.mc_txt(xml, "Titulo lamina"), "Tutoría en tres procesos")
  expect_identical(.mc_txt(xml, "Antetitulo lamina"), "SERIE TEMPORAL")
  expect_match(paste(.mc_txt(xml, "Base lamina"), collapse = " "), "Base: docentes y estudiantes")
  # El dibujo vectorial (rvg) arranca 0.4 in a la derecha del margen y no invade la zona del título.
  g <- xml2::xml_find_all(xml, "//p:grpSp/p:grpSpPr/a:xfrm")
  pos <- function(nodo, at) as.numeric(xml2::xml_attr(xml2::xml_find_first(g, nodo), at)) / 914400
  k <- which.max(pos("./a:ext", "cy"))                                                   # el grupo del dibujo, el más alto
  expect_equal(pos("./a:off", "x")[k], .std_geom("margen_izq") + 0.4, tolerance = 0.01)
  expect_gte(pos("./a:off", "y")[k], .std_geom("zona_datos_y0") - 0.01)
  expect_lte(pos("./a:off", "y")[k] + pos("./a:ext", "cy")[k], .std_geom("contenido_y1") + 0.01)
})

test_that("por la ruta real la nube sale en la lámina del recetario y el título no se repite dentro del dibujo", {
  set.seed(3)
  dat <- data.frame(op = sample(c("Más tutorías y asesoría académica", "Biblioteca abierta los domingos", "Mejor internet en el campus",
                                  "Tutorías con horarios flexibles", "Asesoría académica para tesis"), 60, TRUE), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = "op", type = "text", label = "¿Qué mejorarías?", stringsAsFactors = FALSE),
               choices = data.frame(list_name = character(0), name = character(0), label = character(0)), orders_list = NULL)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = dat, instrumento = inst, mensajes_progreso = FALSE, path_ppt = out,
    plan = list(a = p_slide_1_grafico(grafico = p_nube_palabras(var = "op"), titulo = "Lo que mejorarían")))))
  n <- length(officer::read_pptx(out)); xml <- .mc_xml(out, n)
  expect_identical(.mc_txt(xml, "Titulo lamina"), "Lo que mejorarían")
  todo <- xml2::xml_text(xml2::xml_find_all(xml, "//a:t"))
  expect_equal(sum(todo == "Lo que mejorarían"), 1L)                                     # una sola vez: el título nativo
  expect_true(any(grepl("tutorías|académica", todo)))                                    # las palabras conservan sus tildes
  expect_match(paste(.mc_txt(xml, "Base lamina"), collapse = " "), "El tamaño crece con las menciones")   # la lectura de la 98
})
