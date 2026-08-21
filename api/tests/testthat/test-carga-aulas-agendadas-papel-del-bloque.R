# «NOMBRE DE DOCENTE», tres veces identico.
#
# «Aulas Agendadas» son 1 columna de ID mas TRES bloques de 20 cabeceras
# EXACTAMENTE iguales, y lo unico que distinguia al titular del reemplazo 1.2
# era el COLOR de la banda. Impresa en blanco y negro —que es como el agendador
# la usa en campo— o convertida a PDF, la hoja no lo decia. Medido: de las 61
# cabeceras, 60 estan repetidas tres veces.
#
# El papel entra en el TITULO y el lector lo descarta al normalizar, asi que
# sigue leyendo igual una hoja vieja sin sufijo y una nueva con el. Esto ultimo
# no es un detalle: el equipo tiene libros de 2025 en sus carpetas.

.cpb_cabecera <- function(plan) {
  ruta <- tempfile(fileext = ".xlsx")
  on.exit(unlink(ruta), add = TRUE)
  aulas_libro_generar(plan, ruta)
  d <- openxlsx::read.xlsx(ruta, sheet = "Aulas Agendadas", colNames = FALSE,
                           skipEmptyRows = FALSE, rows = 1)
  as.character(unlist(d[1, ], use.names = FALSE))
}

.cpb_plan <- function() {
  list(
    list(classroom_id = "A1", operational_code = "CH 1", label = "x", wave = "M1",
         sample_role = "titular", orden = 1, teacher = "Doc 1",
         titular_operational_code = "CH 1"),
    list(classroom_id = "A2", operational_code = "R 1.1", label = "x", wave = "M1",
         sample_role = "chain_reserve", orden = 2, teacher = "Doc 2",
         replacement_order = 1, titular_operational_code = "CH 1"),
    list(classroom_id = "A3", operational_code = "R 1.2", label = "x", wave = "M1",
         sample_role = "chain_reserve", orden = 3, teacher = "Doc 3",
         replacement_order = 2, titular_operational_code = "CH 1")
  )
}

test_that("cada bloque de la cabecera dice de quien es", {
  cab <- .cpb_cabecera(.cpb_plan())
  docentes <- cab[grepl("^NOMBRE DE DOCENTE", cab)]
  expect_length(docentes, 3L)
  # El titular sin sufijo —es el bloque de partida— y los reemplazos con el suyo.
  expect_identical(docentes, c("NOMBRE DE DOCENTE", "NOMBRE DE DOCENTE R1",
                               "NOMBRE DE DOCENTE R2"))
  # Y ninguna cabecera queda repetida identica: era el defecto entero.
  expect_identical(anyDuplicated(cab[nzchar(cab)]), 0L)
})

test_that("el lector descarta el papel y mapea igual", {
  # Lo que hace segura la reparacion: `.caa_key()` quita el sufijo, asi que los
  # 20 campos del bloque 2 siguen casando. Sin esto, los bloques 2 y 3 se
  # perderian ENTEROS y en silencio — la trampa de la lista cerrada.
  plan <- .cpb_plan()
  ruta <- tempfile(fileext = ".xlsx")
  on.exit(unlink(ruta), add = TRUE)
  aulas_libro_generar(plan, ruta)
  d <- openxlsx::read.xlsx(ruta, sheet = "Aulas Agendadas", colNames = FALSE,
                           skipEmptyRows = FALSE)
  vuelta <- aulas_agendadas_a_plan(d[-1, , drop = FALSE],
                                   titulos = as.character(unlist(d[1, ], use.names = FALSE)))
  expect_length(vuelta, 3L)
  codigos <- vapply(vuelta, function(u) as.character(u$operational_code %||% ""), character(1))
  expect_setequal(codigos, c("CH 1", "R 1.1", "R 1.2"))
  docentes <- vapply(vuelta, function(u) as.character(u$teacher %||% ""), character(1))
  expect_setequal(docentes, c("Doc 1", "Doc 2", "Doc 3"))
})

test_that("una hoja VIEJA sin sufijo se sigue leyendo", {
  # El equipo tiene libros de 2025 en sus carpetas: el lector nuevo no puede
  # exigir el formato nuevo.
  plan <- .cpb_plan()
  ruta <- tempfile(fileext = ".xlsx")
  on.exit(unlink(ruta), add = TRUE)
  aulas_libro_generar(plan, ruta)
  d <- openxlsx::read.xlsx(ruta, sheet = "Aulas Agendadas", colNames = FALSE,
                           skipEmptyRows = FALSE)
  viejos <- sub(" R[0-9]+$", "", as.character(unlist(d[1, ], use.names = FALSE)))
  vuelta <- aulas_agendadas_a_plan(d[-1, , drop = FALSE], titulos = viejos)
  expect_length(vuelta, 3L)
  expect_setequal(vapply(vuelta, function(u) as.character(u$teacher %||% ""), character(1)),
                  c("Doc 1", "Doc 2", "Doc 3"))
})

test_that("`.caa_key` solo se come el sufijo de bloque", {
  # El control: si se comiera cualquier « R<n>» del final, un titulo legitimo
  # que acabe asi perderia su nombre. Ninguno lo hace hoy, y este aserto lo
  # deja fijado por si mañana aparece.
  titulos <- vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$titulos[[1]], character(1))
  expect_false(any(grepl(" R[0-9]+$", titulos)),
               info = "un titulo canonico acaba en « R<n>» y el lector se lo comeria")
})
