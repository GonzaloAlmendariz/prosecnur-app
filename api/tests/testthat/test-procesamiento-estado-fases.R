# Procesamiento (M8): estado por base y por fase (procesamiento_estado_fases.R).
# Fixtures en helper-base-variables.R: base "2026" (xlsx, 40 casos) y su
# hermana "2024" (sav).

.pef_fases <- function(sid, base) {
  .estudio_payload(sid)$bases[[base]]$fases$fases
}

.pef_mutar_base <- function(sid, base, f) {
  s <- session_get(sid)
  s$estudio$bases[[base]] <- f(s$estudio$bases[[base]])
  .session_env[[sid]] <- s
  invisible(s)
}

.pef_cerrar <- function(sid, base, en = "2026-11-06T10:00:00Z") {
  validacion_scope_set(sid, base, "evaluacion", list(resumen = data.frame(), auditada_en = "2026-11-05T09:00:00Z"))
  validacion_scope_set(sid, base, "limpieza_artifacts", list(finalized_at = en))
}

.pef_nueva <- function(sid) {
  nueva <- .bv_data_2026()[c(30:1, 41), ]
  nueva$`_uuid`[31] <- "u41"
  save_upload(sid, "data", "v2.xlsx", .bv_xlsx_bytes(list(data = nueva)))
}

test_that("actualizar las respuestas después de cerrar deja Validación desactualizada, y la hermana igual", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  .pef_cerrar(sid, "2026")
  antes <- .pef_fases(sid, "2026")
  expect_identical(antes$validacion$estado, "hecha")
  expect_identical(antes$validacion$motivo, "cerrada")
  expect_identical(antes$validacion$actualizado_en, "2026-11-06T10:00:00Z")
  hermana_antes <- .pef_fases(sid, "2024")

  fid <- .pef_nueva(sid)$file_id
  carga_actualizar_aplicar(sid, "2026", fid)

  despues <- .pef_fases(sid, "2026")
  expect_identical(despues$validacion$estado, "desactualizada")
  expect_identical(despues$validacion$motivo, "respuestas_actualizadas")
  expect_match(despues$validacion$causa, "se actualizaron después de cerrar la limpieza")
  expect_false(is.na(despues$validacion$actualizado_en))
  # La base hermana no se entera.
  expect_identical(.pef_fases(sid, "2024"), hermana_antes)
  expect_identical(hermana_antes$validacion$estado, "sin_iniciar")
})

test_that("sin cierre previo, actualizar las respuestas no inventa una validación desactualizada", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  validacion_scope_set(sid, "2026", "evaluacion", list(resumen = data.frame()))
  fid <- .pef_nueva(sid)$file_id
  carga_actualizar_aplicar(sid, "2026", fid)
  expect_false(identical(.pef_fases(sid, "2026")$validacion$estado, "desactualizada"))
})

test_that("las respuestas vigentes que no son la base limpia del cierre dejan Validación desactualizada", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  .pef_cerrar(sid, "2026")
  vigente <- session_get(sid)$estudio$bases[["2026"]]$data_file_id
  .pef_mutar_base(sid, "2026", function(m) {
    m$limpieza <- list(enabled = TRUE, source_data_file_id = "otra", effective_data_file_id = vigente)
    m
  })
  expect_identical(.pef_fases(sid, "2026")$validacion$estado, "hecha")
  nueva <- .pef_nueva(sid)$file_id
  .pef_mutar_base(sid, "2026", function(m) { m$data_file_id <- nueva; m })
  f <- .pef_fases(sid, "2026")$validacion
  expect_identical(f$estado, "desactualizada")
  expect_identical(f$motivo, "respuestas_cambiaron")
  expect_identical(.pef_fases(sid, "2024")$validacion$estado, "sin_iniciar")
})

test_that("cambiar las decisiones después de cerrar deja Validación desactualizada por la firma del cierre", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  .pef_cerrar(sid, "2026")
  scope <- session_get(sid)$estudio$bases[["2026"]]$validacion
  validacion_scope_set(sid, "2026", "limpieza_archivos",
                       list(base_limpia = list(firma = .limpieza_firma_cierre(scope))))
  expect_identical(.pef_fases(sid, "2026")$validacion$estado, "hecha")
  validacion_scope_set(sid, "2026", "limpieza_draft", list(
    list(id = 1L, action_type = "ignore_rule", source_id = "R1", status = "ready",
         updated_at = "2026-11-08T12:00:00Z")))
  f <- .pef_fases(sid, "2026")$validacion
  expect_identical(f$estado, "desactualizada")
  expect_identical(f$motivo, "decisiones_cambiaron")
  expect_identical(f$actualizado_en, "2026-11-08T12:00:00Z")
})

test_that("Codificación desactualizada arrastra a Analítica y Gráficos con su causa; sin fecha se dice por qué", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$codif_por_base <- list("2026" = list(grupos_recod = list(list(id = "g1")),
                                         readaptar_desde = "2026-11-09T08:00:00"))
  s$analitica_status_por_base <- list("2026" = list(analitica_frecuencias_ok = TRUE))
  .session_env[[sid]] <- s
  f <- .pef_fases(sid, "2026")
  expect_identical(f$codificacion$estado, "desactualizada")
  expect_identical(f$codificacion$actualizado_en, "2026-11-09T08:00:00")
  expect_identical(f$analitica$estado, "desactualizada")
  expect_match(f$analitica$causa, "Depende de Codificación")
  expect_true(is.na(f$analitica$actualizado_en))
  expect_match(f$analitica$sin_fecha, "no registra cuándo")
  expect_identical(f$graficos$estado, "sin_iniciar")

  # Con la codificación al día, Analítica no se declara al día: el motor no sabe sobre qué versión se generó.
  s <- session_get(sid)
  s$codif_por_base[["2026"]]$readaptar_desde <- NULL
  .session_env[[sid]] <- s
  f2 <- .pef_fases(sid, "2026")
  expect_identical(f2$codificacion$estado, "en_curso")
  expect_identical(f2$analitica$estado, "en_curso")
  expect_identical(f2$analitica$motivo, "sin_registro_de_version")
  expect_identical(.pef_fases(sid, "2024")$codificacion$estado, "sin_iniciar")
})

test_that("Carga publica la lectura de la plataforma y el estudio la carpeta de entregables o su causa", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  p <- .estudio_payload(sid)
  b <- p$bases[["2026"]]$fases
  expect_identical(b$fases$carga$estado, "hecha")
  expect_false(is.na(b$fases$carga$actualizado_en))
  expect_true(is.na(b$fuente$leida_en))
  expect_match(b$fuente$sin_fecha, "plataforma")
  expect_true(is.na(p$entregables$ruta))
  expect_match(p$entregables$sin_ruta, "no se ha guardado")

  .pef_mutar_base(sid, "2026", function(m) { m$kobo_refreshed_at <- "2026-11-09T16:40:00Z"; m })
  s <- session_get(sid); s$project_path <- file.path(tempdir(), "estudio.pulso"); .session_env[[sid]] <- s
  p2 <- .estudio_payload(sid)
  expect_identical(p2$bases[["2026"]]$fases$fuente$plataforma, "kobo")
  expect_identical(p2$bases[["2026"]]$fases$fases$carga$actualizado_en, "2026-11-09T16:40:00Z")
  expect_identical(p2$entregables$ruta, file.path(tempdir(), "Entregables"))
  # NA viaja como null, nunca como `{}`.
  json <- jsonlite::toJSON(p2$bases[["2026"]]$fases, auto_unbox = TRUE, na = "null", null = "null")
  expect_false(grepl("{}", json, fixed = TRUE))
  expect_match(json, "\"causa\":null")
})

# Camino real por el router (QA final, H2): cerrar, cambiar una decisión por el
# endpoint y leer el estado de fases. El router vacía `limpieza_artifacts` al
# cambiar una decisión, así que el estado no puede depender de `finalized_at`.
# Fixture helper-validacion-m1.R: "Personas" y su hermana "Hogares".
.pef_m1 <- function(dir) {
  sid <- .m1_sesion(dir)
  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla_edad(), .m1_regla_item_alguna()))
  .m2_auditar(sid, "Personas")
  .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/limpieza/decision",
           body = '{"source_id":"RC_001","action_type":"exclude_cases","status":"ready","rationale":"Edad fuera","base_nombre":"Personas"}')
  .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/limpieza/decision",
           body = '{"source_id":"RC_004","action_type":"ignore_rule","status":"ready","rationale":"Posible","base_nombre":"Personas"}')
  sid
}

test_that("cerrar y luego cambiar una decisión por el endpoint deja Validación desactualizada con su causa", {
  dir <- withr::local_tempdir()
  sid <- .pef_m1(dir)
  withr::defer(session_delete(sid))
  hermana <- .pef_fases(sid, "Hogares")
  expect_identical(.pef_fases(sid, "Personas")$validacion$estado, "en_curso")
  .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/limpieza/finalize", query = "base_nombre=Personas")
  expect_identical(.pef_fases(sid, "Personas")$validacion$estado, "hecha")

  d <- validacion_scope_get(sid, "Personas", "limpieza_draft")[[2]]
  # Volver a guardar la misma decisión reabre el cierre sin cambiar nada.
  .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/limpieza/decision",
           body = sprintf('{"id":"%s","source_id":"RC_004","action_type":"ignore_rule","status":"ready","rationale":"Posible","base_nombre":"Personas"}', d$id))
  igual <- .pef_fases(sid, "Personas")$validacion
  expect_identical(igual$estado, "en_curso")
  expect_identical(igual$motivo, "abierta_sin_cambios")
  expect_false(is.na(igual$causa))

  .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/limpieza/decision",
           body = sprintf('{"id":"%s","source_id":"RC_004","action_type":"ignore_rule","status":"ready","rationale":"Otro motivo","base_nombre":"Personas"}', d$id))
  f <- .pef_fases(sid, "Personas")$validacion
  expect_identical(f$estado, "desactualizada")
  expect_identical(f$motivo, "decisiones_cambiaron")
  expect_match(f$causa, "cambiaron después de cerrar")
  expect_false(is.na(f$actualizado_en))
  expect_identical(.pef_fases(sid, "Hogares"), hermana)

  # Volver a cerrar la deja hecha otra vez.
  .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/limpieza/finalize", query = "base_nombre=Personas")
  expect_identical(.pef_fases(sid, "Personas")$validacion$estado, "hecha")
})

test_that("Codificación en curso dice su causa", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$codif_por_base <- list("2026" = list(grupos_recod = list(list(id = "g1"))))
  .session_env[[sid]] <- s
  f <- .pef_fases(sid, "2026")$codificacion
  expect_identical(f$estado, "en_curso")
  expect_false(is.na(f$causa))
})
