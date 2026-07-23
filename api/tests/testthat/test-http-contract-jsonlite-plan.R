# =============================================================================
# Contrato HTTP real — la clase de bug jsonlite/simplifyDataFrame en el plan.
# =============================================================================
#
# Caso historico (release 0.5.19, ACNUR PDM): el plan de slides viaja como
# JSON y plumber lo parsea con simplifyDataFrame. Ese parseo RECTANGULARIZA el
# arreglo de slides: las laminas por-servicio llevan
# `filtros = {current_code: <codigo>}` y las laminas de la base madre (sin
# filtros) heredan un `current_code = NA` FANTASMA como columna de data.frame.
# Un stop() crudo al aplicar ese filtro mataba las 85 laminas del reporte.
# El bug NO reproduce in-process: solo existe tras el parse del wire real.
#
# Aca reconstruimos ese wire exacto: cliente jsonlite::toJSON (como el
# frontend) -> POST al backend Plumber vivo -> parse simplificado de plumber
# -> job callr que renderiza el PPT. Los dos invariantes fijados en
# reporte_filter_guards.R quedan pineados por HTTP:
#   1) filtro fantasma (NA) = no-op, jamas un error;
#   2) filtro real sobre columna ausente degrada ESA lamina, no mata el job.

# Plan heterogeneo minimo: una lamina CON filtro por servicio y una SIN
# filtros. Tras el parse de plumber, la segunda hereda el fantasma. `region`
# existe en la base minima del fixture; `current_code` NO (como en la madre).
.hc_plan_heterogeneo <- function() {
  list(slides = list(
    list(
      tipo = "p_slide_1_grafico",
      payload = list(
        titulo = "Con filtro por servicio",
        grafico = list(
          graficador = "p_barras_agrupadas",
          args = list(var = "region", filtros = list(current_code = "srv_fantasma"))
        )
      )
    ),
    list(
      tipo = "p_slide_1_grafico",
      payload = list(
        titulo = "Sin filtros (lamina de la madre)",
        grafico = list(
          graficador = "p_barras_agrupadas",
          args = list(var = "region")
        )
      )
    )
  ))
}

test_that("un plan heterogeneo sobrevive el parse de plumber y valida ok", {
  srv <- http_contract_server()

  r <- http_post_json(srv, "/api/graficos/validar",
                      body = list(plan = .hc_plan_heterogeneo()))
  expect_identical(r$status, 200L)
  expect_true(isTRUE(r$json$ok))
  expect_equal(as.numeric(r$json$n_slides), 2)
  expect_length(r$json$errors, 0)
})

test_that("el current_code fantasma del wire NO mata el render PPT (85 laminas, v0.5.19)", {
  srv <- http_contract_server()
  http_contract_skip_if_no_jobs_runtime()

  base <- http_contract_upload_base(srv)
  sid <- base$sid

  # El wire real: toJSON del cliente (igual que client.ts) y parse
  # simplificado de plumber en el POST. Nada de fixtures pre-parseadas.
  r <- http_post_json(
    srv, "/api/graficos/ppt",
    body = list(plan = .hc_plan_heterogeneo()),
    sid = sid
  )
  expect_identical(r$status, 200L)
  expect_true(isTRUE(r$json$ok))
  expect_identical(r$json$kind, "graficos.ppt")
  job_id <- r$json$job_id
  expect_true(is.character(job_id) && nzchar(job_id))

  # Timeout generoso: el worker callr hace load_all del paquete completo
  # antes de renderizar (igual que en produccion).
  snap <- http_wait_job(srv, job_id, timeout_secs = 420, poll_secs = 1.5)

  # ESTE es el assert de la regresion: con el stop() crudo pre-guardas, el
  # job terminaba "error" con "La variable de filtro `current_code` no
  # existe en `data`" y CERO laminas. Hoy debe terminar "done" con las 2.
  if (!identical(snap$status, "done")) {
    fail(sprintf(
      "El job PPT termino en '%s' (el contrato exige 'done'). Error del backend: %s",
      as.character(snap$status), paste(unlist(snap$error), collapse = " / ")
    ))
  }
  expect_equal(as.numeric(snap$result_data$n_slides), 2)
  expect_true(isTRUE(snap$has_file_result))
  expect_true(grepl("\\.pptx$", as.character(snap$result_filename)))

  # Descarga del artefacto por el mismo wire: debe ser un PPTX real (zip).
  dl <- http_get(srv, paste0("/api/jobs/", job_id, "/result"))
  expect_identical(dl$status, 200L)
  expect_true(length(dl$raw) > 1000)
  expect_identical(dl$raw[1:2], as.raw(c(0x50, 0x4b)))  # magic "PK"

  # El paquete trae al menos las 2 laminas del plan (la lamina degradada
  # renderiza canvas en blanco, no desaparece).
  skip_if_not_installed("zip")
  tmp_pptx <- withr::local_tempfile(fileext = ".pptx")
  writeBin(dl$raw, tmp_pptx)
  entries <- zip::zip_list(tmp_pptx)$filename
  n_slides_xml <- sum(grepl("^ppt/slides/slide[0-9]+\\.xml$", entries))
  expect_true(n_slides_xml >= 2)
})
