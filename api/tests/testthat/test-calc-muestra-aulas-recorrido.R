# Recorrido del sistemático PPS (regla I20: el orden lo publica R, con test).
#
# El test que autoriza el cambio es el primero: reimplementar la caminata solo
# es aceptable si selecciona EXACTAMENTE lo mismo que `sampling::UPsystematic`.
# Si divergiera, cambiarían las muestras de todos los proyectos que usan este
# engine —y es además el fallback de los demás—, así que la equivalencia se
# comprueba sobre cientos de vectores π aleatorios, no sobre un caso feliz.

test_that("la caminata reproduce sampling::UPsystematic bit a bit", {
  skip_if_not_installed("sampling")
  set.seed(11)
  casos <- lapply(1:200, function(i) {
    n <- sample(4:60, 1)
    mos <- stats::runif(n, 1, 200)
    cuota <- sample(1:max(1, n - 1), 1)
    .cm_aulas_inclusion_probabilities(mos, cuota)
  })

  for (k in seq_along(casos)) {
    pik <- casos[[k]]
    set.seed(4242 + k)
    esperado <- which(as.numeric(sampling::UPsystematic(pik)) > 0)
    set.seed(4242 + k)
    obtenido <- .cm_aulas_recorrido_sistematico(pik)$indices
    expect_identical(obtenido, sort(as.integer(esperado)), info = paste("caso", k))
  }
})

test_that("el recorrido es coherente con la selección que produjo", {
  # No basta con que los números existan: cada marca tiene que caer DENTRO del
  # segmento de la unidad que dice haber elegido, y ninguna unidad no elegida
  # puede contener una marca. Es la comprobación que convierte el recorrido en
  # un hecho verificable y no en una decoración.
  set.seed(7)
  pik <- .cm_aulas_inclusion_probabilities(stats::runif(40, 1, 300), 9)
  set.seed(99)
  out <- .cm_aulas_recorrido_sistematico(pik, ids = paste0("CH-", seq_along(pik)))
  r <- out$recorrido

  expect_true(r$aplicable)
  expect_identical(r$paso, 1)
  expect_gt(r$arranque, 0)
  expect_lt(r$arranque, 1)

  u <- r$unidades
  elegidas <- u[u$seleccionada, , drop = FALSE]
  expect_identical(nrow(elegidas), as.integer(r$n_marcas))

  # Las marcas van en arranque + 0, 1, 2, ... y caen dentro de su segmento.
  expect_equal(elegidas$marca, seq_len(nrow(elegidas)))
  expect_equal(elegidas$marca_posicion, r$arranque + seq_len(nrow(elegidas)) - 1)
  expect_true(all(elegidas$marca_posicion > elegidas$inicio))
  expect_true(all(elegidas$marca_posicion <= elegidas$fin))

  # Y ninguna NO elegida contiene una marca: si la contuviera, el sorteo
  # publicado no sería el ejecutado.
  no_elegidas <- u[!u$seleccionada, , drop = FALSE]
  for (i in seq_len(nrow(no_elegidas))) {
    marcas_dentro <- sum(
      r$arranque + seq(0, r$n_marcas) > no_elegidas$inicio[[i]] &
        r$arranque + seq(0, r$n_marcas) <= no_elegidas$fin[[i]]
    )
    expect_identical(marcas_dentro, 0L)
  }

  # La recta es continua: el fin de cada segmento es el inicio del siguiente.
  expect_equal(u$fin - u$inicio, u$pik)
  expect_equal(utils::head(u$fin, -1), utils::tail(u$inicio, -1))
})

test_that("las certezas entran sin pisar la recta", {
  # π = 1 ocupa un segmento de largo 1: la marca no puede saltarlo. Entra sin
  # sorteo, y por eso NO forma parte de la caminata que se anima.
  pik <- c(1, 0.25, 0.25, 0.25, 0.25)
  set.seed(5)
  out <- .cm_aulas_recorrido_sistematico(pik, ids = paste0("CH-", 1:5))

  expect_true(1L %in% out$indices)
  expect_identical(out$recorrido$certezas, "CH-1")
  # La recta solo lleva las cuatro inciertas.
  expect_identical(nrow(out$recorrido$unidades), 4L)
  expect_false("CH-1" %in% out$recorrido$unidades$classroom_id)
  expect_equal(out$recorrido$largo_recta, 1)
})

test_that("sin unidades inciertas el recorrido se declara inaplicable", {
  # Todo certeza: no hubo caminata que contar. Se declara, no se finge una.
  out <- .cm_aulas_recorrido_sistematico(c(1, 1, 1), ids = c("a", "b", "c"))
  expect_identical(out$indices, 1:3)
  expect_false(out$recorrido$aplicable)
  expect_identical(out$recorrido$motivo, "todas_certeza")
  expect_identical(out$recorrido$certezas, c("a", "b", "c"))
})

test_that("es determinista: misma semilla, misma caminata", {
  pik <- .cm_aulas_inclusion_probabilities(c(10, 20, 30, 40, 50, 60), 3)
  set.seed(20260619)
  a <- .cm_aulas_recorrido_sistematico(pik)
  set.seed(20260619)
  b <- .cm_aulas_recorrido_sistematico(pik)
  expect_identical(a$indices, b$indices)
  expect_identical(a$recorrido$arranque, b$recorrido$arranque)
  expect_equal(a$recorrido$unidades, b$recorrido$unidades)
})

test_that("consume exactamente un numero aleatorio", {
  # Si consumiera otro, todas las selecciones históricas de este engine se
  # correrían: es la condición que hace seguro el reemplazo.
  pik <- .cm_aulas_inclusion_probabilities(stats::runif(25, 1, 100), 6)
  set.seed(1)
  invisible(.cm_aulas_recorrido_sistematico(pik))
  despues_del_recorrido <- stats::runif(1)
  set.seed(1)
  invisible(stats::runif(1, 0, 1))
  despues_de_un_runif <- stats::runif(1)
  expect_identical(despues_del_recorrido, despues_de_un_runif)
})

# ----- El recorrido llega publicado en la selección ---------------------------

.recorrido_frame <- function(n = 40) {
  aula_frame <- data.frame(
    classroom_id = sprintf("CH-%03d", seq_len(n)),
    label = sprintf("Curso %d", seq_len(n)),
    faculty = rep(c("F1", "F2"), length.out = n),
    program = "P", level = "1", schedule = "L 8-10",
    modality = "PRESENCIAL", session_type = "TEORIA",
    teacher = "T", teacher_email = "", course_id = "C", course_name = "C",
    section = "", stratum = rep(c("F1", "F2"), length.out = n),
    size_group = "G2",
    eligible_n = as.integer(20 + (seq_len(n) %% 17) * 3),
    enrolled_total = 40L,
    included = TRUE,
    unique_student_ids = vapply(seq_len(n), function(i) {
      paste0("s", seq(i, i + 9), collapse = "|")
    }, character(1)),
    stringsAsFactors = FALSE
  )
  list(
    schema = "calc_muestra_aulas_frame_v1",
    frame_hash = "hash-recorrido",
    aula_frame = aula_frame,
    population = data.frame(stringsAsFactors = FALSE)
  )
}

test_that("una selección sistemática publica su recorrido por estrato", {
  frame <- .recorrido_frame()
  cfg <- calc_muestra_aulas_normalize_config(list(selector = list(
    seed = 20260619L, n_aulas = 8L, replacement_waves = 0L,
    selector_engine = "sistematico_pps", strata_cols = list("stratum"),
    # Con el descuento ACTIVO el sistemático deja de caminar la recta: sortea
    # de a uno recalculando la MOS neta. La caminata solo existe sin descuento.
    sequential_discount = FALSE,
    simulation_runs = 0L, monte_carlo_n = 0L
  )))
  sel <- calc_muestra_aulas_seleccionar(frame, cfg)
  rec <- sel$recorrido_sorteo

  expect_identical(rec$schema, CALC_MUESTRA_AULAS_RECORRIDO_SCHEMA)
  expect_true(rec$aplicable)
  expect_gt(length(rec$estratos), 0L)

  titulares <- sel$selection[sel$selection$sample_role == "titular", , drop = FALSE]
  elegidas_recorrido <- unlist(lapply(rec$estratos, function(e) {
    c(e$certezas, e$unidades$classroom_id[e$unidades$seleccionada])
  }), use.names = FALSE)

  # El hecho que hace útil el recorrido: describe la MISMA muestra que se
  # entregó. Si divergiera, la animación contaría otro sorteo.
  expect_setequal(elegidas_recorrido, titulares$classroom_id)

  for (e in rec$estratos) {
    expect_gt(e$arranque, 0)
    expect_lt(e$arranque, 1)
    expect_identical(e$paso, 1)
    marcadas <- e$unidades[e$unidades$seleccionada, , drop = FALSE]
    expect_true(all(marcadas$marca_posicion > marcadas$inicio))
    expect_true(all(marcadas$marca_posicion <= marcadas$fin))
  }
})

test_that("el recorrido describe TODOS los titulares, tambien los que no se sortearon", {
  # El defecto que encontro la corrida real: un estrato cuya cuota cubre todas
  # sus unidades retornaba temprano SIN recorrido, asi que la escena describia
  # 189 de 196 titulares y no tenia como notarlo. Ese caso no es una carencia
  # del emisor: es que no hubo sorteo, el mismo estatus que una certeza, y como
  # tal se publica. Con n_aulas alto respecto del marco el caso abunda.
  frame <- .recorrido_frame(n = 12)
  cfg <- calc_muestra_aulas_normalize_config(list(selector = list(
    seed = 20260619L, n_aulas = 10L, replacement_waves = 0L,
    selector_engine = "sistematico_pps", strata_cols = list("stratum"),
    sequential_discount = FALSE, simulation_runs = 0L, monte_carlo_n = 0L
  )))
  sel <- calc_muestra_aulas_seleccionar(frame, cfg)
  rec <- sel$recorrido_sorteo

  titulares <- sel$selection[sel$selection$sample_role == "titular", , drop = FALSE]
  descritas <- unlist(lapply(rec$estratos, function(e) {
    c(e$certezas, e$unidades$classroom_id[e$unidades$seleccionada])
  }), use.names = FALSE)
  expect_setequal(descritas, titulares$classroom_id)

  # Y los estratos sin caminata dicen por que entraron sus unidades.
  sin_caminata <- Filter(function(e) !isTRUE(e$aplicable), rec$estratos)
  for (e in sin_caminata) {
    expect_true(nzchar(e$motivo))
    expect_gt(length(e$certezas), 0L)
  }
})

test_that("con un engine sin caminata el recorrido se declara inaplicable", {
  # cube calibra sobre el conjunto completo: no hay un primero ni un siguiente.
  # Publicar una recta ahí sería inventar el orden que el método no tiene.
  skip_if_not_installed("sampling")
  frame <- .recorrido_frame()
  cfg <- calc_muestra_aulas_normalize_config(list(selector = list(
    seed = 20260619L, n_aulas = 8L, replacement_waves = 0L,
    selector_engine = "cube_balanceado", strata_cols = list("stratum"),
    balance_vars = list("faculty"), simulation_runs = 0L, monte_carlo_n = 0L
  )))
  sel <- calc_muestra_aulas_seleccionar(frame, cfg)
  expect_false(sel$recorrido_sorteo$aplicable)
})

test_that("con descuento secuencial no hay caminata, y se dice por qué", {
  # Hallazgo del emisor: con el descuento activo el sistemático NO recorre una
  # recta. Sortea de a uno recalculando la MOS con los elegibles netos del paso
  # (PPS sucesivo), así que la recta única deja de existir. No es una carencia:
  # ese camino publica el orden real en `discount_step`, que además trae el
  # encogimiento. La escena tiene que poder distinguir un caso del otro.
  frame <- .recorrido_frame()
  cfg <- calc_muestra_aulas_normalize_config(list(selector = list(
    seed = 20260619L, n_aulas = 8L, replacement_waves = 0L,
    selector_engine = "sistematico_pps", strata_cols = list("stratum"),
    sequential_discount = TRUE,
    simulation_runs = 0L, monte_carlo_n = 0L
  )))
  sel <- calc_muestra_aulas_seleccionar(frame, cfg)

  expect_false(sel$recorrido_sorteo$aplicable)
  expect_identical(sel$recorrido_sorteo$motivo, "descuento_secuencial")
  # Y el orden que sí existe viaja donde corresponde.
  expect_true(sel$sequential_discount$applied)
  titulares <- sel$selection[sel$selection$sample_role == "titular", , drop = FALSE]
  expect_true(all(is.finite(as.numeric(titulares$discount_step))))
})
