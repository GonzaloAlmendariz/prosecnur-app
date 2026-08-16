# El circuito con la forma que el operativo tuvo de verdad.
#
# Medido sobre la relacion de aplicados de 2025: 170 titulares y 26 reemplazos
# CONSUMIDOS —24 en reserva 1 y 2 en reserva 2—, no las cadenas de once que el
# diseno planifica. Los demas tests usan cadenas sueltas; este es el estudio
# entero, y es la escala a la que el circuito tiene que aguantar.

.mo_plan <- function(n_titulares = 170L, n_r1 = 24L, n_r2 = 2L) {
  facs <- c("Ciencias e Ingenieria", "Estudios Generales Letras", "Gestion",
            "Arquitectura", "Educacion", "Derecho")
  aula <- function(cod, rol, fac, i, repl = NULL, ord = NULL, est = "agendada") {
    o <- list(classroom_id = cod, operational_code = cod, label = paste("Aula", cod),
              course_name = paste("Curso", cod), faculty = fac, stratum = fac,
              sample_role = rol,
              wave = if (rol == "titular") "M1" else sprintf("M%d", (ord %||% 1) + 1),
              orden = i, eligible_n = 20 + (i %% 25),
              expected_valid = max(1, round((20 + (i %% 25)) * 0.7)),
              sample_status = est, sex_top_1 = "F", sex_top_1_n = 11 + (i %% 8),
              sex_top_2 = "M", sex_top_2_n = 9 + (i %% 6))
    if (!is.null(repl)) { o$replacement_for <- repl; o$replacement_order <- ord }
    o
  }
  c(
    lapply(seq_len(n_titulares), function(i)
      aula(sprintf("CH %d", i), "titular", facs[[1 + (i %% length(facs))]], i,
           est = if (i <= n_r1) "reemplazada" else "agendada")),
    lapply(seq_len(n_r1), function(k)
      aula(sprintf("R %d.1", k), "chain_reserve", facs[[1 + (k %% length(facs))]],
           n_titulares + k, repl = sprintf("CH %d", k), ord = 1,
           est = if (k <= n_r2) "reemplazada" else "agendada")),
    lapply(seq_len(n_r2), function(k)
      aula(sprintf("R %d.2", k), "chain_reserve", facs[[1 + (k %% length(facs))]],
           n_titulares + n_r1 + k, repl = sprintf("CH %d", k), ord = 2))
  )
}

test_that("el tablero agrega el estudio entero sin perder aulas", {
  plan <- monitoreo_aulas_normalize_plan(.mo_plan())
  expect_length(plan, 196L)

  d <- monitoreo_aulas_dashboard(plan, data.frame(), list(enabled = TRUE, plan = plan))
  expect_identical(as.integer(d$kpis$total_aulas %||% 0L), 196L)
  # Seis facultades y sus doce celdas de cuota: sumar sin agrupar dejaria los
  # desgloses vacios con los KPI correctos, que es como se han escondido antes.
  expect_length(d$avance_por_estrato %||% list(), 6L)
  expect_length(d$quotas_sex_faculty %||% list(), 12L)
  expect_length(d$reemplazos %||% list(), 26L)
})

test_that("el cuadre encuentra los descuadres entre 170 partes", {
  plan <- monitoreo_aulas_normalize_plan(.mo_plan())
  aplicadas <- Filter(function(r) !identical(as.character(r$sample_status), "reemplazada"), plan)
  partes <- lapply(seq_along(aplicadas), function(i) {
    u <- aplicadas[[i]]
    asist <- as.numeric(u$eligible_n); rech <- i %% 3; dup <- i %% 4
    efec <- asist - rech - dup
    if (i %in% c(7L, 88L)) efec <- efec - 1
    list(operational_code = as.character(u$operational_code), intento = 1L,
         observed_students = asist, refusals = rech, duplicates = dup,
         effective_surveys = efec)
  })
  expect_length(partes, 170L)

  # Exactamente los dos sembrados: ni uno de mas por redondeo, ni uno de menos.
  descuadres <- monitoreo_aulas_reconciliacion_partes(partes)
  expect_length(descuadres, 2L)

  d <- monitoreo_aulas_dashboard(plan, data.frame(),
                                 list(enabled = TRUE, plan = plan, partes_campo = partes))
  aviso <- Filter(function(r) identical(as.character(r$check), "field_report_reconciliation"),
                  d$validation)[[1]]
  expect_identical(as.character(aviso$status), "review")
})

test_that("el libro va y vuelve con el estudio entero", {
  plan <- monitoreo_aulas_normalize_plan(.mo_plan())
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(plan, libro)
  vuelta <- aulas_libro_importar(libro)
  expect_length(vuelta$plan, 196L)
  codigos <- function(l) sort(vapply(l, function(r) as.character(r$operational_code), character(1)))
  expect_identical(codigos(vuelta$plan), codigos(plan))
})

test_that("un titular sin reserva es el caso dominante y se dice bien", {
  # En 2025, 146 de 170 titulares no consumieron ningun reemplazo. Que el aviso
  # distinga «nunca tuvo» de «se agoto» importa mas aqui que en el caso raro.
  plan <- monitoreo_aulas_normalize_plan(.mo_plan())
  res <- monitoreo_aulas_activar_reemplazo(plan, "CH 100", ahora = "2026-08-16T12:00:00Z")
  expect_true(res$agotada)
  expect_identical(res$reservas_usadas, 0L)
  expect_match(monitoreo_aulas_activacion_texto(res), "no tiene ninguna reserva en el plan")
})
