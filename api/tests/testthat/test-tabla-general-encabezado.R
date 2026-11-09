source("setup-load-all.R")

# La tabla nativa general (`ppt.composicion.tabla_general`) lleva el encabezado a 12 pt, como `tipografia.actor`: el
# estándar se contradecía con 11, igual que `tabla_costado` antes de 245b8f2f4. La tabla de las barras comparativas del
# radar (`tabla = "si"`) es la que la usa: con 12 pt y columnas repartidas en partes iguales, «Administrativos» se partía a
# media palabra, y con el marco del motor la tabla ni siquiera se emitía (el cajón no viajaba si no cambiaba).

.tg_fuentes <- function() {
  etq <- c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo")
  inst <- list(survey = data.frame(name = paste0("p", 1:4), type = "select_one lk", label = paste("Criterio", 1:4), stringsAsFactors = FALSE),
               choices = data.frame(list_name = "lk", name = c("1", "2", "3", "4"), label = etq, stringsAsFactors = FALSE), orders_list = NULL)
  base <- function(n, seed) { set.seed(seed); as.data.frame(stats::setNames(lapply(1:4, function(i) sample(c("1", "2", "3", "4"), n, TRUE)), paste0("p", 1:4)), stringsAsFactors = FALSE) }
  bs <- c("docentes", "estudiantes", "administrativos")
  list(data = stats::setNames(lapply(seq_along(bs), function(i) base(60 + 10 * i, i)), bs),
       inst = stats::setNames(rep(list(inst), 3), bs),
       vars = stats::setNames(lapply(1:4, function(i) paste0(bs, "$p", i)), paste("Criterio", 1:4)))
}

test_that("el token del encabezado de la tabla general es 12 y la tabla nativa lo toma por defecto", {
  expect_equal(.lam_tabla_m("tabla_general")$enc_pt, 12)
  expect_equal(.lam_tabla_m("tabla_general")$enc_pt, .std_pt("actor"))
  ft <- .tabla_nativa_flextable(data.frame(a = "x", b = "1"), list(), "Arial")
  expect_equal(unique(unname(ft$header$styles$text$font.size$data[1, ])), 12)
})

test_that("los anchos medidos al decidir el sitio mandan sobre el reparto igual; un vector incompleto se ignora", {
  d <- data.frame(Criterio = "x", Docentes = "1", Estudiantes = "2", Administrativos = "3", check.names = FALSE)
  ws <- c(2.2, 1.15, 1.19, 1.51)
  ft <- .tabla_nativa_flextable(d, list(ancho_in = sum(ws), ancho_col1_in = 2.2, anchos_in = ws), "Arial")
  expect_equal(unname(ft$body$colwidths), ws)
  ft2 <- .tabla_nativa_flextable(d, list(ancho_in = sum(ws), ancho_col1_in = 2.2, anchos_in = ws[1:3]), "Arial")
  expect_equal(ft2$body$colwidths[2], ft2$body$colwidths[4])                       # reparto igual de siempre
})

test_that("la tabla de las barras comparativas sale en el PPT, a 12 pt y con el ancho que pide cada encabezado", {
  skip_if_not_installed("officer")
  s <- .tg_fuentes()
  plan <- p_plan(slides = list(p_slide_1_grafico(p_radar(modo = "publicos", vars = s$vars, corte = "3,4", tabla = "si",
                                                         tabla_titulo = "Criterio"), titulo = "Cuatro criterios")))
  f <- tempfile(fileext = ".pptx"); on.exit(unlink(f), add = TRUE)
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = s$data, instrumento = s$inst, plan = plan, path_ppt = f, mensajes_progreso = FALSE)))
  xml <- paste(readLines(unz(f, "ppt/slides/slide1.xml"), warn = FALSE, encoding = "UTF-8"), collapse = "")
  tbl <- regmatches(xml, regexpr("<a:tbl>.*</a:tbl>", xml))
  expect_length(tbl, 1L)                                                           # la tabla ya no se pierde
  expect_identical(unique(regmatches(tbl, gregexpr('sz="[0-9]+"', tbl))[[1]]), 'sz="1200"')
  cols <- as.numeric(sub('.*w="([0-9]+)"', "\\1", regmatches(tbl, gregexpr('<a:gridCol w="[0-9]+"', tbl))[[1]])) / 914400
  esperado <- c(2.2, pmax(1.15, .lam_ancho_tinta(c("Docentes", "Estudiantes", "Administrativos"), 12, TRUE) + 0.25))
  expect_equal(cols, esperado, tolerance = 1e-3)
  # «Administrativos» a 12 pt en negrita cabe en su columna, con el relleno de la celda.
  expect_lt(.lam_ancho_tinta("Administrativos", 12, TRUE) + 2 * 6 / 72, cols[4])
})
