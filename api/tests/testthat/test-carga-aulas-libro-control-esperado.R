# La Base de control compara lo esperado con lo obtenido, aula por aula.
#
# Sustituye a `70T`/`70P`, que eran ese mismo umbral reducido a dos casillas de
# si/no. Gonzalo: «en vez de setenta t y setenta p deberia ser el porcentaje de
# efectivas... cual es el esperado, cual es el que se hizo, y si ese porcentaje
# es superior o inferior»; y despues: «se tiene que publicar cuanto es el
# esperado por curso horario, porque cada curso horario tiene un calculo
# diferente... no solo en el numero, sino tambien en el porcentaje».

.ce_titulo <- function(t) {
  campos <- vapply(prosecnurapp:::.calg_control_escritos(),
                   function(s) s$titulos[[1]], character(1))
  which(campos == t)[[1]]
}

.ce_aula <- function(cod, eleg, esperadas, f = 17, m = 13) list(
  operational_code = cod, sample_role = "titular", faculty = "Letras",
  wave = "M1", course_name = paste("Curso", cod), label = "A101",
  schedule = "Lun 10:00", enrolled_total = eleg + 4, eligible_n = eleg,
  expected_valid = esperadas,
  sex_top_1 = "F", sex_top_1_n = f, sex_top_2 = "M", sex_top_2_n = m
)

.ce_fila <- function(unidades, efectivas = NULL, fila = 3L) {
  d <- aulas_libro_hoja_control(unidades, list(), efectivas)
  unlist(d[fila, ], use.names = FALSE)
}

test_that("el esperado se publica por curso-horario, en numero Y en porcentaje", {
  # Cada curso-horario tiene su propio calculo: dos aulas con distinto padron
  # esperan cosas distintas, y el porcentaje lo hace comparable entre ellas.
  d <- aulas_libro_hoja_control(
    list(.ce_aula("CH 1", eleg = 30, esperadas = 21),
         .ce_aula("CH 2", eleg = 40, esperadas = 24)),
    list(), NULL
  )
  esperadas <- .ce_titulo("EFECTIVAS ESPERADAS")
  pct <- .ce_titulo("% EFECTIVAS ESPERADO")
  expect_identical(unlist(d[3, ], use.names = FALSE)[[esperadas]], "21")
  expect_identical(unlist(d[4, ], use.names = FALSE)[[esperadas]], "24")
  # 21/30 = 0.7 y 24/40 = 0.6: el numero solo no distingue que la segunda pide
  # menos esfuerzo por alumno, y el porcentaje si.
  expect_identical(unlist(d[3, ], use.names = FALSE)[[pct]], "0.7")
  expect_identical(unlist(d[4, ], use.names = FALSE)[[pct]], "0.6")
})

test_that("lo obtenido sale de la PLATAFORMA y la diferencia lleva signo", {
  # «Un elegible efectivo o solo efectivo es una respuesta efectiva de la
  # plataforma: una encuesta que se completa y pasa los filtros». No es lo que
  # el aplicador anota en su parte.
  fila <- .ce_fila(list(.ce_aula("CH 1", eleg = 30, esperadas = 21)),
                   efectivas = c(`CH 1` = 18))
  expect_identical(fila[[.ce_titulo("EFECTIVAS OBTENIDAS")]], "18")
  expect_identical(fila[[.ce_titulo("% EFECTIVAS OBTENIDO")]], "0.6")
  # En encuestas y con signo: «te faltan 3» es accionable, «-13 %» no.
  expect_identical(fila[[.ce_titulo("EFECTIVAS: DIFERENCIA")]], "-3")
})

test_that("por encima de lo esperado la diferencia es POSITIVA", {
  # El control del anterior: sin signo, un aula que se paso y otra que se quedo
  # corta se leerian igual.
  fila <- .ce_fila(list(.ce_aula("CH 1", eleg = 30, esperadas = 21)),
                   efectivas = c(`CH 1` = 25))
  expect_identical(fila[[.ce_titulo("EFECTIVAS: DIFERENCIA")]], "4")
})

test_that("sin respuestas leidas las columnas de obtenido quedan VACIAS", {
  # Cero efectivas y «todavia no sabemos» son dos noticias distintas, y en un
  # aula sin aplicar la segunda es la cierta. Es el mismo criterio que «un 0 de
  # 0 no es 0 %».
  fila <- .ce_fila(list(.ce_aula("CH 1", eleg = 30, esperadas = 21)), efectivas = NULL)
  expect_identical(fila[[.ce_titulo("EFECTIVAS OBTENIDAS")]], "")
  expect_identical(fila[[.ce_titulo("% EFECTIVAS OBTENIDO")]], "")
  expect_identical(fila[[.ce_titulo("EFECTIVAS: DIFERENCIA")]], "")
  # Pero lo ESPERADO si se publica: se sabe desde que se hizo el plan.
  expect_identical(fila[[.ce_titulo("EFECTIVAS ESPERADAS")]], "21")
})

test_that("el sexo esperado sale del plan por aula, y cual es cual lo dice sex_top_1", {
  fila <- .ce_fila(list(.ce_aula("CH 1", eleg = 30, esperadas = 21, f = 17, m = 13)))
  expect_identical(fila[[.ce_titulo("MUJERES ESPERADAS")]], "17")
  expect_identical(fila[[.ce_titulo("HOMBRES ESPERADOS")]], "13")

  # Y si el mayoritario es el otro sexo, los numeros NO se cruzan: la posicion
  # no decide, lo dice `sex_top_1`.
  otra <- .ce_aula("CH 2", eleg = 30, esperadas = 21)
  otra$sex_top_1 <- "M"; otra$sex_top_1_n <- 19
  otra$sex_top_2 <- "F"; otra$sex_top_2_n <- 11
  f2 <- .ce_fila(list(otra))
  expect_identical(f2[[.ce_titulo("HOMBRES ESPERADOS")]], "19")
  expect_identical(f2[[.ce_titulo("MUJERES ESPERADAS")]], "11")
})

test_that("los titulos viejos siguen leyendose: un libro a medio llenar no se rompe", {
  # `70T`, `70P`, `VALIDO TOTAL` y `VALIDO POBLACION` ya no se escriben, pero
  # sus campos siguen en la spec para que un libro que el equipo tenga con esas
  # columnas se siga leyendo entero.
  campos <- vapply(BASE_CONTROL_CAMPOS, function(s) s$titulos[[1]], character(1))
  for (viejo in c("70T", "70P", "VALIDO TOTAL", "VALIDO POBLACION")) {
    expect_true(viejo %in% campos, info = viejo)
  }
})

test_that("las columnas viejas se leen pero YA NO se escriben", {
  # Conservarlas en la spec para releer un libro a medio llenar no obliga a
  # emitirlas: salian como cuatro columnas VACIAS que ocupan sitio y no dicen
  # nada. Se vio en el PDF, con «VALIDO TOTAL» y «VALIDO POBLACION» en blanco
  # al lado de las columnas nuevas.
  escritos <- vapply(prosecnurapp:::.calg_control_escritos(),
                     function(s) s$titulos[[1]], character(1))
  for (viejo in c("70T", "70P", "VALIDO TOTAL", "VALIDO POBLACION")) {
    expect_false(viejo %in% escritos, info = viejo)
  }
  # Pero siguen en la spec: es lo que permite releerlas.
  todos <- vapply(BASE_CONTROL_CAMPOS, function(s) s$titulos[[1]], character(1))
  expect_true(all(c("70T", "70P", "VALIDO TOTAL", "VALIDO POBLACION") %in% todos))
})

test_that("un libro con las columnas viejas se sigue leyendo entero", {
  # El aserto que de verdad importa: no que el campo este en una lista, sino
  # que un `.xlsx` que las traiga vuelva con sus valores.
  libro <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(list(.ce_aula("CH 1", eleg = 30, esperadas = 21)), libro)

  wb <- openxlsx::loadWorkbook(libro)
  n <- length(prosecnurapp:::.calg_control_escritos())
  # Se añaden a mano, como las tendria un libro viejo del equipo.
  openxlsx::writeData(wb, "Base de control", "70T", startCol = n + 1L, startRow = 2, colNames = FALSE)
  openxlsx::writeData(wb, "Base de control", 1, startCol = n + 1L, startRow = 3, colNames = FALSE)
  openxlsx::saveWorkbook(wb, libro, overwrite = TRUE)

  filas <- base_control_leer(libro)$filas
  expect_gt(length(filas), 0L)
  expect_equal(as.numeric(filas[[1]]$threshold_total), 1)
})
