# El fallo de cobertura de facultades dice CUAL falta y POR QUE.
#
# Medido sobre el estudio real: `/calcular` devolvia 409 con «Cada componente
# P1/P2 debe cubrir exactamente las facultades del marco vigente» y las
# facultades solo en `details`, que la pantalla no muestra. El usuario quedaba
# bloqueado leyendo el hecho, sin la causa ni una salida.

test_that("nombra la facultad que falta y donde se resuelve", {
  msg <- .cm_alumnos_ch_mensaje_cobertura("escuela_de_posgrado", character(0))
  # La facultad se nombra, y se nombra legible: la clave con guiones bajos se
  # leia en pantalla como un identificador de base de datos.
  expect_true(grepl("Escuela de posgrado", msg, fixed = TRUE))
  # La causa medida, no el sintoma: el curso esta catalogado bajo una facultad
  # a la que no pertenecen sus alumnos.
  expect_true(grepl("no pertenece ninguno de sus alumnos elegibles", msg, fixed = TRUE))
  # Y las dos salidas reales.
  expect_true(grepl("coherencia de facultad", msg, fixed = TRUE))
  expect_true(grepl("incluye esa facultad en el estudio", msg, fixed = TRUE))
})

test_that("faltante y sobrante son problemas distintos y se dicen distinto", {
  # No es lo mismo que el marco tenga aulas que el estudio no cubre, que el
  # estudio declare una facultad sin aulas elegibles. Decir «no coinciden»
  # manda a girar la perilla equivocada la mitad de las veces.
  falta <- .cm_alumnos_ch_mensaje_cobertura("derecho", character(0))
  sobra <- .cm_alumnos_ch_mensaje_cobertura(character(0), "educacion")
  expect_true(grepl("el estudio no la declara", falta, fixed = TRUE))
  expect_false(grepl("no puede recibir cuota", falta, fixed = TRUE))
  expect_true(grepl("no puede recibir cuota", sobra, fixed = TRUE))
  expect_false(grepl("el estudio no la declara", sobra, fixed = TRUE))

  # Con las dos, el mensaje trae las dos.
  ambas <- .cm_alumnos_ch_mensaje_cobertura("derecho", "educacion")
  expect_true(grepl("Derecho", ambas, fixed = TRUE))
  expect_true(grepl("Educacion", ambas, fixed = TRUE))
})

test_that("con muchas facultades resume en vez de volverse ilegible", {
  msg <- .cm_alumnos_ch_mensaje_cobertura(
    c("a", "b", "c", "d", "e", "f"), character(0)
  )
  expect_true(grepl("A, B, C, D y 2 más", msg, fixed = TRUE))
  # Justo en el limite no resume.
  expect_true(grepl("A, B, C, D", .cm_alumnos_ch_mensaje_cobertura(c("a","b","c","d"), character(0)), fixed = TRUE))
  expect_false(grepl("más", .cm_alumnos_ch_mensaje_cobertura(c("a","b","c","d"), character(0)), fixed = TRUE))
})

test_that("sin listas no promete una causa que no se midio", {
  # Este caso no deberia ocurrir —si no falta ni sobra nadie, no hay fallo—,
  # pero si ocurre es peor inventar una explicacion que quedarse en el hecho.
  generico <- .cm_alumnos_ch_mensaje_cobertura(character(0), character(0))
  expect_true(grepl("cubrir exactamente las facultades", generico, fixed = TRUE))
  expect_false(grepl("catalogado", generico, fixed = TRUE))
  # Vacios de todas las formas en que pueden llegar desde `setdiff`.
  expect_identical(.cm_alumnos_ch_mensaje_cobertura(NULL, NULL), generico)
  expect_identical(.cm_alumnos_ch_mensaje_cobertura(list(), list()), generico)
  expect_identical(.cm_alumnos_ch_mensaje_cobertura("", ""), generico)
})

test_that("el fallo publica el mensaje con causa y conserva el detalle", {
  err <- tryCatch(
    .cm_alumnos_por_ch_fail(
      "facultades_incompletas",
      .cm_alumnos_ch_mensaje_cobertura("escuela_de_posgrado", character(0)),
      details = list(actor = "estudiantes_universidad",
                     faltantes = as.list("escuela_de_posgrado"),
                     sobrantes = list())
    ),
    error = function(e) e
  )
  expect_s3_class(err, "condition")
  texto <- paste(utils::capture.output(str(err)), collapse = " ")
  expect_true(grepl("escuela_de_posgrado", texto, fixed = TRUE))
  # El detalle estructurado no se pierde por hacer legible el mensaje.
  expect_true(grepl("faltantes", texto, fixed = TRUE))
  expect_true(grepl("facultades_incompletas", texto, fixed = TRUE))
})
