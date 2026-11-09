source("setup-load-all.R")

# B8 (Gonzalo, 2026-11-09): las barras que no son apiladas (agrupadas, simples, categóricas y cobertura) eligen su
# referencia: fondo gris hasta el 100% ("pista") o eje sobrio abajo ("eje"); y la cifra que no cabe a la derecha de la
# barra dentro del área entra a la barra con contraste de al menos 4,5:1.

test_that("el registro ofrece `referencia_barra` en agrupadas, categóricas y cobertura, y no en las apiladas ni las divergentes", {
  for (g in c("p_barras_agrupadas", "p_barras_categoricas", "p_cobertura")) {
    a <- Filter(function(x) identical(x$name, "referencia_barra"), .GRAFICADORES_META[[g]]$args)
    expect_length(a, 1L)
    expect_identical(vapply(a[[1]]$choices, `[[`, "", "value"), c("pista", "eje"))
    expect_null(a[[1]]$default)                 # vacío: cada gráfico, lo de hoy
    expect_identical(isTRUE(a[[1]]$via_overrides), g != "p_cobertura")   # la cobertura lo tiene como formal
  }
  expect_identical(p_cobertura(bases = "a", referencia_barra = "pista")$overrides$referencia_barra, "pista")
  expect_null(p_cobertura(bases = "a", referencia_barra = "otra")$overrides$referencia_barra)
  for (g in character(0)) {
  }
  for (g in c("p_barras_apiladas", "p_barras_multiapiladas", "p_barras_divergentes")) {
    expect_length(Filter(function(x) identical(x$name, "referencia_barra"), .GRAFICADORES_META[[g]]$args), 0L)
  }
})

test_that("`referencia_barra` manda sobre `pista_barras`; sin declarar, lo de hoy", {
  expect_true(.lam_barras_pista_activa(list(pista = "nunca", referencia = "pista")))
  expect_false(.lam_barras_pista_activa(list(pista = "auto", referencia = "eje")))
  expect_true(.lam_barras_pista_activa(list(pista = "auto")))
  expect_false(.lam_barras_pista_activa(list(pista = "nunca")))
  expect_null(.lam_referencia_barra(list(referencia = "otra")))
  # Agrupadas y categóricas la llevan a la espec; la cobertura también, y sin declarar queda NULL (como siempre).
  d <- data.frame(categoria = c("A", "B"), N = 100, pct = c(0.99, 0.4), n = c(99, 40), stringsAsFactors = FALSE)
  e <- attr(graficar_barras_agrupadas(d, "categoria", var_n = "N", cols_porcentaje = "pct", etiquetas_series = c(pct = "P"),
                                      cols_n = c(pct = "n"), referencia_barra = "eje"), "pulso_espec")
  expect_identical(e$referencia, "eje")
  cob <- graficar_cobertura(data.frame(publico = c("Docentes", "Estudiantes"), casos = c(118, 300)), universos = "Docentes: 120; Estudiantes: 310",
                            referencia_barra = "pista")
  expect_identical(attr(cob, "pulso_espec")$referencia, "pista")
  expect_null(attr(graficar_cobertura(data.frame(publico = "Docentes", casos = 10)), "pulso_espec")$referencia)
})

test_that("la cifra entra a la barra sólo si no cabe a la derecha dentro del área, en blanco con contraste de 4,5:1", {
  for (fill in c(.std_color("azul"), unname(.std_paleta("actores")), "#7F7F7F")) {
    expect_gte(.lam_contraste_ratio(.lam_cifra_dentro_color(fill), fill), 4.5)
  }
  expect_identical(.lam_cifra_dentro_color(.std_color("azul")), "#FFFFFF")
  # Sobre un relleno claro el blanco no alcanza: va el color de más contraste.
  expect_false(identical(.lam_cifra_dentro_color("#D9E2F3"), "#FFFFFF"))
  expect_true(.lam_cifra_cabe_fuera(xb = 1, lb = 2, tw = 0.5, x_tope = 4))
  expect_false(.lam_cifra_cabe_fuera(xb = 1, lb = 2.8, tw = 0.5, x_tope = 4))
  lz <- .lam_lienzo()
  expect_true(.lam_cifra_barra(lz, "99%", 1, 2.95, 0, 0.3, 10.5, "#333333", .std_color("azul"), x_tope = 4, w_fuera = 0.7))
  expect_false(.lam_cifra_barra(lz, "40%", 1, 1.2, 0, 0.3, 10.5, "#333333", .std_color("azul"), x_tope = 4, w_fuera = 0.7))
})

test_that("respaldo ggplot de las agrupadas sin columna extra: con 97–100 % la cifra entra a la barra, alineada a su extremo", {
  d <- data.frame(categoria = c("A", "B", "C", "D"), N = 100, pct = c(1, 0.98, 0.97, 0.40), n = c(100, 98, 97, 40), stringsAsFactors = FALSE)
  p <- graficar_barras_agrupadas(d, "categoria", var_n = "N", cols_porcentaje = "pct", etiquetas_series = c(pct = "P"),
                                 cols_n = c(pct = "n"), mostrar_barra_extra = FALSE, orientacion = "horizontal")
  capa <- Filter(function(l) inherits(l$geom, "GeomText") && is.data.frame(l$data) && "hjust_label" %in% names(l$data), p$layers)[[1]]
  dl <- capa$data
  alto <- dl$.valor_plot >= 0.97
  expect_true(all(dl$inside[alto])); expect_true(all(dl$hjust_label[alto] == 1))
  expect_true(all(dl$valor_label[alto] < dl$.valor_plot[alto]))   # dentro, antes del extremo
  expect_false(any(dl$inside[!alto & dl$.valor_plot < 0.5]))
})

test_that("en la lámina nativa, \"eje\" dibuja el eje sobrio y ninguna pista; \"pista\", el fondo gris", {
  skip_if_not_installed("officer")
  d <- data.frame(categoria = c("Sí", "No"), N = 100, pct = c(0.98, 0.02), n = c(98, 2), stringsAsFactors = FALSE)
  forma <- function(ref) {
    e <- attr(graficar_barras_agrupadas(d, "categoria", var_n = "N", cols_porcentaje = "pct", etiquetas_series = c(pct = "P"),
                                        cols_n = c(pct = "n"), referencia_barra = ref), "pulso_espec")
    lz <- .lam_lienzo(); .lam_barras_h(lz, e, 1, 1, 10, 2, 0.4, 0.6)
    paste(unlist(lz$formas), collapse = "")
  }
  ne <- forma("eje"); np <- forma("pista")
  expect_true(grepl("eje:marca", ne, fixed = TRUE)); expect_false(grepl("barra:pista", ne, fixed = TRUE))
  expect_true(grepl("barra:pista", np, fixed = TRUE)); expect_false(grepl("eje:marca", np, fixed = TRUE))
})
