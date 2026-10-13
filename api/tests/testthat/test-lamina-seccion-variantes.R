# G8 (Gonzalo, 2026-10-13): el separador ofrece las versiones del recetario (láminas 52–57): capítulo A «número», B
# «rótulo» y C «número de fondo»; subcapítulo 1 «sobria», 2 «barra» y 3 «banda». Cada una dibuja sus piezas.
.sv_mazo <- function(plan) {
  df <- data.frame(p = rep(c("a", "b"), 10))
  inst <- list(survey = data.frame(name = "p", type = "select_one l", list_name = "l", label = "P"),
               choices = data.frame(list_name = "l", name = c("a", "b"), label = c("Sí", "No")), orders_list = NULL)
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = df, instrumento = inst, plan = plan, path_ppt = out, mensajes_progreso = FALSE)))
  lapply(seq_len(length(officer::read_pptx(out))), function(k) xml2::read_xml(unz(out, sprintf("ppt/slides/slide%d.xml", k))))
}
.sv_txt <- function(x, n) xml2::xml_text(xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n)))
.sv_hay <- function(x, n) length(xml2::xml_find_all(x, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", n))) > 0L

test_that("la variante se lee por nivel y lo desconocido cae en la de siempre", {
  expect_identical(.lam_seccion_variante("numero", "capitulo"), "numero")
  expect_identical(.lam_seccion_variante("fondo", "capitulo"), "fondo")
  expect_identical(.lam_seccion_variante(NULL, "capitulo"), "rotulo")
  expect_identical(.lam_seccion_variante("barra", "subcapitulo"), "barra")
  expect_identical(.lam_seccion_variante("banda", "subcapitulo"), "banda")
  expect_identical(.lam_seccion_variante("numero", "subcapitulo"), "sobria")
})

test_that("cada versión del separador dibuja lo suyo", {
  lam <- .sv_mazo(list(
    a = p_slide_seccion("Características institucionales", "Misión y propósitos", meta = list(variante = "numero")),
    b = p_slide_seccion("Cuerpo académico", meta = list(variante = "fondo")),
    c = p_slide_seccion("Misión y propósitos", "Conocimiento entre públicos", meta = list(nivel = "subcapitulo", variante = "barra")),
    d = p_slide_seccion("Planificación", meta = list(nivel = "subcapitulo", variante = "banda")),
    e = p_slide_seccion("Gestión", meta = list(nivel = "subcapitulo"))
  ))
  # A: número grande y filete, sin rótulo «CAPÍTULO 1».
  expect_identical(.sv_txt(lam[[1]], "seccion:numero"), "1")
  expect_true(.sv_hay(lam[[1]], "seccion:filete"))
  expect_false(.sv_hay(lam[[1]], "seccion:rotulo"))
  # C: número de fondo y el rótulo.
  expect_identical(.sv_txt(lam[[2]], "seccion:numero_fondo"), "2")
  expect_identical(.sv_txt(lam[[2]], "seccion:rotulo"), "CAPÍTULO 2")
  # Subcapítulo 2: barra coral y «2.1  Título» en una línea, con la ruta del capítulo.
  expect_true(.sv_hay(lam[[3]], "seccion:barra"))
  expect_identical(.sv_txt(lam[[3]], "seccion:titulo"), "2.1  Misión y propósitos")
  expect_identical(.sv_txt(lam[[3]], "seccion:ruta"), "CAPÍTULO 2: CUERPO ACADÉMICO")
  # Subcapítulo 3: banda clara; sin subtítulo, debajo va la ruta del capítulo.
  expect_true(.sv_hay(lam[[4]], "seccion:banda"))
  expect_identical(.sv_txt(lam[[4]], "seccion:numero"), "2.2")
  expect_identical(.sv_txt(lam[[4]], "seccion:subtitulo"), "Capítulo 2: Cuerpo académico")
  # Sobria: la de siempre.
  expect_false(.sv_hay(lam[[5]], "seccion:banda"))
  expect_true(.sv_hay(lam[[5]], "seccion:ruta"))
})

test_that("subcapítulo sin lámina: no agrega lámina y la siguiente lo anuncia en coral (recetario 58)", {
  expect_identical(.lam_seccion_variante("sin_lamina", "subcapitulo"), "sin_lamina")
  plan <- list(p_slide_seccion("Características institucionales"),
               p_slide_seccion("Misión y propósitos", meta = list(nivel = "subcapitulo", variante = "sin_lamina")),
               p_slide_texto("Conocimiento de la misión", texto = "a"),
               p_slide_texto("Otra", texto = "b"))
  ante <- .lam_antetitulos(plan)
  expect_identical(ante[[3]], "1.1  Misión y propósitos")
  expect_identical(ante[[4]], "Misión y propósitos")
  expect_true(.lam_ante_es_subcapitulo(ante[[3]]))
  expect_false(.lam_ante_es_subcapitulo(ante[[4]]))
  lam <- .sv_mazo(plan)
  expect_length(lam, 3L)   # capítulo + dos láminas: el subcapítulo no tiene lámina propia
})
