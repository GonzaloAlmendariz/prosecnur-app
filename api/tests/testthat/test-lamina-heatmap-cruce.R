# Plano nativo del mapa de calor (ADR 0093, N5; recetario_m3d.R). Era el del heatmap de dimensiones; desde el ADR 0137
# lo usa "Mapa de calor por cruce" (`p_heatmap_cruce`), cuya especificación `heatmap/1` declara `tipo = "heatmap_dim"`.
# La ruta real del tipo vive en test-heatmap-cruce.R; aquí, el plano con una especificación con columna Total y bloques.

.hm_xml <- function(out, k) xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k)))
.hm_txt <- function(xml, n) xml2::xml_text(xml2::xml_find_all(xml, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))
.hm_print <- function(doc) { out <- tempfile(fileext = ".pptx"); print(doc, target = out); out }
.hm_doc <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))
.hm_espec <- function(n = c(109, 56, 53)) {
  crudo <- matrix(c(94.6, 93.4, 96.1, 79.6, 82.2, 77), nrow = 2, byrow = TRUE,
                  dimnames = list(c("Técnicas", "Transversales"), c("Total", "Masculino", "Femenino")))
  v <- crudo; v[] <- .pulso_round_half_up(as.vector(crudo), 0)
  list(version = "heatmap/1", tipo = "heatmap_dim", filas = rownames(crudo),
       columnas = data.frame(rotulo = colnames(crudo), n = n, stringsAsFactors = FALSE),
       valores = v, valores_crudos = crudo, col_total = 1L, bloques = list(list(titulo = "Sexo", cols = 2:3)), rango = c(75, 100))
}

test_that("el mapa de calor nativo escribe la diferencia con el total bajo cada cifra y el color contrasta con su tramo", {
  o <- .lam_laminas_heatmap_dim(.hm_doc(), .hm_espec(), "Competencias", folio = 92)
  xml <- .hm_xml(.hm_print(o$doc), length(o$doc))
  expect_identical(.hm_txt(xml, "calor:diferencia"), c("-2", "+1", "+2", "-3"))      # Técnicas 93-95, 96-95; Transversales 82-80, 77-80
  expect_identical(.hm_txt(xml, "calor:bloque"), "Sexo")
  expect_identical(.hm_txt(xml, "calor:fila"), c("Técnicas", "Transversales"))
  expect_length(.hm_txt(xml, "calor:escala_corte"), 6L)
  tramos <- unlist(.std_paleta("calor")$tramos)
  expect_identical(.lam_calor(c(75, 79.6, 99.9), 75, 100), tramos[c(1, 1, 5)])
})

test_that("la compuerta deja en la ruta anterior lo que no cabe", {
  e <- .hm_espec()
  expect_true(.lam_heatmap_cabe(e))
  e12 <- e; e12$valores <- e$valores[, rep(1:3, 4)]; e12$columnas <- e$columnas[rep(1:3, 4), ]
  expect_false(.lam_heatmap_cabe(e12))                                               # 12 columnas
  largo <- "Pensamiento crítico y resolución de problemas en contextos profesionales"
  e8 <- e; e8$filas <- rep(largo, 8); e8$valores <- e$valores[rep(1, 8), ]; e8$valores_crudos <- e8$valores
  expect_false(.lam_heatmap_cabe(e8))                                                # 8 filas de dos líneas
  expect_false(.lam_heatmap_cabe(utils::modifyList(e, list(tipo = "comparativo_dim"))))   # otro tipo no pasa por aquí
})

test_that("el pie del mapa explica el asterisco y la diferencia bajo cada cifra (recetario 92)", {
  o <- .lam_laminas_heatmap_dim(.hm_doc(), .hm_espec(n = c(109, 56, 9)), "Competencias", base = "Base: 109 estudiantes", folio = 92)
  pie <- .hm_txt(.hm_xml(.hm_print(o$doc), length(o$doc)), "Base lamina")
  expect_identical(pie, "Base: 109 estudiantes. * Menos de 15 casos. Debajo de cada cifra, la diferencia con el total en puntos")
})
