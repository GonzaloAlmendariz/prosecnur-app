source("setup-load-all.R")

# Contrato base-sin-ponderar F6 (docs/qa/contrato-base-sin-ponderar-graficos-f6-2026-10-11.md), §2.1 y §6:
# `freq_table_spss(..., casos = TRUE)` añade `n_casos` (entero, filas con peso > 0) sin tocar `n` ni `pct`, que siguen
# ponderados. El default (`casos = FALSE`) es el de los tabulados XLSX y queda idéntico (S1).
#
# Fixture del contrato: 20 casos con peso 2.25, 10 con peso 1, 2 con peso 0 y 3 huérfanos (peso NA)
# => n = 20 * 2.25 + 10 = 55 y n_casos = 30.

.bcf_pesos <- function() c(rep(2.25, 20), rep(1, 10), 0, 0, rep(NA_real_, 3))

.bcf_select_one <- function() {
  data.frame(
    p = c(rep("1", 12), rep("2", 8), rep("1", 4), rep("2", 6), "1", "2", rep("1", 3)),
    peso = .bcf_pesos(),
    stringsAsFactors = FALSE
  )
}

test_that("test 2: casos = TRUE da n ponderado 55 y n_casos 30 sobre las mismas filas", {
  tab <- freq_table_spss(.bcf_select_one(), "p", casos = TRUE)
  tot <- tab[tab$Opciones == "Total", ]
  expect_equal(round(tot$n), 55)
  expect_identical(tot$n_casos, 30L)
  # Por categoría: «1» = 12 * 2.25 + 4 = 31 ponderado, 16 casos; «2» = 8 * 2.25 + 6 = 24, 14 casos.
  expect_identical(tab$n_casos[tab$Opciones == "1"], 16L)
  expect_identical(tab$n_casos[tab$Opciones == "2"], 14L)
  expect_equal(tab$n[tab$Opciones == "1"], 31)
  expect_true(is.integer(tab$n_casos))
  # `pct` sigue ponderado (I2).
  expect_equal(tab$pct[tab$Opciones == "1"], 31 / 55)
})

test_that("test 11: huérfanos de repeat (peso NA) y pesos 0 quedan fuera de los casos", {
  d <- .bcf_select_one()
  tab <- freq_table_spss(d, "p", casos = TRUE)
  # Mutante «contar peso 0» daría 32; mutante «n_casos = nrow» daría 35.
  expect_false(tab$n_casos[tab$Opciones == "Total"] %in% c(32L, 35L))
  expect_identical(tab$n_casos[tab$Opciones == "Total"], sum(.peso_vec(d) > 0))
})

test_that("test 1: sin pesos (o pesos 1) n_casos == n y el default no cambia", {
  d <- .bcf_select_one()
  d$peso <- NULL
  con <- freq_table_spss(d, "p", casos = TRUE)
  expect_equal(as.numeric(con$n_casos), con$n)
  d1 <- d; d1$peso <- 1
  expect_equal(as.numeric(freq_table_spss(d1, "p", casos = TRUE)$n_casos), con$n)
  # El default es la tabla histórica: mismas columnas, mismos valores.
  sin <- freq_table_spss(d, "p")
  expect_named(sin, c("Opciones", "n", "pct"))
  expect_identical(con[, c("Opciones", "n", "pct")], sin)
})

test_that("test 4: en select_multiple el Total de casos son personas, no la suma de opciones", {
  sm <- data.frame(
    s = c(rep("a b", 20), rep("a", 10), "b", "a", rep("a b", 3)),
    peso = .bcf_pesos(),
    stringsAsFactors = FALSE
  )
  tab <- freq_table_spss(sm, "s", sm_vars_force = "s", casos = TRUE)
  tot <- tab$n_casos[tab$Opciones == "Total"]
  expect_identical(tot, 30L)
  expect_identical(tab$n_casos[tab$Opciones == "a"], 30L)
  expect_identical(tab$n_casos[tab$Opciones == "b"], 20L)
  expect_false(tot == sum(tab$n_casos[tab$Opciones != "Total"]))

  # Las dummies (var/cod) siguen la misma regla.
  dm <- data.frame(`s/a` = c(rep(1, 30), 0, 1, rep(1, 3)), `s/b` = c(rep(1, 20), rep(0, 10), 1, 0, rep(1, 3)),
                   peso = .bcf_pesos(), check.names = FALSE)
  tdm <- freq_table_spss(dm, "s", sm_vars_force = "s", casos = TRUE)
  expect_identical(tdm$n_casos[tdm$Opciones == "Total"], 30L)
  expect_identical(tdm$n_casos[tdm$Opciones == "b"], 20L)
})

test_that("test 13: mostrar_todo completa la categoría ausente con n_casos = 0 (no NA)", {
  ol <- list(p = list(names = c("1", "2", "3"), labels = c("Uno", "Dos", "Tres")))
  tab <- freq_table_spss(.bcf_select_one(), "p", orders_list = ol, mostrar_todo = TRUE, casos = TRUE)
  expect_true("Tres" %in% tab$Opciones)
  expect_identical(tab$n_casos[tab$Opciones == "Tres"], 0L)
  expect_identical(tab$n_casos[tab$Opciones == "Total"], 30L)
  # El completado mismo pone 0 (no depende del cierre que convierte NA en 0).
  body <- tibble::tibble(Opciones = c("Uno", "Total"), n = c(3, 3), pct = c(1, 1), n_casos = c(2L, 2L))
  comp <- .completar_categorias(body, "p", ol, denom = 3, mostrar_todo = TRUE)
  expect_identical(comp$n_casos[comp$Opciones == "Dos"], 0L)
  # Vacía: la columna existe con tipo entero.
  vacia <- freq_table_spss(data.frame(p = NA_character_, peso = 1), "p", casos = TRUE)
  expect_identical(vacia$n_casos, integer(0))
})

test_that("test 3 (S1): el tabulado XLSX no gana columna y vuelca el n ponderado", {
  skip_if_not_installed("openxlsx")
  d <- .bcf_select_one()
  inst <- list(
    survey = data.frame(name = "p", type = "select_one l", label = "Pregunta", list_name = "l", stringsAsFactors = FALSE),
    choices = data.frame(list_name = "l", name = c("1", "2"), label = c("Uno", "Dos"), stringsAsFactors = FALSE)
  )
  out <- tempfile(fileext = ".xlsx"); on.exit(unlink(out), add = TRUE)
  suppressMessages(reporte_frecuencias(data = d, instrumento = inst, secciones = list(General = "p"),
                                       path_xlsx = out, orden = "original"))
  x <- openxlsx::read.xlsx(out, sheet = 1, colNames = FALSE, skipEmptyRows = TRUE, skipEmptyCols = TRUE)
  celdas <- unlist(lapply(x, as.character), use.names = FALSE)
  celdas <- celdas[!is.na(celdas)]
  nums <- suppressWarnings(as.numeric(celdas)); nums <- nums[is.finite(nums)]
  expect_true(all(c(31, 24, 55) %in% round(nums)))
  # Ni 16/14/30 (casos) ni una cabecera nueva: el XLSX es el histórico.
  expect_false(any(c(16, 14, 30) %in% nums))
  expect_false(any(grepl("casos", celdas, ignore.case = TRUE)))
})

test_that("prepare_freq_options arrastra n_casos y lo suma al deduplicar", {
  tab <- data.frame(Opciones = c("Otro (especifique)", "Otros", "Sí", "Total"),
                    n = c(2.5, 1.5, 6, 10), pct = NA_real_, n_casos = c(2L, 1L, 4L, 7L), stringsAsFactors = FALSE)
  out <- .reporte_plan_prepare_freq_options(tab)
  expect_identical(out$n_casos[out$Opciones == "Otros"], 3L)
  expect_equal(out$n[out$Opciones == "Otros"], 4)
  # Sin la columna, la salida es la histórica (sin columna nueva).
  expect_named(.reporte_plan_prepare_freq_options(tab[, 1:3]), c("Opciones", "n"))
})
