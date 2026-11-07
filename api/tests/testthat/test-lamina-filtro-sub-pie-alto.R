# CCSS Perfil 2026 (revisión v3, M1/M3/B15, y Gonzalo 2026-11-03): el pie de la lámina filtro dice la base de cada
# gráfico antes de la fuente y termina en punto, advierte las bases de menos de 30 casos, y las barras del filtro y de la
# subpregunta ocupan el alto de su columna. Funciones puras y una lámina real con un fixture sintético.

.fpa_fixture <- function() {
  lab <- rep(c("1", "2", "3", "4", "5"), c(30, 25, 15, 20, 30))
  rel <- ifelse(lab %in% c("1", "2", "3"), rep(c("1", "2", "3"), length.out = length(lab)), NA)
  inst <- list(survey = data.frame(name = c("lab", "rel"), type = c("select_one lab", "select_one rel"), list_name = c("lab", "rel"),
                                   label = c("¿Cuál es su situación laboral actual?", "¿Qué tan relacionado está su trabajo con la carrera?"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = c(rep("lab", 5), rep("rel", 3)), name = c(1:5, 1:3),
                                    label = c("Dependiente", "Independiente", "Dependiente e independiente", "Busca empleo", "No trabaja ni busca",
                                              "Muy relacionado", "Relacionado", "Poco relacionado"), stringsAsFactors = FALSE), orders_list = NULL)
  inst$orders_list <- .amb_orders_list(inst)
  list(df = data.frame(lab = lab, rel = rel, stringsAsFactors = FALSE), inst = inst)
}

test_that("M1/B15: la base de la subpregunta va antes de la fuente y el pie termina en punto", {
  e <- list(n_sub = 96, habilita = "En otra región del Perú", frase = "cuya familia vive en otra región del Perú")
  expect_identical(.lam_filtro_sub_pie("Base: 400 estudiantes. Fuente: PULSO PUCP 2026.", e),
                   "Base: 400 estudiantes. Sólo los 96 cuya familia vive en otra región del Perú. Fuente: PULSO PUCP 2026.")
  e2 <- list(n_sub = 96, habilita = "Sí", unidad_n = "respuestas")
  expect_identical(.lam_filtro_sub_pie("Base: 120 estudiantes", e2), "Base: 120 estudiantes. Sólo los 96 que respondieron «Sí».")
  expect_identical(.lam_filtro_sub_pie(NULL, e2), "Sólo los 96 que respondieron «Sí».")
})

test_that("M3: con menos de 30 casos en la subpregunta el pie lo advierte; con 30 o más, no", {
  pie <- function(n) .lam_filtro_sub_pie("Base: 400 estudiantes. Fuente: PULSO PUCP 2026.", list(n_sub = n, habilita = "En Callao"))
  expect_match(pie(7), "Sólo los 7 que respondieron «En Callao». Base menor de 30 casos: cifras referenciales. Fuente: PULSO PUCP 2026.$")
  expect_match(pie(29), "Base menor de 30 casos", fixed = TRUE)
  expect_false(grepl("Base menor", pie(30), fixed = TRUE))
  expect_false(grepl("Base menor", pie(NA), fixed = TRUE))
})

test_that("las barras del filtro y de la subpregunta se reparten en el alto de su columna (hasta 1 in por fila)", {
  skip_if_not_installed("officer")
  fx <- .fpa_fixture(); out <- tempfile(fileext = ".pptx")
  suppressMessages(suppressWarnings(reporte_ppt_plan(data = fx$df, instrumento = fx$inst, path_ppt = out, mensajes_progreso = FALSE,
    plan = list(a = p_slide_1_grafico(p_filtro_subpregunta("lab", habilita = c("Dependiente", "Independiente", "Dependiente e independiente"),
                                                           subpregunta = "rel"), titulo = "x")))))
  x <- xml2::read_xml(unz(out, "ppt/slides/slide1.xml"))
  barras <- xml2::xml_find_all(x, "//p:sp[p:nvSpPr/p:cNvPr[@name='barra']]")
  off <- xml2::xml_find_first(barras, ".//a:off")
  xs <- as.numeric(xml2::xml_attr(off, "x")) / 914400; ys <- as.numeric(xml2::xml_attr(off, "y")) / 914400
  der <- ys[xs > 6]; izq <- ys[xs < 6]
  expect_length(der, 3L); expect_length(izq, 5L)
  # Antes la fila tenía un techo de 0.75 in (subpregunta) y 0.66 in (filtro): con 3 y 5 respuestas sobraba media lámina.
  expect_gt(diff(range(der)), 2 * 0.75 + 0.2)
  expect_gt(diff(range(izq)), 4 * 0.66 + 0.2)
  expect_lte(max(diff(sort(der))), .LAM_FILTRO_SUB_FILA_MAX + 1e-6)
})
