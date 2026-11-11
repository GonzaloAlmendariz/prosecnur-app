# Conteo previo y llave declarada (reglas_custom_probar.R). El id de un
# ejemplo del conteo previo es el mismo de la cola y GET /caso lo encuentra.
# La llave declarada está apagada en M2 (`.LIMPIEZA_IDENTIDAD_DECLARADA_ACTIVA`):
# aunque el estudio la declare, los ids son los de la columna candidata.

test_that("el id de un ejemplo del conteo previo es el de la cola y GET /caso lo encuentra", {
  dir <- withr::local_tempdir()
  sid <- .m1_sesion(dir, datos_personas = .m2_datos_un_caso_dos_hallazgos())
  withr::defer(session_delete(sid))
  .m2_declarar_llave(sid, "Personas", "caso")
  out <- reglas_custom_probar(sid, "Personas", .m1_regla_edad())
  ids <- vapply(out$ejemplos, function(e) e$id_caso, character(1))
  expect_identical(ids, "u01")

  validacion_scope_set(sid, "Personas", "reglas_custom", list(.m1_regla_edad()))
  .m2_auditar(sid, "Personas")
  expect_identical(.m2_ids_marcados(sid, "Personas", "RC_001"), ids)
  r <- .m1_http(.m1_router(), sid, "GET", "/api/validacion/v2/caso",
                query = paste0("id=", ids, "&base_nombre=Personas"))
  expect_identical(r$status, 200L)
})
