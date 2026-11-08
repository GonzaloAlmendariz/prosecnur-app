source("setup-load-all.R")

# El detalle de una agrupada con «Dividir por» (graficos_cifras_detalle.R, `agrupadas_cruce/1`): una fila por grupo con
# su n, los del render (`pulso_barras_series`, `pulso_barras_bases`), con filtros, pesos y grupos excluidos. Sin él, el
# inspector no mostraba los grupos de la agrupada (QA visual, F6).

.ac_inst <- function() {
  lk <- c("1", "2", "3", "4", "5", "9")
  survey <- data.frame(type = c("select_one lk", "select_one sx"), name = c("q1", "sexo"), label = c("Reglamentos", "Sexo"),
                       stringsAsFactors = FALSE)
  choices <- data.frame(list_name = c(rep("lk", 6), rep("sx", 3)), name = c(lk, "1", "2", "3"),
                        label = c("Muy en desacuerdo", "En desacuerdo", "Ni uno ni otro", "De acuerdo", "Muy de acuerdo",
                                  "No sabe", "Hombre", "Mujer", "Otro"), stringsAsFactors = FALSE)
  x <- tempfile(fileext = ".xlsx")
  openxlsx::write.xlsx(list(survey = survey, choices = choices), x)
  suppressMessages(reporte_instrumento(x))
}

.ac_data <- function(pesos = FALSE) {
  set.seed(3)
  d <- data.frame(q1 = sample(c("1", "2", "3", "4", "5", "9"), 90, TRUE),
                  sexo = c(sample(c("1", "2"), 84, TRUE), rep("3", 4), NA, NA), stringsAsFactors = FALSE)
  if (isTRUE(pesos)) { set.seed(5); d$peso <- round(runif(nrow(d), 0.3, 2.5), 3) }
  d
}

.ac_fuentes <- function(pesos = FALSE) list(data_sources = list(doc = .ac_data(pesos)), inst_sources = list(doc = .ac_inst()))

.ac_render <- function(args, src) {
  el <- .rebuild_graf(list(graficador = "p_barras_agrupadas", args = args))
  out <- suppressMessages(suppressWarnings(reporte_ppt_plan(
    data = src$data_sources, instrumento = src$inst_sources,
    plan = p_plan(slides = list(p_slide_1_grafico(el, titulo = "Grupos"))), solo_lista = TRUE,
    build_render_meta = TRUE, mensajes_progreso = FALSE)))
  list(p = out$rendered[[1]], base = (out$render_meta[[1]] %||% list())$base %||% "")
}

.ac_det <- function(args, src) suppressMessages(.graficos_cifras_de_grafico("p_barras_agrupadas", args, src, detalle = TRUE))

.ac_grupos <- function(det) stats::setNames(vapply(det$filas, function(f) f$base$n_casos, 0), vapply(det$filas, `[[`, "", "clave"))

test_that("agrupada con cruce: una fila por grupo con el n que dibuja la lámina", {
  skip_if_not_installed("openxlsx"); skip_if_not_installed("ggplot2")
  src <- .ac_fuentes()
  args <- list(var = "doc$q1", cruces = "doc$sexo")
  r <- .ac_det(args, src)
  lam <- .ac_render(args, src)
  det <- r$detalle
  expect_identical(det$forma, "categorica")
  expect_identical(det$version, "agrupadas_cruce/1")
  expect_false(any(grepl("no publica el detalle", unlist(r$avisos))))
  # Paridad con el render: los grupos, en su orden, y sus casos.
  expect_identical(names(.ac_grupos(det)), attr(lam$p, "pulso_barras_series", exact = TRUE))
  expect_identical(unname(.ac_grupos(det)), as.numeric(attr(lam$p, "pulso_barras_bases", exact = TRUE)))
  d <- .ac_data()
  expect_identical(unname(.ac_grupos(det)), as.numeric(as.vector(table(factor(d$sexo, levels = c("1", "2", "3"))))))
  expect_false(any(vapply(det$filas, `[[`, TRUE, "es_total")))
  expect_identical(det$base$texto, lam$base)
  expect_true(is.na(det$base$n_casos))   # las bases de los grupos difieren
  # Lo que consume el inspector: al menos dos filas que no son el total, con su n.
  expect_gte(length(det$filas), 2L)
  # Una sola serie sigue con la especificación de siempre.
  uno <- .ac_det(list(var = "doc$q1"), src)$detalle
  expect_identical(uno$version, "categorica/1")
})

test_that("agrupada con cruce: el grupo excluido sale del detalle, como de la lámina", {
  skip_if_not_installed("openxlsx"); skip_if_not_installed("ggplot2")
  src <- .ac_fuentes()
  args <- list(var = "doc$q1", cruces = "doc$sexo", excluir_grupos = list("3"))
  det <- .ac_det(args, src)$detalle
  lam <- .ac_render(args, src)
  expect_identical(names(.ac_grupos(det)), c("Hombre", "Mujer"))
  expect_identical(names(.ac_grupos(det)), attr(lam$p, "pulso_barras_series", exact = TRUE))
  expect_identical(unname(.ac_grupos(det)), as.numeric(attr(lam$p, "pulso_barras_bases", exact = TRUE)))
  expect_identical(det$base$texto, lam$base)
  expect_identical(det$base$texto, sprintf("Base: %d", sum(.ac_data()$sexo %in% c("1", "2"))))
})

test_that("agrupada con cruce y pesos: el n de cada grupo son sus casos, los de la lámina", {
  skip_if_not_installed("openxlsx"); skip_if_not_installed("ggplot2")
  src <- .ac_fuentes(pesos = TRUE)
  args <- list(var = "doc$q1", cruces = "doc$sexo", filtros = list(q1 = c("1", "2", "3", "4", "5")))
  det <- .ac_det(args, src)$detalle
  lam <- .ac_render(args, src)
  expect_identical(unname(.ac_grupos(det)), as.numeric(attr(lam$p, "pulso_barras_bases", exact = TRUE)))
  d <- .ac_data(pesos = TRUE); m <- d$q1 != "9"
  expect_identical(unname(.ac_grupos(det)), as.numeric(as.vector(table(factor(d$sexo[m], levels = c("1", "2", "3"))))))
  expect_true(all(is.na(vapply(det$filas, function(f) f$base$n_ponderado, 0))))   # no se recalcula aparte
  expect_identical(det$base$texto, lam$base)
})

test_that("sin grupos no hay detalle de cruce", {
  expect_null(.cifras_detalle_agrupadas_cruce(structure(list(), pulso_barras_series = "Total")))
  expect_null(.cifras_detalle_agrupadas_cruce(structure(list(), class = "x")))
})

test_that("agrupada con cruce: dos grupos con el mismo rótulo conservan cada uno su n (por posición, B6)", {
  p <- structure(list(), pulso_barras_series = c("Otro", "Mujer", "Otro"), pulso_barras_cruce = "doc$sexo",
                 pulso_barras_bases = c(Otro = 10, Mujer = 40, Otro = 4))
  det <- .cifras_detalle_agrupadas_cruce(p, "Base: 54")
  expect_identical(vapply(det$filas, function(f) f$base$n_casos, 0), c(10, 40, 4))
  expect_identical(vapply(det$filas, `[[`, "", "rotulo"), c("Otro", "Mujer", "Otro"))
  # Si las bases no traen una por grupo, se buscan por rótulo y se avisa.
  q <- structure(list(), pulso_barras_series = c("Hombre", "Mujer"), pulso_barras_cruce = "doc$sexo",
                 pulso_barras_bases = c(Mujer = 40))
  expect_message(d2 <- .cifras_detalle_agrupadas_cruce(q), "busca por rótulo")
  expect_identical(vapply(d2$filas, function(f) f$base$n_casos, 0), c(NA_real_, 40))
})
