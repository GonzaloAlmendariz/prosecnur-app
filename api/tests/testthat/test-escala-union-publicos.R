# Cada público con su escala (Gonzalo, 2026-10-14; graficos_escala_union.R). Docentes responden en cinco puntos y
# estudiantes en cuatro: la lámina se dibuja sobre la escala de cinco, el «De acuerdo» de los estudiantes queda en
# «De acuerdo» (por etiqueta: en cuatro puntos su código es 3, que en cinco es el punto medio) y el Top Two Box se
# compara. Antes la lámina salía «Sin datos».

.eu_fixture <- function() {
  ch <- data.frame(
    list_name = c(rep("a5", 6), rep("a4", 5), rep("util", 4)),
    name = c(1:5, 99, 1:4, 99, 1:4),
    label = c("Totalmente en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF",
              "Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF",
              "Nada útil", "Poco útil", "Útil", "Muy útil"),
    stringsAsFactors = FALSE)
  doc <- data.frame(p1 = as.character(c(rep(4, 6), rep(3, 2), rep(5, 2))), u = "3", stringsAsFactors = FALSE)
  # Estudiantes: todo «De acuerdo» (código 3 en su escala de cuatro).
  est <- data.frame(p1 = as.character(rep(3, 8)), stringsAsFactors = FALSE)
  attr(doc$p1, "label") <- attr(est$p1, "label") <- "La Unidad cuenta con tutoría"
  list(data = list(docentes = doc, estudiantes = est),
       instrumento = list(
         docentes = list(survey = data.frame(name = c("p1", "u"), type = c("select_one a5", "select_one util"), list_name = c("a5", "util"), stringsAsFactors = FALSE), choices = ch, orders_list = NULL),
         estudiantes = list(survey = data.frame(name = "p1", type = "select_one a4", list_name = "a4", stringsAsFactors = FALSE), choices = ch, orders_list = NULL)))
}

.eu_render <- function(vars) {
  fx <- .eu_fixture(); msgs <- character()
  r <- withCallingHandlers(
    reporte_ppt_plan(data = fx$data, instrumento = fx$instrumento, solo_lista = TRUE, mensajes_progreso = FALSE,
                     plan = list(p_slide_1_grafico(titulo = "x", grafico = p_barras_multiapiladas(modo = "var_cruce", vars = vars,
                       top2box = TRUE, top2box_labels = c("De acuerdo", "Totalmente de acuerdo"))))),
    message = function(m) { msgs <<- c(msgs, conditionMessage(m)); invokeRestart("muffleMessage") },
    warning = function(w) { msgs <<- c(msgs, conditionMessage(w)); invokeRestart("muffleWarning") })
  list(espec = attr(r$rendered[[1]], "pulso_espec"), msgs = msgs)
}

test_that("públicos por tema con escalas de cinco y cuatro puntos se dibujan sobre la de cinco, por etiqueta", {
  skip_if_not_installed("officer")
  o <- .eu_render(list(Tutoria = c("docentes$p1", "estudiantes$p1")))
  expect_false(any(grepl("no se pudo dibujar|Sin datos", o$msgs)), info = paste(o$msgs, collapse = "\n"))
  e <- o$espec
  expect_false(is.null(e))
  # La leyenda dice de quién es la respuesta que sólo tiene una escala.
  expect_true("Ni de acuerdo ni en desacuerdo (sólo Docentes)" %in% e$categorias$rotulo, info = paste(e$categorias$rotulo, collapse = " | "))
  expect_true("De acuerdo" %in% e$categorias$rotulo)
  fila_est <- which(grepl("Estudiantes", e$filas$rotulo, ignore.case = TRUE))
  expect_length(fila_est, 1L)
  col <- function(r) which(startsWith(e$categorias$rotulo, r))[1]
  # Todo el estudiantado en «De acuerdo», nada en el punto medio.
  expect_equal(e$unidades[fila_est, col("Ni de acuerdo ni en desacuerdo")], 0)
  expect_gt(e$unidades[fila_est, match("De acuerdo", e$categorias$rotulo)], 0)
  # El Top Two Box se compara: el de los estudiantes es el 100 %.
  expect_false(is.null(e$box))
})

test_that("si ninguna escala contiene a la otra, sigue siendo un error explícito", {
  skip_if_not_installed("officer")
  o <- .eu_render(list(Tema = c("docentes$u", "estudiantes$p1")))
  expect_true(any(grepl("no comparten una escala compatible", o$msgs)))
})

test_that("la unión es por etiqueta y lista las dos escalas con sus fuentes", {
  fx <- .eu_fixture()
  h <- list(list_name = function(ctx) ctx$ln, label_col = function(ch) "label",
            norm = function(x) tolower(trimws(x)), especial = function(codes, labels) codes == "99")
  ctx <- function(src, ln) list(source = src, ln = ln, choices = fx$instrumento$docentes$choices)
  spec <- .escala_union_spec(list(ctx("docentes", "a5"), ctx("estudiantes", "a4")), h)
  expect_true(isTRUE(spec$por_etiqueta))
  expect_identical(spec$list_name, "a5")
  expect_length(spec$escalas, 2L)
  expect_identical(spec$escalas[[2]]$fuentes, "estudiantes")
  tab <- data.frame(Opciones = c("De acuerdo", "SIN INF"), n = c(8, 0), stringsAsFactors = FALSE)
  expect_identical(.escala_union_canonizar(tab, ctx("estudiantes", "a4"), spec, h)$Opciones, c("De acuerdo", "SIN INF"))
  expect_null(.escala_union_spec(list(ctx("docentes", "util"), ctx("estudiantes", "a4")), h))
})
