# E5: el sorteo por actor de Acreditación. Qué significa «sortear» lo decide
# la técnica del actor: probabilística → sorteo con π; cobertura censal →
# marco entero en orden aleatorio de contacto (π = 1); cuotas → no hay π.

.acr_marco <- function(N = 180L) {
  set.seed(8)
  data.frame(correo = sprintf("persona%04d@uni.edu.pe", sample.int(9999L, N)),
             carrera = sample(c("Contabilidad", "Economía"), N, TRUE),
             stringsAsFactors = FALSE)
}

.acr_estudio <- function() {
  calc_muestra_normalize_estudio(list(macro_familia = "acreditacion",
                                      componentes = .cm_iniciar_acreditacion()$componentes))
}

.acr_id <- function(est, actor_id) {
  est$componentes[[which(vapply(est$componentes, `[[`, "", "actor_id") == actor_id)]]$id
}

test_that("un actor de cobertura censal sale entero, en orden aleatorio de contacto y con π = 1", {
  est <- .acr_estudio()
  cid <- .acr_id(est, "docentes")
  m <- .acr_marco()
  dec <- calc_muestra_general_declarar_marco(est, NULL, cid, m, "f1", columnas = list(id = "correo", estrato = "carrera"))
  comp <- dec$componente
  expect_identical(comp$marco$marco_validado, 180L)
  sel <- calc_muestra_general_seleccionar(dec$estudio, dec$estado, cid, m, semilla = 4L)
  cr <- sel$corrida
  expect_identical(cr$corrida$modalidad, "censo")
  expect_identical(cr$corrida$n_titulares, 180L)
  expect_true(all(cr$unidades$pi == 1))
  # El orden de contacto es aleatorio (no el del archivo) y reproducible.
  a_orden <- cr$unidades$id[order(cr$unidades$estrato, cr$unidades$orden)]
  sel2 <- calc_muestra_general_seleccionar(dec$estudio, dec$estado, cid, m, semilla = 4L)
  expect_identical(sel2$corrida$unidades, cr$unidades)
  expect_false(identical(a_orden, sort(a_orden)))
})

test_that("un actor probabilístico de acreditación sortea como Muestra general", {
  est <- .acr_estudio()
  cid <- .acr_id(est, "egresados")
  i <- which(vapply(est$componentes, `[[`, "", "id") == cid)
  est$componentes[[i]]$tecnica <- "prob_aleatorio_simple"
  est$componentes[[i]]$actor_categoria <- "otros"   # sin inferencia: técnica elegida a mano
  est$componentes[[i]] <- calc_muestra_normalize_componente(est$componentes[[i]])
  m <- .acr_marco(N = 400L)
  dec <- calc_muestra_general_declarar_marco(est, NULL, cid, m, "f1", columnas = list(id = "correo"))
  sel <- calc_muestra_general_seleccionar(dec$estudio, dec$estado, cid, m, semilla = 2L)
  expect_identical(sel$corrida$corrida$modalidad, "probabilistica")
  n_campo <- calc_muestra_calcular_componente(dec$componente)$n_operativo
  expect_identical(sel$corrida$corrida$n_titulares, as.integer(n_campo))
  expect_true(all(sel$corrida$unidades$pi < 1))
})

test_that("un actor por cuotas no se sortea: no hay π que publicar", {
  est <- .acr_estudio()
  i <- 1L
  est$componentes[[i]]$tecnica <- "no_prob_cuotas"
  est$componentes[[i]]$actor_categoria <- "otros"
  est$componentes[[i]] <- calc_muestra_normalize_componente(est$componentes[[i]])
  cid <- est$componentes[[i]]$id
  m <- .acr_marco(N = 50L)
  dec <- calc_muestra_general_declarar_marco(est, NULL, cid, m, "f1", columnas = list(id = "correo"))
  err <- tryCatch(calc_muestra_general_seleccionar(dec$estudio, dec$estado, cid, m), api_error = function(e) e)
  expect_identical(err$code, "E_CALC_MUESTRA_GENERAL_TECNICA")
  expect_match(err$message, "no_prob_cuotas")
})
