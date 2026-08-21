# El error que ve quien cambia su base por una version con otros encabezados.
#
# Medido en HSVG2026: su mapeo declaraba `student_id = "Código PUCP"` sobre
# archivos que traen ALUMNO. El motor moria con «No se encontro columna de
# estudiante. Configura mapping$student_id.» — cierto pero inutil: no decia QUE
# columna se habia declarado ni que el archivo ya no la tiene, asi que desde la
# pantalla no habia forma de saber que corregir.

test_that("el error nombra la columna declarada cuando el archivo ya no la trae", {
  base <- data.frame(
    ALUMNO = c("a1", "a2"),
    NOMBREFAC = c("DERECHO", "DERECHO"),
    CLAVECURSO = c("DER101", "DER101"),
    HORARIO = c("0801", "0801"),
    stringsAsFactors = FALSE
  )

  err <- tryCatch(
    calc_muestra_aulas_construir(
      base_madre = base,
      config = list(mapping = list(student_id = "Código PUCP", faculty = "NOMBREFAC"))
    ),
    error = function(e) e
  )

  expect_s3_class(err, "condition")
  msg <- conditionMessage(err)
  expect_match(msg, "Código PUCP", fixed = TRUE)
  # Y sigue diciendo de que rol se trata, para poder buscarlo en la pantalla.
  expect_match(msg, "estudiante", fixed = TRUE)
})

test_that("sin columna declarada el error sigue pidiendo que se configure", {
  base <- data.frame(
    NOMBREFAC = c("DERECHO"),
    CLAVECURSO = c("DER101"),
    stringsAsFactors = FALSE
  )

  err <- tryCatch(
    calc_muestra_aulas_construir(base_madre = base, config = list(mapping = list())),
    error = function(e) e
  )

  expect_s3_class(err, "condition")
  expect_match(conditionMessage(err), "estudiante", fixed = TRUE)
})
