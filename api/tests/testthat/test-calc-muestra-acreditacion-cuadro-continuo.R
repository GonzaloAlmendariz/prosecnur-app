# Cuadro maestro de acreditación con corte por precisión
# (calc_muestra_acreditacion_cuadro.R). El documento PULSO de marzo 2026
# cortaba en N fijo (3000/3001 estudiantes, 250/251 docentes) y fijaba el n
# del otro lado: la muestra de estudiantes BAJABA al cruzar (1 800 → 1 519) y
# docentes quedaban en 150 cuotas sin margen. Decisión de Gonzalo, 2026-09-24:
# «haz lo que estadísticamente sea más válido».

.cuadro_comp <- function(actor, canal, N, meta = NULL) {
  calc_muestra_normalize_componente(list(
    actor_categoria = actor, canal_recojo = canal, meta = meta,
    marco = list(universo_bruto = N, marco_validado = N, marco_contactable = N, estado = "validado")
  ))
}

.cuadro_n <- function(actor, canal, N, meta = NULL) {
  comp <- .cuadro_comp(actor, canal, N, meta)
  c(list(tecnica = comp$tecnica, variable_control = comp$meta$variable_control),
    calc_muestra_calcular_componente(comp))
}

.cuadro_curva <- function(actor, canal, Ns) {
  data.frame(
    N = Ns,
    tecnica = vapply(Ns, function(N) .cuadro_comp(actor, canal, N)$tecnica, ""),
    n = vapply(Ns, function(N) as.integer(.cuadro_n(actor, canal, N)$n_objetivo), 1L)
  )
}

test_that("estudiantes en aulas: la muestra crece con N, sin saltos y con un solo cambio de técnica", {
  curva <- .cuadro_curva("estudiantes", "aula_qr", 1500:4000)
  expect_false(any(diff(curva$n) < 0))
  expect_lte(max(abs(diff(curva$n))), 1L)
  expect_identical(sum(curva$tecnica[-1] != curva$tecnica[-nrow(curva)]), 1L)
  expect_identical(.cuadro_comp("estudiantes", "aula_qr", 1500)$tecnica, "intencion_censal")
  expect_identical(.cuadro_comp("estudiantes", "aula_qr", 3001)$tecnica, "prob_conglomerado_multietapico")
  # El cruce 3000–3001 del documento ya no mueve nada.
  expect_identical(.cuadro_curva("estudiantes", "aula_qr", 3000:3001)$n, c(1519L, 1519L))
})

test_that("estudiantes del lado probabilístico: el margen publicado es el declarado, para todo N", {
  for (N in c(3001, 5000, 20000)) {
    r <- .cuadro_n("estudiantes", "aula_qr", N)
    expect_identical(as.integer(r$n_objetivo),
                     calc_n_muestra(N = N, p = 0.5, z = 1.96, e = 0.025, deff = 2), info = paste("N =", N))
    expect_lte(r$precision_alcanzada, 0.025 + 1e-9)
  }
})

test_that("una meta que el usuario declaró manda sobre la del cuadro", {
  r <- .cuadro_n("estudiantes", "aula_qr", 5000, meta = list(valor = 2000))
  expect_identical(as.integer(r$n_objetivo), 2000L)
})

test_that("docentes: censo mientras la muestra pediría el 60 %, luego MAS a ±5 % con margen", {
  curva <- .cuadro_curva("docentes", "online_email", 150:1200)
  expect_false(any(diff(curva$n) < 0))
  expect_lte(max(abs(diff(curva$n))), 1L)
  expect_identical(sum(curva$tecnica[-1] != curva$tecnica[-nrow(curva)]), 1L)
  expect_identical(.cuadro_comp("docentes", "online_email", 250)$tecnica, "intencion_censal")
  r <- .cuadro_n("docentes", "online_email", 1000)
  expect_identical(r$tecnica, "prob_aleatorio_simple")
  expect_identical(as.integer(r$n_objetivo), calc_n_muestra(N = 1000, p = 0.5, z = 1.96, e = 0.05, deff = 1))
  expect_lte(r$precision_alcanzada, 0.05 + 1e-9)
  # La respuesta se infla con la cobertura observada (60 %) y nunca pasa del marco.
  expect_identical(as.integer(r$n_operativo), as.integer(ceiling(278 / 0.6)))
  expect_lte(as.integer(.cuadro_n("docentes", "online_email", 260)$n_operativo), 260L)
  # La dedicación sigue siendo la variable de control para el monitoreo.
  expect_identical(r$variable_control, "dedicacion_docente")
})

test_that("el punto de cambio es único porque la fracción sin redondear decrece con N", {
  p <- .CM_CUADRO_ESTUDIANTES_AULA
  censo <- vapply(1000:5000, function(N) .cm_cuadro_conviene_censo(N, p), TRUE)
  expect_identical(sum(censo[-1] != censo[-length(censo)]), 1L)
})

test_that("un .pulso con la meta que escribió el cuadro viejo se recalcula con la regla vigente", {
  # Docentes N = 400 guardado antes del ADR 0091: meta 150 cuota sin origen.
  viejo <- .cuadro_n("docentes", "online_email", 400, meta = list(valor = 150, tipo = "cuota"))
  expect_identical(viejo$tecnica, "prob_aleatorio_simple")
  expect_identical(as.integer(viejo$n_objetivo), calc_n_muestra(N = 400, p = .5, z = 1.96, e = .05, deff = 1))
  expect_lte(viejo$precision_alcanzada, 0.05 + 1e-9)
  # Estudiantes guardados con los 1 800 de 7664c5f71.
  est <- .cuadro_n("estudiantes", "aula_qr", 5000, meta = list(valor = 1800))
  expect_identical(as.integer(est$n_objetivo), calc_n_muestra(N = 5000, p = .5, z = 1.96, e = .025, deff = 2))
})

test_that("la meta que tecleó el usuario manda aunque coincida con el valor viejo del cuadro", {
  r <- .cuadro_n("docentes", "online_email", 400, meta = list(valor = 150, tipo = "cuota", origen = "usuario"))
  expect_identical(as.integer(r$n_objetivo), 150L)
})

test_that("la meta que rellena el cuadro se marca y se recalcula en la ida y vuelta", {
  comp <- .cuadro_comp("egresados", "telefonico", 800)
  expect_identical(comp$meta$origen, "cuadro")
  expect_identical(as.integer(comp$meta$valor), 150L)
  # Cambia N: la meta del cuadro sigue a la regla, no se congela.
  comp$marco$marco_validado <- 100L; comp$marco$universo_bruto <- 100L; comp$marco$marco_contactable <- 100L
  otra <- calc_muestra_normalize_componente(comp)
  expect_identical(otra$tecnica, "intencion_censal")
  expect_identical(as.integer(otra$meta$valor), 0L)
})
