# Las facultades que no participan del estudio se declaran, no se deducen.
#
# Medido sobre HSVG2026: `exclude_level_patterns` busca «posgrado», «maestria» o
# «doctorado» dentro de la columna `level`, y ahi `level` es un numero de ciclo
# ("1".."9"), asi que el patron no coincide nunca y NO excluye ni una sola aula.
# Lo que dejaba fuera a 850 de las 852 aulas de posgrado era, de rebote,
# `min_eligible_per_class = 15`: son aulas pequeñas. Las dos que superaban el
# minimo entraron al marco con `exclude_reason` vacia.
#
# Excluir por tamaño no es excluir por diseño: basta bajar el minimo para que
# posgrado vuelva a entrar y pueda salir sorteado.

test_that("una facultad listada no aporta ninguna fila elegible", {
  claves <- .cm_aulas_facultad_excluida(
    c("ESCUELA DE POSGRADO", "DERECHO", "ESCUELA DE POSGRADO"),
    list("ESCUELA DE POSGRADO")
  )
  expect_equal(claves, c(TRUE, FALSE, TRUE))
})

test_that("la comparacion aguanta acentos, mayusculas y espacios de mas", {
  # La lista la escribe una persona y la base la escribe la universidad.
  expect_true(all(.cm_aulas_facultad_excluida(
    c("Escuela de Posgrado", "ESCUELA  DE POSGRADO ", "escuela de posgrado"),
    list("ESCUELA DE POSGRADO")
  )))
  expect_true(.cm_aulas_facultad_excluida("PSICOLOGÍA", list("PSICOLOGIA")))
})

test_that("con la lista vacia no se excluye a nadie", {
  # Default vacio: ningun proyecto existente cambia de comportamiento.
  faculty <- c("DERECHO", "ESCUELA DE POSGRADO", "PSICOLOGIA")
  expect_false(any(.cm_aulas_facultad_excluida(faculty, list())))
  expect_false(any(.cm_aulas_facultad_excluida(faculty, NULL)))
  # Una entrada en blanco tampoco excluye: es ausencia, no una facultad.
  expect_false(any(.cm_aulas_facultad_excluida(faculty, list("", "   "))))
})

test_that("una facultad que no esta en la lista sigue entrando", {
  # Control: el filtro no puede volverse un cedazo que se lo lleve todo.
  expect_false(.cm_aulas_facultad_excluida("DERECHO", list("ESCUELA DE POSGRADO")))
})

test_that("el filtro viaja en la config con default vacio", {
  cfg <- calc_muestra_aulas_default_config()
  expect_true("excluded_faculties" %in% names(cfg$filters))
  expect_length(cfg$filters$excluded_faculties, 0L)
})

test_that("la config normalizada conserva lo que el usuario declaro", {
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(excluded_faculties = list("ESCUELA DE POSGRADO", "ESCUELA DE ESTUDIOS ESPECIALES"))
  ))
  expect_equal(
    unlist(cfg$filters$excluded_faculties, use.names = FALSE),
    c("ESCUELA DE POSGRADO", "ESCUELA DE ESTUDIOS ESPECIALES")
  )
})

test_that("el alias en castellano tambien se acepta", {
  cfg <- calc_muestra_aulas_normalize_config(list(
    filters = list(facultades_excluidas = list("ESCUELA DE POSGRADO"))
  ))
  expect_equal(unlist(cfg$filters$excluded_faculties, use.names = FALSE), "ESCUELA DE POSGRADO")
})

# --- Efecto end-to-end -------------------------------------------------------
# Los tests de arriba cubren el helper y la config. El mutante que quitaba
# `faculty_ok` de `eligible_student` SOBREVIVIA a todos ellos, porque ninguno
# construia un marco. Estos si.

fex_base <- function(por_aula = 20L) {
  filas <- lapply(seq_len(6L), function(i) {
    facultad <- if (i <= 3L) "DERECHO" else "ESCUELA DE POSGRADO"
    inicio <- (i - 1L) * por_aula + 1L
    data.frame(
      student_id = paste0("e", seq(inicio, inicio + por_aula - 1L)),
      aula_id = sprintf("A%02d", i),
      curso_id = paste0("C", i),
      curso = paste("Curso", i),
      horario = "L 8",
      facultad = facultad,
      programa = "P1",
      sexo = "F",
      edad = 20,
      condicion = "regular",
      nivel = "pregrado",
      modalidad = "presencial",
      stringsAsFactors = FALSE
    )
  })
  do.call(rbind, filas)
}

fex_frame <- function(excluidas = list()) {
  calc_muestra_aulas_construir(
    base_madre = fex_base(),
    config = list(filters = list(excluded_faculties = excluidas, min_eligible_per_class = 5L))
  )
}

test_that("sin lista, las dos facultades entran al marco", {
  # Control imprescindible: si el marco ya viniera vacio, el test de abajo
  # pasaria sin medir nada.
  af <- fex_frame()$aula_frame
  expect_equal(sum(af$included %in% TRUE & af$faculty == "DERECHO"), 3L)
  expect_equal(sum(af$included %in% TRUE & af$faculty == "ESCUELA DE POSGRADO"), 3L)
})

test_that("la facultad excluida sale del marco con cero aulas y cero elegibles", {
  af <- fex_frame(list("ESCUELA DE POSGRADO"))$aula_frame
  posg <- af[af$faculty == "ESCUELA DE POSGRADO", , drop = FALSE]
  expect_equal(sum(posg$included %in% TRUE), 0L)
  expect_equal(sum(suppressWarnings(as.numeric(posg$eligible_n))), 0)
  # Y la otra facultad no se ve arrastrada.
  expect_equal(sum(af$included %in% TRUE & af$faculty == "DERECHO"), 3L)
})

test_that("la exclusion dice su nombre, no se disfraza de aula pequeña", {
  af <- fex_frame(list("ESCUELA DE POSGRADO"))$aula_frame
  posg <- af[af$faculty == "ESCUELA DE POSGRADO", , drop = FALSE]
  expect_true(all(grepl("faculty_excluida", posg$exclude_reason, fixed = TRUE)))
})

test_that("la poblacion del marco baja al excluir la facultad", {
  # `population_n` es el conteo de alumnos unicos: 120 con las dos, 60 con una.
  metrica <- function(fr) {
    a <- fr$audit
    suppressWarnings(as.numeric(a$value[a$metric == "population_n"]))
  }
  expect_equal(metrica(fex_frame()), 120)
  expect_equal(metrica(fex_frame(list("ESCUELA DE POSGRADO"))), 60)
})
