# El reporte de Muestra general no afirma métodos de aulas (L26 del loop de
# mejoras, 2026-09-27). Con un estratificado por regiones sorteado con MAS
# dentro de cada estrato, el reporte publicaba la sección de efectividad de
# cada facultad, un sustento de aulas (curso-horario, cube, PISA) y «el sorteo
# se ejecuta con sampling::samplecube, BalancedSampling…», nada de lo cual se
# usó; y rotulaba el método «Aleatorio simple sin reemplazo» sin decir que era
# dentro de cada estrato.

.rg_estudio <- function() {
  set.seed(4)
  marco <- data.frame(codigo = sprintf("H%04d", 1:600), zona = sample(c("Norte", "Sur"), 600, TRUE))
  comp <- calc_muestra_normalize_componente(list(id = "c1", actor = "Hogares", actor_id = "h",
    tecnica = "prob_estratificado",
    parametros = list(e = .06, tasa_respuesta = .8, oversample_pct = 0, deff = 1, n_minimo_estrato = 0L)))
  est <- calc_muestra_normalize_estudio(list(componentes = list(comp)))
  dec <- calc_muestra_general_declarar_marco(est, NULL, "c1", marco, "f1",
                                            columnas = list(id = "codigo", estrato = "zona"))
  dec$estudio$componentes[[1]]$resultado <- calc_muestra_calcular_componente(dec$componente)
  sel <- calc_muestra_general_seleccionar(dec$estudio, dec$estado, "c1", marco, semilla = 5L)
  list(estudio = dec$estudio, general = calc_muestra_general_resumen(sel$estado))
}

test_that("L26: un estudio sin aulas no es de aulas; uno con conglomerados o tasas por facultad, sí", {
  x <- .rg_estudio()
  expect_false(.cm_reporte_tiene_aulas(x$estudio, NULL))
  expect_true(.cm_reporte_tiene_aulas(x$estudio, list(algo = 1)))
  cong <- list(componentes = list(calc_muestra_normalize_componente(list(tecnica = "prob_conglomerado_multietapico"))))
  expect_true(.cm_reporte_tiene_aulas(cong, NULL))
})

test_that("L26: el resumen del sorteo trae el método rotulado dentro de cada estrato", {
  x <- .rg_estudio()
  expect_identical(x$general$corridas$c1$metodo_rotulo,
                   "Muestreo aleatorio simple sin reemplazo dentro de cada estrato (2 estratos)")
})

test_that("L26: el reporte de un estudio sin aulas no publica métodos de aulas (Quarto real)", {
  skip_if_not(nzchar(Sys.which("quarto")) && requireNamespace("quarto", quietly = TRUE), "sin quarto")
  skip_on_cran()
  x <- .rg_estudio()
  out <- tempfile(fileext = ".html")
  withr::defer(unlink(out))
  reporte_calc_muestra(x$estudio, out, formato = "html", quiet = TRUE, general = x$general)
  texto <- paste(readLines(out, warn = FALSE), collapse = "\n")
  expect_false(grepl("efectividad esperada de cada facultad", texto, fixed = TRUE))
  expect_false(grepl("samplecube", texto, fixed = TRUE))
  expect_false(grepl("curso-horario como unidad", texto, fixed = TRUE))
  expect_false(grepl("Cuotas operativas calculadas", texto, fixed = TRUE))
  expect_true(grepl("dentro de cada estrato (2 estratos)", texto, fixed = TRUE))
})

test_that("L26: un estudio de aulas conserva su sustento y su sección de efectividad (Quarto real)", {
  skip_if_not(nzchar(Sys.which("quarto")) && requireNamespace("quarto", quietly = TRUE), "sin quarto")
  skip_on_cran()
  comp <- calc_muestra_normalize_componente(list(id = "a1", actor = "Estudiantes", actor_id = "e",
    tecnica = "prob_conglomerado_multietapico",
    marco = list(universo_bruto = 5000L, marco_validado = 5000L, marco_contactable = 5000L, estado = "validado")))
  comp$resultado <- calc_muestra_calcular_componente(comp)
  out <- tempfile(fileext = ".html")
  withr::defer(unlink(out))
  reporte_calc_muestra(calc_muestra_normalize_estudio(list(componentes = list(comp))), out,
                       formato = "html", quiet = TRUE)
  texto <- paste(readLines(out, warn = FALSE), collapse = "\n")
  expect_true(grepl("efectividad esperada de cada facultad", texto, fixed = TRUE))
  expect_true(grepl("samplecube", texto, fixed = TRUE))
  expect_true(grepl("evaluación educativa", texto, fixed = TRUE))
})
