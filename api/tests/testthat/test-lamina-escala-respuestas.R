# M10 del contrato de la maqueta (Gonzalo, 2026-10-13): «en apilada y multiapilada poder mostrar o quitar el número de
# respuestas por actor». La opción `mostrar_respuestas` (N3b, 2026-10-22: por defecto APAGADA; switcher opcional por gráfico) llega del plan al graficador, viaja en la
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

test_that("una afirmación de un público: «172 respuestas» NO sale por defecto y sí con mostrar_respuestas = TRUE", {
  e <- .espec_r(1)
  e$filas$grupo_id <- "Estudiantes"; e$filas$grupo_titulo <- "Existen mecanismos periódicos"; e$filas$rotulo <- "Estudiantes"
  sin <- .lam_laminas_escala(.doc_r(), e, "Gestión", base = "Base: 172 estudiantes", folio = 1)
  expect_length(.formas_r(sin$doc, "respuestas"), 0L)
  expect_identical(.formas_r(sin$doc, "actor"), "Estudiantes")   # el público se queda; sólo se va su conteo
  e$mostrar_respuestas <- TRUE
  con <- .lam_laminas_escala(.doc_r(), e, "Gestión", base = "Base: 172 estudiantes", folio = 1)
  expect_identical(.formas_r(con$doc, "respuestas"), "172 respuestas")
  e$mostrar_respuestas <- FALSE
  expect_length(.formas_r(.lam_laminas_escala(.doc_r(), e, "Gestión", folio = 1)$doc, "respuestas"), 0L)
})

test_that("premisas con actores: sin la opción no hay respuestas; encendida, cada público lleva las suyas", {
  e <- .espec_r(2)
  e$filas$grupo_id <- c("P1", "P1"); e$filas$grupo_titulo <- c("La biblioteca", "La biblioteca"); e$filas$rotulo <- c("Docentes", "Estudiantes")
  sin <- .lam_laminas_escala(.doc_r(), e, "Servicios", folio = 1)
  expect_length(.formas_r(sin$doc, "respuestas"), 0L)
  expect_length(.formas_r(sin$doc, "actor"), 2L)
  e$mostrar_respuestas <- TRUE
  con <- .lam_laminas_escala(.doc_r(), e, "Servicios", folio = 1)
  expect_length(.formas_r(con$doc, "respuestas"), 2L)
})

test_that("los constructores del plan guardan la opción y el default del graficador es FALSE", {
  expect_true(p_barras_apiladas("p1", mostrar_respuestas = TRUE)$overrides$mostrar_respuestas)
  expect_true(p_barras_multiapiladas(modo = "var", vars = c("p1", "p2"), mostrar_respuestas = TRUE)$overrides$mostrar_respuestas)
  expect_null(p_barras_apiladas("p1")$overrides$mostrar_respuestas)   # sin declarar, hereda (apagada)
  expect_false(formals(graficar_barras_apiladas)$mostrar_respuestas)

  d <- data.frame(categoria = c("A", "B"), N = c(10, 20), pct_1 = c(.1, .2), pct_2 = c(.2, .2), pct_3 = c(.4, .3), pct_4 = c(.3, .3))
  cats <- c(pct_1 = "Totalmente en desacuerdo", pct_2 = "En desacuerdo", pct_3 = "De acuerdo", pct_4 = "Totalmente de acuerdo")
  p <- graficar_barras_apiladas(d, "categoria", var_n = "N", cols_porcentaje = names(cats), etiquetas_grupos = cats,
                                usar_canvas = FALSE, exportar = "rplot", mostrar_respuestas = TRUE)
  expect_true(attr(p, "pulso_espec")$mostrar_respuestas)
  p2 <- graficar_barras_apiladas(d, "categoria", var_n = "N", cols_porcentaje = names(cats), etiquetas_grupos = cats,
                                 usar_canvas = FALSE, exportar = "rplot")
  expect_false(attr(p2, "pulso_espec")$mostrar_respuestas)
})

test_that("el metadata de Gráficos ofrece mostrar_respuestas apagado por defecto y lo dice opcional", {
  gr <- .graficos_registry_payload()$graficadores
  n <- 0L
  for (g in gr) for (a in (g$args %||% list())) if (identical(a$name, "mostrar_respuestas")) {
    n <- n + 1L
    expect_false(isTRUE(a$default))
    expect_match(a$descripcion, "Apagado por defecto|opcional", ignore.case = TRUE)
  }
  expect_gte(n, 1L)
})

test_that("apagar «N respuestas» apaga también el «x de y» de la base chica; encendido, salen los dos", {
  e <- .espec_r(2, base = 15)
  e$filas$grupo_id <- c("P1", "P1"); e$filas$grupo_titulo <- c("La biblioteca", "La biblioteca"); e$filas$rotulo <- c("Docentes", "Estudiantes")
  expect_true(.lam_base_chica(e))
  e$mostrar_respuestas <- FALSE
  o <- .lam_laminas_escala(.doc_r(), e, "Servicios", folio = 1)
  expect_length(.formas_r(o$doc, "box:casos"), 0L)
  expect_false(any(grepl(" de ", .formas_r(o$doc, "box:cifra"))))
  expect_length(.formas_r(o$doc, "respuestas"), 0L)
  e$mostrar_respuestas <- TRUE
  o <- .lam_laminas_escala(.doc_r(), e, "Servicios", folio = 1)
  tx <- .formas_r(o$doc, "box:casos")
  expect_true(length(tx) > 0L)
  expect_true(all(grepl("^[0-9]+ de 15$", tx)))
  expect_length(.formas_r(o$doc, "respuestas"), 2L)
})
