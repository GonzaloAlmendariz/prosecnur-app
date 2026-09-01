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
  # B13b (D-B13 cerrada por el dueño): «EN RESERVA k» dejo de sembrarse — la
  # posicion en cadena ya la dice el codigo R n.k y el desplegable solo ofrece
  # los cinco tecleables. Toda forma en_reserva siembra el estado inicial.
  expect_identical(prosecnurapp:::.calg_status_excel("en_reserva", 2), "SIN CONTACTAR")
  expect_identical(prosecnurapp:::.calg_status_excel("en reserva", 3), "SIN CONTACTAR")
  expect_identical(prosecnurapp:::.calg_status_excel("EN RESERVA 5", 2), "SIN CONTACTAR")
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

# --- B13a: la siembra y el desplegable dicen el mismo vocablo -----------------
#
# Reporte del dueño sobre el Sheets real (2026-09-01): STATUS MUESTRA sale
# `SIN_CONTACTAR` y el desplegable no lo ofrece — chip con warning rojo. B13a
# es SOLO el alineamiento del estado inicial; repensar las categorías es D-B13
# y espera la poda del dueño.

test_that("B13a: el estado inicial se escribe como lo ofrece su desplegable", {
  # Forma canónica declarada: «SIN CONTACTAR» — legible sin guion bajo, la
  # misma que `.capd_estado_legible` produce para el Plan del día (contexto
  # verde: pinea de dónde sale la forma; si ese helper cambia, este aviso
  # dice que los pines de abajo quedaron midiendo otra cosa).
  expect_identical(prosecnurapp:::.capd_estado_legible("sin_contactar"), "SIN CONTACTAR")

  # El escritor del libro traduce el estado inicial a esa forma…
  expect_identical(prosecnurapp:::.calg_status_excel("sin_contactar"), "SIN CONTACTAR")
  # …también al regenerar un libro que ya traía la forma vieja («la traduccion
  # va aqui, al ESCRIBIR» — cabecera de `.calg_status_excel`)…
  expect_identical(prosecnurapp:::.calg_status_excel("SIN_CONTACTAR"), "SIN CONTACTAR")
  # …y el desplegable la ofrece byte a byte, a cualquier profundidad de cadena.
  expect_true("SIN CONTACTAR" %in% aulas_libro_status_muestra(1L))
  expect_true("SIN CONTACTAR" %in% aulas_libro_status_muestra(12L))
  expect_true(prosecnurapp:::.calg_status_excel("sin_contactar") %in%
                aulas_libro_status_muestra(3L))
})

test_that("B13a: el lector sigue aceptando la forma vieja ya escrita en libros existentes", {
  # Tolerancia contrato-b: los libros sembrados hasta hoy tienen
  # `SIN_CONTACTAR` en sus celdas; el normalizador los lee igual que la forma
  # nueva y que la clave interna.
  expect_identical(monitoreo_aulas_estado_muestra("SIN_CONTACTAR"), "sin_contactar")
  expect_identical(monitoreo_aulas_estado_muestra("SIN CONTACTAR"), "sin_contactar")
  expect_identical(monitoreo_aulas_estado_muestra("sin_contactar"), "sin_contactar")
})

test_that("B13a: el libro generado escribe el estado inicial DENTRO de su propia lista", {
  # El mismo aserto del test de arriba («lo que el libro escribe SI esta en su
  # propia lista»), con el caso que allá faltaba: el estado INICIAL del plan.
  plan <- list(
    list(operational_code = "CH 1", sample_role = "titular", faculty = "Letras",
         course_name = "C1", eligible_n = 30, sample_status = "sin_contactar")
  )
  f <- withr::local_tempfile(fileext = ".xlsx")
  aulas_libro_generar(plan, f)

  d <- suppressWarnings(openxlsx::read.xlsx(f, sheet = "Aulas Agendadas", colNames = FALSE))
  l <- suppressWarnings(openxlsx::read.xlsx(f, sheet = "Listas", colNames = FALSE))
  campos <- vapply(AULAS_AGENDADAS_BLOQUE, function(s) s$campo, character(1))
  col <- 1L + which(campos == "sample_status")
  escrito <- as.character(d[[col]])[-1]
  escrito <- escrito[!is.na(escrito) & nzchar(escrito)]
  expect_length(escrito, 1L)
  # Legible: sin guion bajo (coherente con el estado legible del Plan del día).
  expect_false(grepl("_", escrito, fixed = TRUE))
  lista <- as.character(l[[1]])[-1]
  lista <- lista[!is.na(lista)]
  expect_true(escrito %in% lista, info = sprintf(
    "el estado inicial se escribe «%s» y su lista ofrece %s",
    escrito, paste(lista, collapse = "/")))
})
