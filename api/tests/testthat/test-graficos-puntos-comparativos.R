source("setup-load-all.R")

# G2-L1 — contrato metodologico de puntos comparativos.
#
# Los checks observan el elemento publico y el ggplot construido: porcentajes,
# etiquetas, orden, escala y geoms. No fijan nombres de helpers ni columnas
# internas del motor.

.pc_inst <- function(tipo_var = "select_one respuesta",
                     tipo_cruces = "select_one grupos",
                     grupos = c("B", "A"),
                     repeat_grain = NULL) {
  inst <- list(
    survey = data.frame(
      type = c(tipo_var, tipo_cruces, "select_one segmento", "decimal"),
      name = c("indicador", "grupo", "segmento", "peso"),
      list_name = c("respuesta", "grupos", "segmento", ""),
      label = c("Acceso a servicios", "Zona", "Segmento", "Peso"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c(
        rep("respuesta", 3L),
        rep("grupos", length(grupos)),
        rep("segmento", 2L)
      ),
      name = c("1", "2", "99", grupos, "incluido", "fuera"),
      label = c("Si", "No", "No sabe", paste("Grupo", grupos), "Incluido", "Fuera"),
      stringsAsFactors = FALSE
    ),
    orders_list = NULL
  )
  if (!is.null(repeat_grain)) attr(inst, "repeat_grain") <- repeat_grain
  inst
}

.pc_data <- function(indicador, grupo, peso = rep(1, length(indicador)),
                     segmento = rep("incluido", length(indicador)),
                     var_peso = "peso") {
  data <- data.frame(
    indicador = as.character(indicador),
    grupo = as.character(grupo),
    segmento = as.character(segmento),
    peso = peso,
    stringsAsFactors = FALSE
  )
  attr(data, "var_peso") <- var_peso
  data
}

.pc_render <- function(data, inst = .pc_inst(), corte = "1", filtros = list(),
                       excluir_opciones = NULL, orden_grupos = NULL,
                       var = "principal$indicador", cruces = "principal$grupo") {
  data_sources <- list(principal = data)
  instrument_sources <- list(principal = inst)
  args <- list(
    var = var,
    cruces = cruces,
    corte = corte,
    filtros = filtros
  )
  if (!is.null(excluir_opciones)) args$excluir_opciones <- excluir_opciones
  if (!is.null(orden_grupos)) args$orden_grupos <- orden_grupos
  .render_puntos_comparativos(do.call(p_puntos_comparativos, args))
}

.pc_geom_index <- function(plot, geom_class) {
  which(vapply(plot$layers, function(layer) inherits(layer$geom, geom_class), logical(1)))
}

.pc_point_values <- function(plot) {
  idx <- .pc_geom_index(plot, "GeomPoint")
  expect_length(idx, 1L)
  if (length(idx) != 1L) return(numeric(0))
  as.numeric(ggplot2::ggplot_build(plot)$data[[idx]]$x)
}

.pc_text_labels <- function(plot) {
  built <- ggplot2::ggplot_build(plot)
  unlist(lapply(built$data, function(layer) {
    if (is.null(layer$label)) character(0) else as.character(layer$label)
  }), use.names = FALSE)
}

.pc_axis_labels <- function(plot) {
  built <- ggplot2::ggplot_build(plot)
  as.character(built$layout$panel_params[[1]]$y$get_labels())
}

.pc_capture_error <- function(expr) tryCatch({ force(expr); NULL }, error = identity)

.pc_product_available <- function() {
  exists("p_puntos_comparativos", mode = "function") &&
    exists(".render_puntos_comparativos", mode = "function")
}

.pc_skip_if_product_absent <- function() {
  skip_if_not(
    .pc_product_available(),
    "G2-L1: p_puntos_comparativos y su renderer aun no existen"
  )
}

.pc_expect_error <- function(expr, patterns) {
  error <- .pc_capture_error(expr)
  expect_true(inherits(error, "error"), info = "El contraejemplo fue aceptado en vez de fallar cerrado.")
  if (!inherits(error, "error")) return(invisible(NULL))
  for (pattern in patterns) expect_match(conditionMessage(error), pattern, perl = TRUE)
  invisible(error)
}

test_that("p_puntos_comparativos conserva su firma y todos los codigos del corte", {
  expect_true(
    exists("p_puntos_comparativos", mode = "function"),
    info = "Falta el constructor publico p_puntos_comparativos"
  )
  if (!exists("p_puntos_comparativos", mode = "function")) return(invisible(NULL))
  expect_identical(
    names(formals(p_puntos_comparativos)),
    c(
      "var", "cruces", "corte", "titulo", "overrides", "base", "filtros",
      "orden_grupos", "excluir_opciones"
    )
  )

  elemento <- p_puntos_comparativos(
    var = "principal$indicador",
    cruces = "principal$grupo",
    corte = c("1", "99"),
    filtros = list(segmento = "incluido"),
    orden_grupos = c("B", "A"),
    excluir_opciones = "2"
  )

  expect_s3_class(elemento, "ppt_element")
  expect_identical(elemento$.element_type, "puntos_comparativos")
  expect_identical(elemento$var, "principal$indicador")
  expect_identical(elemento$cruces, "principal$grupo")
  expect_identical(elemento$corte, c("1", "99"))
  expect_identical(elemento$filtros, list(segmento = "incluido"))
  expect_identical(elemento$orden_grupos, c("B", "A"))
  expect_identical(elemento$excluir_opciones, "2")
})

test_that("el estimando pondera 9/1, conserva n crudo y dibuja puntos independientes", {
  .pc_skip_if_product_absent()
  skip_if_not_installed("ggplot2")
  plot <- .pc_render(.pc_data(
    indicador = c("1", "2", "1", "2"),
    grupo = c("A", "A", "B", "B"),
    peso = c(9, 1, 1, 1)
  ))

  expect_equal(sort(.pc_point_values(plot)), c(50, 90))
  labels <- .pc_text_labels(plot)
  expect_true("90 % · n = 2" %in% labels)
  expect_true("50 % · n = 2" %in% labels)

  copy <- paste(unlist(plot$labels, use.names = FALSE), collapse = "\n")
  expect_match(copy, "Indicador: Acceso a servicios — Si")
  expect_match(
    copy,
    "Porcentajes ponderados. n = casos válidos sin ponderar con peso positivo, después de filtros y exclusiones.",
    fixed = TRUE
  )

  geoms_prohibidos <- c("GeomLine", "GeomPath", "GeomSegment", "GeomLinerange", "GeomErrorbar")
  expect_false(any(vapply(plot$layers, function(layer) {
    any(vapply(geoms_prohibidos, function(clase) inherits(layer$geom, clase), logical(1)))
  }, logical(1))))

  built <- ggplot2::ggplot_build(plot)
  expect_equal(built$layout$panel_params[[1]]$x$get_limits(), c(0, 100))
  expect_identical(.pc_axis_labels(plot), c("Grupo B", "Grupo A"))
})

test_that("pesos factor conservan etiquetas numericas y no ocultan negativos", {
  .pc_skip_if_product_absent()
  skip_if_not_installed("ggplot2")
  plot <- .pc_render(.pc_data(
    indicador = c("1", "2", "1", "2"),
    grupo = c("A", "A", "B", "B"),
    peso = factor(c("9", "1", "1", "1"))
  ))

  expect_equal(sort(.pc_point_values(plot)), c(50, 90))
  expect_true("90 % · n = 2" %in% .pc_text_labels(plot))

  negativo <- .pc_data(
    indicador = c("1", "2", "1", "2"),
    grupo = c("A", "A", "B", "B"),
    peso = factor(c("1", "-1", "1", "1"))
  )
  .pc_expect_error(.pc_render(negativo), c("peso", "negativ"))
})

test_that("filtros y exclusiones se aplican antes de descubrir el denominador", {
  .pc_skip_if_product_absent()
  skip_if_not_installed("ggplot2")
  data <- .pc_data(
    indicador = c("1", "2", "1", "1", "2", "2"),
    grupo = c("A", "A", "A", "B", "B", "B"),
    segmento = c("incluido", "incluido", "fuera", "incluido", "incluido", "fuera")
  )

  filtrado <- .pc_render(data, filtros = list(segmento = "incluido"))
  expect_equal(sort(.pc_point_values(filtrado)), c(50, 50))

  excluido <- .pc_render(
    data,
    filtros = list(segmento = "incluido"),
    excluir_opciones = "2"
  )
  expect_equal(sort(.pc_point_values(excluido)), c(100, 100))

  .pc_expect_error(
    .pc_render(data, filtros = list(variable_inexistente = "x")),
    c("variable_inexistente", "filtro|existe")
  )
})

test_that("el codigo 99 solo es indicador cuando se declara y nunca se pierde silenciosamente", {
  .pc_skip_if_product_absent()
  skip_if_not_installed("ggplot2")
  data <- .pc_data(
    indicador = c("99", "1", "99", "2"),
    grupo = c("A", "A", "B", "B")
  )

  explicito <- .pc_render(data, corte = "99")
  expect_equal(sort(.pc_point_values(explicito)), c(50, 50))
  expect_match(paste(unlist(explicito$labels), collapse = "\n"), "No sabe")

  no_explicito <- .pc_render(data, corte = "1")
  expect_equal(sort(.pc_point_values(no_explicito)), c(0, 50))
})

test_that("cero denominador, pesos invalidos y grupos fuera de 2 a 12 fallan cerrados", {
  .pc_skip_if_product_absent()
  skip_if_not_installed("ggplot2")
  cero <- .pc_data(
    indicador = c("1", "2", "1", "2"),
    grupo = c("A", "A", "B", "B"),
    peso = c(1, 1, 0, NA)
  )
  .pc_expect_error(.pc_render(cero), c("Grupo B|B", "denominador|peso positivo|base cero"))

  negativo <- .pc_data(c("1", "2", "1", "2"), c("A", "A", "B", "B"), c(1, -1, 1, 1))
  .pc_expect_error(.pc_render(negativo), c("peso", "negativ"))

  irresoluble <- .pc_data(c("1", "2", "1", "2"), c("A", "A", "B", "B"))
  attr(irresoluble, "var_peso") <- "peso_ausente"
  .pc_expect_error(.pc_render(irresoluble), c("peso_ausente", "peso|existe"))

  un_grupo <- .pc_data(c("1", "2"), c("A", "A"))
  .pc_expect_error(.pc_render(un_grupo), c("2", "grupos"))

  grupos_13 <- as.character(seq_len(13L))
  data_13 <- .pc_data(rep("1", 13L), grupos_13)
  .pc_expect_error(.pc_render(data_13, inst = .pc_inst(grupos = grupos_13)), c("12", "grupos"))
})

test_that("codigos, solape, grano, fuente y orden son contratos exactos", {
  .pc_skip_if_product_absent()
  skip_if_not_installed("ggplot2")
  data <- .pc_data(c("1", "2", "1", "2"), c("A", "A", "B", "B"))

  .pc_expect_error(.pc_render(data, corte = "404"), c("404", "codigo|escala|opcion"))
  .pc_expect_error(.pc_render(data, corte = c("1", "1")), c("corte", "duplic|unic"))
  .pc_expect_error(
    .pc_render(data, corte = c("1", "2", "99")),
    c("corte", "trivial|toda.*escala|subconjunto")
  )
  .pc_expect_error(
    .pc_render(data, corte = "1", excluir_opciones = "1"),
    c("corte", "excluir_opciones", "solap")
  )
  .pc_expect_error(
    p_puntos_comparativos("a$indicador", "b$grupo", "1"),
    c("una.*base|misma.*base|fuente")
  )
  .pc_expect_error(
    p_puntos_comparativos("principal$indicador", "principal$indicador", "1"),
    c("var", "cruces", "distint")
  )

  multiple <- .pc_inst(tipo_var = "select_multiple respuesta")
  .pc_expect_error(.pc_render(data, inst = multiple), c("indicador", "select_one"))

  repeat_inst <- .pc_inst(repeat_grain = list(
    kind = "instancia", parent_base = "madre", repeat_group = "visitas"
  ))
  .pc_expect_error(.pc_render(data, inst = repeat_inst), c("repeat|independiente|plana"))

  manual <- .pc_render(data, orden_grupos = c("A", "B"))
  expect_identical(.pc_axis_labels(manual), c("Grupo A", "Grupo B"))
  .pc_expect_error(.pc_render(data, orden_grupos = "A"), c("orden_grupos", "permut|complet"))
  .pc_expect_error(.pc_render(data, orden_grupos = c("A", "A")), c("orden_grupos", "duplic|permut"))
  .pc_expect_error(.pc_render(data, orden_grupos = c("A", "C")), c("orden_grupos", "B|C|permut"))
})
