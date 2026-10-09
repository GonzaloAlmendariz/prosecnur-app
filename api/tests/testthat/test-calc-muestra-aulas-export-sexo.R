# El balance de sexo POR FACULTAD ya se calcula
# (`calc_muestra_aulas_adjuntar_sexo_facultad`) y la UI lo recibe: el router lo
# deriva AL SERVIR en router_calc_muestra.R:313. Pero el libro exportado no lo
# llevaba, y ese libro es lo que el cliente revisa.
#
# Importa porque el agregado global esconde el cruce: en HSVG2026, 53,8 % de
# mujeres en el marco contra 52,1 % en lo seleccionado pasa la tolerancia,
# mientras ARTE Y DISENO ofrece 62 % donde su cuota pide 78 %. La cuota de
# hombres y mujeres es POR FACULTAD, asi que el balance global no responde la
# pregunta que el analista tiene delante.

.exp_frame <- function() {
  af <- data.frame(
    classroom_id = paste0("CH", 1:6),
    faculty = rep(c("DERECHO", "PSICOLOGIA"), each = 3),
    eligible_n = c(20, 30, 25, 18, 22, 26),
    sex_top_1 = c("F", "F", "M", "F", "F", "F"),
    sex_top_1_n = c(14, 20, 15, 12, 15, 18),
    sex_top_2 = c("M", "M", "F", "M", "M", "M"),
    sex_top_2_n = c(6, 10, 10, 6, 7, 8),
    included = TRUE,
    stringsAsFactors = FALSE
  )
  list(aula_frame = af, audit = data.frame(clave = "x", valor = 1))
}

.exp_selection <- function() {
  list(
    selection = data.frame(
      classroom_id = c("CH1", "CH4"),
      faculty = c("DERECHO", "PSICOLOGIA"),
      sample_role = "titular",
      eligible_n = c(20, 18),
      sex_top_1 = "F", sex_top_1_n = c(14, 12),
      sex_top_2 = "M", sex_top_2_n = c(6, 6),
      stringsAsFactors = FALSE
    ),
    summary = data.frame(clave = "n", valor = 2),
    # La bitacora del libro compone una fila por campo: si alguno falta, el
    # data.frame se desalinea y el export cae antes de llegar a las hojas.
    selection_run_id = "run-test",
    frame_hash = "hash-test",
    seed = 202L,
    methodology = list(
      design = "conglomerado", selector = "cube_balanceado",
      probabilities = "pi", monte_carlo = "0",
      weights = "1/pi", representativity = "balance"
    )
  )
}

test_that("el libro exportado lleva el balance de sexo por facultad", {
  skip_if_not_installed("openxlsx")
  path <- withr::local_tempfile(fileext = ".xlsx")
  calc_muestra_aulas_exportar_workbook(.exp_frame(), .exp_selection(), path)

  hojas <- openxlsx::getSheetNames(path)
  expect_true("Sexo por facultad" %in% hojas)

  hoja <- openxlsx::read.xlsx(path, sheet = "Sexo por facultad")
  expect_true(nrow(hoja) >= 2)
  # Las columnas que hacen util la hoja: el marco, lo seleccionado y la brecha.
  for (col in c("facultad", "marco_mujeres", "titulares_mujeres", "brecha_pp")) {
    expect_true(col %in% names(hoja), info = col)
  }
  expect_setequal(hoja$facultad, c("DERECHO", "PSICOLOGIA"))
})

test_that("sin marco de referencia la hoja sale, y DECLARA que no hay con que comparar", {
  skip_if_not_installed("openxlsx")
  path <- withr::local_tempfile(fileext = ".xlsx")
  calc_muestra_aulas_exportar_workbook(
    list(aula_frame = data.frame(), audit = data.frame()),
    .exp_selection(), path
  )
  # Omitir la hoja escondería que la seleccion SI tiene composicion; dejarla en
  # blanco haria leer un vacio como una medicion. El motor resuelve las dos
  # cosas marcando `estado = sin_dato`, y la hoja lo publica.
  expect_true("Sexo por facultad" %in% openxlsx::getSheetNames(path))
  hoja <- openxlsx::read.xlsx(path, sheet = "Sexo por facultad")
  expect_setequal(hoja$estado, "sin_dato")
  expect_true(all(is.na(hoja$marco_mujeres)))
  # Y lo que si se sabe no se pierde: los titulares llevan su composicion.
  expect_equal(sort(as.numeric(hoja$titulares_mujeres)), c(12, 14))
})

test_that("las columnas numericas de la hoja son numeros, no texto", {
  skip_if_not_installed("openxlsx")
  path <- withr::local_tempfile(fileext = ".xlsx")
  calc_muestra_aulas_exportar_workbook(.exp_frame(), .exp_selection(), path)
  hoja <- openxlsx::read.xlsx(path, sheet = "Sexo por facultad")
  # Un Excel con numeros en texto no se puede sumar y cada celda sale con el
  # aviso de «numero almacenado como texto». El cliente totaliza columnas.
  for (col in c("aulas_titulares", "marco_mujeres", "titulares_mujeres", "brecha_pp")) {
    expect_true(is.numeric(hoja[[col]]), info = col)
  }
})
