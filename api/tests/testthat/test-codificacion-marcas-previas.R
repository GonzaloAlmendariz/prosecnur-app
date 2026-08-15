# Al clasificar una respuesta abierta de una select_multiple, el analista no
# veía qué opciones había marcado esa misma persona. Y eso cambia la decisión
# correcta: si manda el texto a un código que la persona YA marcó, el recodeo
# es una operación nula —la mención ya existe— y el matiz que escribió se
# pierde; si lo manda a uno que no marcó, le suma una mención y mueve el
# porcentaje de esa categoría.
#
# En ACNUR V3 eran 18 de 47 respuestas abiertas: el 38%.

test_that("las marcas por fila se leen de la columna SM separada por espacios", {
  data_df <- data.frame(
    servicios = c("1 3", "2", "", NA_character_, "  4   5  "),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  marcas <- prosecnurapp:::.sm_marcas_por_fila("servicios", data_df)

  expect_length(marcas, 5L)
  expect_equal(marcas[[1]], c("1", "3"))
  expect_equal(marcas[[2]], "2")
  # Vacío y NA no inventan un código "" que después se vería como opción.
  expect_length(marcas[[3]], 0L)
  expect_length(marcas[[4]], 0L)
  expect_equal(marcas[[5]], c("4", "5"))
})

test_that("una columna que no existe no rompe: devuelve NULL y la respuesta sale sin marcas", {
  data_df <- data.frame(otro_txt = "algo", stringsAsFactors = FALSE)
  expect_null(prosecnurapp:::.sm_marcas_por_fila(c("no_existe", "tampoco"), data_df))
  expect_null(prosecnurapp:::.sm_marcas_por_fila("", data_df))
})

test_that("cada respuesta declara qué códigos ya tenían marcados sus filas", {
  data_df <- data.frame(
    `_uuid` = c("u1", "u2", "u3", "u4"),
    servicios = c("1 3", "1", "2", "3"),
    servicios_otro = c("apoyo legal", "apoyo legal", "apoyo legal", "beca"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  marcas <- prosecnurapp:::.sm_marcas_por_fila("servicios", data_df)
  out <- prosecnurapp:::.respuestas_unicas("servicios_otro", data_df,
                                           marcas_por_fila = marcas)

  legal <- Filter(function(r) identical(r$texto, "apoyo legal"), out)[[1]]
  expect_equal(legal$frecuencia, 3L)
  # Tres personas escribieron el mismo texto y marcaron cosas distintas: el
  # aviso tiene que ir en proporción, no como un sí/no.
  marcadas <- vapply(legal$ya_marcadas, function(m) m$codigo, character(1))
  cuantas <- vapply(legal$ya_marcadas, function(m) m$n, integer(1))
  names(cuantas) <- marcadas
  expect_equal(as.integer(cuantas[["1"]]), 2L)   # u1 y u2
  expect_equal(as.integer(cuantas[["3"]]), 1L)   # solo u1
  expect_equal(as.integer(cuantas[["2"]]), 1L)   # solo u3

  beca <- Filter(function(r) identical(r$texto, "beca"), out)[[1]]
  expect_equal(beca$frecuencia, 1L)
  expect_equal(vapply(beca$ya_marcadas, function(m) m$codigo, character(1)), "3")
})

test_that("sin marcas la respuesta trae la lista vacía, no la clave ausente", {
  # El control: si el motor dejara de contar marcas, este test seguiría
  # pasando sólo si `ya_marcadas` existe y está vacía — que es lo que el
  # cliente necesita para distinguir "no aplica" de "no marcó nada".
  data_df <- data.frame(
    `_uuid` = c("u1", "u2"),
    respuesta_txt = c("uno", "dos"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  out <- prosecnurapp:::.respuestas_unicas("respuesta_txt", data_df)
  expect_true(all(vapply(out, function(r) "ya_marcadas" %in% names(r), logical(1))))
  expect_true(all(vapply(out, function(r) length(r$ya_marcadas) == 0L, logical(1))))
})

test_that("las filas con texto vacío no corren las marcas de las que sí tienen", {
  # `.respuestas_unicas` descarta las filas sin texto. Si el filtro no se
  # aplicara también al vector de marcas, los índices quedarían corridos y
  # cada respuesta reportaría las marcas de otra persona.
  data_df <- data.frame(
    `_uuid` = c("u1", "u2", "u3"),
    servicios = c("9", "1", "2"),
    servicios_otro = c("", "apoyo legal", "beca"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  marcas <- prosecnurapp:::.sm_marcas_por_fila("servicios", data_df)
  out <- prosecnurapp:::.respuestas_unicas("servicios_otro", data_df,
                                           marcas_por_fila = marcas)

  legal <- Filter(function(r) identical(r$texto, "apoyo legal"), out)[[1]]
  expect_equal(vapply(legal$ya_marcadas, function(m) m$codigo, character(1)), "1")
  beca <- Filter(function(r) identical(r$texto, "beca"), out)[[1]]
  expect_equal(vapply(beca$ya_marcadas, function(m) m$codigo, character(1)), "2")
})

test_that("cuando el draft no trae parent_col, el nombre del padre es candidato", {
  # En ACNUR V3 los siete select_multiple tienen `parent_col` vacío en el
  # draft y la columna en la data se llama igual que el padre. Si el nombre
  # del padre no fuera candidato, `ya_marcadas` saldría vacío en todos.
  data_df <- data.frame(
    UNCHR_improving = c("1 3", "2"),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  marcas <- prosecnurapp:::.sm_marcas_por_fila(c("", "UNCHR_improving"), data_df)
  expect_equal(marcas[[1]], c("1", "3"))
  expect_equal(marcas[[2]], "2")
})

test_that("cuando la data sólo trae dummies por opción, también se leen", {
  # La otra forma en que Kobo exporta una select_multiple: una columna 0/1 por
  # opción. Un proyecto puede tener sólo esta.
  data_df <- data.frame(
    check.names = FALSE, stringsAsFactors = FALSE,
    `serv/1` = c(1L, 0L, 1L),
    `serv/3` = c(0L, 0L, 1L),
    `serv/96` = c("TRUE", "FALSE", "FALSE")
  )
  marcas <- prosecnurapp:::.sm_marcas_por_fila("serv", data_df)
  expect_equal(sort(marcas[[1]]), sort(c("1", "96")))
  expect_length(marcas[[2]], 0L)
  expect_equal(sort(marcas[[3]]), sort(c("1", "3")))
})
