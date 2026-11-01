# L36 · DOC.1 — el cuestionario impreso lee su tipografía y sus colores del
# estándar (`inst/estandar/estandar_pulso.json` -> `cuestionario`), no de
# constantes propias del motor.

test_that("el estándar declara la tipografía y los colores del cuestionario", {
  expect_identical(.std_cuestionario("tipografia", "fuente"), "Arial Narrow")
  expect_equal(.std_cuestionario("tipografia", "cuerpo"), 10)
  expect_equal(.std_cuestionario("tipografia", "minimo"), 8)
  for (nombre in c("tinta", "rejilla", "banda", "banda_sub", "cebra")) {
    expect_match(.std_cuestionario("colores", nombre), "^#[0-9A-Fa-f]{6}$", info = nombre)
  }
  expect_error(.std_cuestionario("colores", "acento"), "Token del estándar inexistente")
})

test_that("los motores de Word del cuestionario no llevan colores escritos a mano", {
  for (archivo in c("reporte_formulario_word.R", "reporte_formulario_ricotexto_word.R")) {
    datos <- utils::getParseData(parse(test_path("..", "..", "R", archivo), keep.source = TRUE))
    literales <- datos$text[datos$token == "STR_CONST"]
    hex <- unique(literales[grepl("^.#[0-9A-Fa-f]{6}.$", literales)])
    expect_identical(hex, character(0), info = archivo)
  }
})
