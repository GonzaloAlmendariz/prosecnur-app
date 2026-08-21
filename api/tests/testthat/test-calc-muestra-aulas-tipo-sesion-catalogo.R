# El tipo de sesion del catalogo institucional (DTI PUCP).
#
# Medido en el recorrido de un usuario nuevo con el catalogo real 2026-2: la
# columna que trae el tipo de curso se llama DESCTIPOCURSO (TEORICO,
# LABORATORIO, TALLER, SEMINARIO, ACTIVIDAD…) y los sinonimos de `session_type`
# no la reconocian: `.cm_aulas_col()` devolvia vacio teniendo la columna
# delante.
#
# ALCANCE, medido despues: por el camino CON catalogo la señal ya se resolvia
# sin este alias (`.cm_catalogo_signal_candidates` inyecta «tipo»,
# «tipo_curso», … y ahi si casaba), asi que esto NO era lo que bloqueaba la
# radiografia por facultad —esa depende de que haya criterios declarados—. El
# alias cubre el camino en que la columna llega con su nombre crudo y se
# resuelve contra `mapping$session_type`.

test_that("el catalogo del DTI resuelve su tipo de curso como session_type", {
  catalogo <- data.frame(
    CLAVECURSO = c("DER101", "DER102"),
    HORARIO = c("0801", "0802"),
    DESCTIPOCURSO = c("TEORICO", "SEMINARIO"),
    stringsAsFactors = FALSE
  )

  sinonimos <- calc_muestra_aulas_default_config()$mapping$session_type
  expect_true(length(sinonimos) > 0)
  expect_identical(.cm_aulas_col(catalogo, sinonimos), "DESCTIPOCURSO")
})

test_that("los nombres ya soportados siguen resolviendo", {
  for (col in c("session_type", "tipo_sesion", "tipo_curso")) {
    df <- data.frame(x = 1, stringsAsFactors = FALSE)
    names(df) <- col
    sinonimos <- calc_muestra_aulas_default_config()$mapping$session_type
    expect_identical(.cm_aulas_col(df, sinonimos), col)
  }
})
