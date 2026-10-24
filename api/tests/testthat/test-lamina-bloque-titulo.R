source("setup-load-all.R")

# CCSS Perfil 2026 (láminas 8, 10, 28, 34 y 37): cuando el gráfico no cabe en pieza nativa (dona de cuatro porciones, categórica de
# trece categorías, agrupada con cruces) la lámina seguía por la ruta anterior, que rellenaba los marcadores de la plantilla: sin
# la barra azul de acento, sin antetítulo, sin folio y con «Base:» 0.1 in más a la izquierda. Toda lámina de contenido lleva ahora el mismo
# bloque (`.lam_titulo` y `.lam_pie`), venga de la ruta que venga (lamina_marco_respaldo.R).

.bt_fuente <- function() {
  set.seed(7)
  g <- rep(c("Hasta secundaria completa", "Superior técnica", "Universitaria", "Posgrado"), each = 120)
  p <- c(.10, .25, .45, .60)
  si <- unlist(lapply(seq_along(p), function(i) sample(c("Sí", "No"), 120, TRUE, prob = c(p[i], 1 - p[i]))))
  list(data = data.frame(id = seq_along(g), p1 = si, grupo = g, stringsAsFactors = FALSE),
       inst = list(survey = data.frame(type = c("integer", "select_one sn", "select_one gr"), name = c("id", "p1", "grupo"),
                                       label = c("id", "¿Tiene beca?", "Nivel educativo"), list_name = c(NA, "sn", "gr"), stringsAsFactors = FALSE),
                   choices = data.frame(list_name = c("sn", "sn", rep("gr", 4)), name = c("Sí", "No", unique(g)),
                                        label = c("Sí", "No", unique(g)), stringsAsFactors = FALSE)))
}
.bt_render <- function(grafico, titulo = "La beca llega más a quienes tienen más estudios", subtitulo = NULL, meta = list(antetitulo = "PERFIL SOCIODEMOGRÁFICO")) {
  f <- .bt_fuente(); out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = f$data, instrumento = f$inst,
    plan = list(a = p_slide_1_grafico(grafico = grafico, titulo = titulo, subtitulo = subtitulo, meta = meta)), path_ppt = out, mensajes_progreso = FALSE)))
  xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
}
.bt_cajas <- function(x) {
  ns <- xml2::xml_ns(x)
  do.call(rbind, lapply(xml2::xml_find_all(x, "//p:sp", ns), function(s) {
    off <- xml2::xml_find_first(s, ".//a:off", ns); ext <- xml2::xml_find_first(s, ".//a:ext", ns)
    if (inherits(off, "xml_missing")) return(NULL)
    data.frame(nombre = xml2::xml_attr(xml2::xml_find_first(s, ".//p:cNvPr", ns), "name"),
               x = as.numeric(xml2::xml_attr(off, "x")) / 914400, y = as.numeric(xml2::xml_attr(off, "y")) / 914400,
               w = as.numeric(xml2::xml_attr(ext, "cx")) / 914400, h = as.numeric(xml2::xml_attr(ext, "cy")) / 914400,
               texto = paste(xml2::xml_text(xml2::xml_find_all(s, ".//a:t", ns)), collapse = ""), stringsAsFactors = FALSE)
  }))
}
.bt_agrupada <- function() p_barras_agrupadas("p1", cruces = "grupo", mostrar_significancia = TRUE)   # sin pieza nativa: ruta anterior

test_that("la lámina por la ruta anterior lleva barra de acento, antetítulo, folio y «Base:» del estándar", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg"); skip_if_not_installed("stringr")
  c <- .bt_cajas(.bt_render(.bt_agrupada()))
  expect_true(all(c("titulo:barra", "Antetitulo lamina", "Titulo lamina", "Base lamina", "Folio lamina") %in% c$nombre), info = paste(c$nombre, collapse = " | "))
  expect_equal(c$texto[c$nombre == "Antetitulo lamina"], "PERFIL SOCIODEMOGRÁFICO")
  expect_equal(c$x[c$nombre == "Base lamina"], .std_geom("margen_izq"), tolerance = 0.01)
  expect_equal(c$x[c$nombre == "Titulo lamina"], .std_geom("margen_izq"), tolerance = 0.01)
  expect_false(any(grepl("^prosecnur:slide_1:(base|right)$", c$nombre)))   # ya no rellena los marcadores de pie
})

test_that("la ruta nativa y la anterior comparten el mismo bloque de título", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg"); skip_if_not_installed("stringr")
  nativa <- .bt_cajas(.bt_render(p_barras_apiladas("p1", cruces = "grupo")))
  vieja <- .bt_cajas(.bt_render(.bt_agrupada()))
  for (n in c("Antetitulo lamina", "Titulo lamina", "Base lamina", "Folio lamina")) {
    a <- nativa[nativa$nombre == n, c("x", "y")][1, ]; b <- vieja[vieja$nombre == n, c("x", "y")][1, ]
    expect_equal(a$x, b$x, tolerance = 0.01, info = n); expect_equal(a$y, b$y, tolerance = 0.01, info = n)
  }
})
