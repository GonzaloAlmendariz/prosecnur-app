# El libro escribe el vocabulario de SU desplegable.
#
# Medido antes de repararlo: **243 de 243 valores de STATUS MUESTRA y 243 de 243
# de DIA estaban FUERA de la lista que el propio libro ofrece**. Escribia
# «agendada», «en_reserva» y «Martes» mientras el desplegable ofrecia
# «AGENDADA», «EN RESERVA 1» y «MAR».
#
# No es solo estetica: quien despliega no ve seleccionado lo que hay, y Excel
# puede marcar la celda como dato no valido.

test_that("los estados se escriben como los ofrece el desplegable", {
  expect_identical(prosecnurapp:::.calg_status_excel("agendada"), "AGENDADA")
  expect_identical(prosecnurapp:::.calg_status_excel("reemplazada"), "REEMPLAZADA")
  # «EN RESERVA k» describe a la reserva k, y k sale del orden de la cadena.
  expect_identical(prosecnurapp:::.calg_status_excel("en_reserva", 2), "EN RESERVA 2")
  expect_identical(prosecnurapp:::.calg_status_excel("en reserva", 3), "EN RESERVA 3")
  # Si el propio valor ya trae el numero, manda el valor.
  expect_identical(prosecnurapp:::.calg_status_excel("EN RESERVA 5", 2), "EN RESERVA 5")
})

test_that("un estado que la lista NO ofrece se escribe tal cual, en mayusculas", {
  # `aplicada` no esta en el vocabulario de muestra —la app ya avisa de esas
  # tres aulas— y la traduccion no lo disfraza de otro estado ni lo borra: se
  # ve que esta fuera. Descartar en silencio seria peor que la incoherencia.
  expect_identical(prosecnurapp:::.calg_status_excel("aplicada"), "APLICADA")
  expect_identical(prosecnurapp:::.calg_status_excel("un estado nuevo"), "UN ESTADO NUEVO")
  # Y no revienta: `conocidos[[v]]` con un nombre que no esta da «subscript out
  # of bounds», que es como se descubrio.
  expect_silent(prosecnurapp:::.calg_status_excel("cualquier cosa"))
})

test_that("vacio sigue vacio: no se inventa un estado", {
  expect_identical(prosecnurapp:::.calg_status_excel(""), "")
  expect_identical(prosecnurapp:::.calg_status_excel(NULL), "")
  expect_identical(prosecnurapp:::.calg_dia_excel(""), "")
})

test_that("los dias se escriben con las tres letras de la lista", {
  expect_identical(prosecnurapp:::.calg_dia_excel("Martes"), "MAR")
  expect_identical(prosecnurapp:::.calg_dia_excel("Miercoles"), "MIE")
  expect_identical(prosecnurapp:::.calg_dia_excel("Miércoles"), "MIE")
  expect_identical(prosecnurapp:::.calg_dia_excel("Sabado"), "SAB")
  # Ya abreviado, se deja como esta.
  expect_identical(prosecnurapp:::.calg_dia_excel("LUN"), "LUN")
})

test_that("lo que el libro escribe SI esta en su propia lista", {
  # El aserto que de verdad importa, y sobre el libro entero: para cada columna
  # con desplegable, los valores escritos tienen que estar en la lista que ese
  # desplegable ofrece.
  plan <- list(
    list(operational_code = "CH 1", sample_role = "titular", faculty = "Letras",
         course_name = "C1", eligible_n = 30, sample_status = "agendada",
         scheduled_day = "Martes", contact_medium = "Llamada"),
    list(operational_code = "R 1.1", sample_role = "chain_reserve",
         titular_operational_code = "CH 1", replacement_order = 1,
         faculty = "Letras", course_name = "C2", eligible_n = 28,
         sample_status = "en_reserva", scheduled_day = "Jueves",
         contact_medium = "Correo Electrónico")
  )
  f <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(plan, f)

  d <- suppressWarnings(openxlsx::read.xlsx(f, sheet = "Aulas Agendadas", colNames = FALSE))
  l <- suppressWarnings(openxlsx::read.xlsx(f, sheet = "Listas", colNames = FALSE))
  campos <- vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$campo, character(1))

  for (par in list(c("sample_status", 1), c("scheduled_day", 3))) {
    col <- 1L + which(campos == par[[1]])
    v <- as.character(d[[col]])[-1]
    v <- v[!is.na(v) & nzchar(v)]
    lista <- as.character(l[[as.integer(par[[2]])]])[-1]
    lista <- lista[!is.na(lista)]
    expect_true(all(v %in% lista),
                info = sprintf("«%s» escribe %s y su lista ofrece %s", par[[1]],
                               paste(unique(v), collapse = "/"),
                               paste(lista, collapse = "/")))
  }
})
