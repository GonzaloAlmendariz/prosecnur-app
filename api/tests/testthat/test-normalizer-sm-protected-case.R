# Regresion: el texto libre `<parent>_otro` vacio no es una dummy de opcion,
# tampoco cuando llega con otra capitalizacion.
#
# Caso real (CCSS Perfil 2026-II, validacion de la base total): `lector_limpieza`
# baja los nombres a minuscula (`b1_otro`) y `.restore_instrument_case_aliases`
# repone los del XLSForm (`B1_otro`), asi que conviven las dos variantes. Con
# «Otro» vacio en toda la base, la columna tiene forma de dummy (una dummy sin
# marcas). La proteccion de variables del survey comparaba con mayusculas
# (`B1_otro`) y la busqueda de candidatas no (H67), asi que `b1_otro` pasaba como
# dummy de opcion, el normalizador reconstruia la madre desde ella y B1 quedaba
# vacia en los 467 casos: 934 inconsistencias espurias de required/skip.

test_that("una variable del survey con otra capitalizacion no se toma como dummy de opcion", {
  inst <- list(
    survey = data.frame(
      type = c("select_multiple transporte", "text"),
      name = c("B1", "B1_otro"),
      list_name = c("transporte", NA),
      label = c("Medios de transporte", "Otro medio"),
      required = c("true", "true"),
      relevant = c("", "selected(${B1}, '70')"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = rep("transporte", 3),
      name = c("1", "3", "70"),
      label = c("Caminata", "Transporte publico", "Otro"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )

  # Madre poblada, texto libre vacio en todas las filas y su copia en minuscula.
  raw <- data.frame(
    B1 = c("1", "3", "1 3", "3"),
    B1_otro = c(NA_character_, NA_character_, NA_character_, NA_character_),
    b1_otro = c(NA_character_, NA_character_, NA_character_, NA_character_),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  nd <- normalize_data_for_xlsform(raw, inst)

  # La madre conserva sus valores: ninguna fila marcada queda vacia.
  expect_identical(as.vector(nd$B1), raw$B1)
  # El texto libre no se consume como dummy.
  expect_true("B1_otro" %in% names(nd))
})
