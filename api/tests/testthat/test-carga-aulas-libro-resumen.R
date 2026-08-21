plan_prueba <- list(
  list(operational_code = "CH 1", sample_role = "titular", faculty = "Derecho",
       eligible_n = 40, expected_valid = 16, scheduled_date = "2026-08-11",
       sample_status = "Agendada"),
  list(operational_code = "R 1.1", sample_role = "chain_reserve", faculty = "Derecho",
       eligible_n = 30, expected_valid = 12, sample_status = "En reserva"),
  list(operational_code = "R 1.2", sample_role = "chain_reserve", faculty = "Derecho",
       eligible_n = 25, expected_valid = 10, sample_status = "En reserva"),
  list(operational_code = "CH 9", sample_role = "titular", faculty = "Gestión",
       eligible_n = 20, expected_valid = 8, sample_status = "Por agendar"),
  list(operational_code = "E 1", sample_role = "extra_reserve_pool", faculty = "Derecho",
       eligible_n = 50, expected_valid = 20)
)

test_that("lo esperado se cuenta sobre los titulares, no sobre la cadena entera", {
  # Una reserva solo entra a campo si su titular cae. Sumar sus metas da un
  # esperado que nadie va a recoger: en el corte real, 26 titulares daban «4 154
  # encuestas esperadas» porque arrastraban 238 reservas.
  cortes <- aulas_libro_cortes(plan_prueba)
  expect_equal(cortes$totales[["Encuestas esperadas (titulares)"]], 24)   # 16 + 8
  expect_equal(cortes$totales[["Alumnos elegibles (titulares)"]], 60)     # 40 + 20
  # El control: sumando la cadena darian 38 y 95, que es lo que hacia antes.
  expect_false(isTRUE(all.equal(cortes$totales[["Encuestas esperadas (titulares)"]], 38)))
})

test_that("las reservas y el banco se cuentan, pero como lo que son", {
  cortes <- aulas_libro_cortes(plan_prueba)
  expect_equal(cortes$totales[["Cursos-horario titulares"]], 2)
  expect_equal(cortes$totales[["Reservas de cadena"]], 2)
  expect_equal(cortes$totales[["Aulas del banco"]], 1)
})

test_that("el banco no entra en el corte por facultad", {
  # No esta agendado: sumarlo daria un operativo que nadie va a visitar.
  cortes <- aulas_libro_cortes(plan_prueba)
  derecho <- cortes$por_facultad[cortes$por_facultad$Facultad == "Derecho", ]
  expect_equal(derecho$Titulares, 1)
  expect_equal(derecho$Reservas, 2)
  # El extra de Derecho trae 50 elegibles y no aparecen.
  expect_equal(derecho$Elegibles, 40)
})

test_that("la portada abre por donde hay mas trabajo, no por orden alfabetico", {
  cortes <- aulas_libro_cortes(c(
    plan_prueba,
    list(list(operational_code = "CH 20", sample_role = "titular", faculty = "Zoologia",
              eligible_n = 10, expected_valid = 4))
  ))
  # Derecho y Gestion tienen 1 titular cada una; Zoologia tambien. Con empate
  # manda el alfabetico, asi que Zoologia va al final.
  expect_equal(tail(cortes$por_facultad$Facultad, 1), "Zoologia")
})

test_that("un aula sin facultad ni estado se nombra en vez de desaparecer", {
  cortes <- aulas_libro_cortes(list(
    list(operational_code = "CH 1", sample_role = "titular", eligible_n = 10)
  ))
  expect_equal(cortes$por_facultad$Facultad, "Sin facultad")
  expect_equal(cortes$por_estado$Estado, "Sin estado")
})

test_that("el libro abre por la portada", {
  path <- file.path(tempdir(), "libro_portada.xlsx")
  aulas_libro_generar(plan_prueba, path)
  expect_equal(openxlsx::getSheetNames(path)[1], "Resumen")
})

test_that("la portada cabe a lo ancho de una pagina", {
  # Convertida a PDF, la tabla por facultad se partia en dos: «Elegibles» y
  # «Esperadas» caian sueltas en la segunda pagina, con su cabecera pero sin
  # saber de que facultad eran. Seis columnas de 34+13x5 no entran en un A4
  # vertical. Esto SOLO se ve abriendo el fichero: el XML declaraba las seis
  # columnas y todo parecia correcto.
  path <- file.path(tempdir(), "libro_pagina.xlsx")
  aulas_libro_generar(plan_prueba, path)
  destino <- file.path(tempdir(), paste0("pag_", as.integer(runif(1, 1, 1e6))))
  dir.create(destino)
  utils::unzip(path, exdir = destino)
  hojas <- openxlsx::getSheetNames(path)
  xml <- paste(readLines(file.path(destino, "xl", "worksheets",
                                   sprintf("sheet%d.xml", which(hojas == "Resumen"))),
                         warn = FALSE), collapse = "")
  expect_match(xml, 'fitToWidth="1"')
})

test_that("las hojas de datos se imprimen con su cabecera en cada pagina", {
  # Una tabla de 951 filas en vertical parte por columnas y cada pagina
  # posterior pierde los titulos: la segunda hoja es una lista de numeros sin
  # nombre.
  path <- file.path(tempdir(), "libro_impresion.xlsx")
  aulas_libro_generar(plan_prueba, path)
  destino <- file.path(tempdir(), paste0("imp_", as.integer(runif(1, 1, 1e6))))
  dir.create(destino)
  utils::unzip(path, exdir = destino)
  libro <- paste(readLines(file.path(destino, "xl", "workbook.xml"), warn = FALSE),
                 collapse = "")
  # `printTitleRows` se guarda como nombre definido `_xlnm.Print_Titles`.
  expect_match(libro, "Print_Titles")
})
