# R12-1: el radar entre públicos con 5 a 8 criterios y su tabla al costado. El dibujo recorta el nombre del criterio
# (.radar_mb_recortar_eje, 42 caracteres) y la tabla lo lleva entero; la cifra de la tabla se buscaba por el nombre
# recortado contra el entero y la fila de etiqueta larga salía «—». Se indexa por criterio, no por su rótulo dibujado.

.rtl_ejes <- c("Aprendizaje autónomo y adaptabilidad", "Ética, ciudadanía y conciencia ambiental",
               "Investigación, creación e innovación", "Pensamiento crítico y creativo",
               "Comunicación eficaz: oral, escrita y no verbal en contextos académicos y profesionales",
               "Habilidades colaborativas")
.rtl_datos <- function() {
  v <- list(docentes = c(85, 70, 89, 83, 76, 84), estudiantes = c(92, 85, 96, 94, 87, 90))
  d <- do.call(rbind, lapply(names(v), function(g) data.frame(eje = .rtl_ejes, grupo = g, valor = v[[g]], n = 100,
                                                              stringsAsFactors = FALSE)))
  d$eje <- factor(d$eje, levels = .rtl_ejes); d$grupo <- factor(d$grupo, levels = names(v))
  d
}

test_that("la fila de etiqueta larga de la tabla del radar lleva sus cifras y su nombre entero", {
  d <- .rtl_datos()
  g <- suppressWarnings(.radar_mb_grafico(d, mostrar_valores = TRUE, decimales = 0L,
                                          overrides = list(mostrar_tabla_derecha = TRUE)))
  e0 <- attr(g, "pulso_espec")
  skip_if_not(identical(e0$tipo, "radar"))
  expect_true(any(grepl("…$", e0$ejes)))                    # el dibujo sí recorta
  g2 <- .radar_mb_componer(g, .radar_mb_tabla(d, decimales = 0L), titulo_tema = "TOP TWO BOX")
  e <- attr(g2, "pulso_espec")
  expect_false(any(e$cifras == "—"))
  larga <- which(grepl("^Comunicación eficaz", e$ejes))
  expect_identical(unname(e$cifras[larga, "Docentes"]), "76%")
  expect_identical(unname(e$cifras[larga, "Estudiantes"]), "87%")
  # La tabla de la lámina lleva el nombre entero; el dibujo, el recortado.
  expect_identical(e$ejes_tabla, .rtl_ejes)
  o <- .lam_laminas_radar(officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp")),
                          e, "Radar 6 criterios")
  out <- tempfile(fileext = ".pptx"); print(o$doc, target = out)
  xml <- xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", length(o$doc))))
  celdas <- xml2::xml_text(xml2::xml_find_all(xml, "//a:tbl//a:tc"))
  expect_true(.rtl_ejes[5] %in% celdas)
  expect_false("—" %in% celdas)
})
