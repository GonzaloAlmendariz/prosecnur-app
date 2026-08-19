# Encabezado desplazado en bases Excel de marco (formato DTI 2026).
#
# Medido el 2026-08-19 sobre los archivos reales de la solicitud 207915:
# preambulo en filas 1-6 (titulo, solicitud, fecha, aviso legal), filas 7-11
# vacias, encabezado en la fila 12. Sin deteccion, readxl entregaba UNA columna
# llamada «Reporte de Alumnos matriculados 2026-2» y el rol de la hoja salia
# «desconocida»: el marco 2026 no se podia construir. Tres consumidores del
# defecto: inspeccionar-archivo, explorar-base y marco/construir.

.enc_fixture_dti <- function(dir = withr::local_tempdir(.local_envir = parent.frame())) {
  skip_if_not_installed("openxlsx")
  path <- file.path(dir, "dti_2026.xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Data")
  openxlsx::writeData(wb, "Data", "Reporte de Alumnos matriculados 2026-2", startCol = 2, startRow = 1)
  openxlsx::writeData(wb, "Data", "Solicitud:  207915", startCol = 2, startRow = 2)
  openxlsx::writeData(wb, "Data", "Informacion al 18/08/2026", startCol = 2, startRow = 3)
  openxlsx::writeData(wb, "Data", "La informacion ofrecida puede ser utilizada unicamente...", startCol = 2, startRow = 6)
  datos <- data.frame(
    ALUMNO = c("20200001", "20200002", "20200003"),
    NOMBREFAC = c("DERECHO", "DERECHO", "CIENCIAS SOCIALES"),
    SEMESTRE = c("2026-2", "2026-2", "2026-2"),
    CLAVECURSO = c("DER101", "DER102", "SOC201"),
    HORARIO = c("0101", "0102", "0201"),
    stringsAsFactors = FALSE
  )
  openxlsx::writeData(wb, "Data", datos, startRow = 12, colNames = TRUE)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

.enc_fixture_normal <- function(dir = withr::local_tempdir(.local_envir = parent.frame())) {
  skip_if_not_installed("openxlsx")
  path <- file.path(dir, "normal.xlsx")
  datos <- data.frame(
    student_id = c("s1", "s2"),
    facultad = c("FAC1", "FAC2"),
    curso_id = c("C1", "C2"),
    stringsAsFactors = FALSE
  )
  openxlsx::write.xlsx(datos, path)
  path
}

test_that("el preambulo DTI se salta: el encabezado real es la fila densa", {
  path <- .enc_fixture_dti()
  expect_identical(.cm_aulas_encabezado_skip(path, "Data"), 11L)
  df <- .cm_aulas_read_table(path, "Data")
  expect_true(all(c("ALUMNO", "NOMBREFAC", "CLAVECURSO", "HORARIO") %in% names(df)))
  expect_identical(nrow(df), 3L)
  expect_identical(df$ALUMNO[1], "20200001")
})

test_that("una base normal con encabezado en la fila 1 queda intacta (skip 0)", {
  path <- .enc_fixture_normal()
  expect_identical(.cm_aulas_encabezado_skip(path), 0L)
  df <- .cm_aulas_read_table(path)
  expect_identical(names(df), c("student_id", "facultad", "curso_id"))
  expect_identical(nrow(df), 2L)
})

test_that("inspeccionar el libro DTI clasifica con las columnas reales, no con el titulo", {
  path <- .enc_fixture_dti()
  insp <- calc_muestra_aulas_inspect_workbook(path)
  hoja <- insp$sheets[[1]]
  cols <- unlist(hoja$columns_sample)
  expect_true("ALUMNO" %in% cols)
  expect_false(any(grepl("Reporte de", cols, fixed = TRUE)))
})

test_that("con menos de 3 celdas en la mejor fila no se inventa ningun salto", {
  skip_if_not_installed("openxlsx")
  dir <- withr::local_tempdir()
  path <- file.path(dir, "estrecha.xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Data")
  openxlsx::writeData(wb, "Data", "titulo", startRow = 1)
  openxlsx::writeData(wb, "Data", data.frame(a = 1:2, b = 3:4), startRow = 5)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  expect_identical(.cm_aulas_encabezado_skip(path, "Data"), 0L)
})
