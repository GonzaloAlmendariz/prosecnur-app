# Radar con tabla (recetario p. 92, en la lámina de un gráfico) cuyos ejes no caben en una línea de la primera columna
# (lámina 69 de acrconta_mazo, «Formulación del perfil de egreso»: «Aprendizaje autónomo e investigación»). La compuerta
# exigía una línea y la lámina caía entera a la ruta anterior, con las guías de depuración. La tabla conserva su
# posición, columnas y cuerpos de letra del recetario; un eje de dos líneas sólo alarga las filas del cuerpo.

.rt2_ejes <- c("Aprendizaje autónomo e investigación", "Comunicación eficaz", "Trabajo en equipo", "Razonamiento matemático",
               "Ética y ciudadanía")
.rt2_espec <- function(ejes = .rt2_ejes) {
  v <- list(Docentes = c(96, 98, 98, 100, 96), Estudiantes = c(96, 94, 99, 94, 98), Egresados = c(93, 95, 98, 96, 98))
  d <- do.call(rbind, lapply(names(v), function(g) data.frame(eje = ejes, grupo = g, valor = v[[g]][seq_along(ejes)])))
  attr(suppressWarnings(graficar_radar(d, escala_valor = "proporcion_100", usar_canvas = TRUE, mostrar_tabla_derecha = TRUE,
                                       titulo_tabla = "Tema")), "pulso_espec")
}
.rt2_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))

test_that("un eje que pide dos líneas en la primera columna deja el radar con tabla en el motor nativo", {
  e <- .rt2_espec()
  expect_true(.lam_radar_cabe(e))
  expect_true(.lam_compositor_aplica(structure(ggplot2::ggplot(), pulso_espec = e), list()))
  o <- .lam_laminas_radar(.rt2_doc(), e, "Formulación del perfil de egreso", folio = 69, base = "Base: 51 docentes")
  out <- tempfile(fileext = ".pptx"); print(o$doc, target = out)
  x <- .pptx_leer_parte(out, .pptx_slide_paths(out)[[length(o$doc)]])
  expect_identical(.pptx_lamina_estado(x), "nativa")
  xml <- xml2::read_xml(x)
  # Misma tabla del recetario: x = 7.25 in, primera columna de 2.2 in, encabezado de 0.5 in.
  off <- xml2::xml_find_first(xml, "//p:graphicFrame[.//a:tbl]/p:xfrm/a:off")
  expect_equal(as.numeric(xml2::xml_attr(off, "x")) / 914400, 7.25, tolerance = 0.01)
  cols <- as.numeric(xml2::xml_attr(xml2::xml_find_all(xml, "//a:tbl/a:tblGrid/a:gridCol"), "w")) / 914400
  expect_equal(cols[1], 2.2, tolerance = 0.01)
  altos <- as.numeric(xml2::xml_attr(xml2::xml_find_all(xml, "//a:tbl/a:tr"), "h")) / 914400
  expect_equal(altos[1], 0.5, tolerance = 0.01)
  # El cuerpo da a cada fila el alto de dos líneas de 13 pt con su relleno, y la tabla termina sobre el pie del contenido.
  expect_true(all(abs(altos[-1] - altos[2]) < 1e-6))
  expect_gte(altos[2], 2 * 13 * 1.2 / 72 + 12 / 72 - 0.01)
  y <- as.numeric(xml2::xml_attr(off, "y")) / 914400
  expect_lte(y + sum(altos), .std_geom("contenido_y1") + 0.01)
  celdas <- xml2::xml_text(xml2::xml_find_all(xml, "//a:tbl//a:tc"))
  expect_true(all(.rt2_ejes %in% celdas))
})

test_that("con ejes de una línea la tabla queda como el recetario (filas de 0.5 in) y un eje de tres líneas no cabe", {
  e1 <- .rt2_espec(c("Estados financieros", "Auditoría", "Costos y presupuestos", "Finanzas", "Tributación"))
  expect_true(.lam_radar_cabe(e1))
  f <- .lam_radar_filas(e1)
  expect_equal(f$cabecera, 0.5); expect_equal(f$cuerpo, 0.5)
  e3 <- .rt2_espec(); e3$ejes[1] <- "Aprendizaje autónomo, investigación formativa y producción académica"
  expect_false(.lam_radar_cabe(e3))
})
