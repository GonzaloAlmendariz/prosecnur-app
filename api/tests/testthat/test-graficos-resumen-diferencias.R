source("setup-load-all.R")

# Resumen de diferencias por capítulo (especificación CCSS del 2026-11-04, §1): la celda es p_grupo − p_resto con la
# prueba de las tarjetas (nunca contra el total), quedan fuera la otra opción de una dicotómica, NS/NR y el cruce
# tautológico («n. a.»), la selección automática ordena y topa, y la lámina nativa sale en el PPT con su leyenda, su nota
# y la base sola. Fixture sintético: 40 aulas de 10 casos.

# ---- Fixture ---------------------------------------------------------------------------------------------------------

# «q» depende fuerte del área (aulas 1-20 vs 21-40); «t» (Sí/No) sube con el nivel; «edu» fija «gen» caso a caso.
.rd_base <- function() {
  set.seed(1104)
  aula <- rep(sprintf("a%02d", 1:40), each = 10)
  na <- as.integer(sub("a", "", aula))
  area <- ifelse(na <= 20, "1", "2")
  niv <- c("6", "7", "8", "9")[((na - 1L) %% 4L) + 1L]
  sexo <- rep(c("1", "2"), 200)
  u <- stats::runif(400)
  q <- ifelse(u < ifelse(area == "1", 0.7, 0.2), "1", ifelse(u < 0.93, "2", "98"))
  t <- ifelse(stats::runif(400) < c(`6` = 0.2, `7` = 0.3, `8` = 0.35, `9` = 0.75)[niv], "1", "2")
  edu <- sample(c("1", "2", "3"), 400, replace = TRUE)
  gen <- ifelse(edu == "3", "2", "1")
  data.frame(aula = aula, area = area, niv = niv, sexo = sexo, q = q, t = t, edu = edu, gen = gen, stringsAsFactors = FALSE)
}
.rd_inst <- function() list(
  survey = data.frame(name = c("area", "niv", "sexo", "q", "t", "edu", "gen"),
                      type = c("select_one ar", "select_one nv", "select_one sx", "select_one qq", "select_one sn", "select_one ed", "select_one gn"),
                      list_name = c("ar", "nv", "sx", "qq", "sn", "ed", "gn"),
                      label = c("Área", "Nivel", "Sexo", "Pregunta q", "¿Trabajas?", "Educación", "Generación"), stringsAsFactors = FALSE),
  choices = data.frame(list_name = c("ar", "ar", rep("nv", 4), "sx", "sx", "qq", "qq", "qq", "sn", "sn", "ed", "ed", "ed", "gn", "gn"),
                       name = c("1", "2", "6", "7", "8", "9", "1", "2", "1", "2", "98", "1", "2", "1", "2", "3", "1", "2"),
                       label = c("Economía y Finanzas", "Ciencias políticas y sociales", "Nivel 6", "Nivel 7", "Nivel 8", "Nivel 9",
                                 "Mujer", "Hombre", "Mucho", "Poco", "No sabe", "Sí", "No", "Básica", "Secundaria", "Universitaria",
                                 "Primera generación", "Familia universitaria"), stringsAsFactors = FALSE),
  orders_list = list(
    q = list(names = c("1", "2", "98"), labels = c("Mucho", "Poco", "No sabe"), label = "Pregunta q"),
    t = list(names = c("1", "2"), labels = c("Sí", "No"), label = "¿Trabajas?"),
    edu = list(names = c("1", "2", "3"), labels = c("Básica", "Secundaria", "Universitaria"), label = "Educación"),
    area = list(names = c("1", "2"), labels = c("Economía y Finanzas", "Ciencias políticas y sociales"), label = "Área"),
    niv = list(names = c("6", "7", "8", "9"), labels = c("Nivel 6", "Nivel 7", "Nivel 8", "Nivel 9"), label = "Nivel"),
    sexo = list(names = c("1", "2"), labels = c("Mujer", "Hombre"), label = "Sexo"),
    gen = list(names = c("1", "2"), labels = c("Primera generación", "Familia universitaria"), label = "Generación")))
.rd_regla <- function() {
  r <- .sig_regla_fabrica()
  r$prueba <- "rao_scott"; r$correccion <- "bh_informe"; r$conglomerado <- "aula"; r$base_minima <- 30; r$conglomerados_minimos <- 8L
  r
}
.rd_fuente <- function(d = .rd_base()) .sig_fuente(d, .rd_inst())
.rd_sig <- function() list(regla = .rd_regla(), familia = NULL, m = 1234L, cruces = c("area", "niv", "sexo", "gen"))
.rd_capitulos <- function() list(
  list(titulo = "Capítulo uno", filas = list(list(var = "q", fila = "Mucho", rotulo = "Dice mucho"),
                                             list(var = "q", fila = "No sabe", rotulo = "No sabe"))),
  list(titulo = "Capítulo dos", filas = list(list(var = "t", fila = "Sí", rotulo = "Trabaja"),
                                             list(var = "t", fila = "No", rotulo = "No trabaja"),
                                             list(var = "edu", fila = "Universitaria", rotulo = "Educación universitaria"))))
.rd_modelo <- function(el, plan = list()) suppressMessages(.resumen_dif_modelo(el, .rd_fuente(), .rd_sig(), plan))
.rd_el <- function(...) p_slide_resumen_diferencias(capitulos = .rd_capitulos(), titulo = "¿En qué se diferencian?", ...)$slots$plot
.rd_fila <- function(espec, rotulo) {
  for (c in espec$capitulos) for (f in c$filas) if (identical(f$rotulo, rotulo)) return(f)
  NULL
}

# ---- La celda ----------------------------------------------------------------------------------------------------------

test_that("la celda es p_grupo − p_resto con la prueba de las tarjetas, nunca la diferencia contra el total", {
  espec <- .rd_modelo(.rd_el())
  f <- .rd_fila(espec, "Dice mucho")
  ce <- f$celdas[f$celdas$cruce == "area", ]
  expect_identical(ce$estado, c("dif", "dif"))
  expect_identical(ce$dir, c("up", "down"))
  ev <- .tarjetas_evaluar_cruce(.rd_fuente(), "q", "area", .rd_regla(), NULL, filas = "Mucho")
  expect_equal(ce$valor[1], ev$pruebas$dif[1])                 # lo que se probó
  expect_equal(ce$valor[2], -ev$pruebas$dif[1])                # dos grupos: el resto es el otro, con el signo al revés
  expect_equal(ce$valor[1], ce$p[1] - ce$p_resto[1], tolerance = 1e-8)
  expect_false(isTRUE(all.equal(ce$valor[1], ce$p[1] - f$total)))   # contra el total daría otra cifra
})

test_that("con más de dos grupos solo los que difieren llevan cifra; los demás quedan como «igual»", {
  espec <- .rd_modelo(.rd_el())
  ce <- .rd_fila(espec, "Trabaja")$celdas
  niv <- ce[ce$cruce == "niv", ]
  expect_true("dif" %in% niv$estado)
  expect_identical(niv$dir[niv$codigo == "9"], "up")
  expect_true(all(niv$estado[niv$codigo %in% c("6", "7")] %in% c("igual", "dif")))
  expect_true(all(is.na(niv$valor[niv$estado != "dif"])))
})

# ---- Lo que queda fuera ----------------------------------------------------------------------------------------------

test_that("quedan fuera NS/NR y la otra opción de una dicotómica, con aviso", {
  expect_message(espec <- .resumen_dif_modelo(.rd_el(), .rd_fuente(), .rd_sig()), "no sabe o no responde")
  expect_message(.resumen_dif_modelo(.rd_el(), .rd_fuente(), .rd_sig()), "otra opción de una dicotómica")
  rot <- unlist(lapply(espec$capitulos, function(c) vapply(c$filas, `[[`, "", "rotulo")))
  expect_false(any(c("No sabe", "No trabaja") %in% rot))
  expect_true(all(c("Dice mucho", "Trabaja", "Educación universitaria") %in% rot))
})

test_that("el cruce que se deriva de la variable dice «n. a.» (por los datos, por la convención o declarado)", {
  espec <- .rd_modelo(.rd_el())
  ce <- .rd_fila(espec, "Educación universitaria")$celdas
  expect_true(all(ce$estado[ce$cruce == "gen"] == "na"))
  expect_true(.dif_tautologico("educ_padre", "primera_gen"))                     # convención del plan de análisis
  expect_true(.dif_tautologico("x", "y", extra = list(y = "x")))                  # declarado en la lámina
  expect_false(.dif_tautologico("q", "area", .rd_fuente()))
})

test_that("una fila con base distinta de la lámina lo dice en su rótulo", {
  d <- .rd_base(); d$t[d$niv == "6"] <- NA
  el <- p_slide_resumen_diferencias(capitulos = list(list(titulo = "C", filas = list(list(var = "t", fila = "Sí", rotulo = "Trabaja", base_rotulo = "de niveles 7 a 9")))))$slots$plot
  espec <- suppressMessages(.resumen_dif_modelo(el, .rd_fuente(d), .rd_sig()))
  expect_identical(espec$capitulos[[1]]$filas[[1]]$rotulo, "Trabaja (base: 300 de niveles 7 a 9)")
})

# ---- Selección automática ----------------------------------------------------------------------------------------------

test_that("«auto» toma del plan las filas con diferencias: primero las del 99%, con tope por capítulo y total", {
  plan <- list(
    p_slide_seccion("Uno"),
    p_slide_1_grafico(p_barras_agrupadas(var = "q"), titulo = "Pregunta q"),
    p_slide_seccion("Dos"),
    p_slide_1_grafico(p_barras_agrupadas(var = "t"), titulo = "¿Trabajas?"),
    p_slide_1_grafico(p_barras_agrupadas(var = "q", cruces = "area"), titulo = "Con cruce: no entra"))
  el <- p_slide_resumen_diferencias(seleccion = "auto", max_por_capitulo = 1)$slots$plot
  espec <- .rd_modelo(el, plan)
  expect_identical(espec$seleccion, "auto")
  expect_identical(vapply(espec$capitulos, `[[`, "", "titulo"), c("Uno", "Dos"))
  expect_true(all(vapply(espec$capitulos, function(c) length(c$filas), 1L) == 1L))
  # De la dicotómica entra la opción principal («Sí»), nunca las dos.
  expect_identical(espec$capitulos[[2]]$filas[[1]]$fila, "Sí")
  # En «Uno» gana la fila con diferencia firme más grande.
  expect_identical(espec$capitulos[[1]]$filas[[1]]$fila, "Mucho")
})

test_that("la nota fija dice qué es la celda, que hay más en las láminas y el método con la familia", {
  n <- .resumen_dif_nota(.rd_regla(), 8593L, "estudiantes")
  expect_match(n, "Puntos de diferencia entre el grupo y el resto de estudiantes", fixed = TRUE)
  expect_match(n, "en las tablas de cruces", fixed = TRUE)
  expect_match(n, "Rao-Scott por aula con corrección de Benjamini-Hochberg sobre las 8,593 comparaciones del informe", fixed = TRUE)
  expect_false(grepl("[;—·]", n))   # registro formal: sin punto y coma, rayas ni puntos medios
})

# ---- Constructor y metadata --------------------------------------------------------------------------------------------

test_that("el constructor arma un slide_1 con el elemento y el antetítulo; el registro lo declara con su render_key", {
  s <- p_slide_resumen_diferencias(capitulos = .rd_capitulos(), titulo = "T", etiqueta = "Resumen de diferencias")
  expect_s3_class(s, "ppt_slide")
  expect_identical(s$.slide_type, "slide_1")
  expect_identical(s$slots$plot$.element_type, "resumen_diferencias")
  expect_identical(s$meta$antetitulo, "Resumen de diferencias")
  expect_error(p_slide_resumen_diferencias(), "declara `capitulos`")
  expect_true("p_slide_resumen_diferencias" %in% .slide_names())
  expect_identical(.SLIDES_META$p_slide_resumen_diferencias$render_key, "resumen_diferencias")
  expect_false(isTRUE(.SLIDES_META$p_slide_resumen_diferencias$en_selector))
})

# ---- Artefactos: PPT y Word ------------------------------------------------------------------------------------------

test_that("la lámina nativa del PPT lleva encabezado, capítulos, celdas, «n. a.», leyenda y la base sola, sin la nota del método", {
  skip_if_not_installed("officer")
  old <- options(prosecnur.sig_informe = .rd_sig()); on.exit(options(old), add = TRUE)
  out <- tempfile(fileext = ".pptx")
  plan <- list(a = p_slide_resumen_diferencias(capitulos = .rd_capitulos(), titulo = "¿En qué se diferencian los grupos?",
                                               etiqueta = "Resumen de diferencias", base = "Base: 400 casos.",
                                               rotulos = list(area = "Área", niv = "Nivel", sexo = "Sexo", gen = "Generación"),
                                               cortos = list(`Economía y Finanzas` = "Econ. y Fin.")))
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = .rd_base(), instrumento = .rd_inst(), plan = plan, path_ppt = out,
                                                     mensajes_progreso = FALSE)))
  xml <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  nombres <- xml2::xml_attr(xml2::xml_find_all(xml, "//p:cNvPr"), "name")
  textos <- xml2::xml_text(xml2::xml_find_all(xml, "//a:t"))
  expect_true(all(c("prosecnur:grafico:resumen_diferencias", "prosecnur:leyenda_diferencias", "resumen:cruce", "resumen:grupo",
                    "resumen:capitulo", "resumen:fila", "resumen:celda:99", "resumen:celda:igual", "resumen:celda:na",
                    "Base lamina") %in% nombres))
  # v7.11, lámina 59: el método ya lo explica «Cómo leer las diferencias»; la lámina no repite el párrafo.
  expect_false("Nota significancia" %in% nombres)
  expect_false(any(grepl("Benjamini|Rao-Scott|prueba z|Puntos de diferencia entre", textos)))
  expect_true(any(grepl("^Econ\\.", textos)))   # el rótulo corto declarado (en una o dos líneas)
  expect_true(all(c("ÁREA", "CAPÍTULO UNO", "Dice mucho", "n. a.", "Mayor que el resto", "99% de confianza",
                    "Base: 400 casos.") %in% textos))
  expect_false(any(grepl("Fuente", textos, fixed = TRUE)))
  expect_true(any(grepl("^\\+[0-9]+$", textos)) && any(grepl("^−[0-9]+$", textos)))
  # Todo dentro de la lámina de 13.333 × 7.5 in.
  off <- xml2::xml_find_all(xml, "//p:grpSp/p:sp/p:spPr/a:xfrm")
  r <- vapply(off, function(x) (as.numeric(xml2::xml_attr(xml2::xml_child(x, "a:off"), "x")) + as.numeric(xml2::xml_attr(xml2::xml_child(x, "a:ext"), "cx"))) / 914400, 0)
  b <- vapply(off, function(x) (as.numeric(xml2::xml_attr(xml2::xml_child(x, "a:off"), "y")) + as.numeric(xml2::xml_attr(xml2::xml_child(x, "a:ext"), "cy"))) / 914400, 0)
  expect_true(all(r <= 13.333 + 1e-6) && all(b <= 7.5 + 1e-6))
})

test_that("sin motor nativo y en el Word va el respaldo en ggplot con la espec (no se rompe)", {
  espec <- .rd_modelo(.rd_el())
  p <- .resumen_dif_ggplot(espec)
  expect_s3_class(p, "ggplot")
  expect_identical(attr(p, "pulso_espec")$tipo, "resumen_diferencias")
  g <- .word_grafico(p)
  expect_identical(attr(g, "renderer"), "marco")
  expect_true(.lam_compositor_aplica(p, list(meta = list())))
  expect_false(.lam_compositor_aplica(p, list(meta = list(motor_nativo = FALSE))))
  f <- tempfile(fileext = ".png"); ggplot2::ggsave(f, g, width = 6, height = attr(g, "alto"), dpi = 60)
  expect_gt(file.size(f), 0)
})
