# CCSS Perfil 2026: un backend levantado por un script propio (sin el launcher) no definía PULSO_API_DIR ni PULSO_REPO_ROOT. El
# servidor corría con la fuente (`load_all`), pero el worker callr de /api/graficos/ppt caía en silencio en el paquete INSTALADO,
# más viejo: el mazo salía con «default», «(Recodificada)» y sin la nota de significancia que la fuente ya corregía.
# El worker hereda ahora la ruta del `load_all` del padre y compara su firma (versión + hash de la fuente) con la del padre:
# versión distinta falla, hash distinto avisa (jobs_fuente_paquete.R).

.jf_sin_rutas <- function() {
  viejo <- Sys.getenv(c("PULSO_API_DIR", "PULSO_REPO_ROOT"), unset = NA_character_)
  Sys.unsetenv(c("PULSO_API_DIR", "PULSO_REPO_ROOT"))
  function() for (k in names(viejo)) if (is.na(viejo[[k]])) Sys.unsetenv(k) else do.call(Sys.setenv, stats::setNames(list(viejo[[k]]), k))
}
.jf_esperar <- function(job_id) {
  deadline <- Sys.time() + 120
  repeat {
    job <- job_poll(job_id)
    if (!identical(job$status, "running")) return(job)
    if (Sys.time() > deadline) fail("El job no terminó a tiempo.")
    Sys.sleep(0.3)
  }
}

test_that("sin variables de ruta, el padre con load_all le pasa su fuente al worker", {
  skip_if(!pkgload::is_dev_package("prosecnurapp"), "el paquete no está cargado con load_all")
  restaurar <- .jf_sin_rutas(); on.exit(restaurar(), add = TRUE)
  fuente <- .jobs_api_dir_heredado()
  expect_true(file.exists(file.path(fuente, "DESCRIPTION")))
  expect_true(dir.exists(file.path(fuente, "R")))
})

test_that("sin variables de ruta, el worker carga la misma fuente que el servidor y no el paquete instalado", {
  skip_if_not_installed("callr")
  skip_if(!pkgload::is_dev_package("prosecnurapp"), "el paquete no está cargado con load_all")
  restaurar <- .jf_sin_rutas(); on.exit({ restaurar(); jobs_kill_all() }, add = TRUE)
  sid <- session_create()
  job <- .jf_esperar(job_submit(sid = sid, kind = "unit.fuente_heredada", func = function() {
    ns <- asNamespace("prosecnurapp")
    list(dev = pkgload::is_dev_package("prosecnurapp"), tiene_nueva = exists(".jobs_firma_paquete", envir = ns, inherits = FALSE))
  }))
  expect_equal(job$status, "done")
  expect_true(isTRUE(job$result_data$dev))
  expect_true(isTRUE(job$result_data$tiene_nueva))
})

test_that("la firma distingue versión (falla) de hash (avisa)", {
  f <- .jobs_firma_paquete()
  expect_named(f, c("version", "hash", "origen"), ignore.order = TRUE)
  expect_silent(.jobs_verificar_firma(f, f))
  otra <- f; otra$version <- "0.0.1"
  expect_error(.jobs_verificar_firma(otra, f), "versión")
  otro_hash <- f; otro_hash$hash <- "distinto"
  expect_message(.jobs_verificar_firma(otro_hash, f), "PULSO-AVISO")
})

test_that("el servidor empaquetado (instalado) con un worker que carga la fuente de la misma versión no falla", {
  f <- .jobs_firma_paquete()
  padre <- f; padre$origen <- "instalado"; padre$hash <- "Packaged: 2026-10-01"
  worker <- f; worker$origen <- "fuente"
  expect_silent(.jobs_verificar_firma(worker, padre))
  expect_error(.jobs_verificar_firma(padre, worker), "instalado")
})
