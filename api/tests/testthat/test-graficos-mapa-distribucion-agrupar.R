source("setup-load-all.R")

# `agrupar_lista` del mapa de distribución (CCSS Perfil 2026, residencia A6_1 + A6_2): la lista suma todos los distritos
# del Callao en una fila «Callao»; el mapa, la base, el total y la fila «otros» no cambian. Fixture sintético con los
# conteos del caso real del Callao (Callao 12, Bellavista 3, Ventanilla 3, La Perla 2, Carmen de la Legua 1).

.mda_fx <- function() {
  lima <- c("San Miguel", "Lince", "Comas", "Chorrillos", "Santiago de Surco", "Extranjero")
  callao <- c("Callao", "Bellavista", "Ventanilla", "La Perla", "Carmen de la Legua Reynoso")
  n_lima <- c(15, 10, 8, 5, 4, 1); n_callao <- c(12, 3, 3, 2, 1)
  dl <- c(rep(as.character(seq_along(lima)), n_lima), rep(NA, sum(n_callao)))
  dc <- c(rep(NA, sum(n_lima)), rep(as.character(seq_along(callao)), n_callao))
  d <- data.frame(dl = dl, dc = dc, stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(name = c("dl", "dc"), type = c("select_one ll", "select_one lc"), list_name = c("ll", "lc"),
                                   label = c("Distrito de Lima", "Distrito del Callao"), stringsAsFactors = FALSE),
               choices = data.frame(list_name = c(rep("ll", length(lima)), rep("lc", length(callao))),
                                    name = c(seq_along(lima), seq_along(callao)), label = c(lima, callao), stringsAsFactors = FALSE),
               orders_list = NULL)
  list(data = d, inst = inst)
}

# El camino del render: `.render_mapa_distribucion` lee las fuentes del marco que lo llama.
.mda_render <- function(fx, el) {
  data_sources <- list(s = fx$data); instrument_sources <- list(s = fx$inst)
  attr(.render_mapa_distribucion(el), "pulso_espec")
}

test_that("la lista suma todos los distritos del Callao en una fila y la ordena por su conteo", {
  fx <- .mda_fx()
  e <- suppressMessages(.mda_render(fx, p_mapa_distribucion("dl", juntar = "dc", agrupar_lista = list(Callao = "dc"))))
  expect_identical(e$lista$nombre[1], "Callao")
  expect_identical(e$lista$n[1], 21L)
  expect_identical(e$lista$pct[1], .mapa_dist_pct(21, e$base))
  expect_false(any(c("Bellavista", "Ventanilla", "La Perla") %in% e$lista$nombre))
  expect_identical(e$lista$nombre[2:3], c("San Miguel", "Lince"))
  expect_identical(e$ranking$nombre[1], "Callao")
  expect_identical(names(e$lista_grupos), "Callao")
  # El color de la fila es el de la clase de su conteo (21 o más).
  expect_identical(e$lista$color[1], e$clases$colores[5])
})

test_that("el mapa no cambia: áreas, colores, clases, leyenda y la fila «otros»", {
  fx <- .mda_fx()
  sin <- suppressMessages(.mda_render(fx, p_mapa_distribucion("dl", juntar = "dc")))
  con <- suppressMessages(.mda_render(fx, p_mapa_distribucion("dl", juntar = "dc", agrupar_lista = list(Callao = "dc"))))
  expect_identical(con$areas, sin$areas)
  expect_identical(con$clases, sin$clases)
  expect_identical(con$leyenda_extras, sin$leyenda_extras)
  expect_identical(con$extra, sin$extra)
  expect_identical(con$base, sin$base)
  expect_identical(sin$areas$n[sin$areas$nombre == "Bellavista"], 3L)   # el distrito sigue pintado con su número
})

test_that("el total cuadra: la lista y la fila «otros» reparten la misma base, con cualquier cupo", {
  fx <- .mda_fx()
  sin <- suppressMessages(.mda_render(fx, p_mapa_distribucion("dl", juntar = "dc")))
  con <- suppressMessages(.mda_render(fx, p_mapa_distribucion("dl", juntar = "dc", agrupar_lista = "Callao | dc")))
  expect_identical(sum(con$lista$n) + sum(con$extra$n), con$base)
  expect_identical(sum(con$lista$n), sum(sin$lista$n))
  expect_identical(con$base, nrow(fx$data))
  for (cupo in c(3L, 4L, 6L, 12L)) {
    f <- .lam_mapa_dist_filas(con, cupo)
    cifra_n <- as.integer(sub(" .*", "", f$cifra))
    expect_identical(sum(cifra_n), con$base, info = paste("cupo", cupo))
    expect_equal(sum(f$frac), 1, info = paste("cupo", cupo))
  }
  # Con el cupo de la lámina, «Otros distritos» ya no se lleva a los del Callao.
  f <- .lam_mapa_dist_filas(con, 5L)
  # Cupo 5 con fila «otros»: Callao, San Miguel, Lince y Comas; a «otros» van Chorrillos, Santiago de Surco y Extranjero.
  expect_identical(f$nombre[1:4], c("Callao", "San Miguel", "Lince", "Comas"))
  expect_match(f$nombre[nrow(f)], "^Otros distritos \\(3\\)$")
})

test_that("sin el argumento, la espec es idéntica a la de hoy", {
  fx <- .mda_fx()
  el <- p_mapa_distribucion("dl", juntar = "dc")
  expect_null(el$agrupar_lista)
  e <- suppressMessages(.mda_render(fx, el))
  carto <- .mapa_distribucion_cartografia("lima_callao")
  filas <- do.call(rbind, lapply(c("dl", "dc"), function(v) .mapa_distribucion_casar(.mapa_distribucion_calcular(fx$data, fx$inst, v), carto, "lima_callao")))
  hoy <- .espec_mapa_distribucion(filas, carto, "lima_callao")
  for (k in setdiff(names(hoy), "carto")) expect_identical(e[[k]], hoy[[k]], info = k)
  expect_null(e$lista_grupos)
  expect_identical(.mapa_dist_agrupar_lista(hoy, filas, list()), hoy)
  expect_identical(e$lista$nombre[1], "San Miguel")   # el Callao distrito suelto, con 12
  expect_identical(e$lista$n[e$lista$nombre == "Callao"], 12L)
})

test_that("agrupar_lista se valida y viaja por el plan JSON; el registro lo describe", {
  expect_error(p_mapa_distribucion("dl", juntar = "dc", agrupar_lista = list(Callao = "otra")), "sólo agrupa preguntas que el mapa lee")
  expect_error(p_mapa_distribucion("dl", agrupar_lista = "Callao dc"), "Rótulo \\| preguntas")
  expect_error(p_mapa_distribucion("dl", juntar = "dc", agrupar_lista = list(A = "dc", B = "dc")), "dos grupos")
  expect_identical(p_mapa_distribucion("s$dl", juntar = "s$dc", agrupar_lista = "Callao | dc")$agrupar_lista, list(Callao = "dc"))
  plan <- .normalize_plan(jsonlite::fromJSON(paste0(
    '{"slides":[{"tipo":"p_slide_1_grafico","payload":{"titulo":"x","grafico":{"graficador":"p_mapa_distribucion",',
    '"args":{"var":"dl","juntar":["dc"],"agrupar_lista":{"Callao":["dc"]}}}}}]}'), simplifyVector = FALSE))
  slide <- .graficos_rebuild_slide_json(plan$slides[[1]])
  expect_identical(slide$slots$plot$agrupar_lista, list(Callao = "dc"))
  arg <- Filter(function(a) identical(a$name, "agrupar_lista"), .graficos_registry_payload()$graficadores[["p_mapa_distribucion"]]$args)
  if (!length(arg)) arg <- Filter(function(a) identical(a$name, "agrupar_lista"),
                                  Filter(function(g) identical(g$name, "p_mapa_distribucion"), .graficos_registry_payload()$graficadores)[[1]]$args)
  expect_length(arg, 1L)
  expect_match(arg[[1]]$descripcion, "El mapa no cambia")
  expect_false(grepl(";|·|—", arg[[1]]$descripcion))
})
