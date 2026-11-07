source("setup-load-all.R")

# ADR 0135 (C5 contra el PDF de Arte): «Preguntas con menos de 60% de acuerdo» junta en una lámina los tres públicos y
# rotula cada fila con su público, «(Doc.)», «(Adm.)», «(Est.)». La regla se aplica sobre todas las bases.

.dp_inst <- function() list(
  survey = data.frame(name = paste0("p", 1:4), type = "select_one lk", list_name = "lk",
                      label = c("Reglamentos", "Biblioteca", "Salud", "Tutoría"), stringsAsFactors = FALSE),
  choices = data.frame(list_name = "lk", name = c("1", "2", "3", "4", "9"),
                       label = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "Sin información"),
                       stringsAsFactors = FALSE),
  orders_list = NULL)
.dp_base <- function(acuerdo) {
  # 20 casos por pregunta: `acuerdo` de ellos en 3-4, el resto en 1, 2 y 9.
  d <- as.data.frame(lapply(acuerdo, function(k) c(rep(c("3", "4"), length.out = k), rep(c("1", "2", "9"), length.out = 20 - k))),
                     stringsAsFactors = FALSE)
  names(d) <- paste0("p", seq_along(acuerdo)); d
}
.dp_fuentes <- function() {
  ds <- list(docentes = .dp_base(c(18, 10, 16, 8)), estudiantes = .dp_base(c(17, 11, 9, 15)),
             administrativos = .dp_base(c(14, 16, 7, 18)))
  list(data_sources = ds, inst_sources = stats::setNames(rep(list(.dp_inst()), 3), names(ds)))
}

test_that("la abreviatura sale del nombre de la base o del arg `abreviaturas`", {
  expect_identical(unname(.divergentes_abreviaturas(c("docentes", "estudiantes", "administrativos"))), c("Doc.", "Est.", "Adm."))
  # Dos que chocan en tres letras van con su nombre entero.
  expect_identical(unname(.divergentes_abreviaturas(c("docentes", "estudiantes", "estudiantes_posgrado"))),
                   c("Doc.", "Estudiantes", "Estudiantes posgrado"))
  ab <- .divergentes_abreviaturas(c("docentes", "administrativos"), "Docentes: DOC; Administrativos: Adm")
  expect_identical(unname(ab), c("DOC", "Adm"))
  expect_identical(.divergentes_abreviaturas_leer(list(Docentes = "D.")), c(docentes = "D."))
  expect_identical(length(.divergentes_abreviaturas_leer("sin dos puntos")), 0L)
})

test_that("con una sola base los rótulos no cambian; con varias llevan su público", {
  expect_identical(.divergentes_rotulos_publicos(c("A", "B"), c("docentes$p1", "docentes$p2")), c("A", "B"))
  expect_identical(.divergentes_rotulos_publicos(c("A", "A"), c("docentes$p1", "estudiantes$p1")), c("A (Doc.)", "A (Est.)"))
})

test_that("la regla se aplica sobre las preguntas de los tres públicos y sus candidatas llevan el público", {
  src <- .dp_fuentes()
  el <- p_barras_divergentes(vars = c("docentes$*", "estudiantes$*", "administrativos$*"), regla = list(tipo = "bajo_umbral", umbral = 60))
  r <- .regla_preguntas_de_elemento(el, src)
  expect_identical(r$evaluacion$total, 12L)
  expect_setequal(r$vars, c("docentes$p2", "docentes$p4", "estudiantes$p2", "estudiantes$p3", "administrativos$p3"))
  cand <- r$evaluacion$candidatas
  expect_identical(cand$etiqueta[cand$tema == "administrativos$p3"], "Salud (Adm.)")
})

test_that("la lámina rotula cada fila con su público, con la misma paleta y la nota de la regla", {
  skip_if_not_installed("ggplot2")
  src <- .dp_fuentes()
  v <- c("docentes$*", "estudiantes$*", "administrativos$*")
  plan <- p_plan(slides = list(
    p_slide_1_grafico(p_barras_divergentes(vars = v, estilo = "resumen", regla = list(tipo = "bajo_umbral", umbral = 60)), titulo = "Bajo 60"),
    p_slide_1_grafico(p_barras_divergentes(vars = v, estilo = "resumen", orden = "sin_informacion", abreviaturas = "Docentes: DOC",
                                           regla = list(tipo = "mayor_sin_info", n = 3)), titulo = "Sin información"),
    p_slide_1_grafico(p_barras_divergentes(vars = "docentes$*", estilo = "resumen", regla = list(tipo = "todas")), titulo = "Uno")))
  out <- suppressWarnings(reporte_ppt_plan(data = src$data_sources, instrumento = src$inst_sources, plan = plan,
                                           solo_lista = TRUE, mensajes_progreso = FALSE))
  e1 <- attr(out$rendered[[1]], "pulso_espec"); e2 <- attr(out$rendered[[2]], "pulso_espec"); e3 <- attr(out$rendered[[3]], "pulso_espec")
  expect_setequal(e1$filas, c("Biblioteca (Doc.)", "Tutoría (Doc.)", "Biblioteca (Est.)", "Salud (Est.)", "Salud (Adm.)"))
  expect_identical(e1$texto_regla, "Se muestran las 5 bajo 60%, de 12 preguntas de escala.")
  expect_identical(e1$categorias$lado, e3$categorias$lado)
  expect_identical(e1$categorias$color, e3$categorias$color)
  expect_true(all(grepl(" \\((DOC|Est\\.|Adm\\.)\\)$", e2$filas)))
  expect_false(any(grepl("\\(", e3$filas)))
})
