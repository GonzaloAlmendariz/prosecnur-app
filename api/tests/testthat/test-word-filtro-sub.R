source("setup-load-all.R")

# Arte_v1-6 (Gonzalo, 2026-10-26): la lámina con un Sí/No arriba y una escala abajo que depende de él salía en el Word como
# UNA sola imagen (la composición del PowerPoint), con la escala aplastada, la leyenda encimada y «Top Two Box» cortado. En
# el Word van como dos figuras: la pregunta filtro y la subpregunta, cuyo título dice a quiénes se les preguntó.

.wfs_fixture <- function() {
  src <- readLines(test_path("test-lamina-filtro-sub.R"))
  src <- src[seq_len(grep("^\\.fsub_render <- function", src)[1] - 1L)]
  env <- new.env(); eval(parse(text = src), envir = env)
  env$.fsub_fixture()
}

test_that("una lámina vertical con dependencia sale en el Word como dos figuras, la segunda con su público", {
  fx <- .wfs_fixture()
  s <- list(id = "x", tipo = "p_slide_2_graficos_vertical", payload = list(titulo = "Intercambio",
    superior = list(graficador = "p_barras_agrupadas", args = list(var = "inter")),
    inferior = list(graficador = "p_barras_apiladas", args = list(var = "util")),
    meta = list(dependencia = list(de = "superior", habilita = list("Sí"), frase = "que participaron"))))
  out <- tempfile(fileext = ".docx")
  suppressMessages(suppressWarnings(reporte_word_plan(data = fx$df, instrumento = fx$inst, plan = list(a = .graficos_rebuild_slide_json(s)),
    path_docx = out, presets_ppt = do.call(p_presets, .PRESETS_DEFAULT_PULSO), mensajes_progreso = FALSE)))
  d <- tempfile(); utils::unzip(out, exdir = d)
  x <- xml2::read_xml(file.path(d, "word/document.xml"))
  parrafos <- vapply(xml2::xml_find_all(x, "//w:p"), function(p) paste(xml2::xml_text(xml2::xml_find_all(p, ".//w:t")), collapse = ""), "")
  rotulos <- grep("^Gráfico", parrafos, value = TRUE)
  expect_length(rotulos, 2L)
  expect_match(rotulos[1], "¿Ha participado en programas de intercambio?", fixed = TRUE)
  expect_match(rotulos[2], "Los intercambios fortalecen mis competencias", fixed = TRUE)
  expect_match(rotulos[2], "(sólo quienes participaron)", fixed = TRUE)
})
