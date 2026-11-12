# Carga › Actualizar una fuente: vista previa por identificador, qué se conserva
# por fase, aplicar con copia y volver atrás. Fixtures en helper-base-variables.R
# (base "2026": 40 casos con `_uuid` u01..u40).

.cau_error <- function(expr) tryCatch({ force(expr); NULL }, api_error = function(e) e)

test_that("un caso que cambia de fila pero no de id no cuenta como cambio", {
  previa <- data.frame(`_uuid` = c("a", "b", "c"), `_index` = 1:3, q1 = c("1", "2", "1"),
                       check.names = FALSE, stringsAsFactors = FALSE)
  nueva <- previa[c(3, 1, 2), ]
  nueva$`_index` <- 1:3
  r <- carga_actualizar_comparar(previa, nueva)
  expect_identical(unlist(r$identificador$columnas), "_uuid")
  expect_identical(c(r$casos$nuevos, r$casos$ya_no_vienen, r$casos$editados, r$casos$sin_cambios),
                   c(0L, 0L, 0L, 3L))
  expect_identical(r$casos$celdas_cambiadas, 0L)
  expect_identical(r$columnas$no_comparadas[[1]]$columna, "_index")
})

test_that("cuenta casos nuevos, que ya no vienen, editados y celdas por identificador", {
  previa <- data.frame(`_uuid` = c("a", "b", "c"), q1 = c("1", "2", "1"), q2 = c("x", NA, "y"),
                       vieja = 1, check.names = FALSE, stringsAsFactors = FALSE)
  nueva <- data.frame(`_uuid` = c("d", "c", "b"), q1 = c("1", "2", "2"), q2 = c("z", "w", ""),
                      extra = 2, check.names = FALSE, stringsAsFactors = FALSE)
  r <- carga_actualizar_comparar(previa, nueva)
  # c cambia q1 y q2 (2 celdas); b no cambia (NA y "" son el mismo vacío).
  expect_identical(c(r$casos$nuevos, r$casos$ya_no_vienen, r$casos$editados, r$casos$sin_cambios),
                   c(1L, 1L, 1L, 1L))
  expect_identical(r$casos$celdas_cambiadas, 2L)
  expect_identical(unlist(r$casos$ejemplos$editados), "c")
  expect_identical(unlist(r$casos$ejemplos$nuevos), "d")
  expect_identical(unlist(r$columnas$nuevas), "extra")
  expect_identical(unlist(r$columnas$ya_no_vienen), "vieja")
  expect_identical(vapply(r$columnas$con_cambios, `[[`, "", "columna"), c("q1", "q2"))
})

test_that("ids repetidos o vacíos en la versión nueva fallan con su causa", {
  previa <- data.frame(`_uuid` = c("a", "b"), q1 = 1:2, check.names = FALSE)
  dup <- data.frame(`_uuid` = c("a", "a", "b"), q1 = 1:3, check.names = FALSE)
  e <- .cau_error(carga_actualizar_comparar(previa, dup))
  expect_identical(e$code, "E_CARGA_ACTUALIZAR_IDENTIFICADOR")
  expect_identical(e$status, 422)
  expect_identical(e$details$motivo, "repetido")
  expect_identical(unlist(e$details$ejemplos), "a")
  expect_match(conditionMessage(e), "repite 1 identificador")

  vacio <- data.frame(`_uuid` = c("a", "", "b"), q1 = 1:3, check.names = FALSE)
  e2 <- .cau_error(carga_actualizar_comparar(previa, vacio))
  expect_identical(e2$details$motivo, "vacio")
  expect_identical(e2$details$n_filas, 1L)
})

test_that("sin identificador común los conteos por caso van NA con causa, nunca por posición", {
  r <- carga_actualizar_comparar(data.frame(x = 1:2), data.frame(x = c(9L, 9L, 9L)))
  expect_identical(c(r$casos$antes, r$casos$despues), c(2L, 3L))
  expect_true(is.na(r$casos$nuevos) && is.na(r$casos$editados))
  expect_match(r$casos$causa, "no comparten una columna")
  # Con la versión vigente repitiendo ids tampoco se empareja.
  r2 <- carga_actualizar_comparar(data.frame(`_uuid` = c("a", "a"), check.names = FALSE),
                                  data.frame(`_uuid` = c("a", "b"), check.names = FALSE))
  expect_true(is.na(r2$casos$nuevos))
  expect_match(r2$casos$causa, "versión vigente repite")
})

test_that("el destino de cada decisión de limpieza: sigue a la regla, congelada o por fila", {
  nueva <- data.frame(`_uuid` = c("u01", "u02", "u09"), check.names = FALSE)
  draft <- list(
    list(id = 1L, action_type = "ignore_rule", source_id = "R1", status = "ready"),
    list(id = 2L, action_type = "exclude_cases", source_id = "R2", status = "ready",
         target_case_ids_resueltos = list("u01", "u03"),
         identificacion_casos = list(metodo = "anterior", columna = "_uuid")),
    list(id = 3L, action_type = "exclude_cases", source_id = "R3", status = "ready",
         target_case_ids_resueltos = list("principal::row::4"),
         identificacion_casos = list(metodo = "anterior", columna = "posicion")),
    list(id = 4L, action_type = "exclude_cases", source_id = "R4", status = "ready",
         target_case_ids = list("x1"), identificacion_casos = list(metodo = "anterior", columna = "folio"))
  )
  d <- carga_actualizar_destino_decisiones(draft, nueva)
  expect_identical(vapply(d, `[[`, "", "destino"), c("conserva", "conserva", "se_pierde", "se_pierde"))
  expect_match(d[[1]]$causa, "Sigue a la regla")
  expect_identical(d[[2]]$n_casos_guardados, 2L)
  expect_identical(d[[2]]$n_casos_que_ya_no_vienen, 1L)
  expect_match(d[[3]]$causa, "número de fila")
  expect_match(d[[4]]$causa, "no viene en la versión nueva")
})

.cau_estudio_con_trabajo <- function() {
  sid <- .bv_estudio()
  validacion_scope_set(sid, "2026", "reglas_custom", list(list(id = "RC_001", nombre = "Propia")))
  validacion_scope_set(sid, "2026", "variables_excluidas", c("q3"))
  validacion_scope_set(sid, "2026", "evaluacion", list(resumen = data.frame()))
  validacion_scope_set(sid, "2026", "limpieza_draft", list(
    list(id = 1L, action_type = "exclude_cases", source_id = "R2", status = "ready",
         target_case_ids_resueltos = list("u01", "u39"),
         identificacion_casos = list(metodo = "anterior", columna = "_uuid")),
    list(id = 2L, action_type = "exclude_cases", source_id = "R3", status = "ready",
         target_case_ids_resueltos = list("principal::row::4"),
         identificacion_casos = list(metodo = "anterior", columna = "posicion"))
  ))
  sid
}

.cau_nueva <- function(sid, nombre = "v2.xlsx") {
  nueva <- .bv_data_2026()[c(30:1, 41), ]          # otro orden, sin u31..u40
  nueva$`_uuid`[31] <- "u41"
  nueva$q3[nueva$`_uuid` == "u05"] <- 99L          # una celda cambia
  save_upload(sid, "data", nombre, .bv_xlsx_bytes(list(data = nueva)))
}

test_that("la vista previa por HTTP no escribe la sesión y dice qué cambia y qué se conserva", {
  skip_if_not_installed("haven")
  sid <- .cau_estudio_con_trabajo()
  on.exit(session_delete(sid), add = TRUE)
  dmeta <- .cau_nueva(sid)
  antes <- session_get(sid)
  out <- .bv_call(mount_carga_actualizar, "POST", "/api/estudio/base/respuestas/vista-previa", sid,
                  body = list(nombre = "2026", data_file_id = dmeta$file_id))
  expect_identical(session_get(sid), antes)

  expect_true(isTRUE(out$ok))
  expect_identical(c(out$casos$antes, out$casos$despues), c(40L, 31L))
  expect_identical(c(out$casos$nuevos, out$casos$ya_no_vienen, out$casos$editados, out$casos$sin_cambios),
                   c(1L, 10L, 1L, 29L))
  expect_identical(out$casos$celdas_cambiadas, 1L)
  expect_identical(out$version_vigente$es, "vigente")
  expect_false(out$formulario$cambia)
  fases <- stats::setNames(out$fases, vapply(out$fases, `[[`, "", "fase"))
  expect_identical(names(fases), c("carga", "validacion", "codificacion", "analitica", "graficos"))
  conserva <- stats::setNames(fases$validacion$se_conserva,
                              vapply(fases$validacion$se_conserva, `[[`, "", "clave"))
  expect_identical(conserva$reglas_propias$n, 1L)
  expect_identical(conserva$variables_excluidas$n, 1L)
  expect_identical(conserva$decisiones_limpieza$n, 1L)
  expect_identical(fases$validacion$se_pierde[[1]]$n, 1L)
  expect_identical(fases$validacion$hay_que_rehacer[[1]]$n, 2L)   # 1 nuevo + 1 editado
  expect_identical(out$decisiones[[1]]$n_casos_que_ya_no_vienen, 1L)  # u39 ya no viene
  expect_null(out$respaldo)

  # Ids repetidos en la versión nueva: 422 con su causa por HTTP.
  dup <- .bv_data_2026(); dup$`_uuid`[2] <- "u01"
  dmeta2 <- save_upload(sid, "data", "dup.xlsx", .bv_xlsx_bytes(list(data = dup)))
  err <- .bv_call(mount_carga_actualizar, "POST", "/api/estudio/base/respuestas/vista-previa", sid,
                  body = list(nombre = "2026", data_file_id = dmeta2$file_id))
  expect_identical(err$error$code, "E_CARGA_ACTUALIZAR_IDENTIFICADOR")
})

test_that("con la base cerrada se compara contra la recibida, no contra la depurada", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  recibida <- s$estudio$bases[["2026"]]$data_file_id
  depurada <- save_upload(sid, "data", "limpia.xlsx", .bv_xlsx_bytes(list(data = .bv_data_2026()[1:35, ])))
  s$estudio$bases[["2026"]]$data_file_id <- depurada$file_id
  s$estudio$bases[["2026"]]$limpieza <- list(enabled = TRUE, source_data_file_id = recibida)
  .session_env[[sid]] <- s
  misma <- save_upload(sid, "data", "misma.xlsx", .bv_xlsx_bytes(list(data = .bv_data_2026())))
  out <- carga_actualizar_vista_previa(sid, "2026", misma$file_id)
  expect_identical(out$version_vigente$es, "recibida_antes_de_la_limpieza")
  expect_identical(c(out$casos$nuevos, out$casos$editados), c(0L, 0L))
  rehacer <- vapply(out$fases[[2]]$hay_que_rehacer, `[[`, "", "clave")
  expect_true("cierre" %in% rehacer)
})

test_that("aplicar conserva lo que no depende de la data, guarda copia y volver atrás la restituye", {
  skip_if_not_installed("haven")
  sid <- .cau_estudio_con_trabajo()
  on.exit(session_delete(sid), add = TRUE)
  meta_antes <- session_get(sid)$estudio$bases[["2026"]]
  dmeta <- .cau_nueva(sid)

  out <- .bv_call(mount_carga_actualizar, "POST", "/api/estudio/base/respuestas/actualizar", sid,
                  body = list(nombre = "2026", data_file_id = dmeta$file_id))
  expect_true(isTRUE(out$ok))
  expect_identical(out$cambios$casos$nuevos, 1L)
  expect_false(is.null(out$respaldo))
  meta <- session_get(sid)$estudio$bases[["2026"]]
  expect_identical(meta$data_file_id, dmeta$file_id)
  expect_identical(as.integer(meta$n_filas), 31L)
  v <- meta$validacion
  expect_length(v$reglas_custom, 1L)
  expect_identical(v$variables_excluidas, "q3")
  expect_null(v$evaluacion)                                   # hay que volver a auditar
  expect_identical(vapply(v$limpieza_draft, function(d) as.integer(d$id), 1L), 1L)  # la de fila se pierde

  back <- .bv_call(mount_carga_actualizar, "POST", "/api/estudio/base/respuestas/revertir", sid,
                   body = list(nombre = "2026"))
  expect_true(isTRUE(back$ok))
  meta2 <- session_get(sid)$estudio$bases[["2026"]]
  expect_identical(meta2$data_file_id, meta_antes$data_file_id)
  expect_identical(as.integer(meta2$n_filas), 40L)
  expect_length(meta2$validacion$limpieza_draft, 2L)
  expect_false(is.null(meta2$validacion$evaluacion))
  expect_identical(nrow(estudio_data_sources(sid)[["2026"]]), 40L)

  # La copia se usa una vez: volver de nuevo responde 409 con su causa.
  err <- .bv_call(mount_carga_actualizar, "POST", "/api/estudio/base/respuestas/revertir", sid,
                  body = list(nombre = "2026"))
  expect_identical(err$error$code, "E_CARGA_ACTUALIZAR_SIN_COPIA")
})

test_that("aplicar no cae en otra base: la hermana queda igual", {
  skip_if_not_installed("haven")
  sid <- .cau_estudio_con_trabajo()
  on.exit(session_delete(sid), add = TRUE)
  hermana <- session_get(sid)$estudio$bases[["2024"]]
  fid <- .cau_nueva(sid)$file_id
  carga_actualizar_aplicar(sid, "2026", fid)
  expect_identical(session_get(sid)$estudio$bases[["2024"]], hermana)
})

# Ronda 2 de la verificación (M1, M2, M3).

test_that("la llave declarada no se usa si es de posición o no es única en ambas versiones", {
  previa <- data.frame(`_uuid` = c("a", "b", "c"), `_index` = 1:3, distrito = c("d1", "d1", "d2"),
                       q1 = c("1", "2", "3"), check.names = FALSE, stringsAsFactors = FALSE)
  nueva <- previa[c(3, 1, 2), ]
  nueva$`_index` <- 1:3
  nueva$q1[nueva$`_uuid` == "a"] <- "9"
  # `_index` declarado: emparejaría por fila. Se ignora y rige `_uuid`.
  r <- carga_actualizar_comparar(previa, nueva, identidad_declarada = "_index")
  expect_identical(unlist(r$identificador$columnas), "_uuid")
  expect_identical(c(r$casos$editados, r$casos$sin_cambios), c(1L, 2L))
  # Una llave que repite valores no bloquea con 422: se ignora.
  r2 <- carga_actualizar_comparar(previa, nueva, identidad_declarada = "distrito")
  expect_identical(unlist(r2$identificador$columnas), "_uuid")
  # Única y sin vacíos en ambas: sí rige.
  previa$folio <- c("f1", "f2", "f3"); nueva$folio <- c("f3", "f1", "f2")
  r4 <- carga_actualizar_comparar(previa, nueva, identidad_declarada = "folio")
  expect_identical(r4$identificador$metodo, "llave_declarada")
})

test_that("con la identidad declarada apagada en Limpieza, la vista previa no la usa", {
  skip_if_not_installed("haven")
  skip_if(.limpieza_llave_declarada_activa(), "La identidad declarada está activa en Limpieza.")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  validacion_scope_set(sid, "2026", "operational_config",
                       list(identity = list(enabled = TRUE, variables = list("facultad"))))
  dmeta <- save_upload(sid, "data", "v2.xlsx", .bv_xlsx_bytes(list(data = .bv_data_2026())))
  fid <- dmeta$file_id
  out <- carga_actualizar_vista_previa(sid, "2026", fid)
  expect_identical(out$identificador$metodo, "columna_candidata")
  expect_identical(unlist(out$identificador$columnas), "_uuid")
})

test_that("la candidata tiene que ser única en la versión vigente; si no, la causa es de la vigente", {
  previa <- data.frame(`_uuid` = c("a", "a", "b"), respondent_id = c("r1", "r2", "r3"),
                       check.names = FALSE, stringsAsFactors = FALSE)
  nueva <- data.frame(`_uuid` = c("a", "a", "b"), respondent_id = c("r1", "r2", "r4"),
                      check.names = FALSE, stringsAsFactors = FALSE)
  # `_uuid` repite en la vigente: se pasa a la siguiente candidata.
  r <- carga_actualizar_comparar(previa, nueva)
  expect_identical(unlist(r$identificador$columnas), "respondent_id")
  expect_identical(c(r$casos$nuevos, r$casos$ya_no_vienen), c(1L, 1L))
  # Sin otra candidata: no culpa a la nueva con 422, dice que es la vigente.
  r2 <- carga_actualizar_comparar(previa["_uuid"], nueva["_uuid"])
  expect_true(is.na(r2$casos$nuevos))
  expect_match(r2$casos$causa, "versión vigente repite .* \"_uuid\"")
})

test_that("una copia dañada se dice: la info la marca ilegible y volver atrás responde 409 con causa", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  writeBin(as.raw(c(1, 2, 3)), .carga_actualizar_respaldo_path(sid, "2026"))
  info <- carga_actualizar_respaldo_info(sid, "2026")
  expect_false(info$legible)
  expect_match(info$causa, "dañada")
  e <- .cau_error(carga_actualizar_revertir(sid, "2026"))
  expect_identical(e$code, "E_CARGA_ACTUALIZAR_SIN_COPIA")
  expect_identical(e$details$motivo, "copia_ilegible")
})
