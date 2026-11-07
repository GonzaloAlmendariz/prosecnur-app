source("setup-load-all.R")

# ADR 0135, punto 6 (grupos con padrón): un grupo con «Padrón confiable» apagado conserva lo que se tecleó en
# `universos_no_confiables`. El motor lo guarda en el elemento y no lo usa: la base y la tasa salen sólo de `universos`.

.pn_fuentes <- function() {
  lk <- c("1", "2", "3", "4", "5")
  inst <- list(survey = data.frame(name = c("q1", "q2", "sexo"), type = c("select_one lk", "select_one lk", "select_one sx"),
                                   list_name = c("lk", "lk", "sx"), label = c("Reglamentos", "Biblioteca", "Sexo"),
                                   stringsAsFactors = FALSE),
               choices = data.frame(list_name = c(rep("lk", 5), "sx", "sx"), name = c(lk, "1", "2"),
                                    label = c("Muy en desacuerdo", "En desacuerdo", "Ni uno ni otro", "De acuerdo", "Muy de acuerdo",
                                              "Mujer", "Hombre"), stringsAsFactors = FALSE),
               orders_list = NULL)
  base <- function(n, a, b) data.frame(q1 = rep(lk, a), q2 = rep(lk, b), sexo = rep(c("1", "2"), length.out = n), stringsAsFactors = FALSE)
  list(data_sources = list(docentes = base(40, c(2, 3, 5, 15, 15), c(4, 6, 10, 10, 10)),
                           estudiantes = base(40, c(5, 5, 10, 10, 10), c(6, 8, 8, 9, 9))),
       inst_sources = list(docentes = inst, estudiantes = inst))
}
.pn_espec <- function(el, src) {
  plan <- p_plan(slides = list(p_slide_1_grafico(el, titulo = "T")))
  salida <- suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan,
                                              solo_lista = TRUE, mensajes_progreso = FALSE))
  attr(salida$rendered[[1]], "pulso_espec")
}

test_that("el arg se normaliza: texto, lista con nombres o vacío; otra cosa es un error del plan", {
  expect_identical(.graficos_universos_no_confiables(" Docentes TC: 24 ", "x"), "Docentes TC: 24")
  expect_identical(.graficos_universos_no_confiables(list(`Docentes TC` = 24, `Docentes TP` = 40), "x"),
                   "Docentes TC: 24; Docentes TP: 40")
  expect_null(.graficos_universos_no_confiables("", "x"))
  expect_null(.graficos_universos_no_confiables(NULL, "x"))
  expect_error(.graficos_universos_no_confiables(c("a", "b"), "p_cobertura()"), "universos_no_confiables")
})

test_that("cobertura: lo guarda en el elemento y no cambia casos, padrón ni tasa", {
  skip_if_not_installed("ggplot2")
  src <- .pn_fuentes()
  el0 <- p_cobertura(universos = "Docentes: 50", metas = "Docentes: 60%")
  el1 <- p_cobertura(universos = "Docentes: 50", metas = "Docentes: 60%", universos_no_confiables = "Estudiantes: 30")
  expect_identical(el1$universos_no_confiables, "Estudiantes: 30")
  expect_null(el0$universos_no_confiables)
  e0 <- .pn_espec(el0, src); e1 <- .pn_espec(el1, src)
  expect_identical(e1, e0)
  # Estudiantes, cuyo padrón «no confiable» es 30, sigue sin padrón ni tasa: sólo n.
  expect_identical(e1$publicos$texto_tasa, c("80%", ""))
  expect_identical(e1$publicos$texto_padron, c("de 50", ""))
})

test_that("contraste entre públicos y entre grupos: lo guarda y no cambia la base ni la nota", {
  skip_if_not_installed("ggplot2")
  src <- .pn_fuentes()
  vars <- list(Reglamentos = c("docentes$q1", "estudiantes$q1"), Biblioteca = c("docentes$q2", "estudiantes$q2"))
  el0 <- p_dumbbell(vars = vars, corte = c("4", "5"), estilo = "resumen", universos = "Docentes: 50")
  el1 <- p_dumbbell(vars = vars, corte = c("4", "5"), estilo = "resumen", universos = "Docentes: 50",
                    universos_no_confiables = "Estudiantes: 30")
  expect_identical(el1$universos_no_confiables, "Estudiantes: 30")
  expect_identical(.pn_espec(el1, src), .pn_espec(el0, src))
  g0 <- p_dumbbell(vars = list("docentes$q1", "docentes$q2"), corte = c("4", "5"), cruce = "docentes$sexo", grupos = c("1", "2"),
                   estilo = "resumen", universos = "Mujer: 25")
  g1 <- p_dumbbell(vars = list("docentes$q1", "docentes$q2"), corte = c("4", "5"), cruce = "docentes$sexo", grupos = c("1", "2"),
                   estilo = "resumen", universos = "Mujer: 25", universos_no_confiables = "Hombre: 22")
  expect_identical(g1$universos_no_confiables, "Hombre: 22")
  expect_null(g1$overrides$universos_no_confiables)   # no llega al graficador
  expect_identical(.pn_espec(g1, src), .pn_espec(g0, src))
})

test_that("sobrevive a .clean_rebuild_args y está en el registro", {
  for (fn in c("p_dumbbell", "p_cobertura")) {
    a <- .clean_rebuild_args(list(universos_no_confiables = "Docentes TC: 24", universos = "Docentes TP: 40"), get(fn))
    expect_identical(a$universos_no_confiables, "Docentes TC: 24", info = fn)
    arg <- Filter(function(x) identical(x$name, "universos_no_confiables"), .GRAFICADORES_META[[fn]]$args)
    expect_length(arg, 1L)
    expect_identical(arg[[1]]$tipo_input, "string"); expect_identical(arg[[1]]$grupo, "datos")
    expect_identical(arg[[1]]$label, "Padrones no confiables")
  }
})
