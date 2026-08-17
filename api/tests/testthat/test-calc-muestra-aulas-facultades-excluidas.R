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

# Una unidad excluida tampoco entra con la ETIQUETA del aula.
#
# `excluded_faculties` filtraba ALUMNOS. Pero un aula se etiqueta con la
# facultad modal de su curso-horario, y esa puede ser una excluida aunque sus
# elegibles vengan de otras unidades. Medido en HSVG2026: con `ESCUELA DE
# ESTUDIOS ESPECIALES` en la lista, el aula `soc254_0731` —curso «Cultura y
# sociedad», programa de movilidad estudiantil internacional— seguia entrando al
# marco con 12 elegibles y la etiqueta de la facultad excluida. Para el analista
# eso es una contradiccion visible: pidio que esa unidad no participara y la ve.
#
# Es la misma confusion que costo el criterio de nivel: la facultad del ALUMNO y
# la del AULA son cosas distintas.

.fex_base <- function() rbind(
  do.call(rbind, lapply(1:12, function(j) data.frame(
    student_id = paste0("x", j), aula_id = "A01", curso_id = "C1", curso = "Cultura",
    horario = "L 8", facultad = "ESCUELA DE ESTUDIOS ESPECIALES", programa = "MOVILIDAD",
    sexo = "F", edad = 20, condicion = "regular", nivel = "pregrado",
    modalidad = "presencial", tipo_sesion = "TEORICO", stringsAsFactors = FALSE))),
  do.call(rbind, lapply(1:12, function(j) data.frame(
    student_id = paste0("y", j), aula_id = "A02", curso_id = "C2", curso = "Penal",
    horario = "L 8", facultad = "DERECHO", programa = "P1",
    sexo = "F", edad = 20, condicion = "regular", nivel = "pregrado",
    modalidad = "presencial", tipo_sesion = "TEORICO", stringsAsFactors = FALSE))))

.fex_frame <- function(excluidas = list()) calc_muestra_aulas_construir(
  base_madre = .fex_base(),
  config = list(mapping = list(session_type = "tipo_sesion"),
                filters = list(min_eligible_per_class = 5L, excluded_faculties = excluidas))
)$aula_frame

test_that("el aula de una facultad excluida NO entra al marco", {
  af <- .fex_frame(list("ESCUELA DE ESTUDIOS ESPECIALES"))
  expect_false(af$included[af$faculty == "ESCUELA DE ESTUDIOS ESPECIALES"])
  # Y la exclusion no alcanza a las demas: no es un apagado global.
  expect_true(af$included[af$faculty == "DERECHO"])
})

test_that("CONTROL: sin lista de exclusion las dos entran", {
  # Si esto ya excluyera algo, el test de arriba pasaria sin medir nada.
  af <- .fex_frame(list())
  expect_true(all(af$included))
})

test_that("el emparejamiento es por nombre normalizado, no por parecido", {
  # Una abreviatura NO es la misma unidad: excluir por parecido borraria
  # facultades que nadie pidio sacar.
  af <- .fex_frame(list("ESC. DE ESTUDIOS ESPECIALES"))
  expect_true(af$included[af$faculty == "ESCUELA DE ESTUDIOS ESPECIALES"])
  # Pero mayusculas y minusculas si son la misma.
  af2 <- .fex_frame(list("Escuela de Estudios Especiales"))
  expect_false(af2$included[af2$faculty == "ESCUELA DE ESTUDIOS ESPECIALES"])
})
