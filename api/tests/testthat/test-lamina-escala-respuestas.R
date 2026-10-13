# M10 del contrato de la maqueta (Gonzalo, 2026-10-13): «en apilada y multiapilada poder mostrar o quitar el número de
# respuestas por actor». La opción `mostrar_respuestas` (por defecto encendida) llega del plan al graficador, viaja en la
# especificación y la lámina nativa la respeta en sus tres sitios: afirmación sola, premisas y filas.

.niv_r <- c(t1 = "Totalmente en desacuerdo", t2 = "En desacuerdo", t3 = "De acuerdo", t4 = "Totalmente de acuerdo", t5 = "SIN INF")
.espec_r <- function(n_filas = 1, base = 172) {
  d <- data.frame(item = sprintf("p%02d", seq_len(n_filas)), rotulo = sprintf("Afirmación %d", seq_len(n_filas)), N = base,
                  t1 = 0.05, t2 = 0.1, t3 = 0.5, t4 = 0.3, t5 = 0.05)
  preparar_escala(d, "item", "N", paste0("t", 1:5), .niv_r, var_etiqueta_categoria = "rotulo",
                  colores_grupos = as.list(setNames(.std_paleta("likert"), .niv_r)),
                  barra_extra_preset = "top2box", top2box_labels = .niv_r[3:4])
}
.formas_r <- function(doc, nombre) {
  x <- doc$slide$get_slide(doc$cursor)$get()
  xml2::xml_text(xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre)))
}
.doc_r <- function() officer::read_pptx(system.file("plantillas", "plantilla_16_9.pptx", package = "prosecnurapp"))

test_that("una afirmación de un público: «172 respuestas» sale por defecto y se quita con la opción", {
  e <- .espec_r(1)
  e$filas$grupo_id <- "Estudiantes"; e$filas$grupo_titulo <- "Existen mecanismos periódicos"; e$filas$rotulo <- "Estudiantes"
  con <- .lam_laminas_escala(.doc_r(), e, "Gestión", base = "Base: 172 estudiantes", folio = 1)
  expect_identical(.formas_r(con$doc, "respuestas"), "172 respuestas")
  e$mostrar_respuestas <- FALSE
  sin <- .lam_laminas_escala(.doc_r(), e, "Gestión", base = "Base: 172 estudiantes", folio = 1)
  expect_length(.formas_r(sin$doc, "respuestas"), 0L)
  expect_identical(.formas_r(sin$doc, "actor"), "Estudiantes")   # el público se queda; sólo se va su conteo
})

test_that("premisas con actores: cada público lleva sus respuestas salvo que se quiten", {
  e <- .espec_r(2)
  e$filas$grupo_id <- c("P1", "P1"); e$filas$grupo_titulo <- c("La biblioteca", "La biblioteca"); e$filas$rotulo <- c("Docentes", "Estudiantes")
  con <- .lam_laminas_escala(.doc_r(), e, "Servicios", folio = 1)
  expect_length(.formas_r(con$doc, "respuestas"), 2L)
  e$mostrar_respuestas <- FALSE
  sin <- .lam_laminas_escala(.doc_r(), e, "Servicios", folio = 1)
  expect_length(.formas_r(sin$doc, "respuestas"), 0L)
  expect_length(.formas_r(sin$doc, "actor"), 2L)
})

test_that("los constructores del plan guardan la opción y el graficador la pone en la especificación", {
  expect_false(p_barras_apiladas("p1", mostrar_respuestas = FALSE)$overrides$mostrar_respuestas)
  expect_false(p_barras_multiapiladas(modo = "var", vars = c("p1", "p2"), mostrar_respuestas = FALSE)$overrides$mostrar_respuestas)
  expect_null(p_barras_apiladas("p1")$overrides$mostrar_respuestas)   # sin declarar, hereda (encendida)

  d <- data.frame(categoria = c("A", "B"), N = c(10, 20), pct_1 = c(.1, .2), pct_2 = c(.2, .2), pct_3 = c(.4, .3), pct_4 = c(.3, .3))
  cats <- c(pct_1 = "Totalmente en desacuerdo", pct_2 = "En desacuerdo", pct_3 = "De acuerdo", pct_4 = "Totalmente de acuerdo")
  p <- graficar_barras_apiladas(d, "categoria", var_n = "N", cols_porcentaje = names(cats), etiquetas_grupos = cats,
                                usar_canvas = FALSE, exportar = "rplot", mostrar_respuestas = FALSE)
  expect_false(attr(p, "pulso_espec")$mostrar_respuestas)
  p2 <- graficar_barras_apiladas(d, "categoria", var_n = "N", cols_porcentaje = names(cats), etiquetas_grupos = cats,
                                 usar_canvas = FALSE, exportar = "rplot")
  expect_true(attr(p2, "pulso_espec")$mostrar_respuestas)
})
