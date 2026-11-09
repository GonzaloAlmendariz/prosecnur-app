source("setup-load-all.R")

# H2 (Arte, 2026-11-09): en el contraste con pares declarados (`vars = list(nombre = c(A, B))`) el nombre del tema era
# obligatorio y mandaba sobre el plan: la pestaña «Rótulos cortos» no llegaba a esas filas. Ahora un nombre idéntico al
# enunciado (sin distinguir espacios ni mayúsculas) no cuenta como declarado, y un par puede ir sin nombre: toma el
# enunciado de su primera pregunta (graficos_dumbbell_temas_nombre.R).

.dtn_labels <- c("Los reglamentos se aplican correctamente y en todas las instancias de la Unidad.",
                 "La biblioteca atiende bien y a tiempo a los estudiantes de la Facultad.",
                 "Existe un buen clima laboral en la Unidad.")
.dtn_inst <- function() list(
  survey = data.frame(name = paste0("p", 1:3), type = "select_one lk", list_name = "lk", label = .dtn_labels, stringsAsFactors = FALSE),
  choices = data.frame(list_name = "lk", name = c("1", "2", "3", "4"),
                       label = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo"), stringsAsFactors = FALSE),
  orders_list = NULL)
.dtn_base <- function(n, seed) {
  set.seed(seed)
  as.data.frame(stats::setNames(lapply(1:3, function(i) sample(c("1", "2", "3", "4"), n, TRUE)), paste0("p", 1:3)), stringsAsFactors = FALSE)
}
.dtn_fuentes <- function() list(data_sources = list(docentes = .dtn_base(115, 1), estudiantes = .dtn_base(279, 2)),
                                inst_sources = list(docentes = .dtn_inst(), estudiantes = .dtn_inst()))
.dtn_rotulos <- function(vars, plan_cortos = list()) {
  src <- .dtn_fuentes()
  withr::local_options(prosecnur.sig_informe = .nombres_cortos_en_contexto(NULL, list(rotulos_cortos = list(preguntas = plan_cortos))))
  g <- p_dumbbell(vars = vars, corte = c("3", "4"), estilo = "resumen", universos = "Docentes: 115; Estudiantes: 279")
  out <- tempfile(fileext = ".pptx")
  suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources,
                                    plan = p_plan(slides = list(p_slide_1_grafico(g, titulo = "Contraste"))),
                                    path_ppt = out, mensajes_progreso = FALSE))
  doc <- xml2::read_xml(.pptx_leer_parte(out, .pptx_slide_paths(out)[1]))
  sp <- xml2::xml_find_all(doc, "//p:sp[p:nvSpPr/p:cNvPr[@name='puntos:rotulo']]", xml2::xml_ns(doc))
  vapply(sp, function(x) paste(xml2::xml_text(xml2::xml_find_all(x, ".//a:t", xml2::xml_ns(doc))), collapse = " "), "")
}
.dtn_par <- function(i) c(paste0("docentes$p", i), paste0("estudiantes$p", i))

test_that("un nombre de tema igual al enunciado (espacios y mayúsculas aparte) no cuenta: vale el nombre corto del plan", {
  vars <- list(.dtn_par(1), .dtn_par(2), .dtn_par(3))
  names(vars) <- c(toupper(.dtn_labels[1]),                                   # mayúsculas
                   gsub(" ", "  ", .dtn_labels[2], fixed = TRUE),          # espacio duro y dobles
                   "Clima laboral")                                            # nombre escrito por el analista
  rot <- .dtn_rotulos(vars, list(`docentes$p1` = "Reglamentos", `estudiantes$p2` = "Biblioteca", `docentes$p3` = "Clima (plan)"))
  rot <- gsub("\\s+", " ", rot)
  expect_true("Reglamentos" %in% rot)
  expect_true("Biblioteca" %in% rot)
  expect_true("Clima laboral" %in% rot)        # lo escrito en el gráfico manda sobre el plan
  expect_false("Clima (plan)" %in% rot)
})

test_that("los pares sin nombre se admiten: toman el enunciado de su primera pregunta y el plan lo acorta", {
  el <- p_dumbbell(vars = list(.dtn_par(1), .dtn_par(2)), corte = c("3", "4"))
  expect_identical(names(el$vars), c("", ""))
  nm <- names(.dumbbell_temas_nombrar(el$vars, .dtn_fuentes()$inst_sources))
  expect_identical(nm, .dtn_labels[1:2])
  rot <- gsub("\\s+", " ", .dtn_rotulos(list(.dtn_par(1), .dtn_par(2)), list(`docentes$p1` = "Reglamentos")))
  expect_true("Reglamentos" %in% rot)
  expect_true(any(grepl("La biblioteca atiende", rot, fixed = TRUE)))   # sin nombre corto: el enunciado
  # Mezcla: uno con nombre y otro sin él.
  mix <- list(Clima = .dtn_par(3), .dtn_par(2))
  expect_identical(names(.dumbbell_temas_nombrar(p_dumbbell(vars = mix, corte = c("3", "4"))$vars, .dtn_fuentes()$inst_sources)),
                   c("Clima", .dtn_labels[2]))
})

test_that("un par sin nombre con una sola pregunta sigue fallando con un mensaje que dice cuál", {
  expect_error(p_dumbbell(vars = list(.dtn_par(1), "docentes$p2"), corte = "3"), "par 2")
})
