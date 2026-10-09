# =============================================================================
# «Columnas sin nombre»: las que tienen DATOS, no las que están vacías
# =============================================================================
#
# El aviso publica «N columnas de la Base de control tienen datos pero su
# cabecera está vacía en el Excel, así que no se leyeron», y `base_control_mapa()`
# sólo mira los TÍTULOS: una columna vacía con cabecera vacía entraba en la
# cuenta igual que una llena.
#
# Una columna del todo vacía no es un dato que se esté perdiendo —es una columna
# de sobra en la hoja— y avisar de ella manda a buscar algo que no existe. Es el
# mismo defecto que este loop corrigió en tres avisos: el conteo estaba bien y el
# universo mal delimitado.

.cbcsn_df <- function() data.frame(
  a = c("CH 1", "CH 2"), b = c("x", "y"),
  c = c("dato", "otro"),   # sin cabecera y CON datos
  d = c("", ""),           # sin cabecera y vacía
  stringsAsFactors = FALSE
)

test_that("solo cuenta las columnas sin cabecera que traen datos", {
  r <- base_control_a_filas(.cbcsn_df(), c("CURSO-HORARIO", "ASISTENTES", "", ""))
  expect_equal(as.integer(r$sin_nombre), 3L)
})

test_that("tambien filtra cuando el codigo de curso-horario no se reconoce", {
  # Por esa salida temprana se devolvia `sin_nombre` sin filtrar, asi que una
  # hoja con la cabecera cambiada seguia afirmando «tienen datos».
  r <- base_control_a_filas(.cbcsn_df(), c("OTRA COSA", "ASISTENTES", "", ""))
  expect_equal(as.integer(r$sin_nombre), 3L)
  expect_length(r$filas, 0L)
})

test_that("sin cuerpo no hay datos que perder en ninguna columna", {
  r <- base_control_a_filas(data.frame(), c("CURSO-HORARIO", ""))
  expect_length(r$sin_nombre, 0L)
})

test_that("una columna de NA no cuenta como columna con datos", {
  df <- data.frame(a = c("CH 1"), b = c(NA_character_), stringsAsFactors = FALSE)
  r <- base_control_a_filas(df, c("CURSO-HORARIO", ""))
  expect_length(r$sin_nombre, 0L)
})
