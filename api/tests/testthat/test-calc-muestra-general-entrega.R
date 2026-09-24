# Entrega del sorteo de Muestra general (ADR 0090, E6): la memoria de cálculo
# sustituida cuadra con lo que publicó el motor, y el libro lleva π completas.

.ge_comp <- function(N = 5000L, tecnica = "prob_estratificado", rr = 0.75, e = 0.04) {
  calc_muestra_normalize_componente(list(
    id = "cmp-e", actor = "Hogares", actor_id = "hogares", tecnica = tecnica, origen_tamano = "formula",
    marco = list(universo_bruto = N, marco_validado = N, marco_contactable = N, estado = "validado",
                 estratos = list(list(label = "A", N = as.integer(N * .6)), list(label = "B", N = N - as.integer(N * .6)))),
    parametros = list(z = 1.96, p = 0.5, e = e, deff = 1, tasa_respuesta = rr, oversample_pct = 0.05,
                      n_minimo_estrato = 0L)
  ))
}

test_that("la memoria de cálculo sustituye la fórmula y termina en los n del motor", {
  comp <- .ge_comp()
  res <- calc_muestra_calcular_componente(comp)
  m <- calc_muestra_general_memoria(comp, res)
  expect_identical(nrow(m), 6L)
  # n0 = 1.96² · .25 / .04² = 600.25; con N = 5000 → 536.01 → 537.
  expect_identical(m$resultado[[1]], "600.25")
  expect_match(m$resultado[[2]], "→ 537$")
  expect_identical(as.integer(res$n_teorico), 537L)
  # ⌈537 / .75⌉ = 716; + ⌈716 · .05⌉ = 36 → 752.
  expect_identical(m$resultado[[4]], "716")
  expect_identical(m$resultado[[5]], as.character(as.integer(res$n_operativo)))
  expect_identical(as.integer(res$n_operativo), 752L)
  expect_match(m$sustitucion[[1]], "1.96² · 0.5 · 0.5 · 1 / 0.04²", fixed = TRUE)
})

test_that("el libro trae las cuatro hojas, el listado completo y π sin redondear", {
  testthat::skip_if_not_installed("openxlsx")
  set.seed(3)
  marco <- data.frame(codigo = sprintf("H%05d", 1:800), zona = sample(c("A", "B"), 800, TRUE),
                      stringsAsFactors = FALSE)
  comp <- .ge_comp(N = 800L, e = 0.07)
  res <- calc_muestra_calcular_componente(comp)
  s <- calc_muestra_general_sortear(marco, list(id = "codigo", estrato = "zona"), "mas",
                                    n = res$n_operativo, semilla = 11L, reservas_por_estrato = 4L)
  corrida <- c(s, list(n_fuente = res$n_operativo, sorteado_at = "2026-09-24T00:00:00Z"))
  path <- tempfile(fileext = ".xlsx")
  withr::defer(unlink(path))
  calc_muestra_general_exportar_workbook(corrida, list(file_id = "f1", hoja = "padron",
                                         columnas = list(id = "codigo", estrato = "zona", tamano = "")),
                                         comp, res, path)
  expect_identical(openxlsx::getSheetNames(path), c("Corrida", "Memoria de cálculo", "Estratos", "Listado"))
  listado <- openxlsx::read.xlsx(path, sheet = "Listado", check.names = FALSE)
  expect_identical(nrow(listado), nrow(s$unidades))
  expect_identical(sum(listado$Estado == "Titular"), s$corrida$n_titulares)
  tit <- listado[listado$Estado == "Titular", ]
  esperado <- s$unidades$pi[match(tit$Id, s$unidades$id)]
  expect_equal(tit[["π"]], esperado, tolerance = 1e-12)
  ficha <- openxlsx::read.xlsx(path, sheet = "Corrida", colNames = FALSE, skipEmptyRows = TRUE)
  expect_true(s$corrida$run_id %in% ficha[[2]])
  expect_true(s$corrida$marco_hash %in% ficha[[2]])
})

test_that("fuera de los diseños de elementos la memoria no inventa la fórmula", {
  comp <- calc_muestra_normalize_componente(list(tecnica = "prob_conglomerado_multietapico"))
  m <- calc_muestra_general_memoria(comp, list())
  expect_identical(m$paso, "Memoria no disponible")
})
