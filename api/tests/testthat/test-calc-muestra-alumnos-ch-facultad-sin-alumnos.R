# Una facultad con aulas elegibles pero sin alumnos del estudio bloquea el calculo.
#
# Encontrado sobre el proyecto real (HSVG 2026) por la ruta real —el endpoint
# `/calcular`, no el motor a pelo—: la llamada devuelve 409 con
# `E_CALC_MUESTRA_ALUMNOS_CH_DECISION` y `faltantes = ["escuela_de_posgrado"]`.
#
# El mecanismo es una asimetria entre los dos universos del estudio:
#
#   - el contrato de alumnos por CH enumera las facultades con al menos un
#     curso-horario ELEGIBLE (`.cm_alumnos_por_ch_fila_es_muestreable`);
#   - los estratos del estudio se arman con las facultades que tienen
#     ESTUDIANTES elegibles.
#
# Escuela de Posgrado tiene 2 cursos-horario elegibles y 33 matriculas, asi que
# entra en el primero; pero el estudio es de pregrado regular, asi que no entra
# en el segundo. `setequal(seen, contract_keys)` falla y no hay forma de
# calcular sin tocar los criterios.
#
# El guard ya contempla el caso opuesto —una facultad con 0 cursos-horario
# elegibles se filtra, y el comentario del motor lo explica: «el contrato pedia
# algo imposible»—. Este es el mismo problema por el otro lado, y no esta
# contemplado.
#
# Este archivo no elige el arreglo: fija el fallo y el detalle que hoy publica,
# para que se vea si cambia. La decision de fondo —si la cobertura debe exigirse
# sobre la interseccion de los dos universos, o si un curso-horario de posgrado
# no deberia estar en el marco de un estudio de pregrado— es metodologica.

.apc_fila <- function(key, label, n_ch, media = 20, mediana = 18) {
  list(
    faculty_key = key, faculty_label = label, row_kind = "faculty",
    elegible = list(
      n_ch = as.integer(n_ch), n_ch_con_dato = as.integer(n_ch),
      n_matriculas_elegibles = as.numeric(n_ch) * media,
      distribution = list(media = media, p25 = mediana - 4, p50 = mediana)
    )
  )
}

test_that("el contrato solo pide facultades con cursos-horario elegibles", {
  # Lo que YA estaba resuelto: sin aulas elegibles la facultad no se exige.
  filas <- list(
    .apc_fila("derecho", "DERECHO", 440),
    .apc_fila("escuela_de_estudios_especiales", "ESCUELA DE ESTUDIOS ESPECIALES", 0),
    list(faculty_key = "total", row_kind = "total", elegible = list(n_ch = 2468L))
  )
  keys <- names(.cm_alumnos_por_ch_rows_by_key(list(filas = filas)))
  expect_identical(keys, "derecho")
  expect_false("escuela_de_estudios_especiales" %in% keys)
  expect_false("total" %in% keys)
})

test_that("una facultad con aulas elegibles SI se exige, aunque el estudio no la tenga", {
  # EL caso del proyecto real. Posgrado tiene 2 cursos-horario elegibles, asi
  # que el contrato la pide; el estudio de pregrado no la declara como estrato.
  filas <- list(
    .apc_fila("derecho", "DERECHO", 440),
    .apc_fila("escuela_de_posgrado", "ESCUELA DE POSGRADO", 2, media = 16.5)
  )
  keys <- names(.cm_alumnos_por_ch_rows_by_key(list(filas = filas)))
  expect_true("escuela_de_posgrado" %in% keys)
  expect_length(keys, 2L)

  # Y con dos aulas de posgrado la cobertura que se exige ya no coincide con la
  # que el estudio puede declarar: esa es la diferencia que rompe el calculo.
  estratos_del_estudio <- "derecho"
  expect_false(setequal(estratos_del_estudio, keys))
  expect_identical(setdiff(keys, estratos_del_estudio), "escuela_de_posgrado")
})

test_that("el fallo nombra la facultad que falta, no solo el hecho", {
  # El detalle existe en el payload —`faltantes`— y es lo unico accionable del
  # error. Si se pierde, al usuario le queda «no cubre las facultades» sin saber
  # cual ni por que, que es exactamente lo que vio en pantalla.
  err <- tryCatch(
    .cm_alumnos_por_ch_fail(
      "facultades_incompletas",
      "Cada componente P1/P2 debe cubrir exactamente las facultades del marco vigente.",
      details = list(actor = "estudiantes_universidad",
                     faltantes = list("escuela_de_posgrado"), sobrantes = list())
    ),
    error = function(e) e
  )
  expect_s3_class(err, "condition")
  payload <- err$data %||% err$details %||% list()
  texto <- paste(utils::capture.output(str(payload)), collapse = " ")
  expect_true(grepl("escuela_de_posgrado", texto, fixed = TRUE))
  expect_true(grepl("facultades_incompletas", texto, fixed = TRUE))
})
