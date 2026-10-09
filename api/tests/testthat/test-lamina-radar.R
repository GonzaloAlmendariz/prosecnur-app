# Radar con tabla (lámina 90 del recetario, ADR 0093, N6): el radar sigue en ggplot, con la geometría del recetario,
# y la lámina, la leyenda y la tabla de PowerPoint son nativas.

.rd_comp <- c("Estados financieros", "Auditoría", "Costos y presupuestos", "Finanzas", "Tributación", "Visión empresarial")
.rd_datos <- function() {
  v <- list(Docentes = c(98, 96, 92, 96, 94, 92), Estudiantes = c(96, 91, 94, 95, 96, 94), Egresados = c(98, 98, 94, 93, 98, 95))
  do.call(rbind, lapply(names(v), function(g) data.frame(eje = .rd_comp, grupo = g, valor = v[[g]])))
}
.rd_espec <- function(d = .rd_datos(), ...) {
  attr(suppressWarnings(graficar_radar(d, escala_valor = "proporcion_100", usar_canvas = TRUE, mostrar_tabla_derecha = TRUE, ...)), "pulso_espec")
}
.rd_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.rd_xml <- function(doc) { out <- tempfile(fileext = ".pptx"); print(doc, target = out); xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(doc)))) }

test_that("la espec del radar trae ejes, series, piso, anillos y las cifras de la tabla con el redondeo de la casa", {
  d <- .rd_datos(); d$valor[d$eje == "Finanzas" & d$grupo == "Egresados"] <- 92.5
  e <- .rd_espec(d, titulo_tabla = "Competencia")
  expect_identical(e$tipo, "radar"); expect_identical(e$ejes, .rd_comp); expect_identical(e$grupos, c("Docentes", "Estudiantes", "Egresados"))
  expect_equal(e$lo, 80); expect_equal(e$anillos, c(85, 90, 95, 100))          # como la 90: decena bajo el mínimo menos 3
  expect_identical(e$cifras["Finanzas", "Egresados"], "93%")                     # el 0.5 sube
  expect_identical(e$encabezado, "Competencia"); expect_true(e$con_tabla)
  expect_identical(.rd_espec()$encabezado, "Indicador")                          # el «Top 2 Box» de fábrica no nombra la columna
  expect_false(attr(suppressWarnings(graficar_radar(.rd_datos(), escala_valor = "proporcion_100")), "pulso_espec")$con_tabla)
})

test_that("la lámina 90 lleva el radar a la izquierda, la leyenda centrada bajo él y la tabla nativa con sus cifras", {
  e <- .rd_espec(titulo_tabla = "Competencia")
  expect_true(.lam_radar_cabe(e))
  o <- .lam_laminas_radar(.rd_doc(), e, "Formulación del perfil de egreso", ante = "Radar con tabla", folio = 90, base = "Base: 51 docentes")
  xml <- .rd_xml(o$doc)
  tbl <- xml2::xml_find_all(xml, "//a:tbl")
  expect_length(tbl, 1L)
  celdas <- xml2::xml_text(xml2::xml_find_all(tbl, ".//a:tc"))
  expect_identical(celdas[1:4], c("Competencia", "Docentes", "Estudiantes", "Egresados"))
  expect_identical(celdas[5:8], c("Estados financieros", "98%", "96%", "98%"))
  off <- xml2::xml_find_first(xml, "//p:graphicFrame[.//a:tbl]/p:xfrm/a:off")
  expect_equal(as.numeric(xml2::xml_attr(off, "x")) / 914400, 7.25, tolerance = 0.01)
  ley <- xml2::xml_text(xml2::xml_find_all(xml, "//p:sp[p:nvSpPr/p:cNvPr[@name='leyenda:texto']]"))
  expect_identical(ley, c("Docentes", "Estudiantes", "Egresados"))
  # Los ejes van en el sentido del reloj desde arriba: el segundo (Auditoría) queda a la derecha del primero.
  gg <- ggplot2::ggplot_build(.lam_radar_gg(e))
  txt <- gg$data[[4]]
  expect_gt(txt$x[txt$label == "Auditoría"], txt$x[txt$label == "Estados financieros"])
  expect_lt(txt$x[txt$label == "Visión empresarial"], 0)
})

test_that("lo que no cabe en la lámina del recetario sigue por la ruta anterior", {
  e <- .rd_espec()
  e9 <- e; e9$ejes <- paste("Eje", 1:9); expect_false(.lam_radar_cabe(e9))
  e4 <- e; e4$grupos <- c(e$grupos, "Autoridades"); expect_false(.lam_radar_cabe(e4))     # cuatro columnas no caben a la derecha
  e4$con_tabla <- FALSE; expect_true(.lam_radar_cabe(e4))                                 # sin tabla, sí
  el <- e; el$ejes[3] <- "Costos, presupuestos y control de gestión financiera"; expect_false(.lam_radar_cabe(el))
  expect_false(.lam_compositor_aplica(structure(list(), pulso_espec = e), list(meta = list(motor_nativo = FALSE))))
})

test_that("por la ruta real p_radar_tabla sale en la lámina 90 y p_radar, sin tabla, centrado", {
  set.seed(3)
  df <- data.frame(medio = sample(c("web", "radio", "tv", "redes"), 80, TRUE), tipo = sample(c("Docente", "Estudiante"), 80, TRUE),
                   stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = c("medio", "tipo"), type = c("select_one lst_m", "select_one lst_t"),
                                   list_name = c("lst_m", "lst_t"), label = c("Medio", "Tipo"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = c(rep("lst_m", 4), rep("lst_t", 2)), name = c("web", "radio", "tv", "redes", "Docente", "Estudiante"),
                                    label = c("Página web", "Radio", "Televisión", "Redes sociales", "Docente", "Estudiante"), stringsAsFactors = FALSE),
               orders_list = NULL)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = df, instrumento = inst, path_ppt = out, mensajes_progreso = FALSE,
    plan = list(a = p_slide_1_grafico(p_radar_tabla(modo = "sm", var = "medio", cruce = "tipo",   # la UI lo trae del preset (graficos_metadata.R)
                                                    overrides = list(mostrar_tabla_derecha = TRUE)), titulo = "Medios"),
                b = p_slide_1_grafico(p_radar(modo = "sm", var = "medio", cruce = "tipo"), titulo = "Medios sin tabla"),
                c = p_slide_1_grafico(p_tabla(modo = "sm", var = "medio", cruce = "tipo"), titulo = "Sólo la tabla")))))
  n <- length(officer::read_pptx(out))
  lam <- lapply(seq_len(n), function(k) xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k))))
  titulo <- vapply(lam, function(x) paste(xml2::xml_text(xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='Titulo lamina']]")), collapse = ""), "")
  es_radar <- vapply(lam, function(x) "prosecnur:grafico:radar" %in% xml2::xml_attr(xml2::xml_find_all(x, "//p:cNvPr"), "name"), TRUE)
  a <- which(titulo == "Medios"); b <- which(titulo == "Medios sin tabla")
  expect_length(a, 1L); expect_length(b, 1L)
  expect_true(es_radar[a]); expect_length(xml2::xml_find_all(lam[[a]], "//a:tbl"), 1L)
  expect_true(es_radar[b]); expect_length(xml2::xml_find_all(lam[[b]], "//a:tbl"), 0L)
  expect_equal(sum(es_radar), 2L)                                                        # p_tabla no estrena un radar escondido
})

test_that("el radar de públicos con tabla avisa a la lámina que lleva tabla, con el encabezado del analista", {
  fuente <- function(v) list(data = data.frame(id = seq_along(v), p1 = v, stringsAsFactors = FALSE),
                             inst = list(survey = data.frame(type = c("integer", "select_one lst"), name = c("id", "p1"), label = c("id", "X")),
                                         choices = data.frame(list_name = "lst", name = as.character(1:4), label = c("Muy mal", "Mal", "Bien", "Muy bien"))))
  partes <- list(docentes = fuente(c("3", "4", "4", "1")), estudiantes = fuente(c("3", "1", "2", "4")))
  data_sources <- lapply(partes, `[[`, "data"); instrument_sources <- lapply(partes, `[[`, "inst")
  el <- p_radar(modo = "publicos", vars = list(A = list("docentes$p1", "estudiantes$p1"), B = list("docentes$p1", "estudiantes$p1"),
                                               C = list("docentes$p1", "estudiantes$p1")), corte = "3,4", mostrar_tabla = TRUE, tabla_titulo = "Tema")
  g <- suppressWarnings(suppressMessages(.render_radar_publicos(el)))
  e <- attr(g, "pulso_espec")
  expect_identical(e$tipo, "radar"); expect_true(e$con_tabla); expect_identical(e$encabezado, "Tema")
})

test_that("una serie entera en el piso se dibuja sin tumbar R y la serie única «Total» deja su marca sin leyenda", {
  d <- .rd_datos(); d$valor[d$grupo == "Egresados"] <- 0                        # un grupo sin respuestas
  e <- .rd_espec(d)
  gg <- .lam_radar_gg(e)
  expect_false(any(vapply(gg$layers, function(l) inherits(l$geom, "GeomPolygon"), TRUE)))    # sin polígonos degenerados
  o <- .lam_laminas_radar(.rd_doc(), e, "Con un grupo vacío", folio = 1)
  xml <- .rd_xml(o$doc)                                                         # antes: segfault en C_polygon
  expect_true("prosecnur:grafico:radar" %in% xml2::xml_attr(xml2::xml_find_all(xml, "//p:cNvPr"), "name"))
  t1 <- data.frame(eje = .rd_comp, grupo = "Total", valor = c(98, 96, 92, 96, 94, 92))
  o1 <- .lam_laminas_radar(.rd_doc(), .rd_espec(t1), "Total", folio = 1)
  x1 <- .rd_xml(o1$doc); nm <- xml2::xml_attr(xml2::xml_find_all(x1, "//p:cNvPr"), "name")
  expect_true("prosecnur:grafico:radar" %in% nm); expect_false("leyenda:texto" %in% nm)
})

test_that("el radar de públicos con tabla lleva a la lámina los decimales del analista", {
  fuente <- function(v) list(data = data.frame(id = seq_along(v), p1 = v, stringsAsFactors = FALSE),
                             inst = list(survey = data.frame(type = c("integer", "select_one lst"), name = c("id", "p1"), label = c("id", "X")),
                                         choices = data.frame(list_name = "lst", name = as.character(1:4), label = c("Muy mal", "Mal", "Bien", "Muy bien"))))
  partes <- list(docentes = fuente(c("3", "4", "4", "1", "3", "3", "2")), estudiantes = fuente(c("3", "1", "2", "4", "4", "4")))
  data_sources <- lapply(partes, `[[`, "data"); instrument_sources <- lapply(partes, `[[`, "inst")
  ejes <- list(A = list("docentes$p1", "estudiantes$p1"), B = list("docentes$p1", "estudiantes$p1"), C = list("docentes$p1", "estudiantes$p1"))
  el <- p_radar_publicos(vars = ejes, corte = "3,4", mostrar_tabla = TRUE, decimales = 1)
  e <- attr(suppressWarnings(suppressMessages(.render_radar_publicos(el))), "pulso_espec")
  expect_match(e$cifras[1, 1], "^[0-9]+\\.[0-9]%$")                            # 71.4 %, no 71 %
})
