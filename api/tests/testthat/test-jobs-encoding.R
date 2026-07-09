# Regresión del bug "no binding for .transformar_según_modo" en workers callr.
#
# Causa raíz: el worker de callr arrancaba con el locale heredado del proceso
# padre. Si la app se lanzaba sin LC_* (Finder/Electron), el worker nacía con
# locale "C"; al DESERIALIZAR el closure del job (que viaja con una referencia
# a namespace:prosecnurapp) R cargaba el paquete INSTALADO bajo locale C y los
# bindings con nombres no-ASCII quedaban mangleados (`.transformar_seg<U+00FA>n_modo`),
# con lo que el pkgload::load_all posterior moría con
# `no binding for ".transformar_según_modo"`.
#
# El fix tiene dos partes (jobs.R):
#   1. job_submit fuerza LC_ALL UTF-8 en el env del subproceso callr, de modo
#      que la deserialización ocurre siempre bajo UTF-8.
#   2. Si func es una función top-level del paquete sin la marca
#      `prosecnur_job_function_name`, se deriva automáticamente para que el
#      bootstrap re-resuelva la función desde el namespace fresco (load_all)
#      y no use el closure serializado del paquete instalado (posiblemente viejo).

test_that("el worker callr corre con locale UTF-8 aunque el padre no lo garantice", {
  skip_if_not_installed("callr")

  old_api_dir <- Sys.getenv("PULSO_API_DIR", unset = NA_character_)
  Sys.setenv(PULSO_API_DIR = normalizePath(".", mustWork = TRUE))
  on.exit({
    if (is.na(old_api_dir)) Sys.unsetenv("PULSO_API_DIR") else Sys.setenv(PULSO_API_DIR = old_api_dir)
    jobs_kill_all()
  }, add = TRUE)

  sid <- session_create()
  job_id <- job_submit(
    sid = sid,
    kind = "unit.worker_locale",
    func = function() {
      list(
        utf8 = isTRUE(l10n_info()[["UTF-8"]]),
        lc_all_env = Sys.getenv("LC_ALL")
      )
    }
  )

  deadline <- Sys.time() + 30
  repeat {
    job <- job_poll(job_id)
    if (!identical(job$status, "running")) break
    if (Sys.time() > deadline) fail("El job de locale no terminó a tiempo.")
    Sys.sleep(0.2)
  }

  expect_equal(job$status, "done")
  expect_true(isTRUE(job$result_data$utf8))
  expect_match(job$result_data$lc_all_env, "UTF-8", ignore.case = TRUE)
})

test_that("una función top-level del paquete se re-resuelve en el namespace fresco del worker", {
  skip_if_not_installed("callr")

  old_api_dir <- Sys.getenv("PULSO_API_DIR", unset = NA_character_)
  Sys.setenv(PULSO_API_DIR = normalizePath(".", mustWork = TRUE))
  on.exit({
    if (is.na(old_api_dir)) Sys.unsetenv("PULSO_API_DIR") else Sys.setenv(PULSO_API_DIR = old_api_dir)
    jobs_kill_all()
  }, add = TRUE)

  ns <- asNamespace("prosecnurapp")
  # calc_muestra_render_job es el func real del job de reporte; aquí basta
  # verificar que un package closure SIN marca explícita también viaja bien.
  # .cm_aulas_engine_key llama helpers internos del paquete: si el worker
  # usara el closure serializado contra un namespace instalado viejo/roto,
  # esto no devolvería el resultado del código dev.
  func <- get(".cm_aulas_engine_key", envir = ns, inherits = FALSE)
  expect_identical(environment(func), ns)
  esperado <- func("cube")

  sid <- session_create()
  job_id <- job_submit(
    sid = sid,
    kind = "unit.package_closure",
    func = func,
    args = list("cube")
  )

  deadline <- Sys.time() + 30
  repeat {
    job <- job_poll(job_id)
    if (!identical(job$status, "running")) break
    if (Sys.time() > deadline) fail("El job de package closure no terminó a tiempo.")
    Sys.sleep(0.2)
  }

  expect_equal(job$status, "done")
  expect_identical(job$result_data, esperado)
})

test_that("calc_muestra_render_job lleva la marca de re-resolución para el bootstrap", {
  expect_identical(
    attr(calc_muestra_render_job, "prosecnur_job_function_name", exact = TRUE),
    "calc_muestra_render_job"
  )
  expect_identical(
    attr(calc_muestra_aulas_comparar_job, "prosecnur_job_function_name", exact = TRUE),
    "calc_muestra_aulas_comparar_job"
  )
  expect_identical(
    attr(calc_muestra_aulas_seleccionar_job, "prosecnur_job_function_name", exact = TRUE),
    "calc_muestra_aulas_seleccionar_job"
  )
})
