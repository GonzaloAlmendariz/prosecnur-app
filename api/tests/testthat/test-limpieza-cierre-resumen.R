# Pestaña Cierre de Validación (M5; limpieza_cierre_resumen.R): cadena de casos,
# decisiones aplicadas, archivos con estado y hoja de excluidos por caso.
#
# Grano: caso de la tabla principal. Regla de atribución: un caso que excluyen
# dos decisiones se atribuye a la primera en el orden de aplicación.
#
# Fixture (helper-validacion-m1.R): 10 casos u01 a u10 en "Personas".
#   RC_001 edad fuera de 16 a 25: u01, u04, u08.
#   RC_002 P4 = 1 y P21 en 4, 5, 6, 8: u01, u04, u06, u09, u10 (5 casos).
# Excluir RC_001 y luego RC_002 saca 6 casos distintos; u01 y u04 los nombran
# las dos y se atribuyen a RC_001.

.cr_sesion <- function(dir) {
  sid <- .m1_sesion(dir)
  validacion_scope_set(sid, "Personas", "reglas_custom", list(
    .m1_regla_edad(), .m1_regla_p4_p21(), .m1_regla_hermanos(), .m1_regla_item_alguna()))
  .m2_auditar(sid, "Personas")
  post <- function(b) .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/limpieza/decision", body = b)
  post('{"source_id":"RC_001","action_type":"exclude_cases","status":"ready","rationale":"Edad fuera","base_nombre":"Personas"}')
  post('{"source_id":"RC_002","action_type":"exclude_cases","status":"ready","rationale":"Incoherente","base_nombre":"Personas"}')
  post('{"source_id":"RC_003","action_type":"nullify_fields","target_variable":"p15","status":"ready","rationale":"Vaciar","base_nombre":"Personas"}')
  post('{"source_id":"RC_004","action_type":"ignore_rule","status":"ready","rationale":"Posible","base_nombre":"Personas"}')
  sid
}

.cr_get <- function(sid, base = "Personas") {
  r <- .m1_http(.m1_router(), sid, "GET", "/api/validacion/v2/limpieza", query = paste0("base_nombre=", base))
  expect_identical(r$status, 200L)
  r$body
}

.cr_por_clave <- function(archivos) {
  stats::setNames(archivos, vapply(archivos, `[[`, "", "clave"))
}

test_that("la atribución da cada caso excluido a la primera decisión que lo excluye", {
  log <- data.frame(
    decision_id = c("D1", "D1", "D2", "D2", "D2"),
    source_id = c("R1", "R1", "R2", "R2", "R2"),
    case_id = c("a", "b", "b", "c", "a"),
    rationale = c("m1", "m1", "m2", "m2", "m2"),
    stringsAsFactors = FALSE
  )
  atrib <- .limpieza_atribuir_exclusiones(log)
  expect_identical(atrib$case_id, c("a", "b", "c"))
  expect_identical(atrib$decision_id, c("D1", "D1", "D2"))
  expect_identical(atrib$otras_reglas, c("R2", "R2", ""))
  expect_identical(nrow(.limpieza_atribuir_exclusiones(data.frame())), 0L)
})

test_that("abierta: la cadena cuadra y la suma por decisión no cuenta dos veces un caso", {
  dir <- withr::local_tempdir()
  sid <- .cr_sesion(dir)
  withr::defer(session_delete(sid))
  b <- .cr_get(sid)
  c <- b$cierre
  expect_identical(c$estado, "abierta")
  cad <- c$cadena_casos
  expect_identical(cad$momento, "prevista")
  expect_identical(cad$recibidos, 10L)
  expect_identical(cad$excluidos_en_limpieza, 6L)
  expect_identical(cad$cuentan, 4L)
  # Invariante: recibidos - fuera - excluidos = cuentan.
  fuera <- sum(unlist(cad$fuera))
  expect_identical(cad$recibidos - fuera - cad$excluidos_en_limpieza, cad$cuentan)
  expect_true(cad$cuadra)
  expect_null(cad$n_fuentes)
  expect_true(nzchar(cad$causa_n_fuentes))

  dec <- c$decisiones_aplicadas
  por_id <- stats::setNames(dec$decisiones, vapply(dec$decisiones, `[[`, "", "source_id"))
  expect_identical(por_id$RC_001$n_filas_excluidas, 3L)
  expect_identical(por_id$RC_002$n_filas_excluidas, 3L)
  expect_identical(por_id$RC_002$n_filas_ya_excluidas, 2L)
  expect_identical(por_id$RC_003$efecto, "cambia_valores")
  expect_identical(por_id$RC_004$efecto, "sin_cambios")
  expect_identical(por_id$RC_004$n_casos_revisados, 4L)
  expect_null(por_id$RC_001$n_casos_revisados)
  # Sin doble conteo: la suma por decisión es el total del motor y el de summary.
  suma_excl <- sum(vapply(dec$decisiones, `[[`, 0L, "n_filas_excluidas"))
  suma_celdas <- sum(vapply(dec$decisiones, `[[`, 0L, "n_celdas_cambiadas"))
  expect_identical(suma_excl, b$summary$total_casos_excluidos)
  expect_identical(suma_celdas, b$summary$total_celdas_corregidas)
  expect_identical(dec$totales$n_casos_excluidos, 6L)
  expect_true(dec$totales$cuadra_con_motor)
  grupos <- stats::setNames(dec$grupos, vapply(dec$grupos, `[[`, "", "efecto"))
  expect_identical(grupos$excluye$cifra, 6L)
  expect_identical(grupos$cambia_valores$cifra, suma_celdas)
  expect_true(nzchar(dec$regla_atribucion))

  arch <- .cr_por_clave(c$archivos)
  expect_identical(names(arch), c("base_limpia", "registro", "revision", "paquete_metodologico"))
  expect_true(all(vapply(arch, `[[`, "", "estado") == "no_generado"))
})

test_that("cerrada: cifras del cierre, archivos al día y la hoja de excluidos por caso", {
  dir <- withr::local_tempdir()
  sid <- .cr_sesion(dir)
  withr::defer(session_delete(sid))
  f <- .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/limpieza/finalize", query = "base_nombre=Personas")
  expect_identical(f$status, 200L)
  b <- .cr_get(sid)
  c <- b$cierre
  expect_identical(c$estado, "cerrada")
  expect_identical(c$cadena_casos$momento, "al_cerrar")
  # Después de promover, la vista previa se mide sobre la base limpia y ya no
  # ve exclusiones; el cierre conserva las suyas.
  expect_identical(b$summary$total_casos_excluidos, 0L)
  expect_identical(c$cadena_casos$excluidos_en_limpieza, 6L)
  expect_identical(c$cadena_casos$cuentan, 4L)
  expect_true(c$cadena_casos$cuadra)
  expect_identical(c$decisiones_aplicadas$totales$n_casos_excluidos, 6L)
  expect_null(b$artifacts$cierre_cifras)

  arch <- .cr_por_clave(c$archivos)
  for (k in c("base_limpia", "registro", "revision")) {
    expect_identical(arch[[k]]$estado, "al_dia")
    expect_true(arch[[k]]$disponible)
    expect_false(is.null(arch[[k]]$generado_en))
  }
  expect_identical(arch$base_limpia$formato, "xlsx")
  expect_identical(arch$paquete_metodologico$estado, "no_generado")

  # Registro de limpieza: una fila por caso, cruzada por identificador.
  path <- get_file(sid, arch$registro$file_id)$path
  hojas <- readxl::excel_sheets(path)
  expect_true(all(c("Casos_excluidos", "Excluidos por caso", "Cuenta de casos") %in% hojas))
  por_caso <- as.data.frame(readxl::read_excel(path, sheet = "Excluidos por caso"))
  expect_identical(sort(por_caso$Caso), c("u01", "u04", "u06", "u08", "u09", "u10"))
  expect_false(anyDuplicated(por_caso$Caso) > 0L)
  expect_identical(por_caso$Regla[por_caso$Caso == "u01"], "RC_001")
  expect_identical(por_caso$`También la excluyen`[por_caso$Caso == "u01"], "RC_002")
  expect_identical(por_caso$Motivo[por_caso$Caso == "u06"], "Incoherente")
  expect_false(anyNA(por_caso$`Fecha de la decisión`))
  cuenta <- as.data.frame(readxl::read_excel(path, sheet = "Cuenta de casos"))
  expect_identical(as.integer(cuenta$Casos[cuenta$Tramo == "Cuentan"]), 4L)
  # La base limpia promovida sigue con una sola hoja: el lector de la auditoría
  # lee todas las hojas como tablas.
  expect_identical(readxl::excel_sheets(get_file(sid, arch$base_limpia$file_id)$path), "datos")

  # La base hermana no hereda nada del cierre de "Personas".
  h <- .cr_get(sid, "Hogares")$cierre
  expect_true(all(vapply(h$archivos, `[[`, "", "estado") == "no_generado"))
})

test_that("cambiar una decisión deja los archivos desactualizados, no sin generar", {
  dir <- withr::local_tempdir()
  sid <- .cr_sesion(dir)
  withr::defer(session_delete(sid))
  .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/limpieza/finalize", query = "base_nombre=Personas")
  d4 <- validacion_scope_get(sid, "Personas", "limpieza_draft")[[4]]
  # Volver a guardar la misma decisión sin cambios reabre la base (así lo hace
  # el router) pero los archivos siguen describiendo las mismas decisiones.
  .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/limpieza/decision",
           body = sprintf('{"id":"%s","source_id":"RC_004","action_type":"ignore_rule","status":"ready","rationale":"Posible","base_nombre":"Personas"}', d4$id))
  arch <- .cr_por_clave(.cr_get(sid)$cierre$archivos)
  expect_identical(arch$base_limpia$estado, "al_dia")

  .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/limpieza/decision",
           body = sprintf('{"id":"%s","source_id":"RC_004","action_type":"ignore_rule","status":"ready","rationale":"Otro motivo","base_nombre":"Personas"}', d4$id))
  c <- .cr_get(sid)$cierre
  expect_identical(c$estado, "abierta")
  arch <- .cr_por_clave(c$archivos)
  for (k in c("base_limpia", "registro", "revision")) {
    expect_identical(arch[[k]]$estado, "desactualizado")
    expect_identical(unlist(arch[[k]]$causas), "cambiaron_las_decisiones")
  }
  # La base vigente ya es la limpia: la cadena prevista se mide sobre la
  # recibida (ronda 3); el aviso queda para cuando no se puede leer.
  expect_identical(c$cadena_casos$medida_sobre, "base_recibida")
  expect_identical(c$cadena_casos$recibidos, 10L)
})

test_that("la cadena encadena depuración externa y filtro de pruebas, y avisa si no cuadra", {
  cifras <- list(filas_base = 114L, fuera_de_la_auditoria = 2L,
                 excluidos_en_limpieza = 4L, cuentan_medidos = 108L)
  universo <- list(applied = TRUE, total = 120L, excluded_test = 3L,
                   excluded_unclassified = 2L, excluded_rules = 1L,
                   external_applied = TRUE, received_external = 125L, excluded_external = 5L)
  cad <- .limpieza_cadena_casos(cifras, universo)
  expect_identical(cad$recibidos, 125L)
  expect_identical(cad$fuera$retirados_fuera_de_la_app, 5L)
  expect_identical(cad$recibidos - sum(unlist(cad$fuera)) - cad$excluidos_en_limpieza, cad$cuentan)
  expect_true(cad$cuadra)
  expect_identical(cad$proporcion, round(108 / 125, 4))
  expect_length(cad$avisos, 0L)

  mal <- .limpieza_cadena_casos(modifyList(cifras, list(cuentan_medidos = 107L)), universo)
  expect_false(mal$cuadra)
  expect_identical(vapply(mal$avisos, `[[`, "", "codigo"), "cadena_no_cuadra")

  otra <- .limpieza_cadena_casos(cifras, modifyList(universo, list(total = 130L)))
  expect_true("filtro_de_pruebas_no_empalma" %in% vapply(otra$avisos, `[[`, "", "codigo"))

  sin_medir <- .limpieza_cadena_casos(modifyList(cifras, list(fuera_de_la_auditoria = NA_integer_)))
  expect_true(is.na(sin_medir$cuadra))
  expect_true("fuera_de_la_auditoria_sin_medir" %in% vapply(sin_medir$avisos, `[[`, "", "codigo"))
})

test_that("un segundo cierre toma las exclusiones del linaje, no de la vista previa", {
  # Segundo cierre: la vista previa ya se midió sobre la base limpia (70 filas,
  # 0 exclusiones); el linaje conserva el primer salto 72 -> 70.
  cifras <- list(filas_base = 70L, fuera_de_la_auditoria = 0L,
                 excluidos_en_limpieza = 0L, cuentan_medidos = 70L)
  linaje <- list(enabled = TRUE, n_casos_antes = 72L, n_casos_despues = 70L)
  cad <- .limpieza_cadena_casos(cifras, NULL, linaje, cerrada = TRUE)
  expect_identical(cad$recibidos, 72L)
  expect_identical(cad$excluidos_en_limpieza, 2L)
  expect_identical(cad$cuentan, 70L)
  expect_true(cad$cuadra)
})

test_that("un cierre anterior al registro publica el estado como desconocido, con su causa", {
  dir <- withr::local_tempdir()
  sid <- .cr_sesion(dir)
  withr::defer(session_delete(sid))
  .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/limpieza/finalize", query = "base_nombre=Personas")
  art <- validacion_scope_get(sid, "Personas", "limpieza_artifacts")
  art$cierre_cifras <- NULL
  validacion_scope_set(sid, "Personas", "limpieza_artifacts", art)
  validacion_scope_set(sid, "Personas", "limpieza_archivos", NULL)
  c <- .cr_get(sid)$cierre
  expect_identical(c$estado, "cerrada")
  expect_null(c$cadena_casos)
  expect_true(nzchar(c$causa_sin_cifras))
  arch <- .cr_por_clave(c$archivos)
  expect_null(arch$base_limpia$estado)
  expect_true(nzchar(arch$base_limpia$causa_estado))
  expect_false(is.null(arch$base_limpia$file_id))
  expect_identical(arch$paquete_metodologico$estado, "no_generado")
})

test_that("el paquete metodológico queda anotado en su base con la firma al pedirlo", {
  dir <- withr::local_tempdir()
  sid <- .cr_sesion(dir)
  withr::defer(session_delete(sid))
  firma <- .limpieza_firma_cierre(validacion_scope_get(sid, "Personas"))
  zip_path <- file.path(dir, "paquete.zip")
  writeBin(as.raw(1:10), zip_path)
  j <- list(sid = sid, result_path = zip_path,
            result_data = list(n_rules = 4L, entries = list("informe.pdf", "replica.R")))
  .validacion_metodologia_on_complete_para("Personas", firma)(j)
  arch <- .cr_por_clave(.cr_get(sid)$cierre$archivos)
  expect_identical(arch$paquete_metodologico$estado, "al_dia")
  expect_identical(unlist(arch$paquete_metodologico$contenido), c("pdf", "r"))
  expect_identical(arch$paquete_metodologico$formato, "zip")
  # Sin base, el paquete se registra igual y no se anota en ninguna.
  .validacion_metodologia_bundle_on_complete(j)
  h <- .cr_por_clave(.cr_get(sid, "Hogares")$cierre$archivos)
  expect_identical(h$paquete_metodologico$estado, "no_generado")
})

# ---- Ronda 2 (VERIFICACION_MOTOR_M5 y pantalla de Cierre) -------------------

.cr_revertir <- function(sid) {
  r <- .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/limpieza/revertir-promocion",
                query = "base_nombre=Personas")
  expect_identical(r$status, 200L)
  r
}

test_that("revertir la promoción reabre la base: el cierre deja de publicarse como cerrado", {
  dir <- withr::local_tempdir()
  sid <- .cr_sesion(dir)
  withr::defer(session_delete(sid))
  .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/limpieza/finalize", query = "base_nombre=Personas")
  expect_identical(.cr_get(sid)$cierre$estado, "cerrada")
  .cr_revertir(sid)
  c <- .cr_get(sid)$cierre
  expect_identical(c$estado, "abierta")
  expect_null(c$cerrada_en)
  # La base vigente vuelve a ser la recibida: 10 casos, 6 excluidos previstos.
  expect_identical(c$cadena_casos$momento, "prevista")
  expect_identical(c$cadena_casos$recibidos, 10L)
  expect_identical(c$cadena_casos$cuentan, 4L)
  expect_false(c$cadena_casos$base_promovida)
})

test_that("cerrar, cambiar una decisión, volver a cerrar y revertir: la cadena parte de la base recibida", {
  dir <- withr::local_tempdir()
  sid <- .cr_sesion(dir)
  withr::defer(session_delete(sid))
  .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/limpieza/finalize", query = "base_nombre=Personas")
  d4 <- validacion_scope_get(sid, "Personas", "limpieza_draft")[[4]]
  .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/limpieza/decision",
           body = sprintf('{"id":"%s","source_id":"RC_004","action_type":"ignore_rule","status":"ready","rationale":"Otro motivo","base_nombre":"Personas"}', d4$id))
  f2 <- .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/limpieza/finalize", query = "base_nombre=Personas")
  expect_identical(f2$status, 200L)
  expect_identical(.cr_get(sid)$cierre$cadena_casos$recibidos, 10L)
  .cr_revertir(sid)
  c <- .cr_get(sid)$cierre
  expect_identical(nrow(.read_data_for_validation(.resolve_base_files(sid, "Personas")$data$path, "csv")), 10L)
  expect_identical(c$cadena_casos$recibidos, 10L)
  expect_true(isTRUE(c$cadena_casos$cuadra))
})

test_that("si el filtro de pruebas no se puede leer, la cadena lo avisa y no supone que no hubo", {
  dir <- withr::local_tempdir()
  sid <- .cr_sesion(dir)
  withr::defer(session_delete(sid))
  testthat::local_mocked_bindings(
    .validacion_upstream_universe = function(...) stop("archivo del filtro ilegible")
  )
  cad <- .cr_get(sid)$cierre$cadena_casos
  avisos <- vapply(cad$avisos, `[[`, "", "codigo")
  expect_true("universo_no_leido" %in% avisos)
  expect_null(cad$fuera$pruebas)
  expect_null(cad$recibidos)
  expect_null(cad$cuadra)
  # Lo medido sigue publicado.
  expect_identical(cad$excluidos_en_limpieza, 6L)
  expect_identical(cad$cuentan, 4L)
})

# ---- Ronda 3 (QA_V4_CIERRE H1) ----------------------------------------------

test_that("con cambios sin cerrar, la cadena y el efecto se miden sobre la base recibida", {
  dir <- withr::local_tempdir()
  sid <- .cr_sesion(dir)
  withr::defer(session_delete(sid))
  .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/limpieza/finalize", query = "base_nombre=Personas")
  d4 <- validacion_scope_get(sid, "Personas", "limpieza_draft")[[4]]
  .m1_http(.m1_router(), sid, "POST", "/api/validacion/v2/limpieza/decision",
           body = sprintf('{"id":"%s","source_id":"RC_004","action_type":"ignore_rule","status":"ready","rationale":"Otro motivo","base_nombre":"Personas"}', d4$id))
  c <- .cr_get(sid)$cierre
  expect_identical(c$estado, "abierta")
  cad <- c$cadena_casos
  expect_true(cad$base_promovida)
  expect_identical(cad$recibidos, 10L)
  expect_identical(cad$excluidos_en_limpieza, 6L)
  expect_identical(cad$cuentan, 4L)
  expect_true(cad$cuadra)
  expect_identical(cad$medida_sobre, "base_recibida")
  expect_false("base_vigente_ya_limpia" %in% vapply(cad$avisos, `[[`, "", "codigo"))
  por_id <- stats::setNames(c$decisiones_aplicadas$decisiones,
                            vapply(c$decisiones_aplicadas$decisiones, `[[`, "", "source_id"))
  expect_identical(por_id$RC_001$efecto, "excluye")
  expect_identical(por_id$RC_001$n_filas_excluidas, 3L)
  expect_identical(c$decisiones_aplicadas$totales$n_casos_excluidos, 6L)
  # Sin la base recibida en la sesión, se mide sobre la vigente y se avisa.
  src <- session_get(sid)$estudio$bases$Personas$limpieza$source_data_file_id
  s <- session_get(sid); s$files[[src]] <- NULL; .session_env[[sid]] <- s
  cad2 <- .cr_get(sid)$cierre$cadena_casos
  expect_identical(cad2$medida_sobre, "base_vigente")
  expect_true("base_vigente_ya_limpia" %in% vapply(cad2$avisos, `[[`, "", "codigo"))
})
