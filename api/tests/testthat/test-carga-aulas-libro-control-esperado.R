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

# `application_status = "APLICADA"` porque desde el 2026-09-07 la hoja escribe
# SOLO las aulas ya aplicadas (mas las que ya tienen control registrado): antes
# publicaba los 174 titulares y con una sola aplicada quedaban 173 filas vacias,
# que es como se esconde justo lo que la hoja existe para vigilar. Estos casos
# comprueban el CONTENIDO de la fila, asi que sus aulas tienen que existir.
.ce_aula <- function(cod, eleg, esperadas, f = 17, m = 13) list(
  operational_code = cod, sample_role = "titular", faculty = "Letras",
  wave = "M1", course_name = paste("Curso", cod), label = "A101",
  schedule = "Lun 10:00", enrolled_total = eleg + 4, eligible_n = eleg,
  expected_valid = esperadas, application_status = "APLICADA",
  # La tasa del aula es, por definición, `esperadas / elegibles`: el plan la
  # trae calculada y la hoja la escribe en su propia columna desde el
  # 2026-09-07, en lugar del antiguo «% EFECTIVAS ESPERADO», que era la misma
  # cifra con otro nombre.
  tasa_efectividad_aula = esperadas / eleg,
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
  esperadas <- .ce_titulo("ESPERADAS POR TASA DEL AULA")
  pct <- .ce_titulo("TASA DEL AULA")
  expect_identical(unlist(d[3, ], use.names = FALSE)[[esperadas]], "21")
  expect_identical(unlist(d[4, ], use.names = FALSE)[[esperadas]], "24")
  # 21/30 = 0.7 y 24/40 = 0.6: el numero solo no distingue que la segunda pide
  # menos esfuerzo por alumno, y la tasa si. Es la misma cifra que publicaba
  # «% EFECTIVAS ESPERADO», ahora con el nombre de lo que es.
  expect_identical(unlist(d[3, ], use.names = FALSE)[[pct]], "0.7")
  expect_identical(unlist(d[4, ], use.names = FALSE)[[pct]], "0.6")
})

test_that("lo obtenido sale de la PLATAFORMA y la diferencia lleva signo", {
  # «Un elegible efectivo o solo efectivo es una respuesta efectiva de la
  # plataforma: una encuesta que se completa y pasa los filtros». No es lo que
  # el aplicador anota en su parte.
  fila <- .ce_fila(list(.ce_aula("CH 1", eleg = 30, esperadas = 21)),
                   efectivas = c(`CH 1` = 18))
  expect_identical(fila[[.ce_titulo("EFECTIVAS")]], "18")
  expect_identical(fila[[.ce_titulo("TASA OBTENIDA")]], "0.6")
  # En encuestas y con signo: «te faltan 3» es accionable, «-13 %» no.
  expect_identical(fila[[.ce_titulo("DIFERENCIA EN ENCUESTAS VS AULA")]], "-3")
})

test_that("por encima de lo esperado la diferencia es POSITIVA", {
  # El control del anterior: sin signo, un aula que se paso y otra que se quedo
  # corta se leerian igual.
  fila <- .ce_fila(list(.ce_aula("CH 1", eleg = 30, esperadas = 21)),
                   efectivas = c(`CH 1` = 25))
  expect_identical(fila[[.ce_titulo("DIFERENCIA EN ENCUESTAS VS AULA")]], "4")
})

test_that("sin respuestas leidas las columnas de obtenido quedan VACIAS", {
  # Cero efectivas y «todavia no sabemos» son dos noticias distintas, y en un
  # aula sin aplicar la segunda es la cierta. Es el mismo criterio que «un 0 de
  # 0 no es 0 %».
  fila <- .ce_fila(list(.ce_aula("CH 1", eleg = 30, esperadas = 21)), efectivas = NULL)
  expect_identical(fila[[.ce_titulo("EFECTIVAS")]], "")
  expect_identical(fila[[.ce_titulo("TASA OBTENIDA")]], "")
  expect_identical(fila[[.ce_titulo("DIFERENCIA EN ENCUESTAS VS AULA")]], "")
  # Pero lo ESPERADO si se publica: se sabe desde que se hizo el plan.
  expect_identical(fila[[.ce_titulo("ESPERADAS POR TASA DEL AULA")]], "21")
})

test_that("el sexo esperado REPARTE LA META, no el padrón, y suma exactamente", {
  # **`sex_top_*_n` es la composición del PADRÓN.** La columna decía «MUJERES
  # ESPERADAS 17 · HOMBRES 13» al lado de «ESPERADAS 21», y 17 + 13 = 30, que
  # son los ELEGIBLES. El «Plan del día» ya repartía la meta por resto mayor y
  # esta hoja se había quedado con el crudo; se vio en cuanto la columna dejó de
  # llamarse «MUJERES ESPERADAS» a secas y dijo por qué tasa (2026-09-08).
  fila <- .ce_fila(list(.ce_aula("CH 1", eleg = 30, esperadas = 21, f = 17, m = 13)))
  muj <- as.numeric(fila[[.ce_titulo("MUJERES ESPERADAS POR TASA DEL AULA")]])
  hom <- as.numeric(fila[[.ce_titulo("HOMBRES ESPERADOS POR TASA DEL AULA")]])
  # Las dos partes suman la meta escrita al lado, no el padrón.
  expect_equal(muj + hom, 21)
  # Y conservan la proporción del padrón: 17 de 30 son mujeres.
  expect_equal(muj, 12)
  expect_equal(hom, 9)

  # Y si el mayoritario es el otro sexo, los numeros NO se cruzan: la posicion
  # no decide, lo dice `sex_top_1`.
  otra <- .ce_aula("CH 2", eleg = 30, esperadas = 21)
  otra$sex_top_1 <- "M"; otra$sex_top_1_n <- 19
  otra$sex_top_2 <- "F"; otra$sex_top_2_n <- 11
  f2 <- .ce_fila(list(otra))
  h2 <- as.numeric(f2[[.ce_titulo("HOMBRES ESPERADOS POR TASA DEL AULA")]])
  m2 <- as.numeric(f2[[.ce_titulo("MUJERES ESPERADAS POR TASA DEL AULA")]])
  expect_equal(h2 + m2, 21)
  expect_gt(h2, m2)
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

# El padrón es el denominador, y la meta es otra columna.
#
# Gonzalo, 2026-08-24: «deberiamos tenerlo todo muy validado a lo ultimo que
# tenemos y realmente usamos». Hubo una columna «ELEGIBLES: BASE DEL %» que
# repetía `eligible_n` para que el porcentaje se leyera sin cruzar la hoja; con
# el reordenamiento del 2026-09-07 el porcentaje ya está junto a su denominador
# y esa columna dejó de escribirse. Su nombre original, «ELEGIBLES ESPERADOS»,
# costó un defecto real: el veredicto de aula válida la tomó por meta, y usar el
# padrón como vara exige el 100 % de asistencia efectiva.
test_that("la base del % es el padron, y la meta es otra columna", {
  u <- list(.ce_aula("CH 1", eleg = 36, esperadas = 17.3))
  fila <- .ce_fila(u)
  expect_equal(fila[[.ce_titulo("MATRICULADOS ELEGIBLES")]], "36")
  # La meta NO es ninguna de las dos, y se escribe EN PERSONAS: el motor la
  # calcula como producto de tasas (17,3) y desde el 2026-09-07 la hoja la
  # redondea, porque nadie consigue diecisiete coma tres encuestas.
  expect_equal(fila[[.ce_titulo("ESPERADAS POR TASA DEL AULA")]], "17")
  # Y la tasa se calcula sobre la meta SIN redondear: 17,3/36 y no 17/36.
  expect_equal(fila[[.ce_titulo("TASA DEL AULA")]], "0.481")
})

test_that("los titulos viejos siguen leyendose: los libros ya emitidos no se rompen", {
  por_campo <- function(k) Filter(function(s) identical(s$campo, k), BASE_CONTROL_CAMPOS)[[1]]
  # Ya no se escribe, pero un libro que la traiga se sigue leyendo entera.
  eleg <- por_campo("elegibles_esperados")
  expect_true(isTRUE(eleg$solo_lectura))
  expect_true(all(c("ELEGIBLES: BASE DEL %", "ELEGIBLES ESPERADOS") %in% eleg$titulos))
  # Y las efectivas conservan su rótulo anterior de alias: el primero es el que
  # se ESCRIBE, los siguientes son de lectura.
  ef <- por_campo("efectivas_obtenidas")
  expect_equal(ef$titulos[[1]], "EFECTIVAS")
  expect_true("EFECTIVAS OBTENIDAS" %in% ef$titulos)
  # Cortas y largas, la partición por duración de 2025, sólo se leen.
  for (k in c("short_total", "short_vs_total", "long_total", "long_vs_total")) {
    expect_true(isTRUE(por_campo(k)$solo_lectura), info = k)
  }
})
