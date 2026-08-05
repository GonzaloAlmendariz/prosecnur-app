# G49/G50 · El explorador describe la BASE, sin marco y con filtros de cualquier
# columna.
#
# Gonzalo: «¿por qué este explorador de variables te pediría tener un marco
# completo si se supone que este es un paso previo al marco? […] con las dos
# bases iniciales y crudas teníamos suficiente». Y después: «yo también tengo
# que ser capaz de tener filtros dinámicos […] qué pasa si quiero saber cuántos
# tipos de cursos hay por esta determinada facultad».
#
# Estos casos fijan las dos cosas: que el perfil sale del archivo declarado
# —nada de `aula_frame`— y que los filtros cruzan columnas como el autofiltro de
# una hoja de cálculo.

.expl_base <- function() {
  data.frame(
    `Código PUCP` = sprintf("A%03d", 1:12),
    Facultad = c(rep("CIENCIAS", 7), rep("DERECHO", 5)),
    `Tipo de curso` = c("TEORICO", "TEORICO", "LABORATORIO", "TEORICO", "TALLER",
                        "LABORATORIO", "TEORICO", "TEORICO", "SEMINARIO",
                        "TEORICO", "TEORICO", "TALLER"),
    Modalidad = "PRESENCIAL",
    Matriculados = c(30, 25, 12, 40, 8, 15, 33, 28, 9, 45, 38, 7),
    `Correo PUCP` = sprintf("a%03d@pucp.edu.pe", 1:12),
    `Nombre Completo` = sprintf("ESTUDIANTE %02d", 1:12),
    Vacia = NA_character_,
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

.expl_col <- function(perfil, nombre) {
  hit <- Filter(function(col) identical(col$columna, nombre), perfil$columnas)
  if (!length(hit)) return(NULL)
  hit[[1L]]
}

test_that("el perfil describe la hoja tal cual, sin marco construido", {
  perfil <- calc_muestra_explorar_base(datos = .expl_base())

  expect_identical(perfil$schema, "calc_muestra_explorador_base_v1")
  expect_identical(perfil$filas, 12L)
  expect_identical(perfil$filas_base, 12L)

  tipo <- .expl_col(perfil, "Tipo de curso")
  expect_identical(tipo$tipo, "categorica")
  expect_identical(tipo$con_dato, 12L)
  expect_identical(tipo$categorias[[1L]]$clave, "TEORICO")
  expect_identical(tipo$categorias[[1L]]$n, 7L)

  matriculados <- .expl_col(perfil, "Matriculados")
  expect_identical(matriculados$tipo, "numerica")
  expect_identical(matriculados$resumen$min, 7)
  expect_identical(matriculados$resumen$max, 45)
  # El histograma reparte TODO lo que tiene dato: un bin perdido es una barra
  # que nadie ve y un total que no cuadra.
  expect_identical(
    sum(vapply(matriculados$resumen$bins, function(b) b$n, integer(1))),
    matriculados$con_dato
  )
})

test_that("no ofrece columnas de contacto ni identificadores", {
  perfil <- calc_muestra_explorar_base(datos = .expl_base())
  nombres <- vapply(perfil$columnas, function(col) col$columna, character(1))
  # Un correo o un código de alumno producen tantas categorías como filas.
  expect_false("Correo PUCP" %in% nombres)
  expect_false("Código PUCP" %in% nombres)
  # El nombre de la persona trae una categoría por estudiante —29.090 en la base
  # real— y además es dato personal que la pantalla no necesita mostrar.
  expect_false("Nombre Completo" %in% nombres)
  # Y una columna sin un solo dato no se ofrece como si tuviera algo que contar.
  expect_false("Vacia" %in% nombres)
  expect_true("Facultad" %in% nombres)
})

test_that("un filtro por facultad responde «cuántos tipos de curso hay aquí»", {
  perfil <- calc_muestra_explorar_base(
    datos = .expl_base(),
    filtros = list(list(columna = "Facultad", valores = "CIENCIAS"))
  )
  expect_identical(perfil$filas, 7L)
  # `filas_base` conserva el universo para poder decir «7 de 12».
  expect_identical(perfil$filas_base, 12L)

  tipo <- .expl_col(perfil, "Tipo de curso")
  reparto <- vapply(tipo$categorias, function(c) c$n, integer(1))
  names(reparto) <- vapply(tipo$categorias, function(c) c$clave, character(1))
  expect_identical(unname(reparto[["TEORICO"]]), 4L)
  expect_identical(unname(reparto[["LABORATORIO"]]), 2L)
  expect_identical(unname(reparto[["TALLER"]]), 1L)
  expect_false("SEMINARIO" %in% names(reparto))
})

test_that("los filtros cruzan columnas en AND y admiten varios valores en OR", {
  cruzado <- calc_muestra_explorar_base(
    datos = .expl_base(),
    filtros = list(
      list(columna = "Facultad", valores = "CIENCIAS"),
      list(columna = "Tipo de curso", valores = c("LABORATORIO", "TALLER"))
    )
  )
  # CIENCIAS tiene 2 laboratorios y 1 taller: el AND acota y el OR suma dentro.
  expect_identical(cruzado$filas, 3L)
})

test_that("un filtro sobre una columna inexistente no vacia la base en silencio", {
  # Preferible ignorar el filtro imposible a devolver cero filas y hacer pensar
  # que la base no tiene nada: el vacío mentiría sobre el dato.
  perfil <- calc_muestra_explorar_base(
    datos = .expl_base(),
    filtros = list(list(columna = "Columna que no existe", valores = "X"))
  )
  expect_identical(perfil$filas, 12L)
})

test_that("contar estudiantes no es contar matriculas", {
  # Una fila por estudiante-curso, como MATRICULADO: A001 lleva tres cursos.
  base <- data.frame(
    `Código PUCP` = c("A001", "A001", "A001", "A002", "A003"),
    Sexo = c("F", "F", "F", "M", "F"),
    Modalidad = c("PRESENCIAL", "PRESENCIAL", "VIRTUAL", "PRESENCIAL", "VIRTUAL"),
    Edad = c(20, 20, 20, 31, 25),
    check.names = FALSE, stringsAsFactors = FALSE
  )

  por_filas <- calc_muestra_explorar_base(datos = base)
  sexo_filas <- .expl_col(por_filas, "Sexo")
  # Contando matrículas, A001 pesa tres veces: 4 «F» de 5 filas.
  expect_identical(sexo_filas$categorias[[1L]]$n, 4L)
  expect_identical(por_filas$unidad, "filas")

  por_persona <- calc_muestra_explorar_base(datos = base, unidad = "estudiantes")
  sexo <- .expl_col(por_persona, "Sexo")
  reparto <- vapply(sexo$categorias, function(c) c$n, integer(1))
  names(reparto) <- vapply(sexo$categorias, function(c) c$clave, character(1))
  # Contando personas: dos mujeres (A001, A003) y un hombre (A002).
  expect_identical(unname(reparto[["F"]]), 2L)
  expect_identical(unname(reparto[["M"]]), 1L)
  expect_identical(por_persona$unidad, "estudiantes")
  expect_identical(por_persona$estudiantes, 3L)
})

test_that("el total habla la misma unidad que el reparto", {
  # Medido en pantalla: con las categorias contando personas y `con_dato`
  # contando filas, TEORICO salia 4.606 sobre 23.301 matriculas —19,8%— cuando
  # son 4.606 de 4.649 estudiantes. El porcentaje mentia por el denominador.
  base <- data.frame(
    `Código PUCP` = c("A001", "A001", "A001", "A002", "A003", "A003"),
    `Tipo Curso` = c("TEORICO", "TEORICO", "LABORATORIO", "TEORICO", "TEORICO", "TEORICO"),
    Edad = c(20, 20, 20, 31, 25, 25),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  perfil <- calc_muestra_explorar_base(datos = base, unidad = "estudiantes")

  tipo <- .expl_col(perfil, "Tipo Curso")
  expect_identical(tipo$con_dato, 3L)
  expect_identical(tipo$categorias[[1L]]$clave, "TEORICO")
  expect_identical(tipo$categorias[[1L]]$n, 3L)

  # La edad es del estudiante: se describe una vez por persona, y el histograma
  # tiene que repartir exactamente ese total.
  edad <- .expl_col(perfil, "Edad")
  expect_identical(edad$con_dato, 3L)
  expect_identical(
    sum(vapply(edad$resumen$bins, function(b) b$n, integer(1))),
    3L
  )
})

test_that("un estudiante en dos categorias cuenta en las dos", {
  base <- data.frame(
    `Código PUCP` = c("A001", "A001", "A002"),
    Modalidad = c("PRESENCIAL", "VIRTUAL", "PRESENCIAL"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  perfil <- calc_muestra_explorar_base(datos = base, unidad = "estudiantes")
  modalidad <- .expl_col(perfil, "Modalidad")
  total <- sum(vapply(modalidad$categorias, function(c) c$n, integer(1)))
  # A001 lleva un curso presencial y otro virtual: cuenta en ambas, así que la
  # suma (3) supera los estudiantes (2). Es la lectura correcta —cuántas
  # personas hay en cada categoría— y la superficie tiene que declararlo.
  expect_identical(total, 3L)
  expect_identical(perfil$estudiantes, 2L)
})

test_that("sin columna de estudiante la unidad por persona no se finge", {
  base <- data.frame(
    Facultad = c("CIENCIAS", "DERECHO"),
    Modalidad = "PRESENCIAL",
    check.names = FALSE, stringsAsFactors = FALSE
  )
  perfil <- calc_muestra_explorar_base(datos = base, unidad = "estudiantes")
  expect_false(perfil$unidad_disponible)
  expect_identical(perfil$unidad, "filas")
})
