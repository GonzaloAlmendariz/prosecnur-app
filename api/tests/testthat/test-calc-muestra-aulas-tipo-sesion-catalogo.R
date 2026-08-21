# El tipo de sesion del catalogo institucional (DTI PUCP).
#
# Medido en el recorrido de un usuario nuevo con el catalogo real 2026-2: la
# columna que trae el tipo de curso se llama DESCTIPOCURSO (TEORICO,
# LABORATORIO, TALLER, SEMINARIO, ACTIVIDAD…) y los sinonimos de `session_type`
# no la reconocian. Sin esa variable el motor no emite `criterios_radiografia`,
# asi que la pestaña de criterios quedaba en «RADIOGRAFIA POR FACULTAD
# PENDIENTE» y su boton «Actualizar radiografia» reconstruia el marco entero
# —40 s— sin poder resolverlo nunca: un estado sin salida. Es ademas la
# variable con la que se declara el criterio que definio el marco de 2025
# (excluir seminarios, tesis, asesorias).

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
