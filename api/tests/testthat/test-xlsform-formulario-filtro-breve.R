# Filtros breves y flujo del PDF del formulario (HSyVbG 2026, 2026-10-22).

.fb_sn <- function(list_name = "sn") data.frame(list_name = list_name, name = c("1", "2"),
                                                 label = c("Sí", "No"), stringsAsFactors = FALSE)
.fb_bloque <- function(m, nombre) Filter(function(b) identical(b$name, nombre), m$blocks)[[1]]
.fb_seccion <- function(m) Filter(function(b) identical(b$kind, "section"), m$blocks)[[1]]

test_that("las preguntas de inicio sin numero se nombran por su papel, no por su texto", {
  # Contexto minimo: tres select_one sin numero antes de la primera numerada.
  ctx <- list(n = 4L, tipo = c("select_one", "select_one", "select_one", "select_one"),
              numerada = c(FALSE, FALSE, FALSE, TRUE), control = c("", "", "", ""),
              nombres = c("consent_1", "consent_2", "filtro", "p1"),
              etiqueta = c("\u00bfEst\u00e1s dispuesto/a a participar?", "\u00bfAutorizas?", "\u00bfM\u00e1s de un ciclo?", "Uno"),
              fila = c(consent_1 = 1L, consent_2 = 2L, filtro = 3L, p1 = 4L), et = c("", "", "", "1"))
  expect_identical(.form_filtro_nombre_inicio(ctx, 1:3), "las preguntas de consentimiento y de filtro")
  expect_identical(.form_filtro_nombre_inicio(ctx, 1:2), "las preguntas de consentimiento")
  expect_identical(.form_filtro_nombre_inicio(ctx, 2L), "la segunda pregunta de consentimiento")
  expect_identical(.form_filtro_nombre_inicio(ctx, 3L), "la pregunta de filtro")
  ats <- lapply(c("consent_1", "consent_2", "filtro"), function(v) list(var = v, vals = "1", positivo = TRUE))
  ctx$choices <- list(sn = list(list(code = "1", label = "S\u00ed"), list(code = "2", label = "No")))
  ctx$lista <- rep("sn", 4)
  frase <- .form_filtro_frase_grupo(ctx, ats, "and")
  expect_identical(frase, "respondi\u00f3 S\u00ed en las preguntas de consentimiento y de filtro")
  expect_identical(.form_filtro_enunciado("este m\u00f3dulo", frase, "pase a P12"),
                   paste0("Filtro: aplique este m\u00f3dulo solo si respondi\u00f3 S\u00ed en las preguntas de ",
                          "consentimiento y de filtro; si no, pase a P12."))
  expect_false(grepl("dispuesto|\u00ab|\u00bb|\u00b7|\u2014", frase))
})

test_that("igualdades a la misma opcion se juntan en un rango contiguo, y el distinto en negativo", {
  sv <- data.frame(
    type = c(rep("select_one sn", 4), "text", "text"),
    name = c("a", "b", "c", "d", "x", "y"),
    label = c("A", "B", "C", "D", "X", "Y"),
    relevant = c("", "", "", "",
                 "${a} = '1' or ${b} = '1' or ${c} = '1' or ${d} = '1'",
                 "${a} != '1' and ${b} != '1' and ${c} != '1' and ${d} != '1'"),
    stringsAsFactors = FALSE)
  m <- formulario_pdf_build_model(sv, .fb_sn(), list(form_title = "C"), options = list(logic_language = "condiciones"))
  expect_identical(.fb_bloque(m, "x")$opening_condition,
                   "Filtro: aplique solo si respondió Sí en alguna de P1 a P4.")
  expect_identical(.fb_bloque(m, "y")$opening_condition,
                   "Filtro: aplique solo si no respondió Sí en ninguna de P1 a P4.")
})

test_that("sin contigüidad se enumeran las preguntas", {
  sv <- data.frame(
    type = c(rep("select_one sn", 3), "text"), name = c("a", "b", "c", "x"), label = c("A", "B", "C", "X"),
    relevant = c("", "", "", "${a} = '1' or ${c} = '1'"), stringsAsFactors = FALSE)
  m <- formulario_pdf_build_model(sv, .fb_sn(), list(form_title = "C"), options = list(logic_language = "condiciones"))
  expect_identical(.fb_bloque(m, "x")$opening_condition,
                   "Filtro: aplique solo si respondió Sí en alguna de P1 y P3.")
})

test_that("una etiqueta de varias palabras va entre comillas rectas", {
  expect_identical(.form_filtro_cita("Sí"), "Sí")
  expect_identical(.form_filtro_cita("No sé / Prefiero no decir"), "\"No sé / Prefiero no decir\"")
})

test_that("un bloque solo entre dos de ancho completo pasa a ancho completo (solo en el PDF)", {
  bl <- list(list(kind = "section", full_width = TRUE),
             list(kind = "question", type = "note", full_width = FALSE),
             list(kind = "question", type = "note", full_width = TRUE),
             list(kind = "question", type = "text", full_width = FALSE),
             list(kind = "question", type = "text", full_width = FALSE))
  out <- .form_pdf_flujo_bloques(bl)
  expect_true(out[[2]]$full_width)
  expect_false(out[[4]]$full_width)
  expect_false(out[[5]]$full_width)
  expect_false(bl[[2]]$full_width)  # el modelo (compartido con Word) no se toca
})

test_that("el codigo de opcion cae en la linea base de su etiqueta", {
  pdf <- tempfile(fileext = ".pdf"); on.exit(unlink(pdf), add = TRUE)
  .form_fuente_dispositivo(pdf); grid::grid.newpage()
  y <- 0.5
  grid::grid.text("Mujer", x = 0.3, y = y, just = c("left", "top"), gp = grid::gpar(fontsize = 7.9))
  yc <- .form_pdf_codigo_y(y, 7.7)
  grid::grid.text("12", x = 0.1, y = yc, just = c("centre", "top"), gp = grid::gpar(fontsize = 7.7, fontface = "bold"))
  base_lbl <- y - .form_pdf_ascendente(7.9, "plain")
  base_cod <- yc - .form_pdf_ascendente(7.7, "bold")
  grDevices::dev.off()
  expect_equal(base_cod, base_lbl, tolerance = 1e-9)
})

test_that("la nota larga se compone en redonda y la corta en negrita", {
  larga <- list(kind = "question", type = "note", label = strrep("palabra ", 100))
  corta <- list(kind = "question", type = "note", label = "Recuerda que esta encuesta es anónima")
  expect_identical(.form_pdf_enunciado_estilo(larga)$face, "plain")
  expect_identical(.form_pdf_enunciado_estilo(corta)$face, "bold")
})
