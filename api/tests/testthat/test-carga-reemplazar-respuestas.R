# Carga › Fuentes: una base cargada desde archivo recibe la versión nueva de sus
# respuestas sin perder lo que declara (ADR 0100 D1). Fixtures en
# helper-base-variables.R.

.crr_recurrio <- list(nombre = "recurrio", etiqueta = "Recurrió a alguna instancia",
                      regla = "alguna", variables = list("q1", "q2"), codigos = list("1"))

test_that("compara casos por identificador y columnas que llegan o dejan de venir", {
  previa <- data.frame(`_uuid` = c("a", "b", "c"), q1 = 1:3, vieja = 1, check.names = FALSE)
  nueva <- data.frame(`_uuid` = c("b", "c", "d", "e"), q1 = 1:4, seleccionado = 1, check.names = FALSE)
  r <- carga_comparar_respuestas(previa, nueva)
  expect_identical(r$casos$clave, "_uuid")
  expect_identical(c(r$casos$antes, r$casos$despues), c(3L, 4L))
  expect_identical(c(r$casos$se_mantienen, r$casos$nuevos, r$casos$ya_no_vienen), c(2L, 2L, 1L))
  expect_identical(unlist(r$columnas_nuevas), "seleccionado")
  expect_identical(unlist(r$columnas_que_no_vienen), "vieja")

  # Sin identificador común sólo hay totales.
  sin <- carga_comparar_respuestas(data.frame(x = 1:2), data.frame(x = 1:5))
  expect_identical(sin$casos$clave, "")
  expect_null(sin$casos$nuevos)
})

test_that("la versión nueva reemplaza la data y la base conserva sus variables calculadas", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  base_variables_guardar_calculada(sid, "2026", .crr_recurrio)
  formulario_antes <- session_get(sid)$estudio$bases[["2026"]]$xlsform_file_id

  nueva <- .bv_data_2026()[1:30, ]
  nueva$seleccionado <- rep(c(1L, 0L, 1L), length.out = 30L)
  dmeta <- save_upload(sid, "data", "data_2026_v2.xlsx", .bv_xlsx_bytes(list(data = nueva)))
  out <- .bv_call(mount_carga_reemplazar_respuestas, "POST", "/api/estudio/base/respuestas", sid,
                  body = list(nombre = "2026", data_file_id = dmeta$file_id))

  expect_true(isTRUE(out$ok))
  expect_identical(out$cambios$casos$clave, "_uuid")
  expect_identical(c(out$cambios$casos$antes, out$cambios$casos$despues), c(40L, 30L))
  expect_identical(c(out$cambios$casos$nuevos, out$cambios$casos$ya_no_vienen), c(0L, 10L))
  expect_identical(unlist(out$cambios$columnas_nuevas), "seleccionado")

  meta <- session_get(sid)$estudio$bases[["2026"]]
  expect_identical(meta$data_file_id, dmeta$file_id)
  expect_identical(meta$xlsform_file_id, formulario_antes)
  expect_identical(as.integer(meta$n_filas), 30L)
  # Lo que la base declara sigue y se calcula sobre la data nueva.
  r <- base_variables_consultar(sid, "2026")
  expect_identical(vapply(r$calculadas, `[[`, "", "nombre"), "recurrio")
  expect_true("seleccionado" %in% vapply(r$extras, `[[`, "", "name"))
  fuente <- estudio_data_sources(sid)[["2026"]]
  expect_identical(nrow(fuente), 30L)
  expect_true(all(c("recurrio", "seleccionado") %in% names(fuente)))
})

test_that("una base inexistente responde 404", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  estudio_ensure(sid)
  expect_error(carga_reemplazar_respuestas(sid, "nada", "x"), class = "api_error")
})

test_that("en el modo de una base el reemplazo compara con el archivo anterior", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  a <- save_upload(sid, "data", "a.xlsx", .bv_xlsx_bytes(list(data = .bv_data_2026())))
  nueva <- .bv_data_2026()[1:25, ]
  nueva$seleccionado <- 1L
  b <- save_upload(sid, "data", "b.xlsx", .bv_xlsx_bytes(list(data = nueva)))
  expect_null(carga_cambios_contra_archivo_previo(sid, NULL, b))
  r <- carga_cambios_contra_archivo_previo(sid, list(path = a$path, ext = a$ext), b)
  expect_identical(c(r$casos$antes, r$casos$despues, r$casos$ya_no_vienen), c(40L, 25L, 15L))
  expect_identical(unlist(r$columnas_nuevas), "seleccionado")
  expect_false(r$codificacion_por_readaptar)
  # Con grupos de codificación, avisa que hay que volver a adaptar.
  s <- session_get(sid)
  s$codif_por_base <- list(default = list(grupos_recod = list(P3 = list(list(label = "x")))))
  .session_env[[sid]] <- s
  expect_true(carga_cambios_contra_archivo_previo(sid, list(path = a$path, ext = a$ext), b)$codificacion_por_readaptar)
})

test_that("reemplazar las respuestas descarta el par adaptado global: Analítica no lee la base vieja", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$codif_aplicado <- TRUE
  s$codif_data_adaptada_fid <- "fid_viejo"
  s$codif_inst_adaptado_fid <- "fid_inst_viejo"
  s$analitica_fuente <- "estudio:2026"
  .session_env[[sid]] <- s
  dmeta <- save_upload(sid, "data", "v2.xlsx", .bv_xlsx_bytes(list(data = .bv_data_2026()[1:20, ])))
  carga_reemplazar_respuestas(sid, "2026", dmeta$file_id)
  s2 <- session_get(sid)
  expect_false(isTRUE(s2$codif_aplicado))
  expect_null(s2$codif_data_adaptada_fid)
  expect_null(s2$codif_inst_adaptado_fid)
  # Adaptación avisará que la base cambió aunque la marca por base no existiera.
  s3 <- session_get(sid)
  s3$codif_por_base <- list(`2026` = list(grupos_recod = list(a = 1)))
  s3$codif_aplicado <- TRUE
  s3$codif_data_adaptada_fid <- "otro"
  s3$analitica_fuente <- "estudio:2026"
  .session_env[[sid]] <- s3
  carga_reemplazar_respuestas(sid, "2026", dmeta$file_id)
  expect_true(codificacion_respuestas_cambiaron(sid, source = "2026"))
})
