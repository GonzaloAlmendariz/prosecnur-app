# Cuadro maestro de acreditación contra el documento PULSO «Selección de
# muestras de actores» (marzo 2026): estudiantes con N ≥ 3001 en aulas llevan
# la muestra estadística de 1 800, no un n recalculado con ±2,5 % y deff 2 que
# hacía BAJAR la muestra al crecer la población (1 800 con N = 3000, 1 519 con
# N = 3001). Decisión de Gonzalo, 2026-09-24 (P3 del loop de Cálculo de muestra).

.cuadro_comp <- function(actor, canal, N, meta = NULL) {
  calc_muestra_normalize_componente(list(
    actor_categoria = actor, canal_recojo = canal, meta = meta,
    marco = list(universo_bruto = N, marco_validado = N, marco_contactable = N, estado = "validado")
  ))
}

.cuadro_n <- function(actor, canal, N, meta = NULL) {
  comp <- .cuadro_comp(actor, canal, N, meta)
  c(list(tecnica = comp$tecnica), calc_muestra_calcular_componente(comp))
}

test_that("estudiantes en aulas: la muestra no baja al cruzar el corte 3000–3001", {
  antes <- .cuadro_n("estudiantes", "aula_qr", 3000)
  despues <- .cuadro_n("estudiantes", "aula_qr", 3001)
  expect_identical(antes$tecnica, "intencion_censal")
  expect_identical(despues$tecnica, "prob_conglomerado_multietapico")
  expect_identical(as.integer(antes$n_objetivo), 1800L)
  expect_identical(as.integer(despues$n_objetivo), 1800L)
  # Para toda N del lado probabilístico, 1 800: el margen varía, la muestra no.
  for (N in c(3001, 5000, 20000)) {
    r <- .cuadro_n("estudiantes", "aula_qr", N)
    expect_identical(as.integer(r$n_objetivo), 1800L, info = paste("N =", N))
  }
})

test_that("el margen publicado sale de los 1 800 con el deff y crece con N", {
  e5 <- .cuadro_n("estudiantes", "aula_qr", 5000)$precision_alcanzada
  e20 <- .cuadro_n("estudiantes", "aula_qr", 20000)$precision_alcanzada
  esperado <- calc_e_desde_n_muestra(n = 1800, N = 5000, p = 0.5, z = 1.96, deff = 2)
  expect_equal(e5, esperado)
  expect_gt(e20, e5)
})

test_that("una meta que el usuario declaró manda sobre la del cuadro", {
  r <- .cuadro_n("estudiantes", "aula_qr", 5000, meta = list(valor = 2000))
  expect_identical(as.integer(r$n_objetivo), 2000L)
})

test_that("docentes: 60 % hasta 250 y cuotas de 150 desde 251, sin salto", {
  a <- .cuadro_n("docentes", "online_email", 250)
  b <- .cuadro_n("docentes", "online_email", 251)
  expect_identical(a$tecnica, "intencion_censal")
  expect_identical(b$tecnica, "no_prob_cuotas")
  expect_identical(as.integer(a$n_objetivo), 150L)
  expect_identical(as.integer(b$n_objetivo), 150L)
  # A campo nunca más que el marco.
  expect_lte(as.integer(b$n_operativo), 251L)
})
