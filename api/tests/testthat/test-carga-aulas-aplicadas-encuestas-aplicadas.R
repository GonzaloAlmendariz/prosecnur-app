# El conteo del parte se llama «CANTIDAD DE ENCUESTAS APLICADAS» — S14 del loop
# de mejora estética y técnica (2026-09-07).
#
# Dictado de Gonzalo (2026-09-07, textual): «en aplicación o registro de campo
# se cambió el encabezado de efectivas a "CANTIDAD DE ENCUESTAS APLICADAS"
# porque las efectivas las da la app no el aplicador, el aplicador ve temas de
# lo que ve en aulas nomás». Contrato viejo (hasta ese día, en
# `carga_aulas_aplicadas.R`): «El numero que manda. NO es "encuestas
# aplicadas"» y el título escrito era «CANTIDAD DE EFECTIVAS».
#
# Verificado en el Sheets vivo del operativo el mismo día: el bloque TITULAR ya
# lleva el título nuevo y los once bloques REEMPLAZO siguen con el viejo. Un
# lector que sólo conozca uno de los dos pierde el conteo de la mitad de la
# hoja en silencio, y ese conteo es el que cuadra el parte contra la
# plataforma. Aquí se exige: leer los DOS títulos, bloque a bloque, y escribir
# el nuevo.

.enc_plan <- function() list(
  list(classroom_id = "A-01", operational_code = "CH 1", label = "Aula 101",
       course_name = "Curso 1", teacher = "Docente 1", faculty = "Ciencias",
       sample_role = "titular", wave = "M1", orden = 1,
       eligible_n = 30, enrolled_total = 34, expected_valid = 20,
       sample_status = "agendada"),
  list(classroom_id = "A-04", operational_code = "CH 4", label = "Aula 104",
       course_name = "Curso 4", teacher = "Docente 4", faculty = "Letras",
       sample_role = "titular", wave = "M1", orden = 4,
       eligible_n = 25, enrolled_total = 28, expected_valid = 18,
       sample_status = "reemplazada", contact_attempts = 3),
  list(classroom_id = "A-06", operational_code = "R 4.1", label = "Aula 106",
       course_name = "Curso 6", teacher = "Docente 6", faculty = "Letras",
       sample_role = "chain_reserve", replacement_for = "CH 4",
       titular_operational_code = "CH 4", wave = "M1",
       orden = 6, eligible_n = 22, enrolled_total = 24, expected_valid = 16,
       sample_status = "en_reserva", contact_attempts = 1)
)

.enc_partes <- function() list(
  list(operational_code = "CH 1", intento = 1L, observed_students = 22,
       refusals = 1, duplicates = 1, effective_surveys = 20,
       applied_by = "Equipo A", application_status = "APLICADA"),
  list(operational_code = "R 4.1", intento = 1L, observed_students = 12,
       refusals = 1, duplicates = 0, effective_surveys = 9,
       applied_by = "Equipo B", application_status = "APLICADA")
)

# La fila de títulos de la hoja de campo y sus celdas, leídas con openxlsx.
.enc_titulos <- function(path) {
  df <- openxlsx::read.xlsx(path, sheet = "Aulas Aplicadas (Campo)", colNames = FALSE,
                            skipEmptyRows = FALSE, skipEmptyCols = FALSE)
  fila <- which(as.character(df[[1]]) == "ID MATCH")[[1]]
  list(fila = fila, titulos = as.character(unlist(df[fila, ])))
}

# Renombra en el xlsx las apariciones `cuales` (1-based entre las coincidencias)
# de un título por otro, y devuelve la ruta.
.enc_renombrar <- function(path, de, a, cuales) {
  t <- .enc_titulos(path)
  cols <- which(!is.na(t$titulos) & t$titulos == de)
  wb <- openxlsx::loadWorkbook(path)
  for (col in cols[cuales]) {
    openxlsx::writeData(wb, "Aulas Aplicadas (Campo)", a, startCol = col, startRow = t$fila)
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

.enc_parte <- function(partes, code) {
  for (p in partes) if (identical(as.character(p$operational_code), code)) return(p)
  NULL
}

test_that("el libro generado escribe «CANTIDAD DE ENCUESTAS APLICADAS», no «CANTIDAD DE EFECTIVAS»", {
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.enc_plan(), libro, partes = .enc_partes())
  titulos <- .enc_titulos(libro)$titulos
  expect_true("CANTIDAD DE ENCUESTAS APLICADAS" %in% titulos)
  expect_false("CANTIDAD DE EFECTIVAS" %in% titulos)
  # Y uno por bloque: el titular y cada reemplazo.
  expect_gte(sum(titulos == "CANTIDAD DE ENCUESTAS APLICADAS", na.rm = TRUE), 2L)
})

test_that("el lector lee el título nuevo y el viejo, bloque a bloque (la mezcla del Sheets vivo)", {
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.enc_plan(), libro, partes = .enc_partes())
  # El titular con el título nuevo; el bloque de reemplazo con el viejo, que es
  # exactamente cómo quedó el libro del operativo el 07/09.
  t <- .enc_titulos(libro)
  nuevos <- which(t$titulos == "CANTIDAD DE ENCUESTAS APLICADAS")
  viejos <- which(t$titulos == "CANTIDAD DE EFECTIVAS")
  if (length(nuevos) >= 2L) {
    .enc_renombrar(libro, "CANTIDAD DE ENCUESTAS APLICADAS", "CANTIDAD DE EFECTIVAS", 2L)
  } else if (length(viejos) >= 1L) {
    .enc_renombrar(libro, "CANTIDAD DE EFECTIVAS", "CANTIDAD DE ENCUESTAS APLICADAS", 1L)
  }
  t2 <- .enc_titulos(libro)$titulos
  expect_true("CANTIDAD DE ENCUESTAS APLICADAS" %in% t2)
  expect_true("CANTIDAD DE EFECTIVAS" %in% t2)

  partes <- aulas_aplicadas_leer(libro)
  expect_length(partes, 2L)
  expect_identical(as.numeric(.enc_parte(partes, "CH 1")$effective_surveys), 20)
  expect_identical(as.numeric(.enc_parte(partes, "R 4.1")$effective_surveys), 9)
})

test_that("un libro entero con el título viejo se sigue leyendo igual (libros de 2025 y bloques sin renombrar)", {
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(.enc_plan(), libro, partes = .enc_partes())
  t <- .enc_titulos(libro)
  nuevos <- which(t$titulos == "CANTIDAD DE ENCUESTAS APLICADAS")
  if (length(nuevos)) {
    .enc_renombrar(libro, "CANTIDAD DE ENCUESTAS APLICADAS", "CANTIDAD DE EFECTIVAS", seq_along(nuevos))
  }
  partes <- aulas_aplicadas_leer(libro)
  expect_identical(as.numeric(.enc_parte(partes, "CH 1")$effective_surveys), 20)
  expect_identical(as.numeric(.enc_parte(partes, "R 4.1")$effective_surveys), 9)
})
