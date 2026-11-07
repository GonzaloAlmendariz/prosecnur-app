source("setup-load-all.R")

# CCSS Perfil 2026 (láminas 23, 24, 29, 38, 55, 58 y 73): la apilada/agrupada con `cruces` y `mostrar_significancia = TRUE` dibujaba
# las letras A, B, C, D sin la nota que las explica. La lámina nativa debe escribir la nota sobre «Base:», sin pisar la
# leyenda ni la base, y en una o dos líneas según su largo.

.ns_fuente <- function(etiquetas_grupo = c("Hasta secundaria completa", "Superior técnica", "Universitaria", "Posgrado")) {
  set.seed(7)
  g <- rep(etiquetas_grupo, each = 120)
  p <- c(.10, .25, .45, .60)
  si <- unlist(lapply(seq_along(p), function(i) sample(c("Sí", "No"), 120, TRUE, prob = c(p[i], 1 - p[i]))))
  list(data = data.frame(id = seq_along(g), p1 = si, grupo = g, stringsAsFactors = FALSE),
       inst = list(survey = data.frame(type = c("integer", "select_one sn", "select_one gr"), name = c("id", "p1", "grupo"),
                                       label = c("id", "¿Tiene beca?", "Nivel educativo"),
                                       list_name = c(NA, "sn", "gr"), stringsAsFactors = FALSE),
                   choices = data.frame(list_name = c("sn", "sn", rep("gr", 4)), name = c("Sí", "No", etiquetas_grupo),
                                        label = c("Sí", "No", etiquetas_grupo), stringsAsFactors = FALSE)))
}
.ns_render <- function(grafico, fuente = .ns_fuente()) {
  out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = fuente$data, instrumento = fuente$inst,
    plan = list(a = p_slide_1_grafico(grafico = grafico, titulo = "La beca llega más a quienes tienen más estudios")),
    path_ppt = out, mensajes_progreso = FALSE)))
  xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
}
# Cajas (pulgadas) de las piezas con nombre: [nombre] -> c(y, alto)
.ns_cajas <- function(x) {
  ns <- xml2::xml_ns(x)
  sps <- xml2::xml_find_all(x, "//p:sp", ns)
  do.call(rbind, lapply(sps, function(s) {
    off <- xml2::xml_find_first(s, ".//a:off", ns); ext <- xml2::xml_find_first(s, ".//a:ext", ns)
    if (inherits(off, "xml_missing")) return(NULL)
    data.frame(nombre = xml2::xml_attr(xml2::xml_find_first(s, ".//p:cNvPr", ns), "name"),
               y = as.numeric(xml2::xml_attr(off, "y")) / 914400, h = as.numeric(xml2::xml_attr(ext, "cy")) / 914400,
               texto = paste(xml2::xml_text(xml2::xml_find_all(s, ".//a:t", ns)), collapse = ""), stringsAsFactors = FALSE)
  }))
}

test_that(".lam_nota_sig_de conserva el salto lógico entre contexto y marcas (ADR 0128)", {
  p <- structure(list(), pulso_sig_nota = paste0("Con trama: X, con menos de 30\ncasos.", .SIG_NOTA_SALTO, "▲A  Mayor."))
  expect_identical(.lam_nota_sig_de(p), "Con trama: X, con menos de 30 casos.\n▲A  Mayor.")
})

test_that(".lam_nota_sig_de junta las líneas del caption en un solo párrafo", {
  p <- structure(list(), pulso_sig_nota = "Las letras marcan al grupo.\nA = uno  |  B = dos")
  expect_identical(.lam_nota_sig_de(p), "Las letras marcan al grupo. A = uno  |  B = dos")
  expect_null(.lam_nota_sig_de(structure(list())))
})

test_that("la apilada con cruces y significancia escribe la nota que explica las letras", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg"); skip_if_not_installed("stringr")
  x <- .ns_render(p_barras_apiladas("p1", cruces = "grupo", mostrar_significancia = TRUE))
  cajas <- .ns_cajas(x)
  nota <- cajas[cajas$nombre == "Nota significancia", ]
  base <- cajas[cajas$nombre == "Base lamina", ]
  expect_equal(nrow(nota), 1L, info = paste(cajas$nombre, collapse = " | "))
  # ADR 0128: fuente única de textos y sin el mapa «A = …» en la nota: la letra va con el grupo, en su rótulo.
  expect_match(nota$texto, "Mayor que el grupo de esa letra")
  expect_match(nota$texto, "Bonferroni")
  expect_true(any(grepl("(A) Hasta secundaria completa", cajas$texto, fixed = TRUE)), info = paste(cajas$texto, collapse = " | "))
  # La nota termina donde empieza «Base:» (no la pisa) y nada de la lámina baja más que su borde superior.
  expect_lte(nota$y + nota$h, base$y + 1e-6)
  otras <- cajas[!cajas$nombre %in% c("Nota significancia", "Base lamina", "Folio lamina") & cajas$y > 2, ]
  expect_true(all(otras$y + otras$h <= nota$y + 0.03), info = paste(otras$nombre[otras$y + otras$h > nota$y + 0.03], collapse = ", "))
})

test_that("una nota larga ocupa dos líneas y reserva más espacio", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg"); skip_if_not_installed("stringr")
  largas <- c("Estudiantes cuya madre o padre no llegó a completar la educación secundaria en ningún centro educativo",
              "Estudiantes cuyos padres cursaron estudios superiores técnicos completos en institutos del país",
              "Estudiantes cuyos padres cursaron estudios universitarios completos en universidades públicas",
              "Estudiantes cuyos padres cursaron estudios de posgrado, maestría o doctorado en el extranjero")
  x <- .ns_render(p_barras_apiladas("p1", cruces = "grupo", mostrar_significancia = TRUE), .ns_fuente(largas))
  cajas <- .ns_cajas(x)
  nota <- cajas[cajas$nombre == "Nota significancia", ]
  expect_equal(nrow(nota), 1L)
  # Reserva lo que mide su texto (una o dos líneas de 9 pt según el largo).
  expect_equal(nota$h, .lam_nota_sig_alto(nota$texto), tolerance = 0.02)
  base <- cajas[cajas$nombre == "Base lamina", ]
  expect_lte(nota$y + nota$h, base$y + 1e-6)
  otras <- cajas[!cajas$nombre %in% c("Nota significancia", "Base lamina", "Folio lamina") & cajas$y > 2, ]
  expect_true(all(otras$y + otras$h <= nota$y + 0.03))
})

test_that("sin significancia la lámina no lleva nota ni reserva espacio", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg")
  x <- .ns_render(p_barras_apiladas("p1", cruces = "grupo"))
  expect_false("Nota significancia" %in% .ns_cajas(x)$nombre)
})

test_that("una leyenda de dos filas sube sobre la nota de significancia y no la pisa (CCSS v6, lámina 50)", {
  skip_if_not_installed("officer"); skip_if_not_installed("rvg"); skip_if_not_installed("stringr")
  set.seed(11)
  ops <- c("No la uso", "Algunas veces al mes", "Uno o dos días por semana", "Tres o más días a la semana",
           "Todos los días, en momentos puntuales", "Todos los días, a lo largo del día")
  g <- rep(c("n6", "n7", "n8", "n9"), each = 100)
  prob <- list(n6 = c(.6, .2, .1, .05, .03, .02), n7 = c(.3, .2, .1, .1, .1, .2), n8 = c(.5, .3, .05, .05, .05, .05),
               n9 = c(.55, .2, .1, .1, .03, .02))
  p1 <- unlist(lapply(names(prob), function(k) sample(as.character(1:6), 100, TRUE, prob = prob[[k]])))
  fuente <- list(
    data = data.frame(id = seq_along(g), p1 = p1, niv = g, stringsAsFactors = FALSE),
    inst = list(survey = data.frame(type = c("integer", "select_one fr", "select_one nv"), name = c("id", "p1", "niv"),
                                    label = c("id", "Frecuencia", "Nivel"), list_name = c(NA, "fr", "nv"),
                                    stringsAsFactors = FALSE),
                choices = data.frame(list_name = c(rep("fr", 6), rep("nv", 4)), name = c(as.character(1:6), "n6", "n7", "n8", "n9"),
                                     label = c(ops, "Nivel 6", "Nivel 7", "Nivel 8", "Nivel 9"), stringsAsFactors = FALSE)))
  x <- .ns_render(p_barras_apiladas("p1", cruces = "niv", mostrar_significancia = TRUE), fuente)
  cajas <- .ns_cajas(x)
  nota <- cajas[cajas$nombre == "Nota significancia", ]
  ley <- cajas[cajas$nombre == "leyenda:texto", ]
  # Sin marcas la lámina ya no lleva nota de «ninguna diferencia» (Gonzalo, RV v7, lámina 32): este fixture no marca, así
  # que no hay nota que pisar. Si la hay (otra regla), la leyenda de dos filas sigue arriba de ella.
  expect_gt(length(unique(round(ley$y, 2))), 1L)            # la leyenda va en dos filas
  if (nrow(nota)) expect_true(all(ley$y + ley$h <= nota$y + 1e-6), info = paste(round(ley$y + ley$h, 2), collapse = " "))
  expect_false(any(grepl("Ninguna diferencia|no se distinguen", cajas$texto)))
})
