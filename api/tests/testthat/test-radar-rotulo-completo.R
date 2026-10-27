source("setup-load-all.R")

# R3 (Renzo Segura, informe de Arte, 2026-10-27: «¿se puede hacer algo para que salga completa la competencia?»): en las
# líneas y puntos del radar entre públicos (Gráfico 73, «Competencias genéricas») el rótulo de cada criterio salía cortado
# —«Comunicación eficaz: oral, escrita y no…»— porque `.radar_mb_puntos` lo recortaba a 42 caracteres antes de dibujar.
# Regla (Word y PPT por igual): el rótulo va COMPLETO, envuelto hasta en 3 líneas; la columna de rótulos crece hasta ~40 %
# del ancho del gráfico y el gráfico cede ese ancho. Sólo si con 3 líneas y el tope no cabe, se recorta con «…» y se avisa
# qué rótulo y en qué lámina.

.rrc_largo <- "Comunicación eficaz: oral, escrita y no verbal"
.rrc_fuente <- function(prefijo, n, valores) {
  data <- data.frame(id = seq_along(valores[[1]]), stringsAsFactors = FALSE)
  for (k in seq_len(n)) data[[paste0(prefijo, k)]] <- as.character(valores[[(k - 1L) %% length(valores) + 1L]])
  lst <- paste0("lst_", prefijo); vars <- paste0(prefijo, seq_len(n))
  list(data = data, inst = list(
    survey = data.frame(type = c("integer", rep("select_one", n)), list_name = c(NA, rep(lst, n)), name = c("id", vars),
                        label = c("id", vars), stringsAsFactors = FALSE),
    choices = data.frame(list_name = lst, name = as.character(1:4), label = c("Muy mal", "Mal", "Bien", "Muy bien"), stringsAsFactors = FALSE)))
}
.rrc_src <- function(n) {
  v <- list(c("3", "4", "3", "1", "4", "3", "3", "2"), c("3", "3", "4", "4", "1", "3", "3", "3"))
  a <- .rrc_fuente("a", n, v); b <- .rrc_fuente("b", n, rev(v))
  list(data_sources = list(docentes = a$data, estudiantes = b$data), inst_sources = list(docentes = a$inst, estudiantes = b$inst))
}
.rrc_vars <- function(nombres) {
  stats::setNames(lapply(seq_along(nombres), function(k) c(paste0("docentes$a", k), paste0("estudiantes$b", k))), nombres)
}
.rrc_avisos <- function(expr) {
  avisos <- character(0)
  val <- withCallingHandlers(expr, message = function(m) { avisos <<- c(avisos, conditionMessage(m)); invokeRestart("muffleMessage") })
  list(val = val, avisos = avisos[grepl(.PULSO_AVISO_SELLO, avisos, fixed = TRUE)])
}
.rrc_nombres6 <- c("Aprendizaje autónomo y adaptabilidad", "Ética, ciudadanía y conciencia ambiental",
                   "Investigación, creación e innovación", "Pensamiento crítico y creativo", .rrc_largo, "Habilidades colaborativas")

test_that("los puntos llevan el nombre COMPLETO de cada criterio en la espec (sin «…»)", {
  src <- .rrc_src(6L)
  d <- .radar_mb_datos(.rrc_vars(.rrc_nombres6), "3,4", src)
  e <- attr(.radar_mb_puntos(d), "pulso_espec")
  expect_identical(e$rotulos, .rrc_nombres6)
  expect_false(any(grepl("…", e$rotulos, fixed = TRUE)))
})

test_that("Word: el rótulo sale entero, en hasta 3 líneas, y la columna no pasa del 40 % del ancho", {
  src <- .rrc_src(6L)
  d <- .radar_mb_datos(.rrc_vars(.rrc_nombres6), "3,4", src)
  g <- .word_g_pesas(attr(.radar_mb_puntos(d), "pulso_espec"))
  b <- suppressWarnings(ggplot2::ggplot_build(g))
  rot <- unlist(lapply(b$data, function(l) if ("label" %in% names(l) && all(l$hjust == 1)) as.character(l$label)))
  rot <- rot[!grepl("%$", rot)]
  expect_true(any(gsub("\n", " ", rot) == .rrc_largo), info = paste(rot, collapse = " | "))
  expect_false(any(grepl("…", rot, fixed = TRUE)))
  expect_true(all(lengths(strsplit(rot, "\n")) <= 3L))
  expect_lte(.word_rotulo_in(rot, 8.5), 0.40 * (.std_word("pagina", "ancho_util") - 0.3) + 1e-9)
})

test_that("Word: un criterio que no cabe ni en 3 líneas al tope se recorta con «…» y se avisa cuál", {
  enorme <- paste(rep("criterio larguísimo que no cabe", 12), collapse = " ")
  espec <- list(tipo = "pesas", rotulos = c("Corto", enorme), a = c(80, 70), b = c(90, 60), grupos = c("Docentes", "Estudiantes"),
                cifras_a = c("80%", "70%"), cifras_b = c("90%", "60%"), diferencia = c(-10, 10), textos_diferencia = c("-10", "+10"),
                mostrar_diferencia = FALSE)
  r <- .rrc_avisos(.word_g_pesas(espec))
  rot <- unlist(lapply(suppressWarnings(ggplot2::ggplot_build(r$val))$data, function(l) if ("label" %in% names(l)) as.character(l$label)))
  largo <- rot[startsWith(rot, "criterio")]
  expect_length(largo, 1L)
  expect_match(largo, "…$")
  expect_lte(length(strsplit(largo, "\n")[[1]]), 3L)
  expect_true(any(grepl("criterio larguísimo", r$avisos, fixed = TRUE)), info = paste(r$avisos, collapse = " | "))
})

test_that("PPT: la lámina nativa de puntos escribe el criterio completo y la de 4 criterios cortos no cambia de columna", {
  expect_equal(.lam_pesas_ancho_rotulo(c("Comunicación visual", "Creación", "Experimentación, técnica y producción", "Representación"), FALSE), 2.2)
  w <- .lam_pesas_ancho_rotulo(.rrc_nombres6, FALSE)
  expect_true(is.finite(w))
  expect_true(all(vapply(.rrc_nombres6, function(x) .lam_lineas(x, w, 13, TRUE) <= 3L, TRUE)))
  # tres líneas: un criterio que a 3.8 in pide tres, la columna lo acepta en vez de caer a la ruta de respaldo
  tres <- "Habilidades para la comunicación oral, escrita y no verbal en contextos profesionales diversos"
  expect_true(is.finite(.lam_pesas_ancho_rotulo(c("Uno", tres), FALSE)))

  src <- .rrc_src(6L)
  out <- tempfile(fileext = ".pptx")
  r <- .rrc_avisos(suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, path_ppt = out, mensajes_progreso = FALSE,
    plan = list(a = p_slide_1_grafico(p_radar(modo = "publicos", vars = .rrc_vars(.rrc_nombres6), corte = "3,4", forma = "puntos"),
                                      titulo = "Competencias genéricas")))))
  d <- tempfile(); utils::unzip(out, exdir = d)
  xml <- paste(unlist(lapply(list.files(file.path(d, "ppt", "slides"), "\\.xml$", full.names = TRUE), function(f) paste(readLines(f, warn = FALSE, encoding = "UTF-8"), collapse = ""))), collapse = "")
  expect_match(xml, .rrc_largo, fixed = TRUE)
  expect_false(grepl("y no…", xml, fixed = TRUE))
})
