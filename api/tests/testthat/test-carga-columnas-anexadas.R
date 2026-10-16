# Anexar columnas desde otro archivo, unidas por identificador.

.ca_archivo <- function(n = 40L) {
  data.frame(`_uuid` = sprintf("u%02d", seq_len(n)),
             cruce_externo = rep(c(1, 2), length.out = n),
             otra = rep("x", n), check.names = FALSE, stringsAsFactors = FALSE)
}

test_that("la vista propone la clave común y lista las columnas", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  f <- save_upload(sid, "data", "cruces.xlsx", .bv_xlsx_bytes(list(data = .ca_archivo(30L))))
  v <- base_columnas_anexar_vista(sid, "2026", f$file_id)
  expect_identical(v$claves[[1]]$clave, "_uuid")
  expect_identical(v$claves[[1]]$n_coinciden, 30L)
  expect_setequal(vapply(v$columnas, `[[`, "", "nombre"), c("cruce_externo", "otra"))
})

test_that("las columnas anexadas llegan a la base, sirven a una calculada y sobreviven a otra versión", {
  skip_if_not_installed("haven")
  sid <- .bv_estudio()
  on.exit(session_delete(sid), add = TRUE)
  f <- save_upload(sid, "data", "cruces.xlsx", .bv_xlsx_bytes(list(data = .ca_archivo(30L))))
  r <- base_columnas_anexar(sid, "2026", f$file_id, "_uuid", list("cruce_externo"))
  expect_identical(c(r$n_base, r$n_con_dato), c(40L, 30L))
  d <- estudio_data_sources(sid)[["2026"]]
  expect_true("cruce_externo" %in% names(d))
  expect_identical(sum(!is.na(d$cruce_externo)), 30L)
  # Una calculada puede partir de una columna anexada.
  base_variables_guardar_calculada(sid, "2026", list(
    nombre = "es_uno", etiqueta = "Es uno", regla = "formula", expresion = "cruce_externo * 1"))
  expect_true("es_uno" %in% names(estudio_data_sources(sid)[["2026"]]))
  # Otra versión de las respuestas: se vuelven a unir por la clave.
  nueva <- save_upload(sid, "data", "v2.xlsx", .bv_xlsx_bytes(list(data = .bv_data_2026()[1:20, ])))
  carga_reemplazar_respuestas(sid, "2026", nueva$file_id)
  d2 <- estudio_data_sources(sid)[["2026"]]
  expect_identical(nrow(d2), 20L)
  expect_identical(sum(!is.na(d2$cruce_externo)), 20L)
  # No pisa una columna que la base ya trae.
  f2 <- save_upload(sid, "data", "otro.xlsx", .bv_xlsx_bytes(list(data = data.frame(`_uuid` = "u01", q1 = "9", check.names = FALSE))))
  expect_error(base_columnas_anexar(sid, "2026", f2$file_id, "_uuid", list("q1")), class = "api_error")
  # Quitar.
  base_columnas_anexadas_quitar(sid, "2026", list("cruce_externo"))
  expect_false("cruce_externo" %in% names(estudio_data_sources(sid)[["2026"]]))
})
