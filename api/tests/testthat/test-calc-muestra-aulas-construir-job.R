# Construir el marco fuera del hilo único (I21b).
#
# Plumber es monohilo: mientras el build corría síncrono, ninguna otra petición
# se atendía. Con HSVG2026 (136.284 filas) eso midió >9 min de app congelada,
# sin progreso ni cancelación.
#
# Lo que estos tests fijan es lo que hace peligroso el cambio: que la vía job
# entregue EXACTAMENTE el mismo marco que la síncrona. Un job que devuelve un
# marco distinto del que devolvía el camino de siempre es peor que el bloqueo,
# porque nadie lo nota.

.cjob_base <- function(n_aulas = 3L, por_aula = 4L) {
  filas <- lapply(seq_len(n_aulas), function(i) {
    sids <- paste0("A", i, "_s", seq_len(por_aula))
    data.frame(
      student_id = sids,
      aula_id = paste0("A", i),
      curso_id = paste0("C", i),
      curso = paste("Curso", i),
      horario = "H1",
      facultad = if (i %% 2L == 0L) "FAC2" else "FAC1",
      programa = "P1",
      sexo = rep(c("F", "M"), length.out = por_aula),
      edad = 20,
      condicion = "regular",
      nivel = "1",
      modalidad = "presencial",
      formacion = "pregrado",
      stringsAsFactors = FALSE
    )
  })
  do.call(rbind, filas)
}

.cjob_cfg <- function() {
  calc_muestra_aulas_normalize_config(list(filters = list(min_eligible_per_class = 1L)))
}

# --- Gate sync/job -----------------------------------------------------------

test_that("el gate cuenta las filas de la tabla que manda según el modo de entrada", {
  # Modo base madre: manda la base madre.
  expect_identical(
    calc_muestra_aulas_construir_input_rows(base_madre = data.frame(a = 1:7)),
    7L
  )
  # Modo dos bases: suman estudiantes + inscripciones.
  expect_identical(
    calc_muestra_aulas_construir_input_rows(
      estudiantes = data.frame(a = 1:3),
      inscripciones = data.frame(a = 1:4)
    ),
    7L
  )
  # Con base madre presente, las otras no se suman: no es el modo activo.
  expect_identical(
    calc_muestra_aulas_construir_input_rows(
      base_madre = data.frame(a = 1:5),
      estudiantes = data.frame(a = 1:99)
    ),
    5L
  )
  # Sin nada, cero (y por tanto vía síncrona: no se encola un job vacío).
  expect_identical(calc_muestra_aulas_construir_input_rows(), 0L)
})

test_that("el umbral decide la vía y es ajustable por entorno", {
  withr::with_envvar(c(PULSO_CALC_MUESTRA_CONSTRUIR_JOB_THRESHOLD = ""), {
    expect_identical(.cm_aulas_construir_job_threshold(), 20000L)
    expect_false(.cm_aulas_construir_run_as_job(19999L))
    expect_true(.cm_aulas_construir_run_as_job(20000L))
  })
  # Ajustable para poder ejercitar la vía job sin fabricar 20.000 filas.
  withr::with_envvar(c(PULSO_CALC_MUESTRA_CONSTRUIR_JOB_THRESHOLD = "10"), {
    expect_identical(.cm_aulas_construir_job_threshold(), 10L)
    expect_true(.cm_aulas_construir_run_as_job(10L))
    expect_false(.cm_aulas_construir_run_as_job(9L))
  })
  # Un valor basura no puede dejar el gate en un estado indefinido.
  withr::with_envvar(c(PULSO_CALC_MUESTRA_CONSTRUIR_JOB_THRESHOLD = "no-soy-un-numero"), {
    expect_identical(.cm_aulas_construir_job_threshold(), 20000L)
  })
})

# --- Paridad ------------------------------------------------------------------

test_that("la vía job entrega el mismo marco que la síncrona", {
  base <- .cjob_base()
  cfg <- .cjob_cfg()

  sinc <- calc_muestra_aulas_construir(base_madre = base, config = cfg)
  # El wrapper del job sin progress_path corre en proceso: mismo código que
  # ejecuta el worker, sin la latencia de callr. La paridad que importa es la
  # del RESULTADO, y el worker no añade nada que la altere.
  vjob <- calc_muestra_aulas_construir_job(base_madre = base, config = cfg)

  # El hash del marco resume config + aula_frame: si algo sustantivo divergiera,
  # este solo assert ya lo delata.
  expect_identical(vjob$frame_hash, sinc$frame_hash)
  expect_equal(vjob$aula_frame, sinc$aula_frame)
  expect_equal(vjob$population, sinc$population)
  expect_equal(vjob$exclusions, sinc$exclusions)
  expect_equal(vjob$perfil, sinc$perfil)
})

test_that("el progreso no altera el marco ni exige callback", {
  base <- .cjob_base()
  cfg <- .cjob_cfg()

  sin_cb <- calc_muestra_aulas_construir(base_madre = base, config = cfg)

  hitos <- new.env(parent = emptyenv())
  hitos$vistos <- list()
  con_cb <- calc_muestra_aulas_construir(
    base_madre = base, config = cfg,
    on_progress = function(phase = "running", current = NULL, total = NULL,
                           message = NULL, force = FALSE) {
      hitos$vistos <- c(hitos$vistos, list(list(current = current, message = message, total = total)))
      invisible(NULL)
    }
  )

  # Mismo marco con y sin observador: el progreso no puede tener efecto.
  expect_identical(con_cb$frame_hash, sin_cb$frame_hash)

  # Y el observador vio etapas reales, en orden y hasta el final.
  vistos <- hitos$vistos
  expect_gt(length(vistos), 0L)
  currents <- vapply(vistos, function(h) as.integer(h$current), integer(1))
  expect_identical(currents, sort(currents))
  expect_identical(max(currents), 6L)
  expect_true(all(vapply(vistos, function(h) identical(as.integer(h$total), 6L), logical(1))))
  expect_true(all(nzchar(vapply(vistos, function(h) as.character(h$message), character(1)))))
})

test_that("sin callback el emisor de progreso es inocuo", {
  # El motor llama al emisor en cada hito sin preguntar por NULL; si esto
  # devolviera NULL en vez de una función, el build entero reventaría.
  p <- .cm_aulas_construir_progreso(NULL)
  expect_true(is.function(p))
  expect_silent(p(1L, "cualquier cosa"))

  p2 <- .cm_aulas_construir_progreso("no soy una función")
  expect_true(is.function(p2))
  expect_silent(p2(1L, "cualquier cosa"))
})

test_that("los hitos se emiten con force para no perderse en el rate-limit", {
  # El writer real descarta hitos a menos de 0.5 s del anterior. Seis etapas
  # rápidas se perderían y la UI se quedaría clavada en una etapa vieja.
  visto <- new.env(parent = emptyenv())
  visto$forces <- logical(0)
  p <- .cm_aulas_construir_progreso(function(phase = "running", current = NULL,
                                             total = NULL, message = NULL, force = FALSE) {
    visto$forces <- c(visto$forces, isTRUE(force))
    invisible(NULL)
  })
  p(1L, "uno")
  p(2L, "dos")
  expect_identical(visto$forces, c(TRUE, TRUE))
})
