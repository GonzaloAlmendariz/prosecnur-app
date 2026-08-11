source("setup-load-all.R")

# Las guías de layout (`config.debug_ph` de la UI) llegan al ENTREGABLE, no
# solo al preview.
#
# Antes los tres workers de export las apagaban siempre, con la intención de
# que un mazo no saliera al cliente con marcos magenta. El efecto real era un
# interruptor que se declaraba activo y no tenía efecto observable en ninguna
# superficie donde el analista mirara — ni en el PPT, ni en el Word, ni en el
# ZIP multibase. Quien enciende las guías las quiere para revisar el mazo
# COMPLETO: diagnosticar 67 láminas de a una vista previa no es una
# herramienta.

test_that("el preview inyecta debug_ph cuando está activo", {
  presets <- .enriquecer_presets(list(), list(activo = TRUE, color = "#FF00FF", lwd = 2))
  expect_true(isTRUE(presets$base$debug_ph_bordes))
  expect_identical(presets$base$debug_ph_col, "#FF00FF")
  expect_equal(presets$base$debug_ph_lwd, 2)
})

test_that("con las guías apagadas el flag queda en FALSE", {
  presets <- .enriquecer_presets(list(), list(activo = FALSE))
  expect_false(isTRUE(presets$base$debug_ph_bordes))

  # Y también cuando la UI no manda nada: el default es sin guías.
  expect_false(isTRUE(.enriquecer_presets(list(), NULL)$base$debug_ph_bordes))
})

test_that("ningún worker de export apaga las guías por su cuenta", {
  # Contrato estático: el filtro que las apagaba se retiró a propósito. Si
  # alguien lo reintroduce —en cualquier worker— este test lo delata sin
  # levantar un job callr real.
  src_path <- file.path("..", "..", "R", "graficos_jobs.R")
  skip_if(!file.exists(src_path), "fuente de graficos_jobs.R no disponible")
  cuerpo <- paste(readLines(src_path, warn = FALSE), collapse = "\n")

  expect_true(grepl("graficos_job_worker_ppt", cuerpo, fixed = TRUE))
  expect_false(grepl("export_sin_debug_ph", cuerpo, fixed = TRUE))
  expect_false(grepl("debug_ph_bordes <- FALSE", cuerpo, fixed = TRUE))
})

test_that("el flag activo sobrevive la construcción de presets del worker", {
  # `.build_presets()` es lo último que toca los presets antes del motor.
  presets <- .enriquecer_presets(list(), list(activo = TRUE, color = "#FF00FF", lwd = 2))
  construidos <- .build_presets(presets)
  expect_true(isTRUE(construidos$base$args$debug_ph_bordes %||%
                       construidos$base$debug_ph_bordes))
})

test_that("los avisos del motor llevan sello y llegan deduplicados", {
  # El motor decide cosas al renderizar —achica la letra del eje, apaga el
  # Top 2 Box de una escala de dos— y no las contaba. Viajan por `message()`
  # porque el renderer se traga los `warning()`, y el sello es lo que permite
  # separarlos del resto del stderr (progreso, locale, avisos de paquetes).
  emitido <- capture.output(.pulso_aviso("prueba"), type = "message")
  expect_true(grepl(.PULSO_AVISO_SELLO, emitido, fixed = TRUE))
  expect_true(grepl("prueba", emitido, fixed = TRUE))

  sid <- session_create()
  jobs <- file.path(session_get(sid)$dir, "jobs")
  dir.create(jobs, recursive = TRUE, showWarnings = FALSE)
  writeLines(
    c("ruido de paquete",
      paste(.PULSO_AVISO_SELLO, "la columna se omite"),
      "locale bla",
      paste(.PULSO_AVISO_SELLO, "la columna se omite"),   # 67 láminas repiten
      paste(.PULSO_AVISO_SELLO, "el piso del eje baja")),
    file.path(jobs, "JOB-X.err")
  )

  avisos <- .pulso_avisos_de_job(sid, "JOB-X")
  expect_equal(avisos, c("la columna se omite", "el piso del eje baja"))
  expect_false(any(grepl("ruido|locale", avisos)))
})

test_that("sin stderr o sin avisos la lista viene vacía, no rota", {
  sid <- session_create()
  expect_equal(.pulso_avisos_de_job(sid, "NO-EXISTE"), character(0))
  expect_equal(.pulso_avisos_de_job("sesion-inventada", "X"), character(0))

  jobs <- file.path(session_get(sid)$dir, "jobs")
  dir.create(jobs, recursive = TRUE, showWarnings = FALSE)
  writeLines(c("solo ruido", "nada sellado"), file.path(jobs, "JOB-Y.err"))
  expect_equal(.pulso_avisos_de_job(sid, "JOB-Y"), character(0))
})

test_that("una lista larga se acota: veinte avisos no se leen", {
  sid <- session_create()
  jobs <- file.path(session_get(sid)$dir, "jobs")
  dir.create(jobs, recursive = TRUE, showWarnings = FALSE)
  writeLines(paste(.PULSO_AVISO_SELLO, "aviso", seq_len(20)),
             file.path(jobs, "JOB-Z.err"))
  expect_length(.pulso_avisos_de_job(sid, "JOB-Z"), 8L)
})

test_that("PPT y Word devuelven los avisos del motor, no solo el PPT", {
  # Word renderiza con los mismos graficadores y toma las mismas decisiones
  # automaticas. Medido sobre el banco (Conta 10-08): su export generaba 1
  # aviso —«la columna top2box se omite: la escala tiene 2 categoria(s)»— que
  # se quedaba en el stderr del job. El `onExportDone` del front ya leia
  # `data.avisos` para ambos kinds; era el backend el que solo lo mandaba en
  # uno. Contrato estatico: si alguien quita el campo de cualquiera de los dos
  # on_complete, esto lo delata sin levantar un job callr real.
  src_path <- file.path("..", "..", "R", "router_graficos.R")
  skip_if(!file.exists(src_path), "fuente de router_graficos.R no disponible")
  cuerpo <- readLines(src_path, warn = FALSE)

  registros <- grep('\\.register_output_file\\(j\\$sid, "(reporte_ppt|reporte_word)"', cuerpo)
  expect_length(registros, 2L)

  for (i in registros) {
    bloque <- paste(cuerpo[i:min(i + 12L, length(cuerpo))], collapse = "\n")
    expect_true(
      grepl("avisos = I(.pulso_avisos_de_job(j$sid, j$id))", bloque, fixed = TRUE),
      info = sprintf("el on_complete de la linea %d no devuelve los avisos", i)
    )
  }
})
