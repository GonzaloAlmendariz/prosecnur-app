source("setup-load-all.R")

# ADR 0135, oleada 5 (prueba con el proyecto real de Arte, 2026-11-07): las láminas de resumen con el enunciado entero de
# la pregunta por rótulo caían a la imagen ggplot y la imagen salía rota (panel en cero: un rectángulo de color sin
# puntos), con doble pie de base. Rótulos reales de Arte.

.rr_largos <- c(
  "Las funciones y atribuciones de las autoridades de la Unidad están claramente definidas.",
  "Los criterios de admisión aplicados permiten a los(as) estudiantes matriculados cumplir con las exigencias del Plan de Estudios y titularse en un plazo razonable.",
  "La dotación de recursos (infraestructura, instalaciones, laboratorios, talleres, biblioteca, equipamiento, etc.) es suficiente para atender las demandas de formación de los(as) estudiantes.",
  "Las normas internas de la Unidad permiten que se organice adecuadamente para el logro de sus propósitos.",
  "La cantidad de personal administrativo (y de apoyo) en Formación General es suficiente.",
  "La infraestructura se adecúa a las necesidades de la Formación General.",
  "El proceso formativo considera las condiciones de entrada de los(as) estudiantes admitidos.",
  "El material bibliográfico de Formación General está actualizado.",
  "Los mecanismos de reclutamiento y contratación del personal docente están claramente definidos.",
  "Los talleres y la maquinaria son suficientes y están actualizados para la cantidad de miembros del área.",
  "Los mecanismos de evaluación y promoción del personal docente están claramente definidos.",
  "Los procesos de selección y contratación de los(as) docentes son justos.",
  "Los procesos de selección y contratación de los(as) docentes son transparentes.",
  "La información referida a temas académicos (sílabos, notas, cursos, etc.) está disponible para ser consultada.",
  "Existe un buen clima laboral en la Unidad.",
  "Las autoridades de Formación General son accesibles para realizar cualquier consulta.",
  "El Departamento Académico de Arte y Diseño fomenta espacios de intercambio o movilidad docente a nivel nacional y/o internacional.",
  "Los reglamentos se aplican correctamente y en todas las instancias de la Unidad.",
  "La carga de trabajo de los(as) docentes permite cumplir con las actividades de enseñanza e investigación.",
  "Los laboratorios, talleres, ayudas audiovisuales y equipos son suficientes para las actividades académicas.")

.rr_inst <- function() list(
  survey = data.frame(name = paste0("p", seq_along(.rr_largos)), type = "select_one lk", list_name = "lk",
                      label = .rr_largos, stringsAsFactors = FALSE),
  choices = data.frame(list_name = "lk", name = c("1", "2", "3", "4", "9"),
                       label = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "Sin información"),
                       stringsAsFactors = FALSE),
  orders_list = NULL)
.rr_base <- function(n, ttb) {
  set.seed(n)
  d <- as.data.frame(lapply(ttb, function(t) {
    k <- round(n * t); sample(c(rep(c("3", "4"), length.out = k), rep(c("1", "2", "9"), length.out = n - k)))
  }), stringsAsFactors = FALSE)
  names(d) <- paste0("p", seq_along(ttb)); d
}
.rr_fuentes <- function() {
  k <- length(.rr_largos)
  ds <- list(docentes = .rr_base(115, seq(0.40, 0.95, length.out = k)),
             estudiantes = .rr_base(279, rev(seq(0.55, 0.97, length.out = k))))
  list(data_sources = ds, inst_sources = list(docentes = .rr_inst(), estudiantes = .rr_inst()))
}
.rr_contraste_espec <- function(n, rotulos = .rr_largos[seq_len(n)]) {
  d <- data.frame(eje = rep(rotulos, 2), grupo = rep(c("Docentes", "Estudiantes"), each = n),
                  valor = c(seq(40, 70, length.out = n), seq(85, 96, length.out = n)), n_casos = rep(c(115, 279), each = n))
  .espec_contraste(d, base_en = "nota")
}
.rr_render <- function(plan_slide, src = .rr_fuentes(), solo_lista = FALSE) {
  out <- tempfile(fileext = ".pptx")
  r <- suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = p_plan(slides = list(plan_slide)),
                                         path_ppt = if (solo_lista) NULL else out, solo_lista = solo_lista, mensajes_progreso = FALSE))
  if (solo_lista) return(r)
  list(path = out, xml = .pptx_leer_parte(out, .pptx_slide_paths(out)[1]))
}
.rr_textos <- function(xml, nombre) {
  doc <- xml2::read_xml(xml)
  sp <- xml2::xml_find_all(doc, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre), xml2::xml_ns(doc))
  vapply(sp, function(x) paste(xml2::xml_text(xml2::xml_find_all(x, ".//a:t", xml2::xml_ns(doc))), collapse = ""), "")
}

test_that("un rótulo va en hasta tres líneas y, si no cabe, la tercera termina en «…» (rótulos reales de Arte)", {
  for (r in .rr_largos[1:3]) {
    x <- .lam_rotulo_recortar(r, 3.0, 12, 3L)
    expect_lte(length(x$lineas), 3L)
    if (x$recortado) expect_true(endsWith(x$texto, "…")) else expect_identical(x$texto, r)
  }
  expect_false(.lam_rotulo_recortar(.rr_largos[1], 6, 11.5)$recortado)
  dot <- .lam_rotulo_recortar(.rr_largos[3], 2.6, 12, 3L)
  expect_true(dot$recortado); expect_length(dot$lineas, 3L); expect_match(dot$texto, "…$")
  # El público al final identifica la fila: se recorta el enunciado y el sufijo se conserva.
  suf <- .lam_rotulo_recortar(paste(.rr_largos[3], "(Doc.)"), 3, 10, 1L)
  expect_match(suf$texto, "… \\(Doc\\.\\)$")
})

test_that("el contraste de 13 pares con rótulos de hasta tres líneas sale nativo, con cada rótulo en su fila", {
  e <- .rr_contraste_espec(13)
  expect_true(.lam_contraste_cabe(e))
  ge <- .lam_contraste_geom(e)
  expect_true(ge$cabe)
  expect_gte(ge$size, 10.5)
  expect_gte(ge$m$xr - ge$m$xl, 3.5 - 1e-6)
  # Las filas caben en la zona de datos y cada una alcanza para las líneas de su rótulo.
  expect_lte(sum(ge$alturas), ge$zona1 - ge$zona0 - ge$cab + 1e-6)
  lineas <- vapply(ge$textos, function(t) length(.lam_rotulo_recortar(t, ge$m$wrot, ge$size, 3L)$lineas), 0L)
  expect_true(all(lineas <= 3L))
  expect_true(all(ge$alturas >= lineas * ge$size * 1.2 / 72))
  # Más de 14 pares sigue al respaldo (ADR 0134 §5).
  expect_false(.lam_contraste_cabe(.rr_contraste_espec(16)))
})

test_that("el contraste real (bases + regla de 13) sale nativo, con los rótulos enteros y una sola base", {
  skip_if_not_installed("officer")
  graf <- list(graficador = "p_dumbbell", args = list(bases = list("docentes", "estudiantes"), corte = list("3", "4"),
                                                      estilo = "resumen", regla = list(tipo = "mayor_diferencia", n = 13)))
  s <- .rebuild_slide(list(id = "s1", tipo = "p_slide_1_grafico", payload = list(titulo = "Contraste", grafico = graf)))
  r <- .rr_render(s)
  expect_identical(.pptx_lamina_estado(r$xml), "nativa")
  rot <- .rr_textos(r$xml, "puntos:rotulo")
  expect_length(rot, 13L)
  expect_true(.rr_largos[3] %in% rot || any(startsWith(rot, "La dotación de recursos")))
  # U3: el pie lleva la base de cada grupo y no la genérica de base$*.
  pie <- paste(regmatches(r$xml, gregexpr("Base:[^<]*", r$xml))[[1]], collapse = " | ")
  expect_match(pie, "Base: Docentes 115; Estudiantes 279")
  expect_identical(lengths(regmatches(r$xml, gregexpr("Base:", r$xml)))[[1]], 1L)
})

test_that("el nombre corto de la pregunta (overrides$etiquetas_vars) va en el contraste, las fortalezas y la escala", {
  src <- .rr_fuentes()
  cortos <- list(`docentes$p1` = "Funciones definidas", p2 = "Admisión adecuada", `estudiantes$p3` = "Recursos suficientes")
  con <- function(el) { el$overrides$etiquetas_vars <- cortos; el }
  g <- con(p_dumbbell(bases = c("docentes", "estudiantes"), corte = c("3", "4"), estilo = "resumen", regla = list(tipo = "todas")))
  out <- .rr_render(p_slide_1_grafico(g, titulo = "Contraste"), src, solo_lista = TRUE)
  rot <- attr(out$rendered[[1]], "pulso_espec")$rotulos
  expect_true(all(c("Funciones definidas", "Admisión adecuada", "Recursos suficientes") %in% rot))
  expect_false(.rr_largos[1] %in% rot)
  f <- con(p_fortalezas(vars = list("docentes$*"), corte = c("3", "4"), regla = list(tipo = "extremos", n = 5)))
  out_f <- .rr_render(p_slide_1_grafico(f, titulo = "Fortalezas"), src, solo_lista = TRUE)
  rot_f <- unlist(lapply(attr(out_f$rendered[[1]], "pulso_espec")$columnas, `[[`, "rotulos"))
  expect_true("Funciones definidas" %in% rot_f)
  d <- con(p_barras_divergentes(vars = paste0("docentes$p", 1:6), estilo = "resumen"))
  out_d <- .rr_render(p_slide_1_grafico(d, titulo = "Escala"), src, solo_lista = TRUE)
  expect_true(all(c("Funciones definidas", "Admisión adecuada") %in% attr(out_d$rendered[[1]], "pulso_espec")$filas))
  # Sin declarar, el rótulo es el del instrumento.
  expect_identical(.resumen_rotulo_corto("docentes$p9", "largo"), "largo")
})

test_that("el respaldo ggplot del contraste (bases + regla, más de 14 pares) dibuja sus puntos con el panel a lo ancho", {
  skip_if_not_installed("rvg")
  src <- .rr_fuentes()
  g <- p_dumbbell(bases = c("docentes", "estudiantes"), corte = c("3", "4"), estilo = "resumen", regla = list(tipo = "mayor_diferencia", n = 18))
  p <- .rr_render(p_slide_1_grafico(g, titulo = "Contraste"), src, solo_lista = TRUE)$rendered[[1]]
  e <- attr(p, "pulso_espec")
  expect_length(e$rotulos, 18L)
  expect_false(.lam_contraste_cabe(e))
  b <- ggplot2::ggplot_build(p)
  puntos <- b$data[[which(vapply(p$layers, function(l) inherits(l$geom, "GeomPoint"), TRUE))]]
  expect_identical(nrow(puntos), 36L)
  expect_true(all(is.finite(puntos$x) & puntos$x >= e$eje[["lo"]] & puntos$x <= e$eje[["hi"]]))
  # El panel conserva ancho útil en el cajón de la lámina (12.5 x 5 in): con los rótulos enteros quedaba en negativo.
  grDevices::png(tempfile(fileext = ".png"), width = 12.5, height = 5, units = "in", res = 72); on.exit(grDevices::dev.off(), add = TRUE)
  gt <- ggplot2::ggplotGrob(p)
  anchos <- grid::convertWidth(gt$widths, "in", valueOnly = TRUE)
  panel <- gt$layout[gt$layout$name == "panel", ]
  fijo <- sum(anchos[-seq(panel$l, panel$r)])
  expect_gt(12.5 - fijo, 6)
  # La base por grupo va al pie de la lámina (note_outside), no dentro del dibujo, con la regla al final.
  expect_null(p$labels$caption)
  expect_match(attr(p, "note_outside"), "^Base: Docentes 115; Estudiantes 279\\. Se muestran las 18 de mayor diferencia")
})

test_that("con el respaldo, la lámina lleva una sola base: la de cada grupo, abajo a la izquierda (U3)", {
  skip_if_not_installed("officer")
  g <- p_dumbbell(bases = c("docentes", "estudiantes"), corte = c("3", "4"), estilo = "resumen", regla = list(tipo = "mayor_diferencia", n = 18))
  r <- .rr_render(p_slide_1_grafico(g, titulo = "Contraste"))
  expect_false(identical(.pptx_lamina_estado(r$xml), "nativa"))
  bases <- regmatches(r$xml, gregexpr("Base:[^<]*", r$xml))[[1]]
  expect_length(bases, 1L)
  expect_match(bases, "^Base: Docentes 115; Estudiantes 279")
  expect_true(.plan_base_escrita_por_grupo(g))
  expect_false(.base_para_word(.plan_base_escrita_por_grupo(g)))   # el Word conserva su párrafo de base
  expect_false(.plan_base_escrita_por_grupo(p_panorama(vars = list("docentes$*"), corte = c("3", "4"))))
})

test_that("fortalezas con rótulos largos salen nativas: hasta tres líneas, «…» si no caben, y una sola base", {
  skip_if_not_installed("officer")
  f <- p_fortalezas(vars = list("docentes$*"), corte = c("3", "4"), regla = list(tipo = "extremos", n = 5))
  r <- .rr_render(p_slide_1_grafico(f, titulo = "Fortalezas"))
  expect_identical(.pptx_lamina_estado(r$xml), "nativa")
  rot <- .rr_textos(r$xml, "fortalezas:rotulo")
  expect_length(rot, 10L)
  expect_true(all(vapply(rot, function(t) length(.lam_tyc_envolver(t, (3.7 - 0.22) * 0.95, 12)) <= 3L, TRUE)))
  bases <- regmatches(r$xml, gregexpr("Base:[^<]*", r$xml))[[1]]
  expect_length(bases, 1L); expect_match(bases, "^Base: Docentes 115")
})

test_that("el respaldo de fortalezas pone los rótulos partidos a la izquierda del cero y la base fuera del dibujo", {
  d <- data.frame(rotulo = .rr_largos[1:10], valor = seq(30, 95, length.out = 10), orden = 1:10)
  p <- graficar_fortalezas(d, n = 5, nota_base = "Base: Docentes 115")
  capa <- which(vapply(p$layers, function(l) inherits(l$geom, "GeomText") && grepl("rotulo", rlang::as_label(l$mapping$label)), TRUE))
  expect_length(capa, 1L)
  rot <- ggplot2::ggplot_build(p)$data[[capa]]$label
  expect_true(all(lengths(strsplit(rot, "\n")) <= 3L))
  expect_true(all(vapply(unlist(strsplit(rot, "\n")), function(l) .lam_ancho_tinta(l, 9) <= 2.3, TRUE)))
  expect_null(p$labels$caption)
  expect_identical(attr(p, "note_outside"), "Base: Docentes 115")
})

test_that("el respaldo de la escala del resumen usa la paleta y los rótulos de la especificación, sin saldo, con rótulos partidos", {
  src <- .rr_fuentes()
  d <- p_barras_divergentes(vars = c("docentes$*", "estudiantes$*"), estilo = "resumen", regla = list(tipo = "todas"))
  p <- .rr_render(p_slide_1_grafico(d, titulo = "Escala"), src, solo_lista = TRUE)$rendered[[1]]
  e <- attr(p, "pulso_espec")
  expect_identical(e$estilo, "resumen")
  b <- ggplot2::ggplot_build(p)
  fills <- unique(unlist(lapply(b$data, function(x) x$fill)))
  expect_true(all(e$categorias$color[e$categorias$lado != "sin_inf"] %in% fills))
  expect_false(any(vapply(b$data, function(x) "label" %in% names(x) && any(grepl(" pp$", x$label)), TRUE)))
  et <- b$layout$panel_params[[1]]$y$get_labels()
  expect_true(all(grepl("\\((Doc|Est)\\.?\\)$|\\(Docentes\\)$|\\(Estudiantes\\)$", et)))
  expect_match(attr(p, "note_outside"), "Porcentaje sobre el total de respondientes")
})
