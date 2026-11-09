# R12-4: la tabla de datos del radar entre públicos y de sus variantes lleva un solo estilo nativo —el del recetario
# (`tabla_ttb`: encabezado sin relleno con filete azul y cebra)— y, junto a las barras comparativas, va centrada en el
# alto de su cajón. Antes las barras salían con rejilla gris completa y encabezado relleno, pegadas arriba.

.ltf_fuente <- function(prefijo, valores) {
  data <- data.frame(id = seq_along(valores[[1]]), stringsAsFactors = FALSE)
  for (k in 1:4) data[[paste0(prefijo, k)]] <- as.character(valores[[(k - 1L) %% 2L + 1L]])
  lst <- paste0("lst_", prefijo); vars <- paste0(prefijo, 1:4)
  list(data = data, inst = list(
    survey = data.frame(type = c("integer", rep("select_one", 4)), list_name = c(NA, rep(lst, 4)),
                        name = c("id", vars), label = c("id", vars), stringsAsFactors = FALSE),
    choices = data.frame(list_name = lst, name = as.character(1:4), label = c("Muy mal", "Mal", "Bien", "Muy bien"),
                         stringsAsFactors = FALSE)))
}
.ltf_render <- function(forma) {
  v <- list(c("3", "4", "3", "1", "4", "3", "3", "2"), c("3", "3", "4", "4", "1", "3", "3", "3"))
  a <- .ltf_fuente("a", v); b <- .ltf_fuente("b", rev(v))
  vars <- setNames(lapply(1:4, function(k) c(paste0("docentes$a", k), paste0("estudiantes$b", k))), paste("Tema", 1:4))
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(
    data = list(docentes = a$data, estudiantes = b$data), instrumento = list(docentes = a$inst, estudiantes = b$inst),
    path_ppt = out, mensajes_progreso = FALSE,
    plan = list(s = p_slide_1_grafico(p_radar(modo = "publicos", vars = vars, corte = "3,4", forma = forma, tabla = "si",
                                              tabla_titulo = "TOP TWO BOX"), titulo = "Comparativo")))))
  out
}
.ltf_slide <- function(pptx) {
  ex <- tempfile(); utils::unzip(pptx, exdir = ex)
  f <- list.files(file.path(ex, "ppt", "slides"), pattern = "^slide[0-9]+\\.xml$", full.names = TRUE)
  xml2::read_xml(f[length(f)])
}
.ltf_tabla <- function(xml) {
  ns <- xml2::xml_ns(xml)
  fr <- xml2::xml_find_first(xml, "//p:graphicFrame[.//a:tbl]")
  off <- xml2::xml_find_first(fr, "./p:xfrm/a:off"); ext <- xml2::xml_find_first(fr, "./p:xfrm/a:ext")
  list(xml = as.character(fr), top = as.numeric(xml2::xml_attr(off, "y")) / 914400,
       alto = as.numeric(xml2::xml_attr(ext, "cy")) / 914400)
}

test_that("la tabla de las barras comparativas lleva el estilo del radar y de las líneas y puntos", {
  skip_if_not_installed("flextable")
  tb <- .ltf_tabla(.ltf_slide(.ltf_render("barras")))
  tp <- .ltf_tabla(.ltf_slide(.ltf_render("puntos")))
  for (t in list(tb, tp)) {
    expect_false(grepl("D8D8D8", t$xml, ignore.case = TRUE))       # sin encabezado relleno gris
    expect_false(grepl("757070", t$xml, ignore.case = TRUE))       # sin rejilla completa
    expect_true(grepl(sub("#", "", .std_color("cebra")), t$xml, ignore.case = TRUE))   # cebra
    expect_true(grepl(sub("#", "", .std_color("filete")), t$xml, ignore.case = TRUE))  # filete al pie
  }
})

test_that("al costado de las barras, la tabla se centra en el alto del cajón", {
  g <- list(tabla_dibuja = "barras", tabla_ejes = paste("Tema", 1:4), tabla_grupos = c("Docentes", "Estudiantes"),
            tabla_encabezado = "TOP TWO BOX")
  loc <- list(left = 0.495, top = 1.65, width = 12.523, height = 4.77)
  d <- .lam_tabla_costado_geom(g, loc)
  expect_identical(d$lugar, "costado")
  expect_equal(d$top + d$height / 2, loc$top + loc$height / 2, tolerance = 1e-6)
})
