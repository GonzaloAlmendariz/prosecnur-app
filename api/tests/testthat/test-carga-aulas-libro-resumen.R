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
  # Y la COLUMNA tambien: en horizontal la hoja se parte por columnas, y sin
  # repetir la primera —el codigo del aula— la segunda pagina son cifras sin
  # saber de que aula son. Visto en el PDF: tres paginas y solo la primera
  # decia el codigo. El rango de columnas se escribe como `$A:$A`.
  # En la agenda hay que llegar hasta la columna del CODIGO: `ID MATCH` es un
  # correlativo y `MUESTRA` va antes, asi que repetir «las dos primeras» dejaba
  # las paginas con un numero de orden, una ola y ningun curso-horario. Se vio
  # en el PDF DESPUES de darlo por arreglado.
  campos <- vapply(AULAS_AGENDADAS_BLOQUE, function(x) x$campo, character(1))
  hasta <- 1L + which(campos == "operational_code")
  letra <- LETTERS[hasta]
  expect_match(libro, sprintf("\\$A:\\$%s", letra))
})

# --- El avance en la portada ------------------------------------------------

.res_u <- function(cod, meta) list(operational_code = cod, sample_role = "titular",
                                   faculty = "Letras", expected_valid = meta,
                                   eligible_n = 30)

test_that("un libro NUEVO no lleva bloque de avance", {
  # Siete ceros no informan de nada y la portada tiene que caber. Sin partes ni
  # control no hay avance del que hablar.
  cortes <- aulas_libro_cortes(list(.res_u("CH 1", 20)))
  expect_null(cortes$avance)
})

test_that("con partes y control, la portada dice el avance", {
  cortes <- aulas_libro_cortes(
    list(.res_u("CH 1", 20), .res_u("CH 2", 18)),
    partes = list(list(operational_code = "CH 1", effective_surveys = 17)),
    control = list(list(operational_code = "CH 1", valid_total = 1, valid_population = 1),
                   list(operational_code = "CH 2", valid_total = 1, valid_population = 0))
  )
  expect_equal(cortes$avance[["Efectivas anotadas en los partes"]], 17)
  expect_identical(cortes$avance[["Avance segun los partes"]], "44.7 %")
  # Las dos ramas del umbral se distinguen: un agregado que valiera igual para
  # «cumple los dos» y «cumple uno» esconderia justo lo que decide.
  expect_equal(cortes$avance[["Aulas efectivas (los dos umbrales)"]], 1L)
  expect_equal(cortes$avance[["Aulas que cumplen solo uno"]], 1L)
})

test_that("sin encuestas esperadas, el avance NO es 0 %", {
  # Un 0 de 0 no es 0 %: es una cuenta que no se puede hacer.
  cortes <- aulas_libro_cortes(
    list(list(operational_code = "CH 1", sample_role = "titular", faculty = "Letras")),
    partes = list(list(operational_code = "CH 1", effective_surveys = 0))
  )
  expect_identical(cortes$avance[["Avance segun los partes"]], "—")
})

test_that("las aulas con parte se cuentan sobre TITULARES, sin repetir intentos", {
  # Dos partes de la misma aula son dos intentos, no dos aulas visitadas.
  cortes <- aulas_libro_cortes(
    list(.res_u("CH 1", 20)),
    partes = list(list(operational_code = "CH 1", intento = 1L, effective_surveys = 5),
                  list(operational_code = "CH 1", intento = 2L, effective_surveys = 12))
  )
  expect_equal(cortes$avance[["Aulas con parte de campo"]], 1L)
  # Las efectivas SI suman los dos intentos: son encuestas recogidas, no aulas.
  expect_equal(cortes$avance[["Efectivas anotadas en los partes"]], 17)
})

test_that("sin base de control, las aulas efectivas NO son cero", {
  # Visto en el PDF: un libro con 130 partes y sin control declaraba «0 aulas
  # efectivas» junto a un avance del 93.6 %. No es que ninguna lo sea; es que
  # no hay con que decirlo.
  cortes <- aulas_libro_cortes(
    list(.res_u("CH 1", 20)),
    partes = list(list(operational_code = "CH 1", effective_surveys = 17))
  )
  expect_identical(cortes$avance[["Aulas efectivas (los dos umbrales)"]], "—")
  expect_identical(cortes$avance[["Aulas que cumplen solo uno"]], "—")
  expect_identical(cortes$avance[["Aulas en la base de control"]], "—")
  # El control: lo que SI se puede contar se cuenta.
  expect_equal(cortes$avance[["Efectivas anotadas en los partes"]], 17)
})

test_that("la tabla por facultad dice cuanto lleva recogido cada una", {
  # «El calculo es por facultad; si necesitamos X alumnos por facultad tenemos
  # que tener aulas que respondan a ese X». Sin esto habia que cruzar la portada
  # a mano con otra hoja para saber cual facultad va corta.
  cortes <- aulas_libro_cortes(
    list(list(operational_code = "CH 1", sample_role = "titular",
              faculty = "Letras", expected_valid = 20, eligible_n = 30),
         list(operational_code = "CH 2", sample_role = "titular",
              faculty = "Ciencias", expected_valid = 18, eligible_n = 30)),
    partes = list(list(operational_code = "CH 1", effective_surveys = 17),
                  list(operational_code = "CH 2", effective_surveys = 6))
  )
  pf <- cortes$por_facultad
  rownames(pf) <- pf$Facultad
  # Cada facultad con LO SUYO: un reparto que asignara todo a la primera, o que
  # repartiera el total en partes iguales, daria 23 y 11.5 aqui.
  expect_equal(pf["Letras", "Recogidas (partes)"], 17)
  expect_equal(pf["Ciencias", "Recogidas (partes)"], 6)
  expect_identical(pf["Letras", "Avance (partes)"], "85 %")
  expect_identical(pf["Ciencias", "Avance (partes)"], "33.3 %")
})

test_that("un libro nuevo no gana las columnas de recogido", {
  cortes <- aulas_libro_cortes(list(.res_u("CH 1", 20)))
  expect_false("Recogidas (partes)" %in% names(cortes$por_facultad))
  expect_false("Avance (partes)" %in% names(cortes$por_facultad))
})

test_that("una facultad sin esperado no da 0 % de avance", {
  cortes <- aulas_libro_cortes(
    list(list(operational_code = "CH 1", sample_role = "titular", faculty = "Letras")),
    partes = list(list(operational_code = "CH 1", effective_surveys = 4))
  )
  expect_identical(cortes$por_facultad[["Avance (partes)"]][[1]], "—")
})

test_that("lo que recoge una reserva cuenta para la facultad de su cadena", {
  # Medido en el estudio: 515 de las 3 508 efectivas (14.7 %) vienen de
  # reservas de cadena, contra un denominador que solo cuenta titulares. Es
  # correcto porque la reserva SUSTITUYE al titular caido — verificado: de las
  # 152 cadenas con parte, NINGUNA registro dos aulas—, y filtrar por titular
  # aqui se comeria una de cada siete encuestas del avance.
  cortes <- aulas_libro_cortes(
    list(list(operational_code = "CH 1", sample_role = "titular",
              faculty = "Letras", expected_valid = 20, eligible_n = 30),
         list(operational_code = "R 1.1", sample_role = "chain_reserve",
              titular_operational_code = "CH 1", faculty = "Letras",
              expected_valid = 20, eligible_n = 28)),
    partes = list(list(operational_code = "R 1.1", effective_surveys = 18))
  )
  pf <- cortes$por_facultad
  # La meta sigue siendo la del titular —una cadena, una aula que visitar— y lo
  # recogido por la reserva cuenta hacia ella.
  expect_equal(pf$Esperadas[[1]], 20)
  expect_equal(pf$`Recogidas (partes)`[[1]], 18)
  expect_identical(pf$`Avance (partes)`[[1]], "90 %")
})

test_that("cada cifra de avance de la portada dice de DONDE sale", {
  # El mismo estudio tiene seis numeros parecidos y distintos: 3 891 asistentes
  # observados, 3 508 efectivas anotadas por el equipo, 3 700 respuestas leidas,
  # 2 220 validas, 2 163 que cubren meta y 1 901 enviadas segun el control.
  # Esta portada cuenta lo que el equipo ANOTO —da 93.6 % donde la pantalla de
  # Avance dice 57.8 %—, asi que no puede llamarse «avance» a secas.
  cortes <- aulas_libro_cortes(
    list(.res_u("CH 1", 20)),
    partes = list(list(operational_code = "CH 1", effective_surveys = 17))
  )
  expect_true(all(grepl("partes", names(cortes$avance)[3:4])))
  expect_true(any(grepl("partes", names(cortes$por_facultad))))
  # El control: ninguna etiqueta puede quedarse con el nombre generico.
  expect_false("Avance" %in% names(cortes$por_facultad))
  expect_false("Avance sobre lo esperado" %in% names(cortes$avance))
})
