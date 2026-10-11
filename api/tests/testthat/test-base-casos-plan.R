source("setup-load-all.R")

# Contrato base-sin-ponderar F6, §2.2–§2.7 y §6: la «Base: N» de las láminas (PPT y Word, que comparten render_meta)
# es casos sin ponderar; los porcentajes siguen ponderados. Fixture: 20 casos peso 2.25, 10 peso 1, 2 peso 0 y 3
# huérfanos (peso NA) => suma de pesos 55, casos 30.

.bcp_choices <- function() {
  data.frame(list_name = "acuerdo", name = c("1", "2", "3", "4", "9"),
             label = c("Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo", "SIN INF"),
             stringsAsFactors = FALSE)
}
.bcp_inst <- function() {
  list(survey = data.frame(name = "p1", type = "select_one acuerdo", list_name = "acuerdo", stringsAsFactors = FALSE),
       choices = .bcp_choices(), orders_list = NULL)
}
.bcp_pesos <- function() c(rep(2.25, 20), rep(1, 10), 0, 0, rep(NA_real_, 3))
.bcp_data <- function(peso = .bcp_pesos()) {
  d <- data.frame(p1 = c(rep("4", 12), rep("3", 8), rep("4", 4), rep("9", 6), "4", "3", rep("4", 3)),
                  stringsAsFactors = FALSE)
  if (!is.null(peso)) d$peso <- peso
  d
}
.bcp_meta <- function(data, instrumento, plan, presets = NULL) {
  reporte_ppt_plan(data = data, instrumento = instrumento, plan = plan, presets = presets,
                   solo_lista = TRUE, build_render_meta = TRUE, mensajes_progreso = FALSE)$render_meta
}
.bcp_bases <- function(meta) vapply(meta, function(e) e$base %||% NA_character_, character(1))
.bcp_plan <- function(grafico) list(diapo_001 = p_slide_1_grafico(grafico = grafico))
.bcp_apiladas <- function(overrides = list()) {
  .bcp_plan(p_barras_multiapiladas(modo = "var", vars = "p1", overrides = overrides))
}

test_that("la base de lámina es casos (30), no la suma de pesos (55)", {
  meta <- .bcp_meta(.bcp_data(), .bcp_inst(), .bcp_apiladas())
  expect_identical(.bcp_bases(meta), "Base: 30")
})

test_that("test 1: sin pesos la base y la nota son byte a byte las de pesos 1", {
  sin <- .bcp_meta(.bcp_data(peso = NULL), .bcp_inst(), .bcp_apiladas())
  uno <- .bcp_meta(.bcp_data(peso = 1), .bcp_inst(), .bcp_apiladas())
  expect_identical(.bcp_bases(sin), "Base: 35")
  expect_identical(.bcp_bases(uno), .bcp_bases(sin))
  # Las demás notas del render_meta tampoco cambian.
  expect_identical(lapply(sin, `[[`, "nota"), lapply(uno, `[[`, "nota"))
})

test_that("test 8: la exclusión en select_one toma los casos de lo que queda, no el Total", {
  meta <- .bcp_meta(.bcp_data(), .bcp_inst(), .bcp_apiladas(list(excluir_opciones = "SIN INF")))
  # Válidos tras excluir SIN INF: 20 (peso 2.25) + 4 (peso 1) = 24 casos (los 6 SIN INF tienen peso 1).
  expect_identical(.bcp_bases(meta), "Base: 24")

  # Helper: la exclusión recalcula AMBAS cifras.
  tab <- freq_table_spss(.bcp_data(), "p1", casos = TRUE)
  tab2 <- .reporte_plan_filter_freq_options(.reporte_plan_prepare_freq_options(tab), "9")
  b <- .plan_base_de_tab(tab, tab2, FALSE)
  expect_identical(as.integer(b$n_casos), 24L)
  expect_equal(b$n, 49)
  # select_multiple: el Total manda aunque se oculte una opción.
  b_sm <- .plan_base_de_tab(tab, tab2, TRUE)
  expect_identical(as.integer(b_sm$n_casos), 30L)
})

test_that("test 7: con n ponderado fraccionario la base sale entera y en casos", {
  # 40 casos válidos con pesos que suman 47.6: el mutante `as.integer(n)` daría «Base: 47».
  d <- data.frame(p1 = rep(c("3", "4"), 20), peso = c(rep(1.19, 40)), stringsAsFactors = FALSE)
  expect_equal(sum(d$peso), 47.6)
  meta <- .bcp_meta(d, .bcp_inst(), .bcp_apiladas())
  expect_identical(.bcp_bases(meta), "Base: 40")
})

test_that("test 12: denominador cero no escribe «Base: 0»", {
  d <- .bcp_data(peso = 0)
  meta <- .bcp_meta(d, .bcp_inst(), .bcp_apiladas())
  bases <- .bcp_bases(meta)
  expect_false(any(grepl("Base: 0", bases, fixed = TRUE)))
})

test_that("test 9/I7: la no-respuesta se mide contra un universo en casos (peso > 0)", {
  d <- data.frame(p1 = c(rep("4", 30), rep("3", 10), rep("1", 4), rep(NA_character_, 8)),
                  peso = c(rep(2, 40), rep(1.75, 4), rep(0.625, 8)), stringsAsFactors = FALSE)
  # Suma de pesos 92 (el mutante «universo ponderado» daría 92 y no 52).
  expect_identical(.reporte_plan_base_universo(d), 52)
  expect_true(.reporte_plan_base_na_reducida(44, d))
  expect_false(.reporte_plan_base_na_reducida(52, d))
  # Pesos 0 no cuentan en el universo.
  d0 <- d; d0$peso[1:2] <- 0
  expect_identical(.reporte_plan_base_universo(d0), 50)
})

test_that("test 10/I6: la base multibase se prorratea en casos por fuente", {
  docentes <- data.frame(p1 = rep(c("3", "4"), 26), peso = rep(c(0.5, 1.7), 26), stringsAsFactors = FALSE)
  estudiantes <- data.frame(p1 = rep(c("3", "4"), 86), peso = rep(c(2, 0.25), 86), stringsAsFactors = FALSE)
  inst <- list(docentes = .bcp_inst(), estudiantes = .bcp_inst())
  meta <- .bcp_meta(
    list(docentes = docentes, estudiantes = estudiantes), inst,
    .bcp_plan(p_barras_multiapiladas(modo = "var_cruce", vars = list(acuerdo = c("docentes$p1", "estudiantes$p1"))))
  )
  # Ponderado diría «57.2 docentes y 193.5 estudiantes».
  expect_identical(.bcp_bases(meta), "Base: 52 docentes y 172 estudiantes")
})

test_that("la tabla ancha lleva N_casos / nc_i y los base_args los declaran al graficador", {
  tab <- freq_table_spss(.bcp_data(), "p1", casos = TRUE)
  prep <- .reporte_plan_prepare_freq_options(tab, incluir_sin_n = TRUE)
  row <- tibble::tibble(categoria = "x", N = 55, n_1 = 1, n_2 = 2)
  row <- .plan_fila_casos(row, prep, c("4", "3"), 30)
  expect_identical(row$N_casos, 30)
  d <- .bcp_data(); ok <- .peso_vec(d) > 0
  expect_equal(c(row$nc_1, row$nc_2), c(sum(d$p1 == "4" & ok), sum(d$p1 == "3" & ok)))
  expect_identical(c(row$nc_1, row$nc_2), c(16, 8))

  args <- .plan_args_casos(list(data = row, var_n = "N", cols_n = c(pct_1 = "n_1", pct_2 = "n_2")))
  expect_identical(args$var_n_casos, "N_casos")
  expect_identical(args$cols_n_casos, c(pct_1 = "nc_1", pct_2 = "nc_2"))
  # Sin columnas gemelas no se declaran (el graficador sigue con var_n).
  sin <- .plan_args_casos(list(data = data.frame(N = 1, n_1 = 1), var_n = "N", cols_n = c(pct_1 = "n_1")))
  expect_null(sin$var_n_casos); expect_null(sin$cols_n_casos)
  expect_identical(.plan_col_casos(c("N", "n", "n_3", "otro")), c("N_casos", "n_casos", "nc_3", "otro_casos"))
})

test_that("el render pasa var_n_casos / cols_n_casos al graficador con la tabla ancha en casos", {
  capt <- new.env()
  testthat::local_mocked_bindings(
    graficar_barras_apiladas = function(data, var_n = NULL, var_n_casos = NULL, cols_n = NULL,
                                        cols_n_casos = NULL, ...) {
      capt$data <- data; capt$var_n_casos <- var_n_casos; capt$cols_n_casos <- cols_n_casos
      ggplot2::ggplot()
    }
  )
  invisible(.bcp_meta(.bcp_data(), .bcp_inst(), .bcp_apiladas()))
  expect_identical(capt$var_n_casos, "N_casos")
  expect_true(all(unname(capt$cols_n_casos) %in% names(capt$data)))
  expect_identical(capt$data$N_casos, 30)
  expect_equal(capt$data$N, 55)
  expect_equal(sum(unlist(capt$data[unname(capt$cols_n_casos)])), 30)
})

test_that("agrupadas con cruce: base por grupo en casos («Grupo (n)») y bases del atributo en casos", {
  d <- .bcp_data()
  d$g <- rep(c("A", "B"), length.out = nrow(d))
  inst <- .bcp_inst()
  inst$survey <- rbind(inst$survey, data.frame(name = "g", type = "select_one gr", list_name = "gr"))
  inst$choices <- rbind(inst$choices, data.frame(list_name = "gr", name = c("A", "B"), label = c("A", "B")))
  out <- reporte_ppt_plan(
    data = d, instrumento = inst, mensajes_progreso = FALSE, solo_lista = TRUE, build_render_meta = TRUE,
    plan = .bcp_plan(p_barras_agrupadas("p1", overrides = list(cruces = "g", base_por_grupo = TRUE)))
  )
  p <- out$rendered[[1]]
  bases <- attr(p, "pulso_barras_bases")
  esperado <- tapply(.peso_vec(d) > 0 & !is.na(d$p1), d$g, sum)
  expect_equal(unname(bases), as.numeric(esperado[c("A", "B")]))
  expect_match(attr(p, "pulso_barras_base_caption"), sprintf("A (%d) y B (%d)", esperado[["A"]], esperado[["B"]]), fixed = TRUE)
})

.bcp_dim <- function() {
  dat <- data.frame(
    p1 = c("5", "4", "5", "4", "5", "4", "3", "5"),
    p2 = c("4", "4", "5", "3", "5", "4", "3", "4"),
    sexo = c("H", "H", "H", "M", "M", "M", "M", "M"),
    peso = c(5, 5, 5, 0.5, 0.5, 0.5, 0.5, 0),
    stringsAsFactors = FALSE
  )
  inst <- list(
    survey = data.frame(name = c("p1", "p2", "sexo"), type = c("select_one sat", "select_one sat", "select_one sx"),
                        list_name = c("sat", "sat", "sx"), label = c("P1", "P2", "Sexo"), stringsAsFactors = FALSE),
    choices = data.frame(list_name = c(rep("sat", 5), "sx", "sx"), name = c(as.character(1:5), "H", "M"),
                         label = c(as.character(1:5), "Hombre", "Mujer"), stringsAsFactors = FALSE),
    orders_list = NULL
  )
  d1 <- reporte_dimensiones(data = dat, instrumento = inst, vars = c("p1", "p2"), prefijo = "r100_",
                            reemplazar = FALSE, orden_por_lista = list(sat = as.character(1:5)))
  d2 <- reporte_dimensiones_indices(
    data = d1,
    subindices = list(subindice("s1", "Atencion", "r100_p1"), subindice("s2", "Canales", "r100_p2")),
    indices = list(indice("global", "Indice global", c("s1", "s2")))
  )
  list(data = d2, inst = inst)
}

test_that("dimensiones: payload con base_casos (peso > 0) sin tocar la base ponderada que ordena (S-e)", {
  fx <- .bcp_dim()
  ctx <- .dim_build_context(data = fx$data, instrumento = fx$inst)
  pl <- .dim_build_payload(ctx, modo = "general", objetivo = "Indice global", cruce = "sexo", incluir_total = TRUE)
  expect_identical(pl$base_universe_casos, 7)
  expect_equal(pl$base_universe, 17)
  sc <- pl$score_plot
  b <- unique(sc[, c("grupo", "base", "base_casos")])
  expect_equal(b$base_casos[b$grupo == "Total"], 7)
  expect_equal(b$base_casos[b$grupo == "Hombre"], 3)
  expect_equal(b$base_casos[b$grupo == "Mujer"], 4)
  # Orden por base PONDERADA (Hombre 15 > Mujer 2), aunque en casos Mujer tenga más.
  expect_identical(pl$group_order, c("Total", "Hombre", "Mujer"))
  # El heatmap escribe los casos.
  h <- preparar_heatmap_dim(pl)
  expect_equal(h$columnas$n[h$columnas$rotulo == "Mujer"], 4)
  expect_identical(.plan_casos_de_pesos(c(1, 0, NA, 2)), 2)
})

test_that("dimensiones: n_respondieron excluye filas con peso 0", {
  fx <- .bcp_dim()
  ctx <- .dim_build_context(data = fx$data, instrumento = fx$inst)
  pl <- .dim_build_payload(ctx, modo = "general", objetivo = "Indice global", cruce = "sexo", incluir_total = TRUE)
  args <- list(data = fx$data, instrumento = fx$inst, cruce = "sexo")
  n <- .dim_n_respondieron(args, pl, weight_col = ctx$weight_col)
  expect_equal(n[["Total"]], 7)
  expect_equal(n[["Mujer"]], 4)
  # Sin columna de peso declarada cuenta todas las filas (paridad histórica).
  expect_equal(.dim_n_respondieron(args, pl)[["Total"]], 8)
})
