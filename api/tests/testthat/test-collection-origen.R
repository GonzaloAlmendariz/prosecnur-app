# E1e — Unidades › Origen: de donde salen las unidades y que cambio.
#
# `.collection_source_vigente()` compara corridas, no datos: un sorteo rehecho
# con la misma corrida, o un aula pactada despues, no se veia. GET /origen
# proyecta los dos lados —plan guardado y lo que sembraria hoy la fuente— con
# la misma funcion y lista altas, bajas, campos y roles.

.org_filas <- function(n = 4L, run = "sel_aulas_20260801211224_aaaa1111", prefijo = "CH") {
  data.frame(
    selection_run_id = run,
    classroom_id = sprintf("cur%03d_%04d", seq_len(n), 100L + seq_len(n)),
    operational_code = sprintf("%s %d", prefijo, seq_len(n)),
    titular_operational_code = sprintf("%s %d", prefijo, seq_len(n)),
    sample_role = "titular",
    operational_sequence = seq_len(n),
    replacement_order = 0,
    label = sprintf("Curso %d", seq_len(n)),
    faculty = rep(c("Derecho", "Ingenieria"), length.out = n),
    program = "Escuela X",
    course_name = sprintf("Curso %d", seq_len(n)),
    schedule = "MIE 17:00-20:00",
    teacher = sprintf("Docente Secreto %d", seq_len(n)),
    teacher_email = sprintf("docente%d@pucp.edu.pe", seq_len(n)),
    eligible_n = 30 + seq_len(n),
    enrolled_total = 40 + seq_len(n),
    wave = "M1",
    stringsAsFactors = FALSE
  )
}

.org_sid <- function(df = .org_filas()) {
  sid <- session_create()
  session_set(sid, "calc_muestra_aulas_selection", list(selection = df))
  collection_state_seed(sid)
  sid
}

.org_cambiar <- function(sid, df) {
  sel <- session_get(sid)$calc_muestra_aulas_selection
  sel$selection <- df
  session_set(sid, "calc_muestra_aulas_selection", sel)
}

test_that("fuente igual al plan: al_dia, huellas iguales y nada que listar", {
  sid <- .org_sid()
  on.exit(session_delete(sid), add = TRUE)
  g <- collection_origen_get(sid)
  expect_identical(g$schema, "collection_origen/v1")
  expect_identical(g$estado, "al_dia")
  expect_false(g$stale)
  expect_identical(g$fingerprint_actual, g$fingerprint_plan)
  expect_identical(g$veredicto, "huella")
  expect_equal(g$resumen$sin_cambio, 4L)
  expect_equal(unlist(g$resumen[c("altas", "bajas", "campos", "roles", "unidades_con_cambios")]),
               c(altas = 0, bajas = 0, campos = 0, roles = 0, unidades_con_cambios = 0))
  expect_identical(g$fuente$origen, "calc_muestra_aulas_selection")
  expect_identical(g$fuente$modulo, "calc-muestra")
  expect_identical(g$plan$fecha, "2026-08-01")
  expect_false(g$fuente$circular)
})

test_that("el aula pactada cambia: un campo `aula` con antes y despues", {
  sid <- .org_sid()
  on.exit(session_delete(sid), add = TRUE)
  df <- .org_filas()
  df$scheduled_venue <- c(NA, "H-110", NA, NA)
  .org_cambiar(sid, df)
  g <- collection_origen_get(sid)
  expect_identical(g$estado, "cambio")
  expect_true(g$stale)
  expect_length(g$cambios$campos, 1L)
  e <- g$cambios$campos[[1]]
  expect_identical(e$campo, "aula")
  expect_identical(e$codigo, "CH 2")
  expect_identical(e$clave, "cur002_0102")
  expect_true(is.na(e$antes))
  expect_identical(e$despues, "H-110")
  expect_false(e$sensible)
  expect_equal(g$resumen$unidades_con_cambios, 1L)
  expect_equal(g$resumen$sin_cambio, 3L)
})

test_that("altas y bajas por curso-horario, con sus cifras", {
  sid <- .org_sid()
  on.exit(session_delete(sid), add = TRUE)
  df <- .org_filas(6L)[-1, ]
  df$sample_role[4:5] <- "extra_reserve_pool"
  .org_cambiar(sid, df)
  g <- collection_origen_get(sid)
  expect_equal(g$resumen$altas, 2L)
  expect_equal(g$resumen$bajas, 1L)
  expect_identical(vapply(g$cambios$altas, `[[`, "", "codigo"), c("CH 5", "CH 6"))
  expect_identical(g$cambios$altas[[1]]$rol, "extra_reserve_pool")
  expect_identical(g$cambios$bajas[[1]]$codigo, "CH 1")
  expect_identical(g$cambios$bajas[[1]]$clave, "cur001_0101")
  expect_equal(g$resumen$afectadas$unidades, 3L)
})

test_that("titular que pasa a reserva va a roles, no a campos", {
  sid <- .org_sid()
  on.exit(session_delete(sid), add = TRUE)
  df <- .org_filas()
  df$sample_role[[3]] <- "chain_reserve"
  df$titular_operational_code[[3]] <- "CH 1"
  df$replacement_order[[3]] <- 1
  .org_cambiar(sid, df)
  g <- collection_origen_get(sid)
  expect_length(g$cambios$campos, 0L)
  campos <- vapply(g$cambios$roles, `[[`, "", "campo")
  expect_setequal(campos, c("rol", "cadena", "orden"))
  rol <- g$cambios$roles[[which(campos == "rol")]]
  expect_identical(rol$antes, "titular")
  expect_identical(rol$despues, "chain_reserve")
  expect_equal(g$cambios$roles[[which(campos == "orden")]]$despues, 1)
  expect_equal(g$resumen$unidades_con_cambios, 1L)
})

test_that("el mismo codigo en otro curso-horario es baja + alta, no un cambio", {
  sid <- .org_sid()
  on.exit(session_delete(sid), add = TRUE)
  df <- .org_filas()
  df$classroom_id[[2]] <- "otro999_0001"
  .org_cambiar(sid, df)
  g <- collection_origen_get(sid)
  expect_equal(g$resumen$altas, 1L)
  expect_equal(g$resumen$bajas, 1L)
  expect_identical(g$cambios$altas[[1]]$codigo, "CH 2")
  expect_identical(g$cambios$bajas[[1]]$codigo, "CH 2")
  expect_length(g$cambios$campos, 0L)
})

test_that("reordenar las filas de la fuente no es un cambio", {
  sid <- .org_sid()
  on.exit(session_delete(sid), add = TRUE)
  .org_cambiar(sid, .org_filas()[c(4, 2, 3, 1), ])
  g <- collection_origen_get(sid)
  expect_identical(g$estado, "al_dia")
  expect_identical(g$fingerprint_actual, g$fingerprint_plan)
})

test_that("el docente cambia sin decir quien: sensible y sin valores; nada de correos", {
  sid <- .org_sid()
  on.exit(session_delete(sid), add = TRUE)
  df <- .org_filas()
  df$teacher[[1]] <- "Docente Nuevo Secreto"
  df$teacher_email[[1]] <- "nuevo@pucp.edu.pe"
  .org_cambiar(sid, df)
  g <- collection_origen_get(sid)
  expect_length(g$cambios$campos, 1L)
  e <- g$cambios$campos[[1]]
  expect_identical(e$campo, "docente")
  expect_true(e$sensible)
  expect_true(is.na(e$antes))
  expect_true(is.na(e$despues))
  txt <- as.character(jsonlite::toJSON(g, auto_unbox = TRUE, na = "null"))
  expect_false(grepl("Secreto|@|https?://|access_ref", txt))
})

test_that("limite corta cada lista y lo declara; el resumen cuenta todo", {
  sid <- .org_sid()
  on.exit(session_delete(sid), add = TRUE)
  .org_cambiar(sid, .org_filas(9L))
  g <- collection_origen_get(sid, limite = 2L)
  expect_equal(g$resumen$altas, 5L)
  expect_length(g$cambios$altas, 2L)
  expect_true(g$truncado$altas)
  expect_false(g$truncado$bajas)
  expect_identical(g$limite, 2L)
  expect_identical(collection_origen_get(sid, limite = "3")$limite, 3L)
})

test_that("parametros invalidos rebotan con E_COLLECTION_ORIGEN_PARAMETRO", {
  sid <- .org_sid()
  on.exit(session_delete(sid), add = TRUE)
  for (args in list(list(nivel = "todo"), list(limite = "0"), list(limite = "abc"), list(limite = "2.5"))) {
    err <- tryCatch(do.call(collection_origen_get, c(list(sid), args)), api_error = function(e) e)
    expect_s3_class(err, "api_error")
    expect_identical(err$code, "E_COLLECTION_ORIGEN_PARAMETRO")
    expect_identical(err$status, 400)
  }
})

test_that("una clave repetida se numera y se cuenta, sin inventar cambios", {
  df <- .org_filas()
  df$classroom_id[[4]] <- df$classroom_id[[3]]
  sid <- .org_sid(df)
  on.exit(session_delete(sid), add = TRUE)
  g <- collection_origen_get(sid)
  expect_identical(g$estado, "al_dia")
  expect_equal(g$resumen$claves_repetidas, 1L)
  p <- prosecnurapp:::.collection_origen_proyeccion(session_get(sid)$collection_state$plan$units)
  expect_true(paste0(df$classroom_id[[3]], "#2") %in% p$columnas$clave)
})

test_that("sin plan y sin fuente: estados propios, sin listas", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  g <- collection_origen_get(sid)
  expect_identical(g$estado, "sin_plan")
  expect_false(g$plan$existe)
  expect_true(is.na(g$cambios))
  sid2 <- .org_sid()
  on.exit(session_delete(sid2), add = TRUE)
  session_set(sid2, "calc_muestra_aulas_selection", NULL)
  g2 <- collection_origen_get(sid2)
  expect_identical(g2$estado, "sin_fuente")
  expect_false(g2$fuente$disponible)
})

test_that("Monitoreo gana como fuente y su copia vieja se declara intermedia desfasada", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  vieja <- .org_filas(run = "sel_aulas_20260801211224_aaaa1111")
  session_set(sid, "monitoreo_aulas_plan", vieja)
  session_set(sid, "calc_muestra_aulas_selection",
              list(selection = .org_filas(5L, run = "sel_aulas_20260821160928_bbbb2222")))
  collection_state_seed(sid)
  g <- collection_origen_get(sid)
  expect_identical(g$fuente$origen, "monitoreo_aulas_plan")
  expect_identical(g$fuente$modulo, "monitoreo")
  # Contra Monitoreo el plan esta al dia; el sorteo nuevo no llegaria rehaciendo.
  expect_identical(g$estado, "al_dia")
  expect_true(g$fuente_intermedia_desfasada)
  expect_true(g$sorteo_vigente$desfasado)
  expect_identical(g$sorteo_vigente$fecha, "2026-08-21")

  session_set(sid, "monitoreo_aulas_plan", .org_filas(run = "sel_aulas_20260821160928_bbbb2222"))
  expect_false(collection_origen_get(sid)$fuente_intermedia_desfasada)
})

test_that("tras la entrega la copia de Monitoreo es el eco del plan: no inventa altas", {
  df <- .org_filas()
  df$link <- sprintf("https://kf.kobotoolbox.org/x/a?d%%5BcollectorID%%5D=%s", df$classroom_id)
  sid <- .org_sid(df)
  on.exit(session_delete(sid), add = TRUE)
  st <- collection_state_get(sid)
  expect_identical(st$state$deployment$status, "prepared")
  collection_handoff(sid, st$state_revision)
  expect_true(length(.collection_rows(session_get(sid)$monitoreo_aulas_plan)) > 0L)

  g <- collection_origen_get(sid)
  expect_identical(g$fuente$origen, "monitoreo_aulas_plan")
  expect_true(g$fuente$circular)
  expect_identical(g$estado, "al_dia")
  expect_equal(g$resumen$altas, 0L)
  expect_equal(g$resumen$bajas, 0L)
  expect_true(g$resumen$entregado)
  expect_false(g$fuente_intermedia_desfasada)

  # Se vuelve a sortear en Calculo de muestra: Monitoreo sigue con la copia vieja.
  .org_cambiar(sid, .org_filas(5L, run = "sel_aulas_20260821160928_bbbb2222"))
  g2 <- collection_origen_get(sid)
  expect_true(g2$fuente_intermedia_desfasada)
  expect_true(g2$sorteo_vigente$desfasado)
  r2 <- collection_origen_get(sid, "resumen")
  expect_true(r2$fuente$circular)
  expect_true(r2$fuente_intermedia_desfasada)
})

test_that("invariante: tras rehacer, Origen dice al_dia", {
  sid <- .org_sid()
  on.exit(session_delete(sid), add = TRUE)
  df <- .org_filas(6L)[-2, ]
  df$scheduled_venue <- "A-506"
  df$sample_role[[3]] <- "chain_reserve"
  .org_cambiar(sid, df)
  antes <- collection_origen_get(sid)
  expect_identical(antes$estado, "cambio")
  collection_state_reseed(sid, antes$state_revision)
  despues <- collection_origen_get(sid)
  expect_identical(despues$estado, "al_dia")
  expect_identical(despues$fingerprint_plan, antes$fingerprint_actual)
})

test_that("la lectura es pura: ni revision, ni dirty, ni estado", {
  sid <- .org_sid()
  on.exit(session_delete(sid), add = TRUE)
  .org_cambiar(sid, .org_filas(6L))
  s <- session_get(sid)
  s$project_dirty <- FALSE
  .session_env[[sid]] <- s
  antes <- session_get(sid)
  collection_origen_get(sid)
  collection_origen_get(sid, "resumen")
  expect_identical(session_get(sid), antes)
})

test_that("resumen no construye unidades y responde por corrida", {
  sid <- .org_sid()
  on.exit(session_delete(sid), add = TRUE)
  testthat::local_mocked_bindings(
    .collection_legacy_unit = function(...) stop("resumen no debe construir unidades"),
    .collection_origen_proyeccion = function(...) stop("resumen no debe proyectar")
  )
  r <- collection_origen_get(sid, "resumen")
  expect_identical(r$nivel, "resumen")
  expect_identical(r$veredicto, "corrida")
  expect_identical(r$estado, "al_dia")
  expect_true(is.na(r$cambios))
  expect_true(is.na(r$fingerprint_actual))
  expect_equal(r$fuente$unidades, 4L)
  expect_false(r$resumen$entregado)
})

test_that("rendimiento: 2.400 filas se comparan en menos de 2 s", {
  n <- 2400L
  sid <- .org_sid(.org_filas(n))
  on.exit(session_delete(sid), add = TRUE)
  df <- .org_filas(n)
  df$scheduled_venue <- NA_character_
  df$scheduled_venue[1:10] <- "Z-1"
  .org_cambiar(sid, df)
  t <- system.time(g <- collection_origen_get(sid))[["elapsed"]]
  expect_equal(g$resumen$campos, 10L)
  # Medido en local: ~0,9 s con las 2.373 unidades de HSVG2026. El tope deja
  # margen para un runner de CI lento sin dejar pasar el validador completo (2 s+).
  expect_lt(t, 2)
  tr <- system.time(collection_origen_get(sid, "resumen"))[["elapsed"]]
  expect_lt(tr, 0.5)
})
